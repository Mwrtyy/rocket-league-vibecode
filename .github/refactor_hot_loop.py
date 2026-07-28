from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return source.replace(old, new, 1)


simulation_path = Path("packages/simulation/src/game-simulation.ts")
simulation = simulation_path.read_text()

simulation = replace_once(
    simulation,
    "  dotVec3,\n  lerpAngle,\n  lerpVec3,\n  magnitude,\n  moveToward,\n  normalizeVec3,\n",
    "  lerp,\n  lerpAngle,\n  magnitude,\n  moveToward,\n",
    "math imports",
)
simulation = replace_once(
    simulation,
    "import { createInitialState, type CarState, type SimulationState, type Team } from './state.js';",
    "import {\n  createInitialState,\n  type CarState,\n  type MatchPhase,\n  type SimulationState,\n  type Team,\n} from './state.js';",
    "state imports",
)

simulation = replace_once(
    simulation,
    """export interface InterpolatedGameState {
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
""",
    """export interface InterpolatedGameState {
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
""",
    "view interfaces and fields",
)

simulation = replace_once(
    simulation,
    """    this.current = structuredClone(seed);
    this.previous = structuredClone(seed);
""",
    """    this.current = structuredClone(seed);
    this.capturePreviousTransforms();
""",
    "constructor clone",
)
simulation = replace_once(
    simulation,
    """    this.previous = structuredClone(this.current);
    const sanitized = sanitizeInput(input);
""",
    """    this.capturePreviousTransforms();
    sanitizeInput(input, this.sanitizedInput);
    const sanitized = this.sanitizedInput;
""",
    "step snapshot",
)

simulation = replace_once(
    simulation,
    """  public getState(): SimulationState {
    return structuredClone(this.current);
  }

  public resetMatch(): void {
""",
    """  public getState(): SimulationState {
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
""",
    "state read APIs",
)
simulation = replace_once(
    simulation,
    """    this.current = reset;
    this.previous = structuredClone(reset);
    this.previousJumpDown = false;
""",
    """    this.current = reset;
    this.capturePreviousTransforms();
    this.previousJumpDown = false;
""",
    "reset snapshot",
)
simulation = simulation.replace("    this.previous = structuredClone(this.current);\n", "    this.capturePreviousTransforms();\n")
if "this.previous = structuredClone" in simulation:
    raise RuntimeError("unhandled previous structured clone")

old_interpolate = """  public interpolate(alpha: number): InterpolatedGameState {
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
"""
new_interpolate = """  public interpolate(
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
"""
simulation = replace_once(simulation, old_interpolate, new_interpolate, "interpolation")

simulation = replace_once(
    simulation,
    """    const forward = forwardFromYaw(car.rotation.yaw);
    const right = rightFromYaw(car.rotation.yaw);
    let forwardSpeed = dotVec3(car.linearVelocity, forward);
    let lateralSpeed = dotVec3(car.linearVelocity, right);
""",
    """    const sine = Math.sin(car.rotation.yaw);
    const cosine = Math.cos(car.rotation.yaw);
    let forwardSpeed = car.linearVelocity.x * sine + car.linearVelocity.y * cosine;
    let lateralSpeed = car.linearVelocity.x * cosine - car.linearVelocity.y * sine;
""",
    "ground direction",
)
simulation = replace_once(
    simulation,
    """    car.linearVelocity.x = forward.x * forwardSpeed + right.x * lateralSpeed;
    car.linearVelocity.y = forward.y * forwardSpeed + right.y * lateralSpeed;
""",
    """    car.linearVelocity.x = sine * forwardSpeed + cosine * lateralSpeed;
    car.linearVelocity.y = cosine * forwardSpeed - sine * lateralSpeed;
""",
    "ground velocity reconstruction",
)

simulation = replace_once(
    simulation,
    """    const forward = forwardFromRotation(car.rotation.yaw, car.rotation.pitch);
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
""",
    """    const horizontal = Math.cos(car.rotation.pitch);
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
""",
    "air direction",
)

simulation = replace_once(
    simulation,
    """    const forward = forwardFromYaw(car.rotation.yaw);
    const right = rightFromYaw(car.rotation.yaw);
    car.linearVelocity.x +=
      (forward.x * normalizedForward + right.x * normalizedSide) * CAR.dodgeImpulse.value;
    car.linearVelocity.y +=
      (forward.y * normalizedForward + right.y * normalizedSide) * CAR.dodgeImpulse.value;
""",
    """    const sine = Math.sin(car.rotation.yaw);
    const cosine = Math.cos(car.rotation.yaw);
    car.linearVelocity.x +=
      (sine * normalizedForward + cosine * normalizedSide) * CAR.dodgeImpulse.value;
    car.linearVelocity.y +=
      (cosine * normalizedForward - sine * normalizedSide) * CAR.dodgeImpulse.value;
""",
    "dodge direction",
)

old_contact = """    const difference = {
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
"""
new_contact = """    const differenceX = localX - closestX;
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
"""
simulation = replace_once(simulation, old_contact, new_contact, "contact scalarization")

simulation = replace_once(
    simulation,
    """function sanitizeInput(input: Readonly<PlayerInputFrame>): PlayerInputFrame {
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
""",
    """function sanitizeInput(
  input: Readonly<PlayerInputFrame>,
  target: PlayerInputFrame,
): void {
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
""",
    "input sanitation",
)

for helper in [
    """\nfunction forwardFromYaw(yaw: number): Vec3 {
  return { x: Math.sin(yaw), y: Math.cos(yaw), z: 0 };
}
""",
    """\nfunction rightFromYaw(yaw: number): Vec3 {
  return { x: Math.cos(yaw), y: -Math.sin(yaw), z: 0 };
}
""",
    """\nfunction forwardFromRotation(yaw: number, pitch: number): Vec3 {
  const horizontal = Math.cos(pitch);
  return {
    x: Math.sin(yaw) * horizontal,
    y: Math.cos(yaw) * horizontal,
    z: Math.sin(pitch),
  };
}
""",
]:
    simulation = replace_once(simulation, helper, "", "obsolete direction helper")

simulation_path.write_text(simulation)

client_path = Path("apps/client/src/main.ts")
client = client_path.read_text()
client = replace_once(
    client,
    """  FixedStepRunner,
  GameSimulation,
  type PlayerInputFrame,
""",
    """  FixedStepRunner,
  GameSimulation,
  createGameViewState,
  createInterpolatedGameState,
  type PlayerInputFrame,
""",
    "client imports",
)
client = replace_once(
    client,
    """const simulation = new GameSimulation(undefined, { matchMode: true });
const keys = new Set<string>();
""",
    """const simulation = new GameSimulation(undefined, { matchMode: true });
const interpolatedState = createInterpolatedGameState();
const viewState = createGameViewState();
const sampledInput: PlayerInputFrame = {
  sequence: 0,
  tick: 0,
  throttle: 0,
  steer: 0,
  pitch: 0,
  yaw: 0,
  roll: 0,
  jump: false,
  boost: false,
  handbrake: false,
  ballCam: true,
};
const keys = new Set<string>();
""",
    "client reusable state",
)

start = client.index("function gamepadInput(): Partial<PlayerInputFrame> {")
end = client.index("\nfunction applyDeadzone", start)
replacement = """function findConnectedGamepad(): Gamepad | null {
  const gamepads = navigator.getGamepads();
  for (let index = 0; index < gamepads.length; index += 1) {
    const candidate = gamepads[index];
    if (candidate?.connected) return candidate;
  }
  return null;
}

function sampleInput(): PlayerInputFrame {
  const pad = findConnectedGamepad();
  const keyboardThrottle = axis('KeyS', 'KeyW');
  const keyboardSteer = axis('KeyA', 'KeyD');
  const keyboardPitch = axis('KeyW', 'KeyS');
  const steer = pad === null ? keyboardSteer : applyDeadzone(pad.axes[0] ?? 0, 0.12);
  const vertical = pad === null ? keyboardPitch : applyDeadzone(pad.axes[1] ?? 0, 0.12);
  const togglePressed = keys.has('KeyC') || (pad?.buttons[3]?.pressed ?? false);
  if (togglePressed && !lastCameraToggle) ballCamera = !ballCamera;
  lastCameraToggle = togglePressed;

  sequence += 1;
  sampledInput.sequence = sequence;
  sampledInput.tick = simulation.getTick();
  sampledInput.throttle =
    pad === null
      ? keyboardThrottle
      : (pad.buttons[7]?.value ?? 0) - (pad.buttons[6]?.value ?? 0);
  sampledInput.steer = steer;
  sampledInput.pitch = vertical;
  sampledInput.yaw = steer;
  sampledInput.roll =
    pad === null
      ? axis('KeyQ', 'KeyE')
      : (pad.buttons[5]?.pressed ? 1 : 0) - (pad.buttons[4]?.pressed ? 1 : 0);
  sampledInput.jump = pad === null ? keys.has('Space') : (pad.buttons[0]?.pressed ?? false);
  sampledInput.boost =
    pad === null
      ? keys.has('ShiftLeft') || keys.has('ShiftRight')
      : (pad.buttons[1]?.pressed ?? false);
  sampledInput.handbrake =
    pad === null
      ? keys.has('ControlLeft') || keys.has('ControlRight')
      : (pad.buttons[2]?.pressed ?? false);
  sampledInput.ballCam = ballCamera;
  return sampledInput;
}
"""
client = client[:start] + replacement + client[end:]

client = replace_once(
    client,
    """  const interpolated = simulation.interpolate(stats.alpha);
  const state = simulation.getState();
""",
    """  const interpolated = simulation.interpolate(stats.alpha, interpolatedState);
  simulation.writeViewState(viewState);
""",
    "client render snapshots",
)
client = replace_once(
    client,
    """  for (const padState of state.boostPads) {
    const mesh = padMeshes[padState.id];
    if (mesh === undefined) continue;
    mesh.visible = padState.active;
    if (padState.active) {
      const pulse = 1 + Math.sin(now * 0.004 + padState.id) * 0.04;
      mesh.scale.set(pulse, 1, pulse);
    }
  }
""",
    """  for (let padId = 0; padId < padMeshes.length; padId += 1) {
    const mesh = padMeshes[padId];
    if (mesh === undefined) continue;
    const active = viewState.boostPadActive[padId] === 1;
    mesh.visible = active;
    if (active) {
      const pulse = 1 + Math.sin(now * 0.004 + padId) * 0.04;
      mesh.scale.set(pulse, 1, pulse);
    }
  }
""",
    "client pad view",
)
client = replace_once(
    client,
    """  const speed = Math.hypot(
    state.car.linearVelocity.x,
    state.car.linearVelocity.y,
    state.car.linearVelocity.z,
  );
  if (speedElement) speedElement.textContent = `${Math.round(speed * 0.036)} KM/H`;
  if (boostElement) boostElement.textContent = String(Math.round(state.car.boost));
  if (stateElement) {
    stateElement.textContent = state.car.supersonic
      ? 'SUPERSONIC'
      : state.car.grounded
        ? 'GROUNDED'
        : 'AIRBORNE';
  }
  if (blueScoreElement) blueScoreElement.textContent = String(state.match.blueScore);
  if (orangeScoreElement) orangeScoreElement.textContent = String(state.match.orangeScore);
  if (clockElement) {
    clockElement.textContent =
      state.match.phase === 'overtime' ? '+0:00' : formatClock(state.match.clockSeconds);
  }
  if (phaseElement) phaseElement.textContent = state.match.phase.toUpperCase();
  if (announcementElement) {
    if (state.match.phase === 'countdown') {
      announcementElement.textContent = String(
        Math.max(1, Math.ceil(state.match.countdownSeconds)),
      );
      announcementElement.classList.add('visible');
    } else if (state.match.phase === 'goal') {
      announcementElement.textContent = `${state.match.lastScorer?.toUpperCase() ?? ''} SCORES`;
      announcementElement.classList.add('visible');
    } else if (state.match.phase === 'ended') {
      const winner = state.match.blueScore > state.match.orangeScore ? 'BLUE' : 'ORANGE';
      announcementElement.textContent = `${winner} WINS`;
      announcementElement.classList.add('visible');
    } else if (state.match.phase === 'overtime') {
      announcementElement.textContent = 'OVERTIME';
      announcementElement.classList.add('visible');
    } else {
      announcementElement.textContent = '';
      announcementElement.classList.remove('visible');
    }
  }
""",
    """  if (speedElement) speedElement.textContent = `${Math.round(viewState.carSpeed * 0.036)} KM/H`;
  if (boostElement) boostElement.textContent = String(Math.round(viewState.carBoost));
  if (stateElement) {
    stateElement.textContent = viewState.carSupersonic
      ? 'SUPERSONIC'
      : viewState.carGrounded
        ? 'GROUNDED'
        : 'AIRBORNE';
  }
  if (blueScoreElement) blueScoreElement.textContent = String(viewState.blueScore);
  if (orangeScoreElement) orangeScoreElement.textContent = String(viewState.orangeScore);
  if (clockElement) {
    clockElement.textContent =
      viewState.matchPhase === 'overtime' ? '+0:00' : formatClock(viewState.clockSeconds);
  }
  if (phaseElement) phaseElement.textContent = viewState.matchPhase.toUpperCase();
  if (announcementElement) {
    if (viewState.matchPhase === 'countdown') {
      announcementElement.textContent = String(Math.max(1, Math.ceil(viewState.countdownSeconds)));
      announcementElement.classList.add('visible');
    } else if (viewState.matchPhase === 'goal') {
      announcementElement.textContent = `${viewState.lastScorer?.toUpperCase() ?? ''} SCORES`;
      announcementElement.classList.add('visible');
    } else if (viewState.matchPhase === 'ended') {
      const winner = viewState.blueScore > viewState.orangeScore ? 'BLUE' : 'ORANGE';
      announcementElement.textContent = `${winner} WINS`;
      announcementElement.classList.add('visible');
    } else if (viewState.matchPhase === 'overtime') {
      announcementElement.textContent = 'OVERTIME';
      announcementElement.classList.add('visible');
    } else {
      announcementElement.textContent = '';
      announcementElement.classList.remove('visible');
    }
  }
""",
    "client telemetry view",
)
client_path.write_text(client)

Path(__file__).unlink()
