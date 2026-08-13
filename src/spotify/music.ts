import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackSnapshot } from '@/net/transport';
import {
  getPlayerState,
  listDevices,
  pausePlayback,
  resumePlayback,
  seekTo,
  startPlayback,
  SpotifyError,
  type SpotifyDevice,
} from './api';

/**
 * The speaker.
 *
 * Playback goes out over **Spotify Connect** — the app tells an existing
 * Spotify device what to play — rather than through the Web Playback SDK. For a
 * game played around a table that is not a detail:
 *
 *  - the sound comes out of the Bluetooth speaker everyone is already sitting
 *    around, not out of one person's phone earpiece;
 *  - it keeps playing when the host's screen locks or they switch apps, which
 *    the in-browser player does not survive on iOS;
 *  - it never fights Safari's autoplay rules, because no audio element is
 *    involved on this device at all.
 *
 * The cost is that a Spotify device must be awake somewhere. That is the single
 * most common failure at the table, so it gets a real error message and a
 * device picker rather than a silent no-op.
 */

export interface MusicController {
  ready: boolean;
  devices: SpotifyDevice[];
  deviceId: string | null;
  chooseDevice: (id: string | null) => void;
  refreshDevices: () => Promise<void>;
  play: (uri: string, positionMs: number) => Promise<void>;
  resume: () => Promise<void>;
  pause: () => Promise<void>;
  restart: () => Promise<void>;
  snapshot: PlaybackSnapshot;
  error: string | null;
  clearError: () => void;
}

const DEVICE_KEY = 'millesime.spotify.device';

const IDLE: PlaybackSnapshot = {
  playing: false,
  positionMs: 0,
  durationMs: 0,
  atEpochMs: 0,
  deviceName: null,
  error: null,
};

export function useSpotifyMusic(clientId: string, enabled: boolean): MusicController {
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(
    () => localStorage.getItem(DEVICE_KEY),
  );
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot>(IDLE);
  const [error, setError] = useState<string | null>(null);

  // Where the current card starts, so "restart" means the hook, not 0:00.
  const originRef = useRef(0);
  const uriRef = useRef<string | null>(null);

  const fail = useCallback((e: unknown) => {
    const message =
      e instanceof SpotifyError ? e.message : 'La commande Spotify a échoué.';
    setError(message);
    setSnapshot((s) => ({ ...s, playing: false, error: message }));
  }, []);

  const chooseDevice = useCallback((id: string | null) => {
    setDeviceId(id);
    if (id) localStorage.setItem(DEVICE_KEY, id);
    else localStorage.removeItem(DEVICE_KEY);
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await listDevices(clientId);
      const found = response?.devices ?? [];
      setDevices(found);
      setError(null);
      // Fall back to whatever Spotify already considers active, so the common
      // case needs no configuration at all.
      setDeviceId((current) => {
        if (current && found.some((d) => d.id === current)) return current;
        const active = found.find((d) => d.is_active) ?? found[0];
        const next = active?.id ?? null;
        if (next) localStorage.setItem(DEVICE_KEY, next);
        return next;
      });
    } catch (e) {
      fail(e);
    }
  }, [clientId, enabled, fail]);

  const play = useCallback(
    async (uri: string, positionMs: number) => {
      if (!enabled) return;
      uriRef.current = uri;
      originRef.current = positionMs;
      try {
        await startPlayback(clientId, uri, positionMs, deviceId);
        setError(null);
        setSnapshot((s) => ({
          ...s,
          playing: true,
          positionMs,
          atEpochMs: Date.now(),
          error: null,
        }));
      } catch (e) {
        fail(e);
      }
    },
    [clientId, deviceId, enabled, fail],
  );

  const resume = useCallback(async () => {
    if (!enabled) return;
    try {
      await resumePlayback(clientId, deviceId);
      setError(null);
      setSnapshot((s) => ({ ...s, playing: true, atEpochMs: Date.now(), error: null }));
    } catch (e) {
      fail(e);
    }
  }, [clientId, deviceId, enabled, fail]);

  const pause = useCallback(async () => {
    if (!enabled) return;
    try {
      await pausePlayback(clientId, deviceId);
      setSnapshot((s) => ({ ...s, playing: false, atEpochMs: Date.now() }));
    } catch (e) {
      fail(e);
    }
  }, [clientId, deviceId, enabled, fail]);

  const restart = useCallback(async () => {
    if (!enabled) return;
    try {
      await seekTo(clientId, originRef.current, deviceId);
      await resumePlayback(clientId, deviceId);
      setSnapshot((s) => ({
        ...s,
        playing: true,
        positionMs: originRef.current,
        atEpochMs: Date.now(),
        error: null,
      }));
    } catch (e) {
      fail(e);
    }
  }, [clientId, deviceId, enabled, fail]);

  // One poll loop keeps the snapshot honest: the speaker can be paused from the
  // Spotify app, from a car stereo, by anyone. Slow when nothing is playing.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const state = await getPlayerState(clientId);
        if (cancelled) return;
        if (!state) return;
        setSnapshot({
          playing: state.is_playing,
          positionMs: state.progress_ms ?? 0,
          durationMs: state.item?.duration_ms ?? 0,
          atEpochMs: Date.now(),
          deviceName: state.device?.name ?? null,
          error: null,
        });
      } catch {
        // Polling failures are noise; only commands report to the player.
      }
    };

    void tick();
    const period = snapshot.playing ? 1000 : 4000;
    const timer = setInterval(tick, period);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [clientId, enabled, snapshot.playing]);

  useEffect(() => {
    if (enabled) void refreshDevices();
  }, [enabled, refreshDevices]);

  return {
    ready: enabled,
    devices,
    deviceId,
    chooseDevice,
    refreshDevices,
    play,
    resume,
    pause,
    restart,
    snapshot,
    error,
    clearError: () => setError(null),
  };
}

/**
 * A controller that plays nothing.
 *
 * Used by `?dev=1` and by anyone who wants to try the game before wiring up
 * Spotify. It advances a fake clock so that pause, restart and even the karaoke
 * scroller behave exactly as they will on a real speaker — which is what makes
 * the whole UI testable from a laptop with no credentials.
 */
export function useMockMusic(): MusicController {
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot>({
    ...IDLE,
    durationMs: 213_000,
    deviceName: 'Enceinte simulée',
  });
  const originRef = useRef(0);

  useEffect(() => {
    if (!snapshot.playing) return;
    const timer = setInterval(() => {
      setSnapshot((s) => ({
        ...s,
        positionMs: Math.min(s.durationMs, s.positionMs + 500),
        atEpochMs: Date.now(),
      }));
    }, 500);
    return () => clearInterval(timer);
  }, [snapshot.playing]);

  const set = (patch: Partial<PlaybackSnapshot>) =>
    setSnapshot((s) => ({ ...s, ...patch, atEpochMs: Date.now() }));

  return {
    ready: true,
    devices: [],
    deviceId: 'mock',
    chooseDevice: () => {},
    refreshDevices: async () => {},
    play: async (_uri, positionMs) => {
      originRef.current = positionMs;
      set({ playing: true, positionMs });
    },
    resume: async () => set({ playing: true }),
    pause: async () => set({ playing: false }),
    restart: async () => set({ playing: true, positionMs: originRef.current }),
    snapshot,
    error: null,
    clearError: () => {},
  };
}
