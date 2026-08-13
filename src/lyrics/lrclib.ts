import type { Card } from '@/game/types';
import { parseLrc, plainToLines, type LyricLine } from './lrc';

/**
 * Lyrics from LRCLIB.
 *
 * Spotify exposes no lyrics at all — they are licensed through Musixmatch and
 * simply are not in the Web API — so the karaoke leans on lrclib.net: free, no
 * API key, CORS open, and crucially it serves **time-synced** LRC, which is the
 * difference between a karaoke and a wall of text.
 *
 * Nothing here is essential to the game. Every failure path ends in "pas de
 * paroles pour ce titre" rather than an error, because a missing lyric should
 * never interrupt a party.
 */

const BASE = 'https://lrclib.net/api';

export type Lyrics = {
  lines: LyricLine[];
  /** False when only unsynced lyrics were found, so the UI can say so. */
  synced: boolean;
};

type LrclibRecord = {
  trackName: string;
  artistName: string;
  syncedLyrics: string | null;
  plainLyrics: string | null;
  instrumental?: boolean;
};

/** LRCLIB asks clients to identify themselves; it is a volunteer-run service. */
const HEADERS = {
  'Lrclib-Client': 'Millesime (https://github.com/Imbabz/Magellan)',
};

function toLyrics(record: LrclibRecord | null): Lyrics | null {
  if (!record || record.instrumental) return null;
  if (record.syncedLyrics) {
    const lines = parseLrc(record.syncedLyrics);
    if (lines.length > 0) return { lines, synced: true };
  }
  if (record.plainLyrics) {
    const lines = plainToLines(record.plainLyrics);
    if (lines.length > 0) return { lines, synced: false };
  }
  return null;
}

/**
 * Looks a card up, exact match first then a fuzzy search.
 *
 * `duration` is deliberately not sent: the catalogue's idea of a song and
 * whichever master Spotify is streaming rarely agree to the second, and
 * LRCLIB's exact endpoint rejects a mismatch outright.
 */
export async function fetchLyrics(
  card: Card,
  signal?: AbortSignal,
): Promise<Lyrics | null> {
  const params = new URLSearchParams({
    artist_name: card.artist,
    track_name: card.title,
  });

  try {
    const exact = await fetch(`${BASE}/get?${params}`, { headers: HEADERS, signal });
    if (exact.ok) {
      const found = toLyrics((await exact.json()) as LrclibRecord);
      if (found) return found;
    }

    const search = await fetch(`${BASE}/search?${params}`, { headers: HEADERS, signal });
    if (!search.ok) return null;
    const results = (await search.json()) as LrclibRecord[];
    // Prefer a synced record over the first hit; unsynced is the consolation.
    return (
      toLyrics(results.find((r) => r.syncedLyrics) ?? results[0] ?? null) ?? null
    );
  } catch {
    // Offline, blocked, rate-limited — all the same to the table.
    return null;
  }
}
