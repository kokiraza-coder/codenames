import type { Dictionary } from '@codenames/words';
import { remainingFor } from './board.ts';
import { INFINITY_COUNT, validateClue } from './rules/clue.ts';
import {
  err,
  ok,
  type Action,
  type EndReason,
  type GameState,
  type LogEntry,
  type Player,
  type Result,
  type Team,
} from './types.ts';

export type ReduceContext = {
  dictionary?: Dictionary | undefined;
};

const otherTeam = (team: Team): Team => (team === 'red' ? 'blue' : 'red');

function findPlayer(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id);
}

/**
 * How many guesses this clue allows in total.
 * `standard` is the classic N+1; `exact` holds players to the number they were
 * given; `unlimited` is for groups who prefer to decide when to stop.
 * A 0 or ∞ clue always means unlimited guesses.
 */
function guessAllowance(state: GameState): number {
  const clue = state.currentClue;
  if (!clue) return 0;
  if (clue.count === INFINITY_COUNT || clue.count === 0) return Number.POSITIVE_INFINITY;
  switch (state.ruleset.turn.guessLimitMode) {
    case 'unlimited':
      return Number.POSITIVE_INFINITY;
    case 'exact':
      return clue.count;
    case 'standard':
    default:
      return clue.count + 1;
  }
}

function endTurn(state: GameState, at: number): void {
  state.turn = state.turn ? otherTeam(state.turn) : null;
  state.currentClue = null;
  state.guessesMade = 0;
  state.turnDeadline = deadlineFor(state, at);
}

/**
 * The deadline covers the spymaster's thinking time until a clue exists, then
 * the operatives' guessing time. Null when the room has no timer configured.
 */
function deadlineFor(state: GameState, at: number): number | null {
  const { turnTimerSec, spymasterTimerSec } = state.ruleset.turn;
  const seconds = state.currentClue ? turnTimerSec : spymasterTimerSec;
  return seconds === null || seconds === undefined ? null : at + seconds * 1000;
}

function finish(state: GameState, winner: Team, reason: EndReason, at: number): void {
  state.phase = 'finished';
  state.winner = winner;
  state.endReason = reason;
  state.endedAt = at;
  state.turn = null;
  state.currentClue = null;
  state.turnDeadline = null;
  state.log.push({ type: 'game-ended', at, winner, reason });
}

/** Win check after any reveal. Returns true when the game ended. */
function checkVictory(state: GameState, at: number): boolean {
  for (const team of ['red', 'blue'] as const) {
    if (remainingFor(state.cards, team) === 0) {
      finish(state, team, 'all-words-found', at);
      return true;
    }
  }
  return false;
}

/**
 * Apply an action to a game state. Mutates a *copy* supplied by the caller —
 * `applyAction` below handles cloning, so this stays cheap and readable.
 *
 * Every branch returns either the new state or a RuleViolation; there is no
 * silent no-op, because a silent no-op on the server looks like a dropped
 * packet on the client.
 */
function mutate(state: GameState, action: Action, ctx: ReduceContext): Result<GameState> {
  if (state.phase !== 'playing') {
    return err('not-playing', 'The game is not in progress.');
  }

  switch (action.type) {
    case 'give-clue': {
      const player = findPlayer(state, action.playerId);
      if (!player || player.team === null) return err('no-team', 'Join a team first.');
      if (player.role !== 'spymaster') {
        return err('not-spymaster', 'Only the spymaster can give a clue.');
      }
      if (player.team !== state.turn) {
        return err('not-your-turn', "It is not your team's turn.");
      }
      if (state.currentClue) {
        return err('clue-already-given', 'Your team is still guessing.');
      }

      const validated = validateClue(action.word, action.count, {
        ruleset: state.ruleset,
        boardWords: state.cards.map((c) => c.word),
        dictionary: ctx.dictionary,
      });
      if (!validated.ok) return validated;

      state.currentClue = {
        word: validated.value.word,
        count: validated.value.count,
        team: player.team,
        by: player.id,
        at: action.at,
      };
      state.guessesMade = 0;
      state.turnDeadline = deadlineFor(state, action.at);
      state.log.push({
        type: 'clue',
        at: action.at,
        team: player.team,
        by: player.id,
        word: validated.value.word,
        count: validated.value.count,
      });
      return ok(state);
    }

    case 'guess': {
      const player = findPlayer(state, action.playerId);
      if (!player || player.team === null) return err('no-team', 'Join a team first.');
      if (player.role !== 'operative') {
        return err('not-operative', 'Spymasters cannot guess.');
      }
      if (player.team !== state.turn) {
        return err('not-your-turn', "It is not your team's turn.");
      }
      if (!state.currentClue) {
        return err('no-clue-yet', 'Wait for your spymaster to give a clue.');
      }
      if (state.guessesMade >= guessAllowance(state)) {
        return err('no-guesses-left', 'No guesses left for this clue.');
      }

      const card = state.cards[action.cardIndex];
      if (!card) return err('card-out-of-range', 'That card does not exist.');
      if (card.revealed) return err('card-already-revealed', 'That card is already revealed.');

      card.revealed = true;
      card.revealedBy = player.id;
      state.guessesMade += 1;

      const correct = card.color === player.team;
      state.log.push({
        type: 'guess',
        at: action.at,
        team: player.team,
        by: player.id,
        word: card.word,
        color: card.color,
        correct,
      });

      if (card.color === 'assassin') {
        finish(state, otherTeam(player.team), 'assassin', action.at);
        return ok(state);
      }

      // A reveal can finish either team's set — including handing the win to
      // the opponent by flipping their last card.
      if (checkVictory(state, action.at)) return ok(state);

      if (!correct || state.guessesMade >= guessAllowance(state)) {
        endTurn(state, action.at);
      }
      return ok(state);
    }

    case 'pass': {
      const player = findPlayer(state, action.playerId);
      if (!player || player.team === null) return err('no-team', 'Join a team first.');
      if (player.team !== state.turn) {
        return err('not-your-turn', "It is not your team's turn.");
      }
      if (player.role !== 'operative') {
        return err('not-operative', 'Only operatives can end the turn.');
      }
      if (!state.currentClue) {
        return err('no-clue-yet', 'There is no clue to pass on yet.');
      }

      state.log.push({ type: 'pass', at: action.at, team: player.team, by: player.id });
      endTurn(state, action.at);
      return ok(state);
    }

    case 'timeout': {
      if (state.turn === null) return err('not-playing', 'No turn is active.');
      state.log.push({ type: 'timeout', at: action.at, team: state.turn });
      endTurn(state, action.at);
      return ok(state);
    }

    default: {
      const exhaustive: never = action;
      return err('not-playing', `Unknown action: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Structured-clone the state so callers never observe a partially applied action. */
function cloneState(state: GameState): GameState {
  return {
    ...state,
    ruleset: structuredClone(state.ruleset),
    players: state.players.map((p) => ({ ...p })),
    cards: state.cards.map((c) => ({ ...c })),
    currentClue: state.currentClue ? { ...state.currentClue } : null,
    log: state.log.slice(),
  };
}

export type ApplyResult = {
  state: GameState;
  /** Entries appended by this action — enough to drive the client's log. */
  newLog: LogEntry[];
};

export function applyAction(
  state: GameState,
  action: Action,
  ctx: ReduceContext = {},
): Result<ApplyResult> {
  const draft = cloneState(state);
  const logLengthBefore = draft.log.length;

  const result = mutate(draft, action, ctx);
  if (!result.ok) return result;

  draft.version += 1;
  return ok({ state: draft, newLog: draft.log.slice(logLengthBefore) });
}

export { guessAllowance, otherTeam };
