import { describe, expect, it } from 'vitest';
import { rootKey, rootKeys, stem, stemParts } from './stemmer.ts';

describe('porter stemmer', () => {
  it('collapses inflections onto a shared stem', () => {
    const groups = [
      ['connect', 'connected', 'connecting', 'connection', 'connections'],
      ['run', 'running', 'runs'],
      ['relate', 'related', 'relation', 'relational'],
      ['happy', 'happiness'],
    ];
    for (const group of groups) {
      const stems = new Set(group.map(stem));
      expect(stems.size, `${group.join(', ')} -> ${[...stems].join(', ')}`).toBe(1);
    }
  });

  it('keeps unrelated words apart', () => {
    expect(stem('ocean')).not.toBe(stem('office'));
    expect(stem('cat')).not.toBe(stem('dog'));
    expect(stem('bear')).not.toBe(stem('beard'));
  });

  it('links the cases the shared-root rule exists to catch', () => {
    expect(stem('ocean')).toBe(stem('oceanic'));
    expect(stem('agent')).toBe(stem('agents'));
  });

  it('does not reduce agent nouns — a known Porter limitation we accept', () => {
    // m("fight") is 1, so step 4 leaves the -er on. The shared-root rule will
    // miss FIGHT/FIGHTER; that is a false negative, which is the safe direction
    // for a rule that blocks a player's clue.
    expect(stem('fighter')).not.toBe(stem('fight'));
  });

  it('leaves short words alone', () => {
    expect(stem('ox')).toBe('ox');
    expect(stem('a')).toBe('a');
  });

  it('strips non-letters and lowercases', () => {
    expect(stem('WATER!')).toBe(stem('water'));
  });

  it('splits multi-word entries', () => {
    expect(stemParts('ICE CREAM')).toEqual([stem('ice'), stem('cream')]);
    expect(stemParts('loch-ness')).toHaveLength(2);
  });
});

describe('rootKey', () => {
  it('folds terminal y onto i so spy and spies match', () => {
    expect(rootKey('spy')).toBe(rootKey('spies'));
    expect(rootKey('spy')).toBe(rootKey('spying'));
  });

  it('keeps unrelated words apart', () => {
    expect(rootKey('ocean')).not.toBe(rootKey('spy'));
    expect(rootKey('city')).not.toBe(rootKey('cat'));
  });

  it('maps over every part of a phrase', () => {
    expect(rootKeys('ICE CREAM')).toEqual([rootKey('ice'), rootKey('cream')]);
  });
});
