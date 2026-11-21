import { describe, expect, it, vi } from 'vitest';
import { Scene } from 'three';
import { Physics } from '../src/physics/Physics';
import { AssetManager } from '../src/assets/AssetManager';
import { Vehicle } from '../src/vehicle/Vehicle';
import { infrastructureColliders } from '../src/city/Infrastructure';
import { generateChunk } from '../src/world/ProceduralGenerator';
import type { StreamingManager } from '../src/world/StreamingManager';

describe('long-distance physical road continuity', () => {
  it('keeps the engine and chassis healthy across thousands of real bridge segments', async () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) });
    const physics = new Physics(); await physics.init(); const vehicle = new Vehicle(physics, new AssetManager(), new Scene());
    try {
      for (let cx = -63; cx < 0; cx++) infrastructureColliders(generateChunk(42, `${cx},-4`), physics);
      vehicle.restore({ x: -7200, y: 7, z: -518.7, yaw: -Math.PI / 2, fuel: 100, health: 100 }); vehicle.enter(); vehicle.control(1, 0, false);
      let minimum = 100;
      for (let i = 0; i < 10000; i++) {
        vehicle.update(1 / 60, { ready: () => true } as unknown as StreamingManager); physics.step(); vehicle.sync(1 / 60); minimum = Math.min(minimum, vehicle.health);
      }
      if (vehicle.speed < 1) physics.world.contactPairsWith(vehicle.body.collider(0), collider => {
        console.log('Stopped against', collider.translation(), collider.shape, collider.rotation());
        physics.world.contactPair(vehicle.body.collider(0), collider, manifold => console.log('Contact normal', manifold.normal(), manifold.numContacts()));
      });
      expect(vehicle.position.x, `health=${vehicle.health}, speed=${vehicle.speed}`).toBeGreaterThan(-1000);
      expect(minimum).toBeGreaterThan(95);
    } finally { vehicle.dispose(); physics.close(); vi.unstubAllGlobals(); }
  });
});
