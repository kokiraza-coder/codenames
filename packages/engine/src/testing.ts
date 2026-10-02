import { createLobby, startGame } from './state.ts';
import {
  DEFAULT_RULESET,
  type CardColor,
  type GameState,
  type Player,
  type Ruleset,
} from './types.ts';

/** Four players: a spymaster and an operative on each team. */
export function fourPlayers(): Player[] {
  return [
    { id: 'rs', name: 'Red Spy', team: 'red', role: 'spymaster', connected: true, isHost: true, isGuest: true },
    { id: 'ro', name: 'Red Op', team: 'red', role: 'operative', connected: true, isHost: false, isGuest: true },
    { id: 'bs', name: 'Blue Spy', team: 'blue', role: 'spymaster', connected: true, isHost: false, isGuest: true },
    { id: 'bo', name: 'Blue Op', team: 'blue', role: 'operative', connected: true, isHost: false, isGuest: true },
  ];
}

export function ruleset(overrides: Partial<Ruleset> = {}): Ruleset {
  const base = structuredClone(DEFAULT_RULESET);
  return {
    clue: { ...base.clue, ...overrides.clue },
    turn: { ...base.turn, ...overrides.turn },
    game: { ...base.game, ...overrides.game },
  };
}

/**
 * A started game with a known seed. Tests assert against colours they look up
 * at runtime rather than hardcoding board positions, so changing the shuffle
 * never breaks the suite.
 */
export function startedGame(overrides: Partial<Ruleset> = {}, seed = 'test-seed'): GameState {
  const lobby = createLobby({
    id: 'game-1',
    seed,
    ruleset: ruleset(overrides),
    players: fourPlayers(),
    at: 0,
  });
  const result = startGame(lobby, seed, 0);
  if (!result.ok) throw new Error(`startGame failed: ${result.error.message}`);
  return result.value;
}

/** Index of the first unrevealed card with the given colour. */
export function findCard(state: GameState, color: CardColor): number {
  const index = state.cards.findIndex((c) => c.color === color && !c.revealed);
  if (index === -1) throw new Error(`No unrevealed ${color} card left`);
  return index;
}

export function indicesOf(state: GameState, color: CardColor): number[] {
  return state.cards.flatMap((c, i) => (c.color === color && !c.revealed ? [i] : []));
}
