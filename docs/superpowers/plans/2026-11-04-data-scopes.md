# Project Data Scopes Implementation Plan

> Implement the owner-authorized fourth phase in assigned file scopes, with independent review and explicit confidentiality tests. The user's request authorizes implementation; do not create a Git repository or deploy.

**Goal:** Only the owner receives the complete project; store, factory and rep receive their own data and narrowly defined operational context. Preserve existing canonical projects. The rep receives only the current owner-approved final sale amount, as explicitly selected by the user.

**Architecture:** Keep canonical full archives on the server. Introduce discriminated project/catalog view DTOs and edit DTOs. Merge owned slices into the expected full server revision; omitted private data never becomes a deletion. Keep owner archival behavior. Bootstrap scope-aware clients before mounting any full editor. Reuse suitable existing editing widgets through an explicit transient adapter that never becomes an archive or a full save; disable synthetic commercial reports and full template/export flows.

**Tech Stack:** Existing JS modules, TypeScript API routes, D1/SQLite and R2, native browser widgets, existing esbuild verification bundle.

## Requirements and choices

- The owner explicitly requested actual read separation after phase three. Rep may see approved final sale only, without purchase costs, margin, tax detail or unapproved estimates.
- Store owns storeCatalog; factory owns recipes/manufacturing records; rep owns survey/design/client requirements. Factory receives technical geometry and nonpriced material specifications; rep receives choice specifications and manufacturing dimension limits, not recipes.
- Full archives, pricing histories, approval notes, release/batch financial fields and shared catalog variants are owner-only. Apply the same rule to historical reads, download paths and auxiliary APIs.
- Legacy editor/viewer/catalog reader memberships remain stored but require owner role assignment before receiving scoped data. Do not silently retain their former full-read behavior.
- Authenticated server identity/role determines scope. Never trust the DTO role from a write. Recheck scope after asynchronous reads and at publication. Retry identity uses the submitted limited payload digest, not only the merged full archive digest.
- Project and catalog memberships are independent. Restrict inventory and jobs read surfaces too.
- Preserve full server data and unsynced old local data. Do not silently purge previous downloads. They are excluded from new scoped UI/bootstrap/export and cannot serve as scope state. Already downloaded data cannot be retroactively made unseen; record this limit explicitly.
- Separate scope working state by account/project/role/version, suppress stale responses, and hide/dispose prior scope before rendering a changed scope. Keep same-scope form drafts while verifying access.
- No full server clone may promote a scoped reader into owner of hidden content. Scoped downloads contain only the scoped DTO.

## Considered approaches

1. Redact fields in ordinary archives: rejected because existing normalization fills absent records and full saves can erase hidden state.
2. Split all persistence into unrelated stores immediately: unnecessary migration risk for existing projects and ordering/approval semantics.
3. Canonical server archives with typed role views and owned-slice merges: chosen implementation judgment, preserving existing data while making the read boundary explicit.

## Contracts

`projectView(role, archive, {id,revision,name,subject,approvedSale})` returns `kitchen-project-view` v1 with `project`, `access`, `editable`, `context` and optional rep-only `approvedSale`. Legacy roles receive an empty assignment-required view.

`mergeProjectEdit(role, currentArchive, edit, {expectedRevision})` receives `kitchen-project-edit` v1, baseRevision and the complete owned `editable` slice. Unknown keys and context writes are rejected. It restores hidden records from the canonical base, reconciles dependent invalidation/corner operations, and validates the complete result.

Scoped client `mountScopedWorkspace(host,{view,save,reload,list,open,leave,remember})` renders only scope data. `save(editable)` returns a fresh authorized view. Owner continues to receive full archives.

## Tasks and ownership

- [x] Pure scope policy: project/catalog projection + merge, exact allowlists, protected shared attachments, legacy role gating and sentinel/preservation tests — phase2_review.
- [x] Server: four APIs, read-race checks, approved-sale evidence, typed writes/idempotency migration, auxiliary leaks and real handler tests — project_baseline.
- [x] Client: authenticated bootstrap, scoped transport, account/scope partitioning, stale response guards, scoped cloud open and unit-entry protection — verification_setup.
- [x] Workspace: restricted role UI, transient widget adapter, safe approved-price display, own-data save/export and functional browser tests — root.
- [x] Final integration: complete suite, independent review, browser journeys, source snapshot evidence and report — root with reviewers.

**Verification:** First complete run passed 205/205, exit 0. A final rerun overlapped a separately owner-authorized finish-studio implementation in thread `01a1a331-ea32-7cb3-a894-bac000897a76`: 201/205 due to a not-yet-created preview import. Once that file arrived, three affected checks passed; finish-desk still failed at its preview-confirm fixture while the other task remained active. Do not claim a current globally green tree. Phase-four and server checks passed in both runs. Real isolated Chromium passes all scope routes, three owned-role edits, quota recovery, account change/offline lock, three independent catalog ACL scenarios, legacy owner restore/downgrade and unbound local owner. See `docs/kitchen-studio/data-scopes-phase4.md` for details. No live migration/deployment or framework build/typecheck was performed.

## Review focus

1. Sentinels in pricing copies, reference costs, private customer names/notes, field files and unknown properties must never appear in unauthorized responses.
2. Replacing an owned slice must preserve hidden data and attachments, including shared file references, absent catalogs and old single-catalog projects.
3. Role/account changes during reads, writes or UI edits must not install stale full or wider scope data.
4. Historical endpoints, retries, cloning/export, catalog duplicates, jobs and inventory must not bypass the read boundary.
5. Price shown to rep needs current validity and authenticated owner approval evidence; pending responses contain no amount or breakdown.

**Baseline:** 711 source/document/config files copied to the chat evidence directory `phase4-baseline` before implementation. No live customer data or database migration is modified during verification.
