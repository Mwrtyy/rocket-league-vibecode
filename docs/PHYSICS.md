# Physics

## Fixed timestep

The canonical simulation rate is 120 Hz:

```ts
PHYSICS_HZ = 120;
FIXED_DT = 1 / PHYSICS_HZ;
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
- an allocation-free octagonal arena solver with published side, back and 45-degree corner planes;
- analytic floor-wall and ceiling-wall quarter curves;
- goal-mouth fit checks, solid lower post/crossbar regions and constrained goal interiors;
- oriented car-box support against side, back and diagonal planes;
- throttle, reverse, braking, coasting, boost and speed-dependent steering;
- lateral grip and reduced handbrake grip;
- jump hold, second jump, directional dodge and basic aerial torque;
- yaw-oriented car box versus sphere contact;
- relative contact velocity, impulse sharing, dodge amplification and spin transfer;
- deterministic boost-pad pickup and respawn;
- kickoff, regulation clock, goals, zero-second state and overtime.

## Arena collision model

The horizontal standard-arena boundary is represented by the intersection of these verified half-spaces:

```text
|x| <= 4096
|y| <= 5120
|x| + |y| <= 8064
```

The last constraint creates the four published 45-degree corner planes. Straight-to-diagonal transition tests assert zero positional gap and consistent signed distance on both sides of every seam.

Near a wall, floor and ceiling contacts are resolved through analytic quarter-ellipse offsets. A sphere uses equal horizontal and vertical radii, producing a true offset quarter-circle. The car uses yaw-oriented horizontal box support and its physical half-height, producing endpoint-correct ramp support without replacing the future four-wheel model.

The goal opening only admits a body when its complete horizontal and vertical support fits. Once beyond the goal line, goal side walls, ceiling, floor and depth are resolved independently. Low post approaches naturally meet the floor-wall ramp before the vertical plane.

## Accuracy boundaries

The current car controller remains a functional force model, not the final four-wheel solver. Ramp grounding is supported, but permanent wall/ceiling driving, gravity-relative suspension, per-wheel contact, pitch/roll-aware arena support and recovery behavior remain incomplete.

The horizontal side/back/corner planes are verified. The current 256 uu floor-wall and ceiling-wall radii are explicitly temporary functional baselines pending measurement against the standard arena collision mesh. Goal interiors are box-constrained; cylindrical post/crossbar profiles, backboard-specific curves and exact goal ramps still require measured geometry.

Ball–car response is deterministic but still tuned rather than trajectory-calibrated. The restitution, tangent spin and dodge amplification values must be compared against disclosed reference experiments before their confidence can be raised.

## Validation discipline

A mechanic is marked complete only when it has:

- a deterministic scenario;
- assertions for normal and boundary states;
- sourced or explicitly tuned constants;
- client/server integration;
- documentation matching the implementation.

Golden trajectories will be added only from reproducible measurements. Expected files must not be updated solely to silence a failing test.
