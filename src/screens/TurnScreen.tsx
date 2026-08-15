import { useEffect, useState } from 'react';
import { arbiter, eligibleChallengers, type Action } from '@/game/engine';
import { TOKENS_PER_FREE_CARD, type GameState, type PlayerId } from '@/game/types';
import type { PlaybackSnapshot } from '@/net/transport';
import { Timeline, type GapState } from '@/ui/Timeline';
import { Banner, Countdown, Tokens } from '@/ui/bits';
import { TableStrip } from './TableStrip';

/**
 * The turn itself — the screen people actually look at while a song plays.
 *
 * Every phone shows the *active player's* frise, because that is the shared
 * object the whole table is arguing about. What changes per phone is the row of
 * buttons underneath: the active player places, everyone else waits to pounce.
 * There is never more than one primary action visible.
 */
export function TurnScreen({
  state,
  selfId,
  dispatch,
  control,
  playback,
}: {
  state: GameState;
  selfId: PlayerId;
  dispatch: (action: Action) => void;
  control: (command: 'play' | 'pause' | 'restart') => void;
  playback: PlaybackSnapshot;
}) {
  const active = state.players[state.activeIndex];
  const me = state.players.find((p) => p.id === selfId);
  const turn = state.turn;
  const isMyTurn = active?.id === selfId;
  // The arbiter drew this card and runs the music; it is their job, not a
  // shared one, so it reads as the main action on their phone only.
  const isArbiter = arbiter(state)?.id === selfId;

  const [pick, setPick] = useState<number | null>(null);
  const [arming, setArming] = useState(false);

  // A new turn must never inherit the previous turn's selection.
  useEffect(() => {
    setPick(null);
    setArming(false);
  }, [turn?.cardId, state.phase]);

  if (!active || !turn) return null;

  const challenging = state.phase === 'challenge';
  const myChallenge = turn.challenges.find((c) => c.playerId === selfId);
  const hasAnswered = Boolean(myChallenge) || turn.passed.includes(selfId);
  const takenSlots = new Set(turn.challenges.map((c) => c.slot));
  const answered = new Set([...turn.challenges.map((c) => c.playerId), ...turn.passed]);
  const pending = challenging
    ? eligibleChallengers(state).filter((p) => !answered.has(p.id))
    : [];

  const gapState = (slot: number): GapState => {
    if (challenging) {
      if (slot === turn.placement) return 'chosen';
      if (takenSlots.has(slot)) return 'challenge';
      if (arming && !hasAnswered) return 'armed';
      return 'idle';
    }
    if (!isMyTurn) return 'idle';
    return pick === slot ? 'chosen' : 'armed';
  };

  const onPickGap = (slot: number) => {
    if (challenging) {
      if (!arming || hasAnswered) return;
      dispatch({ type: 'CHALLENGE', playerId: selfId, slot, at: Date.now() });
      setArming(false);
    } else if (isMyTurn) {
      setPick(slot);
    }
  };

  const canPickGap = challenging ? arming && !hasAnswered : isMyTurn;

  return (
    <div className="screen">
      <TableStrip state={state} selfId={selfId} />

      <div className="stack" style={{ textAlign: 'center' }}>
        <div className="eyebrow">
          {challenging ? 'Fenêtre de vol' : isMyTurn ? 'À toi de jouer' : `Au tour de ${active.name}`}
        </div>
        <h1 className="title">
          {challenging
            ? `Frise de ${active.name}`
            : isMyTurn
              ? 'Où se range ce morceau ?'
              : `${active.name} réfléchit`}
        </h1>
      </div>

      {/* The arbiter runs the music, so the controls are full-size on their
          phone. They stay available to everyone else, just smaller: "attends,
          j'ai pas entendu" must not require catching someone's eye. */}
      <div className="stack" style={{ gap: 6 }}>
        {isArbiter && <div className="eyebrow" style={{ textAlign: 'center' }}>Tu tiens la carte</div>}
        <div className="row" style={{ justifyContent: 'center' }}>
          <button
            className={isArbiter ? 'btn btn--big' : 'btn'}
            style={{ flex: 1 }}
            onClick={() => control(playback.playing ? 'pause' : 'play')}
          >
            {playback.playing ? '⏸ Pause' : '▶︎ Reprendre'}
          </button>
          <button
            className={isArbiter ? 'btn btn--big' : 'btn'}
            onClick={() => control('restart')}
          >
            ⟲
          </button>
        </div>
      </div>

      {playback.error && <Banner tone="error">{playback.error}</Banner>}

      <div className="board">
        <Timeline
          cards={active.timeline}
          gapState={gapState}
          onPickGap={canPickGap ? onPickGap : undefined}
        />
      </div>

      {/* ---------------------------------------------------- listening */}
      {!challenging && isMyTurn && (
        <div className="stack">
          <label
            className="panel row row--between"
            style={{ padding: '12px 14px' }}
          >
            <span>
              🪙 J’annonce le titre <em>et</em> l’artiste
              <br />
              <span className="subtitle">Dis-les à voix haute, l’arbitre jugera</span>
            </span>
            <input
              type="checkbox"
              checked={turn.claimsTitleArtist}
              onChange={(e) =>
                dispatch({ type: 'SET_CLAIM', playerId: selfId, value: e.target.checked })
              }
              style={{ width: 28, height: 28 }}
            />
          </label>

          {(me?.tokens ?? 0) >= TOKENS_PER_FREE_CARD && (
            <button
              className="btn btn--block"
              onClick={() => dispatch({ type: 'TRADE_TOKENS', playerId: selfId })}
            >
              🔁 Échanger {TOKENS_PER_FREE_CARD} jetons contre cette carte
            </button>
          )}

          <button
            className="btn btn--primary btn--big btn--block"
            disabled={pick === null}
            onClick={() =>
              pick !== null &&
              dispatch({ type: 'COMMIT_PLACEMENT', playerId: selfId, slot: pick, at: Date.now() })
            }
          >
            {pick === null ? 'Choisis un emplacement' : 'Valider ce placement'}
          </button>
        </div>
      )}

      {!challenging && !isMyTurn && (
        <p className="subtitle" style={{ textAlign: 'center' }}>
          Écoute bien. Dès que {active.name} valide, tu pourras tenter de voler la carte.
        </p>
      )}

      {/* ---------------------------------------------------- challenge */}
      {challenging && (
        <div className="stack">
          {turn.challengeEndsAt !== null && (
            <p className="subtitle" style={{ textAlign: 'center' }}>
              Fermeture dans <Countdown until={turn.challengeEndsAt} /> s
            </p>
          )}

          {/* Naming who has still to answer turns dead air into a queue: on one
              phone it says who to hand it to, and around a table it says who
              the game is waiting for rather than leaving everyone staring. */}
          {pending.length > 0 && (
            <p className="subtitle" style={{ textAlign: 'center' }}>
              En attente de {pending.map((p) => p.name).join(', ')}
            </p>
          )}

          {isMyTurn ? (
            <Banner tone="warn">
              Ton placement est verrouillé. Les autres peuvent maintenant dépenser un jeton
              pour te voler la carte.
            </Banner>
          ) : hasAnswered ? (
            <p className="subtitle" style={{ textAlign: 'center' }}>
              {myChallenge
                ? '⚡ Ton jeton est posé. On attend les autres…'
                : 'Tu as laissé passer. On attend les autres…'}
            </p>
          ) : (me?.tokens ?? 0) < 1 ? (
            <p className="subtitle" style={{ textAlign: 'center' }}>
              Plus de jeton — impossible de voler ce tour-ci.
            </p>
          ) : arming ? (
            <div className="stack">
              <Banner tone="warn">
                Choisis un emplacement <strong>différent</strong> du sien. Le premier
                arrivé le réserve.
              </Banner>
              <button className="btn btn--block" onClick={() => setArming(false)}>
                Annuler
              </button>
            </div>
          ) : (
            <div className="stack">
              <button
                className="btn btn--danger btn--big btn--block"
                onClick={() => setArming(true)}
              >
                ⚡ MILLÉSIME ! <Tokens count={me?.tokens ?? 0} />
              </button>
              <button
                className="btn btn--ghost btn--block"
                onClick={() => dispatch({ type: 'PASS_CHALLENGE', playerId: selfId })}
              >
                Laisser passer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
