import type { Economy } from '../economy/Economy';
import type { WorldStateStore } from '../world/WorldStateStore';
import type { StoreLocation } from './StoreArchetype';

export interface ServiceEffects {
  vehicleNearby(): boolean; refuel(): void; repair(): void; repaint(): void;
  outfit(): void; haircut(): void; rest(): void; train(): void; cinema(): void; arcade(): void;
}
export interface ServiceResult { ok: boolean; message: string; }
type Effect = (store: StoreLocation) => void;

/** Facilities depend on domain ports rather than renderer, player or vehicle classes. */
export class FacilityServices {
  private readonly effects = new Map<string, Effect>();
  constructor(private readonly economy: Economy, private readonly world: WorldStateStore, ports: ServiceEffects) {
    const heal = (amount: number) => { economy.state.health = Math.min(100, economy.state.health + amount); };
    this.effects.set('restaurant', () => heal(30)); this.effects.set('cafe', () => heal(10)); this.effects.set('bar', () => heal(5));
    this.effects.set('clinic', () => { economy.state.health = 100; });
    this.effects.set('hotel', () => { economy.state.health = 100; ports.rest(); });
    this.effects.set('home', () => { economy.state.health = 100; ports.rest(); });
    this.effects.set('fuel', ports.refuel); this.effects.set('auto', ports.repair); this.effects.set('carwash', ports.repaint);
    this.effects.set('clothing', () => { ports.outfit(); world.delta.flags['appearance:coastal'] = true; });
    this.effects.set('salon', () => { ports.haircut(); world.delta.flags['appearance:haircut'] = true; });
    this.effects.set('bank', () => { economy.state.bank += 100; });
    this.effects.set('gym', () => { heal(20); ports.train(); world.delta.flags['fitness:trained'] = true; });
    this.effects.set('electronics', () => { world.delta.flags['owns:phone'] = true; });
    this.effects.set('bookshop', () => { world.delta.flags['owns:city-guide'] = true; });
    this.effects.set('realty', () => { world.delta.flags['owns:apartment'] = true; });
    this.effects.set('cinema', ports.cinema);
    this.effects.set('arcade', ports.arcade);
    this.nearby = ports.vehicleNearby;
  }
  private readonly nearby: () => boolean;
  purchase(store: StoreLocation): ServiceResult {
    const { kind, price, service } = store.archetype, effect = this.effects.get(kind);
    if (store.archetype.requiredFlag && !this.world.delta.flags[store.archetype.requiredFlag]) return { ok: false, message: '你还没有这间公寓的钥匙。' };
    if (!effect) return { ok: false, message: '此处请使用商品货架和收银台购物。' };
    const unique: Partial<Record<string, string>> = { electronics: 'owns:phone', bookshop: 'owns:city-guide', realty: 'owns:apartment' };
    if (unique[kind] && this.world.delta.flags[unique[kind]!]) return { ok: false, message: '你已拥有这项物品或房屋，无需重复购买。' };
    if (this.economy.state.cash < price) return { ok: false, message: '现金不足，交易未发生。' };
    if (['fuel', 'auto', 'carwash'].includes(kind) && !this.nearby()) return { ok: false, message: '请先将车辆停在店铺附近。' };
    this.economy.state.cash -= price;
    effect(store); this.world.delta.flags[`service:${store.id}:${kind}`] = true;
    return { ok: true, message: `服务完成 · ${service} · -$${price}` };
  }
  withdraw(amount = 100): ServiceResult {
    if (!Number.isInteger(amount) || amount <= 0 || this.economy.state.bank < amount) return { ok: false, message: '银行余额不足，交易未发生。' };
    this.economy.state.bank -= amount; this.economy.state.cash += amount;
    return { ok: true, message: `已取出 $${amount} · 银行余额 $${this.economy.state.bank}` };
  }
}
