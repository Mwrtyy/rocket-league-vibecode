from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return source.replace(old, new, 1)


path = Path("packages/simulation/src/game-simulation.ts")
source = path.read_text()
source = replace_once(
    source,
    "} from '@aether/shared';\nimport { ARENA } from './constants/arena.js';",
    "} from '@aether/shared';\nimport { ArenaCollisionResolver } from './arena-collision.js';\nimport { ARENA } from './constants/arena.js';",
    "arena resolver import",
)
source = replace_once(
    source,
    "export class GameSimulation {\n  private current: SimulationState;",
    "export class GameSimulation {\n  private current: SimulationState;\n  private readonly arenaCollision = new ArenaCollisionResolver();",
    "arena resolver field",
)
source = replace_once(
    source,
    """  private resolveCarArena(car: CarState): void {
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
""",
    """  private resolveCarArena(car: CarState): void {
    const contact = this.arenaCollision.resolveBox(
      car.position,
      car.linearVelocity,
      car.rotation.yaw,
      CAR_HALF_WIDTH,
      CAR_HALF_LENGTH,
      CAR_HALF_HEIGHT,
      0,
    );
    car.grounded = contact.maximumUpNormal > 0.35;
  }

  private integrateBall(dt: number): void {
    const ball = this.current.ball;
    ball.linearVelocity.z -= WORLD.gravity.value * dt;
    clampMagnitude(ball.linearVelocity, BALL.maximumLinearSpeed.value);
    clampMagnitude(ball.angularVelocity, BALL.maximumAngularSpeed.value);
    addScaledVec3(ball.position, ball.linearVelocity, dt);

    const contact = this.arenaCollision.resolveSphere(
      ball.position,
      ball.linearVelocity,
      BALL.radius.value,
      BALL.restitution.value,
    );
    if (contact.maximumUpNormal > 0.95 && Math.abs(ball.linearVelocity.z) < 8) {
      ball.linearVelocity.z = 0;
    }
  }
""",
    "arena integration methods",
)
path.write_text(source)
Path(__file__).unlink()
