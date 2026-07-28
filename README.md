# Aether Strike

Aether Strike is an original, clean-room browser game project focused on deterministic, competitive rocket-powered car football. The implementation does **not** contain proprietary game code, branding, models, sounds, or extracted assets.

## Current milestone

The repository foundation includes:

- strict TypeScript pnpm monorepo;
- fixed 120 Hz accumulator loop with bounded catch-up and render interpolation;
- centralized unit conversion (`1 uu = 1 cm = 0.01 m`);
- sourced gameplay constants with status and confidence metadata;
- deterministic reference ball simulation and quantized state hashing;
- Rapier 3D adapter with CCD and explicit timestep configuration;
- browser physics laboratory with trajectory export;
- browser client shell and authoritative WebSocket server skeleton;
- Vitest trajectory/determinism tests, Playwright smoke test, ESLint, Prettier and CI.

This is an engineering foundation, not a completed game. Car suspension, full arena collision, match rules, prediction/reconciliation, original production assets and advanced mechanics remain future milestones and are tracked precisely in the documentation.

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

## Applications

- `apps/client`: low-latency game client foundation.
- `apps/server`: authoritative 120 Hz WebSocket simulation host.
- `apps/physics-lab`: deterministic experiment runner and telemetry viewer.

## Architecture

The simulation owns gameplay time. Rendering and browser events never advance physics directly. Inputs are sampled into sequence-numbered frames and consumed by fixed ticks. Public gameplay values remain in unreal-style units; only the physics adapter converts to metres.

See [ARCHITECTURE.md](docs/ARCHITECTURE.md), [PHYSICS.md](docs/PHYSICS.md), and [CONSTANTS.md](docs/CONSTANTS.md).
