import type { EconomyState } from '../economy/Economy';
import type { WorldDelta } from '../world/WorldStateStore';
import type { SandboxState } from '../core/Sandbox';
import { WORLD } from '../config/game';
import { weaponDefinition } from '../combat/WeaponCatalog';
import type { WeatherType } from '../render/Weather';
export interface GameSave {
  version: 4; seed: number; savedAt: number;
  player: { x: number; y: number; z: number; yaw: number };
  vehicle: { x: number; y: number; z: number; yaw: number; fuel: number; health: number; definitionId?: string; color?: string };
  economy: EconomyState; world: WorldDelta; time: number; mission: number; driving: boolean;
  sandbox: SandboxState;
  weather?: WeatherType;
}

export function migrateSave(raw: unknown): GameSave {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid save');
  const data = structuredClone(raw) as Record<string, unknown>;
  if (data.version === 1) { data.version = 2; data.driving = false; data.mission ??= 0; }
  if (data.version === 2) { data.version = 3; data.sandbox = { wanted: 0, searchTime: 0, ammo: 24, equipped: false }; }
  if (data.version === 3) {
    const old = data.sandbox as { wanted: number; searchTime: number; ammo: number; equipped: boolean };
    if (!old || !Number.isInteger(old.ammo) || old.ammo < 0 || typeof old.equipped !== 'boolean') throw new Error('Damaged save data');
    const flags = (data.world as WorldDelta)?.flags;
    data.version = 4; data.sandbox = { wanted: old.wanted, searchTime: old.searchTime, equipment: { selected: old.equipped ? 'sidearm' : null,
      weapons: old.equipped || flags?.['owns:pulse'] ? { sidearm: { clip: Math.min(12, old.ammo), reserve: Math.max(0, old.ammo - 12) } } : {} } };
  }
  if (data.version !== 4) throw new Error('Unsupported save version');
  const save = data as unknown as GameSave;
  const vectorValid = (v: unknown): boolean => {
    if (!v || typeof v !== 'object' || !['x', 'y', 'z', 'yaw'].every(k => Number.isFinite((v as Record<string, unknown>)[k]))) return false;
    const p = v as { x: number; y: number; z: number };
    return Math.abs(p.x) <= WORLD.halfExtent + 128 && Math.abs(p.z) <= WORLD.halfExtent + 128 && p.y > -50 && p.y < 10000;
  };
  if (!vectorValid(save.player) || !vectorValid(save.vehicle) || !Number.isFinite(save.seed) || !Number.isFinite(save.time)
    || !Number.isFinite(save.economy?.cash) || save.economy.cash < 0 || !Number.isFinite(save.economy.health)
    || save.weather !== undefined && !['clear', 'cloudy', 'rain', 'fog', 'storm'].includes(save.weather)
    || !save.economy.inventory || !save.world?.stock || !save.world.flags || !Number.isFinite(save.vehicle.fuel)
    || !Number.isFinite(save.vehicle.health) || save.vehicle.health < 0 || save.vehicle.health > 100 || !Number.isInteger(save.mission) || save.mission < 0 || save.mission > 4
    || !Number.isFinite(save.economy.bank) || save.economy.bank < 0 || save.economy.health < 0 || save.economy.health > 100
    || Object.values(save.economy.inventory).some(n => !Number.isInteger(n) || n < 0)
    || Object.values(save.world.stock).some(n => !Number.isInteger(n) || n < 0)
    || save.world.waypoint && (!Number.isFinite(save.world.waypoint.x) || !Number.isFinite(save.world.waypoint.z) || Math.abs(save.world.waypoint.x) > WORLD.halfExtent || Math.abs(save.world.waypoint.z) > WORLD.halfExtent)
    || save.world.taxi && (!['idle', 'pickup', 'boarding', 'riding'].includes(save.world.taxi.stage) || !Number.isInteger(save.world.taxi.completed) || save.world.taxi.completed < 0
      || !Number.isFinite(save.world.taxi.meters) || save.world.taxi.meters < 0 || [save.world.taxi.pickup, save.world.taxi.destination].some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.z)
        || Math.abs(point.x) > WORLD.halfExtent || Math.abs(point.z) > WORLD.halfExtent))
    || typeof save.driving !== 'boolean' || save.vehicle.fuel < 0 || save.vehicle.fuel > 100
    || save.vehicle.color !== undefined && !/^#[\da-fA-F]{6}$/.test(save.vehicle.color)
    || save.vehicle.definitionId !== undefined && typeof save.vehicle.definitionId !== 'string'
    || !Number.isInteger(save.sandbox?.wanted) || save.sandbox.wanted < 0 || save.sandbox.wanted > 5
    || !save.sandbox.equipment || typeof save.sandbox.equipment.weapons !== 'object' || !save.sandbox.equipment.weapons
    || Object.entries(save.sandbox.equipment.weapons).some(([id, stock]) => !weaponDefinition(id) || !stock || !Number.isInteger(stock.clip) || stock.clip < 0
      || stock.clip > weaponDefinition(id)!.magazine || !Number.isInteger(stock.reserve) || stock.reserve < 0)
    || save.sandbox.equipment.selected !== null && (!weaponDefinition(save.sandbox.equipment.selected) || !save.sandbox.equipment.weapons[save.sandbox.equipment.selected])
    || !Number.isFinite(save.sandbox.searchTime) || save.sandbox.searchTime < 0
    || save.world.garage && Object.values(save.world.garage).some(car => !Number.isFinite(car.fuel) || car.fuel < 0 || car.fuel > 100
      || !Number.isFinite(car.health) || car.health < 0 || car.health > 100 || typeof car.definitionId !== 'string' || typeof car.color !== 'string')) throw new Error('Damaged save data');
  return save;
}

export class SaveGame {
  private db?: IDBDatabase;
  private closed = false;
  async init() {
    if (this.closed) return;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('openworld-city', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('saves');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (this.closed) db.close(); else this.db = db;
  }
  async save(state: GameSave) {
    if (this.closed || !this.db) throw new Error('Save database unavailable');
    const validated = migrateSave(state);
    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(validated, 'slot-1');
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }
  async load(): Promise<GameSave | null> {
    if (this.closed || !this.db) throw new Error('Save database unavailable');
    const raw = await new Promise<unknown>((resolve, reject) => {
      const request = this.db!.transaction('saves').objectStore('saves').get('slot-1');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    return raw ? migrateSave(raw) : null;
  }
  close() { this.closed = true; this.db?.close(); this.db = undefined; }
}
