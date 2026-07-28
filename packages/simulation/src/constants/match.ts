import { sourced } from './provenance.js';

export const MATCH = Object.freeze({
  regulation: sourced({ value: 300, unit: 's', status: 'verified', source: 'Rules baseline', confidence: 1 }),
  kickoffCountdown: sourced({ value: 3, unit: 's', status: 'verified', source: 'Rules baseline', confidence: 1 }),
});
