import type { Card, CardColor, Ruleset, Team } from './types.ts';
import { shuffle } from './rng.ts';

/**
 * Agent counts per board size. The starting team always gets one extra card,
 * which is what compensates them for not having seen a clue yet.
 */
const AGENT_COUNTS: Record<number, { first: number; second: number }> = {
  20: { first: 8, second: 7 },
  25: { first: 9, second: 8 },
  36: { first: 13, second: 12 },
};

export type KeyCardSpec = {
  first: number;
  second: number;
  assassins: number;
  bystanders: number;
};

export function keyCardSpec(boardSize: number, assassinCount: number): KeyCardSpec {
  const base = AGENT_COUNTS[boardSize] ?? AGENT_COUNTS[25]!;
  const assassins = Math.max(0, Math.min(assassinCount, boardSize - base.first - base.second));
  return {
    first: base.first,
    second: base.second,
    assassins,
    bystanders: boardSize - base.first - base.second - assassins,
  };
}

/**
 * Build the shuffled board. `words` must already be a deduplicated candidate
 * pool; we take boardSize of them at random and assign colours by shuffling the
 * colour multiset, so word choice and colour assignment are independent.
 */
export function buildCards(
  words: readonly string[],
  startingTeam: Team,
  ruleset: Ruleset,
  rng: () => number,
): Card[] {
  const { boardSize, assassinCount } = ruleset.game;
  const spec = keyCardSpec(boardSize, assassinCount);
  const other: Team = startingTeam === 'red' ? 'blue' : 'red';

  const colors: CardColor[] = [
    ...Array<CardColor>(spec.first).fill(startingTeam),
    ...Array<CardColor>(spec.second).fill(other),
    ...Array<CardColor>(spec.assassins).fill('assassin'),
    ...Array<CardColor>(spec.bystanders).fill('bystander'),
  ];

  const chosenWords = shuffle(words, rng).slice(0, boardSize);
  const shuffledColors = shuffle(colors, rng);

  return chosenWords.map((word, i) => ({
    word,
    color: shuffledColors[i]!,
    revealed: false,
    revealedBy: null,
  }));
}

/** Cards of `team` still face down. Reaching zero wins the game. */
export function remainingFor(cards: readonly Card[], team: Team): number {
  let n = 0;
  for (const card of cards) {
    if (card.color === team && !card.revealed) n++;
  }
  return n;
}
