export class KalmanFilter {
  private Q: number;
  private R: number;
  private P: number;
  private X: number;
  private K: number;

  constructor(initialValue: number = 0, processNoise: number = 0.001, measurementNoise: number = 0.1) {
    this.Q = processNoise;
    this.R = measurementNoise;
    this.P = 1;
    this.X = initialValue;
    this.K = 0;
  }

  update(measurement: number): number {
    this.P = this.P + this.Q;
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    return this.X;
  }

  reset(value: number = 0): void {
    this.X = value;
    this.P = 1;
  }
}