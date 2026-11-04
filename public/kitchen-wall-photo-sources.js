export function wallPhotoSources(room,wall){
 const result=new Map();
 for(const record of room.fieldRegister?.records||[]){
  if(record.execution==='excluded')continue;
  let sourceWall;
  if(record.inputCode==='DOC-01'&&record.valueType==='file')sourceWall=record.itemId;
  else if(record.id.startsWith('wa-')&&(record.valueType==='polygon'||record.id.endsWith('-cad'))){
   try{sourceWall=JSON.parse(record.notes).wall;}catch{continue;}
  }
  if(sourceWall!==wall)continue;
  for(const ref of record.attachments||[])if(['image/png','image/jpeg','image/webp'].includes(ref.type))result.set(ref.id,ref);
 }
 return [...result.values()];
}
export function wallPhotoForFeature(room,featureId){
 const record=room.fieldRegister?.records?.find(r=>r.id.startsWith('wa-')&&r.id.endsWith('-cad')&&r.itemId===featureId&&r.execution!=='excluded');
 return record?.attachments?.[0]||null;
}

export function validWallPhotoLinks(room){
 return Object.entries(room.photoRefs||{}).every(([wall,id])=>typeof id!=='string'||!id.startsWith('asset-')||wallPhotoSources(room,wall).some(ref=>'asset-'+ref.id===id));
}
