import {
  addScaledVec3,
  clamp,
  clampMagnitude,
  cloneVec3,
  lerp,
  lerpAngle,
  magnitude,
  moveToward,
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
import {
  createInitialState,
  type CarState,
  type MatchPhase,
  type SimulationState,
  type Team,
} from './state.js';

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

export interface GameViewState {
  tick: number;
  carSpeed: number;
  carBoost: number;
  carGrounded: boolean;
  carSupersonic: boolean;
  matchPhase: MatchPhase;
  clockSeconds: number;
  countdownSeconds: number;
  blueScore: number;
  orangeScore: number;
  lastScorer: Team | null;
  boostPadActive: Uint8Array;
}

interface PreviousTransforms {
  readonly ballPosition: Vec3;
  readonly carPosition: Vec3;
  carYaw: number;
  carPitch: number;
  carRoll: number;
}

export function createInterpolatedGameState(): InterpolatedGameState {
  return {
    tick: 0,
    ballPosition: { x: 0, y: 0, z: 0 },
    carPosition: { x: 0, y: 0, z: 0 },
    carYaw: 0,
    carPitch: 0,
    carRoll: 0,
  };
}

export function createGameViewState(): GameViewState {
  return {
    tick: 0,
    carSpeed: 0,
    carBoost: 0,
    carGrounded: false,
    carSupersonic: false,
    matchPhase: 'freeplay',
    clockSeconds: 0,
    countdownSeconds: 0,
    blueScore: 0,
    orangeScore: 0,
    lastScorer: null,
    boostPadActive: new Uint8Array(BOOST_PAD_LAYOUT.length),
  };
}

export class GameSimulation {
  private current: SimulationState;
  private readonly previous: PreviousTransforms = {
    ballPosition: { x: 0, y: 0, z: 0 },
    carPosition: { x: 0, y: 0, z: 0 },
    carYaw: 0,
    carPitch: 0,
    carRoll: 0,
  };
  private readonly sanitizedInput: PlayerInputFrame = { ...NEUTRAL_INPUT };
  private previousJumpDown = false;
  private readonly matchMode: boolean;

  public constructor(initialState?: SimulationState, options: GameSimulationOptions = {}) {
    this.matchMode =
      options.matchMode ?? (initialState !== undefined && initialState.match.phase !== 'freeplay');
    const seed = initialState ?? createInitialState(this.matchMode);
    this.current = structuredClone(seed);
    this.capturePreviousTransforms();
  }

  public step(input: Readonly<PlayerInputFrame> = NEUTRAL_INPUT, dt = FIXED_DT): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.capturePreviousTransforms();
    sanitizeInput(input, this.sanitizedInput);
    const sanitized = this.sanitizedInput;
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

  public getTick(): number {
    return this.current.tick;
  }

  public writeViewState(target: GameViewState): GameViewState {
    const car = this.current.car;
    const match = this.current.match;
    target.tick = this.current.tick;
    target.carSpeed = magnitude(car.linearVelocity);
    target.carBoost = car.boost;
    target.carGrounded = car.grounded;
    target.carSupersonic = car.supersonic;
    target.matchPhase = match.phase;
    target.clockSeconds = match.clockSeconds;
    target.countdownSeconds = match.countdownSeconds;
    target.blueScore = match.blueScore;
    target.orangeScore = match.orangeScore;
    target.lastScorer = match.lastScorer;
    for (let index = 0; index < this.current.boostPads.length; index += 1) {
      target.boostPadActive[index] = this.current.boostPads[index]?.active ? 1 : 0;
    }
    return target;
  }

  public resetMatch(): void {
    const reset = createInitialState(this.matchMode);
    this.current = reset;
    this.capturePreviousTransforms();
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
    this.capturePreviousTransforms();
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
    this.capturePreviousTransforms();
  }

  public interpolate(
    alpha: number,
    target: InterpolatedGameState = createInterpolatedGameState(),
  ): InterpolatedGameState {
    const clampedAlpha = clamp(alpha, 0, 1);
    const ball = this.current.ball.position;
    const car = this.current.car;
    target.tick = this.current.tick;
    target.ballPosition.x = lerp(this.previous.ballPosition.x, ball.x, clampedAlpha);
    target.ballPosition.y = lerp(this.previous.ballPosition.y, ball.y, clampedAlpha);
    target.ballPosition.z = lerp(this.previous.ballPosition.z, ball.z, clampedAlpha);
    target.carPosition.x = lerp(this.previous.carPosition.x, car.position.x, clampedAlpha);
    target.carPosition.y = lerp(this.previous.carPosition.y, car.position.y, clampedAlpha);
    target.carPosition.z = lerp(this.previous.carPosition.z, car.position.z, clampedAlpha);
    target.carYaw = lerpAngle(this.previous.carYaw, car.rotation.yaw, clampedAlpha);
    target.carPitch = lerpAngle(this.previous.carPitch, car.rotation.pitch, clampedAlpha);
    target.carRoll = lerpAngle(this.previous.carRoll, car.rotation.roll, clampedAlpha);
    return target;
  }

  private capturePreviousTransforms(): void {
    const ball = this.current.ball.position;
    const car = this.current.car;
    this.previous.ballPosition.x = ball.x;
    this.previous.ballPosition.y = ball.y;
    this.previous.ballPosition.z = ball.z;
    this.previous.carPosition.x = car.position.x;
    this.previous.carPosition.y = car.position.y;
    this.previous.carPosition.z = car.position.z;
    this.previous.carYaw = car.rotation.yaw;
    this.previous.carPitch = car.rotation.pitch;
    this.previous.carRoll = car.rotation.roll;
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
    const sine = Math.sin(car.rotation.yaw);
    const cosine = Math.cos(car.rotation.yaw);
    let forwardSpeed = car.linearVelocity.x * sine + car.linearVelocity.y * cosine;
    let lateralSpeed = car.linearVelocity.x * cosine - car.linearVelocity.y * sine;
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

    car.linearVelocity.x = sine * forwardSpeed + cosine * lateralSpeed;
    car.linearVelocity.y = cosine * forwardSpeed - sine * lateralSpeed;

    const steeringSpeed = Math.abs(forwardSpeed);
    const direction = forwardSpeed < -5 ? -1 : 1;
    const slideMultiplier = input.handbrake ? 1.45 : 1;
    car.angularVelocity.z =
      input.steer * steeringSpeed * steeringCurvature(steeringSpeed) * direction * slideMultiplier;
  }

  private integrateAirControl(car: CarState, input: Readonly<PlayerInputFrame>, dt: number): void {
    const horizontal = Math.cos(car.rotation.pitch);
    const forwardX = Math.sin(car.rotation.yaw) * horizontal;
    const forwardY = Math.cos(car.rotation.yaw) * horizontal;
    const forwardZ = Math.sin(car.rotation.pitch);
    if (Math.abs(input.throttle) > 0.001) {
      const impulse = CAR.airThrottleAcceleration.value * input.throttle * dt;
      car.linearVelocity.x += forwardX * impulse;
      car.linearVelocity.y += forwardY * impulse;
      car.linearVelocity.z += forwardZ * impulse;
    }
    if (input.boost && car.boost > 0) {
      const impulse = CAR.airBoostAcceleration.value * dt;
      car.linearVelocity.x += forwardX * impulse;
      car.linearVelocity.y += forwardY * impulse;
      car.linearVelocity.z += forwardZ * impulse;
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
    const sine = Math.sin(car.rotation.yaw);
    const cosine = Math.cos(car.rotation.yaw);
    car.linearVelocity.x +=
      (sine * normalizedForward + cosine * normalizedSide) * CAR.dodgeImpulse.value;
    car.linearVelocity.y +=
      (cosine * normalizedForward - sine * normalizedSide) * CAR.dodgeImpulse.value;
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
    const differenceX = localX - closestX;
    const differenceY = localY - closestY;
    const differenceZ = localZ - closestZ;
    const distance = Math.hypot(differenceX, differenceY, differenceZ);
    if (distance >= BALL.radius.value) return;

    const inverseDistance = distance > Number.EPSILON ? 1 / distance : 0;
    const localNormalX = differenceX * inverseDistance;
    const localNormalY = differenceY * inverseDistance;
    const localNormalZ = distance > Number.EPSILON ? differenceZ * inverseDistance : 1;
    const normalX = localNormalX * cosine + localNormalY * sine;
    const normalY = -localNormalX * sine + localNormalY * cosine;
    const normalZ = localNormalZ;
    const correction = BALL.radius.value - distance + POSITIONAL_SLOP;
    ball.position.x += normalX * correction;
    ball.position.y += normalY * correction;
    ball.position.z += normalZ * correction;

    const contactOffsetX = ball.position.x - car.position.x;
    const contactOffsetY = ball.position.y - car.position.y;
    const contactVelocityX = car.linearVelocity.x - car.angularVelocity.z * contactOffsetY;
    const contactVelocityY = car.linearVelocity.y + car.angularVelocity.z * contactOffsetX;
    const relativeX = ball.linearVelocity.x - contactVelocityX;
    const relativeY = ball.linearVelocity.y - contactVelocityY;
    const relativeZ = ball.linearVelocity.z - car.linearVelocity.z;
    const normalSpeed = relativeX * normalX + relativeY * normalY + relativeZ * normalZ;
    if (normalSpeed >= 0) return;

    const inverseMass = 1 / BALL.mass.value + 1 / CAR.mass.value;
    const dodgeMultiplier = car.jump.dodgeActiveSeconds > 0 ? 1.18 : 1;
    const impulse = (-(1 + IMPACT_RESTITUTION) * normalSpeed * dodgeMultiplier) / inverseMass;
    const ballImpulse = impulse / BALL.mass.value;
    const carImpulse = impulse / CAR.mass.value;
    ball.linearVelocity.x += normalX * ballImpulse;
    ball.linearVelocity.y += normalY * ballImpulse;
    ball.linearVelocity.z += normalZ * ballImpulse;
    car.linearVelocity.x -= normalX * carImpulse;
    car.linearVelocity.y -= normalY * carImpulse;
    car.linearVelocity.z -= normalZ * carImpulse;

    const tangentX = relativeX - normalX * normalSpeed;
    const tangentY = relativeY - normalY * normalSpeed;
    const tangentZ = relativeZ - normalZ * normalSpeed;
    const tangentLength = Math.hypot(tangentX, tangentY, tangentZ);
    const inverseTangent = tangentLength > Number.EPSILON ? 1 / tangentLength : 0;
    const normalizedTangentX = tangentX * inverseTangent;
    const normalizedTangentY = tangentY * inverseTangent;
    const normalizedTangentZ = tangentZ * inverseTangent;
    const spinImpulse = Math.min(2.5, tangentLength / 900);
    ball.angularVelocity.x +=
      (normalY * normalizedTangentZ - normalZ * normalizedTangentY) * spinImpulse;
    ball.angularVelocity.y +=
      (normalZ * normalizedTangentX - normalX * normalizedTangentZ) * spinImpulse;
    ball.angularVelocity.z +=
      (normalX * normalizedTangentY - normalY * normalizedTangentX) * spinImpulse;
    clampMagnitude(ball.linearVelocity, BALL.maximumLinearSpeed.value);
    clampMagnitude(ball.angularVelocity, BALL.maximumAngularSpeed.value);
  }
}

function sanitizeInput(input: Readonly<PlayerInputFrame>, target: PlayerInputFrame): void {
  target.sequence = Number.isSafeInteger(input.sequence) ? input.sequence : 0;
  target.tick = Number.isSafeInteger(input.tick) ? input.tick : 0;
  target.throttle = clampFinite(input.throttle);
  target.steer = clampFinite(input.steer);
  target.pitch = clampFinite(input.pitch);
  target.yaw = clampFinite(input.yaw);
  target.roll = clampFinite(input.roll);
  target.jump = input.jump === true;
  target.boost = input.boost === true;
  target.handbrake = input.handbrake === true;
  target.ballCam = input.ballCam !== false;
}

function clampFinite(value: number): number {
  return Number.isFinite(value) ? clamp(value, -1, 1) : 0;
}
