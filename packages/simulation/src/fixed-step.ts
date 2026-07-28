import { FIXED_DT } from './constants/world.js';

export interface FixedStepStats {
  steps: number;
  alpha: number;
  droppedSeconds: number;
}

export class FixedStepRunner {
  private accumulator = 0;
  private droppedSeconds = 0;

  public constructor(
    private readonly step: (dt: number) => void,
    private readonly fixedDt = FIXED_DT,
    private readonly maxCatchUpSteps = 8,
  ) {}

  public advance(elapsedSeconds: number): FixedStepStats {
    const safeElapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
    this.accumulator += safeElapsed;
    let steps = 0;

    const comparisonEpsilon = this.fixedDt * 1e-9;
    while (this.accumulator + comparisonEpsilon >= this.fixedDt && steps < this.maxCatchUpSteps) {
      this.step(this.fixedDt);
      this.accumulator = Math.max(0, this.accumulator - this.fixedDt);
      steps += 1;
    }

    if (this.accumulator >= this.fixedDt) {
      const retained = this.accumulator % this.fixedDt;
      this.droppedSeconds += this.accumulator - retained;
      this.accumulator = retained;
    }

    return {
      steps,
      alpha: this.accumulator / this.fixedDt,
      droppedSeconds: this.droppedSeconds,
    };
  }

  public reset(): void {
    this.accumulator = 0;
    this.droppedSeconds = 0;
  }
}
