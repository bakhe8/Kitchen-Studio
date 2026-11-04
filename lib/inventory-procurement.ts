// Purchase commitments never change physical stock. Only a separately evidenced
// delivery posts a positive movement into the very same ledger used by reservation.
import {balancesSQL,type StockLine} from './inventory-ledger';
import {accessSql,json,keyIsValid,problem} from './project-revisions';
type Policy={supplier:string;vendorSku:string;pack:number;minimumPacks:number;reorder:number;target:number};
type OrderLine=StockLine&{demand:number;policy:Policy};
type PurchaseRow={request:string;project:string;revision:number;scope:string;units:string;note:string;created:string;lines:string;received:number;closed:number;reserved:number;allocated:number};
type Context={db:D1Database;id:string;uid:string;role:string;projectRole?:string};
type Document={project:string;revision:number;scope:string;units:string[];lines:StockLine[]};
type Input={action:string;request:string;note:string;key?:string;policy?:Policy;order?:string;quantity?:number;stamp?:number};
const ref=(s:unknown,n:number):s is string=>typeof s==='string'&&!!s.trim()&&s.length<=n;
const qty=(n:unknown,min:number):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min&&n<=1000000;
const conflict=()=>problem('تغيّر الطلب أو الرصيد، أو استخدم رقم المستند سابقًا. حدّث الحصر قبل التأكيد.',409);
const ordersSql=`SELECT o.request,o.project,o.revision,o.scope,o.units,o.note,o.created,o.lines,
 COALESCE((SELECT SUM(json_extract(r.lines,'$[0].qty')) FROM studio_stock_events r WHERE r.catalog=o.catalog AND r.reservation=o.request AND r.kind='delivery'),0) received,
 EXISTS(SELECT 1 FROM studio_stock_events r WHERE r.catalog=o.catalog AND r.reservation=o.request AND r.kind='po-close') closed,
 EXISTS(SELECT 1 FROM studio_stock_events r WHERE r.catalog=o.catalog AND r.project=o.project AND r.kind='reserve' AND NOT EXISTS(SELECT 1 FROM studio_stock_events c WHERE c.catalog=r.catalog AND c.kind='cancel' AND c.reservation=r.request) AND NOT EXISTS(SELECT 1 FROM json_each(o.units) u WHERE u.value NOT IN (SELECT value FROM json_each(r.units)))) reserved,
 COALESCE((SELECT SUM(json_extract(part.value,'$.qty')) FROM studio_stock_events r,json_each(r.lines) part
  WHERE r.catalog=o.catalog AND r.project=o.project AND r.kind='reserve' AND json_extract(part.value,'$.key')=json_extract(o.lines,'$[0].key')
  AND NOT EXISTS(SELECT 1 FROM studio_stock_events c WHERE c.catalog=r.catalog AND c.kind='cancel' AND c.reservation=r.request)
  AND NOT EXISTS(SELECT 1 FROM json_each(r.units) u WHERE u.value NOT IN (SELECT value FROM json_each(o.units)))),0) allocated
 FROM studio_stock_events o WHERE o.catalog=?1 AND o.kind='purchase'`;
const policiesSql=`SELECT lines FROM studio_stock_events p WHERE p.catalog=?1 AND p.kind='policy' AND p.rowid=(SELECT MAX(c.rowid) FROM studio_stock_events c WHERE c.catalog=p.catalog AND c.kind='policy' AND c.reservation=p.reservation)`;
const policyOf=(p:Policy|undefined):Policy|null=>p&&ref(p.supplier,120)&&ref(p.vendorSku,80)&&qty(p.pack,1)&&qty(p.minimumPacks,1)&&qty(p.reorder,0)&&qty(p.target,p.reorder)?{supplier:p.supplier.trim(),vendorSku:p.vendorSku.trim(),pack:p.pack,minimumPacks:p.minimumPacks,reorder:p.reorder,target:p.target}:null;
const stampOf=async(c:Context)=>(await c.db.prepare('SELECT COALESCE(MAX(rowid),0) n FROM studio_stock_events WHERE catalog=?').bind(c.id).first<{n:number}>())!.n;
async function loadOrders(c:Context){return (await c.db.prepare(ordersSql+' ORDER BY o.rowid DESC').bind(c.id).all<PurchaseRow>()).results;}
export async function procurementView(c:Context){
 const rows=(await c.db.prepare(ordersSql+` AND (o.project='' OR EXISTS(SELECT 1 FROM studio_projects p LEFT JOIN studio_access a ON a.project_id=p.id AND a.member=?2 WHERE p.id=o.project AND (p.owner=?2 OR a.role='store'))) ORDER BY o.rowid DESC`).bind(c.id,c.uid).all<PurchaseRow>()).results;
 const orders=rows.map(r=>{const l:OrderLine=JSON.parse(r.lines)[0];return {project:r.project,id:r.request,reference:r.note,created:r.created,key:l.key,name:l.name,supplier:l.policy.supplier,ordered:l.qty,received:r.received,open:r.closed?0:l.qty-r.received,protected:!r.closed&&!r.reserved&&r.allocated<l.demand};}).filter(x=>x.open>0||x.protected);
 const policies=(await c.db.prepare(policiesSql).bind(c.id).all<{lines:string}>()).results.map(x=>JSON.parse(x.lines)[0]);
 return {orders,policies};
}
const insert=`INSERT INTO studio_stock_events(catalog,request,kind,fingerprint,reservation,project,revision,scope,units,lines,note,actor,created)
 SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13 WHERE EXISTS(SELECT 1 FROM studio_catalogs c LEFT JOIN studio_catalog_readers m ON m.catalog=c.id AND m.reader=?12
  WHERE c.id=?1 AND (CASE WHEN c.owner=?12 THEN 'owner' ELSE m.role END)=?15 AND (c.owner=?12 OR m.role='store'))
 AND (?6='' OR EXISTS(SELECT 1 FROM studio_projects p LEFT JOIN studio_access a ON a.project_id=p.id AND a.member=?12 WHERE p.id=?6 AND (CASE WHEN p.owner=?12 THEN 'owner' ELSE a.role END)=?16 AND (p.owner=?12 OR a.role='store')))
 AND (SELECT COALESCE(MAX(rowid),0) FROM studio_stock_events WHERE catalog=?1)=?14
 AND NOT EXISTS(SELECT 1 FROM studio_stock_events x WHERE x.catalog=?1 AND (
  ?3='purchase' AND x.kind='purchase' AND lower(trim(x.note))=lower(trim(?11)) AND json_extract(x.lines,'$[0].key')=json_extract(?10,'$[0].key')
  OR ?3='delivery' AND x.kind='delivery' AND x.reservation=?5 AND lower(trim(x.note))=lower(trim(?11))))
 ON CONFLICT(catalog,request) DO NOTHING`;
export async function procurementAction(c:Context,b:Input,doc:Document|undefined,def:{key:string;sku:string;name:string}|undefined){
 const who=c.uid,action=b.action,ver=await stampOf(c);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([action,b.note.trim(),b.key,b.order,b.quantity,b.stamp,policyOf(b.policy),doc?.project,doc?.revision,doc?.scope])))),x=>x.toString(16).padStart(2,'0')).join('');
 const replay=async()=>{const r=await c.db.prepare('SELECT fingerprint,actor,project FROM studio_stock_events WHERE catalog=? AND request=?').bind(c.id,b.request).first<{actor:string;fingerprint:string;project:string}>();if(!r)return null;
  if(r.fingerprint!==hash||r.actor!==who)return conflict();
  const allowed=await c.db.prepare(`SELECT 1 FROM studio_catalogs c LEFT JOIN studio_catalog_readers m ON m.catalog=c.id AND m.reader=?1 WHERE c.id=?2 AND (CASE WHEN c.owner=?1 THEN 'owner' ELSE m.role END)=?3 AND (?4='' OR EXISTS(SELECT 1 FROM studio_projects p LEFT JOIN studio_access a ON a.project_id=p.id AND a.member=?1 WHERE p.id=?4 AND (p.owner=?1 OR a.role='store')))`).bind(c.uid,c.id,c.role,r.project).first();
  return allowed?json({ok:true}):problem('تغيّرت صلاحيتك. حدّث الصفحة.',403);};
 const prev=await replay();if(prev)return prev;
 let kind=action,link='',project='',revision=0,scope='',units:string[]=[],lines:unknown[]=[];
 if(action==='policy'){
  const p=policyOf(b.policy);if(!p||!def||JSON.parse(def.key)[7]!=='')return problem('اختر خامًا كاملًا وأدخل المورد والعبوة وحدود التجديد.',400);
  if(b.stamp!==ver)return conflict();
  lines=[{...def,qty:0,policy:p}];link=def.key;
 }else if(action==='delivery'||action==='po-close'){
  if(!keyIsValid(b.order||''))return problem('اختر بند أمر الشراء.',400);
  const po=await c.db.prepare(ordersSql+' AND o.request=?2').bind(c.id,b.order!).first<PurchaseRow>();if(!po)return problem('بند الشراء غير موجود.',404);
  if(po.project){const pa=await c.db.prepare(accessSql).bind(c.uid,c.uid,po.project,c.uid).first<{role:string}>();if(!pa||!['owner','store'].includes(pa.role))return problem('بند الشراء غير متاح.',403);project=po.project;revision=po.revision;scope=po.scope;c={...c,projectRole:pa.role};}
  const line:OrderLine=JSON.parse(po.lines)[0],remaining=line.qty-po.received;
  if(po.closed||action==='delivery'&&(remaining<=0||!qty(b.quantity,1)||b.quantity>remaining))return conflict();
  const bal=await c.db.prepare('SELECT * FROM ('+balancesSQL+') WHERE key=?2').bind(c.id,line.key).first<{physical:number}>();
  if(action==='delivery'&&(!bal||bal.physical+b.quantity!>1e6))return problem('راجع العدد المجرود أو الحد الكمي قبل إثبات الوارد.',422);
  link=po.request;lines=[{key:line.key,sku:line.sku,name:line.name,qty:action==='delivery'?b.quantity:0}];
 }else if(doc){
  const l=doc.lines.find(x=>x.key===b.key);if(!l||JSON.parse(l.key)[7]!=='')return problem('اختر صنف خام كامل من احتياج الإيصال. البواقي خارج طلبات المورد.',422);
  const row=await c.db.prepare('SELECT lines FROM studio_stock_events WHERE catalog=? AND kind=\'policy\' AND reservation=? ORDER BY rowid DESC LIMIT 1').bind(c.id,l.key).first<{lines:string}>();
  const p=row&&policyOf(JSON.parse(row.lines)[0].policy);
  if(!p)return problem('احفظ سياسة المورد لهذا الصنف أولًا.',422);
  const bal=await c.db.prepare('SELECT * FROM ('+balancesSQL+') WHERE key=?2').bind(c.id,l.key).first<{physical:number;held:number;free:number}>();
  if(!bal)return problem('اجرد هذه المواصفة أولًا. المخزون غير المعروف لا يُفترض أنه صفر.',422);
  const active=await c.db.prepare(`SELECT 1 FROM studio_stock_events r,json_each(r.units) u WHERE r.catalog=? AND r.project=? AND r.kind='reserve' AND u.value IN (SELECT value FROM json_each(?)) AND NOT EXISTS(SELECT 1 FROM studio_stock_events x WHERE x.catalog=r.catalog AND x.reservation=r.reservation AND x.kind='cancel') LIMIT 1`).bind(c.id,doc.project,JSON.stringify(doc.units)).first();
  if(active)return problem('يتداخل الإيصال مع خام محجوز أو مصروف. اختر إيصال المتبقي.',409);
  let incoming=0;
  const commitments=new Map<string,number>();
  for(const o of await loadOrders(c)){
   const line:OrderLine=JSON.parse(o.lines)[0];if(o.closed||line.key!==l.key)continue;
   incoming+=line.qty-o.received;
   if(o.reserved||o.allocated>=line.demand||o.project===doc.project&&o.revision===doc.revision&&o.scope===doc.scope)continue;
   if(o.project===doc.project&&(JSON.parse(o.units) as string[]).some(v=>doc.units.includes(v)))return problem('يتداخل النطاق مع احتياج قائم على أمر شراء. راجع أمره أو نطاق المتبقي.',409);
   commitments.set(o.project+'/'+o.revision+'/'+o.scope,Math.max(0,line.demand-o.allocated));
  }
  const committed=[...commitments.values()].reduce((a,n)=>a+n,0),position=bal.free+incoming-committed-l.qty;
  const quantity=position<=p.reorder&&position<p.target?Math.max(p.minimumPacks,Math.ceil((p.target-position)/p.pack))*p.pack:0;
  if(!qty(quantity,0))return problem('راجع حدود كمية إعادة الطلب.',422);
  const proposal={key:l.key,sku:l.sku,name:l.name,demand:l.qty,physical:bal.physical,held:bal.held,incoming,committed,position,quantity,policy:p,stamp:ver};
  if(action==='propose'){
   const permitted=await c.db.prepare(`SELECT 1 FROM studio_catalogs c LEFT JOIN studio_catalog_readers m ON m.catalog=c.id AND m.reader=?1
    WHERE c.id=?2 AND (CASE WHEN c.owner=?1 THEN 'owner' ELSE m.role END)=?3 AND EXISTS(
     SELECT 1 FROM studio_projects p LEFT JOIN studio_access a ON a.project_id=p.id AND a.member=?1 WHERE p.id=?4 AND (CASE WHEN p.owner=?1 THEN 'owner' ELSE a.role END)=?5)`).bind(c.uid,c.id,c.role,doc.project,c.projectRole||'').first();
   if(!permitted)return problem('تغيّرت صلاحيتك. حدّث الصفحة.',403);
   return json({proposal});
  }
  if(!quantity||b.quantity!==quantity||b.stamp!==ver)return conflict();
  kind='purchase';link=b.request;({project,revision,scope,units}=doc);lines=[{...l,qty:quantity,demand:l.qty,policy:p}];
 }else return problem('اختر طلب شراء أو إيصالًا صالحًا.',400);
 const r=await c.db.prepare(insert).bind(c.id,b.request,kind,hash,link,project,revision,scope,JSON.stringify(units),JSON.stringify(lines),b.note.trim(),who,new Date().toISOString(),ver,c.role,c.projectRole||'').run();
 return r.meta.changes===1?json({ok:true},201):await replay()||conflict();
}
export {stampOf};
