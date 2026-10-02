import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import {
  applyAction,
  canStart,
  projectStateFor,
  resetToLobby,
  startGame,
  swapTeams,
  type Action,
  type GameState,
  type Result,
} from '@codenames/engine';
import type { Dictionary } from '@codenames/words';
import {
  parseClientMessage,
  type ChatMessage,
  type ClientEventName,
  type ClientMessages,
  type ErrorPayload,
} from '@codenames/protocol';
import { RoomManager, type Room } from '../rooms/RoomManager.ts';

/** Per-socket state. A socket belongs to at most one room at a time. */
type SocketSession = {
  playerId: string;
  roomCode: string;
};

const sessions = new WeakMap<Socket, SocketSession>();

/** Crude per-socket throttle. Chat and clues are the only spammable surfaces. */
const RATE_LIMIT = { windowMs: 1000, max: 15 };
const buckets = new WeakMap<Socket, { count: number; resetAt: number }>();

function rateLimited(socket: Socket, now: number): boolean {
  const bucket = buckets.get(socket);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(socket, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT.max;
}

export type HandlerDeps = {
  io: Server;
  rooms: RoomManager;
  dictionary: Dictionary;
  now?: () => number;
};

export function registerHandlers(deps: HandlerDeps): void {
  const { io, rooms } = deps;
  const now = deps.now ?? Date.now;

  /**
   * Push state to everyone in the room, projected per viewer.
   *
   * This is the only place game state is serialised. Each player gets their own
   * payload because a spymaster and an operative must not receive the same
   * bytes — see projectStateFor.
   */
  function broadcast(room: Room): void {
    for (const { playerId, socketId } of rooms.socketIds(room)) {
      io.to(socketId).emit('room:state', projectStateFor(room.state, playerId));
    }
  }

  function fail(socket: Socket, payload: ErrorPayload): void {
    socket.emit('error', payload);
  }

  /** Resolve the socket's seat, or report why it has none. */
  function requireSeat(socket: Socket): { room: Room; playerId: string } | null {
    const session = sessions.get(socket);
    if (!session) {
      fail(socket, { code: 'bad-request', message: 'Join a room first.' });
      return null;
    }
    const room = rooms.get(session.roomCode);
    if (!room) {
      fail(socket, { code: 'room-not-found', message: 'That room no longer exists.' });
      return null;
    }
    return { room, playerId: session.playerId };
  }

  function isHost(room: Room, playerId: string): boolean {
    return room.state.players.find((p) => p.id === playerId)?.isHost === true;
  }

  /**
   * Arm (or clear) the turn timer to match the state's deadline. Timers live on
   * the server so every client agrees on when a turn actually expired.
   */
  function syncTurnTimer(room: Room): void {
    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }
    const deadline = room.state.turnDeadline;
    if (deadline === null || room.state.phase !== 'playing') return;

    const delay = Math.max(0, deadline - now());
    room.turnTimer = setTimeout(() => {
      room.turnTimer = null;
      if (room.state.phase !== 'playing') return;
      const result = applyAction(room.state, { type: 'timeout', at: now() }, {
        dictionary: deps.dictionary,
      });
      if (result.ok) {
        room.state = result.value.state;
        broadcast(room);
        syncTurnTimer(room);
      }
    }, delay);
  }

  /** Apply an engine action and broadcast, or report the violation to the actor. */
  function dispatch(socket: Socket, room: Room, action: Action): void {
    const result = applyAction(room.state, action, { dictionary: deps.dictionary });
    if (!result.ok) {
      fail(socket, { code: result.error.code, message: result.error.message });
      return;
    }
    room.state = result.value.state;
    rooms.touch(room);
    broadcast(room);
    syncTurnTimer(room);
  }

  /** Wrap a handler with payload validation and rate limiting. */
  function on<K extends ClientEventName>(
    socket: Socket,
    event: K,
    handler: (data: ClientMessages[K]) => void,
  ): void {
    // Socket.IO's `on` overloads special-case its reserved event names, which
    // a generic K cannot satisfy. Our names never collide with those, so bind
    // through a plain listener signature.
    const listen = socket.on.bind(socket) as (
      name: string,
      listener: (raw: unknown) => void,
    ) => void;

    listen(event, (raw: unknown) => {
      if (rateLimited(socket, now())) {
        fail(socket, { code: 'rate-limited', message: 'Slow down a moment.' });
        return;
      }
      const parsed = parseClientMessage(event, raw ?? {});
      if (!parsed.ok) {
        fail(socket, { code: 'bad-request', message: parsed.message });
        return;
      }
      handler(parsed.data);
    });
  }

  io.on('connection', (socket: Socket) => {
    on(socket, 'room:join', ({ roomCode, name, playerId }) => {
      // One room per socket; leaving the old one keeps presence honest.
      const previous = sessions.get(socket);
      if (previous) {
        const old = rooms.get(previous.roomCode);
        if (old) {
          rooms.detachSocket(old, previous.playerId, socket.id);
          socket.leave(previous.roomCode);
          broadcast(old);
        }
      }

      const room = rooms.getOrCreate(roomCode);
      const seated = rooms.join(room, socket.id, name, playerId);
      if (!seated.ok) {
        fail(socket, { code: 'room-full', message: 'That room is full.' });
        return;
      }

      sessions.set(socket, { playerId: seated.player.id, roomCode: room.code });
      void socket.join(room.code);

      socket.emit('room:joined', { playerId: seated.player.id, roomCode: room.code });
      for (const message of room.chat) socket.emit('chat:message', message);
      broadcast(room);
    });

    on(socket, 'room:leave', () => {
      const seat = requireSeat(socket);
      if (!seat) return;
      rooms.removePlayer(seat.room, seat.playerId);
      sessions.delete(socket);
      void socket.leave(seat.room.code);
      broadcast(seat.room);
    });

    on(socket, 'lobby:setTeam', ({ team }) => {
      const seat = requireSeat(socket);
      if (!seat) return;
      if (seat.room.state.phase === 'playing') {
        fail(socket, { code: 'not-playing', message: 'You cannot switch teams mid-game.' });
        return;
      }
      rooms.setTeam(seat.room, seat.playerId, team);
      broadcast(seat.room);
    });

    on(socket, 'lobby:setRole', ({ role }) => {
      const seat = requireSeat(socket);
      if (!seat) return;
      if (seat.room.state.phase === 'playing') {
        fail(socket, {
          code: 'not-playing',
          message: 'You cannot become a spymaster mid-game.',
        });
        return;
      }
      rooms.setRole(seat.room, seat.playerId, role);
      broadcast(seat.room);
    });

    on(socket, 'lobby:setName', ({ name }) => {
      const seat = requireSeat(socket);
      if (!seat) return;
      const player = seat.room.state.players.find((p) => p.id === seat.playerId);
      if (!player) return;
      player.name = name;
      seat.room.state.version += 1;
      broadcast(seat.room);
    });

    on(socket, 'lobby:setRuleset', ({ ruleset }) => {
      const seat = requireSeat(socket);
      if (!seat) return;
      if (!isHost(seat.room, seat.playerId)) {
        fail(socket, { code: 'not-host', message: 'Only the host can change the rules.' });
        return;
      }
      if (seat.room.state.phase === 'playing') {
        fail(socket, {
          code: 'not-playing',
          message: 'The rules are locked once a game starts.',
        });
        return;
      }
      seat.room.state.ruleset = ruleset;
      seat.room.state.version += 1;
      rooms.touch(seat.room);
      broadcast(seat.room);
    });

    on(socket, 'game:start', () => {
      const seat = requireSeat(socket);
      if (!seat) return;
      if (!isHost(seat.room, seat.playerId)) {
        fail(socket, { code: 'not-host', message: 'Only the host can start the game.' });
        return;
      }
      const ready: Result<true> = canStart(seat.room.state);
      if (!ready.ok) {
        fail(socket, { code: ready.error.code, message: ready.error.message });
        return;
      }
      // A fresh seed per game so a rematch deals a different board.
      const started = startGame(seat.room.state, randomUUID(), now());
      if (!started.ok) {
        fail(socket, { code: started.error.code, message: started.error.message });
        return;
      }
      seat.room.state = started.value;
      rooms.touch(seat.room);
      broadcast(seat.room);
      syncTurnTimer(seat.room);
    });

    on(socket, 'game:giveClue', ({ word, count }) => {
      const seat = requireSeat(socket);
      if (!seat) return;
      dispatch(socket, seat.room, {
        type: 'give-clue',
        playerId: seat.playerId,
        word,
        count,
        at: now(),
      });
    });

    on(socket, 'game:guess', ({ cardIndex }) => {
      const seat = requireSeat(socket);
      if (!seat) return;
      dispatch(socket, seat.room, {
        type: 'guess',
        playerId: seat.playerId,
        cardIndex,
        at: now(),
      });
    });

    on(socket, 'game:pass', () => {
      const seat = requireSeat(socket);
      if (!seat) return;
      dispatch(socket, seat.room, { type: 'pass', playerId: seat.playerId, at: now() });
    });

    on(socket, 'game:rematch', () => {
      const seat = requireSeat(socket);
      if (!seat) return;
      if (!isHost(seat.room, seat.playerId)) {
        fail(socket, { code: 'not-host', message: 'Only the host can start a rematch.' });
        return;
      }
      if (seat.room.state.phase === 'playing') {
        fail(socket, { code: 'not-playing', message: 'Finish this game first.' });
        return;
      }
      // Swap sides so the first-move advantage alternates across a session.
      seat.room.state = swapTeams(resetToLobby(seat.room.state));
      seat.room.chat = [];
      rooms.touch(seat.room);
      broadcast(seat.room);
    });

    on(socket, 'chat:send', ({ text }) => {
      const seat = requireSeat(socket);
      if (!seat) return;
      const player = seat.room.state.players.find((p) => p.id === seat.playerId);
      if (!player) return;

      const message: ChatMessage = {
        id: randomUUID(),
        playerId: player.id,
        name: player.name,
        team: player.team,
        text,
        at: now(),
      };
      rooms.addChat(seat.room, message);
      io.to(seat.room.code).emit('chat:message', message);
    });

    socket.on('disconnect', () => {
      const session = sessions.get(socket);
      if (!session) return;
      const room = rooms.get(session.roomCode);
      sessions.delete(socket);
      if (!room) return;
      // Stay seated but show as offline — a dropped connection is not a forfeit.
      rooms.detachSocket(room, session.playerId, socket.id);
      broadcast(room);
    });
  });
}

/** Exposed for tests that need to assert on projections directly. */
export function viewFor(state: GameState, playerId: string | null) {
  return projectStateFor(state, playerId);
}
