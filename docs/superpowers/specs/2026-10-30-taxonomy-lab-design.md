# Drag taxonomy laboratory redesign

## Intent

Rebuild the published Arabic laboratory around the composition of drag interactions. The user explicitly requested rebuilding after a discussion of six independent axes. The laboratory must expose those axes, demonstrate important variations, and distinguish applications from new rules and combinations.

## Approach

Retain working, browser-local demos and replace their presentation with a connected taxonomy explorer. A flat, longer gallery would repeat the current problem. An unconstrained visual programming system would introduce invalid combinations and obscure the teaching goal. The selected implementation uses a common catalog, inspectable examples, controlled comparisons and computed coverage; this is the assistant's implementation decision within the requested rebuild.

## Experience

- Three views: examples and their composition, comparisons, and coverage.
- Six axes: context, input, interpretation rule, constraints, timing, effect.
- Every example displays its actual six-axis profile, with clear Arabic explanations and clickable facets.
- Search and combined filters find examples by their composition. Old example hash links continue to work.
- Coverage derives from the same profiles as navigation. Full, partial, missing and device-extension entries remain distinct. No claim that the finite catalog exhausts all programmable results.
- Preserve the forest, cream and warm accent identity while making the hierarchy and type more legible.
- Keep 22 existing demonstrations; add five missing-behavior demonstrations and five controlled comparisons.
- Each new example supports real pointer manipulation, a click/keyboard alternative, automatic playback and reset.
- Treat all numbers and operations as local teaching simulations, not game integration.

## New examples

Extensions: turns, dwell, relations, lasso, group.
Comparisons: compare-constraint, compare-commit, compare-threshold, compare-rate, compare-path.

## Boundaries

Static ES modules and SVG/HTML; no external runtime dependency or server. Keep current Sites identity and owner-private audience. Source and screenshots remain in the Site repository. Hardware-specific pressure, tilt and multiple pointers are catalog extensions, not simulated capabilities passed off as device support.

## Acceptance

All 32 examples resolve to six axes and valid facets. Filtering and coverage share data and produce reachable examples. New interactions exhibit the claimed distinction in state, including cancellation and teardown. Desktop and narrow browser layouts remain usable. Publish the verified source as an update of the existing private Site.
