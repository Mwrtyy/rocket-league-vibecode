import { describe, expect, it } from 'vitest';
import { BOOST_PAD_LAYOUT } from './constants/boost.js';
import { FIXED_DT } from './constants/world.js';
import { GameSimulation } from './game-simulation.js';
import { NEUTRAL_INPUT } from './input.js';
import { createInitialState } from './state.js';

function matchSimulation() {
  return new GameSimulation(undefined, { matchMode: true });
}

describe('standard arena data', () => {
  it('contains all 34 boost pads with six large pads', () => {
    expect(BOOST_PAD_LAYOUT).toHaveLength(34);
    expect(BOOST_PAD_LAYOUT.filter((pad) => pad.isLarge)).toHaveLength(6);
    expect(new Set(BOOST_PAD_LAYOUT.map((pad) => pad.id)).size).toBe(34);
  });
});

describe('match rules', () => {
  it('holds physics during the exact three-second kickoff countdown', () => {
    const simulation = matchSimulation();
    const initial = simulation.getState();
    for (let tick = 0; tick < 359; tick += 1) simulation.step(NEUTRAL_INPUT);
    expect(simulation.getState().match.phase).toBe('countdown');
    simulation.step(NEUTRAL_INPUT);
    const state = simulation.getState();
    expect(state.match.phase).toBe('playing');
    expect(state.match.countdownSeconds).toBe(0);
    expect(state.car.position).toEqual(initial.car.position);
  });

  it('detects a full-ball goal-line crossing and credits the attacking team', () => {
    const initial = createInitialState(true);
    initial.match.phase = 'playing';
    initial.match.countdownSeconds = 0;
    initial.ball.position = { x: 0, y: 5118, z: 91.25 };
    initial.ball.linearVelocity = { x: 0, y: 600, z: 0 };
    initial.car.position = { x: 3000, y: 0, z: 18.08 };
    const simulation = new GameSimulation(initial, { matchMode: true });
    simulation.step(NEUTRAL_INPUT);
    const match = simulation.getState().match;
    expect(match.blueScore).toBe(1);
    expect(match.orangeScore).toBe(0);
    expect(match.lastScorer).toBe('blue');
    expect(match.phase).toBe('goal');
  });

  it('grants a small pad once and respawns it after exactly four seconds', () => {
    const initial = createInitialState(false);
    initial.car.position = { x: -1024, y: 0, z: 18.08 };
    initial.car.boost = 20;
    const simulation = new GameSimulation(initial);
    simulation.step(NEUTRAL_INPUT);
    let state = simulation.getState();
    expect(state.car.boost).toBe(32);
    expect(state.boostPads[16]?.active).toBe(false);

    simulation.setCar({ x: 0, y: -2000, z: 18.08 });
    for (let tick = 0; tick < 479; tick += 1) simulation.step(NEUTRAL_INPUT);
    expect(simulation.getState().boostPads[16]?.active).toBe(false);
    simulation.step(NEUTRAL_INPUT);
    state = simulation.getState();
    expect(state.boostPads[16]?.active).toBe(true);
    expect(state.boostPads[16]?.respawnSeconds).toBe(0);
  });

  it('fills boost from a large pad and uses the ten-second respawn', () => {
    const initial = createInitialState(false);
    initial.car.position = { x: -3584, y: 0, z: 18.08 };
    initial.car.boost = 1;
    const simulation = new GameSimulation(initial);
    simulation.step(NEUTRAL_INPUT);
    expect(simulation.getState().car.boost).toBe(100);
    expect(simulation.getState().boostPads[15]?.active).toBe(false);

    simulation.setCar({ x: 0, y: -2000, z: 18.08 });
    for (let tick = 0; tick < 1199; tick += 1) simulation.step(NEUTRAL_INPUT);
    expect(simulation.getState().boostPads[15]?.active).toBe(false);
    simulation.step(NEUTRAL_INPUT);
    expect(simulation.getState().boostPads[15]?.active).toBe(true);
  });

  it('keeps a tied match alive at zero and enters overtime after ground contact', () => {
    const initial = createInitialState(true);
    initial.match.phase = 'playing';
    initial.match.countdownSeconds = 0;
    initial.match.clockSeconds = 0;
    initial.match.zeroSecondActive = true;
    initial.ball.position.z = 91.25;
    const simulation = new GameSimulation(initial, { matchMode: true });

    simulation.step(NEUTRAL_INPUT);
    expect(simulation.getState().match.phase).toBe('countdown');
    expect(simulation.getState().match.clockSeconds).toBe(0);
    for (let tick = 0; tick < 360; tick += 1) simulation.step(NEUTRAL_INPUT);
    expect(simulation.getState().match.phase).toBe('overtime');
  });

  it('ends immediately when an overtime goal is scored', () => {
    const initial = createInitialState(true);
    initial.match.phase = 'overtime';
    initial.match.countdownSeconds = 0;
    initial.match.clockSeconds = 0;
    initial.ball.position = { x: 0, y: -5118, z: 91.25 };
    initial.ball.linearVelocity = { x: 0, y: -600, z: 0 };
    initial.car.position = { x: 3000, y: 0, z: 18.08 };
    const simulation = new GameSimulation(initial, { matchMode: true });
    simulation.step(NEUTRAL_INPUT, FIXED_DT);
    const match = simulation.getState().match;
    expect(match.orangeScore).toBe(1);
    expect(match.phase).toBe('ended');
  });

  it('ends a regulation match when a zero-second goal breaks the tie', () => {
    const initial = createInitialState(true);
    initial.match.phase = 'playing';
    initial.match.countdownSeconds = 0;
    initial.match.clockSeconds = 0;
    initial.match.zeroSecondActive = true;
    initial.ball.position = { x: 0, y: 5118, z: 91.25 };
    initial.ball.linearVelocity = { x: 0, y: 600, z: 0 };
    initial.car.position = { x: 3000, y: 0, z: 18.08 };
    const simulation = new GameSimulation(initial, { matchMode: true });
    simulation.step(NEUTRAL_INPUT);
    expect(simulation.getState().match.blueScore).toBe(1);
    expect(simulation.getState().match.phase).toBe('ended');
  });
});
