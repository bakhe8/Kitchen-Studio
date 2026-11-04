import {ownKey} from './kitchen-safe-keys.js';
import {verifiedPattern,patternQuantities} from './kitchen-surface-pattern.js';
// Quantities use the same clipped architectural perimeter, real countertop spans
// and fixture holes as the editor/renderer. Drawing space is in centimetres.
import {kitchenGeometry,kitchenFeatureSpecs,kitchenUnitSpecs,kitchenFrontStyles,kitchenHandleStyles} from './kitchen-model.js';
import {kitchenFrontFinishes,kitchenWorktopFinishes} from './kitchen-materials.js';
import {resolveDefault} from './kitchen-defaults-model.js';

const clean=s=>String(s??'').normalize('NFKC').trim().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').toLowerCase();
const rnd=(n,p=8)=>Number(n.toFixed(p));
const sq=pts=>Math.abs((pts||[]).reduce((v,p,i,a)=>{const q=a[(i+1)%a.length];return v+p.x*q.z-p.z*q.x;},0))*.5;
const mm=cm=>rnd(cm*10,3),metre=cm=>rnd(cm/100),sqm=cm2=>rnd(cm2/10000);
const own=(table,key)=>key!=null&&ownKey(table,key);
const tierWord=t=>t==='upper'?'علوي':'سفلي';
const ref=(catalog,id,color)=>({finishId:id||'unassigned',label:(catalog[id]?.label||'غير معيّنة في الرسم')+(color?' · '+color:''),color:color||catalog[id]?.color||'#b7b7aa'});
const factOrigin='من نموذج المطبخ الحالي؛ لا يثبت قياس الموقع';
function unitPrice(row){const normalized=clean(row?.unit).replace(/[\s.]/g,'');return row?.mode==='value'&&row.type==='number'&&Number.isFinite(row.value)&&row.value>=0&&['ريال/م2','ريال/م²','ر.س/م2','رس/م2','sar/m2','ريالسعودي/م2'].map(s=>clean(s).replace(/[\s.]/g,'')).includes(normalized)?row.value:null;}
function percent(row){return row?.mode==='value'&&row.type==='number'&&Number.isFinite(row.value)&&row.value>=0&&['%','٪','بالمئه','بالمائه'].includes(clean(row.unit))?row.value:null;}
// A genuine scoped quotation/record takes precedence over a planning rate.
// Nonmatching room/location data never supply a quote for an unrelated finish.
function commercial(doc,itemId,code,property,aliases=[]){
 const names=[property,...aliases].map(clean),rows=(doc.room?.fieldRegister?.records||[]).filter(r=>r.inputCode===code&&names.includes(clean(r.property))&&r.execution!=='excluded');
 const scoped=rows.filter(r=>r.itemId===itemId||String(r.location||'').endsWith('['+itemId+']')),generic=rows.filter(r=>['project','room','المشروع','المطبخ',doc.room?.name].filter(Boolean).includes(r.itemId));
 const matched=scoped.length?scoped:generic;
 if(!matched.length)return resolveDefault(doc,{code,property,itemId,aliases});
 const sourceRows=matched.filter(r=>['measured','documented','confirmed','conflict','unknown','na'].includes(r.verification));if(!sourceRows.length)return resolveDefault(doc,{code,property,itemId,aliases});
 const isPrice=code==='MFG-09',parser=isPrice?unitPrice:percent;
 const values=sourceRows.map(r=>({mode:r.verification==='na'?'na':['unknown','conflict'].includes(r.verification)?'unknown':'value',type:r.valueType,unit:r.unit,value:r.value,source:[r.source||r.readingRef||r.itemId,'من السجل'].join(' · '),origin:'reading'}));
 if(values.every(r=>r.mode==='na'))return values[0];
 if(values.some(r=>r.mode!=='value'||parser(r)==null)||new Set(values.map(parser)).size!==1)return {mode:'unknown',source:'قراءة غير محسومة أو بيانات متعارضة في السجل',origin:'reading'};
 return values[0];
}
function unionRectArea(rects){const xs=[...new Set(rects.flatMap(r=>[r[0],r[2]]))].sort((a,b)=>a-b);let area=0;
 for(let i=1;i<xs.length;i++){let end=-Infinity,height=0;for(const r of rects.filter(r=>r[0]<xs[i]&&r[2]>xs[i-1]).sort((a,b)=>a[1]-b[1])){if(r[3]<=end)continue;height+=r[3]-Math.max(r[1],end);end=r[3];}area+=(xs[i]-xs[i-1])*height;}return area;}
const propertyAliases={
 'عرض الغرفة الداخلي':['العرض الداخلي','عرض الغرفة','عرض الغرفة بعد التشطيب'],'عمق الغرفة الداخلي':['الطول الداخلي','طول الغرفة','طول الغرفة الداخلي','عمق الغرفة','طول الغرفة بعد التشطيب'],'الارتفاع الصافي للغرفة':['الارتفاع الصافي','ارتفاع السقف','ارتفاع الغرفة','منسوب السقف','ارتفاع السقف عن الأرضية النهائية'],'مساحة الأرضية الصافية':['مساحة الغرفة','المساحة الصافية للغرفة','مساحة أرضية الموقع','مساحة الأرضية'],'محيط الغرفة':['محيط الموقع','محيط المسقط'],'طول ضلع الجدار':['طول الجدار'],'منسوب أسفل سطح العمل':['منسوب أسفل الرخام عن صفر الأرضية النهائية','منسوب أسفل الرخام'],'عرض الوحدة':['عرض الجهاز'],'ارتفاع الوحدة':['ارتفاع الجهاز'],'عمق الوحدة':['عمق الجهاز'],'مساحة السطح الصافية':['صافي مساحة سطح العمل'],'طول سطح العمل الفعلي':['طول سطح العمل'],'إجمالي مساحة السطح قبل الفتحات':['مساحة سطح العمل قبل الفتحات']
};
function amount(facts,code,property,value,unit,source,itemId='',label='',origin='calculated',aliases=[]){if(typeof value==='number'&&!Number.isFinite(value)||value==null||value==='')return;
 facts.push({key:code+'|'+itemId+'|'+property,code,property,value,unit,itemId,label:label||property,type:typeof value==='number'?'number':'text',origin,source,aliases:[...(propertyAliases[property]||[]),...aliases]});}
export function calculateKitchenDefaults(doc){
 const room=doc.room,k=doc.kitchen,g=kitchenGeometry(k,room),A=g.architecture,F=[],materials=new Map(),fronts=new Map();
 const design=(code,p,v,u,item='',label='',aliases=[])=>amount(F,code,p,v,u,factOrigin,item,label,'design',aliases);
 const derived=(code,p,v,u,source,item='',label='')=>amount(F,code,p,v,u,source,item,label,'calculated');
 const pCm=A.walls.reduce((sum,x)=>sum+x.length,0),areaM2=sqm(A.area),perimeterM=metre(pCm);
 design('PRJ-01','اسم المطبخ',room.name,'','room');design('SITE-03','عرض الغرفة الداخلي',mm(A.width),'مم','room');design('SITE-03','عمق الغرفة الداخلي',mm(A.length),'مم','room');design('SITE-08','الارتفاع الصافي للغرفة',mm(A.height),'مم','room');design('SITE-06','سماكة الجدار',mm(A.wallThickness),'مم','room');
 derived('SITE-07','مساحة الأرضية الصافية',areaM2,'م²','مضلع المسقط الداخلي بعد طرح الردّة أو الشطف','room');derived('SITE-03','محيط الغرفة',perimeterM,'م','مجموع أطوال جميع الأضلاع الداخلية','room');
 for(const w of A.walls)derived('SITE-03','طول ضلع الجدار',mm(w.length),'مم','المسافة بين طرفي الضلع المرسوم',w.id,w.label+' · طول الضلع');
 const roomFin={tile:'بورسلان رمادي',wood:'خشب طبيعي',marble:'رخام فاتح',stone:'حجر داكن'};
 if(room.floor)design('SITE-07','تشطيب الأرضية',roomFin[room.floor]||room.floor,'','room');
 const cl=room.cladding;let cladding=null;
 if(cl&&cl.finish!=='plain'){
  const h=Math.min(room.height,cl.height||room.height);let openings=0;
  for(const w of A.walls){const boxes=g.features.filter(v=>v.wall===w.id&&['window','door'].includes(v.kind)).map(v=>[Math.max(w.start,v.u),Math.max(0,v.bottom),Math.min(w.end,v.u+v.width),Math.min(h,v.bottom+v.height)]).filter(b=>b[0]<b[2]&&b[1]<b[3]);openings+=unionRectArea(boxes);}
  const grossM2=sqm(pCm*h),openingsM2=sqm(openings),netM2=sqm(Math.max(0,pCm*h-openings));cladding={finish:cl.finish,heightMM:mm(h),tileWidthMM:mm(cl.tileWidth),tileHeightMM:mm(cl.tileHeight),grossM2,openingsM2,netM2};
  derived('SITE-14','مساحة كسوة الجدران الصافية',netM2,'م²','طول الأضلاع × ارتفاع الكسوة، مطروحًا منه أجزاء فتحات الأبواب والنوافذ داخل الكسوة؛ دون خصم الأثاث أو كسوة السطح.','room');
 }
 for(const t of g.worktops){const mat=ref(kitchenWorktopFinishes,t.worktopFinish,t.worktopColor),key=mat.finishId+'|'+(t.worktopColor||'');let m=materials.get(key);
  if(!m){m={...mat,grossM2:0,cutoutsM2:0,netM2:0,lengthM:0,segments:0,cutouts:0};materials.set(key,m);}
  const pattern=verifiedPattern(doc,t),measured=pattern?patternQuantities(pattern):null;
  const gross=measured?.blankM2??sq(t.polygon)/10000,holes=measured?.holesM2??t.holes.reduce((sum,hole)=>sum+sq(hole.polygon)/10000,0);
  const len=measured?(Math.max(...pattern.outer.map(v=>v[0]))-Math.min(...pattern.outer.map(v=>v[0])))/1000:(t.end-t.start)/100;
  const net=measured?.netM2??(gross-holes);m.grossM2+=gross;m.cutoutsM2+=holes;m.lengthM+=len;m.netM2+=net;m.segments++;m.cutouts+=pattern?.holes.length??t.holes.length;
  derived('CAT-17','مساحة السطح الصافية',rnd(net),'م²',measured?'محيط القالب الميداني ناقص الفتحات المقاسة':'مساحة القطعة المرسومة ناقص الفتحات التابعة لها',t.id);
  derived('CAT-17','طول سطح العمل الفعلي',rnd(len),'م','طول امتداد السطح المتصل',t.id);
  design('CAT-17','منسوب أسفل سطح العمل',mm(t.bottom),'مم',t.id);
 }
 const mats=[...materials.values()];let pricedCost=0,missingPrice=0,excluded=0,order=0,missingOrder=0;
 for(const m of mats){const a=commercial(doc,m.finishId,'MFG-06','نسبة احتياط سطح العمل',['نسبة هدر سطح العمل']),b=commercial(doc,m.finishId,'MFG-09','سعر متر سطح العمل المربع');
  m.includePricing=b?.mode!=='na';m.wastePct=percent(a);m.priceM2=unitPrice(b);m.wasteSource=a?.source||'';m.priceSource=b?.source||'';
  // Net installed is useful for the drawing. A cutout isn't an automatic
  // reduction of the stock blank ordered from the supplier.
  m.netM2=rnd(Math.max(0,m.netM2));m.grossM2=rnd(m.grossM2);m.cutoutsM2=rnd(m.cutoutsM2);m.lengthM=rnd(m.lengthM);
  m.orderM2=m.wastePct===null?null:rnd(m.grossM2*(1+m.wastePct/100));m.cost=m.orderM2!=null&&m.priceM2!=null?rnd(m.orderM2*m.priceM2,2):null;
  if(m.orderM2==null)missingOrder++;else order+=m.orderM2;
  if(m.cost!=null)pricedCost+=m.cost;else if(m.includePricing)missingPrice++;else excluded++;
 }
 const moduleCode=kind=>({fridge:'EQP-05',freezer:'EQP-05','oven-tower':'EQP-06',oven:'EQP-06',hob:'EQP-07',hood:'EQP-08',dishwasher:'EQP-10',sink:'EQP-13'})[kind]||null;
 for(const r of g.runs){
  const label=r.wall?(A.walls.find(w=>w.id===r.wall)?.label||r.wall)+' · الصف '+tierWord(r.tier):'جزيرة';
  design('CAT-03','عمق الصف '+(r.tier==='upper'?'العلوي':'السفلي'),mm(r.depth),'مم',r.id,label+' · العمق');design('CAT-03','ارتفاع الصف',mm(r.height),'مم',r.id,label+' · الارتفاع');design('CAT-03','طول الصف',mm(r.end-r.start),'مم',r.id,label+' · الطول');
  if(r.worktopFinish&&r.worktops?.length)design('CAT-17','خامة سطح العمل المختارة',kitchenWorktopFinishes[r.worktopFinish]?.label,'',r.id,label+' · خامة السطح');
  if(r.worktops?.length)design('CAT-17','منسوب أسفل سطح العمل',mm(r.worktops[0].bottom),'مم',r.id);
 }
 for(const u of g.units){const part=kitchenUnitSpecs[u.kind],name=part?.label||u.kind,closed=part?.frontStyles===true;
  for(const [prop,val] of [['عرض الوحدة',u.width],['ارتفاع الوحدة',u.height],['عمق الوحدة',u.depth]]){design('CAT-03',prop,mm(val),'مم',u.id,name+' · '+prop);if(moduleCode(u.kind)&&!closed)design('EQP-02',prop,mm(val),'مم',u.id,name+' · '+prop);}
  if(!closed)continue;
  const material=ref(kitchenFrontFinishes,u.frontFinish,u.frontColor),key=material.finishId+'|'+(u.frontColor||'');const m=fronts.get(key)||{...material,units:0};m.units++;fronts.set(key,m);
  if(u.frontFinish)design('CAT-06','خامة الواجهة المختارة',kitchenFrontFinishes[u.frontFinish]?.label,'',u.id);
 }
 const codeFor={door:'SITE-11',window:'SITE-12',shaft:'SITE-10',column:'SITE-09',beam:'SITE-09',heater:'MEP-06',water:'MEP-01',drain:'MEP-03',electric:'MEP-09',vent:'MEP-13',gas:'MEP-08'};
 for(const o of g.features){const code=codeFor[o.kind];if(!code)continue;const w=A.walls.find(w=>w.id===o.wall);if(!w)continue;const off=o.u-w.start,label=kitchenFeatureSpecs[o.kind]?.label||o.kind;
  if(['window','door','beam','shaft','column','heater'].includes(o.kind)){
   for(const [p,v] of [['عرض العنصر الصافي',o.width],['ارتفاع العنصر الصافي',o.height],['منسوب أسفل العنصر',o.bottom],['بداية العنصر من بداية ضلع الجدار',off],['البروز من وجه الجدار',o.depth]])design(code,p,mm(v),'مم',o.id,label+' · '+p);
   derived(code,'منسوب الحافة العليا',mm(o.bottom+o.height),'مم','المنسوب السفلي + ارتفاع العنصر المرسوم',o.id);
  }else {design(code,'بُعد مركز المخرج عن بداية الجدار',mm(off+o.width/2),'مم',o.id);design(code,'ارتفاع مركز المخرج عن الأرضية النهائية',mm(o.bottom+o.height/2),'مم',o.id);}
 }
 for(const pt of room.sitePoints||[]){const code=pt.kind==='floor-drain'?'MEP-04':pt.kind==='floor-water'?'MEP-01':'MEP-03';for(const [p,v] of [['من يسار المسقط',pt.x],['من خلف المسقط',pt.z],['مقاس غطاء النقطة',pt.size]])design(code,p,mm(v),'مم',pt.id);}
 const fr=[...fronts.values()],sum=key=>rnd(mats.reduce((s,m)=>s+m[key],0)),worktopGrossM2=sum('grossM2'),worktopCutoutsM2=sum('cutoutsM2'),worktopNetM2=sum('netM2'),worktopLengthM=sum('lengthM');
 derived('CAT-17','إجمالي مساحة السطح قبل الفتحات',worktopGrossM2,'م²','مجموع القطع فوق الوحدات الحاملة فقط');derived('CAT-17','مساحة الفتحات',worktopCutoutsM2,'م²','فتحات الحوض والموقد التابعة للقطع المرسومة');derived('CAT-17','مساحة السطح الصافية',worktopNetM2,'م²','إجمالي مساحة القطع ناقص الفتحات');derived('CAT-17','طول سطح العمل الفعلي',worktopLengthM,'م','مجموع امتدادات السطح الفعلية، دون الفراغات والأجهزة الطويلة');
 derived('CAT-06','عدد وحدات الواجهات',fr.reduce((s,m)=>s+m.units,0),'وحدة','يُحسب جسم الخزانة مرة واحدة، لا عدد الضلف أو الأدراج. تُستثنى الأجهزة والرفوف المفتوحة.');
 const estimatedCost=missingPrice||mats.length&&excluded===mats.length?null:rnd(pricedCost,2),orderM2=missingOrder?null:rnd(order);
 if(estimatedCost!==null&&mats.length)derived('MFG-09','تقدير تكلفة خامة سطح العمل',estimatedCost,'ريال','المسطّح الإجمالي مع الاحتياط × سعر المتر لكل خامة مشمولة؛ لا يشمل التصنيع والتركيب.');
 return {facts:F,materials:mats,fronts:fr,cladding,areaM2,perimeterM,worktopGrossM2,worktopCutoutsM2,worktopNetM2,worktopLengthM,pricedCost:rnd(pricedCost,2),estimatedCost,unpricedMaterials:missingPrice,orderM2,excludedMaterials:excluded};
}
export function designDefault(doc,{code,property,itemId='',aliases=[]}={}){
 if(!doc?.kitchen||!doc.room||!code||!property)return null;const list=calculateKitchenDefaults(doc).facts,props=[property,...aliases].map(clean),id=String(itemId||'');
 const find=id=>list.find(f=>f.code===code&&f.itemId===id&&[f.property,...f.aliases].some(p=>props.includes(clean(p))));
 return find(id)||(!id?find('room'):null)||null;
}
const specIndex={base:['CAT-03','عمق الصف السفلي'],upper:['CAT-03','عمق الصف العلوي'],top:['CAT-17','خامة سطح العمل الجديد'],front:['CAT-06','خامة واجهة الوحدة الجديدة'],baseH:['CAT-03','ارتفاع جسم الصف السفلي'],upperH:['CAT-03','ارتفاع جسم الصف العلوي'],mount:['CAT-03','منسوب تركيب الصف العلوي'],style:['CAT-08','شكل واجهة الوحدة الجديدة'],handle:['CAT-12','مقبض الوحدة الجديدة']};
export function creationDefaults(doc){const get=k=>{const [code,property]=specIndex[k];return resolveDefault(doc,{code,property});};
 const dim=(k,legacy,min,max)=>{const r=get(k),sc={مم:.1,ملم:.1,ملليمتر:.1,مليمتر:.1,سم:1,سنتيمتر:1,'م':100,متر:100,mm:.1,cm:1,m:100}[clean(r?.unit)];const v=r?.mode==='value'&&typeof r.value==='number'&&sc?r.value*sc:null;return Number.isFinite(v)&&v>=min&&v<=max?rnd(v,6):legacy;};
 const finish=(key,table)=>{const r=get(key);const value=r?.mode==='value'?r.value:null;if(typeof value!=='string')return null;if(own(table,value))return value;return Object.keys(table).find(id=>clean(table[id].label)===clean(value))||null;};
 return {baseDepth:dim('base',60,15,150),upperDepth:dim('upper',34,15,150),baseHeight:dim('baseH',86,15,400),upperHeight:dim('upperH',70,15,400),upperBottom:dim('mount',145,0,600),frontStyle:finish('style',kitchenFrontStyles),handleStyle:finish('handle',kitchenHandleStyles),frontFinish:finish('front',kitchenFrontFinishes),worktopFinish:finish('top',kitchenWorktopFinishes)};
}
