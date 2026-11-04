import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
import {portableFactoryCatalog,catalogFingerprint,encodePortableCatalog,catalogView,mergeCatalogEdit} from "../../../lib/generated-shop-domain.mjs";
import {catalogAccessSql,json,keyIsValid,problem,readLimited,guarded} from "../../../lib/project-revisions";
export const dynamic="force-dynamic";
// Any D1/R2 failure that escapes the handler answers with the same JSON shape as every other failure.
export function GET(req:Request){return guarded("catalogs.GET",()=>handleGet(req));}
export function POST(req:Request){return guarded("catalogs.POST",()=>handlePost(req));}

const inaccessible=()=>problem("الكتالوج غير متاح لهذا الحساب.",404);
const auth=(db:D1Database,id:string,uid:string)=>db.prepare(catalogAccessSql).bind(uid,uid,id,uid).first<{role:string,version:number}>();
const scoped=(role:string)=>role==='store'||role==='factory';
const reference=(id:string)=>'كتالوج '+id.slice(0,8);
const assignment=()=>problem('يلزم أن يحدد المالك دور العمل قبل فتح بيانات الكتالوج.',403);
async function snapshot(db:D1Database,files:R2Bucket,id:string,uid:string,access:{role:string,version:number},version:number){
 if(access.role!=='owner'&&!scoped(access.role))return assignment();
 const row=await db.prepare('SELECT name,digest,object_key FROM studio_catalog_versions WHERE catalog=? AND version=?').bind(id,version).first<{name:string,digest:string,object_key:string}>();
 if(!row)return inaccessible();const file=await files.get(row.object_key);if(!file)return problem('بيانات الإصدار غير متاحة.',503);
 const stored=await file.json(),catalog=portableFactoryCatalog(stored),catalogRecords=encodePortableCatalog(stored);
 if(!catalog||!catalogRecords)return problem('بيانات الإصدار غير صالحة.',503);
 const current=await auth(db,id,uid);if(current?.role!==access.role)return inaccessible();
 return json(access.role==='owner'?{id,version,role:access.role,subject:uid,scopeVersion:1,digest:row.digest,catalog,catalogRecords}:catalogView(access.role,stored,{id,version,subject:uid}));
}
async function handleGet(req:Request){
 const user=await getChatGPTUser();if(!user)return problem("سجّل الدخول إلى بوابة كتالوجات الفريق.",401);
 const db=env.DB,files=env.BUCKET;if(!db||!files)return problem("بوابة الكتالوجات المشتركة غير متصلة.",503);
 const q=new URL(req.url).searchParams,id=q.get("id"),uid=user.userId,action=q.get('action')||'snapshot';
 if(!['snapshot','access','members','versions'].includes(action)||!id&&action!=='snapshot')return problem('عملية غير معروفة.',400);
 if(!id){
  await db.prepare("INSERT INTO studio_members(user_id,email) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email").bind(uid,user.email.trim().toLowerCase()).run();
  const list=await db.prepare(`SELECT c.id,v.version,v.name,v.digest,v.created, CASE WHEN c.owner=? THEN 'owner' ELSE m.role END role
   FROM studio_catalogs c JOIN studio_catalog_versions v ON v.catalog=c.id AND v.version=(SELECT MAX(version) FROM studio_catalog_versions WHERE catalog=c.id)
   LEFT JOIN studio_catalog_readers m ON m.catalog=c.id AND m.reader=? WHERE c.owner=? OR m.role IN ('reader','store','factory') ORDER BY v.created DESC LIMIT 151`).bind(uid,uid,uid).all();
  return json({catalogs:list.results.slice(0,150).map((v:any)=>v.role==='owner'?v:{id:v.id,version:v.version,name:reference(v.id),role:v.role,created:v.created}),truncated:list.results.length>150,subject:uid,scopeVersion:1});
 }
 if(!keyIsValid(id))return inaccessible();const access=await auth(db,id,uid);if(!access)return inaccessible();
 const finish=async(data:unknown)=>(await auth(db,id,uid))?.role===access.role?json(data):inaccessible();
 if(action==='access')return finish({id,role:access.role,version:access.version,subject:uid,scopeVersion:1,requiresRoleAssignment:access.role!=='owner'&&!scoped(access.role)});
 if(access.role!=='owner'&&!scoped(access.role))return assignment();
 if(q.get("action")==="members"){
  if(access.role!=="owner")return problem("المشاركة للمالك فقط.",403);
  const rows=await db.prepare("SELECT m.email,r.role FROM studio_catalog_readers r INNER JOIN studio_members m ON m.user_id=r.reader WHERE catalog=? ORDER BY email").bind(id).all();
  return finish({members:rows.results});
 }
 if(q.get("action")==="versions"){
  const rows=await db.prepare("SELECT version,name,digest,created FROM studio_catalog_versions WHERE catalog=? ORDER BY version DESC LIMIT 120").bind(id).all();
  return finish({versions:access.role==='owner'?rows.results:rows.results.map((v:any)=>({version:v.version,created:v.created,name:reference(id)}))});
 }
 const version=q.has("version")?Number(q.get("version")):access.version;
 if(!Number.isSafeInteger(version)||version<1)return problem("إصدار غير صالح.",400);
 return snapshot(db,files,id,uid,access,version);
}
async function handlePost(req:Request){
 const user=await getChatGPTUser();if(!user)return problem("سجّل الدخول أولًا.",401);
 const url=new URL(req.url),q=url.searchParams,id=q.get("id"),uid=user.userId;
 if(req.headers.get("X-Studio-Request")!=="1"||(req.headers.has("origin")&&req.headers.get("origin")!==url.origin))return problem("الطلب غير معتمد.",403);
 const db=env.DB,files=env.BUCKET;if(!db||!files)return problem("تتعذر خدمة كتالوجات الفريق.",503);
 if(!keyIsValid(id))return problem("مرجع الكتالوج غير صالح.",400);
 const access=await auth(db,id,uid),action=q.get("action");
 if(action==="share"||action==="revoke"){
  if(!access)return inaccessible();if(access.role!=="owner")return problem("المشاركة للمالك فقط.",403);
  let body;try{body=JSON.parse(new TextDecoder().decode(await readLimited(req,2048)));}catch{return problem("طلب مشاركة غير صالح.",400);}
  const email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";
  const role=body?.role??"reader";
  if(action==="share"&&!["reader","store","factory"].includes(role))return problem("اختر صلاحية الكتالوج.",400);
  if(email.length>254||!email.includes("@")||email===user.email.toLowerCase())return problem("أدخل بريد حساب المندوب.",400);
  const {results}=await db.prepare("SELECT user_id FROM studio_members WHERE email=? LIMIT 2").bind(email).all<{user_id:string}>();
  if(results.length!==1)return problem("على المندوب فتح المشاريع أو كتالوج الفريق بحسابه مرة واحدة أولًا.",400);
  if(action==="share")await db.prepare("INSERT INTO studio_catalog_readers(catalog,reader,role) VALUES(?,?,?) ON CONFLICT(catalog,reader) DO UPDATE SET role=excluded.role").bind(id,results[0].user_id,role).run();
  else await db.prepare("DELETE FROM studio_catalog_readers WHERE catalog=? AND reader=?").bind(id,results[0].user_id).run();
  return json({ok:true});
 }
 if(action!=="publish")return problem("عملية غير معروفة.",400);
 if(access&&access.role!=='owner'&&!scoped(access.role))return assignment();
 const expected=Number(q.get("expected")),rid=q.get("request");
 if(!q.has("expected")||!Number.isSafeInteger(expected)||expected<0||!keyIsValid(rid))return problem("النسخة المتوقعة ومفتاح العملية مطلوبان.",400);
 if(!access&&(expected!==0||await db.prepare("SELECT 1 FROM studio_catalogs WHERE id=?").bind(id).first()))return inaccessible();
 let template,input,inputBytes;
 try{inputBytes=await readLimited(req,512*1024);input=JSON.parse(new TextDecoder().decode(inputBytes));}catch(e){return problem(e instanceof RangeError?"ملف القالب يتجاوز 512 كيلوبايت.":"ملف القالب غير صالح.",400);}
 const isScoped=!!access&&access.role!=='owner';
 if(isScoped&&(input?.type!=='kitchen-catalog-edit'||input.version!==1||input.baseVersion!==expected))return problem('أرسل تعديل بيانات دورك من الواجهة الحالية.',403);
 const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
 const requestDigest=await hash(JSON.stringify([uid,new TextDecoder().decode(inputBytes)]));
 const previous=()=>db.prepare('SELECT version,digest,object_key,request_digest FROM studio_catalog_versions WHERE catalog=? AND request_id=?').bind(id,rid).first<{version:number,digest:string,object_key:string,request_digest:string|null}>();
 const old=access?await previous():null;
 if(old?.request_digest){
  if(old.request_digest!==requestDigest)return problem('مفتاح العملية مستخدم لمحتوى مختلف.',409);
  const current=await auth(db,id,uid);if(!current||current.role!==access!.role)return inaccessible();
  return isScoped?snapshot(db,files,id,uid,current,current.version):json({id,version:old.version,digest:old.digest,role:'owner',subject:uid,scopeVersion:1});
 }
 if(access&&access.version!==expected&&!old)return problem('تغيّر إصدار الكتالوج. حدّث القائمة وراجع النسخة الجديدة.',409);
 if(isScoped){
  const latest=await db.prepare('SELECT object_key FROM studio_catalog_versions WHERE catalog=? AND version=?').bind(id,access!.version).first<{object_key:string}>();
  const file=latest&&await files.get(latest.object_key);if(!file)return problem('بيانات الإصدار السابق غير متاحة.',503);
  const merged=mergeCatalogEdit(access!.role,await file.json(),input,{expectedVersion:expected});
  if(!merged.ok)return problem('التعديل غير صالح ضمن بيانات دورك.',403);
  template=encodePortableCatalog(merged.catalog);
 }else template=encodePortableCatalog(input);
 const view=template&&portableFactoryCatalog(template);
 if(!view||!access&&!view.approved)return problem("اعتمد وصفات المصنع وراجع القالب قبل نشره لأول مرة.",422);
 // The public fingerprint intentionally keeps the historical approval-neutral
 // identity. Include the full envelope digest in storage so changing a record's
 // approval cannot overwrite an older version with the same content fingerprint.
 const serialized=JSON.stringify(template),contentDigest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(serialized))),b=>b.toString(16).padStart(2,"0")).join("");
 const digest=catalogFingerprint(template),ver=expected+1,legacyKey="factory-catalogs/"+id+"/"+digest+".json",key="factory-catalogs/"+id+"/"+digest+"-"+contentDigest+".json",now=new Date().toISOString();
 const replay=async(x:{version:number,digest:string,object_key:string,request_digest:string|null})=>{
  const current=await auth(db,id,uid);if(!current||current.role!==(access?.role||'owner'))return inaccessible();
  if(x.request_digest)return x.request_digest===requestDigest?(isScoped?snapshot(db,files,id,uid,current,current.version):json({id,version:x.version,digest:x.digest,role:'owner',subject:uid,scopeVersion:1})):problem('مفتاح العملية مستخدم لمحتوى مختلف.',409);
  if(isScoped)return problem('مفتاح العملية مستخدم لطلب سابق.',409);
  if(x.digest===digest){
   if(x.object_key===key)return json({id,version:x.version,digest});
   if(x.object_key===legacyKey){
    const old=await files.get(legacyKey);
    if(old&&JSON.stringify(encodePortableCatalog(await old.json()))===serialized)return json({id,version:x.version,digest});
   }
  }
  return problem("مفتاح العملية مستخدم لمحتوى مختلف.",409);
 };
 if(old)return replay(old);
 await files.put(key,serialized,{httpMetadata:{contentType:"application/json"}});
 const stmts=[];
 if(!access)stmts.push(db.prepare("INSERT INTO studio_catalogs(id,owner) VALUES(?,?) ON CONFLICT DO NOTHING").bind(id,uid));
 stmts.push(db.prepare(`INSERT INTO studio_catalog_versions(catalog,version,request_id,name,digest,object_key,created,request_digest)
  SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM studio_catalogs c LEFT JOIN studio_catalog_readers m ON m.catalog=c.id AND m.reader=?
   WHERE c.id=? AND (CASE WHEN c.owner=? THEN 'owner' ELSE m.role END)=? AND (c.owner=? OR m.role IN ('store','factory')))
  AND COALESCE((SELECT MAX(version) FROM studio_catalog_versions WHERE catalog=?),0)=? ON CONFLICT DO NOTHING`)
   .bind(id,ver,rid,view.name,digest,key,now,requestDigest,uid,id,uid,access?.role||"owner",uid,id,expected));
 const out=await db.batch(stmts);
 const permitted=await auth(db,id,uid);if(permitted?.role!==(access?.role||"owner"))return inaccessible();
 if(out.at(-1)?.meta.changes)return isScoped?snapshot(db,files,id,uid,permitted,permitted.version):json({id,version:ver,digest,role:'owner',subject:uid,scopeVersion:1},expected?200:201);
 const cached=await previous();return cached?replay(cached):problem("سبق نشر إصدار أحدث. حدّث القائمة وراجع التغييرات.",409);
}
