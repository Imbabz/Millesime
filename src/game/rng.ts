/**
 * Seeded pseudo-random numbers.
 *
 * The engine has to be deterministic: the host is the only device that shuffles,
 * but tests replay whole games, and a host that refreshes mid-game must rebuild
 * the exact same draw pile from the stored seed.
 */

export type Rng = () => number;

/** mulberry32 — small, fast, good enough for shuffling a card deck. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates, returning a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

export const randomSeed = (): number => Math.floor(Math.random() * 0xffffffff);
