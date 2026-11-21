import { PRODUCTS, type Economy } from '../economy/Economy';
import type { Quality } from '../config/game';
import type { StoreLocation } from '../store/StoreArchetype';
import { VEHICLES } from '../vehicle/VehicleCatalog';
import { WEAPONS } from '../combat/WeaponCatalog';
import type { EquipmentState } from '../combat/Arsenal';
import { DEFAULT_BINDINGS, keyLabel, type UserSettings } from '../config/Preferences';
import type { PlaceEntry } from '../city/Places';
import { hoursLabel, isStoreOpen } from '../store/StoreSchedule';
import { ArcadeRound } from '../economy/ArcadeRound';

const icons = {
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  bag: '<path d="M5 7h14l2 14H3L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  car: '<path d="m4 8 2-5h12l2 5 2 3v8h-3v-3H5v3H2v-8l2-3Z"/><path d="M4 8h16M6 12h2m8 0h2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
};
export const icon = (name: keyof typeof icons) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
export interface HUDState {
  cash: number; health: number; time: string; district: string; speed: number; fuel: number; driving: boolean;
  prompt: string; promptKey: string; objective: string; objectiveDetail: string; wanted: number; location: string;
  fps: number; calls: number; triangles: number; chunks: string; pending: number; physics: number; resources: string; ratio: number; vehicleName: string;
  equipment: string; vehicleHealth: number;
}
export interface UICallbacks {
  start: (fresh: boolean) => void; save: () => void;
  quality: (value: Quality) => void; volume: (value: number) => void;
  bindKey: (logical: string, physical: string) => boolean; resetKeys: () => void;
  buy: (id: string) => void; consume: (id: string) => void; discard: (id: string) => void; sell: (id: string) => void;
  service: (store: StoreLocation) => void; withdraw: () => void; close: () => void; resume: () => void;
  vehicle: (store: StoreLocation, id: string) => void;
  weapon: (store: StoreLocation, id: string) => void;
  navigate: (store: StoreLocation) => void;
  ride: () => void;
}

export class UI {
  readonly map: HTMLCanvasElement;
  private menu: HTMLElement;
  private hud: HTMLElement;
  private modal: HTMLElement;
  private toastElement: HTMLElement;
  private toastTimer = 0;
  private callbacks!: UICallbacks;
  private preferences: UserSettings = { quality: 'medium', volume: .25, bindings: { ...DEFAULT_BINDINGS } };
  private cancelCapture?: () => void;
  private paused = true;
  private mode = '';
  private activeStore?: StoreLocation;
  private animation = 0;
  private revisionCount = 0;
  private readonly root: HTMLElement;
  constructor() {
    this.root = document.createElement('div'); this.root.id = 'interface';
    this.root.innerHTML = `
      <div id="loading"><div class="brand-mark">OW<span>·</span></div><span id="load-message">PREPARING YOUR NEIGHBORHOOD</span><div class="loading-line"></div></div>
      <section id="main-menu" class="hidden" aria-label="Main menu">
        <div class="menu-top"><span class="wordmark">OPENWORLD<span> CITY</span></span><span class="build-label">SINGLE PLAYER &nbsp; / &nbsp; DEVELOPMENT BUILD 0.1</span></div>
        <div class="menu-copy"><div class="eyebrow"><span class="line"></span> WELCOME TO PORT AZURE</div><h1>A city.<br>A thousand<br><em>possibilities.</em></h1><p>慢下来，走进街角的小店。<br>或者，发动引擎，看看下一条路通向哪里。</p>
        <div class="menu-actions"><button id="start-game" class="primary" disabled>进入城市 <span>EXPLORE THE CITY</span></button><button id="continue-game" class="secondary hidden">继续游戏 <span>CONTINUE</span></button><button id="menu-settings" class="text-button">设置 / SETTINGS</button></div></div>
        <div class="menu-bottom"><span>${icon('pin')} PORT AZURE &nbsp;  / &nbsp; MARINA QUARTER</span><span>原创开放世界 &nbsp; · &nbsp; 你的城市，你的节奏</span></div>
      </section>
      <main id="hud" class="hidden">
        <div class="hud-top"><div class="game-brand">OW<span> CITY</span><i></i><span id="district">MARINA QUARTER</span></div><div class="top-status"><span id="clock">17:24</span>${icon('sun')}<span id="weather-label">CLEAR</span><span class="divider"></span><span id="cash">$250</span><span id="wanted"></span></div></div>
        <div class="compass"><span>W</span><i></i><span id="bearing">N</span><i></i><span>E</span></div>
        <div class="objective"><div class="eyebrow">NEIGHBORHOOD STORIES</div><h2 id="objective-title">A fresh start</h2><p id="objective-detail">走进 Fresh & Co.，认识你的新街区。</p><div class="objective-foot">自由探索 <span>·</span> 随时出发</div></div>
        <div class="location-toast"><span id="location">MARINA QUARTER</span><small>PORT AZURE</small></div>
        <div class="map-area"><div class="map-head"><span>${icon('pin')} <b id="map-location">Marina Quarter</b></span><kbd>M</kbd></div><canvas id="minimap" width="480" height="330" aria-label="Neighborhood minimap"></canvas><div class="map-footer"><span>N &nbsp; ↑</span><span id="coordinates">32 m · WATERFRONT</span></div><div class="health-row"><span>+</span><div><i id="health-bar"></i></div><b id="health">85</b></div></div>
        <div id="interaction" class="interaction hidden"><kbd id="interaction-key">E</kbd><span id="interaction-label"></span></div>
        <div id="vehicle-hud" class="vehicle-hud hidden"><span id="vehicle-name">MONARCH · COASTLINE</span><div><b id="speed">0</b><small>KM/H</small></div><p>FUEL <i><em id="fuel-bar"></em></i><span id="fuel">100%</span></p><p>CONDITION <span id="vehicle-condition">100%</span></p></div>
        <div id="equipment-hud" class="hidden"></div>
        <nav class="bottom-controls"><span><kbd>W A S D</kbd> 移动</span><span><kbd>SHIFT</kbd> 奔跑</span><span><kbd>F</kbd> 上 / 下车</span><span><kbd>I</kbd> 背包</span><span><kbd>V</kbd> 视角</span><span><kbd>ESC</kbd> 暂停</span><button id="help-button" aria-label="Controls">?</button></nav>
        <div id="performance" class="hidden"></div>
      </main>
      <div id="modal" class="modal hidden" role="dialog" aria-modal="true"></div>
      <div id="toast" class="toast hidden" role="status"></div>
      <div id="crosshair" class="hidden">+</div>
      <div id="streaming-shield" class="hidden"><div class="brand-mark">OW<span>·</span></div><p>ARRIVING IN YOUR NEIGHBORHOOD</p></div>
    `;
    document.getElementById('app')!.append(this.root);
    this.menu = this.el('main-menu'); this.hud = this.el('hud'); this.modal = this.el('modal'); this.toastElement = this.el('toast');
    this.map = this.el('minimap') as HTMLCanvasElement;
  }
  bind(callbacks: UICallbacks, preferences: UserSettings) {
    this.callbacks = callbacks;
    this.preferences = preferences;
    this.el('start-game').onclick = () => callbacks.start(true);
    this.el('continue-game').onclick = () => callbacks.start(false);
    this.el('menu-settings').onclick = () => this.settings();
    this.el('help-button').onclick = () => this.help();
  }
  ready(hasSave: boolean) { this.el('loading').classList.add('hidden'); this.menu.classList.remove('hidden'); (this.el('start-game') as HTMLButtonElement).disabled = false; this.el('continue-game').classList.toggle('hidden', !hasSave); }
  loading(message: string) { this.el('load-message').textContent = message; }
  start() { this.paused = false; this.menu.classList.add('hidden'); this.hud.classList.remove('hidden'); this.close(); }
  get blocked() { return this.paused || !this.modal.classList.contains('hidden'); }
  get modalOpen() { return !this.modal.classList.contains('hidden'); }
  update(state: HUDState) {
    this.el('cash').textContent = `$${state.cash.toLocaleString()}`;
    this.el('health').textContent = String(Math.round(state.health)); this.el('health-bar').style.width = `${state.health}%`;
    this.el('clock').textContent = state.time;
    this.el('district').textContent = state.district.toUpperCase(); this.el('map-location').textContent = state.district;
    this.el('location').textContent = state.location;
    this.el('objective-title').textContent = state.objective; this.el('objective-detail').textContent = state.objectiveDetail;
    this.el('wanted').textContent = state.wanted ? '★'.repeat(state.wanted) : '';
    this.el('equipment-hud').textContent = state.equipment; this.el('equipment-hud').classList.toggle('hidden', !state.equipment || state.driving);
    this.el('crosshair').classList.toggle('hidden', !state.equipment || state.driving || this.blocked);
    this.el('vehicle-hud').classList.toggle('hidden', !state.driving);
    this.el('vehicle-name').textContent = state.vehicleName.toUpperCase();
    this.el('speed').textContent = String(Math.round(state.speed * 3.6));
    this.el('fuel').textContent = `${Math.round(state.fuel)}%`; this.el('fuel-bar').style.width = `${state.fuel}%`;
    this.el('vehicle-condition').textContent = `${Math.round(state.vehicleHealth)}%`; this.el('vehicle-condition').style.color = state.vehicleHealth < 30 ? '#e3a088' : '#c4d2bb';
    this.el('interaction').classList.toggle('hidden', !state.prompt || this.blocked);
    this.el('interaction-label').textContent = state.prompt; this.el('interaction-key').textContent = state.promptKey;
    this.el('performance').textContent = `${state.fps.toFixed(0)} FPS  ·  ${state.ratio.toFixed(2)}×\n${state.calls} calls · ${(state.triangles / 1000).toFixed(0)}k tris\n${state.chunks}\n${state.pending} requests · physics ${state.physics.toFixed(2)} ms\n${state.resources}`;
  }
  toast(message: string) { clearTimeout(this.toastTimer); this.toastElement.textContent = message; this.toastElement.classList.remove('hidden'); this.toastTimer = window.setTimeout(() => this.toastElement.classList.add('hidden'), 3800); }
  private shell(kicker: string, title: string, body: string) {
    this.cancelCapture?.(); this.cancelCapture = undefined;
    this.revisionCount++;
    cancelAnimationFrame(this.animation);
    this.modal.innerHTML = `<section class="panel"><button class="close-button" aria-label="Close">×</button><div class="eyebrow">${kicker}</div><h2>${title}</h2>${body}</section>`;
    this.modal.classList.remove('hidden'); this.modal.querySelector<HTMLButtonElement>('.close-button')!.onclick = () => this.close();
    document.exitPointerLock?.(); this.callbacks?.close();
  }
  shop(store: StoreLocation, economy: Economy, checkout: boolean, basket: string[], ownedVehicles: readonly string[] = ['coastline'], equipment?: EquipmentState, servicesOnly = false) {
    this.mode = 'shop'; this.activeStore = store;
    const market = !servicesOnly && ['market', 'fuel'].includes(store.archetype.kind);
    const rows = PRODUCTS.map(p => `<article class="product"><div class="product-art" style="--product:${p.color}"><span class="${p.id === 'sandwich' ? 'sandwich' : 'bottle'}"></span></div><div><h3>${p.name}</h3><p>${p.description}</p><small>库存 ${economy.stock(p.id, store.id)} ${basket.includes(p.id) ? ' · 已选' : ''}</small></div><div class="product-buy"><b>$${p.price.toFixed(2)}</b><button data-product="${p.id}" ${economy.stock(p.id, store.id) <= 0 ? 'disabled' : ''}>${checkout ? '购买' : '放入购物篮'}</button></div></article>`).join('');
    const serviceCard = `<div class="service-card">${icon('bag')}<h3>${store.archetype.service}</h3><p>${store.archetype.kind === 'bank' ? `银行余额 $${economy.state.bank}` : '店内服务 · 即时结算'}</p><button id="service" class="primary">$${store.archetype.price} · 确认消费</button>${store.archetype.kind === 'bank' ? '<button id="withdraw">取出 $100</button>' : ''}</div>`;
    this.shell(store.archetype.subtitle, store.archetype.name, `<p class="panel-intro">${market ? checkout ? '收银台 · 购买后商品会放入背包。' : '在真实货架选货，然后走到右侧收银台付款。' : '查看店内服务，选择需要的消费项目。'}<span class="wallet">钱包 $${economy.state.cash}</span></p>${market ? rows : ''}${!market || store.archetype.kind === 'fuel' ? serviceCard : ''}<div class="panel-note">${market && !checkout ? '购物篮不会扣款。到收银台完成交易。' : '所有交易自动保存到本地进度。'}</div>`);
    this.modal.querySelectorAll<HTMLButtonElement>('[data-product]').forEach(button => button.onclick = () => this.callbacks.buy(button.dataset.product!));
    this.modal.querySelector<HTMLButtonElement>('#service')?.addEventListener('click', () => this.callbacks.service(store));
    this.modal.querySelector<HTMLButtonElement>('#withdraw')?.addEventListener('click', () => this.callbacks.withdraw());
    if (store.archetype.kind === 'auto' && !servicesOnly) {
      const catalog = document.createElement('div'); catalog.className = 'vehicle-catalog';
      for (const vehicle of VEHICLES) {
        const card = document.createElement('article'); card.className = 'vehicle-offer';
        card.innerHTML = `${icon('car')}<h3>${vehicle.name}</h3><p>${vehicle.kind.toUpperCase()} · ${Math.round(vehicle.maxSpeed * 3.6)} KM/H</p><button data-vehicle="${vehicle.id}">${ownedVehicles.includes(vehicle.id) ? '从车库提取' : `购买 $${vehicle.price}`}</button>`;
        card.querySelector('button')!.onclick = () => this.callbacks.vehicle(store, vehicle.id); catalog.append(card);
      }
      this.modal.querySelector('.service-card')!.after(catalog);
    }
    if (store.archetype.kind === 'weapons') {
      const catalog = document.createElement('div'); catalog.className = 'vehicle-catalog';
      for (const weapon of WEAPONS) {
        const owned = !!equipment?.weapons[weapon.id], card = document.createElement('article'); card.className = 'vehicle-offer';
        card.innerHTML = `<h3>${weapon.name}</h3><p>${weapon.explosive ? '发射器' : weapon.automatic ? '自动步枪' : weapon.id === 'marksman' ? '精确步枪' : '白色枪身手枪'} · 弹匣 ${weapon.magazine}</p><button data-weapon="${weapon.id}">${owned ? `补充弹药 $${weapon.refill}` : `购买 $${weapon.price}`}</button>`;
        card.querySelector('button')!.onclick = () => this.callbacks.weapon(store, weapon.id); catalog.append(card);
      }
      this.modal.querySelector('.service-card')!.replaceWith(catalog);
    }
  }
  refreshShop(economy: Economy, checkout: boolean, basket: string[]) { if (this.mode === 'shop' && this.activeStore && this.modalOpen) this.shop(this.activeStore, economy, checkout, basket); }
  inventory(economy: Economy, canSell = false, unlocks: string[] = []) {
    this.mode = 'inventory';
    const items = PRODUCTS.filter(p => (economy.state.inventory[p.id] ?? 0) > 0);
    this.shell('YOUR EVERYDAY ESSENTIALS', '随身背包', `<p class="panel-intro">生命 ${Math.round(economy.state.health)} / 100 <span class="wallet">$${economy.state.cash}</span></p>${items.length ? items.map(p => `<article class="inventory-row"><div><h3>${p.name} <small>× ${economy.state.inventory[p.id]}</small></h3><p>${p.description}</p></div><button data-use="${p.id}">使用</button>${canSell ? `<button data-sell="${p.id}">出售 $${Math.floor(p.price / 2)}</button>` : ''}<button class="subtle" data-discard="${p.id}">丢弃</button></article>`).join('') : '<div class="empty-state">背包空空的。<br><span>在街角便利店买点旅途补给吧。</span></div>'}${unlocks.length ? `<p class="panel-intro">已拥有 · ${unlocks.join(' · ')}</p>` : ''}<p class="panel-note">在便利店内打开背包，可将商品以半价卖回。房屋与电子商品解锁随存档保存。</p>`);
    this.modal.querySelectorAll<HTMLButtonElement>('[data-use]').forEach(button => button.onclick = () => this.callbacks.consume(button.dataset.use!));
    this.modal.querySelectorAll<HTMLButtonElement>('[data-discard]').forEach(button => button.onclick = () => this.callbacks.discard(button.dataset.discard!));
    this.modal.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach(button => button.onclick = () => this.callbacks.sell(button.dataset.sell!));
  }
  pause() {
    this.mode = 'pause';
    this.shell('TAKE A BREATHER', '城市会等你。', '<div class="pause-actions"><button id="resume" class="primary">继续探索</button><button id="save-now">保存进度</button><button id="settings">画质与声音</button><button id="controls">操作说明</button></div><p class="panel-note">游戏已暂停 · F5 快速保存 · F3 性能面板</p>');
    this.el('resume').onclick = () => this.close(); this.el('save-now').onclick = () => this.callbacks.save();
    this.el('settings').onclick = () => this.settings(); this.el('controls').onclick = () => this.help();
  }
  settings() {
    this.mode = 'settings';
    const controls = [['KeyW', '前进'], ['KeyA', '向左'], ['KeyS', '后退'], ['KeyD', '向右'], ['KeyE', '交互'], ['KeyF', '上下车'], ['KeyV', '视角'], ['KeyI', '背包'], ['KeyM', '地图'], ['KeyP', '手机'], ['KeyQ', '攻击'], ['KeyR', '抢劫事件'], ['KeyT', '换弹']];
    this.shell('MAKE IT YOURS', '设置', `<label class="setting">画质<select id="quality"><option value="low">低 · 性能优先</option><option value="medium">中 · 平衡</option><option value="high">高 · 更远可见距离</option></select></label><label class="setting">音量<input id="volume" type="range" min="0" max="1" step=".05" value="${this.preferences.volume}" /></label><h3>键位</h3><div class="controls-grid">${controls.map(([logical, label]) => `<div><span>${label}</span><button data-binding="${logical}">${keyLabel(this.preferences.bindings[logical])}</button></div>`).join('')}</div><button id="reset-keys">恢复默认键位</button><p class="panel-note">点击键位后按字母键或方向键；Esc 取消。画质、声音与键位会自动记住。分辨率根据帧率调整。</p>`);
    (this.el('quality') as HTMLSelectElement).value = this.preferences.quality;
    this.el('quality').onchange = e => this.callbacks.quality((e.target as HTMLSelectElement).value as Quality);
    this.el('volume').oninput = e => this.callbacks.volume(Number((e.target as HTMLInputElement).value));
    this.el('reset-keys').onclick = () => { this.callbacks.resetKeys(); this.settings(); };
    this.modal.querySelectorAll<HTMLButtonElement>('[data-binding]').forEach(button => button.onclick = () => {
      this.cancelCapture?.(); button.textContent = '按下新按键…';
      const capture = (event: KeyboardEvent) => {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.code === 'Escape' || this.callbacks.bindKey(button.dataset.binding!, event.code)) { this.cancelCapture?.(); this.settings(); }
      };
      window.addEventListener('keydown', capture, true); this.cancelCapture = () => window.removeEventListener('keydown', capture, true);
    });
  }
  help() {
    this.mode = 'help';
    this.shell('FIND YOUR OWN WAY', '操作指南', `<div class="controls-grid">${[['W A S D','步行 / 驾驶'],['鼠标右键拖动','环绕视角'],['L','锁定鼠标视角'],['SHIFT','冲刺'],['SPACE','跳跃 / 手刹'],['CTRL / C','蹲下'],['E','门 / 商品 / NPC'],['F','上车 / 下车'],['V','第一 / 第三人称'],['I / TAB','背包'],['M','城市地图 / 导航'],['R','游戏化抢劫'],['Q / 鼠标左键','徒手 / 装备攻击'],['1 / 2 / 3 / 4 / 5','切换装备'],['T','换弹'],['P / G','手机 / 指南'],['H','喇叭'],['F5 / F3','存档 / 性能面板']].map(([key, label]) => `<div><kbd>${key.split(' ').map(part => /^[A-Z]$/.test(part) ? keyLabel(this.preferences.bindings[`Key${part}`] ?? part) : part).join(' ')}</kbd><span>${label}</span></div>`).join('')}</div><p class="panel-note">靠近车门按 F；店铺门前按 E 打开后，用 WASD 实际走进去。货架选货后，到收银台付款。蓝色标记是商铺。</p>`);
  }
  dialogue(title: string, message: string, actions?: { label: string; action: () => void }[]) {
    this.mode = 'dialogue'; this.shell('PEOPLE OF PORT AZURE', title, `<p class="dialogue-text">${message}</p><div id="dialogue-actions" class="pause-actions"></div>`);
    for (const action of actions ?? []) { const button = document.createElement('button'); button.textContent = action.label; button.onclick = action.action; this.el('dialogue-actions').append(button); }
  }
  directory(places: PlaceEntry[], title: string, profile: string, ride?: { active: boolean }, time = 12) {
    this.mode = 'directory'; this.shell('PORT AZURE / CITY LIFE', title, `<p class="panel-intro">${profile}</p>${ride ? `<button id="taxi-job" class="primary">${ride.active ? '取消当前接送' : '接取社区接送 · 实际驾驶获得报酬'}</button>` : ''}<p class="panel-note">选择目的地设置 GPS。沿街商铺可实际推门进入；私人住宅需要钥匙。</p><div class="vehicle-catalog" id="places"></div>`);
    this.modal.querySelector<HTMLButtonElement>('#taxi-job')?.addEventListener('click', () => this.callbacks.ride());
    for (const { store, distance } of places) {
      const card = document.createElement('article'); card.className = 'vehicle-offer';
      card.innerHTML = `<h3>${store.archetype.name}</h3><p>${store.archetype.subtitle}</p><p>${Math.round(distance)} m · ${store.archetype.requiredFlag ? 'PRIVATE / KEY' : `${isStoreOpen(store.archetype.kind, time) ? 'OPEN' : 'CLOSED'} · ${hoursLabel(store.archetype.kind)}`}</p><button data-destination="${store.archetype.kind}">GPS 导航</button>`;
      card.querySelector('button')!.onclick = () => this.callbacks.navigate(store); this.el('places').append(card);
    }
  }
  openMap(draw: (canvas: HTMLCanvasElement) => void, controls?: { fit(canvas: HTMLCanvasElement): void; follow(canvas: HTMLCanvasElement): void }) {
    this.mode = 'map'; this.shell('EXPLORE PORT AZURE', '城市地图', '<p class="panel-intro">滚轮缩放 · 点击设置 GPS 目的地 · 青色为可进入商铺</p><div class="map-tools"><button id="fit-world">整个 16 × 16 km 世界</button><button id="follow-player">回到当前位置</button></div><canvas id="full-map" width="900" height="600"></canvas><p class="panel-note">市中心 · 海湾 · 商业区 · 住宅区 · 逻辑世界 16 × 16 km</p>');
    const canvas = this.el('full-map') as HTMLCanvasElement; draw(canvas);
    this.el('fit-world').onclick = () => controls?.fit(canvas); this.el('follow-player').onclick = () => controls?.follow(canvas);
  }
  screening() {
    this.shell('AN ORIGINAL PORT AZURE SHORT', 'Harbor, at dusk', '<canvas id="screening" width="600" height="300" style="width:100%;border-radius:4px"></canvas><p class="panel-note">原创城市短片 · 海湾的十秒钟 · 随时关闭回到影院</p>');
    const canvas = this.el('screening') as HTMLCanvasElement, ctx = canvas.getContext('2d')!, started = performance.now();
    const frame = () => {
      const t = (performance.now() - started) / 1000;
      const sky = ctx.createLinearGradient(0, 0, 0, 300); sky.addColorStop(0, '#264e64'); sky.addColorStop(.65, '#e5b17c'); sky.addColorStop(1, '#b7c5b0');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, 600, 300); ctx.fillStyle = '#eed4a1'; ctx.beginPath(); ctx.arc(430, 110 + t, 24, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 18; i++) { const h = 35 + Math.sin(i * 13) ** 2 * 110; ctx.fillStyle = i % 2 ? '#33535b' : '#456469'; ctx.fillRect(i * 36 - t * 3, 215 - h, 31, h); }
      ctx.fillStyle = '#376b7a'; ctx.fillRect(0, 215, 600, 85);
      ctx.strokeStyle = '#b6c2ad88'; ctx.lineWidth = 1;
      for (let y = 225; y < 300; y += 12) { ctx.beginPath(); for (let x = 0; x < 610; x += 10) ctx.lineTo(x, y + Math.sin(x * .06 + t) * 2); ctx.stroke(); }
      const boat = 80 + t * 15; ctx.fillStyle = '#e1d1af'; ctx.fillRect(boat, 235, 54, 8); ctx.fillRect(boat + 15, 225, 20, 10);
      ctx.fillStyle = '#f6e4c7'; ctx.font = '14px system-ui'; ctx.fillText('PORT AZURE / SIDE STREETS', 25, 33);
      ctx.fillStyle = '#edd4a4'; ctx.fillRect(0, 297, Math.min(600, t * 60), 3);
      if (t < 10) this.animation = requestAnimationFrame(frame);
    }; frame();
  }
  arcade(reward: (amount: number) => void) {
    this.mode = 'arcade';
    this.shell('AN ORIGINAL PORT AZURE GAME', 'Harbor Lights', '<p class="panel-intro">点击发光的圆点。20 秒内命中 8 次奖励 $12，16 次奖励 $25。</p><canvas id="arcade-game" width="640" height="320" style="width:100%;border-radius:4px"></canvas><p id="arcade-score" class="panel-intro"></p><p class="panel-note">随时关闭退出本局。入场费用 $5，奖励随完成结算。</p>');
    const canvas = this.el('arcade-game') as HTMLCanvasElement, context = canvas.getContext('2d')!, round = new ArcadeRound(); let last = performance.now();
    canvas.onclick = event => { const rect = canvas.getBoundingClientRect(); round.hit((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height); };
    const frame = () => {
      const now = performance.now(); round.update(Math.min(.1, (now - last) / 1000)); last = now;
      context.fillStyle = '#16353e'; context.fillRect(0, 0, 640, 320);
      context.strokeStyle = '#41646b'; context.lineWidth = 1;
      for (let x = 0; x < 640; x += 32) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 320); context.stroke(); }
      for (let y = 0; y < 320; y += 32) { context.beginPath(); context.moveTo(0, y); context.lineTo(640, y); context.stroke(); }
      if (round.remaining > 0) {
        context.fillStyle = '#e5bf77'; context.shadowColor = '#e5bf77'; context.shadowBlur = 24;
        context.beginPath(); context.ellipse(round.target.x * 640, round.target.y * 320, 36, 18, 0, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0;
        this.el('arcade-score').textContent = `命中 ${round.score} · 剩余 ${Math.ceil(round.remaining)} 秒`; this.animation = requestAnimationFrame(frame);
      } else { const amount = round.claimReward(); this.el('arcade-score').textContent = `本局完成 · 命中 ${round.score} · 奖励 $${amount}`; reward(amount); }
    }; frame();
  }
  close() {
    this.cancelCapture?.(); this.cancelCapture = undefined; this.revisionCount++; cancelAnimationFrame(this.animation);
    if (document.activeElement instanceof HTMLElement && this.modal.contains(document.activeElement)) document.activeElement.blur();
    this.modal.classList.add('hidden'); this.mode = ''; this.callbacks?.resume();
  }
  get revision() { return this.revisionCount; }
  vehicleBusy(busy: boolean) { this.modal.querySelectorAll<HTMLButtonElement>('[data-vehicle], #service').forEach(button => { button.disabled = busy; }); }
  togglePerformance() { this.el('performance').classList.toggle('hidden'); }
  setWeather(value: string) { this.el('weather-label').textContent = value; }
  setStreaming(waiting: boolean) { this.el('streaming-shield').classList.toggle('hidden', !waiting); }
  dispose() { this.cancelCapture?.(); cancelAnimationFrame(this.animation); clearTimeout(this.toastTimer); this.root.remove(); }
  private el(id: string) { return this.root.querySelector<HTMLElement>(`#${id}`)!; }
}
