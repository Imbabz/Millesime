/**
 * Turns a MusicBrainz sweep into `src/deck/years.json`.
 *
 * Only the agreements are written automatically: where the catalogue and
 * MusicBrainz already say the same thing, two independent sources concur and
 * there is nothing to decide. Everything else is printed for a human, because
 * MusicBrainz is wrong often enough — compilations dated by their reissue, a
 * cover matched to the original — that rewriting on its say-so would trade one
 * set of silent errors for another.
 *
 * Existing manual rulings are never overwritten: a decision made once, with a
 * note explaining it, outranks a fresh guess from a search index.
 *
 *   npm run verify:years          # produces years.report.json
 *   node scripts/apply-years.mjs  # merges the agreements, lists the rest
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const REPORT = process.env.REPORT_PATH ?? 'years.report.json';
const TARGET = 'src/deck/years.json';

if (!existsSync(REPORT)) {
  console.error(`Rapport introuvable : ${REPORT}. Lance d'abord npm run verify:years.`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(REPORT, 'utf8'));
const existing = existsSync(TARGET) ? JSON.parse(readFileSync(TARGET, 'utf8')) : {};

let added = 0;
let kept = 0;

for (const entry of report.agree) {
  if (existing[entry.id]?.source === 'manual') {
    kept += 1;
    continue;
  }
  existing[entry.id] = { year: entry.year, source: 'musicbrainz', ref: entry.mbid };
  added += 1;
}

// Sorted so the file diffs cleanly when it is regenerated.
const sorted = Object.fromEntries(
  Object.entries(existing).sort(([a], [b]) => a.localeCompare(b)),
);
writeFileSync(TARGET, `${JSON.stringify(sorted, null, 2)}\n`);

console.log(`${TARGET} : ${added} années confirmées, ${kept} décisions manuelles conservées.`);

const pending = [
  ...report.disagree.map((d) => ({ ...d, why: `MusicBrainz dit ${d.mbYear}` })),
  ...report.missing.map((m) => ({ ...m, why: 'introuvable sur MusicBrainz' })),
].filter((c) => existing[c.id]?.source !== 'manual');

if (pending.length === 0) {
  console.log('Rien à trancher.');
} else {
  console.log(`\n${pending.length} carte(s) à trancher à la main :\n`);
  for (const c of pending) {
    console.log(`  ${c.artist} — ${c.title}  (catalogue ${c.year} ; ${c.why})`);
  }
}
