import { useState } from 'react';
import { arbiter, type Action } from '@/game/engine';
import { PLAYER_COLORS, type GameState, type PlayerId } from '@/game/types';
import { Sheet, Tokens } from '@/ui/bits';

/**
 * Everything that is not the turn in progress.
 *
 * Three things had no way in once a game had started: the score in full, the
 * settings — which live in the lobby, and were therefore unreachable until
 * somebody won — and starting over. All three are the same kind of thing, a
 * step out of the round rather than a move inside it, so they share one sheet
 * behind one button, instead of adding three more to a screen that has to stay
 * readable at arm's length across a table.
 *
 * Restarting returns to the lobby rather than dealing a new game straight away.
 * The lobby is where decades, genres, target and opening tokens are chosen, so
 * "recommencer" and "changer les réglages" become the same gesture, and nobody
 * has to guess which settings the new game inherited.
 */
export function GameMenu({
  state,
  selfId,
  isHost,
  dispatch,
  onClose,
  onLeave,
}: {
  state: GameState;
  selfId: PlayerId;
  isHost: boolean;
  dispatch: (action: Action) => void;
  onClose: () => void;
  onLeave: () => void;
}) {
  // Restarting throws away a game in progress, so it asks once. Two taps is
  // the difference between a decision and a fumble at a party.
  const [confirming, setConfirming] = useState(false);

  const target = state.settings.targetCards;
  const ranked = [...state.players].sort(
    (a, b) => b.timeline.length - a.timeline.length || b.tokens - a.tokens,
  );
  const leader = ranked[0]?.timeline.length ?? 0;
  const dealerId = arbiter(state)?.id;
  const activeId = state.players[state.activeIndex]?.id;

  return (
    <Sheet title="Partie" onClose={onClose}>
      <div className="stack">
        <section className="panel stack" style={{ gap: 12 }}>
          <div className="row row--between">
            <h3 style={{ fontSize: 17 }}>Scores</h3>
            <span className="subtitle">objectif {target} cartes</span>
          </div>

          {ranked.map((player, rank) => {
            const cards = player.timeline.length;
            return (
              <div key={player.id} className="stack" style={{ gap: 4 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span
                    className="player-dot"
                    style={{
                      background: PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length],
                    }}
                  />
                  <strong style={{ flex: 1, minWidth: 0 }}>
                    {rank + 1}. {player.name}
                    {player.id === selfId ? ' (toi)' : ''}
                  </strong>
                  {player.id === activeId && <span title="Joue ce tour">▶︎</span>}
                  {player.id === dealerId && <span title="Arbitre de ce tour">🎴</span>}
                  {!player.connected && <span title="Déconnecté">⚠️</span>}
                  <strong style={{ minWidth: 46, textAlign: 'right' }}>
                    {cards}/{target}
                  </strong>
                </div>
                {/* A bar rather than a number alone: who is about to win is a
                    question people ask by glancing, not by reading. */}
                <div
                  aria-hidden
                  style={{
                    height: 6,
                    borderRadius: 999,
                    background: 'var(--surface-2, rgba(255,255,255,.12))',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, (cards / Math.max(1, target)) * 100)}%`,
                      height: '100%',
                      background:
                        PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length],
                      opacity: cards === leader ? 1 : 0.65,
                    }}
                  />
                </div>
                <div className="row row--between">
                  <Tokens count={player.tokens} />
                  <span className="subtitle">
                    🪙 {player.tokens} jeton{player.tokens > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </section>

        <section className="panel stack">
          <h3 style={{ fontSize: 17 }}>Réglages</h3>
          <p className="subtitle" style={{ margin: 0 }}>
            Décennies, genres, cartes pour gagner, jetons de départ et fenêtre de
            vol se règlent dans le salon. Recommencer y ramène tout le monde, en
            gardant les joueurs assis.
          </p>

          {isHost ? (
            confirming ? (
              <div className="stack">
                <p className="subtitle" style={{ margin: 0 }}>
                  La partie en cours sera perdue.
                </p>
                <div className="row">
                  <button
                    className="btn btn--danger"
                    style={{ flex: 1 }}
                    onClick={() => {
                      dispatch({ type: 'RESET_TO_LOBBY' });
                      onClose();
                    }}
                  >
                    Oui, recommencer
                  </button>
                  <button className="btn" onClick={() => setConfirming(false)}>
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="btn btn--block"
                onClick={() => setConfirming(true)}
              >
                🔄 Recommencer / changer les réglages
              </button>
            )
          ) : (
            <p className="subtitle" style={{ margin: 0 }}>
              Seul l’hôte peut relancer la partie.
            </p>
          )}
        </section>

        <button className="btn btn--ghost btn--block" onClick={onLeave}>
          🚪 Quitter le salon
        </button>
      </div>
    </Sheet>
  );
}
