/**
 * Checks every card's year against MusicBrainz.
 *
 * The catalogue's years were entered by hand, and a wrong one is invisible
 * during a game: the card simply cannot be placed correctly, and the table
 * blames the player. So each one gets checked against an outside source.
 *
 * MusicBrainz is the right source because it models *recordings* separately
 * from releases and exposes `first-release-date` — the date of the earliest
 * release carrying that recording. That is exactly the question the game asks,
 * and exactly the question Spotify's `album.release_date` answers wrongly.
 *
 * Picking the right recording is the hard part, and getting it wrong is worse
 * than useless. A search for any famous song returns dozens of recordings that
 * share its title and artist: live takes, re-recordings, radio edits, demos,
 * and compilation entries whose dates mean nothing. An early attempt at this
 * took the *earliest* plausible candidate, on the theory that the original must
 * be the oldest — and disagreed with half the catalogue, because any single
 * stray demo or mis-dated compilation drags the answer backwards.
 *
 * So candidates are now ranked, not minimised: MusicBrainz's own search score
 * decides which recording this is, and only ties are broken by date. Every
 * disagreement is printed with its runners-up, because a verdict you cannot
 * inspect is a verdict you cannot trust.
 *
 * This writes a report and changes nothing. MusicBrainz is wrong often enough
 * that an automatic rewrite would trade one set of errors for another.
 *
 * Rate limit: MusicBrainz asks for one request per second and a descriptive
 * User-Agent, and enforces both. Roughly 25 minutes for the full deck.
 */
import { writeFileSync } from 'node:fs';
import { CATALOGUE } from '../src/deck/catalogue.ts';
import VERIFIED from '../src/deck/years.json' with { type: 'json' };

const ENDPOINT = 'https://musicbrainz.org/ws/2/recording';
const USER_AGENT =
  'Millesime/1.0 ( https://github.com/Imbabz/millesime ) deck-year-verification';
const DELAY_MS = 1100;
const OUT = process.env.REPORT_PATH ?? 'years.report.json';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lucene needs its quotes escaped, and a few titles contain them. */
const escape = (value) => value.replace(/(["\\])/g, '\\$1');

const normalise = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

async function query(card, attempt = 0) {
  const q = `recording:"${escape(card.title)}" AND artist:"${escape(card.artist)}"`;
  const url = `${ENDPOINT}?query=${encodeURIComponent(q)}&limit=25&fmt=json`;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });

  // 503 is how MusicBrainz says "slow down"; back off rather than give up, or
  // a single blip would report hundreds of tracks as missing.
  if (response.status === 503 && attempt < 4) {
    await sleep(2000 * (attempt + 1));
    return query(card, attempt + 1);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

const creditOf = (rec) =>
  (rec['artist-credit'] ?? []).map((a) => a.name ?? '').join(' ');

/** Recordings that are plainly not the studio original on the card. */
const ASIDE = /\b(live|demo|instrumental|karaoke|remix|acoustic|reprise|edit|mix|session|rehearsal|interview|medley)\b/i;

/**
 * Ranks the candidates and returns them best-first.
 *
 * MusicBrainz's own score does the identification; everything here is a
 * tiebreak or a veto. A candidate whose title or artist does not actually match
 * is dropped rather than ranked down, because a confident wrong answer is the
 * failure mode that matters.
 */
function rank(card, recordings = []) {
  const wantTitle = normalise(card.title);
  const wantArtist = normalise(card.artist);

  return recordings
    .filter((rec) => {
      if (!rec['first-release-date']) return false;
      const title = normalise(rec.title ?? '');
      if (!title.includes(wantTitle) && !wantTitle.includes(title)) return false;
      const credit = normalise(creditOf(rec));
      return credit.includes(wantArtist) || wantArtist.includes(credit);
    })
    .map((rec) => {
      const title = rec.title ?? '';
      // A live take or a remix is the same song and the wrong card to play,
      // unless the card itself asked for one.
      const aside = ASIDE.test(title) && !ASIDE.test(card.title);
      const exact = normalise(title) === wantTitle;
      return {
        rec,
        aside,
        // Score first, exact title second, date last: the original is whichever
        // recording MusicBrainz is most confident about, not the oldest thing
        // that happens to share a name.
        key: [aside ? 1 : 0, -(rec.score ?? 0), exact ? 0 : 1, rec['first-release-date']],
      };
    })
    .sort((a, b) => {
      for (let i = 0; i < a.key.length; i++) {
        if (a.key[i] < b.key[i]) return -1;
        if (a.key[i] > b.key[i]) return 1;
      }
      return 0;
    })
    .map(({ rec, aside }) => ({
      mbid: rec.id,
      title: rec.title,
      artist: creditOf(rec),
      date: rec['first-release-date'],
      year: Number(String(rec['first-release-date']).slice(0, 4)),
      score: rec.score ?? 0,
      aside,
    }));
}

const report = {
  checkedAt: new Date().toISOString(),
  agree: [],
  disagree: [],
  missing: [],
  failed: [],
};

/**
 * Which cards to sweep.
 *
 * `ONLY=new` is the one that makes expanding the deck practical: a freshly
 * added card has no entry in years.json yet, so verifying just those turns a
 * forty-five minute sweep of 600 cards into two minutes on the twenty that
 * changed. `ONLY=<id,id,…>` re-checks a specific argument. Unset sweeps
 * everything, which is what a change to the matching logic deserves.
 */
const only = process.env.ONLY?.trim();
const TARGETS =
  !only
    ? CATALOGUE
    : only === 'new'
      ? CATALOGUE.filter((card) => !(card.id in VERIFIED))
      : CATALOGUE.filter((card) => only.split(',').includes(card.id));

console.log(`${TARGETS.length} carte(s) à vérifier sur ${CATALOGUE.length}.`);

for (const [index, card] of TARGETS.entries()) {
  try {
    const data = await query(card);
    const candidates = rank(card, data.recordings);
    const best = candidates[0];

    if (!best) {
      report.missing.push({
        id: card.id,
        artist: card.artist,
        title: card.title,
        year: card.year,
      });
    } else {
      const entry = {
        id: card.id,
        artist: card.artist,
        title: card.title,
        year: card.year,
        mbYear: best.year,
        mbid: best.mbid,
        mbDate: best.date,
      };
      if (best.year === card.year) {
        report.agree.push(entry);
      } else {
        report.disagree.push({
          ...entry,
          delta: best.year - card.year,
          // Keeping the runners-up is what makes a disagreement adjudicable
          // instead of a coin toss.
          candidates: candidates.slice(0, 4),
        });
      }
    }
  } catch (error) {
    report.failed.push({ id: card.id, error: String(error) });
  }

  if ((index + 1) % 50 === 0) {
    console.log(
      `${index + 1}/${TARGETS.length} — ${report.agree.length} ok, ` +
        `${report.disagree.length} écarts, ${report.missing.length} introuvables`,
    );
    // Written as we go: a run that dies at card 500 still leaves a usable file.
    writeFileSync(OUT, JSON.stringify(report, null, 2));
  }
  await sleep(DELAY_MS);
}

report.disagree.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
writeFileSync(OUT, JSON.stringify(report, null, 2));

console.log(
  `\nTerminé : ${report.agree.length} concordances, ${report.disagree.length} écarts, ` +
    `${report.missing.length} introuvables, ${report.failed.length} échecs réseau.`,
);

// The artifact store is not reachable from every environment that needs to read
// this, so the verdicts also go to stdout, one line per card, where the job log
// makes them available to anyone who can see the run.
// Agreements are printed too, not just the problems: for a card being added
// they *are* the result — the year to copy into years.json with MusicBrainz as
// its source. Leaving them out meant a new batch could only be confirmed by
// downloading the artifact, which is not reachable from everywhere.
console.log('\n===== CONCORDANCES =====');
for (const a of report.agree) console.log(`OK\t${a.id}\t${a.year}`);
console.log('===== ÉCARTS =====');
for (const d of report.disagree) {
  const alts = d.candidates
    .slice(1)
    .map((c) => `${c.year}/${c.score}${c.aside ? '~' : ''}`)
    .join(' ');
  console.log(
    `DIFF\t${d.id}\t${d.year}\t${d.mbYear}\t${d.candidates[0]?.score ?? ''}\t${d.candidates[0]?.title ?? ''}\t${alts}`,
  );
}
console.log('===== INTROUVABLES =====');
for (const m of report.missing) console.log(`MISS\t${m.id}\t${m.year}`);
console.log('===== FIN =====');
