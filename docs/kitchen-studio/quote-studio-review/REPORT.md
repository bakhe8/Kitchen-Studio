# Quote Studio — implementation and journey evidence

Date: 2026-11-04, Asia/Riyadh. Workspace: `C:\Users\Bakheet\Projects\Kitchen-Studio`.

## Result

The actual workshop `quote` route now mounts the quote studio. A user can select a CAD unit, inspect its manufactured pieces and shared materials, edit a used SKU purchase price or a project commercial term, compare the full-project impact, and explicitly save or cancel. Source links reopen the specific catalog item, commercial term, CAD unit or finish editor. The original purchasing/cutting ledger and exports remain available.

Prices and terms use the authoritative catalog records and the existing quote calculator. Quantities, packing and derived costs remain calculated. The owner can edit from this combined workspace; the other roles retain their prior write boundaries. Customer approval and numbered versions remain in the original guarded approval flow. Pure commercial edits preserve structure approval while the customer key changes where relevant.

See [interaction and FSM contract](../quote-studio-integration.md) and [implementation plan](../../superpowers/plans/2026-11-04-quote-studio.md).

## Automated verification

- [suite.log](suite.log): **214/214 checks passed**, including repository server/scoped access checks and existing survey, design, finishing, catalogs, approval, export and history checks.
- `tools/check-kitchen-quote-preview.mjs`: **11 groups**, real packed material and project sale effects, unknown versus zero, strict ranges/schema, independent record revisions/approvals, structural/customer key behavior, provenance, real persistence/reopen/history, storage failure and stale source.
- `tools/check-kitchen-quote-workshop.mjs`: **8 groups**, actual workshop router with parsed DOM events, Arabic raw inputs, multi-field preview, cancel, local/project history, explicit save, two customer versions, all existing approval gates, direct save retry, read-only/revoked/stale sources, saved/draft/corner-only reports, and stale async report suppression.
- `tools/check-kitchen-report-preview.mjs`: identical report content for embedded preview and downloadable HTML; preview-local fragment base; script-disabled sandbox; print handler, Escape, resource cleanup and focus return.
- [bundle.log](bundle.log): browser JS bundle and quote CSS parsed successfully with esbuild.
- [verify-export.mjs](verify-export.mjs) passed against the **actual browser download**, not the in-memory test fixture. Results in [export-verification.json](export-verification.json).

The final full suite ran after the report embedding fix. A later CSS specificity adjustment only increased the numerical field/search target sizes; CSS and JS bundling passed again, and actual browser measurement confirmed a 56.3px price input with 22px text.

## Actual browser journey

Local URL: `http://127.0.0.1:8765/index.html?panel=workshop&step=quote`, in-app browser. A synthetic independent project was imported through the normal project-file UI. The previous finish project was preserved in the application's saved projects.

Project: **اختبار عرض التكلفة — رحلة الحفظ وموافقة العميل**, ID `K-71756F7465537475`, five units. [Input archive](input-project.json) has test measurements, prices and factory evidence; it has no initial structure/customer/release approvals. These are not real customer approvals or market price assertions.

| Step | Observed result |
|---|---|
| Import and open | Quote 1,060 SAR; material value/new purchases 890 SAR; structure gate shown |
| Follow structure gate | Existing structure page accepted the explicit test approver and opened finish |
| Finish → quote, select U1 then BODY-6 | Exact unit/material relationship and three piece rows for the selected unit; price 100 SAR |
| Enter Arabic `١٢٥` | Preview total 1,160, material value 990, full offer delta +100; live document not saved |
| Local undo / redo | Total returned to 1,060 and then 1,160; field text restored correctly |
| Select delivery, enter `٤٠` | Both edits retained together; preview total 1,180 and delta +120 |
| Save; project undo / redo | Saved 1,180; project history restored 1,060 then 1,180; reload retained 1,180 |
| Customer approval V1 | Actual sign page recorded test customer version 1 at 1,180 |
| Invalid delivery `-1` | Error shown and save disabled |
| Delivery `٦٠`, save | Total 1,200; previous customer approval became stale; geometry/structure retained |
| Attempt V2 without reason | Existing sign flow rejected the request and requested a reason |
| Enter reason, approve V2 | Version 2 recorded at 1,200; version 1 retained at 1,180 |
| Empty delivery preview | Total became “غير محسوم”; approval disabled; cancel restored saved values |
| Pending delivery 70 then navigate to finish | Existing leave guard stopped navigation; “متابعة التعديل” retained the exact raw text |
| Cancel and export ledger CSV | Saved 1,200 and delivery 60 exported with current project/revision stamp |
| Open BODY-6 source | Actual catalog selected BODY-6 at price 125 and showed its store record awaiting approval |
| Download project | Independent archive validation confirmed current values, both customer versions and unchanged measured design |

### Report display defect found and fixed

The existing report dialog generated correct downloadable HTML, but navigating its iframe to a Blob URL was aborted by the embedded browser (`net::ERR_ABORTED`), leaving the frame at `about:blank`. It now embeds the generated HTML through `srcdoc` with the existing script-disabled sandbox, retaining Blob for download. A preview-only `<base href="about:srcdoc">` keeps section anchors inside the report.

Actual browser verification showed the full kitchen illustration, materials and **1,200 SAR** approved total. Clicking “استعرض الرسومات” navigated to `about:srcdoc#drawings` while retaining the report; returning to its cover also worked. The print control enabled after load; no physical printer or PDF-print dialog was exercised. Downloaded HTML matched the project total and approval state.

### Layout and input checks

- Desktop **1280×720**: three connected areas, readable total and price editor; document width 1280 with no page overflow.
- Tablet **900×900**: horizontal object index above adjacent cost list and 300px inspector; document width 900 with no page overflow.
- Resize to **390×844** while editing: raw input and candidate total retained; editing to 75 showed saved 1,200 → preview 1,215. Document width 390, no page overflow. The numerical field measured 56.3px high after the final CSS fix.
- **Cold phone entry** still uses the existing application-wide “مساحة الرسم مصمّمة للتابلت والكمبيوتر” gate. The responsive check above covers an already-open workspace resized to phone width; it does not claim this gate was removed.
- Temporary viewport and cache overrides were reset. Final browser state: **saved**, BODY-6 selected at 125, total 1,200, customer approval current, no pending price draft. See [final-ui-state.json](final-ui-state.json).
- [browser-console.json](browser-console.json): no recorded console warnings/errors during the checked session. This is distinct from the separately observed iframe navigation abort that was repaired.

## Saved evidence

- [Desktop workspace](desktop.png), [tablet preview](tablet-preview.png), [phone preview](phone-preview.png), [cold phone entry](phone-entry.png).
- [Customer version 2](customer-v2.png), [rendered customer report](customer-report.png), [downloaded HTML](customer-report.html), [cost CSV](customer-cost.csv).
- [Actual exported project](project-export.json), [independent verification](export-verification.json), [final DOM](final-dom.txt), [source hashes](source-hashes.json).

The exported project has structure/customer approvals valid and manufacturing release false. The modified store/pricing records remain unapproved; the unchanged factory recipe approval remains valid. No manufacturing release or supplier purchase was performed.

This evidence establishes automated behavior, actual local browser interactions and observed layout. It does **not** establish a human empirical usability study, participant completion-time improvements, a production deployment, or real customer/commercial acceptance.
