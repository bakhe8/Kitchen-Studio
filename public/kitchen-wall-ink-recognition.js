import {assistNumber} from './kitchen-measurement-identity.js';

// Screen recognition only. This suggestion can be changed before any reading is recorded.
export function suggestWallOpening(start,end,heightMm){
 const bottom=Math.min(start?.zMm,end?.zMm);
 const floorBand=Number.isFinite(heightMm)?Math.min(120,Math.max(0,heightMm)*.035):0;
 return Number.isFinite(bottom)&&bottom<=floorBand?'door':'window';
}

// Two or more values in the displayed order. Arabic thousands grouping stays
// inside a number. Reject unrecognized tokens rather than subtracting or inferring units.
export function parseWallInkDimensions(text,fields){
 if(typeof text!=='string'||!Array.isArray(fields)||fields.length<2||fields.length>5||text.length>100)return null;
 const tokens=text.trim().split(/(?:\s+|\s*[×xX/؛،]\s*)/u).filter(Boolean);
 if(tokens.length<2||tokens.length>fields.length)return null;
 const pairs=tokens.map((token,i)=>[fields[i],assistNumber(token)]);
 if(pairs.some(([key,value])=>!['gapMm','widthMm','bottomMm','heightMm','depthMm'].includes(key)||!Number.isFinite(value)||value<0))return null;
 return Object.fromEntries(pairs);
}
