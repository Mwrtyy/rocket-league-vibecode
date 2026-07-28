import { describe, expect, it } from 'vitest';
import { FIXED_DT } from './constants/world.js';
import { FixedStepRunner } from './fixed-step.js';

function runAtRenderRate(renderHz: number, seconds: number): number {
  let ticks = 0;
  const runner = new FixedStepRunner(() => {
    ticks += 1;
  });
  const frames = Math.round(renderHz * seconds);
  for (let frame = 0; frame < frames; frame += 1) runner.advance(1 / renderHz);
  return ticks;
}

describe('FixedStepRunner', () => {
  it.each([30, 60, 120, 144])(
    'advances identical gameplay ticks at %i Hz rendering',
    (renderHz) => {
      expect(runAtRenderRate(renderHz, 2)).toBe(240);
    },
  );

  it('bounds catch-up work and reports dropped time', () => {
    let ticks = 0;
    const runner = new FixedStepRunner(
      () => {
        ticks += 1;
      },
      FIXED_DT,
      4,
    );
    const stats = runner.advance(1);
    expect(ticks).toBe(4);
    expect(stats.droppedSeconds).toBeGreaterThan(0.9);
  });
});
