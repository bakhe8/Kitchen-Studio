import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
import {releaseFileStamp,drawingDXF,outputFilename,orderHandoffUnits,releasedScribeDXF,releasedSurfaceDXF,installJobIssues} from "../../../lib/generated-shop-domain.mjs";
import {accessSql,json,keyIsValid,problem,readLimited,limitBytes,guarded,projectReference} from "../../../lib/project-revisions";
import {cleanDeliveryObservation,deliveryObservations} from "../../../public/kitchen-delivery-domain.js";
import {maintenanceActions,maintenanceOwnerActions,reviewMaintenanceCommand} from "../../../public/kitchen-maintenance-domain.js";
export const dynamic="force-dynamic";
// Any D1/R2 failure that escapes the handler answers with the same JSON shape as every other failure.
export function GET(req:Request){return guarded("jobs.GET",()=>handleGet(req));}
export function POST(req:Request){return guarded("jobs.POST",()=>handlePost(req));}
type Check={key:string,label:string,nominal:number,unit:string,maxTolerance?:number};
type JobUnit={id:string,name:string,partCount:number,checks:Check[],scribes?:{id:string;label:string}[]};
type Receipt={receipt:string,revision:number,digest:string,units:string|null,issued:string};
type EventRow={project:string,unit:string,seq:number,receipt:string,revision:number,request_id:string,request_hash:string,actor:string,actor_name:string,action:string,state:string,payload:string,created:string};
const ref=(s:unknown,n:number):s is string=>typeof s==="string"&&!!s.trim()&&s.length<=n;
const receiptsSql=`SELECT 'full:'||design_key receipt,revision,digest,scope_json units,issued FROM studio_releases WHERE project_id=? UNION ALL SELECT 'batch:'||design_key receipt,revision,digest,unit_ids units,issued FROM studio_batches WHERE project_id=?`;
// A stored snapshot is content-addressed: its key holds the SHA-256 of its bytes. Every request used to download it again (up to 16 MB), hash it, parse it and
// rebuild the order units, even to record a single inspection reading. A verified snapshot is now kept for this isolate and re-used while R2 still reports the
// same etag and size for that key (a cheap HEAD), so an object that was replaced or damaged is still caught on the very next request.
type Stored={etag:string;size:number;design:unknown;units:Map<string,JobUnit[]>};
const keepBytes=2_000_000,keepEntries=3,verified=new Map<string,Stored>();
async function savedDesign(bucket:R2Bucket,id:string,expectedDigest:string):Promise<Stored>{
 const name="kitchen-projects/"+id+"/"+expectedDigest+".json";
 const head=await bucket.head(name);if(!head)throw Error('Snapshot absent');
 const hit=verified.get(name);
 if(hit&&hit.etag===head.etag&&hit.size===head.size){verified.delete(name);verified.set(name,hit);return hit;}
 const file=await bucket.get(name);if(!file)throw Error('Snapshot absent');
 const bytes=await file.arrayBuffer();if(bytes.byteLength>limitBytes)throw Error('Oversize stored design');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 if(digest!==expectedDigest)throw Error('Stored design fingerprint mismatch');
 const archive=JSON.parse(new TextDecoder().decode(bytes)) as {design:unknown};
 const entry:Stored={etag:file.etag,size:file.size,design:archive.design,units:new Map()};
 verified.delete(name);
 if(bytes.byteLength<=keepBytes){verified.set(name,entry);while(verified.size>keepEntries)verified.delete(verified.keys().next().value as string);}
 return entry;
}
async function issuedUnits(db:D1Database,bucket:R2Bucket,id:string,key:string){
 const receipt=await db.prepare("SELECT * FROM ("+receiptsSql+") WHERE receipt=?").bind(id,id,key).first<Receipt>();
 if(!receipt)return null;
 const stored=await savedDesign(bucket,id,receipt.digest),design=stored.design;
 const retained=receipt.units?JSON.parse(receipt.units):undefined;
 // The units depend only on the stored snapshot and on this receipt's scope, so they are built once per snapshot; every request works on its own copy of the list.
 const scope=receipt.receipt+"|"+(receipt.units||"");
 let base=stored.units.get(scope);
 if(!base){base=orderHandoffUnits(design,retained,receipt.receipt.startsWith('full:')&&retained?'whole-filter':undefined) as JobUnit[];stored.units.set(scope,base);}
 const units:JobUnit[]=[...base];
 const events=(await db.prepare("SELECT * FROM studio_job_events WHERE project=? AND receipt=? ORDER BY unit,seq").bind(id,key).all<EventRow>()).results;
 for(const e of events.filter(e=>e.action==="plan")){
  const x=JSON.parse(e.payload).unit as JobUnit;const idx=units.findIndex(u=>u.id===e.unit);if(idx<0)units.push(x);else units[idx]=x;
 }
 return {receipt,units,events,design};
}
async function context(req:Request){
 const user=await getChatGPTUser();if(!user)return {error:problem("سجّل الدخول.",401)};
 const db=env.DB,bucket=env.BUCKET;if(!db||!bucket)return {error:problem("خدمة أوامر الورشة غير متاحة.",503)};
 const q=new URL(req.url).searchParams,id=q.get("id");if(!keyIsValid(id))return {error:problem("اختر مشروعًا محفوظًا.",400)};
 const auth=await db.prepare(accessSql).bind(user.userId,user.userId,id,user.userId).first<{role:string}>();
 if(!auth)return {error:problem("المشروع غير متاح.",404)};
 if(!['owner','factory'].includes(auth.role))return {error:problem('أوامر الورشة متاحة للمصنع أو المالك فقط.',403)};
 return {user,db,bucket,q,id,role:auth.role};
}
const stillAllowed=async(c:Awaited<ReturnType<typeof context>>)=>!c.error&&(await c.db.prepare(accessSql).bind(c.user.userId,c.user.userId,c.id,c.user.userId).first<{role:string}>())?.role===c.role;
const factoryStamp=(id:string,revision:number,issued:string,scope:string,purpose:string)=>({project:projectReference(id),projectName:projectReference(id),revision:'R-'+revision,scope,purpose,issued,cloudRevision:revision,status:'released'});
function factoryEvent(e:EventRow){
 // Delivery annotations are explicitly shared technical records. Existing
 // stage notes, customer/location details and actor names remain private.
 const p=JSON.parse(e.payload),data=e.action==='warranty-record'?{terms:p.terms}:e.action==='service-open'?{ticket:p.ticket,status:p.status}:e.action==='service-review'?{ticketId:p.ticketId,diagnosis:p.diagnosis,coverage:p.coverage,reference:p.reference,warranty:p.warranty,status:p.status}:e.action==='service-repair'?{ticketId:p.ticketId,work:p.work,verification:p.verification,status:p.status}:e.action==='service-close'?{ticketId:p.ticketId,status:p.status}:e.action==='service-reopen'?{ticketId:p.ticketId,reason:p.reason,status:p.status}:e.action==='observe'?{observation:p.observation}:e.action==='resolve'?{observationId:p.observationId,note:p.note}:e.action==='plan'?{unit:p.unit,tolerances:p.tolerances}:e.action==='qc'?{checks:p.checks,passed:p.passed}:e.action==='pack'?{siteRevision:p.siteRevision,label:p.label}:e.action==='install'?{siteRevision:p.siteRevision}:{};
 return {unit:e.unit,seq:e.seq,action:e.action,state:e.state,date:e.created,data};
}
async function handleGet(req:Request){
 const c=await context(req);if(c.error)return c.error;
 const {q,id,db,bucket,role}=c,key=q.get("receipt");
 const action=q.get('action')||'snapshot';if(!['snapshot','surface-dxf','scribe-dxf'].includes(action)||!key&&action!=='snapshot')return problem('عملية غير معروفة.',400);
 if(!key){const {results}=await db.prepare("SELECT receipt,revision,issued FROM ("+receiptsSql+") ORDER BY issued DESC LIMIT 500").bind(id,id).all();return await stillAllowed(c)?json({receipts:results,role,subject:c.user.userId,serverNow:new Date().toISOString()}):problem('المشروع غير متاح.',404);}
 if(!/^(full|batch):[0-9a-f]{64}$/.test(key))return problem("مرجع غير صالح.",400);
 let job;try{job=await issuedUnits(db,bucket,id,key);}catch{return problem('تعذّر إثبات مطابقة النسخة المحفوظة للإيصال.',503);}if(!job)return problem("لم يصدر إيصال لهذا النطاق.",404);
 if(q.get('action')==='surface-dxf'||q.get('action')==='scribe-dxf'){
  const uid=q.get('unit');if(!uid||!job.units.some(u=>u.id===uid))return problem("القطعة خارج نطاق هذا الإيصال.",404);
  const shape=q.get('shape')||'',scribe=q.get('action')==='scribe-dxf';
  const data=scribe?releasedScribeDXF(job.design,uid,shape):releasedSurfaceDXF(job.design,uid);if(!data)return problem("لا يتضمن الإيصال قالبًا رقميًا مقاسًا لهذه القطعة.",422);
  const purpose=scribe?'قالب الحشوة المقاسة':'قالب سطح العمل المقاس',stamp=role==='owner'?releaseFileStamp(job.design,id,job.receipt,uid,purpose):factoryStamp(id,job.receipt.revision,job.receipt.issued,uid,purpose);
  const filename=outputFilename(stamp,uid+(scribe?'-scribe-'+shape.slice(0,12):'')+'-mm','dxf');
  if(!await stillAllowed(c))return problem('المشروع غير متاح.',404);
  return new Response(drawingDXF(data,stamp),{headers:{'Content-Type':'application/dxf','Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="'+filename+'"'}});

 }
 const units=job.units.map(u=>u.id.startsWith('surface:')?{...u,downloadableCut:!!releasedSurfaceDXF(job.design,u.id)}:u);
 const stamp=role==='owner'?releaseFileStamp(job.design,id,job.receipt,'وحدات الإيصال','أمر التصنيع'):factoryStamp(id,job.receipt.revision,job.receipt.issued,'وحدات الإيصال','أمر التصنيع');
 if(!await stillAllowed(c))return problem('المشروع غير متاح.',404);
 return json({stamp,receipt:key,revision:job.receipt.revision,role,subject:c.user.userId,serverNow:new Date().toISOString(),units,events:job.events.map(e=>role==='factory'?factoryEvent(e):({unit:e.unit,seq:e.seq,action:e.action,state:e.state,who:e.actor_name,date:e.created,data:JSON.parse(e.payload)}))});
}
const fnvText=async(x:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(x))),v=>v.toString(16).padStart(2,'0')).join('');
async function handlePost(req:Request){
 const c=await context(req);if(c.error)return c.error;
 const {q,id,db,bucket,user,role}=c,receipt=q.get("receipt"),rid=q.get("request");
 if(req.headers.get("X-Studio-Request")!=="1"||req.headers.has("origin")&&req.headers.get("origin")!==new URL(req.url).origin)return problem("الطلب غير معتمد.",403);
 // A persisted delivery draft belongs to the account that loaded it. Check
 // this before both new writes and idempotent replays; old clients may omit it.
 if(req.headers.has('X-Studio-Subject')&&req.headers.get('X-Studio-Subject')!==user.userId)return problem('تغيّر الحساب منذ إعداد المسودة. افتح الإيصال بالحساب الصحيح قبل تسجيلها.',403);
  if(!["owner","factory"].includes(role))return problem("تسجيل عمليات الورشة متاح للمصنع أو المالك.",403);
 if(!receipt||!/^(full|batch):[a-f0-9]{64}$/.test(receipt)||!keyIsValid(rid))return problem("مرجع الإيصال أو العملية غير صالح.",400);
 let body;try{body=JSON.parse(new TextDecoder().decode(await readLimited(req,48000)));}catch{return problem("بيانات العملية غير صالحة.",400);}
 const {action,unit,expected}=body||{};
 if(!["plan","qc","pack","install","accept","observe","resolve",...maintenanceActions].includes(action)||!ref(unit,190)||!Number.isInteger(expected)||expected<0)return problem("حدّد الوحدة والمرحلة ونسخة السجل.",400);
 if(["plan","accept",...maintenanceOwnerActions].includes(action)&&role!=="owner")return problem("اعتماد السماحات والضمان والتغطية والاستلام متاح لمالك المشروع.",403);
 if(['observe','resolve'].includes(action)&&Object.keys(body).some(k=>!(action==='observe'?['action','unit','expected','observation']:['action','unit','expected','observationId','note']).includes(k)))return problem('تحتوي الملاحظة على حقول غير مسموحة.',422);
 const hash=await fnvText(JSON.stringify([receipt,body]));
 const replay=async()=>{const x=await db.prepare("SELECT seq,state,request_hash,actor FROM studio_job_events WHERE project=? AND request_id=?").bind(id,rid).first<{seq:number,state:string,request_hash:string,actor:string}>();
  if(!x)return null;if(!await stillAllowed(c))return problem('المشروع غير متاح.',404);
  return x.request_hash===hash&&x.actor===user.userId?json({seq:x.seq,state:x.state}):problem("مرجع العملية مرتبط بحدث آخر.",409);};
 const old=await replay();if(old)return old;
 let job;try{job=await issuedUnits(db,bucket,id,receipt);}catch{return problem('تعذّر إثبات مطابقة النسخة المحفوظة للإيصال.',503);}if(!job)return problem("يلزم إيصال إفراج فعلي أولًا.",409);
 const u=job.units.find(x=>x.id===unit);if(!u)return problem("الوحدة خارج نطاق إيصال التصنيع أو لا تحتوي قطعًا مصنّعة.",422);
 const events=job.events.filter(e=>e.unit===unit),latest=events.at(-1);
 if((latest?.seq||0)!==expected)return problem("تغيّر سجل الوحدة. حدّث الصفحة.",409);
 const required:Record<string,string>={plan:"issued",qc:"planned",pack:"passed",install:"packed",accept:"installed"};
 const currentState=latest?.state||'issued',annotating=['observe','resolve'].includes(action),servicing=maintenanceActions.includes(action);
 if(servicing?currentState!=='accepted':annotating?!['packed','installed'].includes(currentState):currentState!==required[action])return problem("أكمل المرحلة السابقة أو راجع سجل هذه الوحدة.",409);
 const eventView=events.map(e=>({unit:e.unit,seq:e.seq,action:e.action,state:e.state,date:e.created,data:JSON.parse(e.payload)})),observations=deliveryObservations(eventView);
 if(['install','accept'].includes(action)&&observations.some(o=>!o.resolved&&o.severity==='blocking'))return problem('عالج الملاحظات المانعة المفتوحة وسجّل نتيجة معالجتها قبل التركيب أو استلام العميل.',422);
 let decisionRevision:number|null=null;
 if(action==='pack'||action==='install'){
  const head=await db.prepare("SELECT revision,digest FROM studio_versions WHERE project_id=? ORDER BY revision DESC LIMIT 1").bind(id).first<{revision:number;digest:string}>();
  if(!head)return problem("تعذّر التحقق من آخر إصدار محفوظ للمشروع.",409);
  try{
   const current=head.digest===job.receipt.digest?job.design:(await savedDesign(bucket,id,head.digest)).design;
   const issues=installJobIssues(job.design,current,unit,action==='pack'?'ship':'install');
   if(issues.length)return problem(role==='owner'?issues.join(' '):'لم تكتمل بيانات الجاهزية لهذه المرحلة. راجع المالك.',422);
  }catch{return problem("تعذّر التحقق من بيانات الجاهزية في آخر نسخة محفوظة.",503);}
  decisionRevision=head.revision;
 }
 let payload:Record<string,unknown>={},state="";const now=new Date().toISOString();
 if(servicing){
  try{payload=reviewMaintenanceCommand(u,eventView,body,{requestId:rid,now});}
  catch(error){const failure=error as {message?:string;status?:number};return problem(failure.message||'راجع بيانات إجراء الصيانة.',failure.status===409?409:422);}
  state='accepted';
 }else if(action==='observe'){
  const observation=cleanDeliveryObservation(u,body.observation);
  if(!observation)return problem('راجع نص الملاحظة ونوعها وموضعها ضمن فحوص الوحدة الصادرة.',422);
  state=currentState;payload={observation:{id:rid,...observation}};
 }else if(action==='resolve'){
  if(!ref(body.observationId,64)||!ref(body.note,500)||!observations.some(o=>o.id===body.observationId&&!o.resolved))return problem('اختر ملاحظة مفتوحة لهذه الوحدة ودوّن نتيجة المعالجة.',422);
  state=currentState;payload={observationId:body.observationId,note:body.note.trim()};
 }else if(action==="plan"){
  if(!ref(body.reference,180)||!body.tolerances)return problem("أدخل مرجع السماحات قبل تسجيل أي قياس فعلي.",422);
  const tol:Record<string,number>={};
  for(const f of u.checks){const n=body.tolerances[f.key];if(!Number.isFinite(n)||n<0||n>f.nominal||f.maxTolerance!=null&&n>f.maxTolerance||f.unit==='قطعة'&&n!==0)return problem("أدخل سماحة صحيحة لكل بعد. العدد سماحته صفر.",422);tol[f.key]=n;}
  state="planned";payload={unit:u,tolerances:tol,reference:body.reference.trim()};
 }else if(action==="qc"){
  if(!body.actual||!ref(body.note,500))return problem("أدخل قراءات الفحص وملاحظة الفاحص.",422);
  const plan=JSON.parse(events[0].payload),checks:Record<string,{actual:number,delta:number,ok:boolean}>={};let pass=true;
  for(const f of u.checks){const n=body.actual[f.key];if(!Number.isFinite(n)||n<0||n>100000||f.unit==='قطعة'&&!Number.isInteger(n))return problem("الفحص يحتاج قراءة حقيقية لكل بعد أو عدد.",422);
   const delta=Math.round((n-f.nominal)*1000000)/1000000,ok=Math.abs(delta)<=plan.tolerances[f.key];if(!ok)pass=false;checks[f.key]={actual:n,delta,ok};}
  state=pass?"passed":"planned";payload={checks,passed:pass,note:body.note.trim()};
 }else{
  if(!ref(body.note,500))return problem("دوّن نتيجة المعاينة أو رقم محضر التسليم.",422);
  if(action==="install"&&!ref(body.location,160)||action==="accept"&&!ref(body.customer,140))return problem("أدخل موقع التركيب أو اسم العميل المستلم.",422);
  state=({pack:"packed",install:"installed",accept:"accepted"} as Record<string,string>)[action];
  payload={note:body.note.trim(),...(decisionRevision!==null?{siteRevision:decisionRevision}:{}),...(action==="pack"?{label:receipt+"/"+unit}:{}),...(action==="install"?{location:body.location.trim()}:{}),...(action==="accept"?{customer:body.customer.trim()}:{})};
 }
 const seq=expected+1;
 const out=await db.prepare(`INSERT INTO studio_job_events(project,unit,seq,receipt,revision,request_id,request_hash,actor,actor_name,action,state,payload,created)
  SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COALESCE(MAX(seq),0) FROM studio_job_events WHERE project=? AND unit=?)=?
  AND (? IS NULL OR ?=(SELECT MAX(revision) FROM studio_versions WHERE project_id=?))
  AND NOT EXISTS(SELECT 1 FROM studio_job_events WHERE project=? AND unit=? AND receipt<>?)
   AND EXISTS(SELECT 1 FROM studio_projects p WHERE p.id=? AND ((p.owner=? AND ?='owner') OR (? NOT IN ('plan','accept','warranty-record','service-review','service-close') AND EXISTS(SELECT 1 FROM studio_access a WHERE a.project_id=p.id AND a.member=? AND a.role=? AND a.role='factory'))))
   ON CONFLICT DO NOTHING`).bind(id,unit,seq,receipt,job.receipt.revision,rid,hash,user.userId,user.displayName||user.email,action,state,JSON.stringify(payload),now,id,unit,expected,decisionRevision,decisionRevision,id,id,unit,receipt,id,user.userId,role,action,user.userId,role).run();
 if(out.meta.changes===1)return json({seq,state},201);
 return (await replay())||problem("تغيّر إصدار المشروع أو سجل الوحدة أو قُيدت الوحدة في إيصال آخر.",409);
}
