import type { Vec3 } from '@aether/shared';

export interface BallState {
  position: Vec3;
  linearVelocity: Vec3;
  angularVelocity: Vec3;
}

export interface CarRotation {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface CarJumpState {
  firstJumpConsumed: boolean;
  secondJumpConsumed: boolean;
  jumpHeldSeconds: number;
  airborneSeconds: number;
  dodgeActiveSeconds: number;
}

export interface CarState {
  position: Vec3;
  linearVelocity: Vec3;
  angularVelocity: Vec3;
  rotation: CarRotation;
  boost: number;
  grounded: boolean;
  supersonic: boolean;
  jump: CarJumpState;
}

export interface SimulationState {
  tick: number;
  ball: BallState;
  car: CarState;
}

export function createInitialState(): SimulationState {
  return {
    tick: 0,
    ball: {
      position: { x: 0, y: 0, z: 1000 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
    },
    car: {
      position: { x: 0, y: -1200, z: 18.08 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      rotation: { yaw: 0, pitch: 0, roll: 0 },
      boost: 100,
      grounded: true,
      supersonic: false,
      jump: {
        firstJumpConsumed: false,
        secondJumpConsumed: false,
        jumpHeldSeconds: 0,
        airborneSeconds: 0,
        dodgeActiveSeconds: 0,
      },
    },
  };
}
