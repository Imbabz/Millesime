import type { Action } from '@/game/engine';
import type { GameState } from '@/game/types';

/**
 * The wire between phones.
 *
 * Two implementations sit behind this interface: `LocalTransport`, which loops
 * messages back to the same device (solo play, the dev harness and every test),
 * and `SupabaseTransport`, which relays them through a hosted realtime channel.
 * Keeping the game logic behind an interface is what makes the whole thing
 * playable, and testable, without any network at all.
 */

/** What the host publishes about the music, so every phone can show it. */
export type PlaybackSnapshot = {
  playing: boolean;
  /** Position in the track, in milliseconds, at `atEpochMs`. */
  positionMs: number;
  durationMs: number;
  /** Host clock reading when this snapshot was taken, for interpolation. */
  atEpochMs: number;
  deviceName: string | null;
  error: string | null;
};

export type Envelope =
  /** Guest → host: "I am here, send me the board." */
  | { kind: 'hello'; from: string }
  /** Host → everyone: the authoritative board. */
  | { kind: 'state'; from: string; state: GameState }
  /** Guest → host: "I would like to do this." The host decides. */
  | { kind: 'intent'; from: string; action: Action }
  /** Host → everyone: what the speaker is doing. */
  | { kind: 'playback'; from: string; playback: PlaybackSnapshot }
  /** Anyone → host: play, pause or restart. Routed through the host's Spotify. */
  | { kind: 'control'; from: string; command: 'play' | 'pause' | 'restart' };

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'error';

export interface Transport {
  readonly room: string;
  /** Fire-and-forget; delivery is not guaranteed and callers must tolerate loss. */
  send(message: Envelope): void;
  onMessage(handler: (message: Envelope) => void): () => void;
  onPresence(handler: (memberIds: string[]) => void): () => void;
  onStatus(handler: (status: ConnectionStatus) => void): () => void;
  close(): void;
}

/** Shared plumbing: handler registration, so both transports stay small. */
export class TransportBase {
  protected messageHandlers = new Set<(m: Envelope) => void>();
  protected presenceHandlers = new Set<(ids: string[]) => void>();
  protected statusHandlers = new Set<(s: ConnectionStatus) => void>();
  protected status: ConnectionStatus = 'idle';

  onMessage(handler: (m: Envelope) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onPresence(handler: (ids: string[]) => void): () => void {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }

  onStatus(handler: (s: ConnectionStatus) => void): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }

  protected emit(message: Envelope): void {
    for (const handler of this.messageHandlers) handler(message);
  }

  protected emitPresence(ids: string[]): void {
    for (const handler of this.presenceHandlers) handler(ids);
  }

  protected setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const handler of this.statusHandlers) handler(status);
  }
}
