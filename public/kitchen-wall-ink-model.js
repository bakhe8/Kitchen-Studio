import {ownKey} from './kitchen-safe-keys.js';
// A sketch is a provisional reading. It becomes a row only after the
// technician accepts the visible dimensions. Nothing here writes to storage.
import {architectureWall} from './kitchen-architecture.js';
import {applyChain,chainLabels,newChainRow,pointKinds,resolveChain} from './kitchen-chain-model.js';
import {assistNumber} from './kitchen-measurement-identity.js';

const mark=new Set(['start','stop','corner']);
const no=reason=>({ok:false,reason});
const roundMm=n=>Math.round(n*1e6)/1e6;
const sketchMm=n=>Math.round(n/10)*10;
const fieldsFor=kind=>mark.has(kind)?['gapMm']:pointKinds.has(kind)?['gapMm','bottomMm']:
 kind==='door'?['gapMm','widthMm','heightMm']:['gapMm','widthMm','bottomMm','heightMm'];
export const horizontalWallInkStroke=(widthMm,lowMm,highMm)=>highMm-lowMm<Math.max(40,widthMm*.12);
const validPoint=(p,W,H)=>p&&Number.isFinite(p.xMm)&&Number.isFinite(p.zMm)&&p.xMm>=0&&p.xMm<=W+.000001&&p.zMm>=0&&p.zMm<=H+.000001;
const stamp=(edge,room,chain)=>JSON.stringify([edge.id,edge.a,edge.b,edge.start,edge.end,room.height,chain]);
const rowId=rows=>{let i=1;while(rows.some(r=>r.id==='p'+i))i++;return 'p'+i;};

// Insert at a boundary where the following reading is independent. At index
// zero the old first station was already measured from the starting corner.
function insertion(rows,readings,kind,x){
 const corner=rows.findIndex(r=>r.kind==='corner');
 if(kind==='corner')return rows.length;
 const limit=corner<0?rows.length:corner;
 const candidates=[];
 for(let i=0;i<=limit;i++){
  if(i!==0&&i<rows.length&&rows[i].from!=='origin')continue;
  if(kind==='stop'&&rows.slice(i).some(r=>r.kind==='start'))continue;
  if(kind==='start'&&rows.slice(0,i).some(r=>r.kind==='stop'))continue;
  // Keep the physical walk ordered when possible, without converting a
  // genuinely measured gap into a newly derived one for an existing row.
  let inversions=0;
  if(x!=null)for(let j=0;j<readings.length;j++){
   if(j<i?readings[j].refMm>x:readings[j].refMm<x)inversions++;
  }
  candidates.push({i,inversions});
 }
 return candidates.sort((a,b)=>a.inversions-b.inversions||b.i-a.i)[0]?.i??-1;
}

// A CAD reference only joins the survey when its own review is accepted.
// Insert it at an independent datum so no earlier tape reading is reinterpreted.
export function reviewWallObject(room,wall,chain,hit){
 if(!hit.referenceId)return {ok:true,chain,index:hit.index};
 const resolved=resolveChain(room,wall,chain);
 if(!resolved.ok)return resolved;
 if(chain.rows.length>=64)return no('وصلت إلى الحد الأقصى لقياسات الجدار.');
 const row={...hit.row,id:rowId(chain.rows),gapMm:roundMm(hit.stationMm),from:'origin'};
 const index=insertion(chain.rows,resolved.readings,row.kind,hit.stationMm);
 if(index<0)return no('أكمل القياس السابق قبل إدراج هذا العنصر.');
 const rows=chain.rows.slice();
 if(index===0&&rows[0])rows[0]={...rows[0],from:'origin'};
 rows.splice(index,0,row);
 return {ok:true,chain:{...chain,rows},index};
}

export function makeWallInkProposal({room,wall,chain,kind,start,end=start,dragged,tap,typed=false}){
 if(!room||!chain||!Array.isArray(chain.rows)||!ownKey(chainLabels,kind))return no('اختر الجدار ونوع العنصر قبل الرسم.');
 const edge=architectureWall(room,wall);
 if(!edge)return no('لم يعد الجدار المحدد موجودًا.');
 if(chain.rows.length>=64)return no('وصلت إلى الحد الأقصى لقياسات الجدار.');
 if(mark.has(kind)&&chain.rows.some(r=>r.kind===kind))return no('هذه العلامة موجودة. اضغط على قياسها في الرسم لتعديله.');
 const resolved=resolveChain(room,wall,chain);
 if(!resolved.ok)return no('أكمل القياس السابق قبل إضافة عنصر. '+resolved.reason);
 const W=edge.length*10,H=room.height*10;
 if(!typed&&(!validPoint(start,W,H)||!validPoint(end,W,H)))return no('ضع القلم داخل وجه الجدار.');
 const rect=!mark.has(kind)&&!pointKinds.has(kind);
 const span=!typed&&rect&&(dragged??(tap===false));
 const station=typed||kind==='corner'?null:Math.min(W,sketchMm(span?Math.min(start.xMm,end.xMm):(end||start).xMm));
 const idx=insertion(chain.rows,resolved.readings,kind,station);
 if(idx<0)return no('ترتبط هذه العلامة بقياس مسجل. عدّل ترتيب القياسات صراحةً قبل إضافتها.');
 const prev=resolved.readings[idx-1];
 const independent=!!prev&&station!=null&&station<prev.nextMm;
 const origin=!prev||independent;
 const datumMm=origin?0:prev.nextMm;
 const row=newChainRow(kind,rowId(chain.rows));
 if(independent)row.from='origin';
 row.gapMm=station==null?null:roundMm(station-datumMm);
 const fields=fieldsFor(kind);
 let preset='drawn',inferredFields=[];
 const ref=origin?null:chain.rows[idx-1];
 const previous=chain.rows.findLastIndex(r=>r.kind===kind);
 const last=chain.rows[previous],lastStation=resolved.readings[previous];
 if(rect){
  if(last){
   row.widthMm=roundMm(lastStation.nextMm-lastStation.refMm);
   row.heightMm=last.heightMm;
   row.bottomMm=last.bottomMm;
  }
  preset=last?'repeat':'default';
  if(typed){
   row.widthMm=null;
   inferredFields=kind==='door'?['heightMm']:['bottomMm','heightMm'];
  }else if(span){
   const far=Math.min(W,sketchMm(Math.max(start.xMm,end.xMm)));
   const width=roundMm(far-station);
   const low=Math.min(H,sketchMm(Math.min(start.zMm,end.zMm))),high=Math.min(H,sketchMm(Math.max(start.zMm,end.zMm)));
   if(kind!=='door')row.bottomMm=low;
   if(width>=10)row.widthMm=width;else inferredFields.push('widthMm');
   if(horizontalWallInkStroke(width,low,high))inferredFields.push('heightMm');
   else row.heightMm=roundMm(high-(kind==='door'?0:low));
   if(!inferredFields.length)preset='drawn';
  }else{
   if(kind!=='door')row.bottomMm=Math.min(H,sketchMm(start.zMm));
   inferredFields=['widthMm','heightMm'];
  }
  if(kind==='door')row.bottomMm=0;
 }else if(pointKinds.has(kind)){
  if(typed){row.bottomMm=last?.bottomMm??row.bottomMm;preset=last?'repeat':'default';inferredFields=['bottomMm'];}
  else row.bottomMm=Math.min(H,sketchMm(end.zMm));
 }else if(kind==='corner'){
  // The perimeter length is known to CAD. The last gap is an independent
  // physical check; a tap at the far edge must never supply that check.
  row.gapMm=null;
 }
 return {ok:true,wall,kind,row,index:idx,fields,preset,inferredFields,referenceKind:ref?.kind||null,
  referenceId:ref?.id||null,datumMm,stationMm:row.gapMm==null?null:roundMm(datumMm+row.gapMm),independent:origin,
  baseline:stamp(edge,room,chain)};
}

export function confirmWallInk({room,wall,chain,proposal,values={},doc}){
 const edge=room&&architectureWall(room,wall);
 if(!edge||!proposal?.ok||proposal.wall!==wall||stamp(edge,room,chain)!==proposal.baseline)
  return no('تغيّر الجدار أو قياساته منذ الرسم. ضع العنصر من جديد.');
 let index=proposal.index;
 const fields=proposal.fields,row={...proposal.row};
 for(const key of fields){
  const val=assistNumber(ownKey(values,key)?values[key]:row[key]);
  if(val==null||val<0)return {...no('أدخل قياسًا بالملليمتر ثم ثبّت العنصر.'),field:key};
  row[key]=val;
 }
 // An exact reading from the starting corner can place a stamp past a
 // different anchored group than its sketch. Keep its original datum and
 // place it in walk order wherever old tape readings remain independent.
 if(proposal.independent&&proposal.stationMm!==null&&proposal.kind!=='corner'&&row.gapMm!==proposal.stationMm){
  const previous=resolveChain(room,wall,chain);
  if(!previous.ok)return previous;
  index=insertion(chain.rows,previous.readings,row.kind,row.gapMm);
  if(index<0)return no('تعذّر إدراج القياس من الركن مع الحفاظ على المراجع المسجلة.');
  if(index>0)row.from='origin';
 }
 const rows=chain.rows.slice();rows.splice(index,0,row);
 if(index===0&&rows[1]&&rows[1].from!=='origin')rows[1]={...rows[1],from:'origin'};
 const next={...chain,rows};
 const checked=resolveChain(room,wall,next);
 if(!checked.ok)return checked;
 if(doc){
  const result=applyChain(doc,wall,next);
  if(!result.ok)return result;
 }
 const reading=checked.readings[index];
 return {ok:true,chain:next,index,row,stationMm:reading.refMm,readings:checked.readings,geometry:checked,
  feature:checked.features.find(f=>f.id===('chain-'+wall+'-'+row.id))||null};
}

// Each pencil mark was proposed against the virtual chain just before it.
// Replaying from the actual unedited chain makes the entire page of marks
// reversible and prevents accepting a leftover ghost after a wall change.
export function stageWallInkBatch({room,wall,chain,items,doc}){
 if(!Array.isArray(items)||!items.length)return no('ارسم عنصرًا واحدًا على الأقل.');
 if(!Array.isArray(chain?.rows)||chain.rows.length+items.length>64)return no('يقبل الجدار ٦٤ قياسًا كحد أقصى.');
 const staged=[];
 let next=chain;
 for(const [i,item] of items.entries()){
  const accepted=confirmWallInk({room,wall,chain:next,proposal:item?.proposal,values:item?.values??{}});
  if(!accepted.ok)return {...accepted,failedIndex:i};
  staged.push(accepted);
  next=accepted.chain;
 }
 if(doc){
  const checked=applyChain(doc,wall,next);
  if(!checked.ok)return checked;
 }
 return {...staged.at(-1),items:staged};
}
