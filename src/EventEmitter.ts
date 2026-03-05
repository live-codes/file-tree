export class EventEmitter<TEvents extends Record<string, unknown>> {
  private listeners = new Map<keyof TEvents, Set<(payload: never) => void>>();

  on<K extends keyof TEvents>(
    event: K,
    handler: (payload: TEvents[K]) => void,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as (payload: never) => void);
  }

  off<K extends keyof TEvents>(
    event: K,
    handler: (payload: TEvents[K]) => void,
  ): void {
    this.listeners.get(event)?.delete(handler as (payload: never) => void);
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        (handler as (payload: TEvents[K]) => void)(payload);
      } catch (err) {
        console.error(`[file-tree] Error in "${String(event)}" handler:`, err);
      }
    });
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
