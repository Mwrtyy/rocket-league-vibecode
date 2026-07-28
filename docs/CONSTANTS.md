# Gameplay constants and provenance

No value is called exact merely because it appears in the project brief. Machine-readable provenance in `packages/simulation/src/constants` is authoritative.

| Constant | Value | Unit | Status | Confidence | Source / note |
| --- | ---: | --- | --- | ---: | --- |
| Physics frequency | 120 | Hz | verified | 1.00 | Architecture invariant |
| Unit scale | 0.01 | m/uu | verified | 1.00 | `1 uu = 1 cm` |
| Gravity | 650 | uu/s² | measured | 0.95 | Reproduced public measurement; primary validation pending |
| Side wall | ±4096 | uu | verified | 0.99 | RLBot useful game values |
| Side-wall half-length | 3968 | uu | derived | 0.99 | Half of the published 7936 uu wall length |
| Back wall | ±5120 | uu | verified | 0.99 | RLBot useful game values |
| Back-wall half-length | 2944 | uu | derived | 0.99 | Half of the published 5888 uu wall length |
| Corner-plane intercept | 8064 | uu | verified | 0.99 | Published 45-degree planes intersect both axes at ±8064 |
| Corner-wall length | 1629.174 | uu | verified | 0.99 | RLBot useful game values |
| Floor-wall curve radius | 256 | uu | temporary | 0.35 | Functional analytic baseline; mesh measurement pending |
| Ceiling-wall curve radius | 256 | uu | temporary | 0.30 | Functional analytic baseline; mesh measurement pending |
| Ceiling | 2044 | uu | verified | 0.99 | RLBot useful game values |
| Goal half-width | 892.755 | uu | verified | 0.99 | RLBot useful game values |
| Goal height | 642.775 | uu | verified | 0.99 | RLBot useful game values |
| Goal depth | 880 | uu | verified | 0.99 | RLBot useful game values |
| Ball radius | 91.25 | uu | measured | 0.95 | Initial research baseline |
| Ball mass | 30 | solver mass | measured | 0.85 | Solver interpretation requires calibration |
| Ball restitution | 0.60 | ratio | tuned | 0.60 | Surface response remains incomplete |
| Ball max speed | 6000 | uu/s | measured | 0.95 | Initial research baseline |
| Car mass | 180 | solver mass | measured | 0.85 | Initial research baseline |
| Octane-type hitbox | 118.01 × 84.2 × 36.16 | uu | measured | 0.92 | Public hitbox measurements |
| Boosted speed cap | 2300 | uu/s | measured | 0.98 | Initial research baseline |
| Normal top speed | 1410 | uu/s | measured | 0.95 | Initial research baseline |
| Boost use | 33.3 | units/s | measured | 0.95 | Initial research baseline |
| Small pads | 28 | pads | verified | 0.99 | RLBot standard field data |
| Small pad grant | 12 | boost | verified | 0.99 | RLBot useful game values |
| Small pad respawn | 4 | s | verified | 0.99 | RLBot useful game values |
| Large pads | 6 | pads | verified | 0.99 | RLBot standard field data |
| Large pad respawn | 10 | s | verified | 0.99 | RLBot useful game values |
| Regulation | 300 | s | verified | 1.00 | Standard match rule |
| Kickoff countdown | 3 | s | verified | 1.00 | Standard match rule |

## Arena geometry

The verified horizontal planes form an octagon rather than a rectangular box. The collision solver uses `|x| <= 4096`, `|y| <= 5120`, and `|x| + |y| <= 8064`, with a dynamic opening for bodies that fully fit the goal mouth. Tests cover signed-distance continuity at straight/diagonal seams, posts, crossbar, goal depth and oriented car support.

The 256 uu vertical curve values are deliberately low-confidence temporary constants. They make floor-wall and ceiling-wall transitions continuous and measurable, but they must be replaced only after a reproducible collision-mesh measurement.

## Boost-pad layout

`BOOST_PAD_LAYOUT` stores all 34 standard-map positions in the order exposed by RLBot field information. Every definition includes a stable ID, `x/y/z` position and large/small classification. Tests assert total count, large-pad count, pickup behavior and exact respawn boundaries.

## Tuned values still requiring measurement

The current longitudinal acceleration curve, reverse cap, lateral grip, powerslide multiplier, first-jump impulse, jump-hold acceleration, dodge impulse, contact restitution, spin response and vertical arena-curve radii are explicitly marked `tuned` or `temporary`. They are usable implementation baselines, not claims of exact equivalence.

When candidates disagree, the repository must preserve the disagreement, add a reproducible experiment and raise confidence only after the result is documented.
