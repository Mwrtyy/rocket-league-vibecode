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
import { ARENA } from './constants/arena.js';
import { BALL } from './constants/ball.js';
import { BOOST, BOOST_PAD_LAYOUT } from './constants/boost.js';
import { CAR, steeringCurvature } from './constants/car.js';
import { MATCH } from './constants/match.js';
import { FIXED_DT, WORLD } from './constants/world.js';
import { NEUTRAL_INPUT, type PlayerInputFrame } from './input.js';
import { createInitialState, type CarState, type SimulationState, type Team } from './state.js';

const CAR_HALF_LENGTH = CAR.hitboxLength.value * 0.5;
const CAR_HALF_WIDTH = CAR.hitboxWidth.value * 0.5;
const CAR_HALF_HEIGHT = CAR.hitboxHeight.value * 0.5;
const BALL_FLOOR_Z = WORLD.floorZ.value + BALL.radius.value;
const IMPACT_RESTITUTION = 0.55;
const POSITIONAL_SLOP = 0.01;
const TIME_EPSILON = 1e-6;

export interface GameSimulationOptions {
  readonly matchMode?: boolean;
}

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
  private readonly matchMode: boolean;

  public constructor(initialState?: SimulationState, options: GameSimulationOptions = {}) {
    this.matchMode =
      options.matchMode ?? (initialState !== undefined && initialState.match.phase !== 'freeplay');
    const seed = initialState ?? createInitialState(this.matchMode);
    this.current = structuredClone(seed);
    this.previous = structuredClone(seed);
  }

  public step(input: Readonly<PlayerInputFrame> = NEUTRAL_INPUT, dt = FIXED_DT): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.previous = structuredClone(this.current);
    const sanitized = sanitizeInput(input);
    this.advanceBoostPadTimers(dt);

    if (this.matchMode && this.advanceFrozenMatchPhase(dt)) {
      this.current.tick += 1;
      this.previousJumpDown = sanitized.jump;
      return;
    }

    this.integrateCar(sanitized, dt);
    this.integrateBall(dt);
    this.resolveCarBallContact();
    this.collectBoostPads();

    if (this.matchMode) {
      const scorer = this.detectGoal();
      if (scorer === null) this.advanceMatchClock(dt);
      else this.registerGoal(scorer);
    }

    this.current.tick += 1;
    this.previousJumpDown = sanitized.jump;
  }

  public getState(): SimulationState {
    return structuredClone(this.current);
  }

  public resetMatch(): void {
    const reset = createInitialState(this.matchMode);
    this.current = reset;
    this.previous = structuredClone(reset);
    this.previousJumpDown = false;
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
      carYaw: lerpAngle(
        this.previous.car.rotation.yaw,
        this.current.car.rotation.yaw,
        clampedAlpha,
      ),
      carPitch: lerpAngle(
        this.previous.car.rotation.pitch,
        this.current.car.rotation.pitch,
        clampedAlpha,
      ),
      carRoll: lerpAngle(
        this.previous.car.rotation.roll,
        this.current.car.rotation.roll,
        clampedAlpha,
      ),
    };
  }

  private integrateCar(input: Readonly<PlayerInputFrame>, dt: number): void {
    const car = this.current.car;
    const jumpPressed = input.jump && !this.previousJumpDown;
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

    this.resolveCarArena(car);
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

    let acceleration: number;
    if (Math.abs(throttle) < 0.001) {
      acceleration = -Math.sign(forwardSpeed) * CAR.coastingAcceleration.value;
      if (Math.abs(forwardSpeed) <= CAR.coastingAcceleration.value * dt) forwardSpeed = 0;
    } else if (Math.sign(throttle) !== Math.sign(forwardSpeed) && Math.abs(forwardSpeed) > 20) {
      acceleration = Math.sign(throttle) * CAR.brakingAcceleration.value;
    } else if (throttle > 0) {
      const remaining = clamp(1 - Math.max(0, forwardSpeed) / CAR.normalTopSpeed.value, 0, 1);
      acceleration = CAR.throttleAcceleration.value * remaining * throttle;
    } else {
      const remaining = clamp(1 - Math.max(0, -forwardSpeed) / CAR.reverseTopSpeed.value, 0, 1);
      acceleration = CAR.reverseAcceleration.value * remaining * throttle;
    }

    if (input.boost && car.boost > 0 && throttle >= 0) {
      acceleration += CAR.groundBoostAcceleration.value;
      car.boost = Math.max(0, car.boost - CAR.boostConsumption.value * dt);
    }

    forwardSpeed += acceleration * dt;
    const grip = input.handbrake ? CAR.handbrakeLateralGrip.value : CAR.lateralGrip.value;
    lateralSpeed *= Math.max(0, 1 - grip * dt);

    const horizontalSpeed = Math.hypot(forwardSpeed, lateralSpeed);
    if (horizontalSpeed > CAR.boostedSpeedCap.value) {
      const scale = CAR.boostedSpeedCap.value / horizontalSpeed;
      forwardSpeed *= scale;
      lateralSpeed *= scale;
    }

    car.linearVelocity.x = forward.x * forwardSpeed + right.x * lateralSpeed;
    car.linearVelocity.y = forward.y * forwardSpeed + right.y * lateralSpeed;

    const steeringSpeed = Math.abs(forwardSpeed);
    const direction = forwardSpeed < -5 ? -1 : 1;
    const slideMultiplier = input.handbrake ? 1.45 : 1;
    car.angularVelocity.z =
      input.steer * steeringSpeed * steeringCurvature(steeringSpeed) * direction * slideMultiplier;
  }

  private integrateAirControl(car: CarState, input: Readonly<PlayerInputFrame>, dt: number): void {
    const forward = forwardFromRotation(car.rotation.yaw, car.rotation.pitch);
    if (Math.abs(input.throttle) > 0.001) {
      addScaledVec3(
        car.linearVelocity,
        forward,
        CAR.airThrottleAcceleration.value * input.throttle * dt,
      );
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
    const directionLength = Math.hypot(localForward, localSide);
    if (directionLength < CAR.dodgeDeadzone.value) {
      car.linearVelocity.z += CAR.doubleJumpImpulse.value;
      return;
    }

    const normalizedForward = localForward / directionLength;
    const normalizedSide = localSide / directionLength;
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

  private resolveCarArena(car: CarState): void {
    car.grounded = false;
    if (car.position.z <= CAR_HALF_HEIGHT && car.linearVelocity.z <= 0) {
      car.position.z = CAR_HALF_HEIGHT;
      car.linearVelocity.z = 0;
      car.grounded = true;
    }
    const ceiling = WORLD.ceilingZ.value - CAR_HALF_HEIGHT;
    if (car.position.z > ceiling) {
      car.position.z = ceiling;
      if (car.linearVelocity.z > 0) car.linearVelocity.z *= -0.1;
    }
    const side = WORLD.sideWallX.value - CAR_HALF_WIDTH;
    if (Math.abs(car.position.x) > side) {
      car.position.x = Math.sign(car.position.x) * side;
      if (Math.sign(car.linearVelocity.x) === Math.sign(car.position.x)) {
        car.linearVelocity.x *= -0.15;
      }
    }
    const back = WORLD.backWallY.value - CAR_HALF_LENGTH;
    if (Math.abs(car.position.y) > back) {
      car.position.y = Math.sign(car.position.y) * back;
      if (Math.sign(car.linearVelocity.y) === Math.sign(car.position.y)) {
        car.linearVelocity.y *= -0.15;
      }
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
      if (ball.linearVelocity.z < 0) {
        ball.linearVelocity.z = -ball.linearVelocity.z * BALL.restitution.value;
      }
      if (Math.abs(ball.linearVelocity.z) < 8) ball.linearVelocity.z = 0;
    }
    const ceiling = WORLD.ceilingZ.value - BALL.radius.value;
    if (ball.position.z > ceiling) {
      ball.position.z = ceiling;
      if (ball.linearVelocity.z > 0) {
        ball.linearVelocity.z *= -BALL.restitution.value;
      }
    }
    const side = WORLD.sideWallX.value - BALL.radius.value;
    if (Math.abs(ball.position.x) > side) {
      ball.position.x = Math.sign(ball.position.x) * side;
      if (Math.sign(ball.linearVelocity.x) === Math.sign(ball.position.x)) {
        ball.linearVelocity.x *= -BALL.restitution.value;
      }
    }
    const withinGoalOpening =
      Math.abs(ball.position.x) <= ARENA.goalHalfWidth.value - BALL.radius.value &&
      ball.position.z <= ARENA.goalHeight.value - BALL.radius.value;
    const back = withinGoalOpening
      ? WORLD.backWallY.value + ARENA.goalDepth.value - BALL.radius.value
      : WORLD.backWallY.value - BALL.radius.value;
    if (Math.abs(ball.position.y) > back) {
      ball.position.y = Math.sign(ball.position.y) * back;
      if (Math.sign(ball.linearVelocity.y) === Math.sign(ball.position.y)) {
        ball.linearVelocity.y *= -BALL.restitution.value;
      }
    }
  }

  private advanceBoostPadTimers(dt: number): void {
    for (const pad of this.current.boostPads) {
      if (pad.active) continue;
      if (pad.respawnSeconds <= dt + TIME_EPSILON) {
        pad.respawnSeconds = 0;
        pad.active = true;
      } else {
        pad.respawnSeconds -= dt;
      }
    }
  }

  private collectBoostPads(): void {
    const car = this.current.car;
    if (!car.grounded || car.boost >= 100) return;
    for (const pad of this.current.boostPads) {
      if (!pad.active) continue;
      const definition = BOOST_PAD_LAYOUT[pad.id];
      if (definition === undefined) continue;
      const radius = definition.isLarge ? BOOST.largeRadius.value : BOOST.smallRadius.value;
      const height = definition.isLarge ? BOOST.largeHeight.value : BOOST.smallHeight.value;
      if (car.position.z < 0 || car.position.z > height) continue;
      if (
        Math.hypot(car.position.x - definition.position.x, car.position.y - definition.position.y) >
        radius
      ) {
        continue;
      }
      car.boost = definition.isLarge ? 100 : Math.min(100, car.boost + BOOST.smallGrant.value);
      pad.active = false;
      pad.respawnSeconds = definition.isLarge ? BOOST.largeRespawn.value : BOOST.smallRespawn.value;
    }
  }

  private advanceFrozenMatchPhase(dt: number): boolean {
    const match = this.current.match;
    if (match.phase === 'countdown') {
      if (match.countdownSeconds <= dt + TIME_EPSILON) {
        match.countdownSeconds = 0;
        match.phase =
          match.clockSeconds <= 0 && match.blueScore === match.orangeScore ? 'overtime' : 'playing';
      } else {
        match.countdownSeconds -= dt;
      }
      return true;
    }
    if (match.phase === 'goal') {
      if (match.goalPauseSeconds <= dt + TIME_EPSILON) {
        match.goalPauseSeconds = 0;
        this.resetKickoff();
      } else {
        match.goalPauseSeconds -= dt;
      }
      return true;
    }
    return match.phase === 'ended';
  }

  private advanceMatchClock(dt: number): void {
    const match = this.current.match;
    if (match.phase !== 'playing') return;
    if (match.clockSeconds > 0) {
      if (match.clockSeconds <= dt + TIME_EPSILON) {
        match.clockSeconds = 0;
        match.zeroSecondActive = true;
      } else {
        match.clockSeconds -= dt;
      }
    }
    if (!match.zeroSecondActive || !this.isBallGrounded()) return;
    match.zeroSecondActive = false;
    if (match.blueScore === match.orangeScore) {
      this.resetKickoff();
      this.current.match.clockSeconds = 0;
    } else {
      match.phase = 'ended';
    }
  }

  private detectGoal(): Team | null {
    const ball = this.current.ball;
    const insideMouth =
      Math.abs(ball.position.x) <= ARENA.goalHalfWidth.value - BALL.radius.value &&
      ball.position.z <= ARENA.goalHeight.value - BALL.radius.value;
    if (!insideMouth) return null;
    if (ball.position.y > WORLD.backWallY.value) return 'blue';
    if (ball.position.y < -WORLD.backWallY.value) return 'orange';
    return null;
  }

  private registerGoal(team: Team): void {
    const match = this.current.match;
    if (team === 'blue') match.blueScore += 1;
    else match.orangeScore += 1;
    match.lastScorer = team;
    match.zeroSecondActive = false;
    if (match.phase === 'overtime' || match.clockSeconds <= 0) {
      match.phase = 'ended';
      return;
    }
    match.phase = 'goal';
    match.goalPauseSeconds = MATCH.goalPause.value;
  }

  private isBallGrounded(): boolean {
    return this.current.ball.position.z <= BALL_FLOOR_Z + MATCH.zeroSecondGroundTolerance.value;
  }

  private resetKickoff(): void {
    const match = this.current.match;
    this.setCar({ x: 0, y: -1200, z: CAR_HALF_HEIGHT }, { x: 0, y: 0, z: 0 }, 0);
    this.current.car.boost = MATCH.startingBoost.value;
    this.setBall({ x: 0, y: 0, z: BALL_FLOOR_Z }, { x: 0, y: 0, z: 0 });
    for (const pad of this.current.boostPads) {
      pad.active = true;
      pad.respawnSeconds = 0;
    }
    match.phase = 'countdown';
    match.countdownSeconds = MATCH.kickoffCountdown.value;
    match.goalPauseSeconds = 0;
    match.lastScorer = null;
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
    const difference = {
      x: localX - closestX,
      y: localY - closestY,
      z: localZ - closestZ,
    };
    const distance = magnitude(difference);
    if (distance >= BALL.radius.value) return;

    const localNormal = normalizeVec3(difference, { x: 0, y: 0, z: 1 });
    const normal = {
      x: localNormal.x * cosine + localNormal.y * sine,
      y: -localNormal.x * sine + localNormal.y * cosine,
      z: localNormal.z,
    };
    addScaledVec3(ball.position, normal, BALL.radius.value - distance + POSITIONAL_SLOP);

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
    const dodgeMultiplier = car.jump.dodgeActiveSeconds > 0 ? 1.18 : 1;
    const impulse = (-(1 + IMPACT_RESTITUTION) * normalSpeed * dodgeMultiplier) / inverseMass;
    addScaledVec3(ball.linearVelocity, normal, impulse / BALL.mass.value);
    addScaledVec3(car.linearVelocity, normal, -impulse / CAR.mass.value);

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
    z: Math.sin(pitch),
  };
}
