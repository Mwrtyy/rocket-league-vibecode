import type { SimulationState } from './state.js';

function quantize(value: number): number {
  return Math.round(value * 1000);
}

export function hashSimulationState(state: Readonly<SimulationState>): string {
  const values = [
    state.tick,
    state.ball.position.x,
    state.ball.position.y,
    state.ball.position.z,
    state.ball.linearVelocity.x,
    state.ball.linearVelocity.y,
    state.ball.linearVelocity.z,
    state.ball.angularVelocity.x,
    state.ball.angularVelocity.y,
    state.ball.angularVelocity.z,
  ].map(quantize);

  let hash = 0x811c9dc5;
  for (const value of values) {
    const text = String(value);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
