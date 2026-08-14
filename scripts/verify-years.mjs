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
 * This writes a report and changes nothing. MusicBrainz is wrong often enough
 * — compilations dated by their reissue, a cover matched to the original, live
 * takes folded in — that an automatic rewrite would trade one set of errors for
 * another. A human reads the disagreements.
 *
 * Rate limit: MusicBrainz asks for one request per second and a descriptive
 * User-Agent, and enforces both. Roughly ten minutes for the full deck.
 */
import { writeFileSync } from 'node:fs';
import { CATALOGUE } from '../src/deck/catalogue.ts';

const ENDPOINT = 'https://musicbrainz.org/ws/2/recording';
const USER_AGENT =
  'Millesime/1.0 ( https://github.com/Imbabz/millesime ) deck-year-verification';
const DELAY_MS = 1100;
const OUT = process.env.REPORT_PATH ?? 'years.report.json';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lucene needs its quotes escaped, and a few titles contain them. */
const escape = (value) => value.replace(/(["\\])/g, '\\$1');

async function query(card, attempt = 0) {
  const q = `recording:"${escape(card.title)}" AND artist:"${escape(card.artist)}"`;
  const url = `${ENDPOINT}?query=${encodeURIComponent(q)}&limit=8&fmt=json`;

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

/**
 * Picks the recording that is actually this card.
 *
 * Search scores are unreliable on their own: a karaoke rendition and the
 * original often score alike. Candidates must clear a name and artist check
 * before their date is trusted at all.
 */
function pick(card, recordings = []) {
  const wantTitle = normalise(card.title);
  const wantArtist = normalise(card.artist);

  const viable = recordings.filter((rec) => {
    if (!rec['first-release-date']) return false;
    const title = normalise(rec.title ?? '');
    if (!title.includes(wantTitle) && !wantTitle.includes(title)) return false;
    const credit = normalise(
      (rec['artist-credit'] ?? []).map((a) => a.name ?? '').join(' '),
    );
    return credit.includes(wantArtist) || wantArtist.includes(credit);
  });

  if (viable.length === 0) return null;
  // Among genuine matches, the earliest date is the original release; later
  // ones are reissues and compilations, which is precisely the trap.
  return viable.reduce((best, rec) =>
    rec['first-release-date'] < best['first-release-date'] ? rec : best,
  );
}

const normalise = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const report = { checkedAt: new Date().toISOString(), agree: [], disagree: [], missing: [], failed: [] };

for (const [index, card] of CATALOGUE.entries()) {
  try {
    const data = await query(card);
    const match = pick(card, data.recordings);

    if (!match) {
      report.missing.push({ id: card.id, artist: card.artist, title: card.title, year: card.year });
    } else {
      const mbYear = Number(String(match['first-release-date']).slice(0, 4));
      const entry = {
        id: card.id,
        artist: card.artist,
        title: card.title,
        year: card.year,
        mbYear,
        mbid: match.id,
        mbDate: match['first-release-date'],
      };
      if (mbYear === card.year) report.agree.push(entry);
      else report.disagree.push({ ...entry, delta: mbYear - card.year });
    }
  } catch (error) {
    report.failed.push({ id: card.id, error: String(error) });
  }

  if ((index + 1) % 25 === 0) {
    console.log(
      `${index + 1}/${CATALOGUE.length} — ${report.agree.length} ok, ` +
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
