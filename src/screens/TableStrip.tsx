import { PLAYER_COLORS, type GameState, type PlayerId } from '@/game/types';

/**
 * The scoreboard, compressed into one glanceable row.
 *
 * Cards and tokens are the only two numbers that matter mid-turn, and this
 * needs to be readable from across the table without anyone tapping anything.
 */
export function TableStrip({
  state,
  selfId,
}: {
  state: GameState;
  selfId: PlayerId;
}) {
  return (
    <div className="row scroll" style={{ gap: 8, paddingBottom: 4 }}>
      {state.players.map((player, index) => {
        const isActive = index === state.activeIndex;
        const isSelf = player.id === selfId;
        return (
          <div
            key={player.id}
            className={`player-chip${isActive ? ' player-chip--active' : ''}${
              player.connected ? '' : ' player-chip--offline'
            }`}
            style={{ flex: '0 0 auto', padding: '8px 10px', gap: 8 }}
          >
            <span
              className="player-dot"
              style={{ background: PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length] }}
            />
            <span style={{ fontWeight: isSelf ? 800 : 600, fontSize: 14 }}>
              {isSelf ? 'Toi' : player.name}
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>
              {player.timeline.length}/{state.settings.targetCards}
            </span>
            {player.tokens > 0 && (
              <span style={{ fontSize: 13 }}>🪙{player.tokens}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
