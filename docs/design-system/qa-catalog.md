# Catalog and defaults — source verification

Date: 2026-11-04. Scope: Task 5 / Wave 5, the five stylesheets listed in `migration.md`.

**Static source migration is implemented; browser acceptance is pending. Task 5 remains incomplete.** This record does not promote any surface to system-native acceptance. No inventory was regenerated, browser session run, or full suite run during this scoped delivery.

## Evidence and scope

The focused checker was added before stylesheet changes. `node tools/check-kitchen-design-catalog.mjs` initially exited 1 because `public/kitchen-defaults.css` did not consume foundation tokens. The five stylesheets subsequently pass `check-kitchen-design-native.mjs` with zero violations and zero CSS color-data exceptions.

The migration preserves existing selectors, DOM structure, event handling, catalog formats, material records, persistence, import validation, and readiness computation. Small JavaScript changes add presentational `data-state` values to existing library/template status and placement-fit nodes; status texts and business behavior are preserved. It consumes the foundation for UI colors, radii, elevation, timing, focus, hit areas and layers. It introduces no product-data colors into the UI-token namespace.

| Surface | Source evidence | Runtime boundary |
| --- | --- | --- |
| Defaults | 44 px compact actions/fields; named origin tags; selected mode has underline and double boundary; success and error use separate semantic edges; action controls use a ring contrasting with the surrounding light surface; secondary/small hover explicitly uses ink on action-soft | Field drawer remains the owning overlay; check drawer navigation, clipped focus and 200% zoom in browser |
| Device catalog | none/draft/incomplete retain their existing explanatory Arabic messages, attention tokens and dashed start edge; ready uses completion tokens and solid edge | Missing, incomplete and ready texts must be exercised with representative saved catalog records |
| Library | empty/filter result retains explicit text and dashed enclosure; form/import error uses danger and double edge; selected tab has underline and double boundary; table headers consume sticky layer and rows provide focus-within treatment | Existing status messages expose `data-state`: loading file is information with a dashed edge, ordinary facts are information, confirmation/repreview/partial success require attention, and completed writes/exports use completion |
| Supplier references | complete/invalid placement messages retain existing `data-valid`; invalid uses danger and double edge; header/actions retain contrasting focus; drawer consumes popover layer | Check supplier placement, close/return focus, and dialog overlap |
| Personal templates | empty library retains explanatory text and disabled placement actions; fit/import failure uses existing messages plus danger/double edge; removal confirmation is attention, unchanged-record fact is information, successful writes are completion; ordinary buttons/file label use control radius while only the container uses overlay radius | Check import, empty selection, keyboard/file interaction, fitting and non-fitting placement; missing-destination guidance uses attention even after previous success/error fit state |

Existing material samples in defaults are **read-only**, with adjacent material names. Their `goodColor(m.color)` values in `kitchen-defaults-ui.js` are unchanged. There are no selectable swatch controls in Wave 5; selected finish/swatch interaction belongs to the spatial family. This delivery does not claim to have tested a catalog swatch-selection journey. Exact color-data exceptions remain governed by `allowlist.json`; no blanket selector/file/category waiver was added for UI styling.

Review extended native policy to detect JavaScript concatenation markers in controlled inline styles without executing the expression. The exact value `'+goodColor(m.color)+'` now requires two user-color exceptions for the existing background sinks in `kitchen-defaults-ui.js`: the sample below `.df-material-head` and the sample within `.df-finish-list`. Each exception is additionally bound to its distinct literal `sourcePrefix` immediately before the CSS declaration. Native checking of that JS file reports zero violations and exactly two documented exceptions. Case changes to the expression, relocation to another context, and attempts to waive geometry fail regression checks. Product color values and the existing sanitizer were not edited.

Actual supplier and template floating palettes use `--ks-z-popover`, below `--ks-z-dialog`. Defaults render inside the existing field drawer, whose layer remains owned by the field family. The library is a workshop page, not a new overlay. None of those containers is given a fabricated modal layer.

The focused source checker covers all five manifest stylesheets and checks semantic readiness/import/error/empty treatment, existing labeled material-color preservation, non-color selection, compact targets, separate light/dark focus, table focus, actual overlay layers, press response and reduced-motion rules. Source checks establish declarations and existing state hooks; they do not measure computed pixel bounds, screen contrast in the live cascade, clipping, keyboard order, or assistive-technology output.

## Verification

The following checks passed:

- `node tools/check-kitchen-design-catalog.mjs`
- `node tools/check-kitchen-design-native.mjs public/kitchen-defaults.css public/kitchen-device-catalog.css public/kitchen-library.css public/kitchen-supplier.css public/kitchen-user-library.css` — zero violations and zero exceptions for every file.
- `node tools/check-kitchen-design-native.mjs public/kitchen-defaults-ui.js public/kitchen-library-ui.js public/kitchen-user-library.js` — zero violations; exactly two qualified material-color exceptions in defaults, zero exceptions in the other modules.
- Foundation and native-policy self-tests: `check-kitchen-design-foundation.mjs`, `check-kitchen-design-native.mjs`.
- Existing relevant checks: `check-kitchen-device-catalog.mjs`, `check-kitchen-library-ui.mjs`, `check-kitchen-library-table.mjs`, `check-kitchen-library-catalog.mjs`, `check-kitchen-defaults-ui.mjs`, `check-kitchen-defaults-workflow.mjs`, `check-kitchen-supplier.mjs`, `check-kitchen-user-library.mjs`, `check-kitchen-catalog-import.mjs`, `check-kitchen-catalog-records.mjs`.

The source checker additionally measures the secondary-control hover ink/action-soft pair and semantic information/attention/completion/danger text pairs against 4.5:1, and both focus/surrounding-surface pairs against 3:1. Bright focus rings are restricted to dark surrounding headers; external rings around filled buttons on light pages use the light-surface focus contract. Specific primary/danger hover rules exclude disabled controls. Hidden-but-editable library records retain full text opacity. These source assertions do not replace live computed-style measurements.

Review regressions were added and observed RED before fixes: native policy initially accepted the concatenated inline color fixture without an exception, and the catalog checker initially failed the missing secondary-hover ink contract. They now pass along with checks for state hooks, distinct material sink contexts and control/overlay morphology.

## Pending browser acceptance

- Empty catalog/library, filtered no-result, none/draft/incomplete/ready catalog state, import preview and import invalid-data error, supplier validity, and user-template failure states.
- Existing library selection/mode controls must expose underline and boundary cues with keyboard focus, hover, disabled and pressed states; informational material samples must retain their actual user/product colors and names.
- Keyboard order, native file chooser labels, table mapping controls, focus visibility/clipping, close/return focus, RTL anchors/arrows, 768 px, 200% zoom and coarse pointer hit areas.
- Reduced motion, console errors and mixed navigation to adjacent unmigrated screens; supplier/template palette versus shared modal layering.
- Browser captures and P0–P2 review, followed by the full `npm test` suite and deliberate inventory/acceptance update by the parent task.

No browser P0–P2 conclusion or full-suite success is asserted by this source record.
