import { describe, expect, it, vi } from 'vitest';
import { SaveGame, migrateSave, type GameSave } from '../src/persistence/SaveGame';
const fixture = (): GameSave => ({ version: 4, seed: 42, savedAt: 100, player: { x: 0, y: 1, z: 0, yaw: 0 },
  vehicle: { x: 0, y: 1, z: 0, yaw: 0, health: 90, fuel: 80 }, economy: { cash: 250, bank: 1000, health: 85, inventory: { water: 1 } },
  world: { stock: { water: 23 }, flags: { test: true } }, time: 17, mission: 2, driving: false, sandbox: { wanted: 2, searchTime: 5, equipment: { selected: 'sidearm', weapons: { sidearm: { clip: 12, reserve: 6 } } } } });
describe('versioned delta persistence', () => {
  it('roundtrips state without serializing rendering objects', () => {
    const save = fixture(); expect(migrateSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
    expect(JSON.stringify(save).length).toBeLessThan(1200);
  });
  it('migrates v1 without mutating the source', () => {
    const old = { ...fixture(), version: 1, driving: undefined, mission: undefined };
    const next = migrateSave(old); expect(next.version).toBe(4); expect(next.driving).toBe(false); expect(next.mission).toBe(0); expect(next.sandbox.wanted).toBe(0);
    expect(old.version).toBe(1);
  });
  it('rejects future versions and non-finite player state', () => {
    expect(() => migrateSave({ ...fixture(), version: 99 })).toThrow('version');
    const save = fixture(); save.player.x = Number.NaN; expect(() => migrateSave(save)).toThrow('Damaged');
    expect(() => migrateSave(null)).toThrow('Invalid');
  });
  it('does not alias the loaded inventory', () => { const save = fixture(), loaded = migrateSave(save); loaded.economy.inventory.water = 0; expect(save.economy.inventory.water).toBe(1); });
  it('migrates v2 and rejects unsafe world coordinates', () => {
    const previous = { ...fixture(), version: 2, sandbox: undefined }; expect(migrateSave(previous).sandbox.equipment.selected).toBeNull();
    const damaged = fixture(); damaged.player.x = 1e30; expect(() => migrateSave(damaged)).toThrow('Damaged');
  });
  it('migrates a v3 pulse tool into a sidearm without creating extra ammunition', () => {
    const previous = { ...fixture(), version: 3, sandbox: { wanted: 2, searchTime: 7, ammo: 18, equipped: true } };
    const next = migrateSave(previous);
    expect(next.sandbox.equipment).toEqual({ selected: 'sidearm', weapons: { sidearm: { clip: 12, reserve: 6 } } });
    expect(previous.sandbox.ammo).toBe(18);
  });
  it('closes a database that finishes opening after shutdown', async () => {
    const db = { close: vi.fn() }, request = { result: db, onsuccess: undefined as (() => void) | undefined, onerror: undefined, onupgradeneeded: undefined };
    vi.stubGlobal('indexedDB', { open: () => request });
    try {
      const saves = new SaveGame(), opening = saves.init(); saves.close(); request.onsuccess!(); await opening;
      expect(db.close).toHaveBeenCalledOnce(); await expect(saves.load()).rejects.toThrow('unavailable');
    } finally { vi.unstubAllGlobals(); }
  });
});
