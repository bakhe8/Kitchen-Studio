# Field and survey migration — static verification

Date: 2026-11-04. Scope: implementation-plan Task 3 and all twelve Wave 3 stylesheets in `migration.md`.

**Status: CSS migration and focused static checks pass, with partial visit-start browser evidence. Task 3 remains incomplete and field-family acceptance is pending.** The invalid/perimeter/keyboard/zoom/coarse-pointer/mixed-shell journeys and remaining field/survey routes still need their browser matrix before system-native acceptance. This review fix pass ran focused checks only; it did not run a browser or the full npm suite.

## Implementation evidence

- All twelve stylesheets consume existing `--ks-*` foundation tokens for semantic colors, shape, elevation, motion, and focus. Feature-local aliases such as `--sv-*`, `--nb-*`, and `--plate-*` resolve to foundation semantics and preserve existing consumers.
- The initial implementer-reported comparison found **1,362 original rule selectors** retained, including media/container rules. That historical comparison is not independently reproducible from the committed/checkpointed verification inputs and is not an independent acceptance result. The migration changed declarations and added scoped state/target contracts; controllers, project data, geometry functions, event handlers, persistence, SVG paths, and the studio mark were outside the CSS edit scope.
- Primary controls use a 44px minimum block target, and field/coarse-pointer button targets use a 44px minimum inline target. Native checkbox/radio glyph dimensions remain native; their enclosing interaction labels are the intended hit area. Actual computed boxes, SVG viewBox scaling, overflow, and collision still require browser measurement.
- Existing next/measured/native-validity hooks drive the visit reference states. The next field has a stronger leading edge; completed fields and progress buttons use a double boundary and the existing check icon; invalid fields use a dashed boundary and the browser's existing custom-validity explanation. Existing live counts and next-action text remain the accessible announcement route.
- The exact focused, completed, and invalid dimension relationship uses matching action, completion, or danger semantics. No drawing model or controller state was introduced. Focus keeps the existing native inputs mounted, uses a 3px external ring and 2px offset, and does not remove keyboard outlines.
- Notebook completion follows the controller's actual `confirmed` status. The confirmed review notice has a double boundary; invalid has a dashed boundary; pending/dirty/review has a stronger leading edge. Existing Arabic status labels provide the second signal.
- The perimeter remains a native modal dialog; its header stays sticky. Drawing popovers/HUDs use the popover elevation/layer tokens; the field register uses the dialog layer token. These source relationships are not evidence of rendered stacking compatibility.
- The independent `survey-studio.css` entry imports `kitchen-design-system.css` directly. Its existing Google Fonts import was removed and its root font now uses the local Tahoma/Arial foundation contract. Layout-property transitions were removed; reduced-motion rules remain active for the independent survey and visit reference.
- `allowlist.json` contains **29 exact field palette exceptions** for authored architectural object/material fills and strokes: door/window/obstacle depiction and cutaway depth/material distinctions. Each exception specifies file, selector, property, exact value, category, and reason. Focus, selection, validation, actions, shadows, radii, and motion receive no exception.

## Test-first record and focused verification

`tools/check-kitchen-design-field.mjs` was created and run before migrating the CSS. It failed on `kitchen-field-form.css` lacking foundation token adoption. After migration it passed. During review, its notebook completion assertion was corrected to require the controller's real `confirmed` status; that assertion was observed failing, then the CSS was corrected and the check passed.

| Check | Result | Evidence boundary |
| --- | --- | --- |
| `node tools/check-kitchen-design-field.mjs` | PASS | All 12 files; token/policy, reference hooks and state morphology, target declarations, focus, local layering, standalone foundation/font, reduced motion |
| `node tools/check-kitchen-design-native.mjs` | PASS | Native policy's own rejection/exception regression checks |
| Native checker with all twelve Wave 3 CSS paths | PASS | 0 violations; 29 precise data exceptions |
| Original-rule comparison using `scanCSS` | Implementer-reported | Initial report: 1,362 retained, 0 missing; not independently reproducible from checkpointed verification inputs |
| `node tools/check-kitchen-intake-drawing.mjs` | PASS | Existing scale/arrangement/anchor model tests, not new rendered field dimensions |
| `node tools/check-kitchen-outline-walk.mjs` | PASS | Existing measured-perimeter order/save behavior |
| `node tools/check-kitchen-survey-entry.mjs` | PASS | Existing entry/save/field-attestation behavior |
| `node tools/check-kitchen-survey-wall-sheet.mjs` | PASS | Existing SVG measurement/model behavior |
| `node tools/check-kitchen-survey-walk.mjs` | PASS | Existing survey progression, persistence and correction behavior |
| `node tools/check-kitchen-survey-notebook.mjs` | PASS | 19 existing integration groups |
| `node tools/check-kitchen-survey-workspace.mjs` | PASS | 4 entry groups; unsupported-small-device routing retained |
| `node tools/check-kitchen-wall-ink-entry.mjs` | PASS | Existing drawing entry, save/cancel and correction behavior |
| `node tools/check-kitchen-wall-ink-gestures.mjs` | PASS | Existing pointer/coordinate and gesture cancellation behavior |
| `node tools/check-kitchen-field-access-ui.mjs` | PASS | Existing access/ownership/revocation guards |

The inventory has been generated by `node tools/build-kitchen-design-inventory.mjs` during integration and is regenerated after this review fix pass; it is not edited manually. Source hashes must be checked after subsequent changes. Classification and policy passing do not change the generator's legacy/native acceptance status.

## Partial visit-start browser evidence

The parent task recorded the following bounded browser observations before the review fixes below. They are partial evidence, not visit-start or family acceptance, and were not rerun during this fix pass.

- Opened the visit-start screen in the Codex in-app browser with cache disabled and confirmed `--ks-action: #0f766e` loaded from the central foundation.
- Empty state rendered at 945 × 884 without horizontal document overflow; the active width field retained its linked drawing emphasis.
- Entered 3600 mm width, 4200 mm depth, and 2700 mm height. The drawing updated, the floor area appeared, the progress label became `٣ من ٣ مقاسات`, and the CTA became `بدء رفع الجدار الأول`.
- Completed fields, drawing axes, and footer progress resolved together with completion semantics and check marks.
- Compact desktop rendered at 768 × 900 with `scrollWidth === clientWidth === 768` and no vertical document overflow.
- Browser console warning/error query returned an empty result.

## Remaining browser matrix

| Journey/state | Required evidence before acceptance |
| --- | --- |
| Visit invalid and native validation | Check correction messaging, dashed boundary, focus return, and Arabic announcement |
| Visit perimeter dialog | Open, edit, close/Escape and return focus; sticky header, scroll, backdrop, layering and no covered controls |
| Survey notebook | Empty, selected, pending, dirty, saved, confirmed, review and invalid; verify actual state labels and focus/selection borders |
| Survey forms and register | Numeric input, checkbox labels, dropdowns, error/guard notices, field drawer and overlapping palettes |
| Pointer and keyboard | Hover/press/disabled states, tab sequence, keyboard activation, visible focus, coarse targets measured at ≥44×44 CSS pixels |
| RTL and compact layout | 768px desktop, Arabic labels, arrows, start/end anchoring, overflow menus and reading-tray order |
| Zoom | Primary workflows usable at 200%; controls/labels and enlarged native measurement fields do not collide or clip |
| Reduced motion | Real media-query rendering removes nonessential transition/translation feedback |
| Independent survey prototype | Foundation import loads; local-font rendering, standalone generic styles and native dialog still work |
| Mixed shell | Navigate field → an unmigrated design screen → field; check masthead, dialog top layer, focus, overlays and z-index |
| Console/network | No new runtime warnings, missing stylesheets/resources or console errors |

Potential browser-only risks include the larger measurement inputs inside the existing unchanged coordinate-anchor geometry, focus rings near clipped SVG/container edges, inherited legacy shell styles winning the cascade, high-zoom horizontal overflow, and popovers overlapping adjacent controls. Source-only tests cannot resolve them.

## Foundation calibration

The central tokens were recalibrated after the static findings. `--ks-attention: #94540f` against `--ks-attention-soft: #fff4dd` now measures **5.44:1**. A dedicated `--ks-focus-ring-dark: #55c8d4` against `--ks-ink-strong: #132f3b` measures **7.08:1**; the standard light-surface ring remains separate. `tools/check-kitchen-design-foundation.mjs` now enforces these thresholds and passes.

## Review fixes — focused evidence

- Native policy now accepts the exact `--ks-focus-ring-dark` contract for a valid 3px-or-wider solid outline and outline-color. Tests still reject a 2px dark outline and invented dark-token suffixes. The policy test was observed failing before support was added and passing afterward.
- Dark focus is explicitly applied to visit masthead actions, perimeter-header actions, field-register header actions, the dark survey stage workbar, notebook HUD actions, and standalone context-HUD actions. Each uses the dedicated dark ring and a 2px offset; light surfaces retain the standard ring. Field assertions were observed failing before these rules were added.
- Standalone `.measure-input input` no longer has an unconditional outline. Its explicit `:focus-visible` rule provides keyboard focus, and the wrapper now has visible overflow so the external ring is not clipped. The new field assertions were observed failing before this correction.
- Notebook button SVGs are 19×19px. The 44px target stays on the enclosing button. The proportional-icon assertion was observed failing before the correction.
- The QA-status assertion was observed failing on the previous acceptance wording and now requires partial browser evidence, incomplete Task 3 status, and attributed selector-retention evidence.

These fixes have static verification only. Rendered dark-surface focus, clipping, and icon appearance still require browser follow-up.
