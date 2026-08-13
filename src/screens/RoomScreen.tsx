import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CATALOGUE_BY_ID } from '@/deck/catalogue';
import { DEFAULT_HOOK_MS, type Card } from '@/game/types';
import { LocalTransport } from '@/net/local';
import { SupabaseTransport } from '@/net/supabase';
import type { Transport } from '@/net/transport';
import { useSession } from '@/session/useSession';
import { playerId as selfPlayerId, playerName } from '@/session/identity';
import { hasRealtime, hasSpotify, loadConfig } from '@/config';
import { useMockMusic, useSpotifyMusic, type MusicController } from '@/spotify/music';
import { isSignedIn } from '@/spotify/auth';
import { resolveCard } from '@/spotify/resolve';
import { RulesButton } from '@/ui/RulesSheet';
import { Banner, Sheet } from '@/ui/bits';
import { LobbyScreen } from './LobbyScreen';
import { TurnScreen } from './TurnScreen';
import { RevealScreen } from './RevealScreen';
import { KaraokeScreen } from './KaraokeScreen';
import { GameOverScreen } from './GameOverScreen';

/**
 * One room, one game.
 *
 * All the wiring the individual screens are kept innocent of lives here: which
 * transport to open, who runs the rules, when the next song starts, and when
 * the steal window slams shut. The host does all of it; a guest's copy of this
 * component only renders.
 */
export function RoomScreen({
  code,
  role,
  mock,
  onLeave,
  onOpenConfig,
}: {
  code: string;
  role: 'host' | 'guest';
  /** `?dev=1`: no network, no Spotify, four simulated players. */
  mock: boolean;
  onLeave: () => void;
  onOpenConfig: () => void;
}) {
  const config = useMemo(loadConfig, []);
  const selfId = useMemo(selfPlayerId, []);
  const isHost = role === 'host';

  // Local when explicitly asked for, and also whenever Supabase is not set up —
  // the game must remain playable on one phone before anything is configured.
  const transport = useMemo<Transport>(() => {
    if (mock || code === 'LOCAL' || !hasRealtime(config)) return new LocalTransport(code);
    return new SupabaseTransport(code, selfId, config);
  }, [code, config, mock, selfId]);

  useEffect(() => () => transport.close(), [transport]);

  const spotifyReady = !mock && isHost && hasSpotify(config) && isSignedIn();
  const realMusic = useSpotifyMusic(config.spotifyClientId, spotifyReady);
  const mockMusic = useMockMusic();
  const music: MusicController = spotifyReady ? realMusic : mockMusic;
  const musicRef = useRef(music);
  musicRef.current = music;

  const onControl = useCallback((command: 'play' | 'pause' | 'restart') => {
    const controller = musicRef.current;
    if (command === 'play') void controller.resume();
    else if (command === 'pause') void controller.pause();
    else void controller.restart();
  }, []);

  const session = useSession({ transport, role, selfId, onControl });
  const { state, dispatch, control, playback, setPlayback, status } = session;

  const card: Card | null = state.turn?.cardId
    ? (CATALOGUE_BY_ID.get(state.turn.cardId) ?? null)
    : null;

  const [devicesOpen, setDevicesOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(() => playerName());

  // ------------------------------------------------------------- host wiring

  // Republish the speaker's state so every phone can render play/pause and
  // scroll the karaoke in step.
  useEffect(() => {
    if (isHost) setPlayback(music.snapshot);
  }, [isHost, music.snapshot, setPlayback]);

  // Start the song when a new card comes into play. Guarded by card id so a
  // re-render, a reconnect or a paused track never restarts the music underneath
  // a player who is mid-thought.
  const playedCardRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost || !card || state.phase !== 'listening') return;
    if (playedCardRef.current === card.id) return;
    playedCardRef.current = card.id;

    const startMs = state.settings.startOnHook ? (card.hookMs ?? DEFAULT_HOOK_MS) : 0;
    void (async () => {
      if (!spotifyReady) {
        void musicRef.current.play(`mock:${card.id}`, startMs);
        return;
      }
      const uri = await resolveCard(config.spotifyClientId, card).catch(() => null);
      // A card Spotify cannot serve must not stall the turn: the table can still
      // place it, they simply have to do it without hearing anything.
      if (uri) void musicRef.current.play(uri, startMs);
    })();
  }, [isHost, card, state.phase, state.settings.startOnHook, spotifyReady, config.spotifyClientId]);

  // Karaoke replays the track from the very beginning, hook offset ignored.
  useEffect(() => {
    if (!isHost || state.phase !== 'karaoke' || !card) return;
    const uri = spotifyReady ? undefined : `mock:${card.id}`;
    void (async () => {
      const resolved =
        uri ?? (await resolveCard(config.spotifyClientId, card).catch(() => null));
      if (resolved) void musicRef.current.play(resolved, 0);
    })();
  }, [isHost, state.phase, card, spotifyReady, config.spotifyClientId]);

  // Close the steal window on the deadline the host itself stamped.
  useEffect(() => {
    if (!isHost || state.phase !== 'challenge') return;
    const endsAt = state.turn?.challengeEndsAt;
    if (!endsAt) return;
    const timer = setTimeout(
      () => dispatch({ type: 'CLOSE_CHALLENGES' }),
      Math.max(0, endsAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [isHost, state.phase, state.turn?.challengeEndsAt, dispatch]);

  // Presence: grey out a phone that has wandered off, without unseating it.
  useEffect(() => {
    if (!isHost || transport instanceof LocalTransport) return;
    for (const player of state.players) {
      const here = session.members.includes(player.id) || player.id === selfId;
      if (here !== player.connected) {
        dispatch({ type: 'SET_CONNECTED', playerId: player.id, connected: here });
      }
    }
  }, [isHost, session.members, state.players, dispatch, selfId, transport]);

  // The dev harness needs a table to play with.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!mock || seededRef.current || state.players.length > 0) return;
    seededRef.current = true;
    for (const [i, name] of ['Toi', 'Bob', 'Chloé', 'Dimitri'].entries()) {
      dispatch({ type: 'ADD_PLAYER', playerId: i === 0 ? selfId : `dev-${i}`, name });
    }
  }, [mock, state.players.length, dispatch, selfId]);

  // ------------------------------------------------------------- rendering

  const seated = state.players.some((p) => p.id === selfId);

  if (!seated && state.phase === 'lobby') {
    return (
      <div className="screen screen--center">
        <h1 className="title">Ton prénom</h1>
        <p className="subtitle">Il s’affichera sur tous les téléphones.</p>
        <input
          className="field"
          value={nameDraft}
          maxLength={14}
          autoFocus
          placeholder="Alex"
          onChange={(e) => setNameDraft(e.target.value)}
        />
        <button
          className="btn btn--primary btn--big btn--block"
          disabled={!nameDraft.trim()}
          onClick={() =>
            dispatch({ type: 'ADD_PLAYER', playerId: selfId, name: nameDraft.trim() })
          }
        >
          Prendre ma place
        </button>
        <button className="btn btn--ghost" onClick={onLeave}>
          Quitter
        </button>
        <RulesButton />
      </div>
    );
  }

  if (!seated) {
    return (
      <div className="screen screen--center">
        <h1 className="title">Partie en cours</h1>
        <p className="subtitle">
          Tu n’as pas de place dans cette manche. Attends la fin pour rejoindre.
        </p>
        <button className="btn" onClick={onLeave}>
          Retour
        </button>
      </div>
    );
  }

  const spotifyBanner = mock
    ? null
    : !hasSpotify(config)
      ? 'Spotify n’est pas configuré : la partie se joue sans musique.'
      : !isSignedIn()
        ? 'Connecte-toi à Spotify pour lancer la musique.'
        : null;

  return (
    <>
      {status === 'error' && (
        <div style={{ padding: '12px 16px 0' }}>
          <Banner tone="error">
            Connexion au salon perdue. Vérifie le réseau ou la configuration Supabase.
          </Banner>
        </div>
      )}

      {state.phase === 'lobby' && (
        <LobbyScreen
          state={state}
          isHost={isHost}
          code={code}
          dispatch={dispatch}
          onOpenSpotify={onOpenConfig}
          spotifyBanner={spotifyBanner}
        />
      )}

      {(state.phase === 'listening' || state.phase === 'challenge') && (
        <TurnScreen
          state={state}
          selfId={selfId}
          dispatch={dispatch}
          control={control}
          playback={playback}
        />
      )}

      {state.phase === 'reveal' && (
        <RevealScreen state={state} card={card} selfId={selfId} dispatch={dispatch} />
      )}

      {state.phase === 'karaoke' && (
        <KaraokeScreen
          card={card}
          playback={playback}
          dispatch={dispatch}
          control={control}
        />
      )}

      {state.phase === 'gameover' && (
        <GameOverScreen
          state={state}
          selfId={selfId}
          isHost={isHost}
          dispatch={dispatch}
        />
      )}

      {/* The device picker is the fix for the single most common failure at a
          table: Spotify is signed in, but no speaker is awake. */}
      {isHost && spotifyReady && state.phase !== 'lobby' && (
        <button
          className="help-button"
          style={{ right: 66 }}
          onClick={() => {
            void music.refreshDevices();
            setDevicesOpen(true);
          }}
          aria-label="Choisir la sortie audio"
        >
          🔊
        </button>
      )}

      {devicesOpen && (
        <Sheet title="Où sort la musique ?" onClose={() => setDevicesOpen(false)}>
          <div className="stack">
            {music.error && <Banner tone="error">{music.error}</Banner>}
            {music.devices.length === 0 && (
              <p className="subtitle">
                Aucun appareil Spotify visible. Ouvre l’app Spotify, lance n’importe
                quel morceau une seconde, puis reviens ici.
              </p>
            )}
            {music.devices.map((device) => (
              <button
                key={device.id ?? device.name}
                className={`btn btn--block${device.id === music.deviceId ? ' btn--primary' : ''}`}
                onClick={() => {
                  music.chooseDevice(device.id);
                  setDevicesOpen(false);
                }}
              >
                {device.name}
                <span className="subtitle"> · {device.type}</span>
              </button>
            ))}
            <button className="btn btn--ghost btn--block" onClick={() => void music.refreshDevices()}>
              Rafraîchir
            </button>
          </div>
        </Sheet>
      )}

      <RulesButton />
    </>
  );
}
