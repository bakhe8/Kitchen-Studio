import {checkedPortableArchive,projectView,mergeProjectEdit,projectScopeVersion,executeProjectOperation,proposeWholeKitchen,architectureWall} from "../../../lib/generated-shop-domain.mjs";
import {env} from "cloudflare:workers";
import {inspectShopRelease,inspectUnitBatch,manufacturingScope,approvedSale} from "../../../lib/verified-shop";
import {getChatGPTUser} from "../../chatgpt-auth";
import {logApprovals} from "../../../lib/approval-log";
import {accessSql,insertRevisionSql,projectReadRolesSql,scopedProjectRoles,projectReference,reassignmentRequired,type ProjectRole,json,keyIsValid,limitBytes,noCache,problem,readLimited,validEnvelope,guarded} from "../../../lib/project-revisions";
export const dynamic="force-dynamic";
// Any D1/R2 failure that escapes the handler answers with the same JSON shape as every other failure.
export function GET(request:Request){return guarded("projects.GET",()=>handleGet(request));}
export function POST(request:Request){return guarded("projects.POST",()=>handlePost(request));}
const unavailable=()=>problem("خدمة المشاريع غير مهيأة حاليًا. يبقى المشروع على الجهاز.",503);
type Access={role:ProjectRole;revision:number};
const access=(db:D1Database,id:string,user:string)=>db.prepare(accessSql).bind(user,user,id,user).first<Access>();
const objectKey=(id:string,digest:string)=>"kitchen-projects/"+id+"/"+digest+".json";
const denied=()=>problem("المشروع غير موجود أو ليس لك حق الوصول إليه.",404);

async function archivedDesign(object:R2ObjectBody,digest:string){
 if(object.size>limitBytes)throw Error("Oversized snapshot");
 const bytes=await object.arrayBuffer();
 const actual=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(n=>n.toString(16).padStart(2,"0")).join("");
 if(actual!==digest)throw Error("Snapshot checksum");
 const archive=JSON.parse(new TextDecoder().decode(bytes));
 checkedPortableArchive(archive);return archive;
}

async function snapshot(db:D1Database,bucket:R2Bucket,id:string,subject:string,auth:Access,revision:number){
 if(auth.role!=='owner'&&!scopedProjectRoles.has(auth.role))return reassignmentRequired();
 const row=await db.prepare('SELECT digest,name FROM studio_versions WHERE project_id=? AND revision=?').bind(id,revision).first<{digest:string;name:string}>();
 if(!row)return denied();const file=await bucket.get(objectKey(id,row.digest));if(!file)return unavailable();
 const raw=await archivedDesign(file,row.digest);
 const sale=auth.role==='rep'?await approvedSale(db,id,revision,auth.revision,row.digest,raw):undefined;
 const final=await access(db,id,subject);if(!final||final.role!==auth.role)return denied();
 const headers={...noCache,'Content-Type':'application/json; charset=utf-8','X-Studio-Revision':String(revision),'X-Studio-Role':auth.role,'X-Studio-Subject':subject,'X-Studio-Scope-Version':String(projectScopeVersion)};
 if(auth.role==='owner')return Response.json(raw,{headers});
 const view=projectView(auth.role,raw,{id,revision,name:projectReference(id),subject,approvedSale:final.revision===auth.revision?sale:{status:'pending'}});
 return view?Response.json(view,{headers}):problem('تعذّر تجهيز بيانات هذا الدور.',503);
}

async function handleGet(request:Request){
 const user=await getChatGPTUser();if(!user)return problem("سجّل الدخول لعرض مشاريعك.",401);
 const url=new URL(request.url),id=url.searchParams.get("id"),action=url.searchParams.get('action')||'snapshot';
 if(!id&&action==='session')return json({subject:user.userId});
 if(!['snapshot','access','batches','receipt','members','approvals','versions'].includes(action))return problem('عملية غير معروفة.',400);
 const db=env.DB,bucket=env.BUCKET;if(!db||!bucket)return unavailable();
 if(!id){
  if(action!=='snapshot')return problem('اختر مشروعًا.',400);
  // Only authenticated platform claims populate the exact-address share directory.
  await db.prepare("INSERT INTO studio_members(user_id,email) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email").bind(user.userId,user.email.trim().toLowerCase()).run();
  const {results}=await db.prepare(`SELECT p.id,v.name,v.updated,v.revision,
   CASE WHEN p.owner=? THEN 'owner' ELSE a.role END AS role FROM studio_projects p
   JOIN studio_versions v ON v.project_id=p.id AND v.revision=(SELECT MAX(revision) FROM studio_versions WHERE project_id=p.id)
   LEFT JOIN studio_access a ON a.project_id=p.id AND a.member=?
   WHERE p.owner=? OR a.role IN (${projectReadRolesSql}) ORDER BY v.updated DESC LIMIT 151`).bind(user.userId,user.userId,user.userId).all();
  return json({projects:results.slice(0,150).map((p:any)=>({...p,name:p.role==='owner'?p.name:projectReference(p.id),subject:user.userId,scopeVersion:projectScopeVersion})),truncated:results.length>150});
 }
 if(!keyIsValid(id))return denied();
 const auth=await access(db,id,user.userId);if(!auth)return denied();
 if(action==='access')return json({id,role:auth.role,revision:auth.revision,subject:user.userId,scopeVersion:projectScopeVersion,requiresRoleAssignment:auth.role!=='owner'&&!scopedProjectRoles.has(auth.role)});
 if(auth.role!=='owner'&&!scopedProjectRoles.has(auth.role))return reassignmentRequired();
 if(auth.role!=='owner'&&['batches','receipt','members','approvals'].includes(action))return problem('هذه البيانات متاحة للمالك فقط.',403);
 const finish=async(data:unknown)=>{const current=await access(db,id,user.userId);return current?.role===auth.role?json(data):denied();};
 if(url.searchParams.get("action")==="batches"){
  const data=await db.prepare("SELECT revision,design_key,unit_ids,material_minor,issued FROM studio_batches WHERE project_id=? ORDER BY issued LIMIT 256").bind(id).all();
  const whole=await db.prepare("SELECT revision FROM studio_releases WHERE project_id=? ORDER BY revision DESC LIMIT 1").bind(id).first();
  return finish({batches:data.results,whole});
 }
 if(url.searchParams.get("action")==="receipt"){
  const rev=Number(url.searchParams.get("revision")||auth.revision);
  if(!Number.isSafeInteger(rev)||rev<1)return problem("رقم النسخة غير صالح.",400);
  const receipt=await db.prepare("SELECT revision,digest,design_key,total_minor,issued,scope_json FROM studio_releases WHERE project_id=? AND revision=?").bind(id,rev).first();
  return finish({receipt:receipt??null});
 }
 if(url.searchParams.get("action")==="members"){
  if(auth.role!=="owner")return problem("إدارة المشاركين لمالك المشروع.",403);
  const {results}=await db.prepare("SELECT m.email,a.role FROM studio_access a JOIN studio_members m ON m.user_id=a.member WHERE a.project_id=? ORDER BY m.email").bind(id).all();
  return finish({members:results});
 }
 if(url.searchParams.get("action")==="approvals"){
  // Who put each approval stamp into the project, taken from the signed-in session when that revision was saved.
  const {results}=await db.prepare("SELECT revision,kind,subject,stamp_key,stamp_name,stamp_date,detail,actor_name,recorded FROM studio_approvals WHERE project_id=? ORDER BY revision DESC,kind,subject LIMIT 60").bind(id).all();
  return finish({approvals:results});
 }
 if(url.searchParams.get("action")==="versions"){
  const {results}=await db.prepare("SELECT revision,name,updated,bytes FROM studio_versions WHERE project_id=? ORDER BY revision DESC LIMIT 60").bind(id).all();
  return finish({versions:auth.role==='owner'?results:results.map((v:any)=>({revision:v.revision,updated:v.updated,name:projectReference(id)}))});
 }
 const requested=url.searchParams.get("revision"),rev=requested===null?auth.revision:Number(requested);
 if(!Number.isSafeInteger(rev)||rev<1)return problem("رقم النسخة غير صالح.",400);
 return snapshot(db,bucket,id,user.userId,auth,rev);
}

async function handlePost(request:Request){
 const user=await getChatGPTUser();if(!user)return problem("سجّل الدخول لحفظ المشروع.",401);
 const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return problem("الطلب من عنوان مختلف.",403);
 if(request.headers.get("X-Studio-Request")!=="1")return problem("الطلب غير معتمد.",403);
 const db=env.DB,bucket=env.BUCKET;if(!db||!bucket)return unavailable();
 const q=new URL(request.url).searchParams,id=q.get("id");if(!keyIsValid(id))return problem("مرجع المشروع غير صالح.",400);
 const action=q.get("action")||"save",uid=user.userId;
 const auth=await access(db,id,uid);
 if(action==='operation-preview'){
  if(!auth)return denied();if(!['factory','rep'].includes(auth.role))return problem('هذه العملية متاحة للمصنع أو المندوب حسب مهمته.',403);
  const expected=Number(q.get('expected'));if(!q.has('expected')||!Number.isSafeInteger(expected)||expected<1||expected!==auth.revision)return problem('حدّث المشروع قبل حساب العملية.',409);
  let input;try{input=JSON.parse(new TextDecoder().decode(await readLimited(request,256*1024)));}catch(e){return problem('بيانات العملية غير صالحة أو تتجاوز الحد المسموح.',e instanceof RangeError?413:400);}
  const row=await db.prepare('SELECT digest FROM studio_versions WHERE project_id=? AND revision=?').bind(id,expected).first<{digest:string}>();
  const file=row&&await bucket.get(objectKey(id,row.digest));if(!file)return unavailable();
  const full=await archivedDesign(file,row!.digest),computed=executeProjectOperation(auth.role,full,input,{id,subject:uid,expectedRevision:expected});
  const current=await access(db,id,uid);if(current?.role!==auth.role)return denied();if(current.revision!==expected)return problem('تغيّر المشروع أثناء حساب العملية.',409);
  if(!computed.ok)return problem('تعذّر حساب العملية بهذه البيانات. راجع القياسات والصلاحية والنسخة الحالية.',422);
  return json({type:'kitchen-operation-preview',version:1,project:{id,revision:expected},access:{role:auth.role,subject:uid,scopeVersion:projectScopeVersion},operation:{kind:input.operation.kind},result:computed.result,review:computed.review});
 }
 if(action==='design-preview'){
  if(!auth)return denied();if(auth.role!=='rep')return problem('تصميم البدائل متاح للمندوب.',403);
  const expected=Number(q.get('expected'));if(!q.has('expected')||!Number.isSafeInteger(expected)||expected!==auth.revision)return problem('حدّث المشروع قبل إعداد البدائل.',409);
  let options;try{options=JSON.parse(new TextDecoder().decode(await readLimited(request,2048)));}catch{return problem('خيارات التصميم غير صالحة.',400);}
  if(!options||Object.keys(options).some(k=>!['walls','sink','dishwasher','rice'].includes(k))||!Array.isArray(options.walls)||!options.walls.length||options.walls.length>4||new Set(options.walls).size!==options.walls.length||options.walls.some((w:unknown)=>typeof w!=='string'||w.length>80)||['sink','dishwasher','rice'].some(k=>typeof options[k]!=='boolean'))return problem('خيارات التصميم غير صالحة.',400);
  const row=await db.prepare('SELECT digest FROM studio_versions WHERE project_id=? AND revision=?').bind(id,expected).first<{digest:string}>();
  const file=row&&await bucket.get(objectKey(id,row.digest));if(!file)return unavailable();
  const full=await archivedDesign(file,row!.digest);if(options.walls.some((w:string)=>!architectureWall(full.design.room,w)))return problem('اختر جدرانًا من المشروع الحالي.',400);
  const proposal=await proposeWholeKitchen(full.design,{walls:options.walls,wanted:{sink:options.sink,dishwasher:options.dishwasher,rice:options.rice},limit:24});
  const current=await access(db,id,uid);if(current?.role!==auth.role)return denied();if(current.revision!==expected)return problem('تغيّر المشروع أثناء إعداد البدائل.',409);
  if(!proposal.ok)return problem('لم يتوفر بديل مناسب ضمن اختيارات المشروع الحالية. راجع قياسات الدور والخيارات مع المالك.',422);
  const meta={id,revision:expected,subject:uid},choices=proposal.candidates.slice(0,3).map((candidate:any)=>({editable:projectView('rep',{...full,design:candidate.doc},meta).editable}));
  return json({type:'kitchen-design-choices',version:1,project:{id,revision:expected},access:{role:auth.role,subject:uid,scopeVersion:projectScopeVersion},choices});
 }
 const issuedBatches=async()=> (await db.prepare("SELECT unit_ids,part_keys FROM studio_batches WHERE project_id=?").bind(id).all<{unit_ids:string;part_keys:string|null}>()).results;
 const earlierPartsChanged=(rows:{unit_ids:string;part_keys:string|null}[],keys:Record<string,string>)=>rows.some(r=>{
   const saved=r.part_keys?JSON.parse(r.part_keys):{};return JSON.parse(r.unit_ids).some((u:string)=>!keys[u]||keys[u]!==saved[u]);
 });
 if(action==="batch"){
  if(!auth)return denied();if(auth.role!=="owner")return problem("إطلاق دفعة القص لمالك المشروع فقط.",403);
  const rev=Number(q.get("revision")),review=q.get("review");
  if(!Number.isSafeInteger(rev)||rev!==auth.revision||!review||!/^[a-f0-9]{64}$/.test(review))return problem("راجع الوحدات من النسخة السحابية الحالية.",409);
  let ids;try{ids=JSON.parse(new TextDecoder().decode(await readLimited(request,24576))).unitIds;}catch{return problem("تعذّرت قراءة وحدات الدفعة.",400);}
  const row=await db.prepare("SELECT digest FROM studio_versions WHERE project_id=? AND revision=?").bind(id,rev).first<{digest:string}>();
  if(!row)return denied();
  const obj=await bucket.get(objectKey(id,row.digest));if(!obj)return unavailable();
  let b,scope;try{const archive=await archivedDesign(obj,row.digest);b=await inspectUnitBatch(archive,ids);scope=manufacturingScope(archive);}catch{return problem("تعذّر التحقق من قطع الدفعة.",422);}
  if(b.issues.length||b.materialMinor==null||!b.key||!b.unitIds)return json({error:b.issues.join(" "),issues:b.issues},422);
  if(b.key!==review)return problem("اختلف الرسم المحلي عن الدفعة المحفوظة. راجع النسخة المعروضة.",409);
  const lines=JSON.stringify(b.unitIds),earlier=await issuedBatches();
  if(earlierPartsChanged(earlier,scope.unitKeys))return problem("تغيّرت هندسة أو قطع وحدة سبق تصنيعها. طابق النسخة مع أمر الورشة قبل إصدار دفعة أخرى.",409);
  const partKeys=JSON.stringify(Object.fromEntries(b.unitIds.map((u:string)=>[u,scope.unitKeys[u]])));
  const receipt=()=>db.prepare("SELECT revision,design_key,unit_ids,material_minor,issued FROM studio_batches WHERE project_id=? AND revision=? AND design_key=?").bind(id,rev,review).first();
  const prior=await receipt();if(prior)return json({receipt:prior});
  await db.prepare(`INSERT INTO studio_batches(project_id,revision,design_key,unit_ids,part_keys,issuer,digest,material_minor,issued)
    SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM studio_projects WHERE id=? AND owner=?)
    AND (SELECT MAX(revision) FROM studio_versions WHERE project_id=?)=?
    AND NOT EXISTS (SELECT 1 FROM studio_releases WHERE project_id=?)
    AND NOT EXISTS (SELECT 1 FROM studio_batches b, json_each(b.unit_ids) issued, json_each(?) picked WHERE b.project_id=? AND issued.value=picked.value)
    ON CONFLICT DO NOTHING`)
    .bind(id,rev,review,lines,partKeys,uid,row.digest,b.materialMinor,new Date().toISOString(),id,uid,id,rev,id,lines,id).run();
  const saved=await receipt();return saved?json({receipt:saved}):problem("سبق إصدار وحدة من هذه الدفعة أو تغيّرت النسخة. اعرض الإيصالات وحدد الوحدات المتبقية.",409);
 }
 if(action==="release"||action==="remainder"){
  if(!auth)return denied();if(auth.role!=="owner")return problem("إيداع أمر التصنيع السحابي متاح للمالك فقط.",403);
  const rev=Number(q.get("revision"));
  if(!Number.isSafeInteger(rev)||rev<1||rev!==auth.revision)return problem("يلزم إصدار المشروع الحالي قبل إطلاق التصنيع.",409);
  const receipt=()=>db.prepare("SELECT revision,digest,design_key,total_minor,issued,scope_json FROM studio_releases WHERE project_id=? AND revision=?").bind(id,rev).first();
  const reviewed=q.get("review"),known=await receipt() as {design_key:string}|null;
  if(known)return reviewed&&reviewed!==known.design_key?problem("الرسم المحلي يختلف عن النسخة المعتمدة. راجع المشروع المحفوظ.",409):json({receipt:known});
  const row=await db.prepare("SELECT digest FROM studio_versions WHERE project_id=? AND revision=?").bind(id,rev).first<{digest:string}>();
  if(!row)return denied();
  const snapshot=await bucket.get(objectKey(id,row.digest));if(!snapshot)return unavailable();
  let check,scope;
  try{const archive=await archivedDesign(snapshot,row.digest);check=await inspectShopRelease(archive);scope=manufacturingScope(archive);}catch{return problem("فشل تدقيق الرسم أو الوصفة على الخادم.",422);}
  if(check.issues.length||!check.key||check.totalMinor==null)return json({error:check.issues.join(" "),issues:check.issues},422);
  if(reviewed&&reviewed!==check.key)return problem("الرسم المحلي يختلف عن الإصدار السحابي. ارفع نسخة جديدة قبل الإيداع.",409);
  const earlier=await issuedBatches(),already=new Set(earlier.flatMap(r=>JSON.parse(r.unit_ids) as string[]));
  if(earlierPartsChanged(earlier,scope.unitKeys))return problem("تغيرت وحدة سبق قصها. راجع أمرها قبل إنهاء بقية الطلب.",409);
  if(action==="remainder"&&!earlier.length||action==="release"&&earlier.length)return problem("راجع إيصالات الدفعات. استخدم أمر البنود المتبقية عند وجود إصدار سابق.",409);
  const remaining=scope.targets.filter(u=>!already.has(u)).sort();
  if(action==="remainder"){
    let expected;try{expected=JSON.parse(new TextDecoder().decode(await readLimited(request,32768))).remaining;}catch{return problem("راجع قائمة الوحدات المتبقية.",400);}
    if(!reviewed||!Array.isArray(expected)||JSON.stringify(expected)!==JSON.stringify(remaining)||!remaining.length)return problem("تغير نطاق البنود المتبقية أو سبق إتمامها.",409);
  }
  const now=new Date().toISOString();
  await db.prepare(`INSERT INTO studio_releases(project_id,revision,issuer,digest,design_key,total_minor,issued,scope_json)
   SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM studio_projects WHERE id=? AND owner=?)
   AND (SELECT MAX(revision) FROM studio_versions WHERE project_id=?)=? AND (SELECT COUNT(*) FROM studio_batches WHERE project_id=?)=? AND NOT EXISTS (SELECT 1 FROM studio_releases WHERE project_id=?) ON CONFLICT DO NOTHING`)
   .bind(id,rev,uid,row.digest,check.key,check.totalMinor,now,action==="remainder"?JSON.stringify(remaining):null,id,uid,id,rev,id,earlier.length,id).run();
  const deposited=await receipt();return deposited?json({receipt:deposited}):problem("تغيّرت النسخة أو سبق إطلاق المشروع أو بعض وحداته. راجع الإيصالات وأصدر الوحدات المتبقية فقط.",409);
 }
 if(action==="share"||action==="revoke"){
  if(!auth)return denied();if(auth.role!=="owner")return problem("المشاركة متاحة لمالك المشروع فقط.",403);
  let body;try{body=JSON.parse(new TextDecoder().decode(await readLimited(request,1024)));}catch{return problem("بيانات المشاركة غير صالحة.",400);}
  const email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";
  if(!email||email.length>254||!email.includes("@")||email===user.email.toLowerCase())return problem("أدخل بريد المشارك الصحيح.",400);
  if(action==="share"&&!["editor","viewer","store","factory","rep"].includes(body.role))return problem("اختر صلاحية المشارك.",400);
  const members=await db.prepare("SELECT user_id FROM studio_members WHERE email=? LIMIT 2").bind(email).all<{user_id:string}>();
  if(members.results.length!==1)return problem("يجب أن يفتح صاحب هذا البريد لوحة المشاريع بحسابه أولًا.",400);
  const target=members.results[0].user_id;
  if(action==="share")await db.prepare("INSERT INTO studio_access(project_id,member,role) VALUES(?,?,?) ON CONFLICT(project_id,member) DO UPDATE SET role=excluded.role").bind(id,target,body.role).run();
  else await db.prepare("DELETE FROM studio_access WHERE project_id=? AND member=?").bind(id,target).run();
  return json({ok:true});
 }
 if(!['save','patch','operation-apply'].includes(action))return problem("عملية غير معروفة.",400);
 const operationApply=action==='operation-apply';
 if(operationApply&&(!auth||!['factory','rep'].includes(auth.role)))return auth?problem('هذه العملية متاحة للمصنع أو المندوب حسب مهمته.',403):denied();
 const expected=Number(q.get("expected")),rid=q.get("request");let name=(q.get("name")||"").trim();
 if(!q.has("expected")||!Number.isSafeInteger(expected)||expected<0||!keyIsValid(rid)||name.length>90)return problem("راجع الاسم ومرجع النسخة.",400);
 if(!auth&&expected!==0)return denied();
 if(auth&&auth.role!=='owner'&&!scopedProjectRoles.has(auth.role))return reassignmentRequired();
 if(!auth){
  // Do not store uploads for an id already owned by another visitor.
  if(await db.prepare("SELECT 1 FROM studio_projects WHERE id=?").bind(id).first())return denied();
 }
 let bytes,archive,input;
 try{bytes=await readLimited(request,operationApply?256*1024:limitBytes);input=JSON.parse(new TextDecoder().decode(bytes));}
 catch(e){return e instanceof RangeError?problem("حد المزامنة ١٦ م.ب. استخدم تصدير ملف المشروع للمرفقات الأكبر.",413):problem("تعذّر قراءة بيانات المشروع.",400);}
 const scoped=!!auth&&auth.role!=='owner';
 if(scoped&&(input?.type!==(operationApply?'kitchen-project-operation':'kitchen-project-edit')||input.version!==1||input.baseRevision!==expected||!operationApply&&input.scopeVersion!==projectScopeVersion))return problem('أرسل تعديل بيانات دورك من الواجهة الحالية؛ لا يقبل هذا الدور أرشيفًا كاملًا.',403);
 if(!scoped&&(action==='patch'||!validEnvelope(input)||!name))return problem('ملف المشروع أو الاسم غير صالح.',400);
 const hash=async(value:Uint8Array<ArrayBuffer>)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',value))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const requestDigest=await hash(bytes);
 const prior=()=>db.prepare("SELECT revision,actor,digest,name,request_digest FROM studio_versions WHERE project_id=? AND request_id=?").bind(id,rid).first<{revision:number;actor:string;digest:string;name:string;request_digest:string|null}>();
 const replay=async(previous:{revision:number;actor:string;digest:string;name:string;request_digest:string|null})=>{
  if(previous.actor!==uid||(previous.request_digest||(!scoped?previous.digest:null))!==requestDigest||!scoped&&previous.name!==name)return problem("استُخدم مرجع العملية لنسخة مختلفة.",409);
  const current=await access(db,id,uid);if(!current)return denied();
  if(scoped)return snapshot(db,bucket,id,uid,current,current.revision);
  if(current.role!=='owner')return denied();
  await logApprovals(db,id,previous.revision,user,input);
  return json({id,revision:previous.revision,role:'owner',subject:uid,scopeVersion:projectScopeVersion});
 };
 const old=auth?await prior():null;if(old)return replay(old);
 if(auth&&auth.revision!==expected)return problem("توجد نسخة أحدث. افتحها أو احفظ تعديلك كمشروع مستقل.",409);
 if(scoped){
  const latest=await db.prepare("SELECT digest,name FROM studio_versions WHERE project_id=? AND revision=?").bind(id,auth.revision).first<{digest:string;name:string}>();
  const base=latest&&await bucket.get(objectKey(id,latest.digest));
  if(!base)return unavailable();
  const before=await archivedDesign(base,latest!.digest),merged=operationApply?executeProjectOperation(auth.role,before,input,{id,subject:uid,expectedRevision:expected}):mergeProjectEdit(auth.role,before,input,{expectedRevision:expected});
  if(!merged.ok)return problem('التعديل غير صالح ضمن بيانات دورك. راجع البيانات الظاهرة وحدّث المشروع.',403);
  if(operationApply){
   if(!merged.mutates)return problem('هذه معاينة للقراءة؛ لا توجد عملية حفظ.',422);
   if(!input.review||input.review!==merged.review)return problem('أعد معاينة العملية الحالية قبل تطبيقها.',409);
  }
  archive=merged.archive;name=latest!.name;bytes=new TextEncoder().encode(JSON.stringify(archive));
 }else archive=input;
 if(bytes.length>limitBytes)return problem('تجاوزت النسخة الكاملة حد الحفظ.',413);
 try{checkedPortableArchive(archive);}catch{return problem("الرسم أو المرفقات لا يمكن استعادتها. بقيت النسخة المحفوظة كما هي.",400);}
 const digest=await hash(bytes);
 // Upload first. A crash or losing writer cannot remove a committed snapshot.
 // Equal bodies map to identical keys. The D1 row is the publication boundary.
 await bucket.put(objectKey(id,digest),bytes,{onlyIf:{etagDoesNotMatch:"*"},httpMetadata:{contentType:"application/json"}});
 const now=new Date().toISOString(),rev=expected+1;
 const checkedRole=auth?.role||"owner";
 const record=db.prepare(insertRevisionSql).bind(id,rev,rid,uid,name,digest,bytes.length,now,id,expected,id,uid,checkedRole,uid,checkedRole,requestDigest);
 const result=await db.batch(auth?[record]:[db.prepare("INSERT INTO studio_projects(id,owner) VALUES(?,?) ON CONFLICT(id) DO NOTHING").bind(id,uid),record]);
 if(result.at(-1)?.meta.changes===1){
  await logApprovals(db,id,rev,user,archive);
  const current=await access(db,id,uid);if(!current||current.role!==checkedRole)return denied();
  return scoped?snapshot(db,bucket,id,uid,current,current.revision):json({id,revision:rev,role:'owner',subject:uid,scopeVersion:projectScopeVersion},expected?200:201);
 }
 const finalAccess=await access(db,id,uid);if(!finalAccess)return denied();
 if(finalAccess.role!==checkedRole)return problem("تغيّرت صلاحيتك أثناء الحفظ. حدّث المشروع قبل المحاولة.",403);
 const retry=await prior();return retry?replay(retry):problem("تعارض الإصدار. حُفظت النسخة السابقة، راجع أحدث نسخة قبل الدمج.",409);
}
