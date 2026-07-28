import { sourced } from './provenance.js';

export const CAR = Object.freeze({
  mass: sourced({ value: 180, unit: 'kg-equivalent', status: 'measured', source: 'Initial research baseline', confidence: 0.85 }),
  hitboxLength: sourced({ value: 118.01, unit: 'uu', status: 'measured', source: 'Octane-type public hitbox measurements', confidence: 0.92 }),
  hitboxWidth: sourced({ value: 84.2, unit: 'uu', status: 'measured', source: 'Octane-type public hitbox measurements', confidence: 0.92 }),
  hitboxHeight: sourced({ value: 36.16, unit: 'uu', status: 'measured', source: 'Octane-type public hitbox measurements', confidence: 0.92 }),
  boostedSpeedCap: sourced({ value: 2300, unit: 'uu/s', status: 'measured', source: 'Initial research baseline', confidence: 0.98 }),
  supersonicThreshold: sourced({ value: 2200, unit: 'uu/s', status: 'measured', source: 'Initial research baseline', confidence: 0.95 }),
  normalTopSpeed: sourced({ value: 1410, unit: 'uu/s', status: 'measured', source: 'Initial research baseline', confidence: 0.95 }),
  reverseTopSpeed: sourced({ value: 1000, unit: 'uu/s', status: 'tuned', source: 'Foundation controller tuning', confidence: 0.5 }),
  throttleAcceleration: sourced({ value: 1600, unit: 'uu/s^2', status: 'tuned', source: 'Foundation controller tuning', confidence: 0.45 }),
  reverseAcceleration: sourced({ value: 1200, unit: 'uu/s^2', status: 'tuned', source: 'Foundation controller tuning', confidence: 0.45 }),
  lateralGrip: sourced({ value: 12, unit: '1/s', status: 'tuned', source: 'Foundation controller tuning', confidence: 0.4 }),
  handbrakeLateralGrip: sourced({ value: 2.4, unit: '1/s', status: 'tuned', source: 'Foundation controller tuning', confidence: 0.35 }),
  boostConsumption: sourced({ value: 33.3, unit: 'boost/s', status: 'measured', source: 'Initial research baseline', confidence: 0.95 }),
  groundBoostAcceleration: sourced({ value: 991.666, unit: 'uu/s^2', status: 'measured', source: 'Initial research baseline', confidence: 0.9 }),
  airBoostAcceleration: sourced({ value: 1058.333, unit: 'uu/s^2', status: 'measured', source: 'Initial research baseline', confidence: 0.9 }),
  brakingAcceleration: sourced({ value: 3500, unit: 'uu/s^2', status: 'measured', source: 'Initial research baseline', confidence: 0.9 }),
  coastingAcceleration: sourced({ value: 525, unit: 'uu/s^2', status: 'measured', source: 'Initial research baseline', confidence: 0.9 }),
  airThrottleAcceleration: sourced({ value: 66.667, unit: 'uu/s^2', status: 'measured', source: 'Initial research baseline', confidence: 0.8 }),
  firstJumpImpulse: sourced({ value: 291.667, unit: 'uu/s', status: 'tuned', source: 'Initial jump baseline pending trajectory validation', confidence: 0.6 }),
  jumpHoldAcceleration: sourced({ value: 1458.333, unit: 'uu/s^2', status: 'tuned', source: 'Initial jump baseline pending trajectory validation', confidence: 0.55 }),
  jumpHoldDuration: sourced({ value: 0.2, unit: 's', status: 'measured', source: 'Public mechanics measurements', confidence: 0.75 }),
  secondJumpWindow: sourced({ value: 1.25, unit: 's', status: 'temporary', source: 'Lower bound from project brief pending state-transition validation', confidence: 0.55 }),
  doubleJumpImpulse: sourced({ value: 291.667, unit: 'uu/s', status: 'measured', source: 'Initial research baseline', confidence: 0.8 }),
  dodgeImpulse: sourced({ value: 500, unit: 'uu/s', status: 'tuned', source: 'Foundation dodge tuning', confidence: 0.35 }),
  dodgeVerticalImpulse: sourced({ value: 220, unit: 'uu/s', status: 'tuned', source: 'Foundation dodge tuning', confidence: 0.35 }),
  dodgeDeadzone: sourced({ value: 0.5, unit: 'ratio', status: 'tuned', source: 'Foundation dodge tuning', confidence: 0.35 }),
  maximumAngularVelocity: sourced({ value: 5.5, unit: 'rad/s', status: 'measured', source: 'Initial research baseline', confidence: 0.9 }),
  yawAngularAcceleration: sourced({ value: 9.11, unit: 'rad/s^2', status: 'measured', source: 'Initial research baseline', confidence: 0.85 }),
  pitchAngularAcceleration: sourced({ value: 12.46, unit: 'rad/s^2', status: 'measured', source: 'Initial research baseline', confidence: 0.85 }),
  rollAngularAcceleration: sourced({ value: 38.34, unit: 'rad/s^2', status: 'measured', source: 'Initial research baseline', confidence: 0.85 }),
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
