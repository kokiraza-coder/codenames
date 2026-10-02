import { collectWords } from '@codenames/words';
import { buildCards } from './board.ts';
import { createRng } from './rng.ts';
import {
  DEFAULT_RULESET,
  err,
  ok,
  type GameState,
  type Player,
  type Result,
  type Ruleset,
  type Team,
} from './types.ts';

export type CreateGameInput = {
  id: string;
  seed: string;
  ruleset?: Ruleset;
  players?: Player[];
  /** Overrides the word pool; otherwise derived from the ruleset's packs. */
  words?: readonly string[];
  at: number;
};

/** A fresh room, before anyone has started a game. */
export function createLobby(input: CreateGameInput): GameState {
  const ruleset = input.ruleset ?? structuredClone(DEFAULT_RULESET);
  return {
    id: input.id,
    seed: input.seed,
    phase: 'lobby',
    ruleset,
    players: input.players ?? [],
    cards: [],
    turn: null,
    currentClue: null,
    guessesMade: 0,
    startingTeam: 'red',
    winner: null,
    endReason: null,
    log: [],
    version: 0,
    startedAt: null,
    endedAt: null,
    turnDeadline: null,
  };
}

/**
 * A game needs at least one spymaster and one operative per team. We enforce
 * this here rather than in the UI so a crafted socket message can't start a
 * broken game.
 *
 * Takes only what it reads, so the client can call it on a projected state to
 * decide whether to enable the Start button.
 */
export function canStart(state: { players: readonly Player[] }): Result<true> {
  for (const team of ['red', 'blue'] as const) {
    const members = state.players.filter((p) => p.team === team);
    const spymasters = members.filter((p) => p.role === 'spymaster').length;
    const operatives = members.filter((p) => p.role === 'operative').length;
    if (spymasters < 1 || operatives < 1) {
      return err(
        'not-enough-players',
        `The ${team} team needs at least one spymaster and one operative.`,
      );
    }
  }
  return ok(true);
}

/**
 * Deal a board and begin. `seed` differs per game so a rematch in the same room
 * produces a different board while staying reproducible.
 */
export function startGame(state: GameState, seed: string, at: number): Result<GameState> {
  const ready = canStart(state);
  if (!ready.ok) return ready;

  const pool =
    collectWords(state.ruleset.game.wordPackIds, state.ruleset.game.customWords);
  if (pool.length < state.ruleset.game.boardSize) {
    return err(
      'not-enough-words',
      `Need at least ${state.ruleset.game.boardSize} words, but the selected packs only provide ${pool.length}.`,
    );
  }

  const rng = createRng(seed);
  const startingTeam: Team = rng() < 0.5 ? 'red' : 'blue';
  const cards = buildCards(pool, startingTeam, state.ruleset, rng);

  const next: GameState = {
    ...state,
    seed,
    phase: 'playing',
    cards,
    startingTeam,
    turn: startingTeam,
    currentClue: null,
    guessesMade: 0,
    winner: null,
    endReason: null,
    log: [{ type: 'game-started', at, startingTeam }],
    version: state.version + 1,
    startedAt: at,
    endedAt: null,
    turnDeadline: null,
  };

  const spymasterTimer = next.ruleset.turn.spymasterTimerSec;
  next.turnDeadline = spymasterTimer === null ? null : at + spymasterTimer * 1000;

  return ok(next);
}

/** Return to the lobby keeping everyone seated, ready for a rematch. */
export function resetToLobby(state: GameState): GameState {
  return {
    ...state,
    phase: 'lobby',
    cards: [],
    turn: null,
    currentClue: null,
    guessesMade: 0,
    winner: null,
    endReason: null,
    log: [],
    version: state.version + 1,
    startedAt: null,
    endedAt: null,
    turnDeadline: null,
  };
}

/**
 * Teams swap sides on a rematch so the first-move advantage evens out across a
 * session — the same convention most play groups use in person.
 */
export function swapTeams(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      team: p.team === null ? null : p.team === 'red' ? 'blue' : 'red',
    })),
    version: state.version + 1,
  };
}
