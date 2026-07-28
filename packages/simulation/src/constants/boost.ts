import type { Vec3 } from '@aether/shared';
import { sourced } from './provenance.js';

export interface BoostPadDefinition {
  readonly id: number;
  readonly position: Readonly<Vec3>;
  readonly isLarge: boolean;
}

export const BOOST = Object.freeze({
  smallCount: sourced({
    value: 28,
    unit: 'pads',
    status: 'verified',
    source: 'RLBot FieldInfo standard-map order',
    confidence: 0.99,
  }),
  smallGrant: sourced({
    value: 12,
    unit: 'boost',
    status: 'verified',
    source: 'RLBot useful game values',
    confidence: 0.99,
  }),
  smallRespawn: sourced({
    value: 4,
    unit: 's',
    status: 'verified',
    source: 'RLBot useful game values',
    confidence: 0.99,
  }),
  smallRadius: sourced({
    value: 144,
    unit: 'uu',
    status: 'verified',
    source: 'RLBot useful game values',
    confidence: 0.99,
  }),
  smallHeight: sourced({
    value: 165,
    unit: 'uu',
    status: 'verified',
    source: 'RLBot useful game values',
    confidence: 0.99,
  }),
  largeCount: sourced({
    value: 6,
    unit: 'pads',
    status: 'verified',
    source: 'RLBot FieldInfo standard-map order',
    confidence: 0.99,
  }),
  largeRespawn: sourced({
    value: 10,
    unit: 's',
    status: 'verified',
    source: 'RLBot useful game values',
    confidence: 0.99,
  }),
  largeRadius: sourced({
    value: 208,
    unit: 'uu',
    status: 'verified',
    source: 'RLBot useful game values',
    confidence: 0.99,
  }),
  largeHeight: sourced({
    value: 168,
    unit: 'uu',
    status: 'verified',
    source: 'RLBot useful game values',
    confidence: 0.99,
  }),
});

const RAW_PAD_LAYOUT: readonly (readonly [number, number, number, boolean])[] = [
  [0, -4240, 70, false],
  [-1792, -4184, 70, false],
  [1792, -4184, 70, false],
  [-3072, -4096, 73, true],
  [3072, -4096, 73, true],
  [-940, -3308, 70, false],
  [940, -3308, 70, false],
  [0, -2816, 70, false],
  [-3584, -2484, 70, false],
  [3584, -2484, 70, false],
  [-1788, -2302, 70, false],
  [1788, -2302, 70, false],
  [-2048, -1036, 70, false],
  [2048, -1036, 70, false],
  [0, -1024, 70, false],
  [-3584, 0, 73, true],
  [-1024, 0, 70, false],
  [1024, 0, 70, false],
  [3584, 0, 73, true],
  [0, 1024, 70, false],
  [-2048, 1036, 70, false],
  [2048, 1036, 70, false],
  [-1788, 2302, 70, false],
  [1788, 2302, 70, false],
  [-3584, 2484, 70, false],
  [3584, 2484, 70, false],
  [0, 2816, 70, false],
  [-940, 3308, 70, false],
  [940, 3308, 70, false],
  [-3072, 4096, 73, true],
  [3072, 4096, 73, true],
  [-1792, 4184, 70, false],
  [1792, 4184, 70, false],
  [0, 4240, 70, false],
];

export const BOOST_PAD_LAYOUT: readonly BoostPadDefinition[] = Object.freeze(
  RAW_PAD_LAYOUT.map(([x, y, z, isLarge], id) =>
    Object.freeze({ id, position: Object.freeze({ x, y, z }), isLarge }),
  ),
);
