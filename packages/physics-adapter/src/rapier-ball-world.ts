import RAPIER from '@dimforge/rapier3d-compat';
import { metresToUu, uuToMetres, type Vec3 } from '@aether/shared';
import { BALL, FIXED_DT, WORLD } from '@aether/simulation';

export interface RapierBallSnapshot {
  position: Vec3;
  linearVelocity: Vec3;
  angularVelocity: Vec3;
}

export class RapierBallWorld {
  private readonly world: RAPIER.World;
  private readonly body: RAPIER.RigidBody;

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: 0, z: -uuToMetres(WORLD.gravity.value) });
    this.world.timestep = FIXED_DT;

    const floor = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(60, 70, 0.05)
        .setTranslation(0, 0, -0.05)
        .setRestitution(BALL.restitution.value),
      floor,
    );

    this.body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, 0, uuToMetres(1000))
        .setCcdEnabled(true)
        .setCanSleep(false),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(uuToMetres(BALL.radius.value))
        .setMass(BALL.mass.value)
        .setRestitution(BALL.restitution.value),
      this.body,
    );
  }

  public static async create(): Promise<RapierBallWorld> {
    await RAPIER.init();
    return new RapierBallWorld();
  }

  public setBall(position: Readonly<Vec3>, linearVelocity: Readonly<Vec3>): void {
    this.body.setTranslation(
      { x: uuToMetres(position.x), y: uuToMetres(position.y), z: uuToMetres(position.z) },
      true,
    );
    this.body.setLinvel(
      {
        x: uuToMetres(linearVelocity.x),
        y: uuToMetres(linearVelocity.y),
        z: uuToMetres(linearVelocity.z),
      },
      true,
    );
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  public step(): void {
    this.world.step();
    const velocity = this.body.linvel();
    const speedUu = Math.hypot(velocity.x, velocity.y, velocity.z) * 100;
    if (speedUu > BALL.maximumLinearSpeed.value) {
      const scale = BALL.maximumLinearSpeed.value / speedUu;
      this.body.setLinvel(
        { x: velocity.x * scale, y: velocity.y * scale, z: velocity.z * scale },
        true,
      );
    }
    const angular = this.body.angvel();
    const angularSpeed = Math.hypot(angular.x, angular.y, angular.z);
    if (angularSpeed > BALL.maximumAngularSpeed.value) {
      const scale = BALL.maximumAngularSpeed.value / angularSpeed;
      this.body.setAngvel(
        { x: angular.x * scale, y: angular.y * scale, z: angular.z * scale },
        true,
      );
    }
  }

  public snapshot(): RapierBallSnapshot {
    const position = this.body.translation();
    const velocity = this.body.linvel();
    const angular = this.body.angvel();
    return {
      position: { x: metresToUu(position.x), y: metresToUu(position.y), z: metresToUu(position.z) },
      linearVelocity: {
        x: metresToUu(velocity.x),
        y: metresToUu(velocity.y),
        z: metresToUu(velocity.z),
      },
      angularVelocity: { x: angular.x, y: angular.y, z: angular.z },
    };
  }
}
