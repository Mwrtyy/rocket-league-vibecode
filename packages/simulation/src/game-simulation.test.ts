import { describe, expect, it } from 'vitest';
import { CAR } from './constants/car.js';
import { FIXED_DT } from './constants/world.js';
import { GameSimulation } from './game-simulation.js';
import { hashSimulationState } from './hash.js';
import { NEUTRAL_INPUT, type PlayerInputFrame } from './input.js';
import { createInitialState } from './state.js';

function frame(overrides: Partial<PlayerInputFrame> = {}): PlayerInputFrame {
  return { ...NEUTRAL_INPUT, ...overrides };
}

function simulationWithoutPads(): GameSimulation {
  const initial = createInitialState(false);
  for (const pad of initial.boostPads) {
    pad.active = false;
    pad.respawnSeconds = 999;
  }
  return new GameSimulation(initial);
}

function horizontalSpeed(simulation: GameSimulation): number {
  const velocity = simulation.getState().car.linearVelocity;
  return Math.hypot(velocity.x, velocity.y);
}

describe('GameSimulation car core', () => {
  it('accelerates toward the measured no-boost top speed without exceeding it', () => {
    const simulation = simulationWithoutPads();
    simulation.setBall({ x: 3000, y: 0, z: 91.25 }, { x: 0, y: 0, z: 0 });
    for (let tick = 0; tick < 480; tick += 1) simulation.step(frame({ throttle: 1 }));
    expect(horizontalSpeed(simulation)).toBeGreaterThan(1380);
    expect(horizontalSpeed(simulation)).toBeLessThanOrEqual(CAR.normalTopSpeed.value + 0.01);
  });

  it('consumes boost at the sourced rate and remains under the total speed cap', () => {
    const simulation = simulationWithoutPads();
    simulation.setBall({ x: 3000, y: 0, z: 91.25 }, { x: 0, y: 0, z: 0 });
    for (let tick = 0; tick < 120; tick += 1) {
      simulation.step(frame({ throttle: 1, boost: true }));
    }
    const state = simulation.getState();
    expect(state.car.boost).toBeCloseTo(100 - CAR.boostConsumption.value, 4);
    expect(horizontalSpeed(simulation)).toBeLessThanOrEqual(CAR.boostedSpeedCap.value + 0.01);
  });

  it('uses braking acceleration when throttle opposes forward motion', () => {
    const simulation = simulationWithoutPads();
    simulation.setBall({ x: 3000, y: 0, z: 91.25 }, { x: 0, y: 0, z: 0 });
    for (let tick = 0; tick < 120; tick += 1) simulation.step(frame({ throttle: 1 }));
    const before = simulation.getState().car.linearVelocity.y;
    for (let tick = 0; tick < 30; tick += 1) simulation.step(frame({ throttle: -1 }));
    expect(before).toBeGreaterThan(900);
    expect(simulation.getState().car.linearVelocity.y).toBeLessThan(before - 700);
  });

  it('supports a held first jump and leaves the floor', () => {
    const simulation = simulationWithoutPads();
    for (let tick = 0; tick < 13; tick += 1) simulation.step(frame({ jump: true }));
    const car = simulation.getState().car;
    expect(car.grounded).toBe(false);
    expect(car.position.z).toBeGreaterThan(50);
    expect(car.linearVelocity.z).toBeGreaterThan(350);
  });

  it('converts a second jump with directional input into an emergent dodge impulse', () => {
    const simulation = simulationWithoutPads();
    simulation.step(frame({ jump: true }));
    simulation.step(frame({ jump: false }));
    for (let tick = 0; tick < 20; tick += 1) simulation.step(frame());
    simulation.step(frame({ jump: true, pitch: -1 }));
    const car = simulation.getState().car;
    expect(car.jump.secondJumpConsumed).toBe(true);
    expect(car.jump.dodgeActiveSeconds).toBeGreaterThan(0.6);
    expect(car.linearVelocity.y).toBeGreaterThan(450);
  });

  it('transfers car momentum into the ball through an oriented hitbox contact', () => {
    const simulation = simulationWithoutPads();
    simulation.setCar({ x: 0, y: 0, z: 18.08 }, { x: 0, y: 1000, z: 0 }, 0);
    simulation.setBall({ x: 0, y: 150, z: 91.25 }, { x: 0, y: 0, z: 0 });
    for (let tick = 0; tick < 20; tick += 1) simulation.step(frame({ throttle: 1 }));
    const ball = simulation.getState().ball;
    expect(ball.linearVelocity.y).toBeGreaterThan(700);
    expect(ball.linearVelocity.z).toBeGreaterThan(400);
  });

  it('produces the same complete-state hash for an identical input stream', () => {
    const first = simulationWithoutPads();
    const second = simulationWithoutPads();
    for (let tick = 0; tick < 600; tick += 1) {
      const input = frame({
        sequence: tick,
        tick,
        throttle: tick < 300 ? 1 : 0,
        steer: Math.sin(tick / 60) * 0.4,
        boost: tick > 120 && tick < 240,
        jump: tick === 330 || tick === 390,
        pitch: tick === 390 ? -1 : 0,
      });
      first.step(input, FIXED_DT);
      second.step(input, FIXED_DT);
    }
    expect(hashSimulationState(first.getState())).toBe(hashSimulationState(second.getState()));
  });
});
