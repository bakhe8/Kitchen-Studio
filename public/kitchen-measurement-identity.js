import {ownKey} from './kitchen-safe-keys.js';
export const assistFold=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
const digitize=v=>String(v??'').trim().replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<'۰'?0x660:0x6f0))).replace(/٫/g,'.').replace(/−/g,'-');
export function assistNumber(v){if(typeof v==='number')return Number.isFinite(v)?v:null;const s=digitize(v);if(!/^[+-]?(?:(?:\d{1,3}(?:[٬,]\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/.test(s))return null;const n=Number(s.replace(/[٬,]/g,''));return Number.isFinite(n)?n:null;}
const unitSets=[['length',{مم:1,ملم:1,مليمتر:1,ملليمتر:1,'ملي متر':1,mm:1,سم:10,سنتيمتر:10,cm:10,م:1000,متر:1000,m:1000}],['weight',{كغ:1,كجم:1,كيلوجرام:1,'كيلو جرام':1,kg:1,غ:.001,جم:.001,جرام:.001,g:.001}],['volume',{لتر:1,ل:1,l:1,مل:.001,ml:.001}]];
const unitKey=s=>assistFold(s).replace(/\.$/,'');
function unitInfo(v){const key=unitKey(v);for(const [type,table] of unitSets)if(ownKey(table,key))return [type,table[key]];return ['unit:'+key,1];}
export function convertAssistUnit(v,from,to){if(!Number.isFinite(v))return null;const [a,m]=unitInfo(from),[b,n]=unitInfo(to);return a===b?Number((v*m/n).toPrecision(13)):null;}
export const stableHash=s=>{let a=2166136261,b=5381;for(let i=0;i<s.length;i++){const n=s.charCodeAt(i);a=Math.imul(a^n,16777619);b=Math.imul(b,33)^n;}return [a,b].map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');};
export const measurementBaseline=rows=>stableHash(JSON.stringify(rows.map(r=>[r.id,r.value,r.unit,r.valueType,r.verification,r.execution,r.revision,r.source,r.location,r.date,r.readingRef||'',r.property,r.notes]).sort((a,b)=>a[0].localeCompare(b[0]))));
