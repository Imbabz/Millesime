import { describe, expect, it } from 'vitest';
import { buildDrawPile, filterDeck, minimumDeckSize } from './deckFilter';
import { mulberry32 } from './rng';
import type { Card, Difficulty, Genre } from './types';

const make = (
  id: string,
  year: number,
  genres: Genre[],
  difficulty: Difficulty = 'easy',
): Card => ({ id, title: id, artist: id, year, genres, difficulty });

const CARDS: Card[] = [
  make('a', 1975, ['funk']),
  make('b', 1982, ['pop', 'electro'], 'hard'),
  make('c', 1994, ['rap'], 'medium'),
  make('d', 2003, ['rock']),
  make('e', 2011, ['pop'], 'medium'),
  make('f', 1988, ['rock', 'pop'], 'hard'),
];

describe('filterDeck', () => {
  it('keeps everything when nothing is selected', () => {
    expect(filterDeck(CARDS, { decades: [], genres: [], difficulties: [] })).toHaveLength(6);
  });

  it('filters by decade', () => {
    const out = filterDeck(CARDS, { decades: [1980], genres: [], difficulties: [] });
    expect(out.map((c) => c.id).sort()).toEqual(['b', 'f']);
  });

  it('matches a card if any of its genres was selected', () => {
    const out = filterDeck(CARDS, { decades: [], genres: ['electro'], difficulties: [] });
    expect(out.map((c) => c.id)).toEqual(['b']);
  });

  it('combines decade and genre with AND', () => {
    const out = filterDeck(CARDS, { decades: [1980], genres: ['rock'], difficulties: [] });
    expect(out.map((c) => c.id)).toEqual(['f']);
  });

  it('filters by difficulty', () => {
    const out = filterDeck(CARDS, { decades: [], genres: [], difficulties: ['hard'] });
    expect(out.map((c) => c.id).sort()).toEqual(['b', 'f']);
  });

  it('can end up empty, and says so rather than falling back', () => {
    expect(filterDeck(CARDS, { decades: [1950], genres: [], difficulties: [] })).toEqual([]);
  });
});

describe('buildDrawPile', () => {
  const mix = { easy: 6, medium: 3, hard: 1 };

  it('uses every card exactly once', () => {
    const pile = buildDrawPile(CARDS, mix, mulberry32(7));
    expect(pile).toHaveLength(CARDS.length);
    expect(new Set(pile).size).toBe(CARDS.length);
  });

  it('is reproducible for a given seed', () => {
    expect(buildDrawPile(CARDS, mix, mulberry32(7))).toEqual(
      buildDrawPile(CARDS, mix, mulberry32(7)),
    );
  });

  it('leans on the weighted difficulty early on', () => {
    // 300 cards, 100 per difficulty, weighted 6:3:1 towards easy.
    const pool: Card[] = [];
    (['easy', 'medium', 'hard'] as Difficulty[]).forEach((d) => {
      for (let i = 0; i < 100; i++) pool.push(make(`${d}${i}`, 1990, ['pop'], d));
    });
    const first50 = buildDrawPile(pool, mix, mulberry32(3)).slice(0, 50);
    const easy = first50.filter((id) => id.startsWith('easy')).length;
    const hard = first50.filter((id) => id.startsWith('hard')).length;
    expect(easy).toBeGreaterThan(hard * 2);
  });

  it('still deals difficulties the table weighted to zero rather than running dry', () => {
    const pile = buildDrawPile(CARDS, { easy: 1, medium: 0, hard: 0 }, mulberry32(1));
    expect(pile).toHaveLength(CARDS.length);
    // The two easy cards are dealt first; the zero-weighted rest is appended
    // shuffled, so the game never stalls for want of cards.
    expect(pile.slice(0, 2).sort()).toEqual(['a', 'd']);
    expect(pile.slice(2).sort()).toEqual(['b', 'c', 'e', 'f']);
  });
});

describe('minimumDeckSize', () => {
  it('scales with players and target', () => {
    expect(minimumDeckSize(4, 10)).toBe(56);
    expect(minimumDeckSize(2, 10)).toBeLessThan(minimumDeckSize(6, 10));
  });
});
