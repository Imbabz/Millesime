import type { Card, Difficulty, GameSettings } from './types';
import { decadeOf } from './types';
import { shuffle, type Rng } from './rng';

/**
 * Narrows the catalogue to what the table asked for. An empty selection means
 * "no constraint on this axis", so the default settings keep every card.
 * Decades and genres combine with AND, exactly as the lobby copy promises.
 */
export function filterDeck(
  cards: readonly Card[],
  settings: Pick<GameSettings, 'decades' | 'genres' | 'difficulties'>,
): Card[] {
  const { decades, genres, difficulties } = settings;
  return cards.filter((card) => {
    if (decades.length > 0 && !decades.includes(decadeOf(card.year))) return false;
    if (genres.length > 0 && !card.genres.some((g) => genres.includes(g))) return false;
    if (difficulties.length > 0 && !difficulties.includes(card.difficulty)) return false;
    return true;
  });
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/**
 * Orders a filtered pool so the difficulty mix is felt turn after turn rather
 * than clumping. Without this a plain shuffle regularly deals four "piège à
 * dater" cards in a row, which flattens the mood of a party.
 *
 * Buckets are shuffled independently, then drained by weighted random choice;
 * when a bucket empties its weight simply drops out.
 *
 * `stale` holds what this table has already heard, in earlier games. Those
 * cards are not removed — running dry mid-game is worse than any repeat — they
 * are simply buried at the bottom of their own bucket, so an unheard card is
 * always dealt before a familiar one. That is what keeps a second and third
 * game from opening on the same songs as the first: the mix leans easy, the
 * easy bucket is the smallest, and without this most of every pile came from
 * the same hundred cards.
 */
export function buildDrawPile(
  pool: readonly Card[],
  mix: Record<Difficulty, number>,
  rng: Rng,
  stale: ReadonlySet<string> = new Set(),
): string[] {
  // Cards are taken off the end, so fresh ones go last.
  const freshLast = (cards: Card[]): Card[] => [
    ...shuffle(cards.filter((c) => stale.has(c.id)), rng),
    ...shuffle(cards.filter((c) => !stale.has(c.id)), rng),
  ];
  const buckets = new Map<Difficulty, Card[]>(
    DIFFICULTIES.map((d) => [d, freshLast(pool.filter((c) => c.difficulty === d))]),
  );

  /** Whether this bucket's next card is one the table has not heard. */
  const hasFresh = (d: Difficulty): boolean => {
    const bucket = buckets.get(d);
    const next = bucket?.[bucket.length - 1];
    return next ? !stale.has(next.id) : false;
  };

  const order: string[] = [];
  for (;;) {
    const available = DIFFICULTIES.filter(
      (d) => (buckets.get(d)?.length ?? 0) > 0 && mix[d] > 0,
    );
    if (available.length === 0) break;

    // Buckets holding something unheard come first. This bends the difficulty
    // mix, and deliberately: there are far fewer easy cards than the 6:3:1
    // weighting asks for, so the easy bucket is spent after two or three
    // evenings while hundreds of medium cards are still unheard. Keeping the
    // mix exact would mean replaying easy songs the table knows by heart in
    // order to honour a ratio nobody can perceive. Variety wins.
    const fresh = available.filter(hasFresh);
    const drawFrom = fresh.length > 0 ? fresh : available;

    const total = drawFrom.reduce((sum, d) => sum + mix[d], 0);
    let roll = rng() * total;
    let chosen = drawFrom[drawFrom.length - 1] as Difficulty;
    for (const d of drawFrom) {
      roll -= mix[d];
      if (roll <= 0) {
        chosen = d;
        break;
      }
    }
    order.push((buckets.get(chosen) as Card[]).pop()!.id);
  }

  // Any difficulty the table zeroed out is still better than running dry
  // mid-game, so leftovers are appended rather than dropped — unheard first
  // here too.
  const leftovers = freshLast(DIFFICULTIES.flatMap((d) => buckets.get(d) ?? [])).reverse();
  return [...order, ...leftovers.map((c) => c.id)];
}

/**
 * Smallest pool that can carry a game to its end: every player needs a starting
 * card plus enough draws to reach the target, and turns are wasted on misses.
 */
export function minimumDeckSize(playerCount: number, targetCards: number): number {
  return playerCount * targetCards + playerCount * 4;
}
