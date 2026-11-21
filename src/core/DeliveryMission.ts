import type { WorldStateStore } from '../world/WorldStateStore';
import type { Economy } from '../economy/Economy';
import type { EventBus } from './EventBus';
import type { StoreLocation } from '../store/StoreArchetype';

/** One repeatable neighborhood job, represented entirely as persistent world deltas. */
export class DeliveryMission {
  constructor(private readonly state: WorldStateStore, private readonly economy: Economy, private readonly events: EventBus) {}
  get active() { return !!this.state.delta.flags['delivery:active']; }
  get complete() { return !!this.state.delta.flags['delivery:complete']; }
  readonly destination = { x: 160, z: -14 };
  accept() {
    if (this.active || this.complete) return false;
    this.state.delta.flags['delivery:active'] = true;
    this.events.emit('toast', '送货任务已接取 · 将社区包裹交给东侧 Sunset Diner 的店员'); return true;
  }
  deliver(store: StoreLocation) {
    if (!this.active || store.id !== '1,0') return false;
    this.state.delta.flags['delivery:active'] = false; this.state.delta.flags['delivery:complete'] = true;
    this.economy.state.cash += 85; this.events.emit('toast', '社区包裹已送达 · 获得 $85'); return true;
  }
}
