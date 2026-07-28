# Architecture

## Selected architecture

Aether Strike uses a TypeScript monorepo with three applications and small, dependency-directed packages.

```text
browser input -> PlayerInputFrame -> fixed-step simulation -> snapshots
                                               |             |
                                               v             v
                                      authoritative server  renderer
```

### Deterministic boundary

`@aether/simulation` contains tick-indexed state transitions and no DOM, renderer, network transport, or wall-clock dependencies. A simulation tick always represents `1/120 s`.

`@aether/physics-adapter` is the only package allowed to translate gameplay units to Rapier metres. Rapier receives `1 uu = 0.01 m`. The initial adapter is locally deterministic for an identical runtime and physics version. Cross-platform replay verification will require validation of Rapier's deterministic build before multiplayer lockstep claims are made.

### Rendering boundary

Three.js consumes interpolated snapshots. It does not mutate authoritative state. WebGPU will be introduced behind a renderer capability interface; the first milestone uses WebGL 2 for maximum boot reliability.

### Networking boundary

The Node server owns tick, ball state and future match authority. Clients submit only input frames. The current server broadcasts snapshots and rejects duplicate/stale input sequences; prediction and reconciliation are the next networking milestone.

## Dependency direction

```text
shared <- simulation <- physics-adapter
shared <- networking
simulation + rendering + input -> client
simulation + networking -> server
simulation + physics-adapter + rendering -> physics-lab
```

Circular dependencies are forbidden.
