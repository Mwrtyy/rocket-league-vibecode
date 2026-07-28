import { sourced } from './provenance.js';

export const CAR = Object.freeze({
  mass: sourced({ value: 180, unit: 'kg-equivalent', status: 'measured', source: 'Initial research baseline', confidence: 0.85 }),
  boostedSpeedCap: sourced({ value: 2300, unit: 'uu/s', status: 'measured', source: 'Initial research baseline', confidence: 0.98 }),
  supersonicThreshold: sourced({ value: 2200, unit: 'uu/s', status: 'measured', source: 'Initial research baseline', confidence: 0.95 }),
  normalTopSpeed: sourced({ value: 1410, unit: 'uu/s', status: 'measured', source: 'Initial research baseline', confidence: 0.95 }),
  boostConsumption: sourced({ value: 33.3, unit: 'boost/s', status: 'measured', source: 'Initial research baseline', confidence: 0.95 }),
  groundBoostAcceleration: sourced({ value: 991.666, unit: 'uu/s^2', status: 'measured', source: 'Initial research baseline', confidence: 0.9 }),
  airBoostAcceleration: sourced({ value: 1058.333, unit: 'uu/s^2', status: 'measured', source: 'Initial research baseline', confidence: 0.9 }),
  brakingAcceleration: sourced({ value: -3500, unit: 'uu/s^2', status: 'measured', source: 'Initial research baseline', confidence: 0.9 }),
  coastingAcceleration: sourced({ value: -525, unit: 'uu/s^2', status: 'measured', source: 'Initial research baseline', confidence: 0.9 }),
  airThrottleAcceleration: sourced({ value: 66.667, unit: 'uu/s^2', status: 'measured', source: 'Initial research baseline', confidence: 0.8 }),
  doubleJumpImpulse: sourced({ value: 291.667, unit: 'uu/s', status: 'measured', source: 'Initial research baseline', confidence: 0.8 }),
  maximumAngularVelocity: sourced({ value: 5.5, unit: 'rad/s', status: 'measured', source: 'Initial research baseline', confidence: 0.9 }),
});

export function steeringCurvature(speed: number): number {
  const v = Math.abs(speed);
  if (v < 500) return 0.0069 - 5.84e-6 * v;
  if (v < 1000) return 0.00561 - 3.26e-6 * v;
  if (v < 1500) return 0.0043 - 1.95e-6 * v;
  if (v < 1750) return 0.003025 - 1.1e-6 * v;
  if (v < 2500) return 0.0018 - 4e-7 * v;
  return 0;
}
