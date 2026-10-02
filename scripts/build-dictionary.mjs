#!/usr/bin/env node
/**
 * Generate packages/words/data/dictionary.txt from a public-domain word list.
 *
 * Default source is the system dictionary, which on macOS is Webster's Second
 * International (1934) — public domain. Override with:
 *   node scripts/build-dictionary.mjs /path/to/wordlist
 *
 * The output is deliberately gitignored: regenerate it rather than committing a
 * multi-megabyte list whose provenance is hard to audit later.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '../packages/words/data/dictionary.txt');
const properPath = resolve(here, '../packages/words/data/propernouns.txt');

const CANDIDATES = [
  process.argv[2],
  '/usr/share/dict/words',
  '/usr/dict/words',
].filter(Boolean);

const source = CANDIDATES.find((p) => existsSync(p));
if (!source) {
  console.error(
    'No word list found. Pass one explicitly:\n' +
      '  node scripts/build-dictionary.mjs /path/to/wordlist\n\n' +
      'Without it the `mustBeDictionaryWord` rule stays disabled, which is a ' +
      'safe default — the game still runs.',
  );
  process.exit(1);
}

const raw = await readFile(source, 'utf8');

// Source lists capitalise proper nouns, which is the only reliable signal we
// have for the `allowProperNouns` rule — so split on original casing rather
// than lowercasing everything up front.
const common = new Set();
const proper = new Set();

for (const line of raw.split('\n')) {
  const word = line.trim();
  if (word.length < 2) continue;
  if (/^[a-z]+$/.test(word)) common.add(word);
  else if (/^[A-Z][a-z]+$/.test(word)) proper.add(word.toLowerCase());
}

// A word that appears both ways (e.g. "march"/"March") is a common word.
for (const word of common) proper.delete(word);

const write = async (path, set) => {
  const sorted = [...set].sort();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${sorted.join('\n')}\n`, 'utf8');
  return sorted.length;
};

const nCommon = await write(outPath, common);
const nProper = await write(properPath, proper);

console.log(`Source: ${source}`);
console.log(`  ${nCommon.toLocaleString()} common words -> ${outPath}`);
console.log(`  ${nProper.toLocaleString()} proper nouns -> ${properPath}`);
