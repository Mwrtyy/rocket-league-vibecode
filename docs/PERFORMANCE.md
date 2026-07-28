# Performance

## Hot-loop rules

The simulation advances at a fixed 120 Hz. Code executed on every tick or render frame must avoid full-state serialization, unbounded work and unnecessary object creation.

`GameSimulation` therefore separates state access into two paths:

- `getState()` creates an isolated deep snapshot. It is intended for network snapshots, replay checkpoints, debugging and tests.
- `getTick()`, `interpolate(alpha, target)` and `writeViewState(target)` write into caller-owned reusable buffers. They are intended for input sampling and rendering.

The client allocates its input frame, interpolation state and compact HUD view once during startup. Each frame mutates those buffers rather than cloning the complete simulation, including all 34 boost-pad records.

## Transform history

Only the previous ball position, car position and car orientation are retained for render interpolation. Match state, velocities and boost-pad timers are not duplicated every physics tick.

## Scalar physics math

Ground direction, aerial thrust, dodge direction and car-ball contact calculations use scalar components in the hot path. This avoids temporary vectors while preserving the same deterministic equations and existing trajectory assertions.

## Regression protection

`hot-loop.test.ts` spies on `structuredClone`, advances 1,000 ticks and writes reusable render views on every iteration. Any future reintroduction of deep cloning into that path fails CI. Separate assertions confirm that explicit full snapshots remain isolated from authoritative state.

## Remaining measurement work

This milestone removes known deep-clone pressure; it does not claim zero allocation for the entire browser frame. Three.js internals, DOM text updates, browser Gamepad arrays, network serialization and occasional match transitions still require profiling with browser performance tools. Heap growth, GC pause duration and per-system CPU time must be measured on representative hardware before final performance targets are considered verified.
