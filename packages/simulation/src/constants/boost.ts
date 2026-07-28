import { sourced } from './provenance.js';

export const BOOST = Object.freeze({
  smallCount: sourced({ value: 28, unit: 'pads', status: 'measured', source: 'Initial research baseline', confidence: 0.95 }),
  smallGrant: sourced({ value: 12, unit: 'boost', status: 'measured', source: 'Initial research baseline', confidence: 0.95 }),
  smallRespawn: sourced({ value: 4, unit: 's', status: 'measured', source: 'Initial research baseline', confidence: 0.95 }),
  largeCount: sourced({ value: 6, unit: 'pads', status: 'measured', source: 'Initial research baseline', confidence: 0.95 }),
  largeRespawn: sourced({ value: 10, unit: 's', status: 'measured', source: 'Initial research baseline', confidence: 0.95 }),
});
