import { Fragment, useEffect, useRef } from 'react';
import type { Card } from '@/game/types';

export type GapState = 'idle' | 'armed' | 'chosen' | 'challenge' | 'correct' | 'wrong';

/**
 * A player's frise: cards left to right, oldest first, with a tappable gap
 * between each pair — `cards.length + 1` of them.
 *
 * The gap is the whole interaction of the game — placing a card *is* tapping a
 * gap — so it is deliberately as wide as a thumb and scrolls itself into view.
 * Everything else on screen can be small; this cannot.
 */
export function Timeline({
  cards,
  gapState,
  onPickGap,
  freshCardId,
  scrollToSlot,
}: {
  cards: Card[];
  gapState: (slot: number) => GapState;
  onPickGap?: (slot: number) => void;
  /** Card to highlight, typically the one that was just won. */
  freshCardId?: string | null;
  /** Gap to bring into view, used on reveal. */
  scrollToSlot?: number | null;
}) {
  const targetRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (scrollToSlot == null) return;
    targetRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [scrollToSlot]);

  const label = (slot: number) => {
    if (cards.length === 0) return 'Placer la carte';
    if (slot === 0) return `Placer avant ${cards[0]?.year}`;
    if (slot === cards.length) return `Placer après ${cards[cards.length - 1]?.year}`;
    return `Placer entre ${cards[slot - 1]?.year} et ${cards[slot]?.year}`;
  };

  const renderGap = (slot: number) => {
    const state = gapState(slot);
    const interactive = Boolean(onPickGap) && (state === 'armed' || state === 'chosen');
    return (
      <button
        ref={slot === scrollToSlot ? targetRef : undefined}
        className={`gap gap--${state}${interactive ? '' : ' gap--static'}`}
        onClick={interactive ? () => onPickGap?.(slot) : undefined}
        disabled={!interactive}
        aria-label={label(slot)}
      >
        {state === 'correct' ? '✓' : state === 'wrong' ? '✕' : state === 'idle' ? '' : '+'}
      </button>
    );
  };

  return (
    <div className="timeline">
      {renderGap(0)}
      {cards.map((card, slot) => (
        <Fragment key={card.id}>
          <div
            className={`timeline-card${card.id === freshCardId ? ' timeline-card--fresh' : ''}`}
          >
            <span className="timeline-card__year">{card.year}</span>
            <span className="timeline-card__title">{card.title}</span>
            <span className="timeline-card__artist">{card.artist}</span>
          </div>
          {renderGap(slot + 1)}
        </Fragment>
      ))}
    </div>
  );
}
