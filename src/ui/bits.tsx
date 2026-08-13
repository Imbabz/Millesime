import { useEffect, useState, type ReactNode } from 'react';
import { MAX_TOKENS, PLAYER_COLORS, type Player } from '@/game/types';

/** A player's tokens, drawn as filled and empty coins up to the cap of five. */
export function Tokens({ count, max = MAX_TOKENS }: { count: number; max?: number }) {
  return (
    <span className="tokens" aria-label={`${count} jeton${count > 1 ? 's' : ''}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`token${i < count ? '' : ' token--spent'}`} />
      ))}
    </span>
  );
}

export function PlayerChip({
  player,
  active = false,
  right,
}: {
  player: Player;
  active?: boolean;
  right?: ReactNode;
}) {
  return (
    <div
      className={`player-chip${active ? ' player-chip--active' : ''}${
        player.connected ? '' : ' player-chip--offline'
      }`}
    >
      <span
        className="player-dot"
        style={{ background: PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length] }}
      />
      <strong style={{ flex: 1, minWidth: 0 }}>{player.name}</strong>
      {right ?? <Tokens count={player.tokens} />}
    </div>
  );
}

/** A bottom sheet. Used for the rules, the settings and the device picker. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__grip" />
        <div className="row row--between">
          <h2 style={{ fontSize: 20 }}>{title}</h2>
          <button className="btn btn--ghost" style={{ minHeight: 40 }} onClick={onClose}>
            Fermer
          </button>
        </div>
        <div className="scroll grow">{children}</div>
      </div>
    </>
  );
}

/** Counts down the challenge window; returns null once it is over. */
export function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  return <span>{left}</span>;
}

export function Banner({
  tone = 'warn',
  children,
}: {
  tone?: 'warn' | 'error';
  children: ReactNode;
}) {
  return <div className={`banner banner--${tone}`}>{children}</div>;
}
