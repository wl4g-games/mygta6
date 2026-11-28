import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Physics, RAPIER } from '../src/physics/Physics';
import { Vehicle } from '../src/vehicle/Vehicle';
import { AssetManager } from '../src/assets/AssetManager';
import { Scene, Vector3 } from 'three';
import { canReachVehicle } from '../src/vehicle/VehicleAccess';
import type { StreamingManager } from '../src/world/StreamingManager';
import { Player } from '../src/character/Player';
describe('Rapier physics lifetime and solid obstacles', () => {
  let physics: Physics;
  beforeEach(async () => { physics = new Physics(); await physics.init(); });
  afterEach(() => physics.close());
  it('allows entry to a nearby physical vehicle and rejects an intervening wall', () => {
    const car = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, .8, 0));
    physics.world.createCollider(RAPIER.ColliderDesc.cuboid(1, .7, 2), car);
    const wall = physics.box(0, 1.2, -3, 4, 2.4, .2), player = new Vector3(0, 1, -5); physics.step();
    expect(canReachVehicle(physics, player, car)).toBe(false);
    physics.remove(wall); physics.step(); expect(canReachVehicle(physics, player, car)).toBe(true);
    car.setEnabled(false); physics.step(); expect(canReachVehicle(physics, player, car)).toBe(false);
  });
  it('rests a vehicle-sized body on the floor and releases all its shapes', () => {
    const floor = physics.box(0, -.5, 0, 128, 1, 128);
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 3, 0));
    physics.world.createCollider(RAPIER.ColliderDesc.cuboid(1, .5, 2).setMass(1200), body);
    for (let i = 0; i < 180; i++) physics.step();
    expect(body.translation().y).toBeGreaterThan(.45); expect(body.translation().y).toBeLessThan(.6);
    physics.world.removeRigidBody(body); physics.remove(floor); expect(physics.world.colliders.len()).toBe(0);
  });
  it('slides the character along a real wall instead of crossing it', () => {
    physics.box(0, -.5, 0, 128, 1, 128); physics.box(0, 2, -2, 20, 4, .5);
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 0));
    const collider = physics.world.createCollider(RAPIER.ColliderDesc.capsule(.65, .33), body);
    const controller = physics.world.createCharacterController(.02);
    for (let i = 0; i < 120; i++) {
      controller.computeColliderMovement(collider, { x: .02, y: -.01, z: -.1 });
      const p = body.translation(), m = controller.computedMovement(); body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z }); physics.step();
    }
    expect(body.translation().z).toBeGreaterThan(-1.5); expect(body.translation().x).toBeGreaterThan(1);
    physics.world.removeCharacterController(controller); physics.world.removeRigidBody(body);
  });
  it('accelerates the actual vehicle on a physical road', () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) });
    physics.box(0, -.5, 0, 1024, 1, 1024);
    const assets = new AssetManager(), vehicle = new Vehicle(physics, assets, new Scene());
    vehicle.enter(); vehicle.control(1, 0, false);
    for (let i = 0; i < 180; i++) {
      vehicle.update(1 / 60, { ready: () => true } as unknown as StreamingManager);
      vehicle.body.setEnabled(true); physics.step(); vehicle.sync(1 / 60);
    }
    expect(vehicle.position.x).toBeGreaterThan(30); expect(vehicle.position.y).toBeGreaterThan(.65);
    vehicle.dispose(); vi.unstubAllGlobals();
  });
  it('can drive after the player enters and follows the vehicle', () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) });
    physics.box(0, -.5, 0, 1024, 1, 1024);
    const assets = new AssetManager(), scene = new Scene();
    const vehicle = new Vehicle(physics, assets, scene), player = new Player(physics, assets, scene);
    for (let i = 0; i < 180; i++) { physics.step(); vehicle.sync(1 / 60); }
    player.setEnabled(false); vehicle.enter(); vehicle.control(1, 0, false);
    for (let i = 0; i < 180; i++) {
      vehicle.update(1 / 60, { ready: () => true } as unknown as StreamingManager);
      player.teleport(vehicle.position.x, vehicle.position.y + .4, vehicle.position.z);
      vehicle.body.setEnabled(true); physics.step(); vehicle.sync(1 / 60);
    }
    expect(vehicle.position.x).toBeGreaterThan(30); expect(vehicle.position.y).toBeGreaterThan(.65);
    player.dispose(); vehicle.dispose(); vi.unstubAllGlobals();
  });
});
