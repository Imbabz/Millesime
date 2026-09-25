import { describe, expect, it } from 'vitest';
import { CATALOGUE, CATALOGUE_BY_ID, slugify } from './catalogue';
import { GENRE_LABELS, decadeOf, type Decade, type Difficulty } from '@/game/types';
import { filterDeck, minimumDeckSize } from '@/game/deckFilter';

/**
 * These are content tests, not logic tests. A typo in a year silently breaks the
 * game — the card is simply impossible to place — so the catalogue is checked
 * for the kinds of mistakes hand-entered data actually makes.
 */

describe('slugify', () => {
  it('strips accents and punctuation', () => {
    expect(slugify('Édith Piaf')).toBe('edith-piaf');
    expect(slugify("Guns N' Roses")).toBe('guns-n-roses');
    expect(slugify('…Baby One More Time')).toBe('baby-one-more-time');
  });
});

describe('catalogue integrity', () => {
  it('carries no album furniture', () => {
    // An intro or a skit is a minute of atmosphere with no year anybody could
    // guess: it breaks the rhythm of a turn and teaches the table nothing. The
    // resolver refuses to match one, and the deck should not ask it to.
    const furniture = CATALOGUE.filter((card) =>
      /\b(intro|outro|interlude|skit|prelude|prologue|overture|ouverture)\b/i.test(
        card.title,
      ),
    );
    expect(furniture.map((c) => `${c.artist} — ${c.title}`)).toEqual([]);
  });

  it('has no duplicate ids', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const card of CATALOGUE) {
      const previous = seen.get(card.id);
      if (previous) clashes.push(`${card.id} (${previous} / ${card.title})`);
      seen.set(card.id, card.title);
    }
    expect(clashes).toEqual([]);
    expect(CATALOGUE_BY_ID.size).toBe(CATALOGUE.length);
  });

  it('has no duplicate title + artist pairs', () => {
    const keys = CATALOGUE.map((c) => `${c.artist}|${c.title}`.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('carries plausible release years', () => {
    const bad = CATALOGUE.filter((c) => c.year < 1940 || c.year > 2026);
    expect(bad.map((c) => `${c.artist} — ${c.title} (${c.year})`)).toEqual([]);
  });

  it('uses only declared genres', () => {
    const known = new Set(Object.keys(GENRE_LABELS));
    const bad = CATALOGUE.filter((c) => c.genres.some((g) => !known.has(g)));
    expect(bad.map((c) => `${c.title}: ${c.genres.join(',')}`)).toEqual([]);
  });

  it('gives every card at least one genre', () => {
    expect(CATALOGUE.filter((c) => c.genres.length === 0)).toEqual([]);
  });

  it('has non-empty titles and artists', () => {
    expect(CATALOGUE.filter((c) => !c.title.trim() || !c.artist.trim())).toEqual([]);
  });
});

describe('catalogue coverage', () => {
  it('is big enough for a full table', () => {
    // Six players racing to ten cards is the worst realistic case.
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(minimumDeckSize(6, 10));
  });

  it('can fill a four-player game on any single decade from the 1960s on', () => {
    const decades: Decade[] = [1960, 1970, 1980, 1990, 2000, 2010, 2020];
    const needed = minimumDeckSize(4, 10);
    const thin = decades
      .map((decade) => ({
        decade,
        size: filterDeck(CATALOGUE, { decades: [decade], genres: [], difficulties: [] }).length,
      }))
      .filter(({ size }) => size < needed);
    expect(thin).toEqual([]);
  });

  it('offers every genre in usable quantity', () => {
    const thin = (Object.keys(GENRE_LABELS) as (keyof typeof GENRE_LABELS)[])
      .map((genre) => ({
        genre,
        size: filterDeck(CATALOGUE, { decades: [], genres: [genre], difficulties: [] }).length,
      }))
      .filter(({ size }) => size < 8);
    expect(thin).toEqual([]);
  });

  it('keeps a real share of "known but impossible to date" cards', () => {
    const counts = CATALOGUE.reduce<Record<Difficulty, number>>(
      (acc, c) => ({ ...acc, [c.difficulty]: acc[c.difficulty] + 1 }),
      { easy: 0, medium: 0, hard: 0 },
    );
    expect(counts.easy).toBeGreaterThan(50);
    expect(counts.hard / CATALOGUE.length).toBeGreaterThan(0.15);
  });

  it('spreads across the decades rather than clustering on one era', () => {
    const perDecade = new Map<number, number>();
    for (const card of CATALOGUE) {
      const d = decadeOf(card.year);
      perDecade.set(d, (perDecade.get(d) ?? 0) + 1);
    }
    const biggest = Math.max(...perDecade.values());
    expect(biggest / CATALOGUE.length).toBeLessThan(0.3);
  });
});
