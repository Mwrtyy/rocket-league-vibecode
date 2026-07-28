import { clampMagnitude, cloneVec3, lerpVec3, type Vec3 } from '@aether/shared';
import { BALL } from './constants/ball.js';
import { FIXED_DT, WORLD } from './constants/world.js';
import type { PlayerInputFrame } from './input.js';
import { createInitialState, type SimulationState } from './state.js';

export interface InterpolatedState {
  tick: number;
  ballPosition: Vec3;
}

export class ReferenceBallSimulation {
  private current: SimulationState;
  private previous: SimulationState;

  public constructor(initialState: SimulationState = createInitialState()) {
    this.current = structuredClone(initialState);
    this.previous = structuredClone(initialState);
  }

  public step(_input?: Readonly<PlayerInputFrame>, dt = FIXED_DT): void {
    this.previous = structuredClone(this.current);
    const ball = this.current.ball;

    ball.linearVelocity.z -= WORLD.gravity.value * dt;
    clampMagnitude(ball.linearVelocity, BALL.maximumLinearSpeed.value);
    clampMagnitude(ball.angularVelocity, BALL.maximumAngularSpeed.value);

    ball.position.x += ball.linearVelocity.x * dt;
    ball.position.y += ball.linearVelocity.y * dt;
    ball.position.z += ball.linearVelocity.z * dt;

    const floorContact = WORLD.floorZ.value + BALL.radius.value;
    if (ball.position.z < floorContact) {
      ball.position.z = floorContact;
      if (ball.linearVelocity.z < 0) {
        ball.linearVelocity.z = -ball.linearVelocity.z * BALL.restitution.value;
      }
    }

    this.current.tick += 1;
  }

  public getState(): SimulationState {
    return structuredClone(this.current);
  }

  public setBall(position: Readonly<Vec3>, linearVelocity: Readonly<Vec3>, angularVelocity: Readonly<Vec3> = { x: 0, y: 0, z: 0 }): void {
    this.current.ball.position = cloneVec3(position);
    this.current.ball.linearVelocity = cloneVec3(linearVelocity);
    this.current.ball.angularVelocity = cloneVec3(angularVelocity);
    this.previous = structuredClone(this.current);
  }

  public interpolate(alpha: number): InterpolatedState {
    const clampedAlpha = Math.min(1, Math.max(0, alpha));
    return {
      tick: this.current.tick,
      ballPosition: lerpVec3(this.previous.ball.position, this.current.ball.position, clampedAlpha),
    };
  }
}
