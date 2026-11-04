# Maintenance Studio Implementation Plan

**Goal:** Implement receipt-backed unit service reporting, explicit warranty terms, repair and owner-recorded customer acceptance with local draft undo and complete journey tests.

**Architecture:** Append service events to the existing jobs stream while retaining delivery state accepted. A separate pure projection folds per-ticket state and warranty evidence. The new maintenance UI reuses receipt drawing and proven draft primitives without changing local project documents.

**Tech Stack:** Existing JavaScript modules, scoped CSS, TypeScript jobs handler, SQLite/R2 adapters, esbuild and Node assertion checks.

**Spec:** `docs/kitchen-studio/maintenance-studio-integration.md`.

## Tasks and ownership

- [x] API/domain: `public/kitchen-maintenance-domain.js`, `app/api/jobs/route.ts`, API/domain tests. Preserve subject binding, live ACL, sequence and receipt custody; no schema migration.
- [x] Presentation: `public/kitchen-maintenance-drawing.js`, `public/kitchen-maintenance-studio.css`. Receipt-only drawing, contextual ticket pins, responsive and keyboard controls; previous delivery visual unchanged.
- [x] Controller/drafts: `public/kitchen-maintenance-studio.js`, `public/kitchen-maintenance-draft.js`. Explicit local save, undo/redo, exact retry, stale/account/target isolation and navigation guards.
- [x] Routes: existing gateway and workshop shell; direct handover→service and service→handover context with exact receipt/unit selection.
- [x] Real-handler fixture: `scripts/serve-maintenance-review.mjs`, separate port8767 and cookie namespace; seed accepted units via real API only. Leave8766 delivery fixture untouched.
- [x] Tests: `tools/check-kitchen-maintenance-studio.mjs` and full existing suite, bundle verification, desktop/tablet/phone browser journey, evidence report and source hashes.

## Review focus

- Existing delivery acceptance must remain unchanged while any service case is open/reopened.
- Absence/expiry of warranty must not silently become coverage or prohibit reporting.
- Shared unit sequence invalidates stale drafts across tickets and warranty amendments.
- Customer closure and warranty/coverage decisions remain owner-only, including atomic role checks.
- Network uncertainty, subject switches and destroyed controllers must never duplicate or misattribute a case event.

The user explicitly authorized implementation and testing; routine architecture decisions follow the inspected current source. No new approval gate, Git commit, deployment or real customer approval is required by this plan.

