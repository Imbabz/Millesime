import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from '@/config';
import { TransportBase, type Envelope, type Transport } from './transport';

/**
 * Realtime rooms over Supabase.
 *
 * Deliberately database-free: only Broadcast (messages) and Presence (who is
 * connected) are used, so there is no schema to create, no row-level security
 * to reason about and nothing to migrate. Creating the Supabase project is the
 * entire setup, which is the point — it has to be doable from a phone.
 *
 * The room code is the only secret. That is the right trade for a game played
 * by people sitting in the same room; there is nothing here worth attacking.
 */
export class SupabaseTransport extends TransportBase implements Transport {
  private client: SupabaseClient;
  private channel: RealtimeChannel;

  constructor(
    readonly room: string,
    private readonly selfId: string,
    config: AppConfig,
  ) {
    super();
    this.setStatus('connecting');

    this.client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });

    this.channel = this.client.channel(`room:${room}`, {
      config: {
        // The sender applies its own messages directly, so echoing them back
        // would only risk double-applying an action.
        broadcast: { self: false },
        presence: { key: selfId },
      },
    });

    this.channel
      .on('broadcast', { event: 'msg' }, ({ payload }) => {
        this.emit(payload as Envelope);
      })
      .on('presence', { event: 'sync' }, () => {
        this.emitPresence(Object.keys(this.channel.presenceState()));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.setStatus('open');
          void this.channel.track({ id: this.selfId, at: Date.now() });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.setStatus('error');
        } else if (status === 'CLOSED') {
          this.setStatus('idle');
        }
      });
  }

  send(message: Envelope): void {
    // Fire-and-forget by contract: a dropped frame is recovered by the next
    // state snapshot rather than by a retry, which keeps ordering simple.
    void this.channel.send({ type: 'broadcast', event: 'msg', payload: message });
  }

  close(): void {
    void this.channel.unsubscribe();
    void this.client.removeAllChannels();
    this.messageHandlers.clear();
    this.presenceHandlers.clear();
    this.statusHandlers.clear();
  }
}
