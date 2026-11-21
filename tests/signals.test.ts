import { describe, expect, it } from 'vitest';
import { trafficSignals } from '../src/city/TrafficSignals';
describe('shared traffic phases', () => {
  it('never gives conflicting vehicle streams a green light', () => {
    for (let t = 0; t < 280; t += .1) { const phase = trafficSignals(t); expect(phase.x === 'green' && phase.z === 'green').toBe(false); }
  });
  it('has amber and all-red clearance before the crossing street goes green', () => {
    expect(trafficSignals(11.5)).toEqual({ x: 'amber', z: 'red' }); expect(trafficSignals(13.5)).toEqual({ x: 'red', z: 'red' });
    expect(trafficSignals(14.5)).toEqual({ x: 'red', z: 'green' }); expect(trafficSignals(27.5)).toEqual({ x: 'red', z: 'red' });
  });
});
