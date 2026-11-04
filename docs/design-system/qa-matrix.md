# Measured Workshop QA matrix

Source checks and browser acceptance are separate gates. All family reports currently retain browser work; no absence of P0–P2 visual findings has been established. The parent integration task owns final inventory generation, full-suite execution, browser evidence and acceptance. This matrix does not authorize deployment.

| Family | Source gate | Required representative states | Browser/acceptance |
| --- | --- | --- | --- |
| Foundation | `check-kitchen-design-foundation.mjs` | Main/independent entry loading, light and dark focus, reduced motion | Pending computed cascade/contrast verification |
| Field | `check-kitchen-design-field.mjs` | Empty, partial, focused dimension, confirmed, invalid, perimeter dialog, mixed navigation | Partial earlier visit-start evidence only; remaining journeys pending in `qa-field.md` |
| Spatial | `check-kitchen-design-spatial.mjs` | Selected object/inspector, dimensions, undo/redo, palettes, finish selection, shelf grip | Pending; see `qa-spatial.md` |
| Catalog | `check-kitchen-design-catalog.mjs` | Empty/import/filter/selected/readiness/invalid/material sample | Pending; see `qa-catalog.md` |
| Factory | `check-kitchen-design-factory.mjs` | Ready/warning/conflict/blocked/disabled/bulk/delete confirmation; measured row gaps | Pending; see `qa-factory.md` |
| Presentation | `check-kitchen-design-presentation.mjs` | Preview/saved/stale/approval/release, receipt stages, delivery observations, print/export | Pending browser and print/PDF comparison; see `qa-presentation.md` |
| Operations | `check-kitchen-design-complete.mjs` | Saved open/delete/cancel/error, backup never/changed/current, sync status/confirmation, versions, gateway, assist conflict/error/complete, maintenance open/closed, oversight readiness, photo annotations | Pending; see `qa-final.md` |

For each representative journey record the exact source/build, route, fixture, viewport, zoom/pointer/motion settings, screenshot or capture, expected/observed behavior, console findings and severity. A test command or selector assertion is not a screenshot or usability result.

| Cross-family gate | Required evidence | Current status |
| --- | --- | --- |
| Desktop + 768px | Header, primary controls, nested scrolling, no primary document overflow | Pending |
| 200% zoom | Principal workflow remains reachable, labels wrap, focus not clipped | Pending |
| Keyboard | Tab/Shift+Tab, Enter/Space, menu/dialog/return lifecycle and focused typing | Pending |
| RTL | Anchored menus, arrows, previous/next meaning, icon placement, number isolation | Pending |
| Coarse pointer | Computed principal target rectangles ≥44×44px; compact drawing geometry retained | Pending |
| Focus/contrast | Light/dark headers, selected/disabled states and essential non-text cues | Pending composition measurements |
| Reduced motion | Nonessential translation/elevation removed; focus reveal still works | Pending |
| Mixed navigation | Field → design → catalog → factory → proposal → operations and return; open menus/drawers/dialogs | Pending |
| Print/export | Proposal, report, production drawing, change sheet, delivery; technical strokes/materials/totals preserved | Pending |
| Console | No new errors during representative routes and transitions | Pending |
| Full test suite | Current `npm test` result bound to final source | Pending in this delegated scope |
| Inventory/status | Deterministic current source hashes; deliberate accepted-status mechanism | Regeneration and acceptance remain parent gates |

The default completion command is a source gate. The `--acceptance` mode is deliberately stricter and must fail while inventory statuses remain legacy or the final QA report lacks accepted browser/full-suite evidence. Neither mode should silently infer native acceptance from a percentage of classified files.

Source-review regressions now cover all twelve operational press scopes under both motion preferences with authored specificity/order evaluation; the three exact embedded-stylesheet concatenation/append bypasses; and muted-token contrast on canvas, inset, action-soft and complete-soft. Those focused checks pass. Rendered motion, composed contrast and the remaining browser matrix remain pending.
