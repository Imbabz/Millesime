import { useState } from 'react';
import type { Action } from '@/game/engine';
import { arbiter, canDraw } from '@/game/engine';
import { MAX_TOKENS, PLAYER_COLORS, type GameState, type PlayerId } from '@/game/types';
import { TableStrip } from './TableStrip';

/**
 * The beat before the song.
 *
 * The turn does not start by itself: the arbiter — the player to the active
 * player's left — draws the top card, and that gesture is what starts the
 * music. It matters for one reason above all: the person about to guess never
 * touches anything, so nothing can give the answer away on their screen.
 *
 * It also buys the table a breath between turns, which is when people actually
 * talk to each other.
 */
export function DrawScreen({
  state,
  selfId,
  dispatch,
}: {
  state: GameState;
  selfId: PlayerId;
  dispatch: (action: Action) => void;
}) {
  const active = state.players[state.activeIndex];
  const dealer = arbiter(state) ?? active;
  const myDraw = canDraw(state, selfId);
  const isActive = active?.id === selfId;
  const [tokensOpen, setTokensOpen] = useState(false);
  if (!active || !dealer) return null;

  return (
    <div className="screen">
      <TableStrip state={state} selfId={selfId} />

      <div className="grow stack" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 56 }}>{myDraw ? '🎴' : '⏳'}</div>

        {myDraw ? (
          <>
            <div className="eyebrow">Tu es l’arbitre de ce tour</div>
            <h1 className="title">
              {isActive ? 'Tire ta carte' : `Tire la carte pour ${active.name}`}
            </h1>
            <p className="subtitle">
              Tu lances le morceau et tu contrôles la lecture. Tu ne verras la
              réponse qu’au même moment que tout le monde.
            </p>
          </>
        ) : (
          <>
            <div className="eyebrow">
              {isActive ? 'À toi de jouer' : `Au tour de ${active.name}`}
            </div>
            <h1 className="title">{dealer.name} tire la carte</h1>
            <p className="subtitle">
              {isActive
                ? 'Ne touche à rien — écoute, c’est tout.'
                : `${active.name} devra la placer dans sa frise.`}
            </p>
          </>
        )}
      </div>

      {/* The app keeps the score, but the table has the last word. A close
          call the group decides to reward, a house rule, an announcement judged
          generously after the fact — without a way to hand out a token, the
          only recourse is arguing with a phone. Folded away by default so it
          never competes with the one button that matters here. */}
      {myDraw && (
        <div className="stack" style={{ gap: 8 }}>
          <button
            className="btn btn--ghost btn--block"
            onClick={() => setTokensOpen((open) => !open)}
          >
            🪙 Donner un jeton {tokensOpen ? '▾' : '▸'}
          </button>
          {tokensOpen &&
            state.players.map((player) => (
              <div key={player.id} className="row" style={{ gap: 10 }}>
                <span
                  className="player-dot"
                  style={{
                    background: PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length],
                  }}
                />
                <strong style={{ flex: 1, minWidth: 0 }}>{player.name}</strong>
                <span className="subtitle">🪙{player.tokens}</span>
                <button
                  className="btn"
                  style={{ minHeight: 40 }}
                  disabled={player.tokens >= MAX_TOKENS}
                  onClick={() =>
                    dispatch({ type: 'GRANT_TOKEN', playerId: player.id, byId: selfId })
                  }
                >
                  +1
                </button>
              </div>
            ))}
        </div>
      )}

      {myDraw ? (
        <button
          className="btn btn--primary btn--big btn--block"
          onClick={() => dispatch({ type: 'DRAW_CARD', playerId: selfId })}
        >
          🎴 Tirer la carte
        </button>
      ) : (
        <p className="subtitle" style={{ textAlign: 'center' }}>
          <span className="spin">◍</span> En attente de {dealer.name}…
        </p>
      )}
    </div>
  );
}
