import { beforeEach, describe, expect, it } from 'vitest';
import { CATALOGUE } from './catalogue';
import { forgetPlayed, playedCards, rememberPlayed, staleIdsFor } from './history';
import { buildDrawPile, filterDeck, minimumDeckSize } from '@/game/deckFilter';
import { DEFAULT_SETTINGS, type Card } from '@/game/types';
import { mulberry32 } from '@/game/rng';

/**
 * The property that matters is not "the shuffle is random" — it was already
 * random, and the table still heard the same songs every game. It is "two games
 * in a row share nothing", which is what these check, by dealing real piles from
 * the real catalogue rather than by inspecting the ordering.
 */

const deal = (pool: Card[], seed: number, count: number): string[] =>
  buildDrawPile(
    pool,
    DEFAULT_SETTINGS.difficultyMix,
    mulberry32(seed),
    new Set(staleIdsFor(pool, count)),
  ).slice(0, count);

beforeEach(forgetPlayed);

describe('play history', () => {
  it('starts empty and records without duplicating', () => {
    expect(playedCards()).toEqual([]);
    rememberPlayed('c1');
    rememberPlayed('c1');
    rememberPlayed('c2');
    expect(playedCards()).toEqual(['c1', 'c2']);
    forgetPlayed();
    expect(playedCards()).toEqual([]);
  });
});

describe('two games in a row', () => {
  const pool = filterDeck(CATALOGUE, DEFAULT_SETTINGS);
  // Four players to ten cards: the size an evening actually deals.
  const size = minimumDeckSize(4, 10);

  it('share no song at all', () => {
    const first = deal(pool, 1, size);
    for (const id of first) rememberPlayed(id);
    const second = deal(pool, 2, size);
    expect(second.filter((id) => first.includes(id))).toEqual([]);
  });

  it('overlapped measurably before the history existed', () => {
    // The regression this guards, stated as what was actually measured rather
    // than as a round number: averaged over the seed pairs below, two
    // consecutive games shared 11 of 56 cards on the full catalogue, and 20 of
    // 56 on "piège à dater" alone. Enough for a table to notice by the third
    // game, which is what was reported.
    const bare = (seed: number) =>
      buildDrawPile(pool, DEFAULT_SETTINGS.difficultyMix, mulberry32(seed)).slice(0, size);
    const pairs: number[] = [];
    for (let a = 1; a <= 6; a++) {
      for (let b = a + 1; b <= 6; b++) {
        pairs.push(bare(b).filter((id) => bare(a).includes(id)).length);
      }
    }
    const mean = pairs.reduce((x, y) => x + y, 0) / pairs.length;
    expect(mean).toBeGreaterThan(5);
  });

  it('keeps going for a whole evening of games', () => {
    const seen = new Set<string>();
    for (let game = 0; game < 5; game++) {
      const pile = deal(pool, game + 10, size);
      expect(pile.filter((id) => seen.has(id))).toEqual([]);
      for (const id of pile) {
        seen.add(id);
        rememberPlayed(id);
      }
    }
    expect(seen.size).toBe(size * 5);
  });
});

describe('a selection that runs out', () => {
  // "Piège à dater" alone: 158 cards, and one game eats a third of them.
  const pool = filterDeck(CATALOGUE, { ...DEFAULT_SETTINGS, difficulties: ['hard'] });
  const size = minimumDeckSize(4, 10);

  it('starts a new cycle rather than refusing to deal', () => {
    for (const card of pool) rememberPlayed(card.id);
    const pile = deal(pool, 7, size);
    expect(pile).toHaveLength(size);
    expect(new Set(pile).size).toBe(size);
  });

  it('forgets only its own cards, so another selection keeps its history', () => {
    const elsewhere = CATALOGUE.find((c) => c.difficulty === 'easy') as Card;
    rememberPlayed(elsewhere.id);
    for (const card of pool) rememberPlayed(card.id);

    staleIdsFor(pool, size);

    // The hard cards were cleared to open a new cycle; the easy one was not.
    expect(playedCards()).toContain(elsewhere.id);
    expect(playedCards().some((id) => pool.some((c) => c.id === id))).toBe(false);
  });
});
