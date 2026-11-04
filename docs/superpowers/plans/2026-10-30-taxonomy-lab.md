# Drag Taxonomy Laboratory Implementation Plan

> **For agentic workers:** Execute the assigned independent components with the stated ownership. The parent integrates and publishes; do not modify another worker's files.

**Goal:** Make the six-axis composition of drag results visible and navigable through working examples and controlled comparisons.

**Architecture:** A common taxonomy and example catalog drives navigation, explanations and coverage. Existing demo modules remain isolated; two new modules implement ten additional examples. A new Arabic shell owns mounting, routing, filtering, lifecycle and feedback.

**Tech Stack:** Buildless JavaScript ES modules, HTML, CSS and SVG.

**Spec:** ../specs/2026-10-30-taxonomy-lab-design.md

## Current status

Design, taxonomy data, the two new demonstration modules and the explorer shell are implemented. The catalog contains **32 examples**, described by **six axes**, **69 core descriptive values** and **3 device extensions**. These values are facets, not independent principles or an exhaustive list of possible interactions. The same catalog and profiles drive the examples, comparisons and coverage views, including their filters and counts.

The planned local browser verification and final source checks are complete. Only the delivery step remains: capture the final proof images, package and synchronize the source, and publish the updated owner-private Site. The recorded checks do not include physical touch/pen devices or browser restoration from BFCache.

## Global Constraints

- Preserve Site project appgprj_6ae4e6ee5b5c819181e13977cdcf1c59 and owner-private access.
- No external runtime dependencies or game-state integration.
- Six axes are context, input, rule, constraint, timing and effect.
- Device extensions are separate from core coverage.
- Single source for coverage and filters; no hardcoded coverage percentages.

## Review Focus

- Invalid/empty filter combinations must show a recoverable empty state.
- Switching modes during drag or playback must stop obsolete callbacks.
- Coverage must not claim unsupported hardware or partial illustrations as full.
- Paused/slow animation frames must not change the declared comparison rule.
- Narrow layouts must retain readable labels, reachable controls and visible feedback.

### Task 0: Design

- [x] Define a six-axis explorer with examples, comparisons and coverage views.
- [x] Define one catalog for filters, profiles and computed counts, with explicit full/partial/gap evidence.
- [x] Keep the earlier 22 examples and add ten bounded examples without treating each example as a separate principle.

### Task 1: Taxonomy data

Files: dist/taxonomy.js and docs/taxonomy-model.md (interaction_review).
Interface: exports axes, profiles, newExamples as specified in the task contract.

- [x] Define and explain six axes and their scoped values: 69 core values and 3 device extensions.
- [x] Map all 32 examples, separating full and partial evidence.
- [x] Validate profile completeness, references, duplicate IDs and declared gaps. The catalog integrity check passed; modifier input, individual undo, item deletion and nearby-target attraction remain declared gaps.

### Task 2: New behavior examples

Files: dist/extensions.js/css (geometry_demos).
Interface: mountExtensions(id, container, api) -> {play(), destroy()}.

- [x] Implement turns, dwell, relations, lasso and group.
- [x] Check accumulation, timed context, operation semantics, polygon selection and group invariants in source/logic checks.
- [x] Check cancellation and lifecycle in source/logic checks; implement accessible alternatives.

The component agent's geometry and state checks cover lasso, accumulated turns and group movement. They are not browser tests; the integration owner's separate interactive checks are recorded under Task 5.

### Task 3: Controlled comparisons

Files: dist/contrasts.js/css (operations_demos).
Interface: mountContrasts(id, container, api) -> {play(), destroy()}.

- [x] Implement constraint, commit, threshold, rate and path comparisons.
- [x] Check the input held constant and the rule intentionally varied for each pair.
- [x] Check coarse animation-frame handling, reset and cancellation in logic checks; implement keyboard alternatives.

The component agent's coarse-frame and cancellation checks are logic checks, not browser tests. The integration owner's observed browser results are recorded below.

### Task 4: Explorer shell

Files: dist/index.html, dist/app.js, dist/atlas.css, dist/catalog.js (parent).

- [x] Extract retained example metadata without changing modules.
- [x] Implement examples/comparisons/coverage routing, search and facet filtering.
- [x] Render six-axis explanations and related examples from the catalog.
- [x] Mount existing/new modules through a lifecycle-aware adapter.
- [x] Implement old hash links, responsive layout and accessible navigation.

The shared selection and coverage calculations live in dist/explorer-model.js. Separate browser evidence for filtering, example switching, keyboard input and the narrow layout is recorded below.

### Task 5: Integration and delivery

Files: docs, README.md, minimal data integrity check (parent).

- [x] Check catalog/profile completeness and data references.
- [x] Complete the final frozen-source syntax and integration gates: catalog integrity, syntax for six source files and diff/whitespace checks passed.
- [x] Browser-check representative new comparisons, new behaviors, facet-to-demo journeys, empty states and narrow layout.
- [x] Review the narrow-layout screenshot for usable controls and remove the temporary mobile QA file.
- [x] Complete README and this plan with the implemented scope, known gaps and final verification record; preserve verification of the earlier 22 examples.
- [ ] Capture the two final delivery proof images, package, synchronize source and publish the same owner-private Site.

## Recorded integration verification

The integration owner reported these actual observations from the local browser preview:

| Check | Observed result |
| --- | --- |
| Catalog | 32 entries in the unfiltered example list. |
| Profile | Six profile cards; details are initially collapsed and opening a card reveals the example-specific explanation and tags. |
| Partial cancellation | The timing profile explains which effect survives cancellation. |
| Commit comparison | Keyboard input 30 → 40, then Escape: A = 40 and B = 30. |
| Threshold comparison | Playback records the crossing event; release at 40 produces a false release test. |
| Rate comparison | A = 50, B = 91.2 and speed = 0 after playback. |
| Path comparison | Same endpoint (88, 50), with lengths 76 and 117.7 display units. |
| Constraint comparison | Shared input (53, 67) gives free position (53, 67) and grid-rounded position (60, 60). |
| Accumulated turns | Total 450°, current angle 90° and one completed turn. |
| Timed folder | The folder opened during the hold; the drop left the item in designs. |
| Copy and link | Copy preserved source A-01 and produced target B-01/A-02. Link preserved A-01/B-01 and added A-01:B-01. |
| Lasso | Playback selected 1, 2 and 3; an invalid manual straight line preserved that selection. |
| Group movement | A manual offset of 300 was rejected and restored offset 0. Offset 500 was accepted at positions (610, 68), (742, 103), (653, 202). |
| Combined facets | input.path + timing.release returned exactly compare-path, lasso, gesture and path. |
| Empty-state recovery | Adding effect.delete produced zero results; clearing the filters restored 32. |
| Coverage | 65/69 core values directly represented, four core gaps and three device extensions; modifier-gap details showed the definition and proposal. |
| Coverage link | The example link under input.turns opened turns. |
| Comparison view | Seven entries were listed. |
| Old deep link | #value mounted the quantity example with six profile layers. |
| Narrow layout | A 390px iframe had client/scroll widths of 375/375px, no horizontal document overflow, six profile layers and an initially collapsed library. Screenshot review found usable controls. |
| Playback teardown and keyboard | Starting playback and then switching to compare-rate left the new example ready, without stale updates. Right Arrow then Enter produced A = 50, B = 50.2 and speed = 0 in the observed run. |
| Console | No application warnings or errors were observed in the preview logs filtered to terminal.local during these checks. |

The final node tools/check-catalog.mjs run, syntax checks for six source files and diff/whitespace check passed. Final totals are 32 examples, six axes and 72 descriptive values: 69 core values (65 directly represented and four gaps) plus three device extensions. These source gates are distinct from the browser observations above.

Earlier browser checks for the original 22 examples remain in README; those historical checks are not a fresh pass on every retained interaction in the rebuilt shell. All values are illustrative local simulation values. The narrow browser viewport is not a physical touchscreen or pen test. The BFCache lifecycle correction was source-reviewed; browser restoration from BFCache was not tested. Only the final delivery and publication step remains open.
