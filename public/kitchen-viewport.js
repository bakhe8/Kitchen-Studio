// Navigation belongs to the editor, not to the kitchen's saved design or its undo history.
const key='atlas-kitchen:viewport:v1', finite=(n,f)=>Number.isFinite(n)?n:f;
export function normalizeKitchenViewport(value={}){
  return {view:value?.view==='top'?'top':'volume',yaw:((finite(value?.yaw,32)%360)+360)%360,
    pitch:Math.max(-60,Math.min(72,finite(value?.pitch,25)))};
}
export function rememberKitchenViewport(value){
  const v=normalizeKitchenViewport(value);try{sessionStorage.setItem(key,JSON.stringify(v));}catch{}return v;
}
export function readKitchenViewport(params){
  let saved;try{saved=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}
  const v=normalizeKitchenViewport(saved),space=params?.get('space');
  if(space==='volume'||space==='top')v.view=space;
  for(const k of ['yaw','pitch']){const n=params?.get(k);if(n!=null&&n.trim()!==''&&Number.isFinite(Number(n)))v[k]=Number(n);}
  return normalizeKitchenViewport(v);
}

// The separate unit page may save a new document before returning. Keep only
// navigation state, tied to the same project and stable unit, outside history.
const designerReturnKey='atlas-kitchen:designer-return:v1';
const cleanCamera=value=>value&&[value.zoom,value.x,value.y].every(Number.isFinite)?
 {zoom:Math.max(.5,Math.min(12,value.zoom)),x:Math.max(-.25,Math.min(1.25,value.x)),y:Math.max(-.25,Math.min(1.25,value.y))}:null;
function designerContext(doc,value){
 const projectId=doc?.room?.projectId,unit=doc?.kitchen?.units?.find(u=>u.id===value?.unitId);
 if(!projectId||value?.projectId!==projectId||!unit||value.runId!==unit.runId)return null;
 const faces=new Set(['volume','plan',...doc.kitchen.runs.map(r=>r.wall).filter(Boolean)]);
 if(!faces.has(value.proposalView))return null;
 const views=[];
 for(const entry of Array.isArray(value.views)?value.views.slice(0,40):[]){
  const camera=cleanCamera(entry?.camera);if(!camera||typeof entry.key!=='string'||entry.key.length>200)continue;
  let key;try{key=JSON.parse(entry.key);}catch{continue;}
  if(!Array.isArray(key)||key.length!==3||!faces.has(key[0])||(key[0]==='plan'?!['base','upper'].includes(key[1]):key[1]!==null)||
   (key[0]==='volume'?typeof key[2]!=='boolean':key[2]!==null))continue;
  views.push({key:JSON.stringify(key),camera,unitId:doc.kitchen.units.some(u=>u.id===entry.unitId)?entry.unitId:null});
 }
 return {projectId,unitId:unit.id,runId:unit.runId,proposalView:value.proposalView,
  yaw:((finite(value.yaw,18)%360)+360)%360,frameUnits:value.frameUnits!==false,camera:cleanCamera(value.camera)||{zoom:1,x:.5,y:.5},views};
}
export function rememberDesignerReturn(doc,value){
 const focus=designerContext(doc,value);
 try{
  sessionStorage.removeItem(designerReturnKey);
  if(!focus)return null;
  const token=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  sessionStorage.setItem(designerReturnKey,JSON.stringify({token,focus}));return token;
 }catch{return null;}
}
export function takeDesignerReturn(doc,params){
 try{
  const text=sessionStorage.getItem(designerReturnKey);if(!text)return null;
  if(text.length>50000){sessionStorage.removeItem(designerReturnKey);return null;}
  const saved=JSON.parse(text);
  if(saved?.focus?.projectId!==doc?.room?.projectId){sessionStorage.removeItem(designerReturnKey);return null;}
  if(params?.get('view')!=='kitchen'||!saved?.token||params?.get('designerReturn')!==saved.token)return null;
  sessionStorage.removeItem(designerReturnKey);
  if(params.get('unit')!==saved.focus.unitId)return null;
  return designerContext(doc,saved.focus);
 }catch{return null;}
}
