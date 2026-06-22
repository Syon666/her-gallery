export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number = 0;
  private dxPrev: number = 0;
  private hasPrev: boolean = false;

  constructor(minCutoff: number = 1.0, beta: number = 0.0, dCutoff: number = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  filter(value: number, dt: number = 0.016): number {
    const dx = this.hasPrev ? (value - this.xPrev) / dt : 0;
    const edx = this.alpha(this.dCutoff, dt) * dx + (1 - this.alpha(this.dCutoff, dt)) * this.dxPrev;
    this.dxPrev = edx;

    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const alpha = this.alpha(cutoff, dt);

    const filtered = alpha * value + (1 - alpha) * this.xPrev;
    this.xPrev = filtered;
    this.hasPrev = true;

    return filtered;
  }

  reset(value?: number): void {
    this.hasPrev = false;
    if (value !== undefined) {
      this.xPrev = value;
    }
  }
}