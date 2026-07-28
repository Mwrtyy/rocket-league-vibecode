# Physics

## Fixed timestep

The canonical simulation rate is 120 Hz:

```ts
PHYSICS_HZ = 120
FIXED_DT = 1 / PHYSICS_HZ
```

The render loop uses an accumulator. Catch-up is capped to prevent a suspended tab from causing an unbounded simulation spiral. Excess elapsed time is recorded as dropped time rather than changing gameplay speed.

## Unit system

Public gameplay data uses `uu`, where `1 uu = 1 cm`. Rapier uses metres, with conversion centralized in `@aether/shared/units`.

## Current ball model

Two paths exist intentionally:

1. `ReferenceBallSimulation` is a small deterministic trajectory oracle used for fixed-step and provenance tests.
2. `RapierBallWorld` validates integration behavior with CCD, rigid-body contact and world scaling.

The reference model currently implements gravity, speed caps, angular-speed caps, floor contact and a restitution baseline. It does not yet claim full arena or ball-car collision fidelity.

## Known fidelity gaps

- curved arena mesh and seam validation;
- incidence-dependent ball contact response;
- post/crossbar geometry;
- custom four-wheel car force model;
- jump/dodge state machine;
- measured damping and rolling resistance;
- verified pad coordinates;
- golden trajectories sourced from disclosed measurements.

Every gap must receive a reproducible experiment before being marked resolved.
