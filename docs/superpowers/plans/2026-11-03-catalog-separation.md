# Catalog Separation Implementation Plan

> For agentic workers: implement assigned file scopes with focused regression tests; root integrates and reviews the whole change.

**Goal:** Complete the owner-approved second phase: independently owned store catalog, factory recipes, and pricing terms while preserving current projects.

**Architecture:** Three authoritative records live in the workshop snapshot. The existing flat catalog is a derived, nonserialized compatibility view for calculations. Old projects migrate at normalization boundaries without altering their business values or valid approval fingerprints. The explicit edit bridge reconciles existing catalog editors against prior records; external imports with contradictory representations are rejected.

**Tech Stack:** Existing browser ES modules, Node assert checks, TypeScript API routes, SQLite checks and esbuild-generated domain bundle.

**Spec:** Owner request in this chat on 2026-11-03 and the approved three-phase scope recorded in docs/kitchen-studio/gateways.md. This task implements phase two; role-based permission expansion is excluded.

## Global Constraints

- Keep purchase prices in the store catalog. Pricing terms own manufacturing/service charges, margin, tax and wall rates.
- Preserve legacy projects, team catalog fingerprints, special sheets, undo/redo, export/import and cloud authority enforcement.
- Independent revisions and approvals; changing only price or sales terms does not revoke factory recipe approval. Technical item changes require dependent recipe review.
- No deployment, publishing, payment, real-customer data writes or changes to Claude's process.
- This folder has no Git repository. Preserve a source baseline outside the project; no Git initialization or commits.

## Review Focus

1. A split archive must not bypass the server's existing owner-only catalog authority.
2. Opening and saving an unchanged legacy project must preserve quote, drawings and existing approval meaning.
3. JSON cloning removes the compatibility view; raw split documents must remain usable by consumers.
4. Failed saves and stale-tab writes must not replace the current in-memory project.
5. Imports/templates must preserve independent approval state and reject malformed/contradictory records.

## Task 1 — Records and migration

- [x] Add failing tools/check-kitchen-catalog-records.mjs cases for legacy equivalence, split JSON, partial/dual rejection, scoped edits and scoped approvals.
- [x] Implement public/kitchen-catalog-records.js helpers with null on invalid input, and integrate cleanWorkshop/getFactoryCatalog/quote readiness.
- [x] Run focused record and factory checks.

## Task 2 — Persistence and UI

- [x] Normalize project commit/save/undo/redo, cloud/export and saved-library boundaries; pass normalized next back to the editor.
- [x] Adapt direct catalog consumers to raw split snapshots.
- [x] Add per-owner approval controls and revision status in the existing store, factory and pricing pages; ensure nested editor writes reconcile centrally.
- [x] Verify save/reopen and live UI journeys without changing existing user browser data.

## Task 3 — Templates and authority

- [x] Test legacy fingerprints and device/team roundtrips plus editor rejection of split-record changes.
- [x] Extend device/team portable serialization with split records while reading legacy catalog payloads.
- [x] Update server authority comparisons and regenerate the server domain through its existing script.

## Task 4 — Integration verification and handoff

- [x] Provide minimal local dependencies for the plain checks without changing package manifests.
- [x] Run all checks, investigate failures, and obtain an independent final review.
- [x] Update gateways documentation and report actual validation results and remaining scope.

## Decisions / Evidence

- The owner explicitly requested implementation from Claude's stopping point; the approved product design and scope are carried forward without restarting approval questions.
- Purchase-price ownership remains with the store, as specified in the user's real-work split.
- Existing role permissions remain intact; independent business approvals are introduced without granting new account privileges.
- Baseline captured outside the project in the chat visualization directory, phase2-baseline.
- Final complete suite: 187/187 passed, exit 0. Chromium UI journey and three frozen-baseline compatibility comparisons passed.
- Review found and fixed dynamic alternative-item dependency invalidation; unsaved store/pricing form approval is blocked, and factory approval stays on the template page.
- Verification evidence and limitations: docs/kitchen-studio/catalog-records-phase2.md.
