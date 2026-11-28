import { expect, type Page } from '@playwright/test';
import { storeForChunk } from '../../src/store/StoreArchetype';
export interface Snapshot {
  ready: boolean; running: boolean; position: number[]; vehicle: number[]; cash: number; bank: number; health: number; flags: Record<string, boolean>;
  inventory: Record<string, number>; driving: boolean; speed: number; fuel: number; store: string | null; action: string;
  chunks: { ACTIVE: number; NEAR: number; FAR: number; total: number; pending: number; loaded: number; unloaded: number; failures: number };
  interiors: number; assets: { references: number; geometries: number; materials: number }; physicsTicks: number;
  colliders: number; mission: number; wanted: number; policeOnFoot: boolean; fps: number; render: { geometries: number; textures: number }; distance: number;
  resident: { geometries: number; textures: number }; groundReady: boolean;
  swimming: boolean; firstPerson: boolean; renderOrigin: number[]; poolCapacity: number;
  camera: { yaw: number; pitch: number; position: number[] };
  drivingHands: { wheel: boolean; contacts: number; error: number; palms: number[][] }; phoneVisible: boolean; officerPosition?: number[]; policeCar?: number[];
  phone?: { call: { status: string; line: string } | null; threads: Record<string, { text: string; outgoing: boolean }[]>; posts: Record<string, { liked: boolean; comments: { text: string }[] }> };
  machines?: Record<string, { health: number; claimed: boolean; alarmed: boolean }>;
  clubCast: { name: string; role: string; position: number[]; rigged: boolean }[];
  hailedRide?: { stage: string; pickup: { x: number; z: number }; destination: { x: number; z: number }; fee: number };
  riding: boolean; hailedVehicle?: number[];
  rigged: boolean; vehicleId: string; vehicleYaw: number; vehicleColor: string;
  equipment: { selected: string | null; weapons: Record<string, { clip: number; reserve: number }> };
  waypoint: { x: number; z: number } | null;
  taxi: { stage: 'idle' | 'pickup' | 'boarding' | 'riding'; meters: number; completed: number; pickup: { x: number; z: number }; destination: { x: number; z: number } };
  carriedItem: { id?: string; position?: number[] };
  population: { pedestrians: number; traffic: number; parked: number; peopleInView: number; carsInView: number; samples: { kind: string; x: number; z: number; visualX?: number; visualZ?: number }[] };
}

export async function pullIntoLane(page: Page, roadZ = 0) {
  const held = new Set<string>();
  const key = async (code: string, down: boolean) => {
    if (held.has(code) === down) return;
    if (down) { await page.keyboard.down(code); held.add(code); }
    else { await page.keyboard.up(code); held.delete(code); }
  };
  const deadline = Date.now() + 25000;
  try {
    while (Date.now() < deadline) {
      const state = await snapshot(page);
      const desired = -Math.PI / 2 - Math.atan2(roadZ - 4 - state.vehicle[2], 8);
      const error = ((desired - state.vehicleYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      await key('KeyW', state.speed < 4);
      await key('KeyA', error > .02); await key('KeyD', error < -.02);
      if (state.vehicle[2] > roadZ - 4.45 && Math.abs(state.vehicleYaw + Math.PI / 2) < .05) return;
      await page.waitForTimeout(70);
    }
    console.log('Pull-out state', JSON.stringify(await snapshot(page)));
    throw new Error('Could not safely merge out of the parking space');
  } finally { for (const code of held) await page.keyboard.up(code); }
}

declare global { interface Window { __city: { snapshot(): Snapshot; lookAt(x: number, y: number, z: number): void; cockpit(): { rays: number; obstructed: number; eye: number[] }; driveSensor(direction?: number): { x: number; speed: number; obstacle: number; green: boolean; groundReady: boolean }; save(): Promise<void>; teleport(x: number, z: number, yaw?: number): void; vehicleTeleport(x: number, z: number, yaw: number, y?: number): void; weather(type: string): void; time(hour: number): void; }; } }
export const snapshot = (page: Page) => page.evaluate(() => window.__city.snapshot());
export async function start(page: Page) {
  await page.goto('/?e2e=1&quality=low');
  await expect(page.locator('#start-game')).toBeVisible({ timeout: 45000 });
  await page.locator('#start-game').click();
  await expect.poll(async () => (await snapshot(page)).physicsTicks).toBeGreaterThan(5);
  expect((await snapshot(page)).rigged).toBe(true);
}
export async function move(page: Page, key: string, done: (s: Snapshot) => boolean, timeout = 30000) {
  await page.keyboard.down(key);
  try { await expect.poll(async () => done(await snapshot(page)), { timeout, intervals: [60, 100, 150] }).toBe(true); }
  catch (error) { console.log('Failed movement snapshot', key, JSON.stringify(await snapshot(page))); throw error; }
  finally { await page.keyboard.up(key); }
}
export async function driveToX(page: Page, target: number) {
  const held = new Set<string>();
  const key = async (code: string, down: boolean) => { if (held.has(code) === down) return; if (down) { await page.keyboard.down(code); held.add(code); } else { await page.keyboard.up(code); held.delete(code); } };
  const deadline = Date.now() + 75000;
  try {
    while (Date.now() < deadline) {
      const sensor = await page.evaluate(() => window.__city.driveSensor()), remaining = target - sensor.x;
      if (remaining < 5 && sensor.speed < .5) return;
      const local = ((sensor.x + 64) % 128 + 128) % 128 - 64, intersection = local < -12 ? -local : 128 - local;
      const braking = remaining < Math.max(2, sensor.speed * .27) || sensor.obstacle < Math.max(9, sensor.speed * .9)
        || !sensor.green && intersection < Math.max(20, sensor.speed * 1.1) || !sensor.groundReady;
      await key('Space', braking); await key('KeyW', !braking); await page.waitForTimeout(80);
    }
    console.log('Driving deadline state', JSON.stringify(await snapshot(page))); throw new Error('Driving route was blocked');
  } finally { for (const code of held) await page.keyboard.up(code); }
}

export async function visitService(page: Page, cx: number, cz: number) {
  const x = cx * 128 + 32, z = cz * 128 - 27;
  const walk = async (code: string, done: (state: Snapshot) => boolean) => {
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) { if (done(await snapshot(page))) return; await page.keyboard.press(code, { delay: 65 }); }
    console.log('Service walk state', `${cx},${cz}`, JSON.stringify(await snapshot(page))); throw new Error('Service walking route blocked');
  };
  await page.evaluate(([px, pz]) => window.__city.teleport(px, pz), [x, z + 17]);
  await expect.poll(async () => (await snapshot(page)).groundReady).toBe(true);
  await expect.poll(async () => (await snapshot(page)).action).toBe('door');
  await page.keyboard.press('KeyE');
  await walk('KeyW', s => s.position[2] < z + 8);
  await walk('KeyA', s => s.position[0] < x - 4.8);
  const anchor = storeForChunk(`${cx},${cz}`).archetype.servicePoint ?? { x: -5, z: 4 };
  let state = await snapshot(page);
  if (state.position[0] < x + anchor.x - .4) await walk('KeyD', s => s.position[0] > x + anchor.x - .3);
  state = await snapshot(page);
  if (state.position[2] > z + anchor.z + 2.6) await walk('KeyW', s => s.position[2] < z + anchor.z + 2.6);
  try { await expect.poll(async () => (await snapshot(page)).action).toBe('shelf'); }
  catch (error) { console.log('Service approach state', `${cx},${cz}`, JSON.stringify(await snapshot(page))); throw error; }
  await page.keyboard.press('KeyE'); await expect(page.locator('#service')).toBeVisible();
}

