import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initialState, redactForGuests, reduce, type Action } from '@/game/engine';
import type { GameState } from '@/game/types';
import { CATALOGUE_BY_ID } from '@/deck/catalogue';
import type {
  ConnectionStatus,
  Envelope,
  PlaybackSnapshot,
  Transport,
} from '@/net/transport';

export type Role = 'host' | 'guest';

const EMPTY_PLAYBACK: PlaybackSnapshot = {
  playing: false,
  positionMs: 0,
  durationMs: 0,
  atEpochMs: 0,
  deviceName: null,
  error: null,
};

const gameKey = (room: string) => `millesime.game.${room}`;

/**
 * Binds the rules engine to a transport.
 *
 * The host is the only device that runs the reducer. Everyone else sends
 * intents and renders whatever snapshot the host last published. That
 * asymmetry is what makes a race like "who shouted HITSTER first" decidable at
 * all: there is exactly one clock and one arbiter, so no two phones can
 * disagree about who won a card.
 */
export function useSession(options: {
  transport: Transport;
  role: Role;
  selfId: string;
  /** Host only: called when any phone taps play/pause/restart. */
  onControl?: (command: 'play' | 'pause' | 'restart') => void;
}) {
  const { transport, role, selfId, onControl } = options;
  const isHost = role === 'host';

  const [state, setState] = useState<GameState>(() => {
    if (!isHost) return initialState();
    try {
      const saved = localStorage.getItem(gameKey(transport.room));
      return saved ? (JSON.parse(saved) as GameState) : initialState();
    } catch {
      return initialState();
    }
  });
  const [playback, setPlaybackLocal] = useState<PlaybackSnapshot>(EMPTY_PLAYBACK);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [members, setMembers] = useState<string[]>([]);

  // Read inside transport callbacks, which are registered once and must never
  // close over a stale board.
  const stateRef = useRef(state);
  stateRef.current = state;
  const controlRef = useRef(onControl);
  controlRef.current = onControl;

  const ctx = useMemo(() => ({ cards: CATALOGUE_BY_ID }), []);

  const publish = useCallback(
    (next: GameState) => {
      transport.send({ kind: 'state', from: selfId, state: redactForGuests(next) });
    },
    [transport, selfId],
  );

  /** Host-side: run the action through the rules and tell everyone the result. */
  const apply = useCallback(
    (action: Action) => {
      const next = reduce(stateRef.current, action, ctx);
      if (next === stateRef.current) return; // Rejected by the rules.
      stateRef.current = next;
      setState(next);
      publish(next);
      try {
        localStorage.setItem(gameKey(transport.room), JSON.stringify(next));
      } catch {
        // A full quota only costs us crash recovery, never the game in progress.
      }
    },
    [ctx, publish, transport.room],
  );

  const dispatch = useCallback(
    (action: Action) => {
      if (isHost) apply(action);
      else transport.send({ kind: 'intent', from: selfId, action });
    },
    [isHost, apply, transport, selfId],
  );

  const control = useCallback(
    (command: 'play' | 'pause' | 'restart') => {
      if (isHost) controlRef.current?.(command);
      else transport.send({ kind: 'control', from: selfId, command });
    },
    [isHost, transport, selfId],
  );

  /** Host only: publish what the speaker is doing so every phone can show it. */
  const setPlayback = useCallback(
    (snapshot: PlaybackSnapshot) => {
      setPlaybackLocal(snapshot);
      if (isHost) transport.send({ kind: 'playback', from: selfId, playback: snapshot });
    },
    [isHost, transport, selfId],
  );

  useEffect(() => {
    const offStatus = transport.onStatus(setStatus);
    const offPresence = transport.onPresence(setMembers);

    const offMessage = transport.onMessage((message: Envelope) => {
      switch (message.kind) {
        case 'hello':
          // A phone just (re)joined and has no board yet.
          if (isHost) publish(stateRef.current);
          break;

        case 'intent':
          if (!isHost) break;
          // The host stamps the arrival time itself. Guests' clocks are not
          // trustworthy and, more to the point, not comparable to each other —
          // the only fair ordering of a "HITSTER !" race is the one arbiter's.
          apply(
            message.action.type === 'CHALLENGE' ||
              message.action.type === 'COMMIT_PLACEMENT'
              ? { ...message.action, at: Date.now() }
              : message.action,
          );
          break;

        case 'state':
          if (isHost) break;
          // Snapshots can overtake each other; older ones are simply dropped.
          if (message.state.version >= stateRef.current.version) {
            stateRef.current = message.state;
            setState(message.state);
          }
          break;

        case 'playback':
          if (!isHost) setPlaybackLocal(message.playback);
          break;

        case 'control':
          if (isHost) controlRef.current?.(message.command);
          break;
      }
    });

    if (!isHost) transport.send({ kind: 'hello', from: selfId });

    return () => {
      offStatus();
      offPresence();
      offMessage();
    };
  }, [transport, isHost, selfId, apply, publish]);

  // A guest that joined before the host was listening would otherwise sit on an
  // empty board forever, so keep asking until a snapshot lands.
  useEffect(() => {
    if (isHost || state.version > 0) return;
    const timer = setInterval(
      () => transport.send({ kind: 'hello', from: selfId }),
      2500,
    );
    return () => clearInterval(timer);
  }, [isHost, state.version, transport, selfId]);

  return { state, dispatch, control, playback, setPlayback, status, members, isHost };
}
