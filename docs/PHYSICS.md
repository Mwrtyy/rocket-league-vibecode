# Physics

## Fixed timestep

The canonical simulation rate is 120 Hz:

```ts
PHYSICS_HZ = 120
FIXED_DT = 1 / PHYSICS_HZ
```

The render loop uses an accumulator with a scale-relative comparison epsilon. Catch-up is capped to prevent a suspended tab from causing an unbounded simulation spiral. Excess elapsed time is recorded rather than changing gameplay speed. Regression tests cover 30, 60, 120 and 144 Hz rendering.

## Unit system

Public gameplay data uses `uu`, where `1 uu = 1 cm`. Rapier uses metres, with conversion centralized in `@aether/shared/units`.

## Simulation paths

Two paths exist intentionally:

1. `GameSimulation` is the shared deterministic gameplay implementation used by the browser client and authoritative server.
2. `RapierBallWorld` is the physics-lab integration path for CCD, rigid-body contact and world-scale experiments.

`GameSimulation` currently implements:

- gravity and magnitude-based linear/angular speed caps;
- ball floor, side-wall, ceiling, back-wall and goal-interior constraints;
- throttle, reverse, braking, coasting, boost and speed-dependent steering;
- lateral grip and reduced handbrake grip;
- jump hold, second jump, directional dodge and basic aerial torque;
- yaw-oriented car box versus sphere contact;
- relative contact velocity, impulse sharing, dodge amplification and spin transfer;
- deterministic boost-pad pickup and respawn;
- kickoff, regulation clock, goals, zero-second state and overtime.

## Accuracy boundaries

The current car controller is a functional force model, not yet the final four-wheel solver. Grounding is currently floor-relative and the physical box uses yaw for ball contact. Therefore wall driving, ceiling driving, per-wheel suspension, pitch/roll-aware hitbox contact and recovery behavior remain incomplete.

The rectangular arena constraints and goal opening are functional. Curved floor-to-wall transitions, rounded corners, backboard curves, post/crossbar collision and seam-continuity validation remain the next geometry milestone.

Ball–car response is deterministic but still tuned rather than trajectory-calibrated. The restitution, tangent spin and dodge amplification values must be compared against disclosed reference experiments before their confidence can be raised.

## Validation discipline

A mechanic is marked complete only when it has:

- a deterministic scenario;
- assertions for normal and boundary states;
- sourced or explicitly tuned constants;
- client/server integration;
- documentation matching the implementation.

Golden trajectories will be added only from reproducible measurements. Expected files must not be updated solely to silence a failing test.
