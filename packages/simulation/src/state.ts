import type { Vec3 } from '@aether/shared';

export interface BallState {
  position: Vec3;
  linearVelocity: Vec3;
  angularVelocity: Vec3;
}

export interface SimulationState {
  tick: number;
  ball: BallState;
}

export function createInitialState(): SimulationState {
  return {
    tick: 0,
    ball: {
      position: { x: 0, y: 0, z: 1000 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
    },
  };
}
