import {procurementAction,procurementView,stampOf} from '../../../lib/inventory-procurement';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {approvalState,batchReleaseState,catalogFingerprint,decodePortableCatalog,cleanIdea,orderHandoffUnits,remainderStockRequirements} from '../../../lib/generated-shop-domain.mjs';
import {accessSql,catalogAccessSql,json,keyIsValid,problem,readLimited,guarded} from '../../../lib/project-revisions';
import {balancesSQL,insertEventSQL,purchaseLines,stockDefinitions,type StockLine} from '../../../lib/inventory-ledger';
export const dynamic='force-dynamic';
// Any D1/R2 failure that escapes the handler answers with the same JSON shape as every other failure.
export function GET(req:Request){return guarded('inventory.GET',()=>handleGet(req));}
export function POST(req:Request){return guarded('inventory.POST',()=>handlePost(req));}
const latest='SELECT version,digest,object_key FROM studio_catalog_versions WHERE catalog=? ORDER BY version DESC LIMIT 1';
const versionRow=(db:D1Database,id:string,ver:number|null)=>ver===null?db.prepare(latest).bind(id).first<CatalogRow>():
 db.prepare('SELECT version,digest,object_key FROM studio_catalog_versions WHERE catalog=? AND version=?').bind(id,ver).first<CatalogRow>();
type CatalogRow={version:number;digest:string;object_key:string};
type Receipt={design_key:string;unit_ids?:string;scope_json?:string};
type Stock={key:string;physical:number;held:number;free:number;counted:number};
const denied=()=>problem('لا تملك صلاحية هذه العملية.',403);
async function requestData(req:Request){
 const u=await getChatGPTUser(),db=env.DB,files=env.BUCKET,q=new URL(req.url).searchParams,id=q.get('id');
 if(!u)return {error:problem('يلزم تسجيل الدخول.',401)};
 if(!db||!files)return {error:problem('تعذرت خدمة المخزون.',503)};
 if(!keyIsValid(id))return {error:problem('معرّف الكتالوج غير صالح.',400)};
 const role=await db.prepare(catalogAccessSql).bind(u.userId,u.userId,id,u.userId).first<{role:string}>();
 if(!role||!['owner','store'].includes(role.role))return {error:denied()};
 return {db,files,q,id,uid:u.userId,role:role.role};
}
const ownerReceiptList=`SELECT e.reservation,e.project,e.revision,e.scope,e.created,COALESCE((SELECT kind FROM studio_stock_events t WHERE t.catalog=e.catalog AND t.reservation=e.reservation AND t.kind IN ('cancel','consume')),'reserve') state
 FROM studio_stock_events e JOIN studio_projects p ON p.id=e.project LEFT JOIN studio_access a ON a.project_id=p.id AND a.member=?
 WHERE e.catalog=? AND e.kind='reserve' AND (p.owner=? OR a.role='store') ORDER BY e.created DESC LIMIT 100`;
async function sameAccess(db:D1Database,id:string,uid:string,role:string,project='',projectRole=''){
 return !!await db.prepare(`SELECT 1 FROM studio_catalogs c LEFT JOIN studio_catalog_readers m ON m.catalog=c.id AND m.reader=?1
  WHERE c.id=?2 AND (CASE WHEN c.owner=?1 THEN 'owner' ELSE m.role END)=?3 AND (?4='' OR EXISTS(
   SELECT 1 FROM studio_projects p LEFT JOIN studio_access a ON a.project_id=p.id AND a.member=?1 WHERE p.id=?4 AND (CASE WHEN p.owner=?1 THEN 'owner' ELSE a.role END)=?5))`).bind(uid,id,role,project,projectRole).first();
}
async function handleGet(req:Request){
 const ctx=await requestData(req);if(ctx.error)return ctx.error;
 const {db,files,id,uid,role,q}=ctx,project=q.get('project');
 if(q.has('action'))return problem('عملية غير معروفة.',400);
 if(project){
  if(!keyIsValid(project))return denied();const pa=await db.prepare(accessSql).bind(uid,uid,project,uid).first<{role:string}>();if(!pa||!['owner','store'].includes(pa.role))return denied();
  const out=await db.prepare(`SELECT revision,design_key,'whole' kind FROM studio_releases WHERE project_id=? UNION ALL
   SELECT revision,design_key,'batch' kind FROM studio_batches WHERE project_id=? ORDER BY revision DESC LIMIT 100`).bind(project,project).all();
  return await sameAccess(db,id,uid,role,project,pa.role)?json({receipts:out.results}):denied();
 }
 const manages=role==='owner'||role==='store',procurementStamp=manages?await stampOf({db,id,uid,role}):0;
 const ver=q.has('version')?Number(q.get('version')):null;
 if(ver!==null&&(!Number.isSafeInteger(ver)||ver<1))return problem('إصدار الكتالوج غير صالح.',400);
 const template=await versionRow(db,id,ver);
 const blob=template&&await files.get(template.object_key);if(!blob)return problem('نسخة الكتالوج غير متاحة.',404);
 const catalog=decodePortableCatalog(await blob.json())?.catalog;
 if(!catalog)return problem('بيانات إصدار الكتالوج غير صالحة.',503);
 const current=stockDefinitions(catalog.items);
 const balances=(await db.prepare(balancesSQL).bind(id).all<Stock&StockLine>()).results,b=new Map(balances.map(x=>[x.key,x]));
 const stocks=[...current,...balances.filter(x=>!current.some(i=>i.key===x.key))].map(x=>({...x,...(b.get(x.key)||{physical:null,held:0,free:null,counted:0})}));
 const reservations=manages?(await db.prepare(ownerReceiptList).bind(uid,id,uid).all()).results:[];
 const history=manages?(await db.prepare(`SELECT e.project,e.kind,e.note,e.created,e.revision FROM studio_stock_events e WHERE e.catalog=?
  AND (e.project='' OR EXISTS(SELECT 1 FROM studio_projects p LEFT JOIN studio_access a ON a.project_id=p.id AND a.member=? WHERE p.id=e.project AND (p.owner=? OR a.role='store')))
  ORDER BY e.created DESC LIMIT 30`).bind(id,uid,uid).all()).results:[];
 const procurement=await procurementView({db,id,uid,role});
 // Re-evaluate both independent ACLs in one final read after all async loads.
 // A project revoked while purchasing policies were loaded must not leak its PO.
 const final=await db.prepare(`SELECT CASE WHEN c.owner=?1 THEN 'owner' ELSE m.role END role,
  (SELECT json_group_array(p.id) FROM studio_projects p LEFT JOIN studio_access a ON a.project_id=p.id AND a.member=?1 WHERE p.owner=?1 OR a.role='store') projects
  FROM studio_catalogs c LEFT JOIN studio_catalog_readers m ON m.catalog=c.id AND m.reader=?1 WHERE c.id=?2`).bind(uid,id).first<{role:string;projects:string}>();
 if(final?.role!==role)return denied();const visible=new Set(JSON.parse(final.projects));
 const permitted=(row:any)=>!row.project||visible.has(row.project),withoutProject=({project,...row}:any)=>row;
 return json({role,procurement:{...procurement,orders:procurement.orders.filter(permitted).map(withoutProject)},procurementStamp,version:template!.version,stocks,reservations:reservations.filter(permitted),history:history.filter(permitted).map(withoutProject)});
}
async function handlePost(req:Request){
 if(req.headers.get('X-Studio-Request')!=='1'||(req.headers.has('origin')&&req.headers.get('origin')!==new URL(req.url).origin))return denied();
 const ctx=await requestData(req);if(ctx.error)return ctx.error;
 const {db,files,id,uid,role}=ctx;if(role!=='owner'&&role!=='store')return denied();
 let raw;try{raw=JSON.parse(new TextDecoder().decode(await readLimited(req,16000)));}catch{return problem('طلب غير صالح.',400);}
 if(!raw||typeof raw!=='object')return problem('طلب غير صالح.',400);
 const {action,request,note}=raw;
 if(!keyIsValid(request)||!['count','reserve','preview','cancel','consume','policy','propose','purchase','delivery','po-close'].includes(action)||typeof note!=='string'||!note.trim()||note.length>240)return problem('اختر العملية ودوّن مرجعها.',400);
 const procurement=['policy','propose','purchase','delivery','po-close'].includes(action);
 if(procurement){
  if(action==='delivery'||action==='po-close')return procurementAction({db,id,uid,role},raw,undefined,undefined);
  if(action==='policy'){
   if(!Number.isSafeInteger(raw.version)||raw.version<1)return problem('نسخة الكتالوج غير صالحة.',400);
   const v=await versionRow(db,id,raw.version),file=v&&await files.get(v.object_key);if(!file)return problem('لم يوجد إصدار المصنع.',404);
   const catalog=decodePortableCatalog(await file.json())?.catalog;
   if(!catalog)return problem('بيانات إصدار الكتالوج غير صالحة.',503);
   const defs=stockDefinitions(catalog.items);
   return procurementAction({db,id,uid,role},raw,undefined,defs.find(d=>d.key===raw.key));
  }
 }
 const fromRelease=action==='reserve'||action==='preview'||procurement;
 const sig=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([action,raw.key??'',raw.physical??null,raw.expected??null,raw.project??'',raw.revision??null,raw.scope??'',raw.version??null,raw.reservation??'',note.trim()]))))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const replay=async()=>{const e=await db.prepare('SELECT fingerprint,actor,reservation,project FROM studio_stock_events WHERE catalog=? AND request=?').bind(id,request).first<{fingerprint:string;actor:string;reservation:string;project:string}>();if(!e)return null;if(e.fingerprint!==sig||e.actor!==uid)return problem('مرجع العملية مستخدم لطلب آخر.',409);
  const pa=e.project?await db.prepare(accessSql).bind(uid,uid,e.project,uid).first<{role:string}>():null;
  if(e.project&&(!pa||!['owner','store'].includes(pa.role))||!await sameAccess(db,id,uid,role,e.project,pa?.role||''))return denied();return json({ok:true,reservation:e.reservation});};
 if(!procurement){const retried=await replay();if(retried)return retried;}
 let project='',revision=0,reservation='',scope='',units:string[]=[],lines:StockLine[]=[],counted=-1,expected=0,projectRole='';
 if(action==='count'){
  if(typeof raw.key!=='string'||raw.key.length>650||!Number.isSafeInteger(raw.physical)||raw.physical<0||raw.physical>1e6)return problem('اختر صنفًا وكمية صحيحة غير سالبة.',400);
  const balances=(await db.prepare(balancesSQL).bind(id).all<Stock&StockLine>()).results;
  const old=balances.find(b=>b.key===raw.key);if(raw.expected!==(old?.physical??null))return problem('تغيّر الرصيد منذ آخر عرض. حدّث المخزون.',409);
  const ver=raw.version??null;if(ver!==null&&(!Number.isSafeInteger(ver)||ver<1))return problem('إصدار الصنف غير صالح.',400);
  const v=await versionRow(db,id,ver),file=v&&await files.get(v.object_key);
  if(!file)return problem('تعذر قراءة نسخة المصنع.',503);
  const catalog=decodePortableCatalog(await file.json())?.catalog;
  if(!catalog)return problem('بيانات إصدار الكتالوج غير صالحة.',503);
  const def=stockDefinitions(catalog.items).find(b=>b.key===raw.key)||old;
  if(!def)return problem('لا يوجد هذا المقاس أو اللون في الكتالوج.',400);
  counted=old?.counted||0;expected=old?.physical||0;
  lines=[{key:def.key,name:def.name,sku:def.sku,qty:raw.physical-expected}];
 }else{
  if(fromRelease){project=raw.project;revision=raw.revision;scope=raw.scope;reservation=request;}
  else{
   if(!keyIsValid(raw.reservation))return problem('معرّف الحجز غير صالح.',400);
   const hit=await db.prepare("SELECT project,revision,scope,units,lines FROM studio_stock_events WHERE catalog=? AND reservation=? AND kind='reserve'").bind(id,raw.reservation).first<{project:string;revision:number;scope:string;units:string;lines:string}>();
   if(!hit)return problem('الحجز غير موجود.',404);reservation=raw.reservation;project=hit.project;revision=hit.revision;scope=hit.scope;units=JSON.parse(hit.units);lines=JSON.parse(hit.lines);
  }
  if(!keyIsValid(project)||!Number.isSafeInteger(revision)||revision<1||typeof scope!=='string'||!/^([0-9a-f]{64}|whole)$/.test(scope))return problem('اختر مشروعًا وإصدارًا وإيصالًا صالحًا.',400);
  const projectAccess=await db.prepare(accessSql).bind(uid,uid,project,uid).first<{role:string}>();if(!projectAccess||!['owner','store'].includes(projectAccess.role))return denied();
  projectRole=projectAccess.role;
  if(fromRelease){
   const rv=await db.prepare('SELECT digest FROM studio_versions WHERE project_id=? AND revision=?').bind(project,revision).first<{digest:string}>();
   const rc=scope==='whole'?await db.prepare('SELECT design_key,scope_json FROM studio_releases WHERE project_id=? AND revision=?').bind(project,revision).first<Receipt>():
    await db.prepare('SELECT design_key,unit_ids FROM studio_batches WHERE project_id=? AND revision=? AND design_key=?').bind(project,revision,scope).first<Receipt>();
   if(!rv||!rc)return problem('لا يوجد إفراج محفوظ لهذه النسخة والنطاق.',422);
   const blob=await files.get('kitchen-projects/'+project+'/'+rv.digest+'.json');if(!blob)return problem('تعذرت قراءة النسخة المعتمدة.',503);
   const bytes=await blob.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
   if(hash!==rv.digest)return problem('لا تطابق بيانات المشروع بصمة النسخة المحفوظة.',422);
   let archive;try{archive=JSON.parse(new TextDecoder().decode(bytes));}catch{return problem('ملف النسخة غير صالح.',422);}
   const doc=cleanIdea(archive.design),catalog=doc?.room?.workshop?.catalog,pin=catalog?.teamSource;
   if(!doc||pin?.id!==id||catalogFingerprint(catalog)!==pin.digest)return problem('النسخة لم تستخدم هذا الإصدار المنشور من كتالوج المصنع.',422);
   const verified=await db.prepare('SELECT 1 FROM studio_catalog_versions WHERE catalog=? AND version=? AND digest=?').bind(id,pin.version,pin.digest).first();if(!verified)return problem('إصدار المصنع غير مطابق.',422);
   units=rc.unit_ids?JSON.parse(rc.unit_ids):rc.scope_json?JSON.parse(rc.scope_json):orderHandoffUnits(doc).map(u=>u.id);
   const computed=scope==='whole'?await approvalState(doc):await batchReleaseState(doc,units);
   const key='keys' in computed?computed.keys.release:computed.key;
   if(key!==rc.design_key||!computed.quote)return problem('لم يعد الحساب يطابق إيصال التصنيع المحفوظ.',422);
   try{
    const material=rc.scope_json?remainderStockRequirements(doc,units):null;
    if(material?.issues.length)return problem(projectRole==='owner'?material.issues.join(' '):'تعذّر إعداد احتياج الخام لهذا النطاق. راجع المالك.',422);
    const purchases=material?.purchases||(computed.quote as unknown as {purchases:Parameters<typeof purchaseLines>[1]}).purchases;
    lines=purchaseLines(catalog.items,purchases);
   }catch{return problem('تعذرت مطابقة أصناف الخام والبواقي.',422);}
   if(!lines.length)return problem('لا يحتوي هذا النطاق على خام مخزني مسجل. الخدمات والأسطح الموردة خارجيًا خارج دفتر المخزون.',422);
   if(procurement)return procurementAction({db,id,uid,role,projectRole},raw,{project,revision,scope,units,lines},undefined);
   if(action==='preview'){
    const balances=(await db.prepare(balancesSQL).bind(id).all<Stock>()).results;
    if(!await sameAccess(db,id,uid,role,project,projectRole))return denied();
    return json({lines:lines.map(l=>({...l,free:balances.find(b=>b.key===l.key)?.free??null})),units});
   }
  }
 }
 const r=await db.prepare(insertEventSQL).bind(id,request,action,sig,reservation,project,revision,scope,JSON.stringify(units),JSON.stringify(lines),note.trim(),uid,new Date().toISOString(),counted,expected,role,projectRole).run();
 if(r.meta.changes===1)return json({ok:true,reservation},201);
 return await replay()||problem('تعذّرت العملية: رصيد مجهول أو غير كافٍ، أو حجز متداخل، أو سبق صرف الحجز/إلغاؤه، أو تغيّر الجرد. حدّث المخزون.',409);
}
