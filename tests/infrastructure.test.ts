import { describe, expect, it, vi } from 'vitest';
import { bridgeElevation, infrastructureColliders, infrastructureFor } from '../src/city/Infrastructure';
import { generateChunk } from '../src/world/ProceduralGenerator';
import { Physics } from '../src/physics/Physics';
import { AssetManager } from '../src/assets/AssetManager';
import { Vehicle } from '../src/vehicle/Vehicle';
import { Scene } from 'three';
import type { StreamingManager } from '../src/world/StreamingManager';

describe('connected highway and coastal infrastructure', () => {
  it('joins the ramp and bridge deck continuously across chunk seams', () => {
    expect(bridgeElevation(-128)).toBe(0); expect(bridgeElevation(-208)).toBe(6);
    const left = infrastructureFor(generateChunk(42, '-2,-4')).filter(p => p.solid && p.d === 18);
    const right = infrastructureFor(generateChunk(42, '-1,-4')).filter(p => p.solid && p.d === 18);
    expect(left).toHaveLength(8); expect(right).toHaveLength(8);
    expect(left.at(-1)!.y + Math.tan(left.at(-1)!.pitch ?? 0) * 8).toBeCloseTo(right[0].y - Math.tan(right[0].pitch ?? 0) * 8, 5);
  });
  it('drives the real dynamic vehicle up the ramp onto the bridge', async () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) });
    const physics = new Physics(); await physics.init();
    try {
      physics.box(-220, -.5, -512, 1024, 1, 128);
      for (const id of ['-1,-4', '-2,-4', '-3,-4']) infrastructureColliders(generateChunk(42, id), physics);
      const vehicle = new Vehicle(physics, new AssetManager(), new Scene());
      vehicle.restore({ x: -110, y: 1, z: -515, yaw: Math.PI / 2, fuel: 100, health: 100 });
      vehicle.enter(); vehicle.control(1, 0, false);
      for (let i = 0; i < 660; i++) { vehicle.update(1 / 60, { ready: () => true } as unknown as StreamingManager); physics.step(); vehicle.sync(1 / 60); }
      expect(vehicle.position.x).toBeLessThan(-260); expect(vehicle.position.y).toBeGreaterThan(6.5);
      expect(vehicle.speed).toBeGreaterThan(30); vehicle.dispose();
    } finally { physics.close(); vi.unstubAllGlobals(); }
  });
  it('has deterministic variation between downtown, harbor, industry and suburbs', () => {
    expect(generateChunk(42, '4,0').district).toBe('Financial District');
    expect(generateChunk(42, '-1,4').district).toBe('Harbor');
    expect(generateChunk(42, '0,-6').district).toBe('Industrial Quarter');
    expect(generateChunk(42, '20,0').district).toBe('Suburbs');
  });
});
