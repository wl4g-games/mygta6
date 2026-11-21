export interface GameEvents {
  toast: string;
  purchase: { product: string; price: number };
  consume: string;
  store: boolean;
  drive: number;
  crime: { severity: number; x: number; z: number };
  policeEntry: { x: number; z: number };
  explosion: { x: number; y: number; z: number; radius: number; damage: number };
  collision: { a: number; b: number };
  saved: void;
  navigate: { x: number; z: number };
  thunder: { distance: number };
}

/** Synchronous typed domain events; listeners never own rendering or physics objects. */
export class EventBus<E extends object = GameEvents> {
  private readonly listeners = new Map<keyof E, Set<(payload: never) => void>>();
  on<K extends keyof E>(type: K, listener: (payload: E[K]) => void): () => void {
    const group = this.listeners.get(type) ?? new Set();
    group.add(listener as (payload: never) => void);
    this.listeners.set(type, group);
    return () => { group.delete(listener as (payload: never) => void); };
  }
  emit<K extends keyof E>(type: K, payload: E[K]) {
    this.listeners.get(type)?.forEach(listener => listener(payload as never));
  }
  clear() { this.listeners.clear(); }
}
