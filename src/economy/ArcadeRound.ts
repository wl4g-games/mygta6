/** Original reflex game state, independent of its canvas and the world's wallet. */
export class ArcadeRound {
  remaining = 20;
  score = 0;
  target = { x: .5, y: .5 };
  private movement = .85;
  private claimed = false;
  constructor(private readonly random: () => number = Math.random) { this.moveTarget(); }
  private moveTarget() { this.target = { x: .12 + this.random() * .76, y: .14 + this.random() * .72 }; this.movement = .85; }
  update(dt: number) {
    if (this.remaining <= 0) return;
    this.remaining = Math.max(0, this.remaining - dt); this.movement -= dt; if (this.movement <= 0) this.moveTarget();
  }
  hit(x: number, y: number) {
    if (this.remaining <= 0 || Math.hypot(x - this.target.x, y - this.target.y) > .065) return false;
    this.score++; this.moveTarget(); return true;
  }
  claimReward() {
    if (this.remaining > 0 || this.claimed) return 0;
    this.claimed = true; return this.score >= 16 ? 25 : this.score >= 8 ? 12 : 0;
  }
}
