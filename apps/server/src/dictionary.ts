import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDictionary, unavailableDictionary, type Dictionary } from '@codenames/words';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../../../packages/words/data');

/**
 * Load the generated word lists once at boot. ~210k words costs roughly 15 MB
 * of heap and makes every lookup O(1), which is what keeps clue validation off
 * the latency budget entirely.
 *
 * Missing files are not fatal: the dictionary-dependent rules simply stay
 * permissive. Run `node scripts/build-dictionary.mjs` to enable them.
 */
export async function loadDictionary(): Promise<Dictionary> {
  try {
    const [common, proper] = await Promise.all([
      readFile(resolve(dataDir, 'dictionary.txt'), 'utf8'),
      readFile(resolve(dataDir, 'propernouns.txt'), 'utf8').catch(() => ''),
    ]);
    return parseDictionary(common, proper);
  } catch {
    return unavailableDictionary();
  }
}
