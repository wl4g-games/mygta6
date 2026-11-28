import type { Quality } from './game';

export const DEFAULT_BINDINGS: Readonly<Record<string, string>> = {
  KeyW: 'KeyW', KeyA: 'KeyA', KeyS: 'KeyS', KeyD: 'KeyD', KeyE: 'KeyE', KeyF: 'KeyF',
  KeyV: 'KeyV', KeyI: 'KeyI', KeyM: 'KeyM', KeyP: 'KeyP', KeyQ: 'KeyQ', KeyR: 'KeyR', KeyT: 'KeyT',
};
export interface UserSettings { quality: Quality; volume: number; bindings: Record<string, string>; }
interface SettingsStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }
const STORAGE_KEY = 'openworld-city:settings:v1';

/** Preferences are separate from a world's progress and tolerate unavailable browser storage. */
export class Preferences {
  readonly state: UserSettings = { quality: 'medium', volume: .25, bindings: { ...DEFAULT_BINDINGS } };
  constructor(private readonly storage?: SettingsStorage) {
    try {
      const raw = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null') as Partial<UserSettings> | null;
      if (!raw) return;
      if (['low', 'medium', 'high'].includes(raw.quality ?? '')) this.state.quality = raw.quality!;
      if (typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= 1) this.state.volume = raw.volume;
      const entries = Object.entries(raw.bindings ?? {});
      const candidate = { ...DEFAULT_BINDINGS, ...raw.bindings };
      if (entries.every(([logical, physical]) => logical in DEFAULT_BINDINGS && /^Key[A-Z]$|^Arrow(Up|Down|Left|Right)$/.test(physical))
        && new Set(Object.values(candidate)).size === Object.keys(candidate).length) Object.assign(this.state.bindings, candidate);
    } catch { /* A corrupt preference file must not prevent starting a game. */ }
  }
  quality(value: Quality) { this.state.quality = value; this.persist(); }
  volume(value: number) { this.state.volume = Math.max(0, Math.min(1, value)); this.persist(); }
  bind(logical: string, physical: string) {
    if (!(logical in DEFAULT_BINDINGS) || !/^Key[A-Z]$|^Arrow(Up|Down|Left|Right)$/.test(physical)) return false;
    const previous = this.state.bindings[logical], conflict = Object.keys(this.state.bindings).find(key => key !== logical && this.state.bindings[key] === physical);
    if (conflict) this.state.bindings[conflict] = previous;
    this.state.bindings[logical] = physical; this.persist(); return true;
  }
  resetKeys() { this.state.bindings = { ...DEFAULT_BINDINGS }; this.persist(); }
  private persist() { try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch { /* In-memory preferences still work. */ } }
}

export function resolveKey(code: string, bindings: Readonly<Record<string, string>>): string | null {
  const mapped = Object.entries(bindings).find(([, physical]) => physical === code)?.[0];
  return mapped ?? (code in bindings && bindings[code] !== code ? null : code);
}
export function keyLabel(code: string) { return ({ ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' } as Record<string, string>)[code] ?? code.replace(/^Key/, ''); }
export function browserSettingsStorage(): Storage | undefined { try { return localStorage; } catch { return undefined; } }
