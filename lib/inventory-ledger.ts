type Item={sectionWidthMm?:number;gaugeMm?:number;grooveWidthMm?:number;grooveDepthMm?:number;sku:string;name:string;kind:string;color:string;thicknessMm:number;stockLengthMm:number;stockWidthMm:number;hardwareRole?:string;offcuts?:{ref:string;count:number;lengthMm:number;widthMm:number}[]};
export type StockLine={key:string;sku:string;name:string;qty:number};
export function stockDefinitions(items:Item[]){
 const defs=new Map<string,{key:string;sku:string;name:string}>();
 for(const i of items){
  const def=(ref:string,label:string,l:number,w:number)=>{
   const sizes=[i.sectionWidthMm,i.gaugeMm,i.grooveWidthMm,i.grooveDepthMm];
   // Preserve the historical identity when no measured section is defined.
   // Existing unqualified counts stay visible for reconciliation as their own stock.
   const key=JSON.stringify([i.sku,i.kind,i.color,i.thicknessMm,i.stockLengthMm,i.stockWidthMm,i.hardwareRole||'other',ref,l,w,i.name,...(sizes.some(n=>n!=null)?[sizes]:[])]);
   defs.set(key,{key,sku:i.sku,name:i.name+(label?' · '+label:'')+(l?' · '+l+(w?' × '+w:'')+' مم':'')+(i.sectionWidthMm?' · قطاع '+i.sectionWidthMm+' مم':'')+(i.gaugeMm?' · جدار '+i.gaugeMm+' مم':'')+(i.grooveWidthMm?' · مجرى '+i.grooveWidthMm+' × '+(i.grooveDepthMm??'؟')+' مم':'')});
  };
  def('','',i.stockLengthMm,i.stockWidthMm);
  for(const o of i.offcuts||[])def(o.ref,'باقي '+o.ref,o.lengthMm,o.widthMm);
 }
 return [...defs.values()];
}
type Purchase={sku:string;qty:number;layout?:{ref:string;source:string}[]};
export function purchaseLines(items:Item[],purchases:Purchase[]):StockLine[]{
 const defs=stockDefinitions(items),out=new Map<string,StockLine>();
 function add(d:typeof defs[number]|undefined,n:number){
  if(!d||!Number.isSafeInteger(n)||n<0||n>1e6)throw Error('بند شراء غير قابل للحجز.');
  if(n)out.set(d.key,{...d,qty:(out.get(d.key)?.qty||0)+n});
 }
 for(const p of purchases){
  const i=items.find(i=>i.sku===p.sku);if(!i)throw Error('مرجع خام غير منشور.');
  const members=defs.filter(d=>d.sku===i.sku);add(members[0],p.qty);
  for(const ref of new Set((p.layout||[]).filter(v=>v.source==='offcut').map(v=>v.ref))){
   const o=(i.offcuts||[]).find(o=>{
    if(!ref.startsWith(o.ref+' #'))return false;const n=Number(ref.slice((o.ref+' #').length));return Number.isInteger(n)&&n>=1&&n<=o.count&&ref===o.ref+' #'+n;
   });
   add(o&&members.find(d=>JSON.parse(d.key)[7]===o.ref),1);
  }
 }
 return [...out.values()].sort((a,b)=>a.key.localeCompare(b.key));
}
export const ledgerCTE=`WITH item_events AS (
 SELECT e.kind,e.reservation,e.request,j.value->>'$.key' AS sk,j.value->>'$.sku' AS sku,j.value->>'$.name' AS name,CAST(j.value->>'$.qty' AS INTEGER) AS qty
 FROM studio_stock_events e,json_each(e.lines) j WHERE e.catalog=?1
), balances AS (
 SELECT sk,MAX(sku) sku,MAX(name) name,
 SUM(CASE kind WHEN 'count' THEN qty WHEN 'delivery' THEN qty WHEN 'consume' THEN -qty ELSE 0 END) physical,
 SUM(CASE kind WHEN 'reserve' THEN qty WHEN 'consume' THEN -qty WHEN 'cancel' THEN -qty ELSE 0 END) held,
 SUM(CASE kind WHEN 'count' THEN 1 ELSE 0 END) counted FROM item_events GROUP BY sk
)`;
export const balancesSQL=ledgerCTE+' SELECT sk AS key,sku,name,physical,held,counted,physical-held AS free FROM balances WHERE counted>0 ORDER BY sku,sk';
const columns='catalog,request,kind,fingerprint,reservation,project,revision,scope,units,lines,note,actor,created';
export const insertEventSQL=ledgerCTE+` INSERT INTO studio_stock_events (`+columns+`)
 SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13
  WHERE EXISTS(SELECT 1 FROM studio_catalogs c LEFT JOIN studio_catalog_readers m ON m.catalog=c.id AND m.reader=?12
   WHERE c.id=?1 AND (CASE WHEN c.owner=?12 THEN 'owner' ELSE m.role END)=?16 AND (c.owner=?12 OR m.role='store'))
 AND ( ?3='count' AND
  COALESCE((SELECT counted FROM balances WHERE sk=json_extract(?10,'$[0].key')),0)=?14
  AND COALESCE((SELECT physical FROM balances WHERE sk=json_extract(?10,'$[0].key')),0)=?15
  AND COALESCE((SELECT physical FROM balances WHERE sk=json_extract(?10,'$[0].key')),0)+json_extract(?10,'$[0].qty')>=COALESCE((SELECT held FROM balances WHERE sk=json_extract(?10,'$[0].key')),0)
 OR ?3='reserve' AND
   EXISTS(SELECT 1 FROM studio_projects p LEFT JOIN studio_access a ON a.project_id=p.id AND a.member=?12 WHERE p.id=?6 AND (CASE WHEN p.owner=?12 THEN 'owner' ELSE a.role END)=?17 AND (p.owner=?12 OR a.role='store'))
  AND NOT EXISTS (SELECT 1 FROM json_each(?10) line LEFT JOIN balances b ON b.sk=line.value->>'$.key'
   WHERE COALESCE(b.counted,0)=0 OR b.physical-b.held<line.value->>'$.qty')
  AND NOT EXISTS (SELECT 1 FROM studio_stock_events e,json_each(e.units) u,json_each(?9) unit
   WHERE e.catalog=?1 AND e.project=?6 AND e.kind='reserve' AND u.value=unit.value
   AND NOT EXISTS(SELECT 1 FROM studio_stock_events prior WHERE prior.catalog=e.catalog AND prior.reservation=e.reservation AND prior.kind='cancel'))
  OR ?3 IN ('cancel','consume') AND EXISTS(SELECT 1 FROM studio_projects p LEFT JOIN studio_access a ON a.project_id=p.id AND a.member=?12 WHERE p.id=?6 AND (CASE WHEN p.owner=?12 THEN 'owner' ELSE a.role END)=?17 AND (p.owner=?12 OR a.role='store')) AND EXISTS(SELECT 1 FROM studio_stock_events e WHERE e.catalog=?1 AND e.reservation=?5 AND e.kind='reserve')
  AND NOT EXISTS(SELECT 1 FROM studio_stock_events e WHERE e.catalog=?1 AND e.reservation=?5 AND e.kind IN ('consume','cancel'))
 ) ON CONFLICT(catalog,request) DO NOTHING`;
