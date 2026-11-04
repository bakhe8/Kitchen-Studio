import {inheritedName} from './kitchen-safe-keys.js';
const n=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
const text=(v,len)=>typeof v==='string'&&v.trim()&&v.length<=len;
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v)&&!inheritedName(v)&&!['__proto__','prototype','constructor'].includes(v);
const bayID=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}#[1-8]$/.test(v)&&!inheritedName(v);
const dim=v=>Array.isArray(v)&&v.length===3&&v.every(x=>n(x,1,3000));
export function cleanDrawerPack(raw){
 if(!raw||!Array.isArray(raw.bays)||raw.bays.length>64||!Array.isArray(raw.groups)||raw.groups.length>40)return null;
 const bays=[],groups=[],seen=new Set();let total=0;
 for(const b of raw.bays){
  if(!b||!bayID(b.id)||seen.has(b.id)||!dim(b.size)||!dim(b.entry)||b.entryAt!=null&&(!Array.isArray(b.entryAt)||b.entryAt.length!==2||b.entryAt.some(v=>!n(v,-3000,3000)))||!text(b.reference,180)||typeof b.allowAuto!=='boolean'||!text(b.basis,180))return null;
  seen.add(b.id);bays.push({id:b.id,size:[...b.size],entry:[...b.entry],...(b.entryAt?{entryAt:[...b.entryAt]}:{}),reference:b.reference.trim(),basis:b.basis,allowAuto:b.allowAuto});
 }
 seen.clear();
 for(const g of raw.groups){
  if(!g||!id(g.id)||seen.has(g.id)||!text(g.name,100)||!dim(g.size)||!n(g.massKg,.001,500)||!Number.isInteger(g.count)||!n(g.count,1,80)||['rotate','stack','together'].some(k=>typeof g[k]!=='boolean')||g.fixed&&!bayID(g.fixed))return null;
  total+=g.count;if(total>80)return null;
  seen.add(g.id);groups.push({id:g.id,name:g.name.trim(),size:[...g.size],count:g.count,massKg:g.massKg,rotate:g.rotate,stack:g.stack,together:g.together,...(g.fixed?{fixed:g.fixed}:{})});
 }
 const pack={bays,groups};
 if(raw.accepted!=null){
  const a=raw.accepted;if(!a||!text(a.reference,180)||!/^pack-[0-9a-f]{64}$/.test(a.basis)||!Array.isArray(a.slots)||a.slots.length>80)return null;
  const keys=new Set(),slots=[];
  for(const p of a.slots){
   if(!p||!id(p.group)||!Number.isInteger(p.index)||!n(p.index,1,80)||!bayID(p.bay)||typeof p.turn!=='boolean'||!Array.isArray(p.at)||p.at.length!==3||p.at.some(x=>!n(x,0,3000))||keys.has(p.group+'#'+p.index))return null;
   keys.add(p.group+'#'+p.index);slots.push({group:p.group,index:p.index,bay:p.bay,at:[...p.at],turn:p.turn});
  }
  pack.accepted={basis:a.basis,reference:a.reference.trim(),slots};
 }
 return pack;
}
export function packMasses(pack,slots=pack?.accepted?.slots||[]){
 const out=new Map();for(const p of slots){const g=pack?.groups.find(g=>g.id===p.group);if(g)out.set(p.bay,(out.get(p.bay)||0)+g.massKg);}
 return out;
}
