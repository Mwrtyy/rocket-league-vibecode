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
    state.car.position.x,
    state.car.position.y,
    state.car.position.z,
    state.car.linearVelocity.x,
    state.car.linearVelocity.y,
    state.car.linearVelocity.z,
    state.car.angularVelocity.x,
    state.car.angularVelocity.y,
    state.car.angularVelocity.z,
    state.car.rotation.yaw,
    state.car.rotation.pitch,
    state.car.rotation.roll,
    state.car.boost,
    state.car.grounded ? 1 : 0,
    state.car.jump.firstJumpConsumed ? 1 : 0,
    state.car.jump.secondJumpConsumed ? 1 : 0,
    state.car.jump.jumpHeldSeconds,
    state.car.jump.airborneSeconds,
    state.car.jump.dodgeActiveSeconds,
    state.match.clockSeconds,
    state.match.countdownSeconds,
    state.match.goalPauseSeconds,
    state.match.blueScore,
    state.match.orangeScore,
    state.match.zeroSecondActive ? 1 : 0,
    state.match.phase.length,
    state.match.lastScorer === 'blue' ? 1 : state.match.lastScorer === 'orange' ? 2 : 0,
    ...state.boostPads.flatMap((pad) => [pad.id, pad.active ? 1 : 0, pad.respawnSeconds]),
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
