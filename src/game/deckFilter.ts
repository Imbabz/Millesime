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
 */
export function buildDrawPile(
  pool: readonly Card[],
  mix: Record<Difficulty, number>,
  rng: Rng,
): string[] {
  const buckets = new Map<Difficulty, Card[]>(
    DIFFICULTIES.map((d) => [d, shuffle(pool.filter((c) => c.difficulty === d), rng)]),
  );

  const order: string[] = [];
  for (;;) {
    const available = DIFFICULTIES.filter(
      (d) => (buckets.get(d)?.length ?? 0) > 0 && mix[d] > 0,
    );
    if (available.length === 0) break;

    const total = available.reduce((sum, d) => sum + mix[d], 0);
    let roll = rng() * total;
    let chosen = available[available.length - 1] as Difficulty;
    for (const d of available) {
      roll -= mix[d];
      if (roll <= 0) {
        chosen = d;
        break;
      }
    }
    order.push((buckets.get(chosen) as Card[]).pop()!.id);
  }

  // Any difficulty the table zeroed out is still better than running dry
  // mid-game, so leftovers are appended rather than dropped.
  const leftovers = DIFFICULTIES.flatMap((d) => buckets.get(d) ?? []).map((c) => c.id);
  return [...order, ...shuffle(leftovers, rng)];
}

/**
 * Smallest pool that can carry a game to its end: every player needs a starting
 * card plus enough draws to reach the target, and turns are wasted on misses.
 */
export function minimumDeckSize(playerCount: number, targetCards: number): number {
  return playerCount * targetCards + playerCount * 4;
}
