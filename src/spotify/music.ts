import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackSnapshot } from '@/net/transport';
import {
  getPlayerState,
  listDevices,
  pausePlayback,
  resumePlayback,
  seekTo,
  startPlayback,
  transferPlayback,
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
 * The cost is that a Spotify device has to exist somewhere, and on a phone that
 * has not opened Spotify today, none does — the API then answers 404 and the
 * song simply never starts. That is by far the most common failure at a table,
 * so it is handled rather than merely reported: the command is retried against
 * a freshly listed device, and if there is genuinely none, `needsDevice` goes
 * up so the UI can offer `wake()` — one tap into the Spotify app, which is what
 * registers the phone — and replay the pending track on the way back.
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
  /** True when everything is in order except that no Spotify device is awake. */
  needsDevice: boolean;
  /** Opens the Spotify app, which is what makes this phone a usable device. */
  wake: () => void;
  /** Replays whatever the game last asked for. Used once a device turns up. */
  retry: () => Promise<void>;
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
  const [needsDevice, setNeedsDevice] = useState(false);

  // Where the current card starts, so "restart" means the hook, not 0:00.
  const originRef = useRef(0);
  const uriRef = useRef<string | null>(null);
  /** Set while the host is away in the Spotify app, so the return can act. */
  const wokenRef = useRef(false);

  const fail = useCallback((e: unknown) => {
    const message =
      e instanceof SpotifyError ? e.message : 'La commande Spotify a échoué.';
    setError(message);
    if (e instanceof SpotifyError && e.status === 404) setNeedsDevice(true);
    setSnapshot((s) => ({ ...s, playing: false, error: message }));
  }, []);

  const succeed = useCallback((patch: Partial<PlaybackSnapshot>) => {
    setError(null);
    setNeedsDevice(false);
    setSnapshot((s) => ({ ...s, ...patch, atEpochMs: Date.now(), error: null }));
  }, []);

  const chooseDevice = useCallback((id: string | null) => {
    setDeviceId(id);
    if (id) localStorage.setItem(DEVICE_KEY, id);
    else localStorage.removeItem(DEVICE_KEY);
  }, []);

  /**
   * Lists devices and settles on one, returning it.
   *
   * It returns the id rather than only storing it because the retry path needs
   * the value immediately — a `setState` would not be visible until the next
   * render, long after the command it is meant to rescue.
   */
  const ensureDevice = useCallback(async (): Promise<string | null> => {
    const found = (await listDevices(clientId))?.devices ?? [];
    setDevices(found);
    const remembered = localStorage.getItem(DEVICE_KEY);
    // Prefer the one this table chose, then whatever Spotify already considers
    // active, then anything at all — so the common case needs no configuration.
    const chosen =
      found.find((d) => d.id === remembered) ??
      found.find((d) => d.is_active) ??
      found[0];
    const next = chosen?.id ?? null;
    setDeviceId(next);
    if (next) localStorage.setItem(DEVICE_KEY, next);
    setNeedsDevice(found.length === 0);
    return next;
  }, [clientId]);

  const refreshDevices = useCallback(async () => {
    if (!enabled) return;
    try {
      await ensureDevice();
      setError(null);
    } catch (e) {
      fail(e);
    }
  }, [enabled, ensureDevice, fail]);

  const play = useCallback(
    async (uri: string, positionMs: number) => {
      if (!enabled) return;
      uriRef.current = uri;
      originRef.current = positionMs;
      const started = () => succeed({ playing: true, positionMs });
      try {
        await startPlayback(clientId, uri, positionMs, deviceId);
        started();
      } catch (e) {
        // A 404 means the remembered device has gone quiet, or there never was
        // one. Both are ordinary: look again, and if something is there, wake
        // it and replay. Only a second failure is worth telling anyone about.
        if (!(e instanceof SpotifyError) || e.status !== 404) return fail(e);
        try {
          const id = await ensureDevice();
          if (!id) return fail(e);
          await transferPlayback(clientId, id, false).catch(() => {});
          await startPlayback(clientId, uri, positionMs, id);
          started();
        } catch (second) {
          fail(second);
        }
      }
    },
    [clientId, deviceId, enabled, ensureDevice, fail, succeed],
  );

  /** Replays the pending track. What the "réessayer" button calls. */
  const retry = useCallback(async () => {
    if (!enabled) return;
    if (!uriRef.current) {
      await refreshDevices();
      return;
    }
    await play(uriRef.current, originRef.current);
  }, [enabled, play, refreshDevices]);

  /**
   * Sends the host into the Spotify app.
   *
   * Opening it is what makes the phone announce itself as a Connect device;
   * there is no API that can do it from here. The visibility listener below
   * picks the game back up on the way in, so the round trip costs one tap.
   */
  const wake = useCallback(() => {
    wokenRef.current = true;
    window.location.href = 'spotify:';
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !wokenRef.current) return;
      wokenRef.current = false;
      void retry();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [enabled, retry]);

  const resume = useCallback(async () => {
    if (!enabled) return;
    try {
      await resumePlayback(clientId, deviceId);
      succeed({ playing: true });
    } catch (e) {
      // A speaker that dozed off between two turns is the same ordinary 404 as
      // never having had one; a transfer wakes it and resumes in one call.
      if (!(e instanceof SpotifyError) || e.status !== 404) return fail(e);
      try {
        const id = await ensureDevice();
        if (!id) return fail(e);
        await transferPlayback(clientId, id, true);
        succeed({ playing: true });
      } catch (second) {
        fail(second);
      }
    }
  }, [clientId, deviceId, enabled, ensureDevice, fail, succeed]);

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
    needsDevice,
    wake,
    retry,
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
    needsDevice: false,
    wake: () => {},
    retry: async () => {},
  };
}
