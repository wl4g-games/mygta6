import * as THREE from 'three';
import { chunkAt, chunkKey } from '../config/game';
import { updateSign, type AssetManager } from '../assets/AssetManager';
import type { Physics } from '../physics/Physics';
import type { StreamingManager } from '../world/StreamingManager';
import { createInterior, type StoreInterior } from '../interior/InteriorFactory';
import { storeForChunk, type StoreLocation } from './StoreArchetype';
import { isStoreOpen, hoursLabel } from './StoreSchedule';

export interface StoreAction { label: string; type: 'door' | 'fridge' | 'shelf' | 'checkout' | 'talk' | 'service'; store: StoreLocation; guest?: string; }
export class StoreManager {
  private loaded = new Map<string, { location: StoreLocation; interior: StoreInterior }>();
  current: StoreLocation | null = null;
  action: StoreAction | null = null;
  private time = 12;
  constructor(private readonly scene: THREE.Scene, private readonly assets: AssetManager, private readonly physics: Physics,
    private readonly canEnter: (store: StoreLocation) => boolean = () => true) {}
  update(dt: number, position: THREE.Vector3, streaming: StreamingManager, time = 12) {
    this.time = time;
    const center = chunkAt(position.x, position.z), wanted = new Set<string>();
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const id = chunkKey(center.x + dx, center.z + dz), location = storeForChunk(id);
      if (location.x < -96 || Math.hypot(position.x - location.x, position.z - location.z) > 78 || !streaming.ready(location.x, location.z)) continue;
      wanted.add(id);
      if (!this.loaded.has(id)) { const interior = createInterior(location, this.assets, this.physics); this.scene.add(interior.group); this.loaded.set(id, { location, interior }); }
    }
    for (const [id, entry] of this.loaded) if (!wanted.has(id)) { this.unload(entry.interior, id); this.loaded.delete(id); }
    this.current = null; this.action = null;
    let distance = Infinity;
    for (const { location: s, interior: i } of this.loaded.values()) {
      i.door.rotation.y = THREE.MathUtils.damp(i.door.rotation.y, i.doorOpen ? -Math.PI / 2 : 0, 10, dt);
      i.fridge.update(dt);
      i.merchant.animate(dt, 0);
      const inside = Math.abs(position.x - s.x) < 13.8 && position.z < s.z + 12.85 && position.z > s.z - 12.8;
      const open = isStoreOpen(s.archetype.kind, time);
      i.merchant.group.visible = s.archetype.kind !== 'home' && (open || inside);
      i.policeHold = Math.max(0, i.policeHold - dt);
      for (const guest of i.guests) { guest.model.group.visible = open || inside; if (guest.model.group.visible) guest.model.ride(dt); }
      const status = this.scene.getObjectByName(`storeHours:${s.id}`);
      if (status instanceof THREE.Mesh && !s.archetype.requiredFlag) updateSign(status, `${open ? 'OPEN' : 'CLOSED'} · ${hoursLabel(s.archetype.kind)}`, '#263d40', open ? '#cddd9d' : '#dda28b');
      if (!open && !inside && i.doorOpen && i.policeHold <= 0 && Math.hypot(position.x - s.x, position.z - s.z - 13) > 4) {
        i.doorOpen = false; i.doorCollider = this.physics.box(s.x, 1.5, s.z + 13, 3.6, 3, .15);
      }
      if (inside) this.current = s;
      i.details.visible = inside || Math.hypot(position.x - s.x, position.z - s.z - 13) < 55 && position.z > s.z + 10;
      const targets: { x: number; z: number; label: string; type: StoreAction['type']; guest?: string }[] = [
        { x: s.x, z: s.z + 13, label: !open && !inside ? `CLOSED · 营业 ${hoursLabel(s.archetype.kind)}` : this.canEnter(s) ? `${i.doorOpen ? 'Close' : 'Open'} ${s.archetype.name} · 店门` : 'Locked residence · 请先向房产中介租赁', type: 'door' },
      ];
      if (s.archetype.kind === 'fuel') for (const offset of [-5, 5]) targets.push({ x: s.x + 21, z: s.z + offset, label: 'Fuel pump · 加油与付款', type: 'service' });
      if (['auto', 'carwash'].includes(s.archetype.kind)) targets.push({ x: s.x + 24, z: s.z + 12, label: s.archetype.kind === 'auto' ? 'Repair bay · 维修服务' : 'Car wash bay · 洗车服务', type: 'service' });
      if (inside) targets.push(
        { x: s.x - 9.5, z: s.z - 7 - (i.fridge.open ? 2 : 0), label: i.fridge.open ? 'Close refrigerator · 关闭冰箱' : 'Open refrigerator · 打开冰箱', type: 'fridge' },
        { x: s.x + (s.archetype.servicePoint?.x ?? -5), z: s.z + (s.archetype.servicePoint?.z ?? 4), label: ['market', 'fuel'].includes(s.archetype.kind) ? 'Browse shelf · 查看商品' : 'Browse services · 查看服务', type: 'shelf' },
        { x: s.x + 8.5, z: s.z + 2, label: 'Checkout / service · 收银台', type: 'checkout' },
      );
      if (inside && i.merchant.group.visible) targets.push({ x: s.x + 11.8, z: s.z - 2, label: 'Talk to merchant · 与店员交谈', type: 'talk' });
      if (inside) for (const guest of i.guests) if (guest.model.group.visible) targets.push({ x: guest.model.group.position.x, z: guest.model.group.position.z, label: `Talk to patron · 顾客 ${guest.name}`, type: 'talk', guest: guest.name });
      if (inside && i.fridge.open && ['market', 'fuel'].includes(s.archetype.kind)) targets.push({ x: s.x - 9.5, z: s.z - 7, label: 'Choose chilled groceries · 选择冷藏商品', type: 'shelf' });
      if (inside && s.archetype.kind === 'home') targets.push({ x: s.x - 8, z: s.z - 3, label: 'Sleep & save · 在床边休息存档', type: 'shelf' });
      if (inside && s.archetype.kind === 'auto') targets.push({ x: s.x - 6, z: s.z - 6, label: 'Inspect showroom / buy a vehicle · 查看展车', type: 'checkout' });
      for (const target of targets) {
        const d = Math.hypot(position.x - target.x, position.z - target.z);
        if (d < (target.type === 'door' ? 4.3 : 3.5) && d < distance) { distance = d; this.action = { label: target.label, type: target.type, store: s, guest: target.guest }; }
      }
    }
  }
  toggleDoor(id: string) {
    const entry = this.loaded.get(id);
    if (!entry || !this.canEnter(entry.location) || !isStoreOpen(entry.location.archetype.kind, this.time) && this.current?.id !== id && !entry.interior.doorOpen) return false;
    const { interior: i, location: s } = entry; i.doorOpen = !i.doorOpen;
    if (i.doorOpen && i.doorCollider) { this.physics.remove(i.doorCollider); i.doorCollider = undefined; }
    else i.doorCollider = this.physics.box(s.x, 1.5, s.z + 13, 3.6, 3, .15);
    return true;
  }
  toggleFridge(id: string) { const i = this.loaded.get(id)?.interior; if (i) i.fridge.open = !i.fridge.open; }
  openForPolice(x: number, z: number) {
    for (const { location, interior } of this.loaded.values()) if (Math.abs(x - location.x) < 14 && Math.abs(z - location.z) < 13) {
      interior.policeHold = 3; interior.doorOpen = true;
      if (interior.doorCollider) { this.physics.remove(interior.doorCollider); interior.doorCollider = undefined; }
    }
  }
  scareMerchant(id: string) { const merchant = this.loaded.get(id)?.interior.merchant; if (!merchant?.group.visible) return false; merchant.scare(); return true; }
  private unload(i: StoreInterior, id?: string) { const roof = this.scene.getObjectByName(`storeRoof:${id}`); if (roof) roof.visible = true; for (const collider of i.colliders) this.physics.remove(collider); if (i.doorCollider) this.physics.remove(i.doorCollider); i.fridge.close(); this.assets.disposeGroup(i.group); }
  get count() { return this.loaded.size; }
  close() { for (const [id, { interior }] of this.loaded) this.unload(interior, id); this.loaded.clear(); }
}
