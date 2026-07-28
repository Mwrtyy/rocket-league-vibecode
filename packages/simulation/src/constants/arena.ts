import { sourced } from './provenance.js';

export const ARENA = Object.freeze({
  sideWallX: sourced({ value: 4096, unit: 'uu', status: 'measured', source: 'Initial research baseline', confidence: 0.95 }),
  backWallY: sourced({ value: 5120, unit: 'uu', status: 'measured', source: 'Initial research baseline', confidence: 0.95 }),
  ceilingZ: sourced({ value: 2044, unit: 'uu', status: 'measured', source: 'Initial research baseline', confidence: 0.9 }),
  goalHeight: sourced({ value: 642.775, unit: 'uu', status: 'measured', source: 'Initial research baseline', confidence: 0.9 }),
  goalHalfWidth: sourced({ value: 892.755, unit: 'uu', status: 'measured', source: 'Initial research baseline', confidence: 0.9 }),
  goalDepth: sourced({ value: 880, unit: 'uu', status: 'measured', source: 'Initial research baseline', confidence: 0.9 }),
});
