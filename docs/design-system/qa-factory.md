# Factory and workshop — source verification

Date: 2026-11-04. Scope: Task 6 / Wave 6, the five stylesheets in `migration.md`.

**Static source migration is implemented; browser acceptance is pending. Task 6 remains incomplete.** This record does not grant system-native acceptance. Browser journeys, computed geometry, screenshots, P0–P2 review and the full suite remain with the parent task. No browser, inventory generation, full suite, Git operation or external publication was performed in this scoped delivery.

## Evidence and scope

`node tools/check-kitchen-design-factory.mjs` was added before migrating the stylesheets. Its initial run exited 1 on `public/kitchen-factory-pages.css consumes foundation tokens`. Subsequent checks cover all five manifest stylesheets and the contracts described below.

Existing selectors, field values, accessible Arabic labels, message text, event handlers, recipe calculations, reservation guards, save/release decisions and persistence are retained. UI colors, morphology, elevation, timing, focus, targets and actual workshop overlay layering consume foundation tokens. Small JavaScript changes only expose current presentation state; the production-row rendering preserves its original measured inline positions and widths.

| Surface | Static evidence | Browser boundary |
| --- | --- | --- |
| Factory operator pages | Compact controls reserve 44 px in both axes; status rows retain explicit labels and quantities; selected stock has double start boundary and underline; sticky cut header uses sticky token; stock/row keyboard focus has an external ring | Verify live cascade, clipped focus, search/filter, narrow viewports and 200% zoom |
| Production row | Fine pointers retain original absolute `startMm` and `widthMm` percentages, including leading/reserved/trailing gaps; a 44 px minimum width does not distort the measured drawing. Existing unit details expose separate 44 px summary targets. Only `pointer:coarse` switches the track to a wrapping action layout with independent 44 px targets. IDs, titles, captions, order, dimensions and selection handlers are unchanged | Fine-pointer measured bars may be narrower than 44 px; their existing unit summaries remain the large action route. Verify long labels, many narrow units, fine/coarse pointer, keyboard, preview readout, exact empty intervals and scroll behavior |
| Production studio | Saved/default status is information; unsaved preview is attention/dashed; invalid/stale is danger/double; successful gate readiness is completion/solid; geometry collision concerns expose attention/double/wavy underline; other unresolved gates expose danger/double/bold; editable impact state is explicitly information/preview/invalid | Exercise saved, preview, saving, invalid, stale, collision, missing approval, and ready gates against representative project fixtures |
| Shared inventory route | Existing claim line free/required values publish `attention` when free is unknown, `blocked` when deficient, and `ready` when sufficient; Arabic required/available text and disabled reservation guard remain unchanged | Authenticated inventory request/loading/error, unknown/low/sufficient balances, retries and a complete reservation journey require live verification |
| Workshop factory | Ordinary summaries remain neutral; hints use attention/dashed; tabs and treatment choices have underline/double boundary; file labels expose focus-within; table rows expose focus-within; import issues use danger/double | Empty/filter/import and bulk checkbox/label interaction, fitting, treatment availability, table overflow and file chooser need browser checks |
| Workshop container | Actual floating workshop uses popover layer and overlay radius; active routes/modes have a non-color cue; generic notices are information; failure and change-review messages use separate danger/attention morphology | Actual route head is styled by the later operations/nav family; verify mixed navigation, modal overlap, close/return focus, mobile modality and RTL anchors before acceptance |

Destructive/irreversible inventory or recipe actions keep their existing explicit Arabic action text and receive danger-soft surfaces, double danger boundaries and underline. These include recipe-line/part removal, unsaved-item discard, corner/drawer/brief removal, reservation cancellation and stock consumption. Production-preview cancellation receives the same visible treatment. Existing unsaved-item preparation retains both “continue editing” and “discard edits and switch” actions; no confirmation workflow, event handler or domain rule was added or removed.

The only raw CSS exceptions are five original technical palette declarations in `kitchen-factory-pages.css`: measured surface outline stroke/fill, unmeasured outline fill and hole-group stroke/fill. The original `.kf-holes>*` geometry rule remains; inherited fill/stroke move to its exact `.kf-holes` group to avoid a wildcard allowlist selector. The shapes remain the existing polygon, rectangle and circle children with identical authored palette values.

The catalog's existing `.kw-stock-swatch` remains a labeled product-material sample inside its selectable stock row. Its background still uses the existing exact six-digit hex validation of `i.colorHex`. A single exact `material-swatch` allowlist entry binds `'+color+'` to the authored `<i class="kw-stock-swatch" style="` sink. Names, SKU and specification remain adjacent; selection morphology applies to the row rather than changing the sample's product color. No UI status receives a material-color exception.

External focus uses the light-surrounding-surface ring for ordinary fields, selected stock, rows and filled buttons on light pages. Only dark header surrounds use the bright ring. Production-header save/cancel buttons retain a dark surrounding header even though their own faces are light. The actual `.ws-route-head` uses the ordinary ring on mobile and the bright ring at the existing 768 px desktop breakpoint, where the navigation stylesheet positions it on dark titlebar chrome. These local rules have enough specificity to override the existing 2 px legacy focus rules. Source contrast assertions check both focus/surround pairs at 3:1 and completion/attention/danger text pairs at 4.5:1. They cannot establish live focus clipping, actual text contrast after inheritance, or screen pixels.

The source contracts include disabled behavior, bounded 1 px press feedback, explicit coarse-pointer target declarations and removal of transitions/translations for reduced motion. Checked checkbox/radio indicators remain compact inside 44 px labels; browser checks must establish actual label hit geometry, order and non-overlap.

## Verification

The following scoped checks passed:

- `node tools/check-kitchen-design-factory.mjs` — five manifest stylesheets, state hooks, source-bound material preservation, non-color state/selection/destructive morphology, density, focus, sticky/popover layers and motion contracts.
- `node tools/check-kitchen-design-native.mjs public/kitchen-factory-pages.css public/kitchen-production-row.css public/kitchen-production-studio.css public/kitchen-workshop-factory.css public/kitchen-workshop.css` — zero violations; exactly five technical palette exceptions in factory pages, zero exceptions in the other four CSS files.
- Native checks of `kitchen-production-studio.js`, `kitchen-workshop-inventory-ui.js`, `kitchen-production-row-ui.js` and `kitchen-workshop-factory-ui.js` — zero violations; only the exact existing stock swatch has an exception.
- `check-kitchen-design-foundation.mjs`, native-policy self-tests, and neighboring `check-kitchen-design-catalog.mjs`.
- Existing `check-kitchen-production-workshop.mjs` — mounted production selection, shared-operation preview, cancel/undo/redo, save/retry, stale/permission/role behavior, independent drafts, quote handoff and exact source/return context.
- Existing `check-kitchen-production-row.mjs`, `check-kitchen-production-preview.mjs` (16 groups), `check-kitchen-production-drawing.mjs`, `check-kitchen-production-invariants.mjs` (120 scenarios), `check-kitchen-workshop-factory.mjs`, `check-kitchen-workshop-navigation.mjs` and `check-kitchen-catalog-import.mjs`.
- Existing `check-kitchen-scoped-operations.mjs` and `check-kitchen-output-interactions.mjs` — store count/reserve and independent resource authority, forged-event/revocation protections, preserved stock selection/count drafts and output source/selection behavior.

The factory checker also rejects altered case or relocated context for the stock-swatch color expression. These source checks and existing Node/DOM harness journeys do not establish browser acceptance; no runtime browser was opened and no full suite was run.

Review correction: a factory regression assertion was added and observed RED on the unconditional flex track (`fine-pointer track cannot collapse measured gaps into a flex layout`). The correction restores original absolute positioning and removes the added `flex-grow` markup. Flex/wrapping, inset and width resets now exist only under `pointer:coarse`. The checker renders the actual `rowTrack` function with a non-zero-origin fixture: a 5000 mm run starting at 1000 mm, units at 1300/2300 mm with widths 600/900 mm. It verifies exact `[start%,width%]` pairs `[6,12]` and `[26,18]`, preserving the 300 mm leading gap, 400 mm reserved gap and 2800 mm trailing gap. It also rejects unscoped position/inset/width/flex resets across the five family stylesheets. The revised factory, production-row and native checks pass; browser geometry remains pending.

A second review regression was observed RED when resolving the coarse preview height against `kitchen-stage-design.css`: its later desktop `.pwr-desk [data-pwr-result] .pwr-track` rule won with `60px`, despite the coarse layout wrapping 44 px buttons. The production-row owner now scopes a more specific `.k-workshop .pwr-desk [data-pwr-result] .pwr-track {height:auto}` rule to `pointer:coarse`. The focused checker reads the actual two stylesheet positions in `index.html`, evaluates their pointer/min-width contexts and simple selector specificity, and verifies that coarse desktop preview height resolves to `auto`, fine desktop remains `60px`, and fine narrow remains `49px`. This checks the known cross-family cascade without changing the studio-family stylesheet or claiming browser-computed layout evidence.

## Pending browser acceptance

- Ready, warning/unknown, geometry conflict, release blocked, invalid input, stale project, loading/error and disabled states.
- Bulk selection, table mapping, row search/filter/no results, stock samples retaining actual product colors and adjacent identifying text.
- Unsaved-item discard preparation and keep-edit recovery, recipe removal, preview cancellation, inventory cancel/consume action preparation and authorization.
- Keyboard order, focus visibility/clipping, sticky headers, file chooser labels, close/return focus, 44 px computed targets and neighboring hit-box separation.
- 768 px, 200% zoom, fine/coarse pointer, long Arabic labels, RTL anchors, exact measured fine-pointer gaps and coarse-only action wrapping.
- Light/dark header focus, reduced motion, overlays versus shared dialogs, mixed navigation to later unmigrated operations surfaces and console errors.
- Browser captures and P0–P2 review, then the full `npm test` suite and deliberate inventory/acceptance update by the parent task.

No browser P0–P2 conclusion or full-suite success is asserted by this source record.
