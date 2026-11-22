import { expect, it } from 'vitest';
import { nearbyPlaces } from '../src/city/Places';
it('finds real mainland services for callers on the coast without loading world objects', () => {
  for (const x of [-2000, -8190, 32]) {
    const places = nearbyPlaces(x, -512); expect(places.length).toBeGreaterThanOrEqual(19);
    expect(places.every(place => place.store.x >= -96 && Number.isFinite(place.distance))).toBe(true);
    expect(places.some(place => place.store.archetype.kind === 'electronics')).toBe(true);
  }
});
