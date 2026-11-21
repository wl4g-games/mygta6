import { weaponDefinition, type WeaponId } from './WeaponCatalog';
import type { Economy } from '../economy/Economy';

export interface WeaponStock { clip: number; reserve: number; }
export interface EquipmentState { selected: WeaponId | null; weapons: Partial<Record<WeaponId, WeaponStock>>; }

/** Pure equipment state: purchases, magazines, reload timing and fire cadence. */
export class Arsenal {
  state: EquipmentState = { selected: null, weapons: {} };
  private cooldown = 0;
  reloading = 0;
  get selected() { return this.state.selected ? weaponDefinition(this.state.selected)! : null; }
  get stock() { return this.state.selected ? this.state.weapons[this.state.selected] : undefined; }
  grant(id: WeaponId) {
    const definition = weaponDefinition(id)!;
    const stock = this.state.weapons[id];
    if (stock) stock.reserve += definition.magazine * 2;
    else this.state.weapons[id] = { clip: definition.magazine, reserve: definition.magazine * 2 };
  }
  purchase(id: string, economy: Economy) {
    const definition = weaponDefinition(id); if (!definition) return false;
    const price = this.state.weapons[definition.id] ? definition.refill : definition.price;
    if (economy.state.cash < price) return false;
    economy.state.cash -= price; this.grant(definition.id); return true;
  }
  select(id: WeaponId | null) {
    if (id && !this.state.weapons[id]) return false;
    this.state.selected = id; this.reloading = 0; return true;
  }
  reload() {
    const definition = this.selected, stock = this.stock;
    if (!definition || !stock || stock.clip >= definition.magazine || !stock.reserve || this.reloading > 0) return false;
    this.reloading = definition.reload; return true;
  }
  update(dt: number) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading <= 0) return;
    this.reloading = Math.max(0, this.reloading - dt);
    if (!this.reloading && this.selected && this.stock) {
      const amount = Math.min(this.selected.magazine - this.stock.clip, this.stock.reserve);
      this.stock.clip += amount; this.stock.reserve -= amount;
    }
  }
  fire() {
    const definition = this.selected, stock = this.stock;
    if (!definition || !stock || this.cooldown > 0 || this.reloading > 0) return null;
    if (!stock.clip) { this.reload(); return null; }
    stock.clip--; this.cooldown = definition.cooldown; return definition;
  }
  serialize(): EquipmentState { return structuredClone(this.state); }
  restore(state: EquipmentState) { this.state = structuredClone(state); this.cooldown = 0; this.reloading = 0; }
}
