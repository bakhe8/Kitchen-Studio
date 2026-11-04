# Design and spatial editing — static verification

Date: 2026-11-04. Scope: implementation-plan Task 4 and all seventeen Wave 4 CSS files listed in `migration.md`.

**Status: CSS migration is implemented; browser acceptance is pending. Task 4 remains incomplete.** This work provides focused source and existing controller/model checks only. No browser journey, visual acceptance, contrast audit of rendered compositions, full npm suite, or inventory regeneration was performed in this delegated task. System-native acceptance is not granted by these checks.

## Implementation and evidence boundary

- All seventeen stylesheets consume the existing `--ks-*` color, morphology, elevation, motion, and focus contracts. Legacy `--pd-*`, `--ds-*`, `--fs-*`, `--sp-*`, and room/dock aliases remain local compatibility routes to foundation semantics; geometry aliases and their consumers remain intact. Decorative tool/category tints now use structural ink/surfaces; attention, completion, danger, and selection use their semantic families.
- The implementer captured the original rule selectors immediately before declaration migration, then compared the edited family using `scanCSS`: **1,764 original rule selectors retained, zero missing**, including repeated media/container rule occurrences. This is an observed, implementer-reported comparison against a temporary local baseline, not a preserved independent visual acceptance artifact. CSS declarations and scoped interaction rules changed; JavaScript controllers, coordinates, SVG path data, project models, event handlers, saves, APIs, and the studio mark asset were not edited.
- Existing selected-unit/selected-wall attributes and `.pd-selected-shape` drive the designer relationship. Canvas selection strokes and inspector leading edges share `--ks-action`; finish drawing/objects/options and shelf active outlines/inspector use the same relationship. Existing labels, object codes, underlined active commands, double tool boundaries, selected leading edges, and controller-provided text provide additional state signals. Cabinet-tag text explicitly avoids inheriting the selected shape stroke.
- Principal form controls use a 44px minimum block target. Principal buttons, links, summaries, view/zoom controls, row-strip cells, inspector actions, menu actions, and dock controls use a 44px minimum inline target. Coarse-pointer checkbox/radio labels have a 44px interaction box while the native glyph remains compact. The folded dock reserves the target width plus its border, and its grid padding accommodates the external focus ring. These are CSS source contracts; computed boxes, flex shrink, transforms, SVG viewBox scaling, clipping and overlap are unmeasured.
- The original designer move-grip transparent hit stroke remains 44px and its icon remains 18px; shelf grip geometry and hit detection remain controller-owned. This CSS pass does not prove their rendered target dimensions at every zoom level or promise 44px for every SVG grip.
- Keyboard focus uses a 3px semantic outline and 2px external offset. Dark designer and finish toolbars use `--ks-focus-ring-dark`, including their selected controls and native selects: the external outline is adjacent to the dark toolbar even when the selected control itself has a light fill. Light help/menu surfaces, selected object rails, dock and inspector controls retain the light-surface ring. The room scene's parent permits the external ring when that scene has keyboard focus. Rendered focus/stacking/cascade compatibility still requires browser verification.
- Primary press feedback collapses elevation with at most 1px translation; action hover/pressed colors remain in the action family. Scoped reduced-motion rules disable nonessential transitions/animations and the new press translation without resetting controller-authored drawing transforms or camera motion.
- Palette, inspector, help, HUD and command menus use popover layers; the dock/masthead uses sticky layers; pointer-transparent drag feedback uses the toast layer. The foundation's dialog layer is above spatial popovers. Existing native dialog behavior was not changed and no new modal was introduced; actual dialog top-layer and mixed-shell stacking remain browser checks.
- The independent `unit.html` entry consumes the foundation through `shelf-planner.css`'s initial CSS import. The planner uses the local Tahoma/Arial font token. The shared main entry's foundation loading is owned by the parent integration task and must pass its foundation check before combined acceptance.

## Precise palette exceptions

The allowlist retains the prior field entries and adds **22 exact spatial declaration exceptions**: five cabinet-tier/filler silhouette declarations, five alternative-layout comparison fills/strokes, two room furniture-legend declarations, and ten material/preset samples in `shelf-planner.css`. Each entry has an exact file, selector, property, value, supported category, and reason; interaction/selection/focus, radius, shadow, and motion have no exception.

During review, wood and wall sample values were restored from `dist/client/shelf-planner.css`. That artifact's SHA-256 `dd6c0ebdd17b8bbf5bb4eab75e0fcefd6bf4f225a0fe6a51f402b2059f854803` exactly matches the source hash recorded in the pre-migration inventory. The restored values are the original authored oak/walnut/ivory gradients, sand/sage/stone colors, shelf-preset thumbnail palette, and timber-divider sample background/border. The distribution artifact was read as recovery evidence and was not modified. Material records and user-chosen color data in JavaScript remain untouched; this CSS policy result is not a claim that every JavaScript styling sink has migrated.

## Test-first record and focused checks

`tools/check-kitchen-design-spatial.mjs` was written and run before changing production CSS. The observed RED was `public/kitchen-chain.css consumes the foundation`. Follow-up assertions were observed failing for the standalone unit foundation import and for verified source-basis completion semantics before those declarations were corrected. Focused GREEN results are recorded below after execution.

| Check | Result | Evidence boundary |
| --- | --- | --- |
| `node tools/check-kitchen-design-spatial.mjs` | PASS | All seventeen CSS files, policy, selection/inspector contracts, target declarations, press/focus, layers, preserved samples, standalone import, reduced motion |
| `node tools/check-kitchen-design-native.mjs` | PASS | Native checker regression fixtures |
| Native checker with all seventeen Wave 4 CSS paths | PASS | Zero violations; 22 precise data exceptions |
| `check-kitchen-designer-studio.mjs` | PASS | Preview/invalid input, focus-preserving controller lifetimes, selection, move, apply, permissions and persisted-history delegation |
| `check-kitchen-designer-precision.mjs` | PASS | Arabic/Persian input, arrow/scrub steps, cancellation, native text gestures and cleanup |
| `check-kitchen-designer-move.mjs` | PASS | Ten transaction groups; geometry/identity/order, stale state, save/reopen/undo/redo |
| `check-kitchen-designer-recovery.mjs` | PASS | Staged draft recovery, stale settings and storage-failure handling |
| `check-kitchen-architectural-editor.mjs` | PASS | Existing measured architecture and drawing geometry |
| `check-kitchen-finish-studio.mjs` | PASS | Real controller part selection, previews, cancel/undo/redo, permission/save races and ray-pick context |
| `check-kitchen-finish-preview.mjs` | PASS | Eleven existing transaction groups, material/slot identity and price/compatibility behavior |
| `check-kitchen-finish-desk.mjs` | PASS | Existing tapped part/material/editor context and stale/unpublished guards |
| `check-shelf-selection.mjs`, `check-shelf-shared-selection.mjs` | PASS | Existing scoped selection/physical board relationships |
| `check-shelf-layout-tools.mjs`, `check-shelf-drag-handles.mjs` | PASS | Existing capture/release, placement, grip direction, cancellation and coordinate models |
| `check-shelf-copy-layout.mjs`, `check-shelf-compare.mjs` | PASS | Existing copy/preview/undo model and comparison scale/photo contracts |
| `check-shelf-room-view.mjs`, `check-shelf-workspace-view.mjs` | PASS | Existing surface picks, room/edit route, camera/selection independence and depth/history behavior |
| `check-shelf-sized-object.mjs` | PASS | Existing sized-object geometry, conflicts, persistence and undo |
| `check-kitchen-chain-survey.mjs`, `check-kitchen-chain-options.mjs` | PASS | Existing measured closure, architecture, upper spans and regeneration contracts |

## Required browser acceptance

| Journey | Required evidence |
| --- | --- |
| Designer objects and walls | Select canvas/rail objects; verify linked outline, inspector, object code, persistent HUD, selected keyboard ring and deselection |
| Precision editing | Focus/edit dimension fields, preview valid and invalid widths, commit/cancel, move grips, undo/redo and recovery paths; verify native inputs retain focus and geometry stays correct |
| Finish studio | Select technical parts, materials and view modes; confirm preview/pending/invalid/blocked/saved messaging and material sample fidelity |
| Shelf planner | Select wall/zone/cell/divider/group; activate tools, resize/move/delete preview, palette drag/cancel, copy layout, compare slider and room/volume views |
| Layers and dialogs | Open file/overflow/help menus, inspector and merge prompt; test native dialogs from the shared shell, Escape, focus return, stacking and unobscured geometry |
| Pointer and keyboard | Hover/press/disabled state; tab/arrow/activation order, high-contrast focus, measured ≥44×44 CSS pixel principal/coarse targets and proportional icons |
| 768px and 200% zoom | No lost primary controls, unintended document overflow or obstructed dimensions; measure dock, inspector, menus and expanded labels |
| RTL | Arabic reading order, arrows, start/end semantics and physical rail/overlay anchors retain their intended meanings |
| Reduced motion | New press translation and nonessential transitions disappear; user-controlled camera/drag motion remains usable |
| Mixed shell | Navigate field → design → finish → adjacent legacy screen and back; verify main foundation loading, masthead, focus, dialogs and overlays |
| Console/network | No new runtime errors/warnings, stylesheet failures or missing resources; capture before/after states |

Browser-only risks include external focus near clipped SVG/container edges, larger controls in dense existing grids, nested stacking contexts, unchanged small SVG grips, direct inline JavaScript styling precedence, 200% zoom overflow, and the standalone unit's later legacy shell styles overriding imported foundation defaults. No P0–P2 clearance is claimed without that matrix.

## Review fixes — effective state and cascade contracts

- The invalid palette-drag ghost's `small` hint now explicitly uses `--ks-surface-1` on its `--ks-danger` background. The source check compares the applicable direct hint rules by specificity and source order; the previous state-specific danger text was observed failing before correction. The pointer-transparent ghost and existing invalid-state dashed boundary remain in place.
- Selected designer/finish toolbar controls and selects retain the dark-surface ring with the 2px external offset. Their focused selected-state overrides no longer substitute the light-surface token. Both previous overrides were observed failing the added requirements. These checks also reject a selected-toolbar outline that reintroduces the standard ring.
- The finish inspector's action edge now has a final `.finish-options:has(.finish-kinds)` rule in addition to its plain-container rule. Its four-class specificity and later placement win over the original combined container/`:has` rule and the narrow-layout reset. The bounded cascade check evaluates the original plain/`:has` candidates, border shorthand resets, and source order; the previous inspector edge was observed failing when finish kinds are present. It now passes for both container states, including the strongest narrow reset candidate.
- The new assertions initially reported all three findings, then the remaining findings disappeared as each production correction was applied; the complete spatial check returned PASS. These are static checks of the exact participating selectors, not a general browser cascade engine or rendered contrast/geometry proof. Browser acceptance remains pending and Task 4 remains incomplete.
- Review verification: spatial checker PASS across all seventeen files; native policy regressions PASS; explicit native audit of the three changed stylesheets PASS with zero violations and zero exceptions. Existing designer-studio, finish-studio, shelf-drag-handles, shelf-layout-tools, and shelf-direct checks all PASS. No browser, full-suite, or inventory-generation command was run for these fixes.
