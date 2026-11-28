import type { EventBus } from '../core/EventBus';
import type { WorldStateStore } from '../world/WorldStateStore';

export const PRODUCTS = [
  { id: 'water', name: 'Azure mineral water', description: '冷藏山泉水 · 恢复 15 点生命', price: 4, heal: 15, color: '#7bbcc4', stock: 24 },
  { id: 'coffee', name: 'Cold brew coffee', description: '港湾特调冷萃 · 恢复 10 点生命', price: 8, heal: 10, color: '#cda776', stock: 16 },
  { id: 'sandwich', name: 'Garden sandwich', description: '新鲜蔬菜三明治 · 恢复 30 点生命', price: 12, heal: 30, color: '#b1c77b', stock: 12 },
] as const;
export interface EconomyState { cash: number; bank: number; health: number; inventory: Record<string, number>; }
export class Economy {
  state: EconomyState = { cash: 250, bank: 1000, health: 85, inventory: {} };
  constructor(private readonly events: EventBus, private readonly world: WorldStateStore) {}
  private stockKey(id: string, store: string) { return store === '0,0' ? id : `${store}:${id}`; }
  stock(id: string, store = '0,0') { return this.world.delta.stock[this.stockKey(id, store)] ?? PRODUCTS.find(p => p.id === id)?.stock ?? 0; }
  purchase(id: string, store = '0,0'): boolean {
    const product = PRODUCTS.find(p => p.id === id);
    if (!product || this.stock(id, store) <= 0 || this.state.cash < product.price) return false;
    this.state.cash -= product.price;
    this.world.delta.stock[this.stockKey(id, store)] = this.stock(id, store) - 1;
    this.state.inventory[id] = (this.state.inventory[id] ?? 0) + 1;
    this.events.emit('purchase', { product: id, price: product.price });
    return true;
  }
  consume(id: string) {
    const product = PRODUCTS.find(p => p.id === id);
    if (!product || !(this.state.inventory[id] > 0)) return false;
    this.state.inventory[id]--;
    this.state.health = Math.min(100, this.state.health + product.heal);
    this.events.emit('consume', id);
    return true;
  }
  discard(id: string) {
    if (!(this.state.inventory[id] > 0)) return false;
    this.state.inventory[id]--; return true;
  }
  sell(id: string, store = '0,0') {
    const product = PRODUCTS.find(p => p.id === id);
    if (!product || !(this.state.inventory[id] > 0)) return false;
    this.state.inventory[id]--; this.state.cash += Math.floor(product.price / 2);
    this.world.delta.stock[this.stockKey(id, store)] = this.stock(id, store) + 1; return true;
  }
  restore(state: EconomyState) { this.state = structuredClone(state); }
}
