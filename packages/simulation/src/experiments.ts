import type { Vec3 } from '@aether/shared';
import { FIXED_DT } from './constants/world.js';
import { ReferenceBallSimulation } from './reference-simulation.js';

export interface TrajectorySample {
  tick: number;
  time: number;
  position: Vec3;
  velocity: Vec3;
}

export function runBallExperiment(options: {
  durationSeconds: number;
  position: Vec3;
  velocity: Vec3;
}): TrajectorySample[] {
  const simulation = new ReferenceBallSimulation();
  simulation.setBall(options.position, options.velocity);
  const ticks = Math.round(options.durationSeconds / FIXED_DT);
  const samples: TrajectorySample[] = [];

  for (let tick = 0; tick <= ticks; tick += 1) {
    const state = simulation.getState();
    samples.push({
      tick: state.tick,
      time: state.tick * FIXED_DT,
      position: structuredClone(state.ball.position),
      velocity: structuredClone(state.ball.linearVelocity),
    });
    if (tick < ticks) simulation.step();
  }
  return samples;
}
