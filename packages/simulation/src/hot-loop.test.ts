import { describe, expect, it, vi } from 'vitest';
import {
  GameSimulation,
  createGameViewState,
  createInterpolatedGameState,
} from './game-simulation.js';
import { type PlayerInputFrame } from './input.js';

describe('GameSimulation hot-loop state access', () => {
  it('does not deep-clone state while stepping and writing reusable render views', () => {
    const simulation = new GameSimulation();
    const interpolated = createInterpolatedGameState();
    const view = createGameViewState();
    const input: PlayerInputFrame = {
      sequence: 0,
      tick: 0,
      throttle: 1,
      steer: 0.25,
      pitch: 0,
      yaw: 0.25,
      roll: 0,
      jump: false,
      boost: false,
      handbrake: false,
      ballCam: true,
    };
    const cloneSpy = vi.spyOn(globalThis, 'structuredClone');

    try {
      for (let tick = 0; tick < 1000; tick += 1) {
        input.sequence = tick;
        input.tick = simulation.getTick();
        input.jump = tick === 240 || tick === 300;
        input.boost = tick > 400 && tick < 520;
        expect(simulation.interpolate(0.5, interpolated)).toBe(interpolated);
        expect(simulation.writeViewState(view)).toBe(view);
        simulation.step(input);
      }

      expect(simulation.getTick()).toBe(1000);
      expect(view.boostPadActive).toHaveLength(34);
      expect(cloneSpy).not.toHaveBeenCalled();
    } finally {
      cloneSpy.mockRestore();
    }
  });

  it('keeps explicit full snapshots isolated from authoritative state', () => {
    const simulation = new GameSimulation();
    const first = simulation.getState();
    first.car.position.x = 999_999;
    first.boostPads[0]!.active = false;

    const second = simulation.getState();
    expect(second.car.position.x).not.toBe(999_999);
    expect(second.boostPads[0]!.active).toBe(true);
  });
});
