import { describe, expect, it } from 'vitest';
import { generateChunk } from '../src/world/ProceduralGenerator';
import { planStreaming } from '../src/world/StreamingManager';
import { chunkAt } from '../src/config/game';

describe('deterministic world and streaming priorities', () => {
  it('generates exactly the same city regardless of request order', () => {
    const first = generateChunk(42, '2,-3');
    generateChunk(42, '9,8');
    expect(generateChunk(42, '2,-3')).toEqual(first);
    expect(generateChunk(43, '2,-3')).not.toEqual(first);
  });
  it('maps negative coordinates continuously at chunk boundaries', () => {
    expect(chunkAt(63.99, -64)).toEqual({ x: 0, z: 0 });
    expect(chunkAt(64, -64.01)).toEqual({ x: 1, z: -1 });
  });
  it('keeps active collision coverage and deduplicates predictive loads', () => {
    const targets = planStreaming(0, 0, 43, 0, 3);
    expect(targets.filter(t => t.state === 'ACTIVE')).toHaveLength(9);
    expect(new Set(targets.map(t => t.id)).size).toBe(targets.length);
    expect(targets.find(t => t.id === '1,0')!.priority).toBeLessThan(targets.find(t => t.id === '-1,0')!.priority);
    expect(targets.some(t => t.id === '2,0' && t.state !== 'FAR')).toBe(true);
  });
  it('bounds runtime residency independently from logical world size', () => {
    for (let x = 0; x < 8000; x += 431) expect(planStreaming(x, 10, 43, 0, 3).length).toBeLessThanOrEqual(58);
  });
  it('reprioritizes immediately after a high-speed U-turn', () => {
    const targets = planStreaming(300, 0, -40, 0, 3);
    expect(targets.find(t => t.id === '1,0')!.priority).toBeLessThan(targets.find(t => t.id === '4,0')!.priority);
  });
});
