// The same self-contained stylesheet is used in preview, download and print.
// Self-contained export snapshot; completion gate enforces exact parity with the central root.
export const designExportTokens = `:root{
  color-scheme:light;
  --ks-canvas:#f3f6f4;
  --ks-surface-1:#fffefb;
  --ks-surface-2:#f7f9f7;
  --ks-surface-inset:#edf2ef;
  --ks-ink-strong:#132f3b;
  --ks-ink:#28434d;
  --ks-ink-muted:#53666c;
  --ks-line:#d5dedb;
  --ks-line-strong:#a9bab7;
  --ks-action:#0f766e;
  --ks-action-hover:#0b625c;
  --ks-action-pressed:#084f4b;
  --ks-action-soft:#e3f2ee;
  --ks-complete:#287a50;
  --ks-complete-soft:#e8f4ec;
  --ks-attention:#94540f;
  --ks-attention-soft:#fff4dd;
  --ks-danger:#b33a32;
  --ks-danger-soft:#fff0ed;
  --ks-info:#366b82;
  --ks-info-soft:#eaf3f7;
  --ks-focus-ring:#167d8c;
  --ks-focus-ring-dark:#55c8d4;
  --ks-metal:#b5976d;
  --ks-space-1:4px;
  --ks-space-2:8px;
  --ks-space-3:12px;
  --ks-space-4:16px;
  --ks-space-5:24px;
  --ks-space-6:32px;
  --ks-radius-control:9px;
  --ks-radius-group:11px;
  --ks-radius-surface:15px;
  --ks-radius-overlay:16px;
  --ks-border:1px solid var(--ks-line);
  --ks-shadow-surface:0 10px 28px #17384312;
  --ks-shadow-overlay:0 18px 48px #122e3a2b;
  --ks-duration-fast:140ms;
  --ks-duration-panel:200ms;
  --ks-ease:cubic-bezier(.2,.8,.2,1);
  --ks-target:44px;
  --ks-font-ui:Tahoma,Arial,sans-serif;
  --ks-z-sticky:40;
  --ks-z-popover:200;
  --ks-z-dialog:400;
  --ks-z-toast:500;
  --ks-z-photo:1200;
  --ks-z-skip:1300;
  --ks-radius-structural:4px;
  --ks-radius-route-corner:0 0 0 var(--ks-radius-structural);
  --ks-radius-chip:999px;
  --ks-print-paper:#fff;
  --ks-print-ink:#000;
  --ks-shadow-dimension-halo:0 0 2px var(--ks-print-paper),0 0 2px var(--ks-print-paper);
  --ks-shadow-sample:inset 0 -5px #0000000f;
  --ks-radius-circle:50%;
  --ks-scrim:#132f3be6;
  --ks-photo-surface:#132f3b;
  --ks-on-dark:#fffefb;
  --ks-on-dark-muted:#d5dedb;
  --ks-shadow-selected:inset 0 0 0 2px var(--ks-action);
  --ks-shadow-mark:inset 0 0 0 3px var(--ks-ink);
  --ks-shadow-swatch:0 4px 3px #524d3933;
  --ks-filter-pick:drop-shadow(0 0 2px var(--ks-action));
  --ks-font-display:28px;
  --ks-font-title:22px;
  --ks-font-section:18px;
  --ks-font-body:14px;
  --ks-font-meta:12px;
  --ks-line-height:1.6;
  --ks-gap-control:var(--ks-space-2);
  --ks-pad-panel:var(--ks-space-4);
  --ks-gutter-workspace:var(--ks-space-5);
  --ks-density-field:var(--ks-space-4);
  --ks-density-studio:var(--ks-space-3);
  --ks-density-factory:var(--ks-space-2);
  --ks-density-presentation:var(--ks-space-5);
}`;
export const customerSheetStyle = designExportTokens + `
*{box-sizing:border-box}
:root{color-scheme:light;--ink:var(--ks-ink);--muted:var(--ks-ink-muted);--line:var(--ks-line);--forest:var(--ks-action);--warm:var(--ks-ink-strong);--paper:var(--ks-print-paper)}
html{background:var(--ks-surface-1);color:var(--ink);font:16px/1.65 Tahoma,Arial,sans-serif}
body{max-width:1280px;background:var(--paper);margin:0 auto;min-height:100vh}
main,footer,.mast{padding-inline:clamp(20px,4.5vw,70px)}
@media screen{.in-preview body{max-width:none;margin:0}.in-preview :is(main,footer,.mast){padding-inline:clamp(12px,1.5vw,28px)}}
a{color:inherit;text-underline-offset:4px}button,summary,.views label{font:inherit;cursor:pointer}
:focus-visible{outline:3px solid var(--ks-focus-ring);outline-offset:2px}h1,h2,h3,p,figure,dl,dd{margin:0}bdi{font-variant-numeric:tabular-nums}
.mast{min-height:70px;display:flex;align-items:center;gap:24px;border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:9px;font-weight:700;white-space:nowrap}.brand svg{flex:none}
.mast nav{display:flex;align-items:center;gap:18px;border-inline-start:1px solid var(--line);padding-inline-start:20px}
.mast nav a{display:inline-flex;align-items:center;min-height:44px;text-decoration:none;font-size:14px;color:var(--muted)}.mast nav a:hover{text-decoration:underline}
.print{margin-inline-start:auto;color:var(--forest);background:transparent;border:1px solid var(--ks-line);border-radius:var(--ks-radius-control);min-height:44px;padding:6px 14px;font-weight:700}.in-preview .print{display:none}
.cover{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(235px,.9fr);border:1px solid var(--line);margin-block:clamp(16px,2.7vw,36px) 0;scroll-margin-block:12px}
.cover-copy{display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:14px;padding:clamp(18px,2.6vw,38px);background:var(--ks-surface-1);min-width:0}
.kicker{display:flex;align-items:center;gap:9px;color:var(--warm);font-size:12px;font-weight:700}.kicker i{height:2px;width:26px;background:var(--ks-surface-inset)}
h1{font-size:clamp(24px,3.1vw,43px);line-height:1.28;letter-spacing:-.025em;overflow-wrap:anywhere}
.state{font-size:13px;line-height:1.6;color:var(--muted)}.state strong{color:var(--forest)}
.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding-block:12px;border-block:1px solid var(--line)}
.metrics dt,.estimate small{font-size:12px;color:var(--muted)}.metrics dd{font-size:16px;font-weight:700}
.estimate{border-inline-start:3px solid var(--ks-line);padding-inline-start:12px;display:grid;gap:2px}.estimate strong{font-size:clamp(17px,1.65vw,24px);line-height:1.35;color:var(--forest)}.estimate span{font-size:12px;color:var(--muted)}
.jump{min-height:44px;align-self:flex-start;display:flex;align-items:center;gap:12px;color:var(--forest);font-size:14px;font-weight:700}.jump span{font-size:17px}
.visual{min-width:0;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;background:var(--ks-surface-1);border-inline-end:1px solid var(--line)}
.visual-head,.visual-foot,.sheet-line{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 16px}
.visual-head span{font-size:13px;font-weight:700}.visual-head small,.visual-foot,.sheet-line{font-size:11px;color:var(--ks-ink)}
.visual-head small{max-width:70%;text-align:end}.visual-foot{border-top:1px solid var(--ks-line)}.visual-foot bdi,.sheet-line bdi,.folio-id bdi,footer bdi{font-family:ui-monospace,monospace;letter-spacing:.025em}
.scene{display:grid;place-items:center;flex:auto;min-height:225px}
.scene svg{display:block;width:100%;height:clamp(245px,27vw,385px)}
.folio-id{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-block:8px 0;color:var(--muted);font-size:12px}
.book-section,.review{margin-block-start:clamp(25px,3vw,42px);scroll-margin-block:12px}
.section-title{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.section-title>span{font-size:15px;font-weight:700;color:var(--warm);border-inline-end:1px solid var(--ks-line);padding-inline-end:12px}
.section-title h2{font-size:clamp(19px,2.1vw,26px);line-height:1.4}.section-title small{color:var(--muted);margin-inline-start:auto}
.scope,.chosen{font-size:14px;color:var(--muted);margin-block:6px 10px}
.gallery{position:relative;border:1px solid var(--line);background:var(--ks-on-dark);overflow:hidden}
.gallery input{position:absolute;inline-size:1px;block-size:1px;clip-path:inset(50%);white-space:nowrap}
.views{display:flex;align-items:stretch;flex-wrap:wrap;gap:5px;padding:7px 11px;background:var(--ks-action-soft);border-bottom:1px solid var(--line)}
.views label,.views a{display:inline-flex;align-items:center;justify-content:center;padding:6px 13px;min-height:44px;border:1px solid transparent;border-radius:var(--ks-radius-control);color:var(--ks-action);font-size:14px;font-weight:700}
.views label:hover,.views a:hover{background:var(--ks-action-soft)}.views a{margin-inline-start:auto}
.view-panel{display:none}.view-panel h2{font-size:16px;padding:11px 16px 0;color:var(--forest)}
.view-panel figure{min-width:0;padding:5px 12px}.view-panel svg{display:block;width:100%;height:clamp(275px,39vw,495px)}figcaption{font-size:12px;color:var(--muted);padding:0 5px 5px}
.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.two svg{height:clamp(200px,23vw,330px)}
.sheet-line{border-top:1px solid var(--line);background:var(--ks-surface-1);flex-wrap:wrap}
.materials{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,205px),1fr));border-block:1px solid var(--line)}
.material{display:flex;gap:12px;align-items:center;padding:13px 8px;min-width:0;border-bottom:1px solid var(--ks-line)}
.chip{width:38px;height:49px;flex:none;background:var(--swatch,var(--ks-surface-1));border:1px solid var(--ks-line);box-shadow:var(--ks-shadow-sample);border-radius:var(--ks-radius-control)}
.chip[data-unset]{background:repeating-linear-gradient(-45deg,var(--ks-on-dark) 0 4px,var(--ks-surface-1) 5px 6px)}
.material div{min-width:0}.material :is(small,strong,span){display:block;overflow-wrap:anywhere}.material small,.material span,.empty{font-size:12px;color:var(--muted)}.material strong{font-size:15px}
details{border-bottom:1px solid var(--line)}summary{min-height:47px;padding-block:11px;font-weight:700;color:var(--ks-ink)}details>div{padding:0 4px 13px}
.wp-scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:start;padding:8px;border-bottom:1px solid var(--ks-line)}th{color:var(--forest);background:var(--ks-surface-1)}
ul{margin:2px 0;padding-inline-start:1.3em}li{margin-block:2px}h3{font-size:16px}.review{border-top:2px solid var(--ks-line);padding-top:13px}.review-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,245px),1fr));gap:16px}.review-grid h3{margin-bottom:5px}.review-grid li::marker{color:var(--ks-ink-muted)}
.change-note{margin-top:18px;border-inline-start:2px solid var(--ks-line);padding-inline-start:13px}.change-note p{margin-top:4px}
footer{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:30px;border-top:1px solid var(--line);padding-block:15px 24px;font-size:12px;color:var(--muted)}footer bdi{margin-inline-start:auto}footer strong{color:var(--forest)}
@media(max-width:780px){.mast{gap:13px;min-height:60px}.mast nav{gap:10px;padding-inline-start:12px}.cover{grid-template-columns:minmax(0,1.3fr) minmax(225px,1fr)}.cover-copy{padding:16px;gap:10px}.metrics{gap:4px}.visual-head,.visual-foot{padding-inline:9px}}
@media(max-width:620px){main,.mast,footer{padding-inline:15px}.mast nav{display:none}.cover{grid-template-columns:minmax(0,1fr)}.cover-copy{order:-1;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 10px}.cover-copy :is(.kicker,h1,.state,.metrics){grid-column:1/-1}.cover-copy .estimate{margin-top:6px}.cover-copy .jump{margin-block:auto}.visual{border:0;border-top:1px solid var(--line)}.scene svg{height:260px}.views label,.views a{padding:6px 8px}.two{grid-template-columns:minmax(0,1fr)}.two svg{height:230px}.view-panel svg{height:295px}.folio-id{font-size:11px;gap:6px}}
@media print{
 @page{size:A4 landscape;margin:12mm}
 html,body{background:var(--ks-print-paper);color:var(--ks-ink);font-size:11pt;max-width:none}
 main,footer,.mast{padding-inline:0}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}
 .mast{min-height:12mm}.mast nav,.mast .print,.jump,.views,.gallery input{display:none!important}
 .cover{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(0,1fr);margin-top:6mm;break-inside:avoid}
 .cover-copy{display:flex;order:0;padding:6mm;gap:3mm}.scene svg{height:93mm}.visual{border-inline-end:1px solid var(--line)}
 .metrics{padding-block:3mm}.folio-id{padding-top:3mm}
 .sheets{break-before:page;margin-top:0}.gallery{border:0;overflow:visible}.view-panel{display:block!important;break-inside:avoid;border:1px solid var(--line)}
 .view-panel+.view-panel{break-before:page}.view-panel svg{height:110mm}.view-panel .two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.view-panel .two svg{height:92mm}
 .wp-scroll{overflow:visible}details{break-inside:auto}details::details-content{display:contents;content-visibility:visible}summary,h2,h3,figcaption{break-after:avoid}
 tr,.material,.estimate,figure{break-inside:avoid}thead{display:table-header-group}
 .book-section:not(.sheets),.review{margin-top:6mm}.materials{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}footer{padding-block:4mm;margin-top:5mm}
}
:is(button,a,summary,.views label){min-block-size:var(--ks-target);min-inline-size:var(--ks-target)}
:is(button,a,summary,.views label):focus-visible{outline:3px solid var(--ks-focus-ring);outline-offset:2px}
@media(prefers-reduced-motion:reduce){*{transition:none;animation:none;scroll-behavior:auto}}
`;