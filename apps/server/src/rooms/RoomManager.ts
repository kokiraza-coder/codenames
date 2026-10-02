import { randomUUID } from 'node:crypto';
import {
  createLobby,
  randomRoomCode,
  type GameState,
  type Player,
  type Role,
  type Team,
} from '@codenames/engine';
import type { ChatMessage } from '@codenames/protocol';

export type Room = {
  code: string;
  state: GameState;
  chat: ChatMessage[];
  /** playerId -> set of socket ids. One player may have several tabs open. */
  sockets: Map<string, Set<string>>;
  createdAt: number;
  lastActivity: number;
  /** Set when the room empties; cleared when someone returns. */
  evictAt: number | null;
  /** Timer that ends a turn when the room has one configured. */
  turnTimer: NodeJS.Timeout | null;
};

const MAX_PLAYERS = 20;
const MAX_CHAT = 100;
/** How long an empty room is kept warm so a refresh or dropout can return. */
export const EVICT_AFTER_MS = 30 * 60 * 1000;

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  // Written out rather than a parameter property: Node's strip-only TypeScript
  // mode cannot desugar those, and we run this file directly in dev.
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  get size(): number {
    return this.rooms.size;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  /** A code that is not currently in use. */
  freeCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      const code = randomRoomCode(4);
      if (!this.rooms.has(code)) return code;
    }
    // Vanishingly unlikely with 32^4 codes, but a longer code always resolves it.
    return randomRoomCode(6);
  }

  /** Rooms are created implicitly on first join, like codenames.game. */
  getOrCreate(code: string): Room {
    const key = code.toUpperCase();
    const existing = this.rooms.get(key);
    if (existing) return existing;

    const at = this.now();
    const room: Room = {
      code: key,
      state: createLobby({ id: key, seed: randomUUID(), at }),
      chat: [],
      sockets: new Map(),
      createdAt: at,
      lastActivity: at,
      evictAt: null,
      turnTimer: null,
    };
    this.rooms.set(key, room);
    return room;
  }

  touch(room: Room): void {
    room.lastActivity = this.now();
    room.evictAt = null;
  }

  /**
   * Seat a player. Returning players keep their team, role and host status —
   * that is what makes a refresh mid-game a non-event.
   */
  join(
    room: Room,
    socketId: string,
    name: string,
    playerId?: string,
  ): { ok: true; player: Player } | { ok: false; reason: 'room-full' } {
    const existing = playerId ? room.state.players.find((p) => p.id === playerId) : undefined;

    if (existing) {
      existing.connected = true;
      existing.name = name;
      this.attachSocket(room, existing.id, socketId);
      this.touch(room);
      return { ok: true, player: existing };
    }

    if (room.state.players.length >= MAX_PLAYERS) {
      return { ok: false, reason: 'room-full' };
    }

    const player: Player = {
      id: randomUUID(),
      name,
      team: null,
      role: 'operative',
      connected: true,
      isHost: room.state.players.length === 0,
      isGuest: true,
    };
    room.state.players.push(player);
    room.state.version += 1;
    this.attachSocket(room, player.id, socketId);
    this.touch(room);
    return { ok: true, player };
  }

  private attachSocket(room: Room, playerId: string, socketId: string): void {
    const set = room.sockets.get(playerId) ?? new Set<string>();
    set.add(socketId);
    room.sockets.set(playerId, set);
  }

  /**
   * Drop one socket. The player stays seated and simply shows as disconnected,
   * because a mid-game disconnect must not forfeit their cards or their turn.
   */
  detachSocket(room: Room, playerId: string, socketId: string): void {
    const set = room.sockets.get(playerId);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) {
      room.sockets.delete(playerId);
      const player = room.state.players.find((p) => p.id === playerId);
      if (player) {
        player.connected = false;
        room.state.version += 1;
      }
    }
    this.afterLeave(room);
  }

  /** Explicitly leave: free the seat entirely. */
  removePlayer(room: Room, playerId: string): void {
    const index = room.state.players.findIndex((p) => p.id === playerId);
    if (index === -1) return;
    const [removed] = room.state.players.splice(index, 1);
    room.sockets.delete(playerId);
    room.state.version += 1;

    // Hand the host role to whoever is still here, so a room never gets stuck
    // with no one able to start the next game.
    if (removed?.isHost) {
      const heir = room.state.players.find((p) => p.connected) ?? room.state.players[0];
      if (heir) heir.isHost = true;
    }
    this.afterLeave(room);
  }

  private afterLeave(room: Room): void {
    room.lastActivity = this.now();
    if (room.sockets.size === 0) {
      room.evictAt = this.now() + EVICT_AFTER_MS;
    }
  }

  setTeam(room: Room, playerId: string, team: Team | null): void {
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player) return;
    player.team = team;
    // Leaving a team can't leave you as a spymaster of nothing.
    if (team === null) player.role = 'operative';
    room.state.version += 1;
    this.touch(room);
  }

  setRole(room: Room, playerId: string, role: Role): void {
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player || player.team === null) return;
    player.role = role;
    room.state.version += 1;
    this.touch(room);
  }

  addChat(room: Room, message: ChatMessage): void {
    room.chat.push(message);
    if (room.chat.length > MAX_CHAT) room.chat.splice(0, room.chat.length - MAX_CHAT);
    this.touch(room);
  }

  /** Every socket currently in the room, across all players. */
  *socketIds(room: Room): Generator<{ playerId: string; socketId: string }> {
    for (const [playerId, sockets] of room.sockets) {
      for (const socketId of sockets) yield { playerId, socketId };
    }
  }

  /** Drop rooms that have been empty past the grace period. Returns the count. */
  evictStale(): number {
    const now = this.now();
    let evicted = 0;
    for (const [code, room] of this.rooms) {
      if (room.evictAt !== null && now >= room.evictAt) {
        if (room.turnTimer) clearTimeout(room.turnTimer);
        this.rooms.delete(code);
        evicted++;
      }
    }
    return evicted;
  }
}
