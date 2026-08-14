import rawYears from './years.json';
import type { Card } from '@/game/types';

/**
 * The verified release year of every card, and where it came from.
 *
 * The catalogue keeps its year inline because that is what makes it readable,
 * but this file is the authority. A card cannot enter the deck without an
 * entry here, and a test fails the moment the two disagree — which is the only
 * way to keep a hand-maintained list of 600 dates honest.
 *
 * Why it matters more than it looks: a wrong year is invisible during a game.
 * The card is simply impossible to place, nobody notices, and the player who
 * drew it gets blamed for it.
 */

export type YearSource =
  /** MusicBrainz `first-release-date` on the recording, agreed by the sweep. */
  | 'musicbrainz'
  /** Checked by hand against a reference where MusicBrainz was wrong or silent. */
  | 'manual';

export type VerifiedYear = {
  year: number;
  source: YearSource;
  /** MusicBrainz recording id, or a short note explaining a manual ruling. */
  ref?: string;
};

export const VERIFIED_YEARS: Record<string, VerifiedYear> = rawYears as Record<
  string,
  VerifiedYear
>;

export const verifiedYear = (cardId: string): VerifiedYear | undefined =>
  VERIFIED_YEARS[cardId];

/** Cards with no verified year yet — the list a test refuses to let grow. */
export const unverifiedCards = (cards: readonly Card[]): Card[] =>
  cards.filter((card) => !VERIFIED_YEARS[card.id]);

/** Cards whose catalogue year contradicts the verified one. */
export const contradictedCards = (
  cards: readonly Card[],
): { card: Card; verified: VerifiedYear }[] =>
  cards.flatMap((card) => {
    const verified = VERIFIED_YEARS[card.id];
    return verified && verified.year !== card.year ? [{ card, verified }] : [];
  });
