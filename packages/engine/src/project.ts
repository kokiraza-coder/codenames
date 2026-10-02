import { remainingFor } from './board.ts';
import { guessAllowance } from './reduce.ts';
import type {
  CardColor,
  Clue,
  EndReason,
  GameState,
  LogEntry,
  Phase,
  Player,
  Ruleset,
  Team,
} from './types.ts';

/**
 * A card as a specific viewer is allowed to see it.
 *
 * `color` is absent — not null, not masked — for any card the viewer may not
 * see. Omitting the key entirely is the point: there is no field for a curious
 * client to inspect in devtools, and no way for a UI bug to render it.
 */
export type ClientCard = {
  word: string;
  revealed: boolean;
  revealedBy: string | null;
  color?: CardColor;
};

export type ClientGameState = {
  id: string;
  phase: Phase;
  ruleset: Ruleset;
  players: Player[];
  cards: ClientCard[];
  turn: Team | null;
  currentClue: Clue | null;
  guessesMade: number;
  /** Infinity is serialised as null — JSON has no Infinity. */
  guessesAllowed: number | null;
  startingTeam: Team;
  remaining: { red: number; blue: number };
  winner: Team | null;
  endReason: EndReason | null;
  log: LogEntry[];
  version: number;
  turnDeadline: number | null;
  /** Echoed back so the client knows which seat it occupies. */
  you: { id: string; canSeeKey: boolean } | null;
};

/**
 * True when this viewer is entitled to the key card: spymasters during play,
 * and everyone once the game is over.
 */
export function canSeeKey(state: GameState, viewerId: string | null): boolean {
  if (state.phase === 'finished') return true;
  if (state.phase === 'lobby') return false;
  if (viewerId === null) return false;
  const player = state.players.find((p) => p.id === viewerId);
  return player?.role === 'spymaster' && player.team !== null;
}

/**
 * THE serialisation boundary. Every payload leaving the server for a client
 * goes through this function — there is no other path that touches `cards`.
 *
 * Spectators and operatives get `{ word, revealed }` with no colour at all for
 * face-down cards, so the key card is never transmitted to someone who should
 * not have it. See project.test.ts, which asserts this over raw JSON.
 */
export function projectStateFor(state: GameState, viewerId: string | null): ClientGameState {
  const revealKey = canSeeKey(state, viewerId);

  const cards: ClientCard[] = state.cards.map((card) => {
    const base: ClientCard = {
      word: card.word,
      revealed: card.revealed,
      revealedBy: card.revealedBy,
    };
    // A revealed card's colour is public by definition; an unrevealed one is
    // only included for viewers holding the key.
    if (card.revealed || revealKey) base.color = card.color;
    return base;
  });

  const allowance = guessAllowance(state);

  return {
    id: state.id,
    phase: state.phase,
    ruleset: state.ruleset,
    players: state.players.map((p) => ({ ...p })),
    cards,
    turn: state.turn,
    currentClue: state.currentClue ? { ...state.currentClue } : null,
    guessesMade: state.guessesMade,
    guessesAllowed: Number.isFinite(allowance) ? allowance : null,
    startingTeam: state.startingTeam,
    remaining: {
      red: remainingFor(state.cards, 'red'),
      blue: remainingFor(state.cards, 'blue'),
    },
    winner: state.winner,
    endReason: state.endReason,
    log: state.log.slice(),
    version: state.version,
    turnDeadline: state.turnDeadline,
    you: viewerId === null ? null : { id: viewerId, canSeeKey: revealKey },
  };
}
