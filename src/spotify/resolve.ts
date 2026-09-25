import type { Card } from '@/game/types';
import { searchTracks, type SearchResponse } from './api';

/**
 * Matching a curated card to something Spotify can actually play.
 *
 * The catalogue holds titles and artists, not Spotify ids, because ids rot and
 * differ per market while "Bohemian Rhapsody by Queen" does not. Resolution
 * happens once on the host's phone and is cached forever after.
 *
 * The scoring exists because a naive "first result" is wrong often enough to
 * ruin a game: search for almost any classic and Spotify will happily offer a
 * karaoke backing track, a tribute band, or a 40-minute live version whose
 * opening is unrecognisable. Those are filtered out, not just ranked down.
 */

type Candidate = NonNullable<SearchResponse['tracks']>['items'][number];

/**
 * The suffix is a rules version, and bumping it is part of changing the
 * matcher. A resolved card is remembered forever, so a phone that ran the deck
 * check before a fix keeps playing exactly the track the fix was meant to
 * prevent — and nobody thinks to clear a cache they were never told about.
 * v2: market-scoped search, album furniture and implausible lengths refused.
 */
const CACHE_KEY = 'millesime.spotify.uris.v2';

/** Nothing here is a real recording of the song on the card. */
const IMPOSTORS = /\b(karaoke|karaoké|tribute|made famous by|originally performed|instrumental|cover version|8-?bit|lullaby|piano tribute|remix)\b/i;

/**
 * Album furniture rather than a song: an intro, a skit, an interlude.
 *
 * Checked against the track title only, never the album's. A record may quite
 * legitimately be called *Intro* while every song on it is real, and rejecting
 * a whole album for its name would cost far more than it saves.
 */
const NOT_A_SONG = /\b(intro|outro|interlude|skit|prelude|prologue|overture|ouverture)\b/i;

/**
 * What a song on this deck plausibly lasts.
 *
 * The floor is what stops an album intro or a skit being played: they run under
 * a minute, and the game then starts thirty seconds into a forty-second track,
 * so the table hears three seconds of nothing and the turn is ruined. The
 * ceiling catches a DJ set or a full live side filed under the song's name.
 * Both are deliberately loose — a 1950s single can be brief, and Hey Jude runs
 * past seven minutes.
 */
const MIN_SONG_MS = 75_000;
const MAX_SONG_MS = 15 * 60_000;

/** Unknown length is not suspicious; a stated absurd one is. */
const plausibleLength = (ms: number | undefined): boolean =>
  !Number.isFinite(ms) || !ms || (ms >= MIN_SONG_MS && ms <= MAX_SONG_MS);

/** Fold to something comparable: no accents, no punctuation, no chart cruft. */
export function normalise(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(remaster(ed)?|mono|stereo|version|edit|single|radio)\b/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Artist strings mix separators freely: "&", "feat.", ",", "x". */
const artistTokens = (input: string): string[] =>
  normalise(input)
    .split(/\s+(?:and|et|feat|featuring|with|vs|x)\s+|\s+/)
    .filter((t) => t.length > 2);

/**
 * Picks the best playable match, or `null` when nothing is convincing enough.
 * Returning `null` is a feature: a wrong track is worse than a missing one,
 * because the deck-check screen can surface a gap but cannot detect a mismatch.
 */
export function pickBestMatch(card: Card, candidates: Candidate[]): Candidate | null {
  const wantedTitle = normalise(card.title);
  const wantedArtist = normalise(card.artist);
  const wantedArtistTokens = artistTokens(card.artist);

  let best: { candidate: Candidate; score: number } | null = null;

  // A handful of cards *are* the remix ("Cold Heart (PNAU Remix)"), so the
  // impostor filter has to step aside when the card asks for one.
  const impostor = (text: string) =>
    IMPOSTORS.test(text) && !IMPOSTORS.test(card.title);

  for (const candidate of candidates) {
    if (impostor(candidate.name) || impostor(candidate.album.name)) continue;
    if (candidate.artists.some((a) => impostor(a.name))) continue;
    // Track Relinking has already tried to find a playable master; an explicit
    // false means this account cannot hear it, whatever its title says.
    if (candidate.is_playable === false) continue;
    if (NOT_A_SONG.test(candidate.name) && !NOT_A_SONG.test(card.title)) continue;
    if (!plausibleLength(candidate.duration_ms)) continue;

    const title = normalise(candidate.name);
    const artists = candidate.artists.map((a) => normalise(a.name)).join(' ');

    let score = 0;
    if (title === wantedTitle) score += 6;
    else if (title.startsWith(wantedTitle) || wantedTitle.startsWith(title)) score += 4;
    else if (title.includes(wantedTitle)) score += 2;
    else continue; // The title has to be in there somewhere.

    if (artists === wantedArtist) score += 5;
    else if (artists.includes(wantedArtist)) score += 4;
    else {
      const hits = wantedArtistTokens.filter((t) => artists.includes(t)).length;
      if (hits === 0) continue; // Right song, wrong band: reject.
      score += Math.min(3, hits);
    }

    // A live take of a studio classic is technically the same song and the
    // wrong card to play at a party.
    if (/\blive\b/.test(title) && !/\blive\b/.test(wantedTitle)) score -= 3;

    if (!best || score > best.score) best = { candidate, score };
  }

  return best && best.score >= 6 ? best.candidate : null;
}

// ------------------------------------------------------------------ cache

type UriCache = Record<string, string | null>;

function readCache(): UriCache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as UriCache;
  } catch {
    return {};
  }
}

const writeCache = (cache: UriCache) =>
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));

export const cachedUri = (cardId: string): string | null | undefined => readCache()[cardId];

export function rememberUri(cardId: string, uri: string | null): void {
  const cache = readCache();
  cache[cardId] = uri;
  writeCache(cache);
}

export const forgetAllUris = (): void => localStorage.removeItem(CACHE_KEY);

export const resolvedCount = (): number =>
  Object.values(readCache()).filter((uri) => uri !== null).length;

// ---------------------------------------------------------------- lookup

/**
 * Resolves one card, hitting the network only on a cache miss. A previously
 * failed lookup is remembered too, so a deck check does not re-query hundreds
 * of tracks that Spotify simply does not carry in this market.
 */
export async function resolveCard(
  clientId: string,
  card: Card,
): Promise<string | null> {
  const cached = cachedUri(card.id);
  if (cached !== undefined) return cached;

  const queries = [
    `track:"${card.title}" artist:"${card.artist}"`,
    `${card.title} ${card.artist}`,
  ];

  for (const query of queries) {
    const response = await searchTracks(clientId, query);
    const items = response?.tracks?.items ?? [];
    const match = pickBestMatch(card, items);
    if (match) {
      rememberUri(card.id, match.uri);
      return match.uri;
    }
  }

  rememberUri(card.id, null);
  return null;
}

export type DeckCheckProgress = {
  done: number;
  total: number;
  missing: Card[];
};

/**
 * Walks the whole deck once, sequentially. Deliberately unhurried — this runs
 * before the guests arrive, and Development Mode shares one rate-limit budget
 * across the developer account, so hammering it helps nobody.
 */
export async function checkDeck(
  clientId: string,
  cards: readonly Card[],
  onProgress: (progress: DeckCheckProgress) => void,
  signal?: AbortSignal,
): Promise<DeckCheckProgress> {
  const missing: Card[] = [];
  let done = 0;

  for (const card of cards) {
    if (signal?.aborted) break;
    try {
      const uri = await resolveCard(clientId, card);
      if (!uri) missing.push(card);
    } catch {
      // A transient failure must not be cached as "this song does not exist".
      missing.push(card);
    }
    done += 1;
    onProgress({ done, total: cards.length, missing: [...missing] });
  }

  return { done, total: cards.length, missing };
}
