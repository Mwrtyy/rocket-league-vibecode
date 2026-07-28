import { describe, expect, it } from 'vitest';
import { hashSimulationState } from './hash.js';
import { ReferenceBallSimulation } from './reference-simulation.js';

function replayHash(): string {
  const simulation = new ReferenceBallSimulation();
  simulation.setBall(
    { x: 100, y: -250, z: 1500 },
    { x: 1200, y: 500, z: -50 },
    { x: 1, y: 2, z: 3 },
  );
  for (let tick = 0; tick < 2400; tick += 1) simulation.step();
  return hashSimulationState(simulation.getState());
}

describe('determinism', () => {
  it('reconstructs an identical final hash from the same initial state', () => {
    expect(replayHash()).toBe(replayHash());
  });
});
