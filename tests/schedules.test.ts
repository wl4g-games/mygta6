import { describe, expect, it } from 'vitest';
import { hoursLabel, isStoreOpen } from '../src/store/StoreSchedule';
describe('merchant hours', () => {
  it('supports overnight bars and daytime businesses with explicit opening boundaries', () => {
    expect(isStoreOpen('bar', 23)).toBe(true); expect(isStoreOpen('bar', 3)).toBe(true); expect(isStoreOpen('bar', 10)).toBe(false);
    expect(isStoreOpen('cafe', 7)).toBe(true); expect(isStoreOpen('cafe', 22)).toBe(false); expect(isStoreOpen('hotel', 2)).toBe(true);
    expect(hoursLabel('cafe')).toBe('07:00–22:00');
  });
});
