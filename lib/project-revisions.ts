export const limitBytes=16*1024*1024;
export const keyIsValid=(s:string|null):s is string=>!!s&&/^[a-z0-9-]{16,64}$/i.test(s);
export const noCache={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
export type ProjectRole="owner"|"editor"|"viewer"|"store"|"factory"|"rep";
export const projectReadRolesSql="'editor','viewer','store','factory','rep'";
export const projectWriteRolesSql="'store','factory','rep'";
export const scopedProjectRoles=new Set(['store','factory','rep']);
export const projectReference=(id:string)=>'مشروع '+id.slice(0,8);
export const reassignmentRequired=()=>problem('يلزم أن يحدد المالك دور العمل قبل فتح بيانات المشروع.',403);
export const catalogAccessSql=`SELECT CASE WHEN c.owner=? THEN 'owner' ELSE m.role END role,
 COALESCE((SELECT MAX(version) FROM studio_catalog_versions WHERE catalog=c.id),0) version
 FROM studio_catalogs c LEFT JOIN studio_catalog_readers m ON m.catalog=c.id AND m.reader=?
 WHERE c.id=? AND (c.owner=? OR m.role IN ('reader','store','factory'))`;
export function json(data:unknown,status=200){return Response.json(data,{status,headers:noCache});}
export function problem(error:string,status:number){return json({error},status);}
// Without this a D1/R2 outage reaches the browser as an empty 500: no JSON body, so the sync panel has nothing to show.
// The log line carries the route and the error message only, never the request body or the user.
export async function guarded(route:string,run:()=>Promise<Response>):Promise<Response>{
 try{return await run();}
 catch(error){
  console.error("studio route failed:",route,error instanceof Error?error.message:String(error));
  return problem("تعذّر إكمال الطلب مؤقتًا. أعد المحاولة بعد قليل.",503);
 }
}
export async function readLimited(request:Request,limit:number){
 if(Number(request.headers.get("content-length")||0)>limit)throw new RangeError();
 const reader=request.body?.getReader();if(!reader)throw new SyntaxError();
 const parts:Uint8Array[]=[];let total=0;
 while(true){
  const part=await reader.read();if(part.done)break;
  total+=part.value.byteLength;if(total>limit){await reader.cancel();throw new RangeError();}
  parts.push(part.value);
 }
 const bytes=new Uint8Array(total);let pos=0;
 for(const p of parts){bytes.set(p,pos);pos+=p.byteLength;}
 return bytes;
}
export function validEnvelope(raw:unknown){
 if(!raw||typeof raw!=="object")return false;
 const a=raw as {type?:string;version?:number;design?:{room?:{width?:number;length?:number;height?:number};kitchen?:{units?:unknown[];runs?:unknown[];features?:unknown[]}};photos?:unknown;fieldFiles?:unknown};
 const room=a.design?.room,kitchen=a.design?.kitchen;
 return a.type==="kitchen-studio"&&(a.version===1||a.version===2)&&!!room&&[room.width,room.length,room.height].every(v=>typeof v==="number"&&Number.isFinite(v)&&v>0)&&
  !!kitchen&&Array.isArray(kitchen.units)&&kitchen.units.length<=256&&Array.isArray(kitchen.runs)&&kitchen.runs.length<=48&&Array.isArray(kitchen.features)&&kitchen.features.length<=64&&
  (a.photos==null||(typeof a.photos==="object"&&!Array.isArray(a.photos)))&&(a.fieldFiles==null||Array.isArray(a.fieldFiles));
}
export const accessSql=`SELECT CASE WHEN p.owner=? THEN 'owner' ELSE a.role END AS role,
 COALESCE((SELECT MAX(v.revision) FROM studio_versions v WHERE v.project_id=p.id),0) AS revision
 FROM studio_projects p LEFT JOIN studio_access a ON a.project_id=p.id AND a.member=?
 WHERE p.id=? AND (p.owner=? OR a.role IN (${projectReadRolesSql}))`;
export const insertRevisionSql=`INSERT INTO studio_versions(project_id,revision,request_id,actor,name,digest,bytes,updated,request_digest)
 SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?16 WHERE
 (SELECT COALESCE(MAX(revision),0) FROM studio_versions WHERE project_id=?9)=?10
 AND EXISTS (SELECT 1 FROM studio_projects p WHERE p.id=?11 AND ((p.owner=?12 AND ?13='owner') OR EXISTS (
 SELECT 1 FROM studio_access a WHERE a.project_id=p.id AND a.member=?14 AND a.role=?15 AND a.role IN ('store','factory','rep')))) ON CONFLICT DO NOTHING`;
