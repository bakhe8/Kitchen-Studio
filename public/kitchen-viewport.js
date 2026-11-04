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
