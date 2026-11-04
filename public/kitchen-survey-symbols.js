// Keep the survey drawing, tool palette and reading register on the same symbols.
export const surveySymbolPaths={
 pen:'M4 20l4-1L20 7l-3-3L5 16z M15 6l3 3',
 door:'M5 21V3h14v18 M8 21V6h8v15 M13 14h1',
 window:'M3 4h18v15H3z M12 4v15 M3 11h18',
 water:'M12 2S5 10 5 14a7 7 0 0 0 14 0c0-4-7-12-7-12z',
 electric:'M13 2 5 14h6l-1 8 9-13h-6z',
 drain:'M3 11h18 M5 15h14 M7 19h10 M8 4l4 4 4-4',
 gas:'M13 2c1 6-3 7-1 11 2-1 3-3 3-5 7 5 4 14-3 14S1 15 6 10c2-2 5-5 7-8z',
 vent:'M3 4h18v16H3z M6 8h12 M6 12h12 M6 16h12',
 start:'M5 21V3h14l-3 4 3 4H5',stop:'M18 21V3H4l3 4-3 4h14',corner:'M5 4v15h15 M10 13v2h3',
 column:'M8 3h8v18H8z M5 3h14 M5 21h14',beam:'M2 6h20v5H2z M4 11v5m16-5v5',shaft:'M6 3h12v18H6z M7 9l5-5m-5 12 10-10m-7 14 7-7',
 heater:'M7 4q5-3 10 0v12q-5 3-10 0z M10 18v3m4-3v3 M10 7h4'
};
export function surveySymbol(kind){
 const path=surveySymbolPaths[kind];
 return path?'<svg class="sv-type-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round"><path d="'+path+'"/></svg>':'';
}

// Both the original opening and its provisional outline offer the same grips.
export function surveySizeGrip(escapedToken,x,y,field){
 const rotation=field==='heightMm'?' rotate(90)':'';
 return `<g data-chain-hit="${escapedToken}" data-chain-focus="${field}" data-size-grip class="wsheet-grip" transform="translate(${x} ${y})${rotation}"><circle r="12" class="wsheet-hit"/><rect x="-5.8" y="-4.3" width="11.6" height="8.6" rx="2.5" class="wsheet-grip-dot"/><path d="m-1.7 -1.6-1.6 1.6 1.6 1.6m3.4 -3.2 1.6 1.6-1.6 1.6" class="wsheet-grip-arrows"/></g>`;
}
