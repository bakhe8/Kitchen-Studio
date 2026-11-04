// A group may manipulate a board where selected clear openings actually face
// one another. Two touching boxes on a hull, or two collinear boards owned by
// different partitions, do not establish such a relation.
import {scopedCells,scopedDividers,dividerReach} from './shelf-selection-model.js';

const scenes=new WeakMap(), empty=Object.freeze([]);
const faceTolerance=1e-7; // candidate search; dividerReach verifies ownership and exact face
const noise=(a,b)=>32*Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(b));
const positive=(start,end)=>end-start>noise(start,end);
const sortBySpan=(a,b)=>a.start-b.start||a.end-b.end;
const readonly=Object.freeze;

function sceneFor(plan) {
  if(!plan||typeof plan!=='object'||!plan.wall||!plan.cab)return null;
  let s=scenes.get(plan);if(s)return s;
  const cells=scopedCells(plan),groups=new Map(),index=new Map(cells.map((c,i)=>[c.key,i]));
  // Sorted face coordinates avoid an O(dividers × all leaves) render pass.
  // A cabinet's nested cuts can be collinear: this index is only a shortlist.
  const faces={};
  for(const [axis,coord,long,size,longSize] of [['col','x','y','w','h'],['row','y','x','h','w']]) {
    faces[axis]=[true,false].map(before=>cells.map(c=>({
      key:c.key,at:c[coord]+(before?c[size]:0),start:c[long],end:c[long]+c[longSize]
    })).sort((a,b)=>a.at-b.at));
  }
  const dividers=new Map(scopedDividers(plan).filter(d=>d.kind==='cabinet').map(d=>[d.id,d]));
  s={index,faces,groups,dividers,contacts:new Map()};scenes.set(plan,s);return s;
}
function selection(s,keys) {
  if(!s||!(Array.isArray(keys)||keys instanceof Set))return null;
  const ids=new Set();
  for(const key of keys) {const index=s.index.get(key);if(index===undefined)return null;ids.add(index);}
  if(ids.size<2)return null;
  const fingerprint=[...ids].sort((a,b)=>a-b).join(',');
  let g=s.groups.get(fingerprint);
  if(!g) {
    g={keys:new Set(keys),resolved:new Map(),all:null};
    if(s.groups.size>=8)s.groups.delete(s.groups.keys().next().value);
    s.groups.set(fingerprint,g);
  }
  return g;
}
function sideRuns(plan,s,d,before) {
  const v=d.axis==='col',axis0=v?d.x:d.y,long0=v?d.y:d.x,long1=long0+(v?d.h:d.w);
  const coord=axis0+(before?0:v?d.w:d.h),faces=s.faces[d.axis][before?0:1];
  let lo=0,hi=faces.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(faces[mid].at<coord-faceTolerance)lo=mid+1;else hi=mid;}
  const runs=[],expected=before?(v?'right':'bottom'):(v?'left':'top');
  for(let i=lo;i<faces.length&&faces[i].at<=coord+faceTolerance;i++) {
    const f=faces[i];
    if(!positive(Math.max(long0,f.start),Math.min(long1,f.end)))continue;
    const reach=dividerReach(plan,{kind:'cell',key:f.key},d);
    if(reach?.relation!=='boundary'||reach.side!==expected)continue;
    for(const part of reach.segments)runs.push({key:f.key,start:part.start,end:part.end});
  }
  return runs.sort(sortBySpan);
}
function contactsFor(plan,s,d) {
  if(s.contacts.has(d.id))return s.contacts.get(d.id);
  const before=sideRuns(plan,s,d,true),after=sideRuns(plan,s,d,false),contacts=[];
  // On ONE face of ONE actual board, leaf interiors are disjoint.
  for(let i=0,j=0;i<before.length&&j<after.length;) {
    const a=before[i],b=after[j],start=Math.max(a.start,b.start),end=Math.min(a.end,b.end);
    if(a.key!==b.key&&positive(start,end))contacts.push(readonly({start,end,beforeKey:a.key,afterKey:b.key}));
    if(a.end<=b.end)i++;if(b.end<=a.end)j++;
  }
  s.contacts.set(d.id,contacts);return contacts;
}
function forBoard(plan,s,g,d) {
  if(g.resolved.has(d.id))return g.resolved.get(d.id);
  const contacts=contactsFor(plan,s,d).filter(c=>g.keys.has(c.beforeKey)&&g.keys.has(c.afterKey));
  let value=null;
  if(contacts.length) {
    // Keep the gaps made by cross boards and T-junctions. Contacts retain
    // both supporting keys even if the view only needs the clipped spans.
    const segments=contacts.map(({start,end})=>readonly({start,end}));
    value=readonly({id:d.id,dividerId:d.id,owner:readonly({...d.owner}),axis:d.axis,cm:d.cm,
      segments:readonly(segments),contacts:readonly(contacts),target:readonly({kind:'cell',key:contacts[0].beforeKey})});
  }
  g.resolved.set(d.id,value);return value;
}
/** Pass an ID to query the current board, or a full descriptor to verify it
 * still matches the current position and owner. Long axis is y for columns,
 * x for rows. Invalid/stale selections fail closed. */
export function sharedSelectionReach(plan,keys,dividerOrId) {
  const s=sceneFor(plan),id=typeof dividerOrId==='string'?dividerOrId:dividerOrId?.id;
  const d=s?.dividers.get(id);if(!d)return null;
  if(typeof dividerOrId==='object'&&!dividerReach(plan,d.owner,dividerOrId))return null;
  const g=selection(s,keys);return g?forBoard(plan,s,g,d):null;
}
export function groupSharedDividers(plan,keys) {
  const s=sceneFor(plan),g=selection(s,keys);if(!g)return empty;
  if(!g.all)g.all=readonly([...s.dividers.values()].map(d=>forBoard(plan,s,g,d)).filter(Boolean));
  return g.all;
}
