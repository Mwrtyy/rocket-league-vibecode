import { sourced } from './provenance.js';

export const WORLD = Object.freeze({
  physicsHz: sourced({ value: 120, unit: 'Hz', status: 'verified', source: 'Architecture invariant', confidence: 1 }),
  gravity: sourced({ value: 650, unit: 'uu/s^2', status: 'measured', source: 'Initial research baseline', confidence: 0.95 }),
  floorZ: sourced({ value: 0, unit: 'uu', status: 'measured', source: 'Initial coordinate baseline', confidence: 0.95 }),
});

export const PHYSICS_HZ = WORLD.physicsHz.value;
export const FIXED_DT = 1 / PHYSICS_HZ;
