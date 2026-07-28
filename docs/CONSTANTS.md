# Gameplay constants and provenance

No value is called exact merely because it appears in the initial brief. The table below records the starting status used by the repository.

| Constant | Value | Unit | Status | Confidence | Source / note |
|---|---:|---|---|---:|---|
| Physics frequency | 120 | Hz | verified | 1.00 | Project specification; architecture invariant |
| Unit scale | 0.01 | m/uu | verified | 1.00 | 1 uu = 1 cm |
| Gravity | 650 | uu/s² | measured | 0.95 | Widely reproduced community measurement; external primary validation pending |
| Floor | 0 | uu | measured | 0.95 | Coordinate baseline |
| Side wall | ±4096 | uu | measured | 0.95 | Initial research baseline |
| Back wall | ±5120 | uu | measured | 0.95 | Initial research baseline |
| Ceiling | 2044 | uu | measured | 0.90 | Initial research baseline |
| Ball radius | 91.25 | uu | measured | 0.95 | Initial research baseline |
| Ball mass | 30 | kg-equivalent | measured | 0.85 | Solver meaning requires validation |
| Ball restitution | 0.60 | ratio | tuned | 0.60 | Baseline only; surface response is incomplete |
| Ball max speed | 6000 | uu/s | measured | 0.95 | Initial research baseline |
| Ball max angular speed | 6 | rad/s | measured | 0.90 | Initial research baseline |
| Car mass | 180 | kg-equivalent | measured | 0.85 | Initial research baseline |
| Boosted speed cap | 2300 | uu/s | measured | 0.98 | Initial research baseline |
| Supersonic threshold | 2200 | uu/s | measured | 0.95 | Initial research baseline |
| Normal top speed | 1410 | uu/s | measured | 0.95 | Initial research baseline |
| Boost use | 33.3 | units/s | measured | 0.95 | Initial research baseline |

The TypeScript source is authoritative for machine-readable status, confidence, notes and candidate values.
