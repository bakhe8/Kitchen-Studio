# Measured Workshop component contracts

These contracts describe source behavior. Each row still needs the browser matrix in `qa-matrix.md`; a CSS hook is not proof that every rendered state, focus order or pointer target passes.

## Anatomy and variants

| Component | Anatomy and variants | Keyboard and RTL | Density and prohibited use |
| --- | --- | --- | --- |
| Masthead/workspace identity | Persistent project identity, workspace title, route chooser and commands; dark structural header and light nested menus | Native links/buttons/details; focus ring changes with actual dark/light surface; retain Arabic previous/next wording and inline anchoring | Compact title with 44px principal controls; do not use completion color for gateway identity |
| Buttons | Label/icon, boundary, target box; primary action fill, secondary boundary, ghost, destructive and icon variants | Native activation and disabled semantics; visible 3px ring; start-aligned long labels | Compact glyphs retain a 44px box; no primary pill or color-only delete |
| Fields | Label, value, guidance, optional unit and validation; text/numeric/search/select/textarea/checkbox/radio/switch | Preserve native input gestures, labels, checked and validity semantics; numeric direction is local; no DOM reordering for RTL | Text fields reserve 44px; checkbox/radio visual glyphs can remain compact inside labeled targets; no global geometry rewrite |
| Segments/tabs | Group, destination label, selected boundary and optional icon | Reflect current `aria-pressed`, `aria-selected` or `aria-current`; tab order remains controller-owned | Selected fill plus double leading edge or underline; never indicate selection solely by green |
| Cards/work surfaces | Heading, context, body and next actions; surface/inset variants | Preserve semantic headings and native links; wrap long Arabic metadata | Group/surface radii differ by purpose; no identical pill geometry for every region |
| Notices | Message, affected context and recovery action; neutral/info/attention/danger/complete | Preserve role/status/live-region behavior already emitted by controllers | Attention uses dashed leading edge; danger double boundary; completion actual state plus label/double edge; do not invent success from neutral text |
| Rails/toolbars/menus | Tool grouping, current tool, overflow summary and anchored menu | Native details summaries and existing arrow meaning; focus must not clip behind rails | 44px targets around small technical icons; do not expand drawing geometry to enlarge tools |
| Dialog/drawer/palette/inspector | Title/action region, scrollable content and contextual controls | Preserve existing focus lifecycle and close handlers; no CSS claim of focus trapping | Overlay radius/elevation and semantic z-index; nested local canvas stacks remain isolated |
| Tables/data rows | Header, values, status, row selection and bulk actions | Row action has its own native control/focus; label selected rows as well as changing boundary | Factory density preserves scan density and target boxes; no clipped numbers or color-only stock selection |
| Save/readiness/progress | Current step, saved/version identity, readiness detail and correction path | Status text is authoritative; don't derive domain progress from CSS classes | Complete means confirmed/saved/ready, dirty/pending means attention, stale/invalid means danger |
| Drawing/dimensions/handles | Technical geometry, selected object, dimensional field and inspector linkage | Keep controller-owned hit geometry, coordinates, grips and undo; local direction applies to technical numerals | Preserve material colors and measured widths/positions; never recolor every SVG or force technical strokes into button geometry |
| Customer proposal/review | Project/customer heading, price hierarchy, decision trace and supporting diagrams | Keep explicit approval authority, source revisions, signatures and open/closed disclosure behavior | Presentation density; print strips screen chrome without hiding export content or recoloring technical art |

## State matrix

| State | Visible contract | Behavior boundary |
| --- | --- | --- |
| Rest | Purposeful shape, ink and boundary | Native hit area and existing event behavior |
| Hover | Action edge or surface feedback | No data mutation; disabled controls gain no active cue |
| Focus | 3px semantic external ring, 2px offset; dark variant where necessary | Preserve keyboard and text-input ownership |
| Pressed | Elevation collapses; translation at most 1px | Reduced motion removes translation |
| Selected/active | Action fill/boundary plus underline, double edge or existing icon/label | Follow actual ARIA/controller state |
| Entered/complete | Emphasized value; complete palette only after real confirmation | Do not infer validity from nonempty input |
| Warning/conflict | Attention surface, dashed/double edge and explanatory text | Link affected region and correction action |
| Invalid/blocked/stale | Danger surface, strong/double boundary, clear correction text | Preserve original guards and draft recovery |
| Disabled/loading | Recognizable control, no elevation; progress/status text remains readable | Existing disabled/busy state prevents duplicate action |
| Empty/offline/unknown | Neutral or information notice with a useful next step | No invented readiness or automatic retry |

Operational examples include saved-project permanent-delete confirmation, current versus changed backup status, actual maintenance ticket `data-state="closed"`, oversight readiness and actual assist warning/error message hooks. Legacy alternate state selectors remain compatible but do not replace checks against actual emitted markup.
