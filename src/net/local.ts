import { TransportBase, type Envelope, type Transport } from './transport';

/**
 * A transport that never leaves the device.
 *
 * Used for solo play, for the `?dev=1` harness where several simulated players
 * share one screen, and for tests. Messages are delivered asynchronously — a
 * microtask, not synchronously — so that code written against it cannot
 * accidentally depend on the reentrancy that a real network would never give it.
 */
export class LocalTransport extends TransportBase implements Transport {
  constructor(readonly room: string = 'LOCAL') {
    super();
    queueMicrotask(() => {
      this.setStatus('open');
      this.emitPresence([]);
    });
  }

  send(message: Envelope): void {
    queueMicrotask(() => this.emit(message));
  }

  close(): void {
    this.messageHandlers.clear();
    this.presenceHandlers.clear();
    this.statusHandlers.clear();
  }
}
