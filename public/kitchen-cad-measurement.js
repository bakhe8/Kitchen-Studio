import {ownKey} from './kitchen-safe-keys.js';
// The CAD stores the near edge and bottom in cm. The survey uses millimetres
// from its wall datum and references service centres and outer opening frames.
import {architectureWall} from './kitchen-architecture.js';
import {applyChain,linkedReadingIndex,pointKinds,resolveChain} from './kitchen-chain-model.js';
const mm=cm=>Math.round(cm*1e7)/1e6;
const fail=reason=>({ok:false,reason});

export function featureDimensionsMm(room,feature){
 const start=architectureWall(room,feature.wall)?.start||0,point=pointKinds.has(feature.kind);
 return {u:mm(feature.u-start+(point?feature.width/2:0)),width:mm(feature.width),
  bottom:mm(feature.bottom+(point?feature.height/2:0)),height:mm(feature.height),depth:mm(feature.depth)};
}

export function featureFromDimensionsMm(room,feature,values){
 const start=architectureWall(room,feature.wall)?.start||0,point=pointKinds.has(feature.kind);
 const width=values.width/10,height=values.height/10;
 return {...feature,u:start+values.u/10-(point?width/2:0),bottom:values.bottom/10-(point?height/2:0),
  width,height,depth:values.depth==null?feature.depth:values.depth/10};
}

// A direct move changes this object. Preserve each neighbour's physical
// station, including surveyed end marks; editing a tape entry is a separate UI.
export function editSurveyFeatureChain(room,wall,chain,index,candidate){
 const range=resolveChain(room,wall,chain);
 if(!range.ok)return range;
 const before=chain.rows[index];
 if(!before||candidate.kind!==before.kind||candidate.wall!==wall)return fail('العنصر مرتبط بهذا الجدار في الرفع.');
 const values=featureDimensionsMm(room,candidate);
 const withStation=(row,station,origin)=>{
  const gap=Math.round((station-origin)*1e6)/1e6;
  return row.from==='origin'||gap<0?{...row,from:'origin',gapMm:station}:{...row,gapMm:gap};
 };
 const row=withStation(before,values.u,range.readings[index].refMm-before.gapMm);
 Object.assign(row,{widthMm:values.width,heightMm:values.height,bottomMm:values.bottom,depthMm:values.depth});
 if(row.frameRead){
  const far=values.u+values.width,fr=row.frameRead;
  row.frameRead={...fr,distanceMm:fr.method==='opposite'?fr.wallLengthMm-far:far};
 }
 if(row.kind==='door'||row.kind==='window'){
  for(const key of ['swing','hinge'])if(ownKey(candidate,key)){
   if(candidate[key])row[key]=candidate[key];else delete row[key];
  }
 }
 const rows=chain.rows.slice();rows[index]=row;
 if(rows[index+1]&&rows[index+1].from!=='origin'){
  const nextEdge=pointKinds.has(row.kind)?values.u:values.u+values.width;
  rows[index+1]=withStation(rows[index+1],range.readings[index+1].refMm,nextEdge);
 }
 const next={...chain,rows},result=resolveChain(room,wall,next);
 return result.ok?{ok:true,chain:next,result}:result;
}

export function correctCadSurveyFeature(doc,original,candidate){
 const current=doc.kitchen.features.find(f=>f.id===original.id);
 if(!current||['wall','u','bottom','width','height','depth'].some(key=>current[key]!==original[key]))
  return fail('تغيّر عنصر الجدار منذ بدء التحرير. راجع القياس الحالي.');
 if(candidate.id!==original.id||candidate.kind!==original.kind||candidate.wall!==original.wall)
  return fail('العنصر مرتبط بهذا الجدار في الرفع. اسحبه على الجدار نفسه.');
 const wall=original.wall,chain=doc.room.workshop?.chains?.[wall],index=linkedReadingIndex(doc.room,original);
 if(index<0)return fail('لم تعد قراءة العنصر مرتبطة بهذا الجدار.');
 const edit=editSurveyFeatureChain(doc.room,wall,chain,index,candidate);
 return edit.ok?applyChain(doc,wall,edit.chain):edit;
}
