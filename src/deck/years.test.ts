import { describe, expect, it } from 'vitest';
import { CATALOGUE } from './catalogue';
import {
  contradictedCards,
  unverifiedCards,
  VERIFIED_YEARS,
  type YearSource,
} from './years';

/**
 * The lock on the deck.
 *
 * These are the tests that make the catalogue trustworthy rather than merely
 * plausible. A card with no verified year, or one that contradicts its source,
 * fails the build — because the alternative is a card that silently cannot be
 * placed, in the middle of somebody's turn, months from now.
 */

describe('every card carries a verified year', () => {
  it('leaves none unverified', () => {
    const missing = unverifiedCards(CATALOGUE).map((c) => `${c.artist} — ${c.title}`);
    expect(missing).toEqual([]);
  });

  it('never contradicts the catalogue', () => {
    const clashes = contradictedCards(CATALOGUE).map(
      ({ card, verified }) =>
        `${card.artist} — ${card.title}: catalogue ${card.year}, vérifié ${verified.year}`,
    );
    expect(clashes).toEqual([]);
  });

  it('carries no entry for a card that no longer exists', () => {
    const ids = new Set(CATALOGUE.map((c) => c.id));
    const orphans = Object.keys(VERIFIED_YEARS).filter((id) => !ids.has(id));
    expect(orphans).toEqual([]);
  });

  it('records where each year came from', () => {
    const allowed: YearSource[] = ['musicbrainz', 'manual'];
    const bad = Object.entries(VERIFIED_YEARS)
      .filter(([, v]) => !allowed.includes(v.source))
      .map(([id, v]) => `${id}: ${v.source}`);
    expect(bad).toEqual([]);
  });

  it('holds plausible years', () => {
    const bad = Object.entries(VERIFIED_YEARS)
      .filter(([, v]) => !Number.isInteger(v.year) || v.year < 1940 || v.year > 2026)
      .map(([id, v]) => `${id}: ${v.year}`);
    expect(bad).toEqual([]);
  });

  it('explains every year it had to settle by hand', () => {
    // A manual override is a judgement call, and a judgement call with no note
    // is indistinguishable from a typo six months later.
    const unexplained = Object.entries(VERIFIED_YEARS)
      .filter(([, v]) => v.source === 'manual' && !v.ref?.trim())
      .map(([id]) => id);
    expect(unexplained).toEqual([]);
  });
});
