import {identifiedProject} from './kitchen-project-identity.js';
import {wallPhotoSources} from './kitchen-wall-photo-sources.js';
import {cleanIdea} from './kitchen-ideas.js';
import {roomArchitecture} from './kitchen-architecture.js';
import {safePhoto} from './kitchen-studio-room.js';
import {unpackFieldFiles} from './kitchen-field-files.js';

// Shared by the snapshot endpoint and the restore path. No browser storage writes.
export function checkedPortableArchive(raw,{remoteId=null}={}){
 if(raw?.type!=='kitchen-studio'||![1,2].includes(raw.version))throw Error('ملف الاستوديو غير مدعوم.');
 const doc=cleanIdea(raw.design);if(!doc)throw Error('تعذّر التحقق من هندسة المشروع وبيانات المصنع للاستعادة.');
 const photos=raw.photos||{},walls=roomArchitecture(doc.room).walls.map(w=>w.id),files=unpackFieldFiles(doc.room,raw.fieldFiles||[]);
 if(typeof photos!=='object'||Array.isArray(photos))throw Error('سجل صور الجدران غير صالح.');
 for(const [side,pic] of Object.entries(photos))if(!walls.includes(side)||!safePhoto(pic))throw Error('صورة جدار غير صالحة.');
 for(const [side,ref] of Object.entries(raw.design.room.photoRefs||{}))if(ref!=='off'&&!(typeof ref==='string'&&ref.startsWith('asset-')?walls.includes(side)&&files.has(ref.slice(6))&&wallPhotoSources(doc.room,side).some(a=>'asset-'+a.id===ref):photos[side]))throw Error('الصورة المشار إليها غير مرفقة في النسخة.');
 return {doc:identifiedProject(doc,{remoteId}),photos,walls,files};
}
