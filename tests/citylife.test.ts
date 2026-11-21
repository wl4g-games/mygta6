import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scene, Vector3 } from 'three';
import { CityLife } from '../src/npc/CityLife';
import { AssetManager } from '../src/assets/AssetManager';
import { Physics } from '../src/physics/Physics';
import type { StreamingManager } from '../src/world/StreamingManager';
import { CITY_POPULATION } from '../src/config/population';
describe('bounded NPC and traffic pools', () => {
  let physics: Physics, life: CityLife, assets: AssetManager;
  const streaming = { ready: () => true } as unknown as StreamingManager;
  beforeEach(async () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) });
    physics = new Physics(); await physics.init(); assets = new AssetManager(); life = new CityLife(new Scene(), assets, physics);
  });
  afterEach(() => { life.close(); physics.close(); vi.unstubAllGlobals(); });
  it('reuses the configured physical actors across distant region changes', () => {
    life.update(.016, new Vector3(0, 1, 0), streaming, false);
    const refs = assets.stats.references;
    for (let x = 0; x < 8000; x += 256) { life.update(.016, new Vector3(x, 1, 0), streaming, false); physics.step(); }
    expect(life.count).toBe(CITY_POPULATION.pedestrians); expect(physics.world.bodies.len()).toBe(life.poolCapacity); expect(assets.stats.references).toBe(refs);
    life.close(); expect(physics.world.bodies.len()).toBe(0); expect(assets.stats.references).toBe(0);
  });
  it('applies directional melee damage, down state and a physical actor response', () => {
    life.update(.016, new Vector3(0, 1, 0), streaming, false);
    const target = life.nearest(new Vector3(-42, 1, -9.1)); expect(target).toBeDefined();
    const origin = target!.model.group.position.clone().add(new Vector3(0, 1, 2));
    for (let i = 0; i < 4; i++) life.hit(origin, new Vector3(0, 0, -1), 3, 25);
    life.update(.016, origin, streaming, false);
    expect(target!.health).toBe(0); expect(target!.state).toBe('down'); expect(target!.body.isEnabled()).toBe(false); expect(life.alarm).toBeGreaterThan(0);
  });
  it('steps around a curbside obstruction instead of waiting against it indefinitely', () => {
    physics.box(0, -.5, 0, 1024, 1, 1024); physics.box(-44, 1, -9.1, .6, 2, .7);
    life.update(1 / 60, new Vector3(0, 1, 0), streaming, false); const person = life.nearest(new Vector3(-42, 1, -9.1))!;
    for (let i = 0; i < 1200; i++) { life.update(1 / 60, new Vector3(0, 1, 0), streaming, false); physics.step(); }
    expect(person.model.group.position.x).toBeLessThan(-45);
  });
});
