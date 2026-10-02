import { describe, expect, it } from 'vitest';
import { createDictionary, unavailableDictionary } from '@codenames/words';
import { INFINITY_COUNT, validateClue, type ClueContext } from './clue.ts';
import { ruleset } from '../testing.ts';
import type { Ruleset } from '../types.ts';

const BOARD = ['OCEAN', 'SPY', 'TOKYO', 'ICE CREAM', 'RUNNING'];

const dictionary = createDictionary(
  ['water', 'blue', 'swim', 'oceanic', 'run', 'spies', 'cream', 'sea'],
  ['tokyo', 'paris', 'everest'],
);

function ctx(overrides: Partial<Ruleset> = {}, dict = dictionary): ClueContext {
  return { ruleset: ruleset(overrides), boardWords: BOARD, dictionary: dict };
}

const expectCode = (result: ReturnType<typeof validateClue>, code: string) => {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe(code);
};

describe('clue shape', () => {
  it('accepts a plain legal clue and normalises it to upper case', () => {
    const result = validateClue('water', 2, ctx());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ word: 'WATER', count: 2 });
  });

  it('rejects an empty clue', () => {
    expectCode(validateClue('   ', 1, ctx()), 'clue-empty');
  });

  it('rejects multi-word clues when singleWordOnly is on', () => {
    expectCode(validateClue('deep water', 2, ctx()), 'clue-not-single-word');
    expectCode(validateClue('deep-water', 2, ctx()), 'clue-not-single-word');
  });

  it('allows multi-word clues when singleWordOnly is off', () => {
    const relaxed = ctx({ clue: { ...ruleset().clue, singleWordOnly: false } });
    expect(validateClue('deep water', 2, relaxed).ok).toBe(true);
  });

  it('rejects digits and punctuation', () => {
    expectCode(validateClue('h2o', 2, ctx()), 'clue-not-a-word');
    expectCode(validateClue('water!', 2, ctx()), 'clue-not-a-word');
  });
});

describe('clue count', () => {
  it('rejects non-integers and counts below infinity', () => {
    expectCode(validateClue('water', 1.5, ctx()), 'clue-count-invalid');
    expectCode(validateClue('water', -2, ctx()), 'clue-count-invalid');
  });

  it('allows 0 and infinity by default', () => {
    expect(validateClue('water', 0, ctx()).ok).toBe(true);
    expect(validateClue('water', INFINITY_COUNT, ctx()).ok).toBe(true);
  });

  it('rejects 0 and infinity when the room turns them off', () => {
    const strict = ctx({ clue: { ...ruleset().clue, allowZeroAndInfinity: false } });
    expectCode(validateClue('water', 0, strict), 'clue-count-invalid');
    expectCode(validateClue('water', INFINITY_COUNT, strict), 'clue-count-invalid');
  });

  it('enforces maxClueNumber', () => {
    const capped = ctx({ clue: { ...ruleset().clue, maxClueNumber: 3 } });
    expect(validateClue('water', 3, capped).ok).toBe(true);
    expectCode(validateClue('water', 4, capped), 'clue-count-too-high');
  });
});

describe('relationship to the board', () => {
  it('rejects a clue that is a board word, in any casing', () => {
    expectCode(validateClue('ocean', 2, ctx()), 'clue-is-board-word');
    expectCode(validateClue('OcEaN', 2, ctx()), 'clue-is-board-word');
  });

  it('allows board words when the rule is off', () => {
    const relaxed = ctx({ clue: { ...ruleset().clue, forbidBoardWords: false } });
    expect(validateClue('ocean', 2, relaxed).ok).toBe(true);
  });

  it('catches shared roots when the rule is on', () => {
    const strict = ctx({ clue: { ...ruleset().clue, forbidSharedRoots: true } });
    expectCode(validateClue('oceanic', 2, strict), 'clue-shares-root');
    expectCode(validateClue('spies', 2, strict), 'clue-shares-root');
    expectCode(validateClue('run', 2, strict), 'clue-shares-root');
  });

  it('allows an unrelated word under the shared-root rule', () => {
    const strict = ctx({ clue: { ...ruleset().clue, forbidSharedRoots: true } });
    expect(validateClue('water', 2, strict).ok).toBe(true);
  });

  it('checks every part of a multi-word board entry', () => {
    const strict = ctx({
      clue: { ...ruleset().clue, singleWordOnly: false, forbidSharedRoots: true },
    });
    // "cream" is half of the "ICE CREAM" card.
    expectCode(validateClue('cream', 2, strict), 'clue-shares-root');
  });
});

describe('dictionary rules', () => {
  const strictDict = (over: Partial<Ruleset['clue']> = {}) =>
    ctx({ clue: { ...ruleset().clue, mustBeDictionaryWord: true, ...over } });

  it('accepts a dictionary word', () => {
    expect(validateClue('swim', 2, strictDict()).ok).toBe(true);
  });

  it('rejects a non-word', () => {
    expectCode(validateClue('flibbertigib', 2, strictDict()), 'clue-not-a-word');
  });

  it('accepts a proper noun when proper nouns are allowed', () => {
    expect(validateClue('paris', 2, strictDict()).ok).toBe(true);
  });

  it('rejects a proper noun when they are not allowed', () => {
    expectCode(
      validateClue('paris', 2, strictDict({ allowProperNouns: false })),
      'clue-not-a-word',
    );
  });

  it('enforces the proper-noun ban even without the dictionary rule', () => {
    const noProper = ctx({ clue: { ...ruleset().clue, allowProperNouns: false } });
    expectCode(validateClue('everest', 2, noProper), 'clue-not-a-word');
    // A word that is both common and a name stays legal.
    expect(validateClue('water', 2, noProper).ok).toBe(true);
  });

  it('degrades to allow when no dictionary is generated', () => {
    const noDict = ctx(
      { clue: { ...ruleset().clue, mustBeDictionaryWord: true, allowProperNouns: false } },
      unavailableDictionary(),
    );
    expect(validateClue('flibbertigib', 2, noDict).ok).toBe(true);
  });
});
