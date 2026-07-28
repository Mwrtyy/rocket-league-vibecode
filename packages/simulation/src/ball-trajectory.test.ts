import { describe, expect, it } from 'vitest';
import { BALL } from './constants/ball.js';
import { FIXED_DT, WORLD } from './constants/world.js';
import { ReferenceBallSimulation } from './reference-simulation.js';

describe('ReferenceBallSimulation', () => {
  it('matches discrete free-fall integration before contact', () => {
    const simulation = new ReferenceBallSimulation();
    simulation.setBall({ x: 0, y: 0, z: 2000 }, { x: 0, y: 0, z: 0 });
    for (let tick = 0; tick < 120; tick += 1) simulation.step();
    const state = simulation.getState();
    const expectedVelocity = -WORLD.gravity.value;
    const expectedPosition = 2000 - WORLD.gravity.value * FIXED_DT * FIXED_DT * (120 * 121) / 2;
    expect(state.ball.linearVelocity.z).toBeCloseTo(expectedVelocity, 8);
    expect(state.ball.position.z).toBeCloseTo(expectedPosition, 8);
  });

  it('caps total linear speed by magnitude', () => {
    const simulation = new ReferenceBallSimulation();
    simulation.setBall({ x: 0, y: 0, z: 2000 }, { x: 8000, y: 8000, z: 0 });
    simulation.step();
    const velocity = simulation.getState().ball.linearVelocity;
    expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeCloseTo(BALL.maximumLinearSpeed.value, 8);
  });

  it('keeps the ball above the floor contact plane', () => {
    const simulation = new ReferenceBallSimulation();
    simulation.setBall({ x: 0, y: 0, z: BALL.radius.value + 1 }, { x: 0, y: 0, z: -1000 });
    simulation.step();
    expect(simulation.getState().ball.position.z).toBe(BALL.radius.value);
    expect(simulation.getState().ball.linearVelocity.z).toBeGreaterThan(0);
  });
});
