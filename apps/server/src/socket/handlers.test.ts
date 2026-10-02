import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDictionary } from '@codenames/words';
import type { ClientGameState } from '@codenames/engine';
import { RoomManager } from '../rooms/RoomManager.ts';
import { registerHandlers } from './handlers.ts';

/**
 * These run against a real Socket.IO server over a real TCP port. The point is
 * to catch the things unit tests cannot: per-socket projection, turn
 * authorisation across connections, and reconnect behaviour.
 */

let http: HttpServer;
let io: Server;
let port: number;
const clients: ClientSocket[] = [];

beforeEach(async () => {
  http = createServer();
  io = new Server(http, { transports: ['websocket'] });
  registerHandlers({
    io,
    rooms: new RoomManager(),
    dictionary: createDictionary(['water', 'ocean', 'zephyr']),
  });
  await new Promise<void>((resolve) => http.listen(0, resolve));
  port = (http.address() as AddressInfo).port;
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  io.close();
  await new Promise<void>((resolve) => http.close(() => resolve()));
});

/** A connected client plus helpers for awaiting specific server pushes. */
type Harness = {
  socket: ClientSocket;
  playerId: string;
  /** Latest projection this client received. */
  state: () => ClientGameState;
  /** Resolve once a projection satisfying `predicate` arrives. */
  until: (predicate: (s: ClientGameState) => boolean, label?: string) => Promise<ClientGameState>;
  nextError: () => Promise<{ code: string; message: string }>;
};

async function join(roomCode: string, name: string): Promise<Harness> {
  const socket = connect(`http://localhost:${port}`, { transports: ['websocket'] });
  clients.push(socket);

  let latest: ClientGameState | null = null;
  const waiters: Array<{ predicate: (s: ClientGameState) => boolean; resolve: (s: ClientGameState) => void }> = [];

  socket.on('room:state', (s: ClientGameState) => {
    latest = s;
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i]!.predicate(s)) waiters.splice(i, 1)[0]!.resolve(s);
    }
  });

  const playerId = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${name} never joined`)), 4000);
    socket.on('connect', () => socket.emit('room:join', { roomCode, name }));
    socket.on('room:joined', (p: { playerId: string }) => {
      clearTimeout(timer);
      resolve(p.playerId);
    });
  });

  return {
    socket,
    playerId,
    state: () => {
      if (!latest) throw new Error(`${name} has no state yet`);
      return latest;
    },
    until: (predicate, label = 'condition') =>
      new Promise((resolve, reject) => {
        if (latest && predicate(latest)) return resolve(latest);
        const timer = setTimeout(() => reject(new Error(`${name}: timed out waiting for ${label}`)), 4000);
        waiters.push({
          predicate,
          resolve: (s) => {
            clearTimeout(timer);
            resolve(s);
          },
        });
      }),
    nextError: () =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${name}: no error arrived`)), 4000);
        socket.once('error', (e: { code: string; message: string }) => {
          clearTimeout(timer);
          resolve(e);
        });
      }),
  };
}

/** Seat four players and start the game. Returns everyone plus the host. */
async function startedRoom(roomCode: string) {
  const redSpy = await join(roomCode, 'RedSpy');
  const redOp = await join(roomCode, 'RedOp');
  const blueSpy = await join(roomCode, 'BlueSpy');
  const blueOp = await join(roomCode, 'BlueOp');

  redSpy.socket.emit('lobby:setTeam', { team: 'red' });
  redSpy.socket.emit('lobby:setRole', { role: 'spymaster' });
  redOp.socket.emit('lobby:setTeam', { team: 'red' });
  blueSpy.socket.emit('lobby:setTeam', { team: 'blue' });
  blueSpy.socket.emit('lobby:setRole', { role: 'spymaster' });
  blueOp.socket.emit('lobby:setTeam', { team: 'blue' });

  await redSpy.until(
    (s) => s.players.filter((p) => p.team !== null).length === 4
      && s.players.filter((p) => p.role === 'spymaster').length === 2,
    'all four seated',
  );

  redSpy.socket.emit('game:start');
  await redSpy.until((s) => s.phase === 'playing', 'game start');
  await Promise.all([
    redOp.until((s) => s.phase === 'playing'),
    blueSpy.until((s) => s.phase === 'playing'),
    blueOp.until((s) => s.phase === 'playing'),
  ]);

  return { redSpy, redOp, blueSpy, blueOp };
}

const spyFor = (r: Awaited<ReturnType<typeof startedRoom>>, team: 'red' | 'blue') =>
  team === 'red' ? r.redSpy : r.blueSpy;
const opFor = (r: Awaited<ReturnType<typeof startedRoom>>, team: 'red' | 'blue') =>
  team === 'red' ? r.redOp : r.blueOp;

describe('joining and lobby', () => {
  it('creates the room on first join and assigns the first player as host', async () => {
    const a = await join('TEST', 'Alice');
    const s = await a.until((st) => st.players.length === 1);
    expect(s.players[0]!.isHost).toBe(true);
    expect(s.phase).toBe('lobby');
  });

  it('shows new players to everyone already in the room', async () => {
    const a = await join('TEST', 'Alice');
    await join('TEST', 'Bob');
    const s = await a.until((st) => st.players.length === 2, 'Bob to appear');
    expect(s.players.map((p) => p.name)).toEqual(['Alice', 'Bob']);
    expect(s.players[1]!.isHost).toBe(false);
  });

  it('refuses to start without a spymaster and operative on each team', async () => {
    const a = await join('TEST', 'Alice');
    a.socket.emit('lobby:setTeam', { team: 'red' });
    const error = a.nextError();
    a.socket.emit('game:start');
    expect((await error).code).toBe('not-enough-players');
  });

  it('only lets the host start the game', async () => {
    const room = await join('TEST', 'Alice');
    const bob = await join('TEST', 'Bob');
    const error = bob.nextError();
    bob.socket.emit('game:start');
    expect((await error).code).toBe('not-host');
    expect(room.state().phase).toBe('lobby');
  });

  it('rejects a malformed payload', async () => {
    const a = await join('TEST', 'Alice');
    const error = a.nextError();
    a.socket.emit('lobby:setTeam', { team: 'green' });
    expect((await error).code).toBe('bad-request');
  });
});

describe('a full game over real sockets', () => {
  it('deals a board that only spymasters can read', async () => {
    const room = await startedRoom('TEST');

    const opView = room.redOp.state();
    const spyView = room.redSpy.state();

    expect(opView.cards).toHaveLength(25);
    expect(opView.you?.canSeeKey).toBe(false);
    expect(spyView.you?.canSeeKey).toBe(true);

    // The operative's payload contains no colours at all before any reveal.
    expect(JSON.stringify(opView.cards)).not.toContain('color');
    expect(spyView.cards.every((c) => c.color !== undefined)).toBe(true);

    // Both views agree on the words, in the same order.
    expect(opView.cards.map((c) => c.word)).toEqual(spyView.cards.map((c) => c.word));
  });

  it('runs clue -> guess -> reveal and pushes it to every client', async () => {
    const room = await startedRoom('TEST');
    const team = room.redSpy.state().turn!;
    const spy = spyFor(room, team);
    const op = opFor(room, team);

    spy.socket.emit('game:giveClue', { word: 'zephyr', count: 2 });
    await op.until((s) => s.currentClue?.word === 'ZEPHYR', 'clue to arrive');
    expect(op.state().guessesAllowed).toBe(3);

    // Pick one of this team's own cards, which only the spymaster can identify.
    const index = spy.state().cards.findIndex((c) => c.color === team && !c.revealed);
    op.socket.emit('game:guess', { cardIndex: index });

    for (const h of [room.redSpy, room.redOp, room.blueSpy, room.blueOp]) {
      const s = await h.until((st) => st.cards[index]!.revealed, 'reveal to propagate');
      // A revealed card's colour is public to everyone.
      expect(s.cards[index]!.color).toBe(team);
    }
    expect(op.state().turn).toBe(team);
  });

  it("rejects a guess from the team that is not to move", async () => {
    const room = await startedRoom('TEST');
    const team = room.redSpy.state().turn!;
    const idle = team === 'red' ? 'blue' : 'red';

    spyFor(room, team).socket.emit('game:giveClue', { word: 'zephyr', count: 1 });
    await opFor(room, idle).until((s) => s.currentClue !== null);

    const error = opFor(room, idle).nextError();
    opFor(room, idle).socket.emit('game:guess', { cardIndex: 0 });
    expect((await error).code).toBe('not-your-turn');
  });

  it('refuses a clue that breaks the room ruleset', async () => {
    const room = await startedRoom('TEST');
    const team = room.redSpy.state().turn!;
    const spy = spyFor(room, team);

    // Default ruleset forbids board words and multi-word clues.
    const boardWord = spy.state().cards[0]!.word;
    let error = spy.nextError();
    spy.socket.emit('game:giveClue', { word: boardWord, count: 1 });
    expect((await error).code).toBe('clue-is-board-word');

    error = spy.nextError();
    spy.socket.emit('game:giveClue', { word: 'two words', count: 1 });
    expect((await error).code).toBe('clue-not-single-word');

    expect(spy.state().currentClue).toBeNull();
  });

  it('ends the game on the assassin and reveals the key to everyone', async () => {
    const room = await startedRoom('TEST');
    const team = room.redSpy.state().turn!;
    const spy = spyFor(room, team);
    const op = opFor(room, team);

    spy.socket.emit('game:giveClue', { word: 'zephyr', count: 1 });
    await op.until((s) => s.currentClue !== null);

    const assassin = spy.state().cards.findIndex((c) => c.color === 'assassin');
    op.socket.emit('game:guess', { cardIndex: assassin });

    const finished = await op.until((s) => s.phase === 'finished', 'game to end');
    expect(finished.winner).toBe(team === 'red' ? 'blue' : 'red');
    expect(finished.endReason).toBe('assassin');
    // Once it is over, the whole key is public.
    expect(finished.cards.every((c) => c.color !== undefined)).toBe(true);
  });
});

describe('presence and reconnection', () => {
  it('marks a player offline on disconnect without freeing their seat', async () => {
    const alice = await join('TEST', 'Alice');
    const bob = await join('TEST', 'Bob');
    await alice.until((s) => s.players.length === 2);

    bob.socket.disconnect();
    const s = await alice.until(
      (st) => st.players.some((p) => p.name === 'Bob' && !p.connected),
      'Bob to go offline',
    );
    expect(s.players).toHaveLength(2);
  });

  it('restores the same seat, team and role when a player reconnects', async () => {
    const room = await startedRoom('TEST');
    const team = room.redSpy.state().turn!;
    const spy = spyFor(room, team);
    spy.socket.emit('game:giveClue', { word: 'zephyr', count: 2 });
    await spy.until((s) => s.currentClue !== null);

    const before = spy.state();
    const savedId = spy.playerId;
    spy.socket.disconnect();

    // Reconnect with the stored player id, the way a browser refresh would.
    const again = connect(`http://localhost:${port}`, { transports: ['websocket'] });
    clients.push(again);
    const restored = await new Promise<ClientGameState>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no state after reconnect')), 4000);
      again.on('connect', () =>
        again.emit('room:join', { roomCode: 'TEST', name: 'RedSpy', playerId: savedId }),
      );
      again.on('room:state', (s: ClientGameState) => {
        clearTimeout(timer);
        resolve(s);
      });
    });

    expect(restored.you?.canSeeKey).toBe(true);
    expect(restored.phase).toBe('playing');
    expect(restored.currentClue?.word).toBe('ZEPHYR');
    expect(restored.players).toHaveLength(4);
    // The board is identical, key included.
    expect(restored.cards.map((c) => c.color)).toEqual(before.cards.map((c) => c.color));
  });

  it('frees the seat on an explicit leave and hands over the host role', async () => {
    const alice = await join('TEST', 'Alice');
    const bob = await join('TEST', 'Bob');
    await bob.until((s) => s.players.length === 2);

    alice.socket.emit('room:leave');
    const s = await bob.until((st) => st.players.length === 1, 'Alice to leave');
    expect(s.players[0]!.name).toBe('Bob');
    expect(s.players[0]!.isHost).toBe(true);
  });
});

describe('rematch', () => {
  it('returns to the lobby, swaps sides and deals a different board', async () => {
    const room = await startedRoom('TEST');
    const team = room.redSpy.state().turn!;
    const spy = spyFor(room, team);
    const op = opFor(room, team);

    spy.socket.emit('game:giveClue', { word: 'zephyr', count: 1 });
    await op.until((s) => s.currentClue !== null);
    const assassin = spy.state().cards.findIndex((c) => c.color === 'assassin');
    const firstBoard = spy.state().cards.map((c) => c.word);
    op.socket.emit('game:guess', { cardIndex: assassin });
    await op.until((s) => s.phase === 'finished');

    room.redSpy.socket.emit('game:rematch');
    const lobby = await room.redSpy.until((s) => s.phase === 'lobby', 'return to lobby');

    // Sides swapped, so the red spymaster is now on blue.
    expect(lobby.players.find((p) => p.name === 'RedSpy')!.team).toBe('blue');
    expect(lobby.players.find((p) => p.name === 'RedSpy')!.role).toBe('spymaster');

    room.redSpy.socket.emit('game:start');
    const next = await room.redSpy.until((s) => s.phase === 'playing', 'second game');
    expect(next.cards.map((c) => c.word)).not.toEqual(firstBoard);
  });
});
