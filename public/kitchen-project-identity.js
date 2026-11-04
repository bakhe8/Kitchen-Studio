import {offlineDigest} from './kitchen-workshop-revision.js';

const valid=id=>typeof id==='string'&&/^K-[A-F0-9]{16}$/.test(id);
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const derived=source=>'K-'+offlineDigest(new TextEncoder().encode(canonical(source))).slice(0,16).toUpperCase();
export function newKitchenReference(){
 const bytes=crypto.getRandomValues(new Uint8Array(8));
 return 'K-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
}
export function identifiedProject(doc,{current=null,remoteId=null}={}){
 if(valid(doc.room.projectId))return doc;
 const projectId=valid(current?.room.projectId)?current.room.projectId:remoteId?derived(['site-project',remoteId]):derived(['legacy-kitchen',doc]);
 return {...doc,room:{...doc.room,projectId}};
}
// Legacy history also held whole-project replacements. Identical names or
// room sizes are insufficient evidence to join such a frame to the open job.
export function identifiedHistoryFrame(frame,current){
 if(!valid(current?.room.projectId)||valid(frame.room.projectId))return frame;
 const a=frame.room,b=current.room;
 const surveyedRoom=r=>({name:r.name,width:r.width,length:r.length,height:r.height,architecture:r.architecture,chains:r.workshop?.chains});
 const sharedSurvey=Object.values(a.workshop?.chains||{}).some(c=>c.rows?.length)&&canonical(surveyedRoom(a))===canonical(surveyedRoom(b));
 const withoutId={...b};delete withoutId.projectId;
 const sameSnapshot=canonical([a,frame.kitchen])===canonical([withoutId,current.kitchen]);
 return identifiedProject(frame,{current:sharedSurvey||sameSnapshot?current:null});
}
