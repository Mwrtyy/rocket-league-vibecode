import { describe, expect, it } from 'vitest';
import {
  ArenaCollisionResolver,
  createArenaWallSample,
  writeArenaWallSample,
} from './arena-collision.js';
import { ARENA } from './constants/arena.js';
import { BALL } from './constants/ball.js';
import { CAR } from './constants/car.js';

const BALL_RADIUS = BALL.radius.value;

describe('octagonal arena boundary', () => {
  it('uses the published side, back and 45-degree corner planes', () => {
    const sample = createArenaWallSample();

    writeArenaWallSample({ x: 4086, y: 3960, z: 500 }, 0, 0, sample);
    expect(sample.surface).toBe('side-wall');
    expect(sample.distance).toBeCloseTo(10, 8);

    writeArenaWallSample({ x: 4046, y: 4018, z: 500 }, 0, 0, sample);
    expect(sample.surface).toBe('corner-wall');
    expect(sample.distance).toBeCloseTo(0, 8);

    writeArenaWallSample({ x: 1200, y: 5100, z: 800 }, 0, 0, sample);
    expect(sample.surface).toBe('back-wall');
    expect(sample.distance).toBeCloseTo(20, 8);
  });

  it('has no positional gap where straight walls meet the diagonal corner plane', () => {
    const sample = createArenaWallSample();
    const seamX = ARENA.sideWallX.value;
    const seamY = ARENA.sideWallHalfLength.value;

    writeArenaWallSample({ x: seamX, y: seamY - 0.001, z: 600 }, 0, 0, sample);
    expect(sample.distance).toBeCloseTo(0, 6);

    const alongCorner = 80;
    writeArenaWallSample(
      { x: seamX - alongCorner, y: seamY + alongCorner, z: 600 },
      0,
      0,
      sample,
    );
    expect(sample.distance).toBeCloseTo(0, 6);

    const inwardOffset = 10;
    writeArenaWallSample(
      {
        x: seamX - alongCorner - inwardOffset * Math.SQRT1_2,
        y: seamY + alongCorner - inwardOffset * Math.SQRT1_2,
        z: 600,
      },
      0,
      0,
      sample,
    );
    expect(sample.distance).toBeCloseTo(inwardOffset, 6);
  });
});

describe('ArenaCollisionResolver', () => {
  it('projects a ball onto the continuous floor-wall quarter curve', () => {
    const resolver = new ArenaCollisionResolver();
    const position = { x: ARENA.sideWallX.value - 100, y: 0, z: 100 };
    const velocity = { x: 700, y: 0, z: -500 };

    const contact = resolver.resolveSphere(position, velocity, BALL_RADIUS, 0.6);

    expect(position.x).toBeLessThan(ARENA.sideWallX.value - 100);
    expect(position.z).toBeGreaterThan(100);
    expect(contact.contactCount).toBeGreaterThan(0);
    expect(contact.maximumUpNormal).toBeGreaterThan(0.5);
    expect(contact.wallContact).toBe(true);
    expect(velocity.x).toBeLessThan(700);
    expect(velocity.z).toBeGreaterThan(-500);
  });

  it('reflects high wall impacts without axis-by-axis clamping artifacts', () => {
    const resolver = new ArenaCollisionResolver();
    const position = { x: 4050, y: 0, z: 700 };
    const velocity = { x: 1000, y: 120, z: 0 };

    const contact = resolver.resolveSphere(position, velocity, BALL_RADIUS, 0.6);

    expect(position.x).toBeCloseTo(ARENA.sideWallX.value - BALL_RADIUS, 6);
    expect(velocity.x).toBeCloseTo(-600, 6);
    expect(velocity.y).toBeCloseTo(120, 6);
    expect(contact.lastSurface).toBe('side-wall');
  });

  it('resolves diagonal corner penetration along the 45-degree normal', () => {
    const resolver = new ArenaCollisionResolver();
    const position = { x: 4000, y: 4200, z: 700 };
    const velocity = { x: 900, y: 900, z: 0 };

    resolver.resolveSphere(position, velocity, BALL_RADIUS, 0.6);

    const insetPlane =
      ARENA.cornerPlaneIntercept.value - BALL_RADIUS / Math.SQRT1_2;
    expect(position.x + position.y).toBeCloseTo(insetPlane, 5);
    expect(velocity.x).toBeLessThan(0);
    expect(velocity.y).toBeLessThan(0);
  });

  it('uses a continuous ceiling-wall quarter curve', () => {
    const resolver = new ArenaCollisionResolver();
    const position = {
      x: ARENA.sideWallX.value - 100,
      y: 0,
      z: ARENA.ceilingZ.value - 100,
    };
    const velocity = { x: 500, y: 0, z: 500 };

    const contact = resolver.resolveSphere(position, velocity, BALL_RADIUS, 0.6);

    expect(position.x).toBeLessThan(ARENA.sideWallX.value - 100);
    expect(position.z).toBeLessThan(ARENA.ceilingZ.value - 100);
    expect(contact.ceilingContact).toBe(true);
    expect(contact.lastNormalZ).toBeLessThan(0);
  });

  it('allows a fitted ball through the goal mouth and constrains the goal interior', () => {
    const resolver = new ArenaCollisionResolver();
    const passagePosition = { x: 0, y: ARENA.backWallY.value + 60, z: BALL_RADIUS };
    const passageVelocity = { x: 0, y: 600, z: 0 };

    const passageContact = resolver.resolveSphere(
      passagePosition,
      passageVelocity,
      BALL_RADIUS,
      0.6,
    );
    expect(passagePosition.y).toBe(ARENA.backWallY.value + 60);
    expect(passageVelocity.y).toBe(600);
    expect(passageContact.contactCount).toBe(0);

    const interiorPosition = {
      x: ARENA.goalHalfWidth.value - 20,
      y: ARENA.backWallY.value + ARENA.goalDepth.value - 20,
      z: ARENA.goalHeight.value - 20,
    };
    const interiorVelocity = { x: 500, y: 500, z: 500 };
    const interiorContact = resolver.resolveSphere(
      interiorPosition,
      interiorVelocity,
      BALL_RADIUS,
      0.6,
    );
    expect(Math.abs(interiorPosition.x)).toBeLessThanOrEqual(
      ARENA.goalHalfWidth.value - BALL_RADIUS + 1e-6,
    );
    expect(Math.abs(interiorPosition.y)).toBeLessThanOrEqual(
      ARENA.backWallY.value + ARENA.goalDepth.value - BALL_RADIUS + 1e-6,
    );
    expect(interiorPosition.z).toBeLessThanOrEqual(
      ARENA.goalHeight.value - BALL_RADIUS + 1e-6,
    );
    expect(interiorContact.contactCount).toBeGreaterThanOrEqual(3);
  });

  it('keeps posts and the crossbar solid before the ball fully fits the opening', () => {
    const resolver = new ArenaCollisionResolver();
    const postPosition = {
      x: ARENA.goalHalfWidth.value - 20,
      y: ARENA.backWallY.value - 20,
      z: BALL_RADIUS,
    };
    const postVelocity = { x: 0, y: 800, z: 0 };
    resolver.resolveSphere(postPosition, postVelocity, BALL_RADIUS, 0.6);
    expect(postPosition.y).toBeCloseTo(ARENA.backWallY.value - BALL_RADIUS, 6);
    expect(postVelocity.y).toBeLessThan(0);

    const crossbarPosition = {
      x: 0,
      y: ARENA.backWallY.value - 20,
      z: ARENA.goalHeight.value - 20,
    };
    const crossbarVelocity = { x: 0, y: 800, z: 0 };
    resolver.resolveSphere(crossbarPosition, crossbarVelocity, BALL_RADIUS, 0.6);
    expect(crossbarPosition.y).toBeCloseTo(ARENA.backWallY.value - BALL_RADIUS, 6);
    expect(crossbarVelocity.y).toBeLessThan(0);
  });

  it('uses oriented car support instead of a fixed axis clamp', () => {
    const resolver = new ArenaCollisionResolver();
    const halfWidth = CAR.hitboxWidth.value * 0.5;
    const halfLength = CAR.hitboxLength.value * 0.5;
    const halfHeight = CAR.hitboxHeight.value * 0.5;
    const position = { x: ARENA.sideWallX.value - 10, y: 0, z: 700 };
    const velocity = { x: 500, y: 0, z: 0 };

    resolver.resolveBox(position, velocity, 0, halfWidth, halfLength, halfHeight, 0);
    expect(position.x).toBeCloseTo(ARENA.sideWallX.value - halfWidth, 6);
    expect(velocity.x).toBe(0);

    position.x = ARENA.sideWallX.value - 10;
    velocity.x = 500;
    resolver.resolveBox(
      position,
      velocity,
      Math.PI * 0.5,
      halfWidth,
      halfLength,
      halfHeight,
      0,
    );
    expect(position.x).toBeCloseTo(ARENA.sideWallX.value - halfLength, 6);
  });
});
