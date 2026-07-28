import {
  addScaledVec3,
  clamp,
  clampMagnitude,
  cloneVec3,
  dotVec3,
  lerpAngle,
  lerpVec3,
  magnitude,
  moveToward,
  normalizeVec3,
  wrapRadians,
  type Vec3,
} from '@aether/shared';
import { BALL } from './constants/ball.js';
import { CAR, steeringCurvature } from './constants/car.js';
import { FIXED_DT, WORLD } from './constants/world.js';
import { NEUTRAL_INPUT, type PlayerInputFrame } from './input.js';
import { createInitialState, type CarState, type SimulationState } from './state.js';

const CAR_HALF_LENGTH = CAR.hitboxLength.value * 0.5;
const CAR_HALF_WIDTH = CAR.hitboxWidth.value * 0.5;
const CAR_HALF_HEIGHT = CAR.hitboxHeight.value * 0.5;
const BALL_FLOOR_Z = WORLD.floorZ.value + BALL.radius.value;
const IMPACT_RESTITUTION = 0.55;
const POSITIONAL_SLOP = 0.01;

export interface InterpolatedGameState {
  tick: number;
  ballPosition: Vec3;
  carPosition: Vec3;
  carYaw: number;
  carPitch: number;
  carRoll: number;
}

export class GameSimulation {
  private current: SimulationState;
  private previous: SimulationState;
  private previousJumpDown = false;

  public constructor(initialState: SimulationState = createInitialState()) {
    this.current = structuredClone(initialState);
    this.previous = structuredClone(initialState);
  }

  public step(input: Readonly<PlayerInputFrame> = NEUTRAL_INPUT, dt = FIXED_DT): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.previous = structuredClone(this.current);
    const sanitized = sanitizeInput(input);
    this.integrateCar(sanitized, dt);
    this.integrateBall(dt);
    this.resolveCarBallContact();
    this.current.tick += 1;
    this.previousJumpDown = sanitized.jump;
  }

  public getState(): SimulationState {
    return structuredClone(this.current);
  }

  public setBall(
    position: Readonly<Vec3>,
    linearVelocity: Readonly<Vec3>,
    angularVelocity: Readonly<Vec3> = { x: 0, y: 0, z: 0 },
  ): void {
    this.current.ball.position = cloneVec3(position);
    this.current.ball.linearVelocity = cloneVec3(linearVelocity);
    this.current.ball.angularVelocity = cloneVec3(angularVelocity);
    this.previous = structuredClone(this.current);
  }

  public setCar(
    position: Readonly<Vec3>,
    linearVelocity: Readonly<Vec3> = { x: 0, y: 0, z: 0 },
    yaw = 0,
  ): void {
    const car = this.current.car;
    car.position = cloneVec3(position);
    car.linearVelocity = cloneVec3(linearVelocity);
    car.rotation.yaw = wrapRadians(yaw);
    car.rotation.pitch = 0;
    car.rotation.roll = 0;
    car.grounded = position.z <= CAR_HALF_HEIGHT + 0.5;
    this.previous = structuredClone(this.current);
  }

  public interpolate(alpha: number): InterpolatedGameState {
    const clampedAlpha = clamp(alpha, 0, 1);
    return {
      tick: this.current.tick,
      ballPosition: lerpVec3(this.previous.ball.position, this.current.ball.position, clampedAlpha),
      carPosition: lerpVec3(this.previous.car.position, this.current.car.position, clampedAlpha),
      carYaw: lerpAngle(this.previous.car.rotation.yaw, this.current.car.rotation.yaw, clampedAlpha),
      carPitch: lerpAngle(this.previous.car.rotation.pitch, this.current.car.rotation.pitch, clampedAlpha),
      carRoll: lerpAngle(this.previous.car.rotation.roll, this.current.car.rotation.roll, clampedAlpha),
    };
  }

  private integrateCar(input: Readonly<PlayerInputFrame>, dt: number): void {
    const car = this.current.car;
    const jumpPressed = input.jump && !this.previousJumpDown;
    const floorHeight = CAR_HALF_HEIGHT;
    const wasGrounded = car.grounded;

    if (car.grounded) this.integrateGroundDrive(car, input, dt);
    else this.integrateAirControl(car, input, dt);

    if (jumpPressed) this.handleJumpPress(car, input);
    if (
      input.jump &&
      car.jump.firstJumpConsumed &&
      !car.jump.secondJumpConsumed &&
      car.jump.jumpHeldSeconds < CAR.jumpHoldDuration.value
    ) {
      car.linearVelocity.z += CAR.jumpHoldAcceleration.value * dt;
      car.jump.jumpHeldSeconds += dt;
    }

    car.linearVelocity.z -= WORLD.gravity.value * dt;
    clampMagnitude(car.linearVelocity, CAR.boostedSpeedCap.value);
    clampMagnitude(car.angularVelocity, CAR.maximumAngularVelocity.value);
    addScaledVec3(car.position, car.linearVelocity, dt);

    car.rotation.yaw = wrapRadians(car.rotation.yaw + car.angularVelocity.z * dt);
    car.rotation.pitch = wrapRadians(car.rotation.pitch + car.angularVelocity.x * dt);
    car.rotation.roll = wrapRadians(car.rotation.roll + car.angularVelocity.y * dt);

    this.resolveCarArena(car, floorHeight);
    if (car.grounded) {
      car.jump.firstJumpConsumed = false;
      car.jump.secondJumpConsumed = false;
      car.jump.jumpHeldSeconds = 0;
      car.jump.airborneSeconds = 0;
      car.jump.dodgeActiveSeconds = 0;
      car.rotation.pitch = moveToward(car.rotation.pitch, 0, 10 * dt);
      car.rotation.roll = moveToward(car.rotation.roll, 0, 10 * dt);
      car.angularVelocity.x = moveToward(car.angularVelocity.x, 0, 20 * dt);
      car.angularVelocity.y = moveToward(car.angularVelocity.y, 0, 20 * dt);
    } else {
      car.jump.airborneSeconds += dt;
      if (car.jump.dodgeActiveSeconds > 0) {
        car.jump.dodgeActiveSeconds = Math.max(0, car.jump.dodgeActiveSeconds - dt);
      }
    }

    if (wasGrounded && !car.grounded && !car.jump.firstJumpConsumed) {
      car.jump.firstJumpConsumed = true;
      car.jump.airborneSeconds = 0;
    }

    car.supersonic = magnitude(car.linearVelocity) >= CAR.supersonicThreshold.value;
  }

  private integrateGroundDrive(car: CarState, input: Readonly<PlayerInputFrame>, dt: number): void {
    const forward = forwardFromYaw(car.rotation.yaw);
    const right = rightFromYaw(car.rotation.yaw);
    let forwardSpeed = dotVec3(car.linearVelocity, forward);
    let lateralSpeed = dotVec3(car.linearVelocity, right);
    const throttle = input.throttle;

    let longitudinalAcceleration = 0;
    if (Math.abs(throttle) < 0.001) {
      longitudinalAcceleration = -Math.sign(forwardSpeed) * CAR.coastingAcceleration.value;
      if (Math.abs(forwardSpeed) <= CAR.coastingAcceleration.value * dt) forwardSpeed = 0;
    } else if (Math.sign(throttle) !== Math.sign(forwardSpeed) && Math.abs(forwardSpeed) > 20) {
      longitudinalAcceleration = Math.sign(throttle) * CAR.brakingAcceleration.value;
    } else if (throttle > 0) {
      const remaining = clamp(1 - Math.max(0, forwardSpeed) / CAR.normalTopSpeed.value, 0, 1);
      longitudinalAcceleration = CAR.throttleAcceleration.value * remaining * throttle;
    } else {
      const remaining = clamp(1 - Math.max(0, -forwardSpeed) / CAR.reverseTopSpeed.value, 0, 1);
      longitudinalAcceleration = CAR.reverseAcceleration.value * remaining * throttle;
    }

    const boosting = input.boost && car.boost > 0 && throttle >= 0;
    if (boosting) {
      longitudinalAcceleration += CAR.groundBoostAcceleration.value;
      car.boost = Math.max(0, car.boost - CAR.boostConsumption.value * dt);
    }

    forwardSpeed += longitudinalAcceleration * dt;
    lateralSpeed *= Math.max(
      0,
      1 - (input.handbrake ? CAR.handbrakeLateralGrip.value : CAR.lateralGrip.value) * dt,
    );

    const totalHorizontalSpeed = Math.hypot(forwardSpeed, lateralSpeed);
    if (totalHorizontalSpeed > CAR.boostedSpeedCap.value) {
      const scale = CAR.boostedSpeedCap.value / totalHorizontalSpeed;
      forwardSpeed *= scale;
      lateralSpeed *= scale;
    }

    car.linearVelocity.x = forward.x * forwardSpeed + right.x * lateralSpeed;
    car.linearVelocity.y = forward.y * forwardSpeed + right.y * lateralSpeed;

    const speedForSteering = Math.abs(forwardSpeed);
    const direction = forwardSpeed < -5 ? -1 : 1;
    const handbrakeMultiplier = input.handbrake ? 1.45 : 1;
    car.angularVelocity.z =
      input.steer * speedForSteering * steeringCurvature(speedForSteering) * direction * handbrakeMultiplier;
  }

  private integrateAirControl(car: CarState, input: Readonly<PlayerInputFrame>, dt: number): void {
    const forward = forwardFromRotation(car.rotation.yaw, car.rotation.pitch);
    if (Math.abs(input.throttle) > 0.001) {
      addScaledVec3(car.linearVelocity, forward, CAR.airThrottleAcceleration.value * input.throttle * dt);
    }
    if (input.boost && car.boost > 0) {
      addScaledVec3(car.linearVelocity, forward, CAR.airBoostAcceleration.value * dt);
      car.boost = Math.max(0, car.boost - CAR.boostConsumption.value * dt);
    }

    car.angularVelocity.x += input.pitch * CAR.pitchAngularAcceleration.value * dt;
    car.angularVelocity.z += input.yaw * CAR.yawAngularAcceleration.value * dt;
    car.angularVelocity.y += input.roll * CAR.rollAngularAcceleration.value * dt;
    const damping = Math.max(0, 1 - 0.45 * dt);
    car.angularVelocity.x *= damping;
    car.angularVelocity.y *= damping;
    car.angularVelocity.z *= damping;
  }

  private handleJumpPress(car: CarState, input: Readonly<PlayerInputFrame>): void {
    if (car.grounded) {
      car.grounded = false;
      car.jump.firstJumpConsumed = true;
      car.jump.secondJumpConsumed = false;
      car.jump.jumpHeldSeconds = 0;
      car.jump.airborneSeconds = 0;
      car.linearVelocity.z = Math.max(car.linearVelocity.z, 0) + CAR.firstJumpImpulse.value;
      return;
    }

    if (
      !car.jump.firstJumpConsumed ||
      car.jump.secondJumpConsumed ||
      car.jump.airborneSeconds > CAR.secondJumpWindow.value
    ) {
      return;
    }

    car.jump.secondJumpConsumed = true;
    const localForward = clamp(-input.pitch + input.throttle * 0.25, -1, 1);
    const localSide = clamp(input.yaw + input.steer, -1, 1);
    const directionMagnitude = Math.hypot(localForward, localSide);
    if (directionMagnitude < CAR.dodgeDeadzone.value) {
      car.linearVelocity.z += CAR.doubleJumpImpulse.value;
      return;
    }

    const normalizedForward = localForward / directionMagnitude;
    const normalizedSide = localSide / directionMagnitude;
    const forward = forwardFromYaw(car.rotation.yaw);
    const right = rightFromYaw(car.rotation.yaw);
    car.linearVelocity.x +=
      (forward.x * normalizedForward + right.x * normalizedSide) * CAR.dodgeImpulse.value;
    car.linearVelocity.y +=
      (forward.y * normalizedForward + right.y * normalizedSide) * CAR.dodgeImpulse.value;
    car.linearVelocity.z += CAR.dodgeVerticalImpulse.value;
    car.angularVelocity.x += -normalizedForward * 5.2;
    car.angularVelocity.y += normalizedSide * 5.2;
    car.jump.dodgeActiveSeconds = 0.65;
  }

  private resolveCarArena(car: CarState, floorHeight: number): void {
    car.grounded = false;
    if (car.position.z <= floorHeight && car.linearVelocity.z <= 0) {
      car.position.z = floorHeight;
      car.linearVelocity.z = 0;
      car.grounded = true;
    }
    if (car.position.z > WORLD.ceilingZ.value - floorHeight) {
      car.position.z = WORLD.ceilingZ.value - floorHeight;
      if (car.linearVelocity.z > 0) car.linearVelocity.z *= -0.1;
    }
    const sideLimit = WORLD.sideWallX.value - CAR_HALF_WIDTH;
    if (Math.abs(car.position.x) > sideLimit) {
      car.position.x = Math.sign(car.position.x) * sideLimit;
      if (Math.sign(car.linearVelocity.x) === Math.sign(car.position.x)) car.linearVelocity.x *= -0.15;
    }
    const backLimit = WORLD.backWallY.value - CAR_HALF_LENGTH;
    if (Math.abs(car.position.y) > backLimit) {
      car.position.y = Math.sign(car.position.y) * backLimit;
      if (Math.sign(car.linearVelocity.y) === Math.sign(car.position.y)) car.linearVelocity.y *= -0.15;
    }
  }

  private integrateBall(dt: number): void {
    const ball = this.current.ball;
    ball.linearVelocity.z -= WORLD.gravity.value * dt;
    clampMagnitude(ball.linearVelocity, BALL.maximumLinearSpeed.value);
    clampMagnitude(ball.angularVelocity, BALL.maximumAngularSpeed.value);
    addScaledVec3(ball.position, ball.linearVelocity, dt);

    if (ball.position.z < BALL_FLOOR_Z) {
      ball.position.z = BALL_FLOOR_Z;
      if (ball.linearVelocity.z < 0) ball.linearVelocity.z = -ball.linearVelocity.z * BALL.restitution.value;
      if (Math.abs(ball.linearVelocity.z) < 8) ball.linearVelocity.z = 0;
    }
    const ceiling = WORLD.ceilingZ.value - BALL.radius.value;
    if (ball.position.z > ceiling) {
      ball.position.z = ceiling;
      if (ball.linearVelocity.z > 0) ball.linearVelocity.z *= -BALL.restitution.value;
    }
    const side = WORLD.sideWallX.value - BALL.radius.value;
    if (Math.abs(ball.position.x) > side) {
      ball.position.x = Math.sign(ball.position.x) * side;
      if (Math.sign(ball.linearVelocity.x) === Math.sign(ball.position.x)) {
        ball.linearVelocity.x *= -BALL.restitution.value;
      }
    }
    const back = WORLD.backWallY.value - BALL.radius.value;
    if (Math.abs(ball.position.y) > back) {
      ball.position.y = Math.sign(ball.position.y) * back;
      if (Math.sign(ball.linearVelocity.y) === Math.sign(ball.position.y)) {
        ball.linearVelocity.y *= -BALL.restitution.value;
      }
    }
  }

  private resolveCarBallContact(): void {
    const car = this.current.car;
    const ball = this.current.ball;
    const deltaX = ball.position.x - car.position.x;
    const deltaY = ball.position.y - car.position.y;
    const cosine = Math.cos(car.rotation.yaw);
    const sine = Math.sin(car.rotation.yaw);
    const localX = deltaX * cosine - deltaY * sine;
    const localY = deltaX * sine + deltaY * cosine;
    const localZ = ball.position.z - car.position.z;
    const closestX = clamp(localX, -CAR_HALF_WIDTH, CAR_HALF_WIDTH);
    const closestY = clamp(localY, -CAR_HALF_LENGTH, CAR_HALF_LENGTH);
    const closestZ = clamp(localZ, -CAR_HALF_HEIGHT, CAR_HALF_HEIGHT);
    const difference = { x: localX - closestX, y: localY - closestY, z: localZ - closestZ };
    const distance = magnitude(difference);
    if (distance >= BALL.radius.value) return;

    const localNormal = normalizeVec3(difference, { x: 0, y: 0, z: 1 });
    const normal = {
      x: localNormal.x * cosine + localNormal.y * sine,
      y: -localNormal.x * sine + localNormal.y * cosine,
      z: localNormal.z,
    };
    const penetration = BALL.radius.value - distance;
    addScaledVec3(ball.position, normal, penetration + POSITIONAL_SLOP);

    const contactOffset = {
      x: ball.position.x - car.position.x,
      y: ball.position.y - car.position.y,
      z: ball.position.z - car.position.z,
    };
    const contactVelocity = {
      x: car.linearVelocity.x - car.angularVelocity.z * contactOffset.y,
      y: car.linearVelocity.y + car.angularVelocity.z * contactOffset.x,
      z: car.linearVelocity.z,
    };
    const relativeVelocity = {
      x: ball.linearVelocity.x - contactVelocity.x,
      y: ball.linearVelocity.y - contactVelocity.y,
      z: ball.linearVelocity.z - contactVelocity.z,
    };
    const normalSpeed = dotVec3(relativeVelocity, normal);
    if (normalSpeed >= 0) return;

    const inverseMass = 1 / BALL.mass.value + 1 / CAR.mass.value;
    const dodgeAmplification = car.jump.dodgeActiveSeconds > 0 ? 1.18 : 1;
    const impulseMagnitude =
      (-(1 + IMPACT_RESTITUTION) * normalSpeed * dodgeAmplification) / inverseMass;
    const ballImpulseScale = impulseMagnitude / BALL.mass.value;
    const carImpulseScale = impulseMagnitude / CAR.mass.value;
    addScaledVec3(ball.linearVelocity, normal, ballImpulseScale);
    addScaledVec3(car.linearVelocity, normal, -carImpulseScale);

    const tangentVelocity = {
      x: relativeVelocity.x - normal.x * normalSpeed,
      y: relativeVelocity.y - normal.y * normalSpeed,
      z: relativeVelocity.z - normal.z * normalSpeed,
    };
    const tangent = normalizeVec3(tangentVelocity);
    const spinImpulse = Math.min(2.5, magnitude(tangentVelocity) / 900);
    ball.angularVelocity.x += (normal.y * tangent.z - normal.z * tangent.y) * spinImpulse;
    ball.angularVelocity.y += (normal.z * tangent.x - normal.x * tangent.z) * spinImpulse;
    ball.angularVelocity.z += (normal.x * tangent.y - normal.y * tangent.x) * spinImpulse;
    clampMagnitude(ball.linearVelocity, BALL.maximumLinearSpeed.value);
    clampMagnitude(ball.angularVelocity, BALL.maximumAngularSpeed.value);
  }
}

function sanitizeInput(input: Readonly<PlayerInputFrame>): PlayerInputFrame {
  return {
    sequence: Number.isSafeInteger(input.sequence) ? input.sequence : 0,
    tick: Number.isSafeInteger(input.tick) ? input.tick : 0,
    throttle: clampFinite(input.throttle),
    steer: clampFinite(input.steer),
    pitch: clampFinite(input.pitch),
    yaw: clampFinite(input.yaw),
    roll: clampFinite(input.roll),
    jump: input.jump === true,
    boost: input.boost === true,
    handbrake: input.handbrake === true,
    ballCam: input.ballCam !== false,
  };
}

function clampFinite(value: number): number {
  return Number.isFinite(value) ? clamp(value, -1, 1) : 0;
}

function forwardFromYaw(yaw: number): Vec3 {
  return { x: Math.sin(yaw), y: Math.cos(yaw), z: 0 };
}

function rightFromYaw(yaw: number): Vec3 {
  return { x: Math.cos(yaw), y: -Math.sin(yaw), z: 0 };
}

function forwardFromRotation(yaw: number, pitch: number): Vec3 {
  const horizontal = Math.cos(pitch);
  return {
    x: Math.sin(yaw) * horizontal,
    y: Math.cos(yaw) * horizontal,
    z: -Math.sin(pitch),
  };
}
