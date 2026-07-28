export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const ZERO_VEC3: Readonly<Vec3> = Object.freeze({ x: 0, y: 0, z: 0 });

export function cloneVec3(value: Readonly<Vec3>): Vec3 {
  return { x: value.x, y: value.y, z: value.z };
}

export function setVec3(target: Vec3, x: number, y: number, z: number): Vec3 {
  target.x = x;
  target.y = y;
  target.z = z;
  return target;
}

export function addScaledVec3(target: Vec3, value: Readonly<Vec3>, scale: number): Vec3 {
  target.x += value.x * scale;
  target.y += value.y * scale;
  target.z += value.z * scale;
  return target;
}

export function dotVec3(a: Readonly<Vec3>, b: Readonly<Vec3>): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function crossVec3(a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function magnitudeSquared(value: Readonly<Vec3>): number {
  return dotVec3(value, value);
}

export function magnitude(value: Readonly<Vec3>): number {
  return Math.sqrt(magnitudeSquared(value));
}

export function normalizeVec3(value: Readonly<Vec3>, fallback: Readonly<Vec3> = ZERO_VEC3): Vec3 {
  const length = magnitude(value);
  if (length <= Number.EPSILON) return cloneVec3(fallback);
  const inverse = 1 / length;
  return { x: value.x * inverse, y: value.y * inverse, z: value.z * inverse };
}

export function clampMagnitude(value: Vec3, maximum: number): void {
  const length = magnitude(value);
  if (length <= maximum || length === 0) return;
  const scale = maximum / length;
  value.x *= scale;
  value.y *= scale;
  value.z *= scale;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function moveToward(current: number, target: number, maximumDelta: number): number {
  if (Math.abs(target - current) <= maximumDelta) return target;
  return current + Math.sign(target - current) * maximumDelta;
}

export function wrapRadians(value: number): number {
  const twoPi = Math.PI * 2;
  return ((value + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
}

export function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

export function lerpAngle(a: number, b: number, alpha: number): number {
  return wrapRadians(a + wrapRadians(b - a) * alpha);
}

export function lerpVec3(a: Readonly<Vec3>, b: Readonly<Vec3>, alpha: number): Vec3 {
  return { x: lerp(a.x, b.x, alpha), y: lerp(a.y, b.y, alpha), z: lerp(a.z, b.z, alpha) };
}
