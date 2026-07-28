import { sourced } from './provenance.js';

export const BALL = Object.freeze({
  radius: sourced({ value: 91.25, unit: 'uu', status: 'measured', source: 'Initial research baseline', confidence: 0.95 }),
  mass: sourced({ value: 30, unit: 'kg-equivalent', status: 'measured', source: 'Initial research baseline', confidence: 0.85, notes: 'Solver mass semantics require validation.' }),
  restitution: sourced({ value: 0.6, unit: 'ratio', status: 'tuned', source: 'Initial baseline', confidence: 0.6, notes: 'Not a complete incidence-dependent contact model.' }),
  maximumLinearSpeed: sourced({ value: 6000, unit: 'uu/s', status: 'measured', source: 'Initial research baseline', confidence: 0.95 }),
  maximumAngularSpeed: sourced({ value: 6, unit: 'rad/s', status: 'measured', source: 'Initial research baseline', confidence: 0.9 }),
});
