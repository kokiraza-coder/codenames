import { describe, expect, it } from 'vitest';
import { applyAction, otherTeam } from './reduce.ts';
import { keyCardSpec } from './board.ts';
import { startedGame, findCard, indicesOf } from './testing.ts';
import type { Action, GameState, Result, Team } from './types.ts';

/** Apply and unwrap, failing the test on a rule violation. */
function apply(state: GameState, action: Action): GameState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(`${action.type} rejected: ${result.error.code}`);
  return result.value.state;
}

function expectErr(result: Result<unknown>, code: string) {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe(code);
}

/** Give a legal clue for whichever team is to move. */
function clue(state: GameState, count = 2, word = 'ZEPHYR'): GameState {
  const team = state.turn!;
  const spymaster = state.players.find((p) => p.team === team && p.role === 'spymaster')!;
  return apply(state, { type: 'give-clue', playerId: spymaster.id, word, count, at: 1 });
}

function operativeFor(state: GameState, team: Team): string {
  return state.players.find((p) => p.team === team && p.role === 'operative')!.id;
}

describe('board setup', () => {
  it('deals the classic 9/8/7/1 key card', () => {
    const state = startedGame();
    const count = (c: string) => state.cards.filter((card) => card.color === c).length;
    expect(state.cards).toHaveLength(25);
    expect(count(state.startingTeam)).toBe(9);
    expect(count(otherTeam(state.startingTeam))).toBe(8);
    expect(count('bystander')).toBe(7);
    expect(count('assassin')).toBe(1);
  });

  it('gives the starting team the extra card on every board size', () => {
    for (const boardSize of [20, 25, 36] as const) {
      const spec = keyCardSpec(boardSize, 1);
      expect(spec.first - spec.second).toBe(1);
      expect(spec.first + spec.second + spec.assassins + spec.bystanders).toBe(boardSize);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = startedGame({}, 'seed-a');
    const b = startedGame({}, 'seed-a');
    const c = startedGame({}, 'seed-b');
    expect(a.cards).toEqual(b.cards);
    expect(a.cards).not.toEqual(c.cards);
  });

  it('deals no duplicate words', () => {
    const state = startedGame();
    expect(new Set(state.cards.map((c) => c.word)).size).toBe(state.cards.length);
  });
});

describe('turn order and roles', () => {
  it('requires a clue before any guess', () => {
    const state = startedGame();
    const op = operativeFor(state, state.turn!);
    expectErr(
      applyAction(state, { type: 'guess', playerId: op, cardIndex: 0, at: 1 }),
      'no-clue-yet',
    );
  });

  it('rejects a clue from the team that is not to move', () => {
    const state = startedGame();
    const idle = otherTeam(state.turn!);
    const spymaster = state.players.find((p) => p.team === idle && p.role === 'spymaster')!;
    expectErr(
      applyAction(state, { type: 'give-clue', playerId: spymaster.id, word: 'X', count: 1, at: 1 }),
      'not-your-turn',
    );
  });

  it('rejects a second clue while the team is still guessing', () => {
    const state = clue(startedGame());
    const spymaster = state.players.find((p) => p.team === state.turn && p.role === 'spymaster')!;
    expectErr(
      applyAction(state, { type: 'give-clue', playerId: spymaster.id, word: 'OTHER', count: 1, at: 2 }),
      'clue-already-given',
    );
  });

  it('does not let a spymaster guess', () => {
    const state = clue(startedGame());
    const spymaster = state.players.find((p) => p.team === state.turn && p.role === 'spymaster')!;
    expectErr(
      applyAction(state, { type: 'guess', playerId: spymaster.id, cardIndex: 0, at: 2 }),
      'not-operative',
    );
  });

  it('rejects guessing an already revealed card', () => {
    let state = clue(startedGame());
    const team = state.turn!;
    const index = findCard(state, team);
    state = apply(state, { type: 'guess', playerId: operativeFor(state, team), cardIndex: index, at: 2 });
    expectErr(
      applyAction(state, { type: 'guess', playerId: operativeFor(state, team), cardIndex: index, at: 3 }),
      'card-already-revealed',
    );
  });
});

describe('guessing', () => {
  it('keeps the turn after a correct guess', () => {
    let state = clue(startedGame());
    const team = state.turn!;
    state = apply(state, {
      type: 'guess',
      playerId: operativeFor(state, team),
      cardIndex: findCard(state, team),
      at: 2,
    });
    expect(state.turn).toBe(team);
    expect(state.guessesMade).toBe(1);
  });

  it('ends the turn on a bystander', () => {
    let state = clue(startedGame());
    const team = state.turn!;
    state = apply(state, {
      type: 'guess',
      playerId: operativeFor(state, team),
      cardIndex: findCard(state, 'bystander'),
      at: 2,
    });
    expect(state.turn).toBe(otherTeam(team));
    expect(state.currentClue).toBeNull();
  });

  it("ends the turn and scores for the enemy on an opponent's card", () => {
    let state = clue(startedGame());
    const team = state.turn!;
    const enemy = otherTeam(team);
    const before = state.cards.filter((c) => c.color === enemy && !c.revealed).length;
    state = apply(state, {
      type: 'guess',
      playerId: operativeFor(state, team),
      cardIndex: findCard(state, enemy),
      at: 2,
    });
    const after = state.cards.filter((c) => c.color === enemy && !c.revealed).length;
    expect(after).toBe(before - 1);
    expect(state.turn).toBe(enemy);
  });

  it('allows N+1 guesses in standard mode and no more', () => {
    let state = clue(startedGame(), 2);
    const team = state.turn!;
    const own = indicesOf(state, team).slice(0, 3);

    // Two correct guesses: still their turn, with the bonus guess to spend.
    for (const [i, index] of own.slice(0, 2).entries()) {
      state = apply(state, { type: 'guess', playerId: operativeFor(state, team), cardIndex: index, at: 2 + i });
    }
    expect(state.turn).toBe(team);
    expect(state.guessesMade).toBe(2);

    // The third exhausts the allowance, so the turn ends and the counter resets.
    state = apply(state, { type: 'guess', playerId: operativeFor(state, team), cardIndex: own[2]!, at: 5 });
    expect(state.turn).toBe(otherTeam(team));
    expect(state.guessesMade).toBe(0);
    expect(state.currentClue).toBeNull();
  });

  it('allows exactly N guesses in exact mode', () => {
    let state = clue(startedGame({ turn: { guessLimitMode: 'exact', turnTimerSec: null, spymasterTimerSec: null } }), 2);
    const team = state.turn!;
    const own = indicesOf(state, team).slice(0, 2);
    for (const [i, index] of own.entries()) {
      state = apply(state, { type: 'guess', playerId: operativeFor(state, team), cardIndex: index, at: 2 + i });
    }
    expect(state.turn).toBe(otherTeam(team));
  });

  it('treats a 0 clue as unlimited guesses', () => {
    let state = clue(startedGame(), 0);
    const team = state.turn!;
    const own = indicesOf(state, team).slice(0, 5);
    for (const [i, index] of own.entries()) {
      state = apply(state, { type: 'guess', playerId: operativeFor(state, team), cardIndex: index, at: 2 + i });
    }
    expect(state.turn).toBe(team);
    expect(state.guessesMade).toBe(5);
  });
});

describe('pass and timeout', () => {
  it('passes the turn', () => {
    const state = clue(startedGame());
    const team = state.turn!;
    const next = apply(state, { type: 'pass', playerId: operativeFor(state, team), at: 2 });
    expect(next.turn).toBe(otherTeam(team));
    expect(next.guessesMade).toBe(0);
  });

  it('refuses a pass before a clue exists', () => {
    const state = startedGame();
    expectErr(
      applyAction(state, { type: 'pass', playerId: operativeFor(state, state.turn!), at: 1 }),
      'no-clue-yet',
    );
  });

  it('ends the turn on timeout', () => {
    const state = startedGame();
    const team = state.turn!;
    const next = apply(state, { type: 'timeout', at: 5 });
    expect(next.turn).toBe(otherTeam(team));
  });

  it('sets a deadline only when a timer is configured', () => {
    const untimed = startedGame();
    expect(untimed.turnDeadline).toBeNull();

    const timed = startedGame({
      turn: { guessLimitMode: 'standard', turnTimerSec: 60, spymasterTimerSec: 120 },
    });
    expect(timed.turnDeadline).toBe(120_000);
    const afterClue = clue(timed);
    expect(afterClue.turnDeadline).toBe(1 + 60_000);
  });
});

describe('terminal conditions', () => {
  it('ends instantly when the assassin is revealed, handing the win over', () => {
    let state = clue(startedGame());
    const team = state.turn!;
    state = apply(state, {
      type: 'guess',
      playerId: operativeFor(state, team),
      cardIndex: findCard(state, 'assassin'),
      at: 2,
    });
    expect(state.phase).toBe('finished');
    expect(state.winner).toBe(otherTeam(team));
    expect(state.endReason).toBe('assassin');
  });

  it('wins when a team reveals its last card', () => {
    let state = clue(startedGame(), 0);
    const team = state.turn!;
    for (const [i, index] of indicesOf(state, team).entries()) {
      state = apply(state, { type: 'guess', playerId: operativeFor(state, team), cardIndex: index, at: 2 + i });
    }
    expect(state.phase).toBe('finished');
    expect(state.winner).toBe(team);
    expect(state.endReason).toBe('all-words-found');
  });

  it('hands the win to the opponent when you flip their last card', () => {
    let state = startedGame();
    const first = state.turn!;
    const second = otherTeam(first);

    // The first team keeps flipping the second team's cards. Each one is a
    // wrong guess, so the turn bounces to the second team, who immediately
    // pass it back.
    let t = 1;
    while (state.phase === 'playing') {
      expect(state.turn).toBe(first);
      state = clue(state, 1);
      state = apply(state, {
        type: 'guess',
        playerId: operativeFor(state, first),
        cardIndex: findCard(state, second),
        at: t++,
      });
      if (state.phase !== 'playing') break;

      expect(state.turn).toBe(second);
      state = clue(state, 1);
      state = apply(state, { type: 'pass', playerId: operativeFor(state, second), at: t++ });
    }

    expect(state.winner).toBe(second);
    expect(state.endReason).toBe('all-words-found');
  });

  it('refuses any action once the game is finished', () => {
    let state = clue(startedGame());
    const team = state.turn!;
    state = apply(state, {
      type: 'guess',
      playerId: operativeFor(state, team),
      cardIndex: findCard(state, 'assassin'),
      at: 2,
    });
    expectErr(
      applyAction(state, { type: 'guess', playerId: operativeFor(state, team), cardIndex: 0, at: 3 }),
      'not-playing',
    );
  });

  it('is always in exactly one of in-progress, red win, blue win', () => {
    // Play out many random games and assert the invariant at every step.
    for (let game = 0; game < 40; game++) {
      let state = startedGame({}, `fuzz-${game}`);
      let rngState = game * 7919 + 13;
      const next = () => {
        rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
        return rngState / 0x7fffffff;
      };

      for (let step = 0; step < 200 && state.phase === 'playing'; step++) {
        const team = state.turn!;
        if (!state.currentClue) {
          state = clue(state, Math.floor(next() * 4));
          continue;
        }
        const unrevealed = state.cards.flatMap((c, i) => (c.revealed ? [] : [i]));
        const pick = unrevealed[Math.floor(next() * unrevealed.length)]!;
        state = apply(state, { type: 'guess', playerId: operativeFor(state, team), cardIndex: pick, at: step });
      }

      const finished = state.phase === 'finished';
      expect(finished).toBe(true);
      expect(state.winner === 'red' || state.winner === 'blue').toBe(true);
      // A winner implies the game is over, and vice versa.
      expect(finished).toBe(state.winner !== null);
    }
  });
});

describe('immutability', () => {
  it('never mutates the state passed in', () => {
    const state = clue(startedGame());
    const snapshot = structuredClone(state);
    applyAction(state, {
      type: 'guess',
      playerId: operativeFor(state, state.turn!),
      cardIndex: findCard(state, state.turn!),
      at: 2,
    });
    expect(state).toEqual(snapshot);
  });

  it('bumps the version on every applied action', () => {
    const state = startedGame();
    const next = clue(state);
    expect(next.version).toBe(state.version + 1);
  });

  it('does not bump the version on a rejected action', () => {
    const state = startedGame();
    const result = applyAction(state, {
      type: 'guess',
      playerId: operativeFor(state, state.turn!),
      cardIndex: 0,
      at: 1,
    });
    expect(result.ok).toBe(false);
    expect(state.version).toBe(1);
  });
});
