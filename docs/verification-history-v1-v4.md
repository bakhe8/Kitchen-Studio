# Historical verification: versions 1–4

These are retained observations of earlier releases. Version 4 expanded the input scope beyond the user’s intended single mouse button. Its modifier example and device-extension catalog are no longer part of the active lab. The former 69/69 figure described references in that catalog; it did not establish completeness of one-button possibilities. Current scope and verification are in the root README.

## Completion update: observed browser checks

The following checks were performed in the managed local browser preview for the four-example completion update. The source also passes `tools/check-catalog.mjs`, which validates all 36 lesson links, all ten routes, every core facet reference and the exclusion of hardware extensions from core coverage.

| Changed area | Observed result |
| --- | --- |
| Actual modifier key | ArrowDown started a preview at `(20,17)` from committed `(20,12)`. `Shift+Enter` committed `(20,12)` while preserving raw `(20,17)` and recording the lock used. Escape after a later preview restored the last commit. |
| Modifier guide | Guided playback ended raw `(72,33)`, output/commit `(72,12)`, with the visible latch enabled. |
| Magnet guide | One input `(62,16)` produced free `(62,16)`, grid `(60,20)` and proximity `(68,20)`. |
| Native drag after guide | A real drag to `(84,33)` cleared proximity capture, kept free/magnet `(84,33)`, rounded grid to `(80,40)`, and ended with no pending preview. This verified the fix for a click-delegation collision discovered during QA. |
| Accepted-state history | Two accepted placements produced cursor2/three snapshots. Native dropping on the obstacle preserved `(680,190)` and the three snapshots. Canceling a later preview then undoing restored `(300,90)` at cursor1; reset returned `(170,160)` and a single initial snapshot. |
| History guide / redo | Guided playback produced `(300,90)` at cursor1 with a new redo branch. Redo restored `(700,85)`. |
| Deletion and exact restoration | The guide removed A-01 and retained B-02/C-03. Undo restored A-01 first at `(190,225)` in both model and DOM order. A subsequent native drag of that card onto the deletion target removed it again. |
| Learning routes | The constraints route opened compare-constraint, next moved to magnet, and route navigation transferred keyboard focus to the current step. |
| Taxonomy / lesson navigation | Selecting the modifier input facet returned one example and left the route. Its lesson comparison opened relations and focused the experiment. The delete facet in coverage opened the working delete example. |
| Catalog coverage | The UI displayed 69/69 core values, zero gaps, three hardware extensions; the catalog check found 36 lessons and ten routes covering all examples. |
| Narrow viewport | At iframe width390/client375, scroll width was375 with no horizontal overflow. All six profile cards, all three lesson sections and the three comparison outputs remained present; the library started collapsed. Keyboard input committed `(25,12)` with corresponding free/grid/proximity outputs. The rendered narrow layout was visually inspected. |
| Interrupted playback | Switching from the running magnet guide to modifier retained modifier's ready state and message, with no late feedback from the old instance. No application-origin errors/warnings were found in the captured logs. |

Focused state/math checks independently covered history branching, redo invalidation, snapshot isolation, identity-preserving deletion recovery, origin-relative locking, inclusive proximity radius and its outside edge. They supplement the browser observations; they do not claim physical touchscreen or pen testing.

## Verification of the earlier 32-example explorer

The records below distinguish browser observations from source and logic checks for the previous 32-example release, which was published as version 3. They remain historical evidence; they are not claims that every unchanged interaction was re-tested during the four-example completion update.

### Confirmed browser observations

| Area | Result observed by the integration owner in the local browser preview |
| --- | --- |
| Catalog and profile | The unfiltered list contained **32 entries**. The selected example showed **six profile cards**; explanations are collapsed initially, and opening a card revealed its actual details and tags. |
| Timing explanation | The timing profile explained partial cancellation rather than promising to undo an immediate effect. |
| `compare-commit` | Starting at **A = 30 / B = 30**, a keyboard change to **40** followed by **Escape** left **A = 40 / B = 30**, matching the immediate-versus-deferred contract. |
| `compare-threshold` | Automatic playback crossed the threshold and then released at **40**: the crossing event remained recorded, while the release test was **false**. |
| `compare-rate` | Playback ended at **A = 50 / B = 91.2**, with speed **0**. The direct position returned to the centered input while the accumulated position remained. |
| `compare-path` | Both routes ended at **(88, 50)**. Their measured lengths were **76** and **117.7** display units. |
| `compare-constraint` | Shared input **(53, 67)** produced free position **(53, 67)** and grid-rounded position **(60, 60)**. |
| `turns` | Playback produced **450° accumulated rotation**, a current angle of **90°**, and **1 completed turn**. |
| `dwell` | The folder opened during the hold, and the subsequent drop placed the item in **designs** (`opened = true`, `location = designs`). |
| `relations` — copy | The source retained **A-01** while the target contained **B-01 and A-02**, demonstrating a new identity for the copy. |
| `relations` — link | The source **A-01** and target **B-01** remained in place, and the relation **A-01:B-01** was added. |
| `lasso` | Playback selected **1, 2 and 3**. A manually drawn invalid straight line was rejected and preserved that selection. |
| `group` | A manual drop at offset **300** was rejected and restored offset **0**. A subsequent manual drop at offset **500** was accepted, placing the three items at **(610, 68)**, **(742, 103)** and **(653, 202)**. |

### Confirmed filter and coverage journeys

| Journey | Result observed in the local browser preview |
| --- | --- |
| Combined facets | Selecting **`input.path` + `timing.release`** returned exactly **4 examples**: `compare-path`, `lasso`, `gesture` and `path`. |
| Empty state and recovery | Adding the unrepresented **`effect.delete`** value reduced the result to **0**. Clearing the filters restored all **32** entries. |
| Computed coverage | The interface showed **65 / 69 core values directly represented**, **4 core gaps** and **3 device extensions**. These counts describe the declared catalog. |
| Gap details | Opening the modifier-input gap displayed its definition and a proposal for a future example. |
| Coverage to example | Following the example link from **`input.turns`** opened the **`turns`** experiment. |
| Comparison view | The comparison view listed **7 entries**, including the five new paired comparisons. |
| Retained deep link | The old **`#value`** URL mounted the quantity example with **six profile layers**. |

### Current narrow viewport and lifecycle check

The rebuilt explorer was checked in a **390px iframe**, with a document client width of **375px** and scroll width of **375px**: no horizontal document overflow was observed in this view. All **six profile layers** were present, and the example library was collapsed initially. A screenshot review confirmed that the displayed controls remained usable at this width.

After starting automatic playback, switching to **`compare-rate`** left the newly mounted example in its **ready** state. In the observed keyboard check, **Right Arrow followed by Enter** ended at **A = 50 / B = 50.2**, with speed **0**. No updates from the previous example appeared after the switch.

No application console warnings or errors were observed in the preview logs filtered to `terminal.local` during these checks. These observations cover the tested journeys, not every possible interaction sequence.

### Source and logic checks

The final **`node tools/check-catalog.mjs`** run passed, as did syntax checks for **six source files** and the final diff/whitespace check. The reported catalog totals were **32 examples, 6 axes and 72 descriptive values**: **69 core**, of which **65 are directly represented** and **4 are gaps**, plus **3 device extensions**.

Component agents separately checked the contrast logic with coarse animation-frame timing and cancellation, and checked the extension geometry and state rules for lasso selection, accumulated turns and group movement. These are **source/logic checks, not browser tests**. The back/forward cache (BFCache) lifecycle correction received source review; restoration from that cache was **not browser-tested**. No test on a physical touchscreen or pen device is claimed.

### Delivery status

Verification is complete for the recorded scope. Preparing the delivery proof images and package, then publishing the update to the same owner-private Site, remains the final delivery step.

## Retained verification: earlier 22-example release

These observations are the historical record of the earlier 22-example release. They are retained without implying that all those interactions have been repeated after the explorer rebuild.

### Original ten examples

Browser checks on the local Sites preview confirmed the following original behaviours. This record is retained separately from the checks on the new examples:

1. Valid equipment placement and rejection of placement in the aisle.
2. Map panning and the viewport indicator.
3. A marquee selecting six equipment items.
4. A 12-cell storage area and rejection of an aisle-crossing rectangle while preserving the prior area.
5. Rejection of a straight route through an obstacle and a valid route using the alternate route control.
6. Resizing to 320 × 160 display units and rotation to 90 degrees.
7. A quantity of 32 with its illustrative total of 192.
8. Moving the first task to fourth place, with actual DOM order updated.
9. Two boxes moved to the shelf; a third rejected with the total conserved at three.
10. Worker assignment and rejection by a full shop while preserving the previous assignment.

The original responsive assignment layout and drag also passed in a 390px iframe viewport. Continuous freehand path collision and cancellation behaviour received source review. JavaScript syntax was checked with Node.

### Twelve earlier additions: observed browser results

| Example | Result observed in the local browser preview |
| --- | --- |
| `signals` | The shared input produced a position of **65%**, an angle of **49°** and a displayed time of **15:45**. |
| `chain` | Delivery completed with **2 boxes in the warehouse + 0 in transit + 1 in the shop = 3**. |
| `reveal` | The divider displayed **42% before / 58% after**, using aligned layers of the same storefront. |
| `momentum` | After the latest correction, the same **71-unit** drag distance produced a slow release of **68 display units/s** and a fast release of **285 display units/s**. |
| `repeat` | Increasing the extent produced **10 actual fence-segment DOM elements**. |
| `brush` | Automatic playback cleaned **15/15** patches; a manual pass cleaned **6/15**. |
| `mix` | Combining **1 + 1 inputs** produced the combined product. |
| `timeline` | Scrubbing from **14:00 back to 08:00** restored the earlier snapshot; the time-dependent state is reversible. |
| `elastic` | The displaced element returned to **0 displacement** after release. |
| `gesture` | Both the **circle** and **Z** gestures were accepted; a **straight line** was rejected. |
| `threshold` | Release at **63%** was rejected; reaching **100%** opened the illustrative shop. |
| `flow` | The observed completed run ended at **0°**, a flow rate of **0** and a displayed duration of **2.0 seconds**. That run showed **57.3 units in the source + 42.7 in the cup = 100**. These transferred amounts are an observed snapshot, not a fixed expected result: they depend on how long the vessel remains tilted. |

### Earlier narrow viewport check

The expanded `signals` example was checked in a **390px iframe**. Its document client width was **375px** because of scrollbars, and its scroll width was also **375px**, confirming no horizontal document overflow in that checked view. The three comparison cards stacked vertically at **303px** wide. The arrow control changed the shared input from **35 to 36**, updating the displayed angle to **27°** and time to **12:15**.

Navigation back to the original `basic` group and its `value` experiment was also checked: the existing quantity control appeared. This confirms navigation and rendering in that check; it does not claim that every original interaction was repeated on the narrow viewport. The earlier 390px assignment result above remains a separate record of the original assignment check.

Browser viewport checks are not tests on a physical touchscreen device. The implementation status and observed browser results above do not imply physical-device, performance or real-game validation.
