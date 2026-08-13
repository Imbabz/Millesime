import { useEffect, useRef, useState } from 'react';
import type { Action } from '@/game/engine';
import type { Card } from '@/game/types';
import type { PlaybackSnapshot } from '@/net/transport';
import { interpolatePosition, lineIndexAt } from '@/lyrics/lrc';
import { fetchLyrics, type Lyrics } from '@/lyrics/lrclib';

/**
 * Karaoke.
 *
 * Every phone runs this scroller against the same playback snapshot the host
 * publishes, so a room full of people scrolls in step without any of them
 * talking to Spotify. Between the host's ~1 s polls the position is
 * interpolated locally on an animation frame, which is the difference between
 * lyrics that lurch once a second and lyrics that move with the song.
 */
export function KaraokeScreen({
  card,
  playback,
  dispatch,
  control,
}: {
  card: Card | null;
  playback: PlaybackSnapshot;
  dispatch: (action: Action) => void;
  control: (command: 'play' | 'pause' | 'restart') => void;
}) {
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(-1);
  const currentRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!card) return;
    const controller = new AbortController();
    setLoading(true);
    setLyrics(null);
    fetchLyrics(card, controller.signal).then((found) => {
      if (controller.signal.aborted) return;
      setLyrics(found);
      setLoading(false);
    });
    return () => controller.abort();
  }, [card]);

  // Track the song on every frame rather than on every network report.
  useEffect(() => {
    if (!lyrics?.synced) return;
    let frame = 0;
    const step = () => {
      setIndex(lineIndexAt(lyrics.lines, interpolatePosition(playback, Date.now())));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [lyrics, playback]);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [index]);

  return (
    <div className="screen">
      <div className="row row--between">
        <div>
          <div className="eyebrow">Karaoké</div>
          <strong>{card?.title}</strong>
          <div className="subtitle">{card?.artist}</div>
        </div>
        <button className="btn" onClick={() => dispatch({ type: 'CLOSE_KARAOKE' })}>
          Retour
        </button>
      </div>

      <div className="grow scroll">
        {loading && (
          <p className="subtitle" style={{ textAlign: 'center', padding: '40% 0' }}>
            <span className="spin">◍</span> Recherche des paroles…
          </p>
        )}

        {!loading && !lyrics && (
          <p className="subtitle" style={{ textAlign: 'center', padding: '35% 0' }}>
            Pas de paroles pour ce titre.
            <br />
            La musique continue — chantez de mémoire.
          </p>
        )}

        {lyrics && (
          <div className="lyrics">
            {!lyrics.synced && (
              <p className="subtitle">
                Paroles non synchronisées : elles ne défileront pas toutes seules.
              </p>
            )}
            {lyrics.lines.map((line, i) => (
              <p
                key={`${line.atMs}-${i}`}
                ref={i === index ? currentRef : undefined}
                className={`lyric${
                  !lyrics.synced ? '' : i === index ? ' lyric--now' : i === index + 1 ? ' lyric--next' : ''
                }`}
              >
                {line.text || '♪'}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="row">
        <button
          className="btn btn--big"
          style={{ flex: 1 }}
          onClick={() => control(playback.playing ? 'pause' : 'play')}
        >
          {playback.playing ? '⏸ Pause' : '▶︎ Reprendre'}
        </button>
        <button className="btn btn--big" onClick={() => control('restart')}>
          ⟲ Depuis le début
        </button>
      </div>

      <p className="subtitle" style={{ textAlign: 'center', fontSize: 12 }}>
        Paroles fournies par LRCLIB
      </p>
    </div>
  );
}
