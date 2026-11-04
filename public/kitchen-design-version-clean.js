// The saved shape of the design versions the customer approved (see kitchen-design-versions.js). Kept apart and light so the project
// validator can use it without loading the drawing code.
import {inheritedName} from './kitchen-safe-keys.js';
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v,max)=>typeof v==='string'&&v.length<=max;
const ident=s=>typeof s==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,70}$/.test(s)&&!inheritedName(s);
export const versionLimit=60,versionUnitLimit=400;
function cleanUnit(u){
 if(!object(u)||!ident(u.id)||!text(u.code,12)||!text(u.label,80)||!text(u.wall,40)||!['','base','upper'].includes(u.tier)||!text(u.front,80))return null;
 if(!Number.isSafeInteger(u.startMm)||Math.abs(u.startMm)>1e6||!Number.isSafeInteger(u.widthMm)||u.widthMm<0||u.widthMm>1e6)return null;
 return {id:u.id,code:u.code,label:u.label,wall:u.wall,tier:u.tier,startMm:u.startMm,widthMm:u.widthMm,front:u.front};
}
export function cleanVersions(raw){
 if(!Array.isArray(raw)||raw.length>versionLimit)return null;
 const out=[];
 for(const [i,v] of raw.entries()){
  if(!object(v)||v.n!==i+1||typeof v.date!=='string'||!Number.isFinite(Date.parse(v.date)))return null;
  if(typeof v.name!=='string'||!v.name.trim()||v.name.length>90||typeof v.key!=='string'||!/^[0-9a-f]{64}$/.test(v.key))return null;
  if(!(v.total===null||Number.isFinite(v.total)&&v.total>=0&&v.total<1e12)||!text(v.reason??'',400)||typeof v.released!=='boolean')return null;
  if(!Array.isArray(v.units)||v.units.length>versionUnitLimit)return null;
  const units=v.units.map(cleanUnit);
  if(units.some(u=>!u)||new Set(units.map(u=>u.id)).size!==units.length)return null;
  out.push({n:v.n,date:v.date,name:v.name.trim(),key:v.key,total:v.total,reason:(v.reason??'').trim(),released:v.released,units});
 }
 return out;
}
