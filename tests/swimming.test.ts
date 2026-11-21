import { describe, expect, it } from 'vitest';
import { Scene } from 'three';
import { Player } from '../src/character/Player';
import { Physics } from '../src/physics/Physics';
import { AssetManager } from '../src/assets/AssetManager';
import type { Input } from '../src/core/Input';
import type { StreamingManager } from '../src/world/StreamingManager';
describe('water locomotion', () => {
  it('floats above the real seabed, swims and can jump back toward shore', async () => {
    const physics = new Physics(); await physics.init(); const player = new Player(physics, new AssetManager(), new Scene());
    try {
      physics.box(-256, -8.5, 0, 128, 1, 128); player.teleport(-220, .7, 0);
      const stream = { ready: () => true } as unknown as StreamingManager;
      const idle = { held: () => false, take: () => false } as unknown as Input;
      for (let i = 0; i < 180; i++) { player.control(1 / 60, idle, 0, stream); physics.step(); player.sync(1 / 60); }
      expect(player.swimming).toBe(true); expect(player.position.y).toBeGreaterThan(.05); expect(player.position.y).toBeLessThan(.3);
      let jump = true, highest = 0;
      const jumping = { held: () => false, take: (key: string) => { if (key === 'Space' && jump) { jump = false; return true; } return false; } } as unknown as Input;
      for (let i = 0; i < 120; i++) { player.control(1 / 60, jumping, 0, stream); physics.step(); player.sync(1 / 60); highest = Math.max(highest, player.position.y); }
      expect(highest).toBeGreaterThan(1.3); expect(player.position.y).toBeGreaterThan(-.1);
    } finally { player.dispose(); physics.close(); }
  });
});
