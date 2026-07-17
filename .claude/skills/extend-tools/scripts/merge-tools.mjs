// Merge new tool blocks into a locale dictionary. The new-blocks file is a JSON object of
// { "<slug>": { ...block... }, ... }. Re-serializes the whole dictionary with 2-space indent.
//
// Usage: node .claude/skills/extend-tools/scripts/merge-tools.mjs <locale> <new-blocks.json>
//   e.g. node .claude/skills/extend-tools/scripts/merge-tools.mjs es /tmp/new-tools-es.json
// (run from repo root; writes src/i18n/dictionaries/<locale>.json)
import { readFileSync, writeFileSync } from 'node:fs';

const [locale, newBlocksPath] = process.argv.slice(2);
if (!locale || !newBlocksPath) {
  console.error('usage: merge-tools.mjs <locale> <new-blocks.json>');
  process.exit(1);
}
const dictPath = `src/i18n/dictionaries/${locale}.json`;
const dict = JSON.parse(readFileSync(dictPath, 'utf8'));
const newBlocks = JSON.parse(readFileSync(newBlocksPath, 'utf8'));

const before = Object.keys(dict.tools).length;
dict.tools = { ...dict.tools, ...newBlocks }; // spread → existing tools kept, new ones appended/overwritten
writeFileSync(dictPath, JSON.stringify(dict, null, 2) + '\n');
console.log(`${locale}: ${before} → ${Object.keys(dict.tools).length} tools (merged ${Object.keys(newBlocks).join(', ')})`);
