import type { Vec3 } from '@aether/shared';
import { ARENA } from './constants/arena.js';

const INV_SQRT_TWO = Math.SQRT1_2;
const CONTACT_EPSILON = 1e-7;

type ArenaWallSurface = 'side-wall' | 'back-wall' | 'corner-wall' | 'goal-side' | 'goal-back';
export type ArenaContactSurface =
  | ArenaWallSurface
  | 'floor'
  | 'ceiling'
  | 'floor-wall-curve'
  | 'ceiling-wall-curve'
  | 'goal-floor'
  | 'goal-ceiling';

export interface ArenaWallSample {
  distance: number;
  inwardNormalX: number;
  inwardNormalY: number;
  surface: ArenaWallSurface;
  goalVolume: boolean;
}

export interface ArenaContactResult {
  contactCount: number;
  lastSurface: ArenaContactSurface | null;
  lastNormalX: number;
  lastNormalY: number;
  lastNormalZ: number;
  maximumUpNormal: number;
  wallContact: boolean;
  ceilingContact: boolean;
}

export interface ArenaWallSegment {
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly inwardNormalX: number;
  readonly inwardNormalY: number;
  readonly surface: ArenaWallSurface;
}

export const ARENA_WALL_SEGMENTS: readonly ArenaWallSegment[] = Object.freeze([
  Object.freeze({
    startX: 4096,
    startY: -3968,
    endX: 4096,
    endY: 3968,
    inwardNormalX: -1,
    inwardNormalY: 0,
    surface: 'side-wall' as const,
  }),
  Object.freeze({
    startX: -4096,
    startY: 3968,
    endX: -4096,
    endY: -3968,
    inwardNormalX: 1,
    inwardNormalY: 0,
    surface: 'side-wall' as const,
  }),
  ...createCornerSegments(),
  ...createBackWallSegments(),
]);

export function createArenaWallSample(): ArenaWallSample {
  return {
    distance: Number.POSITIVE_INFINITY,
    inwardNormalX: 0,
    inwardNormalY: 0,
    surface: 'side-wall',
    goalVolume: false,
  };
}

export function createArenaContactResult(): ArenaContactResult {
  return {
    contactCount: 0,
    lastSurface: null,
    lastNormalX: 0,
    lastNormalY: 0,
    lastNormalZ: 0,
    maximumUpNormal: 0,
    wallContact: false,
    ceilingContact: false,
  };
}

export function writeArenaWallSample(
  position: Readonly<Vec3>,
  horizontalRadius: number,
  verticalRadius: number,
  target: ArenaWallSample,
): ArenaWallSample {
  const x = position.x;
  const y = position.y;
  const absoluteX = Math.abs(x);
  const absoluteY = Math.abs(y);
  const signX = signOrPositive(x);
  const signY = signOrPositive(y);
  const beyondBackWall = absoluteY > ARENA.backWallY.value;
  const inExpandedGoalVolume =
    beyondBackWall &&
    absoluteX <= ARENA.goalHalfWidth.value + horizontalRadius &&
    position.z <= ARENA.goalHeight.value + verticalRadius;

  if (inExpandedGoalVolume) {
    const sideDistance = ARENA.goalHalfWidth.value - absoluteX;
    const depthDistance = ARENA.backWallY.value + ARENA.goalDepth.value - absoluteY;
    if (sideDistance <= depthDistance) {
      target.distance = sideDistance;
      target.inwardNormalX = -signX;
      target.inwardNormalY = 0;
      target.surface = 'goal-side';
    } else {
      target.distance = depthDistance;
      target.inwardNormalX = 0;
      target.inwardNormalY = -signY;
      target.surface = 'goal-back';
    }
    target.goalVolume = true;
    return target;
  }

  const sideDistance = ARENA.sideWallX.value - absoluteX;
  const cornerDistance =
    (ARENA.cornerPlaneIntercept.value - absoluteX - absoluteY) * INV_SQRT_TWO;
  const fitsGoalOpening =
    absoluteX <= ARENA.goalHalfWidth.value - horizontalRadius &&
    position.z <= ARENA.goalHeight.value - verticalRadius;

  target.distance = sideDistance;
  target.inwardNormalX = -signX;
  target.inwardNormalY = 0;
  target.surface = 'side-wall';
  target.goalVolume = false;

  if (cornerDistance < target.distance) {
    target.distance = cornerDistance;
    target.inwardNormalX = -signX * INV_SQRT_TWO;
    target.inwardNormalY = -signY * INV_SQRT_TWO;
    target.surface = 'corner-wall';
  }

  if (!fitsGoalOpening) {
    const backDistance = ARENA.backWallY.value - absoluteY;
    if (backDistance < target.distance) {
      target.distance = backDistance;
      target.inwardNormalX = 0;
      target.inwardNormalY = -signY;
      target.surface = 'back-wall';
    }
  }

  return target;
}

export class ArenaCollisionResolver {
  private readonly wallSample = createArenaWallSample();
  private readonly contactResult = createArenaContactResult();

  public resolveSphere(
    position: Vec3,
    linearVelocity: Vec3,
    radius: number,
    restitution: number,
  ): Readonly<ArenaContactResult> {
    return this.resolveBody(position, linearVelocity, radius, radius, restitution);
  }

  public resolveBox(
    position: Vec3,
    linearVelocity: Vec3,
    yaw: number,
    halfWidth: number,
    halfLength: number,
    halfHeight: number,
    restitution: number,
  ): Readonly<ArenaContactResult> {
    const maximumHorizontalRadius = Math.hypot(halfWidth, halfLength);
    writeArenaWallSample(position, maximumHorizontalRadius, halfHeight, this.wallSample);
    const cosine = Math.cos(yaw);
    const sine = Math.sin(yaw);
    const normalX = this.wallSample.inwardNormalX;
    const normalY = this.wallSample.inwardNormalY;
    const rightProjection = Math.abs(normalX * cosine - normalY * sine);
    const forwardProjection = Math.abs(normalX * sine + normalY * cosine);
    const horizontalSupport = rightProjection * halfWidth + forwardProjection * halfLength;
    return this.resolveBody(
      position,
      linearVelocity,
      horizontalSupport,
      halfHeight,
      restitution,
    );
  }

  private resolveBody(
    position: Vec3,
    linearVelocity: Vec3,
    horizontalRadius: number,
    verticalRadius: number,
    restitution: number,
  ): Readonly<ArenaContactResult> {
    resetContactResult(this.contactResult);
    const safeHorizontalRadius = Math.max(0, horizontalRadius);
    const safeVerticalRadius = Math.max(0, verticalRadius);
    const safeRestitution = Math.max(0, restitution);

    writeArenaWallSample(
      position,
      safeHorizontalRadius,
      safeVerticalRadius,
      this.wallSample,
    );
    if (this.wallSample.goalVolume) {
      this.resolveGoalVolume(
        position,
        linearVelocity,
        safeHorizontalRadius,
        safeVerticalRadius,
        safeRestitution,
      );
      return this.contactResult;
    }

    for (let iteration = 0; iteration < 2; iteration += 1) {
      writeArenaWallSample(
        position,
        safeHorizontalRadius,
        safeVerticalRadius,
        this.wallSample,
      );
      this.resolveLowerCurve(
        position,
        linearVelocity,
        safeHorizontalRadius,
        safeVerticalRadius,
        safeRestitution,
      );

      writeArenaWallSample(
        position,
        safeHorizontalRadius,
        safeVerticalRadius,
        this.wallSample,
      );
      this.resolveUpperCurve(
        position,
        linearVelocity,
        safeHorizontalRadius,
        safeVerticalRadius,
        safeRestitution,
      );

      writeArenaWallSample(
        position,
        safeHorizontalRadius,
        safeVerticalRadius,
        this.wallSample,
      );
      if (this.wallSample.distance < safeHorizontalRadius) {
        const correction = safeHorizontalRadius - this.wallSample.distance;
        position.x += this.wallSample.inwardNormalX * correction;
        position.y += this.wallSample.inwardNormalY * correction;
        this.applyContact(
          linearVelocity,
          this.wallSample.inwardNormalX,
          this.wallSample.inwardNormalY,
          0,
          safeRestitution,
          this.wallSample.surface,
        );
      }

      if (position.z < safeVerticalRadius) {
        position.z = safeVerticalRadius;
        this.applyContact(linearVelocity, 0, 0, 1, safeRestitution, 'floor');
      }
      const ceilingLimit = ARENA.ceilingZ.value - safeVerticalRadius;
      if (position.z > ceilingLimit) {
        position.z = ceilingLimit;
        this.applyContact(linearVelocity, 0, 0, -1, safeRestitution, 'ceiling');
      }
    }

    return this.contactResult;
  }

  private resolveLowerCurve(
    position: Vec3,
    linearVelocity: Vec3,
    horizontalRadius: number,
    verticalRadius: number,
    restitution: number,
  ): void {
    const curveRadius = ARENA.floorWallCurveRadius.value;
    if (this.wallSample.distance >= curveRadius || position.z >= curveRadius) return;
    const horizontalAxis = curveRadius - horizontalRadius;
    const verticalAxis = curveRadius - verticalRadius;
    if (horizontalAxis <= CONTACT_EPSILON || verticalAxis <= CONTACT_EPSILON) return;

    const normalizedDistance = (this.wallSample.distance - curveRadius) / horizontalAxis;
    const normalizedHeight = (position.z - curveRadius) / verticalAxis;
    const normalizedLength = Math.hypot(normalizedDistance, normalizedHeight);
    if (normalizedLength <= 1) return;

    const projectedDistance =
      curveRadius + (normalizedDistance / normalizedLength) * horizontalAxis;
    const projectedHeight = curveRadius + (normalizedHeight / normalizedLength) * verticalAxis;
    const distanceCorrection = projectedDistance - this.wallSample.distance;
    position.x += this.wallSample.inwardNormalX * distanceCorrection;
    position.y += this.wallSample.inwardNormalY * distanceCorrection;
    position.z = projectedHeight;

    const gradientDistance = (projectedDistance - curveRadius) / (horizontalAxis * horizontalAxis);
    const gradientHeight = (projectedHeight - curveRadius) / (verticalAxis * verticalAxis);
    const inverseGradientLength = 1 / Math.hypot(gradientDistance, gradientHeight);
    const normalDistance = -gradientDistance * inverseGradientLength;
    const normalZ = -gradientHeight * inverseGradientLength;
    this.applyContact(
      linearVelocity,
      this.wallSample.inwardNormalX * normalDistance,
      this.wallSample.inwardNormalY * normalDistance,
      normalZ,
      restitution,
      'floor-wall-curve',
    );
  }

  private resolveUpperCurve(
    position: Vec3,
    linearVelocity: Vec3,
    horizontalRadius: number,
    verticalRadius: number,
    restitution: number,
  ): void {
    const curveRadius = ARENA.ceilingWallCurveRadius.value;
    const curveCenterZ = ARENA.ceilingZ.value - curveRadius;
    if (this.wallSample.distance >= curveRadius || position.z <= curveCenterZ) return;
    const horizontalAxis = curveRadius - horizontalRadius;
    const verticalAxis = curveRadius - verticalRadius;
    if (horizontalAxis <= CONTACT_EPSILON || verticalAxis <= CONTACT_EPSILON) return;

    const normalizedDistance = (this.wallSample.distance - curveRadius) / horizontalAxis;
    const normalizedHeight = (position.z - curveCenterZ) / verticalAxis;
    const normalizedLength = Math.hypot(normalizedDistance, normalizedHeight);
    if (normalizedLength <= 1) return;

    const projectedDistance =
      curveRadius + (normalizedDistance / normalizedLength) * horizontalAxis;
    const projectedHeight = curveCenterZ + (normalizedHeight / normalizedLength) * verticalAxis;
    const distanceCorrection = projectedDistance - this.wallSample.distance;
    position.x += this.wallSample.inwardNormalX * distanceCorrection;
    position.y += this.wallSample.inwardNormalY * distanceCorrection;
    position.z = projectedHeight;

    const gradientDistance = (projectedDistance - curveRadius) / (horizontalAxis * horizontalAxis);
    const gradientHeight = (projectedHeight - curveCenterZ) / (verticalAxis * verticalAxis);
    const inverseGradientLength = 1 / Math.hypot(gradientDistance, gradientHeight);
    const normalDistance = -gradientDistance * inverseGradientLength;
    const normalZ = -gradientHeight * inverseGradientLength;
    this.applyContact(
      linearVelocity,
      this.wallSample.inwardNormalX * normalDistance,
      this.wallSample.inwardNormalY * normalDistance,
      normalZ,
      restitution,
      'ceiling-wall-curve',
    );
  }

  private resolveGoalVolume(
    position: Vec3,
    linearVelocity: Vec3,
    horizontalRadius: number,
    verticalRadius: number,
    restitution: number,
  ): void {
    const sideLimit = ARENA.goalHalfWidth.value - horizontalRadius;
    if (Math.abs(position.x) > sideLimit) {
      const signX = signOrPositive(position.x);
      position.x = signX * sideLimit;
      this.applyContact(linearVelocity, -signX, 0, 0, restitution, 'goal-side');
    }

    const signY = signOrPositive(position.y);
    const depthLimit = ARENA.backWallY.value + ARENA.goalDepth.value - horizontalRadius;
    if (Math.abs(position.y) > depthLimit) {
      position.y = signY * depthLimit;
      this.applyContact(linearVelocity, 0, -signY, 0, restitution, 'goal-back');
    }

    if (position.z < verticalRadius) {
      position.z = verticalRadius;
      this.applyContact(linearVelocity, 0, 0, 1, restitution, 'goal-floor');
    }
    const ceilingLimit = ARENA.goalHeight.value - verticalRadius;
    if (position.z > ceilingLimit) {
      position.z = ceilingLimit;
      this.applyContact(linearVelocity, 0, 0, -1, restitution, 'goal-ceiling');
    }
  }

  private applyContact(
    linearVelocity: Vec3,
    normalX: number,
    normalY: number,
    normalZ: number,
    restitution: number,
    surface: ArenaContactSurface,
  ): void {
    const normalSpeed =
      linearVelocity.x * normalX +
      linearVelocity.y * normalY +
      linearVelocity.z * normalZ;
    if (normalSpeed < 0) {
      const impulseScale = (1 + restitution) * normalSpeed;
      linearVelocity.x -= impulseScale * normalX;
      linearVelocity.y -= impulseScale * normalY;
      linearVelocity.z -= impulseScale * normalZ;
    }

    const result = this.contactResult;
    result.contactCount += 1;
    result.lastSurface = surface;
    result.lastNormalX = normalX;
    result.lastNormalY = normalY;
    result.lastNormalZ = normalZ;
    result.maximumUpNormal = Math.max(result.maximumUpNormal, normalZ);
    result.wallContact ||= Math.abs(normalZ) < 0.75;
    result.ceilingContact ||= normalZ < -0.5;
  }
}

function resetContactResult(result: ArenaContactResult): void {
  result.contactCount = 0;
  result.lastSurface = null;
  result.lastNormalX = 0;
  result.lastNormalY = 0;
  result.lastNormalZ = 0;
  result.maximumUpNormal = 0;
  result.wallContact = false;
  result.ceilingContact = false;
}

function signOrPositive(value: number): number {
  return value < 0 ? -1 : 1;
}

function createCornerSegments(): readonly ArenaWallSegment[] {
  const segments: ArenaWallSegment[] = [];
  for (const signX of [-1, 1] as const) {
    for (const signY of [-1, 1] as const) {
      segments.push(
        Object.freeze({
          startX: signX * ARENA.sideWallX.value,
          startY: signY * ARENA.sideWallHalfLength.value,
          endX: signX * ARENA.backWallHalfLength.value,
          endY: signY * ARENA.backWallY.value,
          inwardNormalX: -signX * INV_SQRT_TWO,
          inwardNormalY: -signY * INV_SQRT_TWO,
          surface: 'corner-wall' as const,
        }),
      );
    }
  }
  return segments;
}

function createBackWallSegments(): readonly ArenaWallSegment[] {
  const segments: ArenaWallSegment[] = [];
  for (const signY of [-1, 1] as const) {
    segments.push(
      Object.freeze({
        startX: -ARENA.backWallHalfLength.value,
        startY: signY * ARENA.backWallY.value,
        endX: -ARENA.goalHalfWidth.value,
        endY: signY * ARENA.backWallY.value,
        inwardNormalX: 0,
        inwardNormalY: -signY,
        surface: 'back-wall' as const,
      }),
      Object.freeze({
        startX: ARENA.goalHalfWidth.value,
        startY: signY * ARENA.backWallY.value,
        endX: ARENA.backWallHalfLength.value,
        endY: signY * ARENA.backWallY.value,
        inwardNormalX: 0,
        inwardNormalY: -signY,
        surface: 'back-wall' as const,
      }),
    );
  }
  return segments;
}
