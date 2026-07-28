import { sourced } from './provenance.js';

export interface WheelAnchorDefinition {
  readonly id: 0 | 1 | 2 | 3;
  readonly name: 'front-left' | 'front-right' | 'rear-left' | 'rear-right';
  readonly localX: number;
  readonly localY: number;
  readonly steerable: boolean;
}

export const WHEEL = Object.freeze({
  radius: sourced({
    value: 12,
    unit: 'uu',
    status: 'temporary',
    source: 'Functional wheel-contact baseline pending hitbox-specific measurement',
    confidence: 0.3,
  }),
  restLength: sourced({
    value: 8,
    unit: 'uu',
    status: 'tuned',
    source: 'Static-load suspension equilibrium tuning',
    confidence: 0.35,
  }),
  maximumDroop: sourced({
    value: 8,
    unit: 'uu',
    status: 'tuned',
    source: 'Functional contact-cast range pending suspension measurement',
    confidence: 0.3,
  }),
  springStiffness: sourced({
    value: 14500,
    unit: 'force/uu',
    status: 'tuned',
    source: 'Four-wheel static-load equilibrium against 650 uu/s² gravity',
    confidence: 0.4,
  }),
  damping: sourced({
    value: 1200,
    unit: 'force/(uu/s)',
    status: 'tuned',
    source: 'Critical-response baseline pending bounce trajectory measurement',
    confidence: 0.3,
  }),
  tireGripRate: sourced({
    value: 12,
    unit: '1/s',
    status: 'tuned',
    source: 'Foundation lateral-grip behavior transferred to per-wheel forces',
    confidence: 0.4,
  }),
  handbrakeGripRate: sourced({
    value: 2.4,
    unit: '1/s',
    status: 'tuned',
    source: 'Foundation powerslide behavior transferred to per-wheel forces',
    confidence: 0.35,
  }),
  frictionCoefficient: sourced({
    value: 1.8,
    unit: 'ratio',
    status: 'tuned',
    source: 'Per-wheel traction force cap pending controlled skid measurement',
    confidence: 0.3,
  }),
  handbrakeFrictionCoefficient: sourced({
    value: 0.55,
    unit: 'ratio',
    status: 'tuned',
    source: 'Per-wheel powerslide force cap pending controlled skid measurement',
    confidence: 0.25,
  }),
  castIterations: sourced({
    value: 12,
    unit: 'iterations',
    status: 'derived',
    source: 'Deterministic bisection precision below 0.004 uu over the cast range',
    confidence: 0.95,
  }),
});

export const WHEEL_ANCHORS: readonly WheelAnchorDefinition[] = Object.freeze([
  Object.freeze({ id: 0, name: 'front-left', localX: -31.5, localY: 42.5, steerable: true }),
  Object.freeze({ id: 1, name: 'front-right', localX: 31.5, localY: 42.5, steerable: true }),
  Object.freeze({ id: 2, name: 'rear-left', localX: -31.5, localY: -42.5, steerable: false }),
  Object.freeze({ id: 3, name: 'rear-right', localX: 31.5, localY: -42.5, steerable: false }),
]);
