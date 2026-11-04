// Older room samples stored a complete layout without tagging its source.
// Only offer removal for an exact shipped layout with no project design work.
import {localRoomPresets,makeFurnishedSaudiRoom} from './kitchen-room-presets.js';

const originals=new Map();
const siteData=new Set(['activeWall','chains','wallPairs','wallProfiles','surfaces3d','options']);
const furniture=k=>JSON.stringify([k.runs,k.units],(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?
 Object.fromEntries(Object.keys(v).sort().map(key=>[key,v[key]])):v);

export function hasLegacySampleLayout(doc){
 const {room,kitchen}=doc;
 if(!kitchen.units.length||!kitchen.runs.length)return false;
 const sample=localRoomPresets.find(s=>s.name===room.name);
 if(!sample||Object.keys(room.workshop||{}).some(key=>!siteData.has(key)))return false;
 let original=originals.get(sample.id);
 if(!original){
  const ref=makeFurnishedSaudiRoom(sample.id);
  original={room:ref.room,layout:furniture(ref.kitchen),anchors:ref.kitchen.features.filter(f=>['entry-door','extract'].includes(f.id))};
  originals.set(sample.id,original);
 }
 if(['width','length','height'].some(k=>room[k]!==original.room[k])||
   !original.anchors.every(a=>kitchen.features.some(f=>f.id===a.id&&f.wall===a.wall&&f.kind===a.kind))||
   furniture(kitchen)!==original.layout)return false;
 // A field record or project override can refer to one of the sample units
 // even before a factory row exists. Keep that link in place.
 return !/set-(?:unit-\d+|row-\d+|island)/.test(JSON.stringify([room.workshop,room.fieldRegister,room.defaults?.overrides]));
}
