export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const ZERO_VEC3: Readonly<Vec3> = Object.freeze({ x: 0, y: 0, z: 0 });

export function cloneVec3(value: Readonly<Vec3>): Vec3 {
  return { x: value.x, y: value.y, z: value.z };
}

export function magnitude(value: Readonly<Vec3>): number {
  return Math.hypot(value.x, value.y, value.z);
}

export function clampMagnitude(value: Vec3, maximum: number): void {
  const length = magnitude(value);
  if (length <= maximum || length === 0) return;
  const scale = maximum / length;
  value.x *= scale;
  value.y *= scale;
  value.z *= scale;
}

export function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

export function lerpVec3(a: Readonly<Vec3>, b: Readonly<Vec3>, alpha: number): Vec3 {
  return { x: lerp(a.x, b.x, alpha), y: lerp(a.y, b.y, alpha), z: lerp(a.z, b.z, alpha) };
}
