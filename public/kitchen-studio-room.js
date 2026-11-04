import {ownKey} from './kitchen-safe-keys.js';
import {cleanWorkshop} from './kitchen-workshop-state.js';
import {cleanProjectDefaults} from './kitchen-defaults-model.js';
import {cleanFieldRegister} from './kitchen-field-model.js';
import {validateKitchenRoomArchitecture} from './kitchen-architecture.js';
import {checkSitePoints} from './kitchen-site-survey-model.js';
const faces=[...Array.from({length:32},(_,i)=>'poly-'+String(i+1).padStart(2,'0')),'back','left','right','front',...['back-left','back-right','front-left','front-right'].flatMap(c=>['x','z','diagonal'].map(dir=>'return-'+c+'-'+dir))],allowed=['sand','sage','stone'];
export const floors={wood:'خشب طبيعي',marble:'رخام فاتح',tile:'بورسلان رمادي',stone:'حجر داكن'};
export const claddingFinishes={plain:'دهان فقط','ivory-tile':'بلاط عاجي','sand-tile':'بلاط رملي'};
export function validRoomCladding(c,H){
 return c==null||ownKey(claddingFinishes,c.finish)&&Number.isFinite(c.height)&&c.height>=0&&c.height<=H&&[c.tileWidth,c.tileHeight].every(n=>Number.isFinite(n)&&n>=10&&n<=180);
}
export const safePhoto=s=>typeof s==='string'&&s.length<=3600000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(s);
const safeId=s=>typeof s==='string'&&(/^(?:pic-[a-z0-9-]{3,70}|asset-[A-Za-z0-9][A-Za-z0-9_-]{0,99})$/.test(s));
export function cleanStudioRoom(r){
 if(!r||![r.width,r.length,r.height].every(Number.isFinite)||Math.min(r.width,r.length,r.height)<60||Math.max(r.width,r.length)>1200||r.height>600)return null;
 const checked=validateKitchenRoomArchitecture(r);if(!checked.ok)return null;const sites=checkSitePoints(r);if(!sites.ok)return null;
 const room={width:r.width,length:r.length,height:r.height,colors:Object.fromEntries(Object.entries(r.colors||{}).filter(([k,v])=>faces.includes(k)&&allowed.includes(v)))};
 if(/^K-[A-F0-9]{16}$/.test(r.projectId))room.projectId=r.projectId;
 if(r.workshop!=null){const w=cleanWorkshop(r.workshop);if(!w)return null;room.workshop=w;}
 if(r.defaults!=null){const defaults=cleanProjectDefaults(r.defaults);if(!defaults)return null;room.defaults=defaults;}
 if(r.fieldRegister!=null){const register=cleanFieldRegister(r.fieldRegister);if(!register)return null;room.fieldRegister=register;}
 if(r.architecture&&checked.room.architecture)room.architecture=checked.room.architecture;if(sites.points.length)room.sitePoints=sites.points;
 if(!validRoomCladding(r.cladding,r.height))return null;if(r.cladding){const {finish,height,tileWidth,tileHeight}=r.cladding;room.cladding={finish,height,tileWidth,tileHeight};}
 if(typeof r.name==='string'&&r.name.trim())room.name=r.name.trim().slice(0,64);
 if(ownKey(floors,r.floor))room.floor=r.floor;
 if(r.backsplash&&['none','tile','marble','steel','wood'].includes(r.backsplash.finish)&&Number.isFinite(r.backsplash.height)&&r.backsplash.height>=10&&r.backsplash.height<=130)room.backsplash={finish:r.backsplash.finish,height:r.backsplash.height};
 if(r.photoRefs){const a=Object.entries(r.photoRefs).filter(([k,v])=>faces.includes(k)&&(v==='off'||safeId(v)));if(a.length)room.photoRefs=Object.fromEntries(a);}
 return room;
}
export function readWallPhotos(room={}){
 const result={};for(const side of faces){const id=room.photoRefs?.[side];if(side.startsWith('poly-')&&!id)continue;if(id==='off')continue;
 try{const pic=localStorage.getItem(safeId(id)?'studio-photo:'+id:'atlas-shelves:wall-image:v1'+(side==='back'?'':':'+side));if(safePhoto(pic))result[side]=pic;}catch{}}
 return result;
}
// Photo previews are never removed when a project is replaced, so they pile up until the browser quota is full and nothing else can be saved.
// When a write fails, previews that were already stored when this page opened and are mentioned nowhere else in storage are dropped, and the write
// is tried once more. A preview written or re-written since the page opened is never touched: it may belong to a project that is not saved yet.
const photoPrefix='studio-photo:',startupPhotos=new Set();
export function storedPhotoKeys(){
 const out=new Set();
 try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(photoPrefix))out.add(k);}}catch{/* no storage, no photos */}
 return out;
}
for(const k of storedPhotoKeys())startupPhotos.add(k);
export function purgeOrphanPhotos(){
 let freed=0;
 try{
  const texts=[];
  for(const s of [localStorage,sessionStorage])for(let i=0;i<s.length;i++){const k=s.key(i);if(!k||k.startsWith(photoPrefix))continue;const v=s.getItem(k);if(v)texts.push(v);}
  const used=texts.join('\n');
  for(const k of [...startupPhotos]){
   if(used.includes(k.slice(photoPrefix.length)))continue;
   freed+=(localStorage.getItem(k)||'').length;localStorage.removeItem(k);startupPhotos.delete(k);
  }
 }catch{/* a store that cannot be listed is left alone */}
 return freed;
}
export function setStoredPhoto(key,data){
 const put=()=>{try{localStorage.setItem(key,data);startupPhotos.delete(key);return true;}catch{return false;}};
 return put()||(purgeOrphanPhotos()>0&&put());
}
export async function putWallPhoto(data){
 if(!safePhoto(data))throw Error('صيغة الصورة غير مدعومة');
 const raw=new TextEncoder().encode(data);let id;
 if(crypto.subtle){const digest=await crypto.subtle.digest('SHA-256',raw);id='pic-'+Array.from(new Uint8Array(digest).slice(0,12),b=>b.toString(16).padStart(2,'0')).join('');}else{id='pic-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);}
 if(!setStoredPhoto(photoPrefix+id,data))throw Error('مساحة الصور في هذا المتصفح ممتلئة.');return id;
}
export async function prepareRoomImage(file){
 if(!file||file.size>24*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('اختر صورة JPG أو PNG أو WebP حتى 24 م.ب.');
 const url=URL.createObjectURL(file);
 try{const im=new Image();im.src=url;await im.decode();const scale=Math.min(1,1400/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*scale));c.height=Math.max(1,Math.round(im.height*scale));const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.78);}finally{URL.revokeObjectURL(url);}
}
export const textureMap=Object.freeze(Object.fromEntries(Object.entries({environment:['garden_nook',1],oak:['oak_veneer_01',90],walnut:['wood_table_001',90],wood:['oak_veneer_01',90],teak:['wood_table_001',110],stone:['granite_tile',68],marble:['marble_01',130],granite:['granite_tile',65],floor:['wood_floor',170],floorwood:['wood_floor',170],floorstone:['stone_tiles',160],floormarble:['marble_01',120]}).map(([key,[asset,tileCm]])=>[key,{src:'./studio-textures/'+asset+'.webp',tileCm}])));
