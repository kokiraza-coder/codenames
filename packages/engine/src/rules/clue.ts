import { rootKey, rootKeys, type Dictionary } from '@codenames/words';
import { err, ok, type Result, type Ruleset } from '../types.ts';

export const INFINITY_COUNT = -1;

export type ClueContext = {
  ruleset: Ruleset;
  /** Every word on the board, revealed or not — a revealed word is still off-limits. */
  boardWords: readonly string[];
  /** Omit (or pass an unavailable dictionary) to skip the dictionary rule. */
  dictionary?: Dictionary | undefined;
};

export type ValidClue = { word: string; count: number };

const normalize = (raw: string) => raw.trim().replace(/\s+/g, ' ');

/**
 * The single source of truth for clue legality. Runs on the client for instant
 * inline feedback and again on the server, which is the only one that counts.
 *
 * Pure and synchronous by design: validation must never add latency to the one
 * interaction where a spymaster is already thinking hard.
 */
export function validateClue(
  rawWord: string,
  count: number,
  ctx: ClueContext,
): Result<ValidClue> {
  const { clue: rules } = ctx.ruleset;
  const word = normalize(rawWord);

  if (word.length === 0) {
    return err('clue-empty', 'Enter a clue word.');
  }

  // --- count -------------------------------------------------------------
  const isInfinity = count === INFINITY_COUNT;
  if (!Number.isInteger(count)) {
    return err('clue-count-invalid', 'The number must be a whole number.');
  }
  if ((count === 0 || isInfinity) && !rules.allowZeroAndInfinity) {
    return err('clue-count-invalid', 'This room has 0 and ∞ clues turned off.');
  }
  if (count < INFINITY_COUNT) {
    return err('clue-count-invalid', 'That number is not a valid clue count.');
  }
  if (!isInfinity && count > rules.maxClueNumber) {
    return err(
      'clue-count-too-high',
      `The highest number allowed in this room is ${rules.maxClueNumber}.`,
    );
  }

  // --- shape -------------------------------------------------------------
  if (rules.singleWordOnly && /[\s-]/.test(word)) {
    return err('clue-not-single-word', 'One word only — no spaces or hyphens.');
  }
  if (!/^[\p{L}'’\s-]+$/u.test(word)) {
    return err('clue-not-a-word', 'Clues can only contain letters.');
  }

  // --- dictionary and proper nouns ---------------------------------------
  // Both rules need the word list, so they share one pass. With no dictionary
  // generated, both degrade to "allow" rather than rejecting every clue.
  const dict = ctx.dictionary;
  if (dict?.available && (rules.mustBeDictionaryWord || !rules.allowProperNouns)) {
    for (const part of word.split(/[\s-]+/).filter(Boolean)) {
      const isCommon = dict.has(part);
      const isProper = dict.isProperNoun(part);

      if (!rules.allowProperNouns && isProper && !isCommon) {
        return err('clue-not-a-word', `"${part}" is a proper noun.`);
      }
      if (rules.mustBeDictionaryWord && !isCommon && !(rules.allowProperNouns && isProper)) {
        return err('clue-not-a-word', `"${part}" is not in the dictionary.`);
      }
    }
  }

  // --- relationship to the board ----------------------------------------
  const upper = word.toUpperCase();
  if (rules.forbidBoardWords) {
    if (ctx.boardWords.some((bw) => bw.toUpperCase() === upper)) {
      return err('clue-is-board-word', 'That word is on the board.');
    }
  }

  if (rules.forbidSharedRoots) {
    const clueRoots = new Set(rootKeys(word));
    for (const boardWord of ctx.boardWords) {
      for (const boardRoot of rootKeys(boardWord)) {
        if (clueRoots.has(boardRoot)) {
          return err(
            'clue-shares-root',
            `That shares a root with "${boardWord}" on the board.`,
          );
        }
      }
    }
    // Also catch a multi-word clue whose root as a whole matches a board word.
    const whole = rootKey(word);
    if (whole.length > 0 && ctx.boardWords.some((bw) => rootKey(bw) === whole)) {
      return err('clue-shares-root', 'That shares a root with a word on the board.');
    }
  }

  return ok({ word: upper, count });
}
