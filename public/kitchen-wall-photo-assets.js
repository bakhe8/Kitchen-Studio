// The field attachment is the original. The synchronous scene renderer uses a
// JPEG preview cache; archives transport the original once and rebuild the cache.
import {roomArchitecture,architectureWall} from './kitchen-architecture.js';
import {upsertFieldRecord} from './kitchen-field-model.js';
import {prepareRoomImage,readWallPhotos,putWallPhoto,safePhoto,setStoredPhoto,storedPhotoKeys} from './kitchen-studio-room.js';
import {fieldAttachmentStore} from './kitchen-field-files.js';

import {wallPhotoSources} from './kitchen-wall-photo-sources.js';
export {wallPhotoSources,wallPhotoForFeature} from './kitchen-wall-photo-sources.js';
export function legacyWallSource(room,wall){
 if(room.photoRefs?.[wall]?.startsWith('asset-'))return null;
 const data=readWallPhotos(room)[wall];if(!data)return null;
 const bytes=Uint8Array.from(atob(data.slice(data.indexOf(',')+1)),ch=>ch.charCodeAt(0));
 return new File([bytes],'صورة الجدار المحفوظة.jpg',{type:'image/jpeg'});
}
function cachePreview(id,data){
 if(!safePhoto(data))throw Error('تعذّر تجهيز معاينة صورة الجدار.');
 if(!setStoredPhoto('studio-photo:asset-'+id,data))throw Error('تعذّر حفظ معاينة الصورة. تحقّق من مساحة الجهاز.');
}
export function linkWallPhoto(room,wall,ref,{background=false,preview=null}={}){
 const edge=architectureWall(room,wall);
 if(!edge||!['image/png','image/jpeg','image/webp'].includes(ref?.type)||!ref?.id)throw Error('راجع الجدار ونوع الصورة.');
 if(!wallPhotoSources(room,wall).some(a=>a.id===ref.id)){
  const saved=upsertFieldRecord(room,{itemId:wall,inputCode:'DOC-01',property:'صورة الجدار الأصلية',location:edge.label,valueType:'file',verification:'documented',source:'صورة زيارة الموقع',attachments:[ref]});
  if(!saved.ok)throw Error(saved.reason);
  room=saved.room;
 }
 if(!background)return room;
 cachePreview(ref.id,preview);
 return {...room,photoRefs:{...room.photoRefs,[wall]:'asset-'+ref.id}};
}
export async function saveWallPhoto(room,wall,file,{source=null,background=false}={}){
 const preview=background?await prepareRoomImage(file):null;
 const ref=source||await fieldAttachmentStore.put(file);
 return {room:linkWallPhoto(room,wall,ref,{background,preview}),ref};
}
export function packWallPhotos(room){
 const out=readWallPhotos(room);
 for(const [wall,ref] of Object.entries(room.photoRefs||{})){
  if(ref.startsWith('asset-')){
   if(!wallPhotoSources(room,wall).some(a=>'asset-'+a.id===ref))throw Error('أصل صورة الجدار غير مرتبط بهذا الجدار.');
   delete out[wall];
  }else if(ref!=='off'&&!out[wall])throw Error('صورة الجدار مفقودة على الجهاز. استعد الصورة قبل نقل المشروع.');
 }
 return out;
}
export async function restoreWallPhotos(room,photos,files,preview=prepareRoomImage){
 const before=storedPhotoKeys();
 try{
  const refs=Object.fromEntries(roomArchitecture(room).walls.map(w=>[w.id,'off']));
  for(const [wall,data] of Object.entries(photos))refs[wall]=await putWallPhoto(data);
  for(const [wall,key] of Object.entries(room.photoRefs||{})){
   if(!key.startsWith('asset-'))continue;
   const id=key.slice(6),blob=files.get(id);
   if(!blob||!wallPhotoSources(room,wall).some(a=>a.id===id))throw Error('أصل صورة الجدار مفقود في النسخة.');
   cachePreview(id,await preview(blob));refs[wall]=key;
  }
  return {...room,photoRefs:refs};
 }catch(err){
  // All or nothing: a restore that fails half way used to leave its earlier photos behind, and nothing ever removed them.
  for(const k of storedPhotoKeys())if(!before.has(k))try{localStorage.removeItem(k);}catch{/* already gone */}
  throw err;
 }
}
