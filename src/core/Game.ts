import * as THREE from 'three';
import { WORLD, QUALITY, type Quality, chunkAt } from '../config/game';
import { EventBus } from './EventBus';
import { Input } from './Input';
import { Renderer } from '../render/Renderer';
import { Weather } from '../render/Weather';
import { AssetManager } from '../assets/AssetManager';
import { Physics } from '../physics/Physics';
import { StreamingManager } from '../world/StreamingManager';
import { WorldStateStore } from '../world/WorldStateStore';
import { Player } from '../character/Player';
import { Vehicle } from '../vehicle/Vehicle';
import { StoreManager } from '../store/StoreManager';
import type { StoreLocation } from '../store/StoreArchetype';
import { CityLife } from '../npc/CityLife';
import { Economy } from '../economy/Economy';
import { SaveGame, type GameSave } from '../persistence/SaveGame';
import { UI } from '../ui/UI';
import { CityMap } from '../ui/CityMap';
import { CityAudio } from '../audio/CityAudio';
import { Sandbox } from './Sandbox';
import { generateChunk } from '../world/ProceduralGenerator';
import { DeliveryMission } from './DeliveryMission';
import { FacilityServices } from '../store/FacilityServices';
import { VehicleShop } from '../vehicle/VehicleShop';
import { VEHICLES } from '../vehicle/VehicleCatalog';
import { vehicleMetrics } from '../vehicle/VehicleVisual';
import { CityLighting } from '../render/CityLighting';
import { APARTMENT } from '../store/StoreArchetype';
import { WEAPONS } from '../combat/WeaponCatalog';
import { EquippedWeapon } from '../combat/EquippedWeapon';
import { Preferences, browserSettingsStorage, keyLabel } from '../config/Preferences';
import { nearbyPlaces } from '../city/Places';
import { TaxiMission } from '../missions/TaxiMission';
import { CarriedItem } from '../character/CarriedItem';
import { preloadCoreAssets } from '../assets/Bootstrap';
import { VehicleLighting } from '../render/VehicleLighting';

export class Game {
  readonly preferences = new Preferences(browserSettingsStorage());
  readonly events = new EventBus();
  readonly ui = new UI();
  readonly render = new Renderer(document.getElementById('app')!);
  readonly input = new Input(this.render.renderer.domElement);
  readonly physics = new Physics(this.events);
  readonly assets = new AssetManager();
  readonly state = new WorldStateStore();
  readonly economy = new Economy(this.events, this.state);
  readonly delivery = new DeliveryMission(this.state, this.economy, this.events);
  readonly saves = new SaveGame();
  readonly map = new CityMap();
  readonly audio = new CityAudio();
  readonly weather = new Weather(this.render.scene, this.events);
  readonly cityLighting = new CityLighting(this.render.scene);
  readonly vehicleLighting = new VehicleLighting(this.render.scene);
  readonly equipmentView = new EquippedWeapon(this.render.scene, this.assets);
  readonly carriedItem = new CarriedItem(this.assets, this.render.scene);
  streaming!: StreamingManager;
  player!: Player;
  vehicle!: Vehicle;
  stores!: StoreManager;
  life!: CityLife;
  sandbox!: Sandbox;
  taxi!: TaxiMission;
  private services!: FacilityServices;
  private vehicleShop!: VehicleShop;
  private saved: GameSave | null = null;
  private running = false;
  private closed = false;
  private lastTime = 0;
  private accumulator = 0;
  private uiTime = 0;
  private autosave = 0;
  private basket: string[] = [];
  private checkout = false;
  private saveAvailable = true;
  private physicsTicks = 0;
  private initialReady = false;
  private readonly activePosition = new THREE.Vector3(WORLD.spawn.x, WORLD.spawn.y, WORLD.spawn.z);
  constructor() {
    this.ui.bind({ start: fresh => this.start(fresh), save: () => { void this.save(); },
      quality: quality => { this.preferences.quality(quality); this.setQuality(quality); }, volume: volume => { this.audio.volume = volume; this.preferences.volume(volume); },
      bindKey: (logical, physical) => { const ok = this.preferences.bind(logical, physical); this.input.bindings = this.preferences.state.bindings; return ok; },
      resetKeys: () => { this.preferences.resetKeys(); this.input.bindings = this.preferences.state.bindings; },
      buy: id => this.buy(id), consume: id => { if (this.economy.consume(id)) { this.openInventory(); void this.save(true); } },
      discard: id => { this.economy.discard(id); this.openInventory(); void this.save(true); },
      sell: id => { if (this.stores.current?.archetype.kind === 'market' && this.economy.sell(id, this.stores.current.id)) { this.openInventory(); this.ui.toast('商品已售出，已收回半价现金'); void this.save(true); } },
      service: store => this.service(store), withdraw: () => { const result = this.services.withdraw(); this.ui.toast(result.message); if (result.ok) { this.ui.close(); void this.save(true); } },
      vehicle: (store, id) => { void this.purchaseVehicle(store, id); },
      weapon: (store, id) => {
        if (this.stores.current?.id !== store.id || store.archetype.kind !== 'weapons') return;
        const ok = this.sandbox.arsenal.purchase(id, this.economy); this.ui.toast(ok ? '装备 / 弹药已购入 · 2 / 3 / 4 / 5 切换，T 换弹' : '现金不足，交易未发生');
        if (ok) { this.ui.close(); void this.save(true); }
      },
      navigate: store => { this.map.setWaypoint({ x: store.x, z: store.z + 15 }); this.ui.close(); this.ui.toast(`GPS 已设置 · ${store.archetype.name}`); },
      ride: () => this.requestRide(),
      close: () => this.input.release(), resume: () => this.render.renderer.domElement.focus({ preventScroll: true }) }, this.preferences.state);
    this.input.bindings = this.preferences.state.bindings; this.audio.volume = this.preferences.state.volume;
    this.map.onWaypoint = point => { this.state.delta.waypoint = { ...point }; void this.save(true); };
    this.input.onLook = (dx, dy) => { if (!this.ui.blocked) { this.render.yaw -= dx * .003; this.render.pitch = THREE.MathUtils.clamp(this.render.pitch + dy * .003, -.6, 1.15); } };
    this.input.onClick = () => { if (this.running && !this.ui.blocked) this.attack(); };
    this.events.on('toast', message => this.ui.toast(message));
    this.events.on('purchase', () => { this.audio.chime(); this.sandbox.mission = Math.max(this.sandbox.mission, 2); void this.save(true); });
    this.events.on('consume', () => { this.sandbox.mission = Math.max(this.sandbox.mission, 3); this.ui.toast('补给已使用 · 生命恢复'); });
    this.events.on('policeEntry', ({ x, z }) => this.stores.openForPolice(x, z));
    this.events.on('navigate', point => this.map.setWaypoint(point));
    this.events.on('thunder', ({ distance }) => this.audio.thunder(distance));
    this.events.on('explosion', ({ x, y, z, radius, damage }) => {
      this.audio.impact(); const center = new THREE.Vector3(x, y, z), vehicleDistance = center.distanceTo(this.vehicle.position), playerDistance = center.distanceTo(this.activePosition);
      if (vehicleDistance < radius) this.vehicle.applyDamage(damage * (1 - vehicleDistance / radius));
      if (playerDistance < radius) this.economy.state.health = Math.max(0, this.economy.state.health - damage * (1 - playerDistance / radius));
    });
    this.events.on('collision', ({ a, b }) => {
      const first = this.physics.world.getCollider(a)?.parent()?.userData as { kind?: string; index?: number } | undefined;
      const second = this.physics.world.getCollider(b)?.parent()?.userData as { kind?: string; index?: number } | undefined;
      const person = first?.kind === 'pedestrian' && second?.kind === 'playerVehicle' ? first : second?.kind === 'pedestrian' && first?.kind === 'playerVehicle' ? second : null;
      if (person && this.vehicle.driving && this.life.vehicleImpact(person.index!, this.vehicle.speed)) {
        this.audio.impact();
        this.events.emit('crime', { severity: this.vehicle.speed > 12 ? 2 : 1, x: this.vehicle.position.x, z: this.vehicle.position.z });
        this.ui.toast('行人受伤 · 警方已接到报告');
      }
    });
  }
  async init() {
    try {
      this.ui.loading('PREPARING PORT AZURE');
      await this.physics.init();
      if (this.closed) return;
      try { await this.saves.init(); this.saved = await this.saves.load(); }
      catch (error) { if (this.closed) return; this.saveAvailable = false; console.warn('Local storage unavailable', error); this.ui.toast('本地存档不可用 · 请检查浏览器存储权限'); }
      if (this.closed) return;
      if (!await preloadCoreAssets(this.assets, this.render.renderer, { loading: message => this.ui.loading(message), fallback: message => this.ui.toast(message), closed: () => this.closed }, this.saved?.vehicle.definitionId)) return;
      if (this.closed) return;
      this.streaming = new StreamingManager(this.render.scene, this.assets, this.physics, this.saved?.seed ?? WORLD.seed);
      this.player = new Player(this.physics, this.assets, this.render.scene);
      this.vehicle = new Vehicle(this.physics, this.assets, this.render.scene);
      this.vehicleShop = new VehicleShop(this.economy, this.state, () => this.vehicle.serialize(), (definition, store, state) => {
        this.vehicle.exit(); this.vehicle.restore({ x: store.x, y: vehicleMetrics(definition).rideHeight + .18, z: store.z + 20.3,
          yaw: -Math.PI / 2, fuel: state.fuel, health: state.health, definitionId: definition.id, color: state.color });
      });
      this.stores = new StoreManager(this.render.scene, this.assets, this.physics, store => !store.archetype.requiredFlag || !!this.state.delta.flags[store.archetype.requiredFlag]);
      this.life = new CityLife(this.render.scene, this.assets, this.physics);
      this.sandbox = new Sandbox(this.events, this.assets, this.render.scene, this.economy, this.state, this.life, this.physics);
      this.taxi = new TaxiMission(this.state, this.economy, this.events, this.assets, this.render.scene, this.physics);
      this.services = new FacilityServices(this.economy, this.state, {
        vehicleNearby: () => this.vehicle.position.distanceTo(this.player.position) < 55,
        refuel: () => { this.vehicle.fuel = 100; }, repair: () => { this.vehicle.health = 100; }, repaint: () => this.vehicle.repaint('#a49375'),
        outfit: () => this.player.setAppearance('#729b96'), haircut: () => this.player.setAppearance(undefined, true),
        rest: () => { this.render.time = (this.render.time + 8) % 24; }, train: () => { this.player.sprintSpeed = 8.8; },
        cinema: () => { this.render.time = (this.render.time + 2) % 24; queueMicrotask(() => { if (!this.closed) this.ui.screening(); }); },
        arcade: () => queueMicrotask(() => { if (!this.closed) this.ui.arcade(amount => { this.economy.state.cash += amount; void this.save(true); }); }),
      });
      this.sandbox.onArrest = () => { this.taxi.cancel(this.vehicle); this.vehicle.exit(); this.player.setEnabled(true); this.player.teleport(WORLD.spawn.x, WORLD.spawn.y, WORLD.spawn.z); void this.save(true); };
      const query = new URLSearchParams(location.search);
      if (query.get('quality') === 'low') this.preferences.state.quality = 'low';
      this.setQuality(this.preferences.state.quality);
      this.ui.loading('BUILDING MARINA QUARTER');
      this.render.renderer.setAnimationLoop(this.frame);
      window.addEventListener('pagehide', this.pageHide);
      if ((import.meta.env.DEV || import.meta.env.MODE === 'qa') && query.get('e2e') === '1') this.exposeTestAPI();
    } catch (error) {
      if (this.closed) return;
      this.ui.loading(`无法启动：${error instanceof Error ? error.message : 'WebGL2 不可用'}`); console.error(error);
    }
  }
  private start(fresh: boolean) {
    if (!fresh && this.saved) {
      const save = this.saved;
      this.state.restore(save.world); this.economy.restore(save.economy);
      if (save.world.waypoint) this.map.waypoint = { ...save.world.waypoint };
      this.player.teleport(save.player.x, Math.max(1.05, save.player.y), save.player.z); this.render.yaw = save.player.yaw;
      this.vehicle.restore(save.vehicle); this.render.time = save.time; this.sandbox.mission = save.mission;
      this.weather.set(save.weather ?? 'clear');
      if (save.world.flags['appearance:coastal']) this.player.setAppearance('#729b96');
      if (save.world.flags['appearance:haircut']) this.player.setAppearance(undefined, true);
      if (save.world.flags['vehicle:sand'] && !save.vehicle.color) this.vehicle.repaint('#a49375');
      if (save.world.flags['fitness:trained']) this.player.sprintSpeed = 8.8;
      if (save.driving) { this.vehicle.enter(this.player.appearance); this.player.setEnabled(false); }
      this.activePosition.copy(save.driving ? this.vehicle.position : this.player.position);
      this.sandbox.restore(save.sandbox, this.activePosition);
    }
    this.running = true; this.input.release(); this.audio.start(); this.ui.start(); this.lastTime = 0;
    this.ui.toast('欢迎来到 Port Azure · 鼠标右键拖动观察，E 与城市互动');
  }
  private frame = (time: number) => {
    if (this.closed) return;
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, .1) : WORLD.fixedStep;
    this.lastTime = time;
    const driving = this.vehicle.driving;
    this.activePosition.copy(driving ? this.vehicle.position : this.player.position);
    this.streaming.update(dt, this.activePosition, driving ? this.vehicle.velocity : this.player.velocity);
    this.ui.setStreaming(this.running && !this.streaming.ready(this.activePosition.x, this.activePosition.z));
    this.stores.update(dt, this.activePosition, this.streaming, this.render.time);
    if (!this.initialReady && this.streaming.ready(WORLD.spawn.x, WORLD.spawn.z)) { this.initialReady = true; this.ui.ready(!!this.saved); }
    if (this.running) this.handleKeys();
    else if (this.input.take('Escape') && this.ui.modalOpen) this.ui.close();
    const simulate = this.running && !this.ui.blocked;
    this.player.model.armed = this.sandbox.equipped;
    if (this.sandbox.equipped && !driving) this.player.model.group.rotation.y = this.render.yaw;
    if (simulate) {
      if (!driving && this.input.firing && this.sandbox.arsenal.selected?.automatic) this.attack();
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= WORLD.fixedStep && steps++ < 5) {
        if (this.vehicle.driving) {
          this.vehicle.readInput(this.input); this.vehicle.update(WORLD.fixedStep, this.streaming);
          this.player.teleport(this.vehicle.position.x, this.vehicle.position.y + .4, this.vehicle.position.z);
        } else this.player.control(WORLD.fixedStep, this.input, this.render.yaw, this.streaming);
        this.vehicle.body.setEnabled(this.streaming.ready(this.vehicle.position.x, this.vehicle.position.z));
        const actorPosition = this.vehicle.driving ? this.vehicle.position : this.player.position;
        this.life.update(WORLD.fixedStep, actorPosition, this.streaming, this.render.time > 21 || this.render.time < 6);
        this.taxi.update(WORLD.fixedStep, actorPosition, this.vehicle, this.streaming);
        this.sandbox.update(WORLD.fixedStep, actorPosition, driving ? this.vehicle.speed : this.player.velocity.length(), !!this.stores.current, this.streaming);
        if (this.streaming.ready(this.activePosition.x, this.activePosition.z)) { this.physics.step(); this.physicsTicks++; }
        this.player.sync(WORLD.fixedStep); this.vehicle.sync(WORLD.fixedStep);
        this.accumulator -= WORLD.fixedStep;
      }
      if (steps > 5) this.accumulator = 0;
      this.weather.update(dt, this.activePosition, this.render.scene, !!this.stores.current);
      this.autosave += dt; if (this.autosave > 30) { this.autosave = 0; void this.save(true); }
      if (this.stores.current && this.sandbox.mission === 0) this.sandbox.mission = 1;
      if (driving && this.vehicle.distance > 80 && this.sandbox.mission >= 3 && this.sandbox.mission < 4) {
        this.sandbox.mission = 4; this.economy.state.cash += 75; this.ui.toast('街区初体验完成 · 奖励 $75。整个城市都向你开放。'); void this.save(true);
      }
    }
    if (!this.running && this.initialReady) {
      this.accumulator += dt;
      while (this.accumulator >= WORLD.fixedStep) {
        this.life.update(WORLD.fixedStep, this.activePosition, this.streaming, this.render.time > 21 || this.render.time < 6);
        if (this.streaming.ready(this.activePosition.x, this.activePosition.z)) { this.physics.step(); this.vehicle.sync(WORLD.fixedStep); }
        this.accumulator -= WORLD.fixedStep;
      }
    }
    if (this.vehicle.driving && !this.input.held('AltLeft') && simulate) {
      // Camera follows road direction, while right-drag remains available for looking around.
      const delta = THREE.MathUtils.euclideanModulo(this.vehicle.yaw - this.render.yaw + Math.PI, Math.PI * 2) - Math.PI;
      this.render.yaw += delta * dt * .9;
    }
    this.player.model.group.visible = !this.vehicle.driving && !this.render.firstPerson;
    this.vehicle.firstPerson(this.render.firstPerson);
    this.render.weather = this.weather.type; this.assets.setWetness(this.weather.precipitation ? 1 : 0);
    this.render.update(dt, this.activePosition, this.vehicle.driving, this.physics, driving ? this.vehicle.body : this.player.body, !this.running, simulate || !this.running, this.vehicle.cameraView);
    this.assets.setRenderOrigin(this.render.origin.offset);
    this.assets.setEnvironment(simulate ? dt : 0, 1 - THREE.MathUtils.smoothstep(Math.sin((this.render.time - 6) / 12 * Math.PI), -.05, .25));
    this.equipmentView.update(this.sandbox.arsenal.state.selected, this.player.model, this.render.camera, this.render.origin.offset, this.render.firstPerson, this.running && !driving);
    this.carriedItem.update(this.basket[0], this.player.model, this.render.camera, this.render.origin.offset, this.render.firstPerson, this.running && !driving && !this.sandbox.equipped);
    this.assets.setSignals(this.life.signals);
    this.cityLighting.update(this.render.time, this.activePosition, this.streaming, this.render.yaw);
    this.vehicleLighting.update(this.render.time, this.vehicle.position, this.vehicle.yaw, this.vehicle.definition, this.vehicle.driving, this.vehicle.health);
    this.audio.update(this.vehicle.speed, this.vehicle.driving, !simulate, { inside: !!this.stores.current, rain: this.weather.precipitation,
      walking: this.player.movementSpeed, swimming: this.player.swimming, bar: this.stores.current?.archetype.kind === 'bar', wanted: this.sandbox.wanted,
      listener: this.activePosition, yaw: this.render.yaw, police: this.sandbox.policePosition });
    this.uiTime += dt;
    if (this.uiTime > .12) { this.uiTime = 0; this.updateHUD(); }
    this.render.draw(); this.input.endFrame();
  };
  private handleKeys() {
    if (this.input.take('Escape')) { if (this.ui.modalOpen) this.ui.close(); else this.ui.pause(); }
    if (this.input.take('F3')) this.ui.togglePerformance();
    if (this.input.take('F5')) void this.save();
    if (this.ui.blocked) return;
    if (this.input.take('KeyI') || this.input.take('Tab')) this.openInventory();
    if (this.input.take('KeyM')) this.ui.openMap(canvas => this.map.draw(canvas, this.activePosition, this.render.yaw, true), {
      fit: canvas => this.map.fitWorld(canvas, this.activePosition, this.render.yaw), follow: canvas => this.map.followPlayer(canvas, this.activePosition, this.render.yaw),
    });
    if (this.input.take('KeyP')) this.openDirectory('phone');
    if (this.input.take('KeyG')) this.openDirectory('guide');
    if (this.input.take('KeyV')) this.render.firstPerson = !this.render.firstPerson;
    if (this.input.take('KeyL')) void this.render.renderer.domElement.requestPointerLock();
    if (this.input.take('KeyF')) { if (this.vehicle.driving) this.exitVehicle(); else if (this.player.position.distanceTo(this.vehicle.position) < 5.8) { this.vehicle.enter(this.player.appearance); this.player.setEnabled(false); this.render.yaw = this.vehicle.yaw; this.ui.toast('W / S 油门与倒车 · A / D 转向 · SPACE 手刹 · F 下车'); } }
    if (this.input.take('KeyE')) {
      if (!this.vehicle.driving) this.interact();
      else if (this.taxi.interact(this.vehicle, this.sandbox.wanted)) void this.save(true);
    }
    if (this.input.take('KeyH')) { this.life.alarm = 2; this.audio.horn(); }
    if (this.input.take('KeyR') && this.stores.current && this.stores.scareMerchant(this.stores.current.id)) { this.sandbox.rob(this.stores.current); void this.save(true); }
    if (this.input.take('KeyQ')) this.attack();
    if (this.input.take('Digit1')) this.sandbox.arsenal.select(null);
    WEAPONS.forEach((weapon, index) => { if (this.input.take(`Digit${index + 2}`)) this.ui.toast(this.sandbox.arsenal.select(weapon.id) ? `已装备 ${weapon.name} · T 换弹` : '请先在 SENTINEL SPORT 购买装备'); });
    if (this.input.take('KeyT') && this.sandbox.arsenal.reload()) this.ui.toast('正在换弹…');
  }
  private interact() {
    const action = this.stores.action;
    if (action) {
      if (action.type === 'door') { if (!this.stores.toggleDoor(action.store.id)) this.ui.toast(action.store.archetype.requiredFlag ? '公寓上锁 · 先到 COVE LIVING 租房，取得钥匙后可在屋内休息存档' : '店铺已打烊 · 门口标牌显示营业时间，可在酒店休息等待开门'); }
      else if (action.type === 'fridge') { this.stores.toggleFridge(action.store.id); this.ui.toast('冷藏柜已打开 · 货架上可查看并选择饮料'); }
      else if (action.type === 'talk') {
        if (action.guest) { this.ui.dialogue(`顾客 · ${action.guest}`, '这座城市最舒服的地方，就是可以坐下来慢慢喝杯咖啡。海湾的黄昏很好看，你也可以试试社区接送，认识更多邻居。'); return; }
        if (this.delivery.deliver(action.store)) { void this.save(true); return; }
        this.ui.dialogue('店员 · Alex', '欢迎来到这条街。货架上的商品都可以查看，选好以后到收银台结账。沿着主路往东是餐厅和汽车服务店，南面有酒吧和加油站。', [
          { label: '接取社区送货任务 · 奖励 $85', action: () => { if (this.delivery.accept()) this.map.setWaypoint(this.delivery.destination); this.ui.close(); void this.save(true); } },
        ]);
      }
      else { this.checkout = action.type === 'checkout'; this.ui.shop(action.store, this.economy, this.checkout, this.basket, VEHICLES.filter(v => this.vehicleShop.owned(v.id)).map(v => v.id), this.sandbox.arsenal.state, action.type === 'service'); }
      return;
    }
    const neighbor = this.life.nearest(this.player.position);
    if (neighbor) {
      this.ui.dialogue(`${neighbor.profession} · ${neighbor.name}`, '海风最舒服的时候，就是现在。我们可以在咖啡馆坐一会儿，也可以一起去海边散步。', [
        { label: '聊聊这座城市', action: () => this.ui.dialogue(neighbor.name, '主干道在每个街口相连。商铺门口亮着 OPEN 的标志时，都能推门进去。地图上的青色标记能帮你找到它们。') },
        { label: '邀请成年邻居约会', action: () => { this.state.delta.flags[`friend:${neighbor.name.toLowerCase()}`] = true; this.ui.dialogue(neighbor.name, '好呀。我们都已成年，也都愿意赴约。傍晚一起喝杯咖啡吧。'); void this.save(true); } },
        { label: this.taxi.active ? '取消当前社区接送' : '接取社区接送 · 驾车赚取报酬', action: () => this.requestRide() },
      ]);
    }
  }
  private attack() {
    if (this.vehicle.driving) return;
    let direction = new THREE.Vector3(-Math.sin(this.render.yaw), 0, -Math.cos(this.render.yaw));
    if (this.sandbox.equipped) {
      const from = this.render.camera.position.clone().add(this.render.origin.offset), look = this.render.camera.getWorldDirection(new THREE.Vector3()), range = this.sandbox.arsenal.selected!.range;
      const distance = this.physics.blocked(from, from.clone().addScaledVector(look, range), this.player.body) ?? range;
      const target = from.addScaledVector(look, distance);
      direction = target.sub(this.player.position.clone().add(new THREE.Vector3(0, .45, 0))).normalize();
    }
    if (this.sandbox.attack(this.player.position, direction, this.player.body)) { if (this.sandbox.equipped) this.audio.shot(); this.player.model.punch(); }
  }
  private buy(id: string) {
    if (!this.checkout) { if (!this.basket.includes(id)) this.basket.push(id); this.ui.toast('已选入购物篮 · 请走到收银台付款'); }
    else if (this.stores.current && this.economy.purchase(id, this.stores.current.id)) { this.basket = this.basket.filter(item => item !== id); this.ui.toast('购买成功 · 按 I 打开背包使用'); }
    else this.ui.toast('余额或库存不足，交易未发生');
    this.ui.refreshShop(this.economy, this.checkout, this.basket);
  }
  private service(store: StoreLocation) {
    const result = this.services.purchase(store); this.ui.toast(result.message);
    if (result.ok && store.archetype.kind === 'realty') { this.map.setWaypoint({ x: APARTMENT.x, z: APARTMENT.z + 15 }); this.ui.toast('已取得 COVE HOUSE 03 钥匙 · 东侧三个街口，GPS 已设置 · 可实际进屋休息与存档'); }
    if (result.ok && ['electronics', 'bookshop'].includes(store.archetype.kind)) this.ui.toast(store.archetype.kind === 'electronics' ? '手机已购入 · 按 P 打开城市服务与 GPS' : '指南已购入 · 按 G 查阅城市商铺与 GPS');
    if (result.ok) { this.ui.close(); void this.save(true); }
  }
  private async purchaseVehicle(store: StoreLocation, id: string) {
    if (this.taxi.riding) { this.ui.toast('请先送达乘客，再更换车辆'); return; }
    const revision = this.ui.revision; this.ui.vehicleBusy(true);
    try {
      await this.assets.vehicles.ensure(id, 10);
      if (this.closed || this.ui.revision !== revision || this.stores.current?.id !== store.id) return;
      const result = this.vehicleShop.purchase(store, id); this.ui.toast(result.message);
      if (result.ok) { this.ui.close(); await this.save(true); }
    } catch (error) { if (!this.closed) { console.warn('Vehicle preparation failed', error); this.ui.toast('车辆暂未准备好，请稍后重试。'); } }
    finally { if (!this.closed && this.ui.revision === revision) this.ui.vehicleBusy(false); }
  }
  private openInventory() {
    const flags = this.state.delta.flags, unlocks: string[] = [];
    for (const [key, name] of [['owns:phone', '城市手机'], ['owns:city-guide', '城市指南'], ['owns:apartment', '港湾公寓']]) if (flags[key]) unlocks.push(name);
    for (const weapon of WEAPONS) if (this.sandbox.arsenal.state.weapons[weapon.id]) unlocks.push(weapon.name);
    this.ui.inventory(this.economy, this.stores.current?.archetype.kind === 'market', unlocks);
  }
  private openDirectory(kind: 'phone' | 'guide') {
    const required = kind === 'phone' ? 'owns:phone' : 'owns:city-guide';
    if (!this.state.delta.flags[required]) { this.ui.toast(kind === 'phone' ? '请先在 SIGNAL 电子商店购买手机' : '请先在 CHAPTER ONE 书店购买指南'); return; }
    const profile = kind === 'phone' ? `现金 $${this.economy.state.cash} · 银行 $${this.economy.state.bank} · ${this.weather.type.toUpperCase()} · 社区送货${this.delivery.active ? '进行中' : this.delivery.complete ? '已完成' : '尚未接取'}` : '从海湾到商业区，发现属于你的城市日常。';
    this.ui.directory(nearbyPlaces(this.activePosition.x, this.activePosition.z), kind === 'phone' ? 'SIGNAL · 城市手机' : 'Port Azure · 城市指南', profile,
      kind === 'phone' ? { active: this.taxi.active } : undefined, this.render.time);
  }
  private requestRide() {
    if (this.taxi.active) this.taxi.cancel(this.vehicle);
    else if (this.sandbox.wanted) this.ui.toast('请先结束警方追捕，再接取社区接送');
    else this.taxi.accept(this.activePosition);
    this.ui.close(); void this.save(true);
  }
  private exitVehicle() {
    if (this.vehicle.speed > 4) { this.ui.toast('请先减速停车，再下车'); return; }
    const p = this.vehicle.position, yaw = this.vehicle.yaw;
    const candidates = [1, -1].flatMap(side => {
      const x = p.x + Math.cos(yaw) * side * 2.2, z = p.z - Math.sin(yaw) * side * 2.2;
      const height = this.physics.groundHeight(x, z, p.y + 2.5, this.vehicle.body);
      return height === null || height > p.y + .8 ? [] : [{ x, y: height + 1.04, z }];
    });
    const candidate = candidates.find(c => this.physics.canStand(c, this.vehicle.body) && !this.physics.blocked({ x: p.x, y: p.y + .5, z: p.z }, { ...c, y: p.y + .5 }, this.vehicle.body));
    if (!candidate) { this.ui.toast('车门旁空间不足，请换一个停车位置'); return; }
    this.vehicle.exit(); this.player.setEnabled(true); this.player.teleport(candidate.x, candidate.y, candidate.z);
  }
  private updateHUD() {
    const pos = this.activePosition, chunk = chunkAt(pos.x, pos.z);
    const district = generateChunk(this.streaming.seed, `${chunk.x},${chunk.z}`).district;
    let prompt = '', promptKey = 'E';
    if (!this.vehicle.driving) {
      if (this.stores.action) prompt = this.stores.action.label;
      else if (this.player.position.distanceTo(this.vehicle.position) < 5.8) { prompt = `Drive ${this.vehicle.definition.name} · 驾驶`; promptKey = 'F'; }
      else if (this.life.nearest(this.player.position)) prompt = 'Talk to a neighbor · 与路人交谈';
    } else prompt = this.taxi.action(this.vehicle, this.sandbox.wanted);
    const missions = [
      ['A fresh start', '推开 Fresh & Co. 的门，走进街角便利店。'],
      ['A little something for the road', '在货架选货，再到右侧收银台购买补给。'],
      ['Travel light', '按 I 打开背包，使用刚购买的补给。'],
      ['The city is yours', '走到街边的青色轿车旁，按 F 上车并驾驶 80 米。'],
      ['Find your own way', '任务完成。探索商铺、海湾和城市生活。按 M 设置导航。'],
    ];
    const mission = this.taxi.active ? ['Neighborhood rides', this.taxi.riding ? `乘客已上车 · 实际行驶 ${Math.floor(this.taxi.data.meters)} m。到 GPS 目的地停车按 E 结算。` : '开车到 GPS 标记处停车，按 E 接上路边乘客；摩托车无法接送。']
      : this.delivery.active ? ['Neighborhood delivery', '将社区包裹送到东侧 Sunset Diner，与店员交谈。奖励 $85。'] : missions[Math.min(4, this.sandbox.mission)];
    const stats = this.streaming.stats, info = this.render.renderer.info, assets = this.assets.stats;
    const time = `${String(Math.floor(this.render.time)).padStart(2, '0')}:${String(Math.floor(this.render.time % 1 * 60)).padStart(2, '0')}`;
    this.ui.update({ cash: this.economy.state.cash, health: this.economy.state.health, time, district, speed: this.vehicle.speed, fuel: this.vehicle.fuel,
      driving: this.vehicle.driving, vehicleName: this.vehicle.definition.name, vehicleHealth: this.vehicle.health, prompt, promptKey: keyLabel(this.input.bindings[`Key${promptKey}`] ?? promptKey), objective: mission[0], objectiveDetail: mission[1], wanted: this.sandbox.wanted,
      location: this.stores.current?.archetype.name ?? district.toUpperCase(), fps: this.render.fps, calls: info.render.calls, triangles: info.render.triangles,
      chunks: `${stats.ACTIVE} ACTIVE · ${stats.NEAR} NEAR · ${stats.FAR} FAR`, pending: stats.pending, physics: this.physics.lastStepMs,
      resources: `GPU est. ${stats.memoryMB.toFixed(1)} MB · ${info.memory.geometries} geo · ${info.memory.textures} tex · ${assets.references} refs`, ratio: this.render.ratio,
      equipment: this.sandbox.arsenal.selected ? `${this.sandbox.arsenal.selected.name} · ${this.sandbox.arsenal.reloading ? '换弹中…' : `${this.sandbox.arsenal.stock!.clip} / ${this.sandbox.arsenal.stock!.reserve}`} · T RELOAD` : '' });
    this.ui.setWeather(this.weather.type.toUpperCase()); this.map.draw(this.ui.map, pos, this.vehicle.driving ? this.vehicle.yaw : this.render.yaw);
  }
  private setQuality(value: Quality) { this.render.setQuality(value); this.cityLighting.setQuality(value); this.vehicleLighting.setQuality(value); if (this.streaming) this.streaming.radius = QUALITY[value].radius; }
  async save(quiet = false) {
    if (this.closed || !this.running || !this.saveAvailable) return;
    try {
      const p = this.player.position;
      const state: GameSave = { version: 4, seed: this.streaming.seed, savedAt: Date.now(), player: { x: p.x, y: p.y, z: p.z, yaw: this.render.yaw },
        vehicle: this.vehicle.serialize(),
        economy: structuredClone(this.economy.state), world: this.state.serialize(), time: this.render.time, weather: this.weather.type, mission: this.sandbox.mission, driving: this.vehicle.driving, sandbox: this.sandbox.serialize() };
      await this.saves.save(state); if (this.closed) return; this.saved = state; if (!quiet) this.ui.toast('进度已保存到此浏览器 · IndexedDB');
    } catch (error) { console.error('Save failed', error); this.ui.toast('存档失败 · 请检查浏览器存储空间'); }
  }
  private pageHide = () => { void this.save(true); };
  snapshot() {
    return { ready: this.initialReady, running: this.running, position: this.player.position.toArray(), vehicle: this.vehicle.position.toArray(),
      cash: this.economy.state.cash, bank: this.economy.state.bank, health: this.economy.state.health, inventory: { ...this.economy.state.inventory }, flags: { ...this.state.delta.flags },
      driving: this.vehicle.driving, speed: this.vehicle.speed, fuel: this.vehicle.fuel, store: this.stores.current?.id ?? null,
      action: this.stores.action?.type, chunks: this.streaming.stats, interiors: this.stores.count, assets: this.assets.stats,
      physicsTicks: this.physicsTicks, colliders: this.physics.world.colliders.len(), mission: this.sandbox.mission, wanted: this.sandbox.wanted,
      policeOnFoot: this.sandbox.policeOnFoot,
      equipment: this.sandbox.arsenal.serialize(),
      waypoint: this.map.waypoint,
      taxi: structuredClone(this.taxi.data),
      equipmentPosition: this.equipmentView.position,
      carriedItem: { id: this.basket[0], position: this.carriedItem.position },
      grip: this.player.model.grip.getWorldPosition(new THREE.Vector3()).add(this.render.origin.offset).toArray(),
      poolCapacity: this.life.poolCapacity,
      population: this.life.population(this.render.camera),
      rigged: this.player.model.rigged,
      vehicleId: this.vehicle.definition.id,
      vehicleColor: this.vehicle.color,
      vehicleHealth: this.vehicle.health,
      vehicleDetailed: !!this.vehicle.group.userData.detailedAsset,
      facadeTemplatesReady: this.assets.buildings.ready,
      vehicleYaw: this.vehicle.yaw,
      swimming: this.player.swimming,
      firstPerson: this.render.firstPerson,
      renderOrigin: this.render.origin.offset.toArray(),
      fps: this.render.fps, render: { ...this.render.renderer.info.memory }, distance: this.vehicle.distance,
      diagnostics: { playerCollider: this.player.collider.isEnabled(), vehicleRotation: this.vehicle.body.rotation(),
        vehicleFriction: this.vehicle.body.collider(0).friction(), input: [...this.input.keys], impact: this.vehicle.lastImpact },
      resident: this.assets.residentCounts(this.render.scene), groundReady: this.streaming.ready(
        this.vehicle.driving ? this.vehicle.position.x : this.player.position.x,
        this.vehicle.driving ? this.vehicle.position.z : this.player.position.z) };
  }
  private driveSensor(direction = 1) {
    const vehicle = this.vehicle, forward = new THREE.Vector3(-Math.sin(vehicle.yaw), 0, -Math.cos(vehicle.yaw)).multiplyScalar(Math.sign(direction) || 1), side = new THREE.Vector3(-forward.z, 0, forward.x);
    let obstacle = 80;
    for (const offset of [-.75, 0, .75]) {
      const from = vehicle.position.clone().addScaledVector(forward, vehicle.definition.length / 2 + .2).addScaledVector(side, offset); from.y += .55;
      obstacle = Math.min(obstacle, this.physics.blocked(from, from.clone().addScaledVector(forward, 80), vehicle.body) ?? 80);
    }
    return { x: vehicle.position.x, y: vehicle.position.y, z: vehicle.position.z, speed: vehicle.speed, health: vehicle.health, obstacle,
      green: this.life.signals.x === 'green', groundReady: this.streaming.ready(vehicle.position.x, vehicle.position.z) };
  }
  private exposeTestAPI() {
    Object.assign(window, { __city: { snapshot: () => this.snapshot(), driveSensor: (direction?: number) => this.driveSensor(direction), ao: (enabled: boolean) => this.render.debugAO(enabled), save: () => this.save(true),
      teleport: (x: number, z: number, yaw = 0) => { if (this.vehicle.driving) { this.vehicle.exit(); this.player.setEnabled(true); } this.player.teleport(x, 1.1, z); this.activePosition.copy(this.player.position); this.render.yaw = yaw; },
      vehicleTeleport: (x: number, z: number, yaw: number, y = 1) => {
        this.vehicle.restore({ x, y, z, yaw, fuel: 100, health: 100 }); this.vehicle.enter(this.player.appearance); this.player.setEnabled(false);
        this.render.yaw = yaw;
      },
      weather: (type: 'clear' | 'rain' | 'fog' | 'cloudy' | 'storm') => this.weather.set(type), time: (hour: number) => { this.render.time = hour; } } });
  }
  close() {
    if (this.closed) return;
    this.closed = true; window.removeEventListener('pagehide', this.pageHide);
    this.render.renderer.setAnimationLoop(null); this.taxi?.close(); this.sandbox?.close(); this.life?.close(); this.stores?.close(); this.streaming?.close();
    this.carriedItem.close(); this.equipmentView.close(); this.player?.dispose(); this.vehicle?.dispose(); this.weather.close(); this.cityLighting.close(); this.vehicleLighting.close(); this.assets.close(); this.audio.close(); this.saves.close(); this.input.close(); this.physics.close(); this.render.close(); this.ui.dispose(); this.events.clear();
  }
}
