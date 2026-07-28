import { sourced } from './provenance.js';

export const MATCH = Object.freeze({
  regulation: sourced({
    value: 300,
    unit: 's',
    status: 'verified',
    source: 'Rules baseline',
    confidence: 1,
  }),
  kickoffCountdown: sourced({
    value: 3,
    unit: 's',
    status: 'verified',
    source: 'Rules baseline',
    confidence: 1,
  }),
  goalPause: sourced({
    value: 2.5,
    unit: 's',
    status: 'tuned',
    source: 'Foundation match-flow tuning',
    confidence: 0.45,
  }),
  startingBoost: sourced({
    value: 33,
    unit: 'boost',
    status: 'measured',
    source: 'Public standard-match behavior',
    confidence: 0.9,
  }),
  zeroSecondGroundTolerance: sourced({
    value: 3,
    unit: 'uu',
    status: 'tuned',
    source: 'Deterministic ground-contact tolerance',
    confidence: 0.55,
  }),
});
