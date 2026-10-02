import { describe, expect, it } from 'vitest';
import { projectStateFor } from './project.ts';
import { applyAction } from './reduce.ts';
import { startedGame, findCard } from './testing.ts';
import type { GameState } from './types.ts';

function giveClue(state: GameState): GameState {
  const spymaster = state.players.find((p) => p.team === state.turn && p.role === 'spymaster')!;
  const result = applyAction(state, {
    type: 'give-clue',
    playerId: spymaster.id,
    word: 'ZEPHYR',
    count: 2,
    at: 1,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value.state;
}

/**
 * The guarantee this file exists to defend: the key card must never reach a
 * client that is not entitled to it. We assert over the serialised JSON rather
 * than the object graph, because the wire is what actually matters.
 */
describe('key card confidentiality', () => {
  it('omits the colour of every face-down card for an operative', () => {
    const state = giveClue(startedGame());
    const view = projectStateFor(state, 'ro');

    for (const [i, card] of view.cards.entries()) {
      if (card.revealed) continue;
      expect(card).not.toHaveProperty('color');
      expect(card.color).toBeUndefined();
      // And the real colour is genuinely absent, not merely undefined-valued.
      expect(Object.keys(card)).not.toContain('color');
      expect(state.cards[i]!.color).toBeDefined();
    }
  });

  it('leaks nothing about face-down cards through the serialised payload', () => {
    let state = giveClue(startedGame());

    // Reveal one card of each kind so some colours legitimately appear.
    for (const color of ['red', 'blue', 'bystander'] as const) {
      const index = state.cards.findIndex((c) => c.color === color && !c.revealed);
      state.cards[index]!.revealed = true;
    }

    const json = JSON.stringify(projectStateFor(state, 'ro'));
    const parsed = JSON.parse(json) as ReturnType<typeof projectStateFor>;

    // Every colour mentioned in the payload must belong to a revealed card.
    const faceDown = state.cards.filter((c) => !c.revealed);
    expect(faceDown.length).toBeGreaterThan(0);

    for (const [i, card] of parsed.cards.entries()) {
      if (state.cards[i]!.revealed) {
        expect(card.color).toBe(state.cards[i]!.color);
      } else {
        expect(card.color).toBeUndefined();
      }
    }

    // The assassin is face down, so "assassin" must not appear anywhere in the
    // serialised cards. (The full payload legitimately mentions it in
    // `ruleset.game.assassinCount`, so scope the check to the board.)
    expect(state.cards.some((c) => c.color === 'assassin' && !c.revealed)).toBe(true);
    expect(JSON.stringify(parsed.cards)).not.toContain('assassin');
    expect(json).toContain('assassinCount');
  });

  it('gives the full key to a spymaster', () => {
    const state = giveClue(startedGame());
    const view = projectStateFor(state, 'rs');
    expect(view.you?.canSeeKey).toBe(true);
    for (const card of view.cards) expect(card.color).toBeDefined();
  });

  it('hides the key from a spectator with no seat', () => {
    const state = giveClue(startedGame());
    const view = projectStateFor(state, null);
    expect(view.you).toBeNull();
    for (const card of view.cards) {
      if (!card.revealed) expect(card.color).toBeUndefined();
    }
  });

  it('gives the key to both spymasters, not just the one to move', () => {
    // Codenames is open-key between spymasters; they share one card.
    const state = giveClue(startedGame());
    expect(projectStateFor(state, 'bs').cards.every((c) => c.color !== undefined)).toBe(true);
  });

  it('reveals everything to everyone once the game is finished', () => {
    let state = giveClue(startedGame());
    const result = applyAction(state, {
      type: 'guess',
      playerId: 'ro',
      cardIndex: findCard(state, 'assassin'),
      at: 2,
    });
    if (!result.ok) throw new Error(result.error.message);
    state = result.value.state;

    const view = projectStateFor(state, 'ro');
    expect(state.phase).toBe('finished');
    for (const card of view.cards) expect(card.color).toBeDefined();
  });

  it('shows no colours at all in the lobby', () => {
    const state = startedGame();
    const lobby = { ...state, phase: 'lobby' as const, cards: [] };
    expect(projectStateFor(lobby, 'rs').cards).toHaveLength(0);
  });
});

describe('derived view fields', () => {
  it('reports remaining counts for both teams', () => {
    const state = startedGame();
    const view = projectStateFor(state, 'ro');
    expect(view.remaining.red + view.remaining.blue).toBe(17);
  });

  it('serialises an unlimited allowance as null', () => {
    const state = startedGame();
    const spymaster = state.players.find((p) => p.team === state.turn && p.role === 'spymaster')!;
    const result = applyAction(state, {
      type: 'give-clue',
      playerId: spymaster.id,
      word: 'ZEPHYR',
      count: 0,
      at: 1,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(projectStateFor(result.value.state, 'ro').guessesAllowed).toBeNull();
  });

  it('reports N+1 as the standard allowance', () => {
    const state = giveClue(startedGame());
    expect(projectStateFor(state, 'ro').guessesAllowed).toBe(3);
  });
});
