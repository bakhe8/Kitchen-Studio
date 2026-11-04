// Delivery annotations belong to immutable receipt units. They never change
// nominal dimensions or represent an installation/customer-acceptance event.
const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const exact=(v,keys)=>record(v)&&Reflect.ownKeys(v).length===keys.length&&Reflect.ownKeys(v).every(k=>keys.includes(k));
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const ratio=v=>Number.isFinite(v)&&v>=0&&v<=1;
function cleanAnchor(value){
 if(exact(value,['kind','x','y'])&&value.kind==='front'&&ratio(value.x)&&ratio(value.y))return {kind:'front',x:value.x,y:value.y};
 if(exact(value,['kind','key'])&&value.kind==='check'&&text(value.key,190))return {kind:'check',key:value.key};
 return null;
}

/** Validate an observation against the receipt's actual unit/check list.
 * Returns a detached canonical value, or null. IDs are assigned by the server
 * from the idempotency request ID and are never accepted from this input.
 */
export function cleanDeliveryObservation(unit,value){
 if(!exact(value,['text','severity','anchor'])||!text(value.text,500)||!['blocking','info'].includes(value.severity))return null;
 const anchor=cleanAnchor(value.anchor),checks=unit?.checks;
 if(!anchor||!Array.isArray(checks))return null;
 if(anchor.kind==='front'&&!['width','height'].every(key=>checks.some(c=>c.key===key&&c.unit==='مم'&&Number.isFinite(c.nominal)&&c.nominal>0)))return null;
 if(anchor.kind==='check'&&!checks.some(c=>c.key===anchor.key))return null;
 return {text:value.text.trim(),severity:value.severity,anchor};
}

/** Fold API-shaped events ({unit,action,data}) in their server sequence order.
 * Returns detached observations with {id,unit,text,severity,anchor,resolved,
 * resolution}. A resolution belongs to the same unit and cannot rewrite history.
 * Existing private stage notes are intentionally never included.
 */
export function deliveryObservations(events){
 const found=new Map();
 for(const event of Array.isArray(events)?events:[]){
  if(!text(event?.unit,190)||!record(event.data))continue;
  if(event.action==='observe'){
   const value=event.data.observation,anchor=cleanAnchor(value?.anchor);
   if(!record(value)||!text(value.id,64)||!text(value.text,500)||!['blocking','info'].includes(value.severity)||!anchor||found.has(value.id))continue;
   found.set(value.id,{id:value.id,unit:event.unit,text:value.text.trim(),severity:value.severity,anchor,resolved:false,resolution:null});
  }else if(event.action==='resolve'){
   const value=found.get(event.data.observationId);
   if(value&&value.unit===event.unit&&!value.resolved&&text(event.data.note,500)){value.resolved=true;value.resolution=event.data.note.trim();}
  }
 }
 return [...found.values()];
}
