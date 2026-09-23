import { arbiter, canJudge, type Action } from '@/game/engine';
import type { Card, GameState, PlayerId } from '@/game/types';
import { Timeline, type GapState } from '@/ui/Timeline';
import { TableStrip } from './TableStrip';

/**
 * The moment the year lands.
 *
 * This is the payoff of the whole turn, so the year is the largest thing on any
 * screen in the app. The frise underneath replays the verdict spatially — green
 * where the card belonged, red where it was put — because "1982" alone does not
 * tell you *why* you were wrong.
 */
export function RevealScreen({
  state,
  card,
  selfId,
  dispatch,
}: {
  state: GameState;
  card: Card | null;
  selfId: PlayerId;
  dispatch: (action: Action) => void;
}) {
  const turn = state.turn;
  const active = state.players[state.activeIndex];
  const outcome = turn?.outcome;
  if (!turn || !active || !outcome || !card) return null;

  const winner = outcome.wonBy
    ? state.players.find((p) => p.id === outcome.wonBy)
    : null;
  const stolen = Boolean(outcome.wonBy) && outcome.wonBy !== active.id;
  const awaitingClaim = turn.claimsTitleArtist && outcome.claimGranted === null;
  // Ruling on the spoken announcement is the arbiter's job for this turn, the
  // same way the person holding the card reads out the answer at a real table.
  const judge = arbiter(state) ?? active;
  const iAmJudge = canJudge(state, selfId);

  // The frise shown is the one that was bet on: the active player's, as it was
  // *before* the card was inserted, so the marks line up with what people saw.
  const boardCards = outcome.wonBy === active.id
    ? active.timeline.filter((c) => c.id !== card.id)
    : active.timeline;

  /** A card already on the board carrying the very same year. */
  const twin = boardCards.find((c) => c.year === card.year);

  const gapState = (slot: number): GapState => {
    if (slot === outcome.correctSlot) return 'correct';
    if (slot === turn.placement && !outcome.activeCorrect) return 'wrong';
    if (turn.challenges.some((c) => c.slot === slot)) return 'challenge';
    return 'idle';
  };

  return (
    <div className="screen">
      <TableStrip state={state} selfId={selfId} />

      <div className="reveal-card">
        <div className="reveal-card__year">{card.year}</div>
        <div className="reveal-card__title">{card.title}</div>
        <div className="reveal-card__artist">{card.artist}</div>
      </div>

      <div
        className={`verdict verdict--${outcome.wonBy ? 'good' : 'bad'}`}
      >
        {outcome.traded
          ? `🔁 ${active.name} a acheté la carte`
          : stolen
            ? `⚡ ${winner?.name} vole la carte à ${active.name} !`
            : outcome.activeCorrect
              ? `✓ Bien joué ${active.name}`
              : '✕ Personne ne l’a placée au bon endroit'}
      </div>

      {/* A poteau read as an injustice is the fastest way to lose a table: the
          card sits next to an identical year, the placement looks right, and
          the app says no. Naming the rule at the moment it bites is the
          difference between a rule and a bug. */}
      {twin && (
        <p className="subtitle" style={{ textAlign: 'center', margin: 0 }}>
          📍 Poteau — même année que « {twin.title} ». Une carte de même année se
          range juste après, jamais avant.
        </p>
      )}

      <div className="board">
        <Timeline
          cards={boardCards}
          gapState={gapState}
          scrollToSlot={outcome.correctSlot}
        />
      </div>

      {awaitingClaim ? (
        <div className="stack">
          <div className="panel" style={{ textAlign: 'center' }}>
            <strong>{active.name}</strong> a annoncé le titre et l’artiste.
            <br />
            <span className="subtitle">C’était juste ?</span>
          </div>
          {!iAmJudge ? (
            <p className="subtitle" style={{ textAlign: 'center' }}>
              {judge.name} tranche — c’est l’arbitre de ce tour.
            </p>
          ) : (
            <div className="row">
              <button
                className="btn btn--primary btn--big"
                style={{ flex: 1 }}
                onClick={() => dispatch({ type: 'RESOLVE_CLAIM', playerId: selfId, granted: true })}
              >
                ✓ Oui, +1 jeton
              </button>
              <button
                className="btn btn--big"
                style={{ flex: 1 }}
                onClick={() => dispatch({ type: 'RESOLVE_CLAIM', playerId: selfId, granted: false })}
              >
                ✕ Non
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="stack">
          {turn.claimsTitleArtist && (
            <p className="subtitle" style={{ textAlign: 'center' }}>
              {outcome.claimGranted
                ? `🪙 ${active.name} gagne un jeton pour le titre et l’artiste.`
                : 'Pas de jeton pour l’annonce.'}
            </p>
          )}
          <button
            className="btn btn--block btn--big"
            onClick={() => dispatch({ type: 'OPEN_KARAOKE' })}
          >
            🎤 Karaoké
          </button>
          <button
            className="btn btn--primary btn--big btn--block"
            onClick={() => dispatch({ type: 'NEXT_TURN' })}
          >
            {state.winner ? 'Voir le résultat' : 'Joueur suivant'}
          </button>
        </div>
      )}
    </div>
  );
}
