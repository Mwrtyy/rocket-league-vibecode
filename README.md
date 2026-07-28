# Aether Strike

Aether Strike is an original, clean-room browser game focused on deterministic, competitive rocket-powered car football. It contains no proprietary source code, branding, models, recordings, or extracted assets from another game.

## Current playable build

The browser client now runs a complete local solo match on the shared simulation core:

- fixed 120 Hz gameplay with render interpolation;
- throttle, reverse, braking, coasting and piecewise speed-dependent steering;
- powerslide grip reduction, boost consumption and total speed caps;
- first jump, held jump, neutral double jump, directional dodge and basic aerial rotation;
- oriented car hitbox contact with ball momentum and spin transfer;
- floor, wall, ceiling and goal-volume ball collision;
- five-minute regulation, three-second kickoffs, goals, score, zero-second continuation and overtime;
- all 34 standard boost-pad positions, grants and respawn timers;
- keyboard and browser Gamepad API controls;
- chase camera and ball-camera switching;
- authoritative Node.js WebSocket server using the same simulation package;
- deterministic full-state hashes and mechanical regression tests;
- standalone Three.js/Rapier physics laboratory.

The project is playable but is not yet fidelity-complete. The next major physics work is a four-wheel suspension/contact model, curved arena surfaces, gravity-relative wall driving, full 3D car hitbox orientation, measured jump/dodge trajectories and calibrated ball-contact response.

## Requirements

- Node.js 22.12 or newer
- pnpm 10.15.1

## Commands

```bash
pnpm install
pnpm dev
pnpm dev:client
pnpm dev:server
pnpm dev:physics
pnpm build
pnpm test
pnpm test:physics
pnpm test:e2e
pnpm lint
pnpm typecheck
```

## Default controls

| Action             | Keyboard  | Controller concept   |
| ------------------ | --------- | -------------------- |
| Throttle / reverse | `W` / `S` | right / left trigger |
| Steer              | `A` / `D` | left stick           |
| Jump / dodge       | `Space`   | south face button    |
| Boost              | `Shift`   | east face button     |
| Powerslide         | `Ctrl`    | west face button     |
| Air roll           | `Q` / `E` | bumpers              |
| Ball camera        | `C`       | north face button    |
| Restart match      | `R`       | keyboard only        |

## Applications

- `apps/client`: playable local match and low-latency renderer/input layer.
- `apps/server`: server-authoritative match host at 120 Hz.
- `apps/physics-lab`: deterministic experiments, telemetry and trajectory export.

## Architecture

The simulation owns gameplay time. Rendering and browser events never advance physics directly. Inputs are sampled into sequence-numbered frames and consumed by fixed ticks. Public gameplay values remain in `uu`; only the physics adapter converts to metres.

See [ARCHITECTURE.md](docs/ARCHITECTURE.md), [PHYSICS.md](docs/PHYSICS.md), [CONSTANTS.md](docs/CONSTANTS.md), and [NETWORKING.md](docs/NETWORKING.md).
