/**
 * LRC parsing and line lookup.
 *
 * Kept pure and separate from the network so the karaoke scroller can be tested
 * without a fixture server, and so the sync maths — the part that actually
 * decides whether a room full of people can sing along — is checked directly.
 */

export type LyricLine = {
  /** Milliseconds from the start of the track. */
  atMs: number;
  text: string;
};

const TIMESTAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

/**
 * Parses an LRC body into ordered lines.
 *
 * A single line may carry several timestamps — LRC's way of repeating a chorus
 * without repeating the words — so each one becomes its own entry. Metadata
 * tags such as `[ar:…]` are dropped, and blank interludes are kept because
 * they are what stops the scroller from holding a stale line through a solo.
 */
export function parseLrc(body: string): LyricLine[] {
  const lines: LyricLine[] = [];

  for (const raw of body.split(/\r?\n/)) {
    TIMESTAMP.lastIndex = 0;
    const stamps: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = TIMESTAMP.exec(raw)) !== null) {
      const [, minutes, seconds, fraction = '0'] = match;
      // LRC fractions are hundredths far more often than thousandths.
      const fractionMs =
        fraction.length === 3 ? Number(fraction) : Number(fraction) * 10;
      stamps.push(Number(minutes) * 60_000 + Number(seconds) * 1000 + fractionMs);
    }
    if (stamps.length === 0) continue;

    const text = raw.replace(TIMESTAMP, '').trim();
    for (const atMs of stamps) lines.push({ atMs, text });
  }

  return lines.sort((a, b) => a.atMs - b.atMs);
}

/** Turns unsynced lyrics into something the same renderer can show. */
export const plainToLines = (body: string): LyricLine[] =>
  body
    .split(/\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ atMs: -1, text }));

/**
 * Index of the line that should be highlighted at `positionMs`, or -1 before
 * the first one. Binary search, because this runs on every animation frame.
 */
export function lineIndexAt(lines: readonly LyricLine[], positionMs: number): number {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if ((lines[mid] as LyricLine).atMs <= positionMs) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

/**
 * Where the track is *now*, given the host's last report.
 *
 * The host polls Spotify about once a second; interpolating locally between
 * those reports is what turns a lyric that jumps once a second into one that
 * moves with the song. Clamped to the track length so a missed "stopped" report
 * cannot run the scroller off the end.
 */
export function interpolatePosition(
  snapshot: { playing: boolean; positionMs: number; atEpochMs: number; durationMs: number },
  nowEpochMs: number,
): number {
  if (!snapshot.playing || snapshot.atEpochMs === 0) return snapshot.positionMs;
  const elapsed = Math.max(0, nowEpochMs - snapshot.atEpochMs);
  const position = snapshot.positionMs + elapsed;
  return snapshot.durationMs > 0 ? Math.min(position, snapshot.durationMs) : position;
}
