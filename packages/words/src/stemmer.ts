/**
 * Porter stemmer (Porter, 1980), vendored so the engine stays dependency-free.
 *
 * Used only for the `forbidSharedRoots` house rule: we stem the clue and every
 * board word and reject on collision, which catches OCEAN -> OCEANIC and
 * SPY -> SPIES without needing a morphology database.
 */

function isConsonant(word: string, i: number): boolean {
  const ch = word[i];
  if (ch === undefined) return false;
  if ('aeiou'.includes(ch)) return false;
  // 'y' is a consonant only at the start or after a vowel.
  if (ch === 'y') return i === 0 || !isConsonant(word, i - 1);
  return true;
}

/** The "measure" m: the number of VC sequences between the initial C and final V. */
function measure(stem: string): number {
  let n = 0;
  let i = 0;
  const len = stem.length;

  // Skip a leading run of consonants.
  while (i < len && isConsonant(stem, i)) i++;

  while (i < len) {
    // Consume vowels.
    while (i < len && !isConsonant(stem, i)) i++;
    if (i >= len) break;
    n++;
    // Consume consonants.
    while (i < len && isConsonant(stem, i)) i++;
  }
  return n;
}

function containsVowel(stem: string): boolean {
  for (let i = 0; i < stem.length; i++) {
    if (!isConsonant(stem, i)) return true;
  }
  return false;
}

/** True when the stem ends in a doubled consonant. */
function endsWithDoubleConsonant(stem: string): boolean {
  const len = stem.length;
  if (len < 2) return false;
  if (stem[len - 1] !== stem[len - 2]) return false;
  return isConsonant(stem, len - 1);
}

/** True for stems ending consonant-vowel-consonant where the last is not w, x or y. */
function endsCvc(stem: string): boolean {
  const len = stem.length;
  if (len < 3) return false;
  if (!isConsonant(stem, len - 1) || isConsonant(stem, len - 2) || !isConsonant(stem, len - 3)) {
    return false;
  }
  const last = stem[len - 1]!;
  return last !== 'w' && last !== 'x' && last !== 'y';
}

const STEP2 : ReadonlyArray<readonly [string, string]> = [
  ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
  ['izer', 'ize'], ['bli', 'ble'], ['alli', 'al'], ['entli', 'ent'],
  ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'],
  ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'], ['fulness', 'ful'],
  ['ousness', 'ous'], ['aliti', 'al'], ['iviti', 'ive'], ['biliti', 'ble'],
  ['logi', 'log'],
];

const STEP3: ReadonlyArray<readonly [string, string]> = [
  ['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'],
  ['ical', 'ic'], ['ful', ''], ['ness', ''],
];

const STEP4 = [
  'al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement', 'ment',
  'ent', 'ion', 'ou', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize',
] as const;

export function stem(input: string): string {
  let word = input.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 2) return word;

  // --- Step 1a: plurals ---------------------------------------------------
  if (word.endsWith('sses')) word = word.slice(0, -2);
  else if (word.endsWith('ies')) word = word.slice(0, -2);
  else if (word.endsWith('ss')) { /* keep */ }
  else if (word.endsWith('s')) word = word.slice(0, -1);

  // --- Step 1b: past tense and gerunds ------------------------------------
  let step1bApplied = false;
  if (word.endsWith('eed')) {
    if (measure(word.slice(0, -3)) > 0) word = word.slice(0, -1);
  } else if (word.endsWith('ed') && containsVowel(word.slice(0, -2))) {
    word = word.slice(0, -2);
    step1bApplied = true;
  } else if (word.endsWith('ing') && containsVowel(word.slice(0, -3))) {
    word = word.slice(0, -3);
    step1bApplied = true;
  }

  if (step1bApplied) {
    if (word.endsWith('at') || word.endsWith('bl') || word.endsWith('iz')) {
      word += 'e';
    } else if (endsWithDoubleConsonant(word) && !/[lsz]$/.test(word)) {
      word = word.slice(0, -1);
    } else if (measure(word) === 1 && endsCvc(word)) {
      word += 'e';
    }
  }

  // --- Step 1c: terminal y ------------------------------------------------
  if (word.endsWith('y') && containsVowel(word.slice(0, -1))) {
    word = `${word.slice(0, -1)}i`;
  }

  // --- Step 2 -------------------------------------------------------------
  for (const [suffix, replacement] of STEP2) {
    if (word.endsWith(suffix)) {
      const base = word.slice(0, -suffix.length);
      if (measure(base) > 0) word = base + replacement;
      break;
    }
  }

  // --- Step 3 -------------------------------------------------------------
  for (const [suffix, replacement] of STEP3) {
    if (word.endsWith(suffix)) {
      const base = word.slice(0, -suffix.length);
      if (measure(base) > 0) word = base + replacement;
      break;
    }
  }

  // --- Step 4 -------------------------------------------------------------
  for (const suffix of STEP4) {
    if (!word.endsWith(suffix)) continue;
    const base = word.slice(0, -suffix.length);
    if (measure(base) > 1) {
      // 'ion' only drops after s or t.
      if (suffix === 'ion' && !/[st]$/.test(base)) break;
      word = base;
    }
    break;
  }

  // --- Step 5a: terminal e ------------------------------------------------
  if (word.endsWith('e')) {
    const base = word.slice(0, -1);
    const m = measure(base);
    if (m > 1 || (m === 1 && !endsCvc(base))) word = base;
  }

  // --- Step 5b: terminal double l -----------------------------------------
  if (word.endsWith('ll') && measure(word) > 1) word = word.slice(0, -1);

  return word;
}

/** Stem every space/hyphen separated part, e.g. "ICE CREAM" -> ["ice", "cream"]. */
export function stemParts(input: string): string[] {
  return input
    .split(/[\s-]+/)
    .map((part) => stem(part))
    .filter((part) => part.length > 0);
}

/**
 * A stem normalised for *comparison*, which is all the shared-root rule needs.
 *
 * Porter leaves "spy" alone (step 1c only converts a terminal y when the stem
 * contains a vowel, and "sp" does not) while reducing "spies" to "spi". That
 * asymmetry is correct Porter but useless to us, so we fold a terminal y onto
 * i before comparing. Never use this for display — it is not a word.
 */
export function rootKey(input: string): string {
  return stem(input).replace(/y$/, 'i');
}

export function rootKeys(input: string): string[] {
  return stemParts(input).map((part) => part.replace(/y$/, 'i'));
}
