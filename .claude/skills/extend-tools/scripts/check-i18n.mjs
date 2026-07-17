// Verify every locale dictionary shares an IDENTICAL structure (keys + array lengths), and that no
// value contains an HTML entity (e.g. `&amp;`, which would render literally).
//
// WHY IT MATTERS: `Dictionary` is the UNION of all locale JSON shapes, so `keyof Dictionary['tools']`
// is the keys COMMON to every locale. Any structural drift silently shrinks that union and breaks the
// registry's slug types + the tool page. Run this after adding a tool block or a locale.
//
// Usage: node .claude/skills/extend-tools/scripts/check-i18n.mjs [dictionaries-dir]
//   (default dir: src/i18n/dictionaries, relative to cwd = repo root)
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.argv[2] || 'src/i18n/dictionaries';
const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
if (files.length < 2) { console.log(`Only ${files.length} dictionary in ${DIR}; nothing to compare.`); process.exit(0); }

// Canonical structure descriptor: object → {sorted keys: struct}; array → ['[]', len, elemStruct]; leaf → typeof.
function struct(v) {
  if (Array.isArray(v)) return ['[]', v.length, v.length ? struct(v[0]) : null];
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = struct(v[k]);
    return o;
  }
  return typeof v;
}
function scanEntities(v, path, hits) {
  if (typeof v === 'string') { if (/&(amp|lt|gt|quot|#\d+);/.test(v)) hits.push(`${path}: ${v}`); }
  else if (Array.isArray(v)) v.forEach((x, i) => scanEntities(x, `${path}[${i}]`, hits));
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) scanEntities(v[k], `${path}.${k}`, hits);
}

const parsed = {};
for (const f of files) {
  try { parsed[f] = JSON.parse(readFileSync(join(DIR, f), 'utf8')); }
  catch (e) { console.log(`✘ ${f} INVALID JSON: ${e.message}`); process.exit(1); }
}

const ref = files[0];
const refSig = JSON.stringify(struct(parsed[ref]));
let ok = true;
for (const f of files) {
  const match = JSON.stringify(struct(parsed[f])) === refSig;
  console.log(`${match ? '✅' : '✘'} ${f} structure ${match ? `matches ${ref}` : `DIFFERS from ${ref}`}`);
  if (!match) ok = false;
  const hits = [];
  scanEntities(parsed[f], f, hits);
  if (hits.length) { ok = false; console.log(`✘ ${f} HTML entities:\n   ${hits.join('\n   ')}`); }
}
console.log(ok ? '\nALL GOOD' : '\nPROBLEMS FOUND');
process.exit(ok ? 0 : 1);
