import { describe, expect, it } from 'vitest';
import { Preferences, resolveKey } from '../src/config/Preferences';

describe('persistent control and graphics preferences', () => {
  it('swaps conflicting mappings and prevents the old physical key from activating twice', () => {
    const preferences = new Preferences(); preferences.bind('KeyW', 'KeyZ');
    expect(resolveKey('KeyZ', preferences.state.bindings)).toBe('KeyW'); expect(resolveKey('KeyW', preferences.state.bindings)).toBeNull();
    preferences.bind('KeyE', 'KeyF'); expect(preferences.state.bindings.KeyF).toBe('KeyE');
    expect(preferences.bind('KeyW', 'Escape')).toBe(false);
  });
  it('roundtrips settings independently of the current save and tolerates corrupt storage', () => {
    let saved = ''; const storage = { getItem: () => saved, setItem: (_: string, value: string) => { saved = value; } };
    const preferences = new Preferences(storage); preferences.quality('low'); preferences.volume(.4); preferences.bind('KeyF', 'KeyZ');
    expect(new Preferences(storage).state).toEqual(preferences.state);
    saved = '{'; expect(new Preferences(storage).state.quality).toBe('medium');
  });
});
