import { sourced } from './provenance.js';

export const CAMERA = Object.freeze({
  defaultFov: sourced({ value: 100, unit: 'degrees', status: 'temporary', source: 'Original project default', confidence: 0.4 }),
  defaultDistance: sourced({ value: 270, unit: 'uu', status: 'temporary', source: 'Original project default', confidence: 0.4 }),
});
