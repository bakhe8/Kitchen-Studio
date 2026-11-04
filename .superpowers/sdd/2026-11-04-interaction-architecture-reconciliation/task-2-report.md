# Task 2 report — shared interaction-intent adapter

Status: COMPLETE (source implementation and automated verification).

Commit: the Git commit containing this report, titled `feat: reconcile kitchen width interaction intents`. Resolve its exact ID with `git log -1 --format=%H -- .superpowers/sdd/2026-11-04-interaction-architecture-reconciliation/task-2-report.md`; the final task handoff also supplies the ID. No push was performed.

## Implemented behavior

- Added `createInteractionSession(baseRevision)`, `previewInteractionIntent(doc, intent, session)`, and `commitInteractionPreview(preview, session)` in `public/kitchen-interaction-intent.js`.
- A session owns the latest preview and supports `session.cancel()`. A newer intent invalidates an earlier successful preview even when the newer request fails constraints. Cancelled sessions, other sessions, mismatched revisions and superseded previews cannot authorize a candidate.
- Inputs use absolute `requestedValue` in millimetres, `objectId`, `property:'widthMm'`, `referenceEdge` (`start`, `end` or null), `inputKind` (`number`, `grip`, `button`), and `explicitUserChange`. Session and base-revision metadata bind the request. Intent IDs are generated monotonically within the session.
- Preview outputs include `status`, `candidate`, `affectedObjects`, `protectedObjects`, `changedProperties`, `protectedProperties`, `constraintReasons`, `unresolvedEvidence`, `catalogRevision`, `measurementRevision` and `effectsStatus`. Original domain change/price/donor fields remain available to existing consumers.
- All width geometry and effects calculation delegate to `previewKitchenWidthChange`. Fast geometry previews have deferred effects and cannot authorize commit. Complete previews expose the domain's changes, protection and price effects without creating a second geometry or pricing policy.
- Both designer surfaces now use this adapter for numeric and grip width previews and for candidate authorization. Whole-plan buttons and saved width-edit recipe replay use it as well. Existing UI copy, focus selectors, history and project persistence entry points remain in place.
- The brief described Task 1 as complete, but current HEAD only allowed explicit edits through a personal width lock; it did not lock a previously unlocked target after success. The parent explicitly authorized closing this gap in Task 2. The domain now sets only the target's `locks.width=true`, preserving other lock fields. No appliance/model/measurement/position protection was relaxed.
- Adapter commit returns an authorized candidate; the existing UI still owns staging, project application and project save. Client approval and production release remain separate domain events.

## RED evidence

1. Wrote `tools/check-kitchen-interaction-intent.mjs` before adapter implementation and ran `node tools/check-kitchen-interaction-intent.mjs`. It exited 1 with expected `ERR_MODULE_NOT_FOUND` for `public/kitchen-interaction-intent.js`.
2. Before changing domain locking, executed a direct assertion against a real generated visit proposal: explicit +100 mm edit of its initially unlocked rice unit succeeded, but `locks.width` remained false. The assertion failed with `false !== true` (exit 1).
3. Added an actual-source identity mismatch test after the initial adapter existed. It failed with `'ready' !== 'stale'` before implementing the document-identity revision guard.
4. First required UI check run exposed the old CAD expected-result call using non-explicit domain semantics: actual width lock true versus expected false. Updated that expected-domain call to pass `explicitUserChange:true`, matching the required live user operation.
5. First design-complete run failed because generated inventory did not yet contain the new adapter. Ran the normal generator rather than hand-editing the inventory.

## GREEN evidence

All commands below finished with exit code 0 on the final implementation:

| Command | Result |
| --- | --- |
| `node tools/check-kitchen-interaction-intent.mjs` | PASS — equivalent numeric/grip/button candidates; pure preview/authorization; affected/protected data; explicit target locking and preservation of unrelated locks; locked donors and appliance hosts rejected; supersession, cancellation, revision and cross-session guards; deferred-effects commit rejection |
| `node tools/check-kitchen-whole-visit.mjs` | PASS |
| `node tools/check-kitchen-view.mjs` | PASS — mounted CAD numeric/grip transactions, stale rejection, saved rows and one undo, plus existing CAD contracts |
| `node tools/check-kitchen-designer-studio.mjs` | PASS — raw preview/cancel, staging, apply, history and permissions/recovery contracts |
| `node tools/check-kitchen-proposal-grips.mjs` | PASS — mounted grip preview/cancel, protected edges, explicit application and inverse undo |
| `node tools/check-kitchen-design-complete.mjs` | PASS — 64 CSS / 299 JS files, classified inventory and source policy |
| `node tools/build-kitchen-design-inventory.mjs` | Generated 64 CSS / 299 JS / 48 routes / 43 screens; 100% classified |
| `npm test` | **238/238 checks passed** |
| `git diff --check` | PASS |

## Files changed

- `public/kitchen-interaction-intent.js` — new shared transient adapter.
- `tools/check-kitchen-interaction-intent.mjs` — new behavioral contract checks using real domain proposals.
- `public/kitchen-whole-plan-ui.js` — adapter routing for width entry, grip, buttons and width replay; cancellation wiring.
- `public/kitchen-view.js` — adapter routing for managed factory width preview and confirmation.
- `public/kitchen-proposal-change.js` — authorized closure of the explicit target-lock gap.
- `tools/check-kitchen-view.mjs` — align expected domain candidate with explicit user-edit semantics.
- `docs/design-system/inventory.json` — regenerated by the standard generator because the normal checker required new-module coverage. This file was already dirty on task entry; normal regeneration reconciled it with the actual checkout, including existing LF normalization/hash differences.
- This report.

## Concerns and evidence limits

- Revision values are opaque caller-owned tokens. Both live surfaces use immutable document identity and retain their existing current-project/source guards. A caller using string revisions must update the session revision or cancel the session when its source revision changes.
- `measurementRevision` is a transient fingerprint of the current field register and workshop chains, not a new attestation, approval or storage schema. Catalog revision comes from the existing factory catalog.
- Fast grip/raw previews deliberately defer effects. Full effects are calculated before staging/authorization; the adapter does not add persistence, client approval or release behavior.
- Automated mounted-controller checks and the full source suite passed. No separate visual browser acceptance, real touch-device test or technician usability acceptance was conducted in this task.
- No subagents were spawned. No push, deployment, publication or cross-chat messaging was performed.
