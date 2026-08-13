import type { Action } from '@/game/engine';
import { PLAYER_COLORS, type GameState, type PlayerId } from '@/game/types';
import { Timeline } from '@/ui/Timeline';

/**
 * The scoreboard, and everyone's finished frise — which is the part people
 * actually want to look at afterwards, arguing about the one card they got
 * wrong.
 */
export function GameOverScreen({
  state,
  selfId,
  isHost,
  dispatch,
}: {
  state: GameState;
  selfId: PlayerId;
  isHost: boolean;
  dispatch: (action: Action) => void;
}) {
  const ranked = [...state.players].sort(
    (a, b) => b.timeline.length - a.timeline.length || b.tokens - a.tokens,
  );
  const winner = state.players.find((p) => p.id === state.winner);

  return (
    <div className="screen">
      <div className="stack" style={{ textAlign: 'center' }}>
        <div className="eyebrow">Fin de partie</div>
        <h1 className="wordmark">{winner ? winner.name : 'Égalité'}</h1>
        {winner && (
          <p className="subtitle">
            {winner.timeline.length} cartes bien placées
            {winner.id === selfId ? ' — et c’est toi.' : '.'}
          </p>
        )}
      </div>

      <div className="grow scroll stack">
        {ranked.map((player, rank) => (
          <section key={player.id} className="panel stack" style={{ gap: 8 }}>
            <div className="row">
              <span
                className="player-dot"
                style={{
                  background: PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length],
                }}
              />
              <strong style={{ flex: 1 }}>
                {rank + 1}. {player.name}
              </strong>
              <span className="subtitle">
                {player.timeline.length} carte{player.timeline.length > 1 ? 's' : ''}
                {player.tokens > 0 ? ` · 🪙${player.tokens}` : ''}
              </span>
            </div>
            <Timeline cards={player.timeline} gapState={() => 'idle'} />
          </section>
        ))}
      </div>

      {isHost ? (
        <button
          className="btn btn--primary btn--big btn--block"
          onClick={() => dispatch({ type: 'RESET_TO_LOBBY' })}
        >
          Rejouer
        </button>
      ) : (
        <p className="subtitle" style={{ textAlign: 'center' }}>
          L’hôte peut relancer une partie.
        </p>
      )}
    </div>
  );
}
