// Global shortcuts supplement the open editor. Its own primary actions, draft
// history and inspection commands stay with that editor and its actual target.
export function stageCommands(doc,route,context={}){
 const keys=['file'],hasUnits=!!doc.kitchen.units.length;
 if(route==='cad'){
  keys.push('history','room','records','layouts','library','libraries');
  if(hasUnits)keys.push('render','sheets');
 }else if(route==='survey'){
  if(context.wall)keys.push('wallPhoto');
  keys.push('records');
 }else if(route==='photo'){
  if(context.wall)keys.push('wallSheet');
  keys.push('records');
 }else if(route==='outline'){
  keys.push('records');
 }else if(['surfaces3d','measure','zones','routes','profile','intake','appliances','tap','logistics'].includes(route)){
  keys.push('records');
 }else if(route==='whole'){
  if(context.savedDesign&&context.canSetUsage&&doc.kitchen.units.some(u=>u.id===context.unitId))keys.push('usage');
 }else if(['finish','approve','sign','quote'].includes(route)&&hasUnits){
  keys.push('sheets');
  if(route==='quote'||route==='sign')keys.push('render');
 }
 return keys;
}
