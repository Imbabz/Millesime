import type { Card } from '@/game/types';

/**
 * What this device has already played.
 *
 * A fresh shuffle per game is not enough to keep an evening varied, and the
 * arithmetic says why: the difficulty mix leans easy 6:3:1, the catalogue holds
 * 108 easy cards, and a four-player game to ten draws about sixty. So more than
 * half of every pile came out of the same hundred songs, and by the third game
 * the table recognised the intro before the first bar. Filtered games are worse
 * — "piège à dater" alone is 158 cards, and one game eats a third of them.
 *
 * So played cards are remembered across games and pushed to the back of the
 * next pile. Nothing is ever forbidden: when a selection runs out of unheard
 * cards the cycle starts over, because refusing to deal is far worse than
 * repeating a song.
 *
 * Kept on the host's device rather than in the game state: it describes a
 * table's history, not a match, and the engine stays a pure function of the
 * state it is handed.
 */

const KEY = 'millesime.played';

export function playedCards(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function write(ids: readonly string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // A full or blocked store costs variety, never a game.
  }
}

/** Called as each card comes into play, so a game abandoned midway still counts. */
export function rememberPlayed(id: string): void {
  const ids = playedCards();
  if (ids.includes(id)) return;
  write([...ids, id]);
}

export function forgetPlayed(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do; the next write will overwrite it anyway.
  }
}

/**
 * The ids to send into the next pile as "already heard", cycling first if this
 * selection has nothing new left.
 *
 * `needed` is the smallest pool that can carry the game to its end. Cycling on
 * that number rather than on zero matters: a selection with four unheard cards
 * left would otherwise deal those four and then fall back to a flat shuffle for
 * the rest, which is the repetitive behaviour this exists to prevent, arriving
 * one game later.
 */
export function staleIdsFor(pool: readonly Card[], needed: number): string[] {
  const played = new Set(playedCards());
  const fresh = pool.filter((card) => !played.has(card.id)).length;
  if (fresh >= Math.min(needed, pool.length)) return [...played];

  // This selection is spent. Forget only its cards, so a table that alternates
  // between "années 80" and "rap" does not lose one history by playing the
  // other.
  const poolIds = new Set(pool.map((card) => card.id));
  const kept = playedCards().filter((id) => !poolIds.has(id));
  write(kept);
  return kept;
}
