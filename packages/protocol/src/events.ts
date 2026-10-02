import { z } from 'zod';
import type { ClientGameState, ViolationCode } from '@codenames/engine';

/**
 * Every message crossing the socket is declared here and validated on arrival.
 * The server trusts nothing from a client — not the room code, not the player
 * id, not even that `cardIndex` is a number.
 */

export const teamSchema = z.enum(['red', 'blue']);
export const roleSchema = z.enum(['spymaster', 'operative']);

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4,8}$/, 'Room codes are 4-8 letters and digits.');

export const playerNameSchema = z
  .string()
  .trim()
  .min(1, 'Pick a name.')
  .max(20, 'Names are 20 characters at most.');

export const rulesetSchema = z.object({
  clue: z.object({
    singleWordOnly: z.boolean(),
    mustBeDictionaryWord: z.boolean(),
    allowProperNouns: z.boolean(),
    forbidBoardWords: z.boolean(),
    forbidSharedRoots: z.boolean(),
    allowZeroAndInfinity: z.boolean(),
    maxClueNumber: z.number().int().min(1).max(25),
  }),
  turn: z.object({
    guessLimitMode: z.enum(['standard', 'unlimited', 'exact']),
    turnTimerSec: z.number().int().min(10).max(600).nullable(),
    spymasterTimerSec: z.number().int().min(10).max(600).nullable(),
  }),
  game: z.object({
    assassinCount: z.number().int().min(0).max(3),
    boardSize: z.union([z.literal(20), z.literal(25), z.literal(36)]),
    wordPackIds: z.array(z.string().max(40)).min(1).max(10),
    customWords: z.array(z.string().trim().min(1).max(30)).max(400),
  }),
});

// --- client -> server ------------------------------------------------------

export const clientMessages = {
  'room:join': z.object({
    roomCode: roomCodeSchema,
    name: playerNameSchema,
    /** Returning players send the id they were given, to reclaim their seat. */
    playerId: z.string().uuid().optional(),
  }),
  'room:leave': z.object({}),
  'lobby:setTeam': z.object({ team: teamSchema.nullable() }),
  'lobby:setRole': z.object({ role: roleSchema }),
  'lobby:setRuleset': z.object({ ruleset: rulesetSchema }),
  'lobby:setName': z.object({ name: playerNameSchema }),
  'game:start': z.object({}),
  'game:giveClue': z.object({
    word: z.string().trim().min(1).max(30),
    count: z.number().int().min(-1).max(25),
  }),
  'game:guess': z.object({ cardIndex: z.number().int().min(0).max(35) }),
  'game:pass': z.object({}),
  'game:rematch': z.object({}),
  'chat:send': z.object({ text: z.string().trim().min(1).max(300) }),
} as const;

export type ClientMessages = {
  [K in keyof typeof clientMessages]: z.infer<(typeof clientMessages)[K]>;
};

export type ClientEventName = keyof ClientMessages;

// --- server -> client ------------------------------------------------------

export type ChatMessage = {
  id: string;
  playerId: string;
  name: string;
  team: 'red' | 'blue' | null;
  text: string;
  at: number;
};

export type JoinedPayload = {
  /** Persist this; it is how a refresh reclaims the same seat. */
  playerId: string;
  roomCode: string;
};

export type ErrorPayload = {
  code: ViolationCode | 'room-not-found' | 'room-full' | 'bad-request' | 'rate-limited' | 'not-host';
  message: string;
  /** Echoed so the client can roll back the matching optimistic update. */
  requestId?: string;
};

export type ServerMessages = {
  'room:joined': JoinedPayload;
  'room:state': ClientGameState;
  'chat:message': ChatMessage;
  error: ErrorPayload;
};

export type ServerEventName = keyof ServerMessages;

/** Parse an inbound client message, returning a typed result. */
export function parseClientMessage<K extends ClientEventName>(
  event: K,
  payload: unknown,
): { ok: true; data: ClientMessages[K] } | { ok: false; message: string } {
  const schema = clientMessages[event];
  if (!schema) return { ok: false, message: `Unknown event: ${String(event)}` };
  const result = schema.safeParse(payload);
  if (!result.success) {
    const first = result.error.errors[0];
    return { ok: false, message: first?.message ?? 'Invalid payload.' };
  }
  return { ok: true, data: result.data as ClientMessages[K] };
}
