import { describe, expect, it } from 'vitest';
import { ArcadeRound } from '../src/economy/ArcadeRound';
describe('skill-based arcade round', () => {
  it('scores only real hits, pays once after time expires, and rejects further hits', () => {
    const round = new ArcadeRound(() => .5);
    expect(round.hit(0, 0)).toBe(false); expect(round.claimReward()).toBe(0);
    for (let i = 0; i < 16; i++) expect(round.hit(round.target.x, round.target.y)).toBe(true);
    round.update(20); expect(round.claimReward()).toBe(25); expect(round.claimReward()).toBe(0); expect(round.hit(.5, .5)).toBe(false);
  });
});
