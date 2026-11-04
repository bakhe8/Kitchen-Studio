import {ownKey,inheritedName} from './kitchen-safe-keys.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {applyMaterialTerms,recipeLineApplies} from './kitchen-factory-families.js';
import {cleanPartOperations} from './kitchen-machining.js';
// Slot definitions belong to a particular factory family. Only the actual
// customer selection is stored on the project. A SKU alone never establishes
// compatibility with a piece or a screw pattern.
export const finishParts={body:'ألواح جسم الدولاب',back:'لوح الظهر',shelf:'الرفوف',divider:'القواطع الداخلية',profile:'القطاعات والتيوبات',edge:'حواف الدرف',handle:'اليد',hinge:'المفصلات',accessory:'إكسسوار داخلي'};
const kindOf={body:'panel',back:'panel',shelf:'panel',divider:'panel',profile:'bar',edge:'bar',handle:'piece',hinge:'piece',accessory:'piece'};
const physicalKeys=['thicknessMm','sectionWidthMm','gaugeMm','grooveWidthMm','grooveDepthMm','massKgM2'];
const ref=s=>typeof s==='string'&&s.trim().length>0&&s.length<=180;
const id=s=>typeof s==='string'&&/^[A-Za-z0-9][\w.-]{0,47}$/.test(s)&&!inheritedName(s)&&!['__proto__','prototype','constructor'].includes(s);
const owns=(o,k)=>o&&ownKey(o,k);
export function cleanFinishSlots(raw,recipe,by){
 if(raw==null)return {};
 if(typeof raw!=='object'||Array.isArray(raw))return null;
 const result={},taken=new Set();
 for(const [part,s] of Object.entries(raw)){
  if(!owns(finishParts,part)||!s||!ref(s.reference)||!['matching','formula'].includes(s.mode)||
   !Array.isArray(s.labels)||!s.labels.length||s.labels.length>64||new Set(s.labels).size!==s.labels.length||
   !Array.isArray(s.skus)||!s.skus.length||s.skus.length>100||new Set(s.skus).size!==s.skus.length||!s.skus.includes(s.source))return null;
  const base=by.get(s.source);
  if(!base||base.kind!==kindOf[part]||base.role==='front'||base.hardwareRole==='runner'||s.mode==='formula'&&base.kind==='piece')return null;
  for(const l of s.labels){
   const hits=recipe.filter(r=>r.sku===s.source&&r.label===l),key=JSON.stringify([s.source,l]);
   if(!hits.length||hits.some(r=>r.role==='front'||r.hardwareRule)||taken.has(key))return null;
   taken.add(key);
  }
  for(const sku of s.skus){const item=by.get(sku);if(!item||item.kind!==base.kind||item.role!==base.role||item.hardwareRole==='runner')return null;}
  result[part]={source:s.source,labels:[...s.labels].sort(),skus:[...s.skus].sort(),mode:s.mode,reference:s.reference.trim()};
  if(s.drilling!=null){
   const spec=cleanHandleDrilling(s.drilling,part,s,recipe);if(!spec)return null;
   result[part].drilling=spec;
  }
 }
 return result;
}
function cleanHandleDrilling(d,part,slot,recipe){
 if(part!=='handle'||!d||typeof d!=='object'||!ref(d.target)||!d.models||Object.keys(d.models).some(k=>!slot.skus.includes(k)))return null;
 const face=recipe.filter(l=>l.label===d.target&&l.role==='front');
 const handles=recipe.filter(l=>slot.labels.includes(l.label)&&l.sku===slot.source);
 if(face.length!==1||face[0].count!==1||face[0].countMode!=='front'||handles.length!==1||handles[0].count!==1||handles[0].countMode!=='handle')return null;
 if(d.replaceRef!=null&&(!ref(d.replaceRef)||!face[0].operations?.some(op=>op.kind==='drill'&&op.reference===d.replaceRef)))return null;
 const models={};
 for(const sku of slot.skus){
  const m=d.models[sku];if(!m||!id(m.machine)||m.machine==='external'||!ref(m.reference)||!['x','y'].includes(m.axis)||
   !Number.isFinite(m.pitch)||m.pitch<0||m.pitch>1500)return null;
  const base={...m,kind:'drill',length:0,width:0,angle:0,radius:0},ops=cleanPartOperations([base]);if(!ops)return null;
  const v=m.visual;
  if(v!=null&&(!Number.isFinite(v.diameter)||v.diameter<1||v.diameter>150||
   !Number.isFinite(v.projection)||v.projection<1||v.projection>250||
   !Number.isFinite(v.overhang)||v.overhang<0||v.overhang>200||(!m.pitch&&v.overhang!==0)||(m.pitch&&v.projection<=v.diameter/2)))return null;
  models[sku]={...(v?{visual:{diameter:v.diameter,projection:v.projection,overhang:v.overhang}}:{}),machine:m.machine,reference:m.reference.trim(),tolerance:m.tolerance,x:m.x,y:m.y,xFrom:m.xFrom,yFrom:m.yFrom,diameter:m.diameter,depth:m.depth,pitch:m.pitch,axis:m.axis};
 }
 const edgeOffset=n=>n==null||Number.isFinite(n)&&n>=0&&n<=12000;
 if(d.mount!=null&&(!['vertical','horizontal'].includes(d.mount.lengthAxis)||!['fixed','mirror'].includes(d.mount.handed)||
  !edgeOffset(d.mount.leftMm)||!edgeOffset(d.mount.bottomMm)))return null;
 return {...(d.mount?{mount:{lengthAxis:d.mount.lengthAxis,handed:d.mount.handed,...(d.mount.leftMm!=null?{leftMm:d.mount.leftMm}:{}),...(d.mount.bottomMm!=null?{bottomMm:d.mount.bottomMm}:{})}}:{}),target:d.target.trim(),...(d.replaceRef?{replaceRef:d.replaceRef.trim()}:{}),models};
}
export function handleDrills(slot,sku,mirrorAxis){
 const m=slot?.drilling?.models[sku];if(!m)return [];
 const {pitch,axis,visual,...drill}=m,op={...drill,kind:'drill',minutes:null,length:0,width:0,angle:0,radius:0};
 if(mirrorAxis){const edge=mirrorAxis+'From';op[edge]=op[edge]==='end'?'start':'end';}
 return pitch>0?[op,{...op,[axis]:op[axis]+pitch}]:[op];
}
function panelLengthAxis(drilling,line){
 if(drilling.mount)return drilling.mount.lengthAxis;
 const axes={frontWidth:'horizontal',width:'horizontal',frontHeight:'vertical',height:'vertical'};
 return axes[line.axis]&&axes[line.axis2]&&axes[line.axis]!==axes[line.axis2]?axes[line.axis]:null;
}
function mirroredAxis(drilling,side){
 return drilling.mount?.handed==='mirror'&&side==='right'?(drilling.mount.lengthAxis==='vertical'?'y':'x'):null;
}
function installedHandlePoints(slot,sku,lengthAxis,a,b,w,h,side){
 const d=slot.drilling,vertical=lengthAxis==='vertical',width=vertical?b:a,height=vertical?a:b;
 const left=d.mount?.leftMm??(w-width)/2,bottom=d.mount?.bottomMm??(h-height)/2;
 if(d.mount&&(left<-.001||left+width>w+.001||bottom<-.001||bottom+height>h+.001))return [];
 const xOrigin=d.mount?.handed==='mirror'&&side==='right'?w-width-left:left;
 const pts=handleDrills(slot,sku,mirroredAxis(d,side)).map(op=>{
  const u=op.xFrom==='end'?a-op.x:op.x,v=op.yFrom==='end'?b-op.y:op.y;
  if(u<0||u>a||v<0||v>b)return null;
  return {x:xOrigin+(vertical?v:u),y:h-bottom-(vertical?u:v)};
 });
 return pts.every(p=>p&&p.x>=0&&p.x<=w&&p.y>=0&&p.y<=h)?pts:[];
}
function closedHandleFaces(u){
 if(u?.doorLeaves?.length)return u.doorLeaves.map(l=>({w:l.leafWidth*10,h:l.height*10,side:l.hingeSide}));
 if(!u||!['drawers','pullout'].includes(u.kind))return [];
 const toe=u.baseSupport?.applicable?u.baseSupport.bodyClearMm/10:u.bottom<1?Math.min(9,u.height*.12):0;
 if(u.kind==='pullout')return [{w:(u.width-1.1)*10,h:(u.height-toe-1.2)*10}];
 const gap=Math.min(.48,u.width*.015);
 return [{w:(u.width-2*gap)*10,h:((u.height-toe)/(u.drawerCount||3)-gap)*10}];
}
export function factoryUnitSize(unit,run,geometry){
 const fronts=geometry?.doorLeaves?.length||(unit.kind==='drawers'?(unit.drawerCount||3):['storage','sink','tall','hob','bottle-rack','pullout'].includes(unit.kind)?1:0);
 const rnd=v=>Math.round(v*1000)/1000,width=rnd(unit.width*10),envelopeHeight=rnd((geometry?.height??run.height)*10),depth=rnd((geometry?.depth??run.depth)*10);
 const netHeight=rnd(envelopeHeight-(geometry?.baseSupport?.bodyClearMm||0)),height=geometry?.baseSupport?.recipeHeightBasis==='envelope'?envelopeHeight:netHeight;
 const dims={width,height,depth,frontWidth:unit.kind==='drawers'?width:width/Math.max(1,fronts),frontHeight:unit.kind==='drawers'?height/Math.max(1,fronts):height,fixed:0};
 return {fronts,envelopeHeight,netHeight,dims};
}
export function bindHandleDrills(pieces,slot,sku,id,issues,geometry){
 const leaves=geometry?.doorLeaves||[];
 if(!slot?.drilling)return;
 const {target,replaceRef}=slot.drilling,panel=pieces.find(p=>p.label===target&&p.kind==='panel');
 const handles=pieces.filter(p=>p.sku===sku&&slot.labels.includes(p.label)),quantity=handles.reduce((n,h)=>n+h.count,0);
 if(!panel){if(quantity)issues.push('يلزم لوح واجهة مطابق لقالب ثقوب اليد في '+id+'.');return;}
 const visual=slot.drilling.models[sku]?.visual;
 if(visual)for(const part of handles)part.handleForm={...visual};
 const keep=(panel.operations||[]).filter(op=>!(replaceRef&&op.kind==='drill'&&op.reference===replaceRef));
 if(quantity&&quantity!==panel.count){issues.push('عدد الأيدي لا يساوي عدد الألواح في قالب التخريم للوحدة '+id+'.');return;}
 if(quantity&&slot.drilling.mount){
  const faces=closedHandleFaces(geometry);
  if(!faces.length||faces.some(f=>!installedHandlePoints(slot,sku,slot.drilling.mount.lengthAxis,panel.a,panel.b,f.w,f.h,f.side).length)){
   issues.push('راجع موضع تركيب لوح الواجهة ومواضع مسامير اليد داخل الدرفة في '+id+'.');
  }
 }
 // Existing recipes retain one identical pattern per cut panel. Only a
 // factory-published handed template creates distinct left and right pieces.
 const split=quantity&&slot.drilling.mount?.handed==='mirror'&&leaves.length>1;
 const panels=split?leaves.map((l,i)=>({...panel,count:1,label:panel.label+' · '+(l.hingeSide==='right'?'مفصلة يمين':'مفصلة يسار')+' '+(i+1)})):[panel];
 if(split)pieces.splice(pieces.indexOf(panel),1,...panels);
 for(const [index,targetPanel] of panels.entries()){
  const mount=slot.drilling.mount;
  if(quantity&&mount){
   const side=leaves[index]?.hingeSide,fromRight=side==='right'&&mount.handed==='mirror';
   targetPanel.handleInstall={...mount,sku,fromRight};
   const edge=mount.leftMm==null?'أفقيًا في المنتصف':mount.leftMm+' مم من '+(fromRight?'يمين':'يسار')+' الدرفة';
   const base=mount.bottomMm==null?'رأسيًا في المنتصف':mount.bottomMm+' مم من أسفل الدرفة';
   targetPanel.drawing='يد '+sku+' · طول اللوح '+(mount.lengthAxis==='vertical'?'رأسي من أسفل':'أفقي من اليسار')+' · '+edge+' · '+base;
  }
  const ops=quantity?handleDrills(slot,sku,mirroredAxis(slot.drilling,leaves[index]?.hingeSide)):[];
  const center=o=>[o.xFrom==='end'?panel.a-o.x:o.x,o.yFrom==='end'?panel.b-o.y:o.y];
  for(let i=0;i<ops.length;i++){
   const a=ops[i],p=center(a);
   if([...keep,...ops.slice(0,i)].some(o=>{if(o.kind!=='drill')return false;const q=center(o);return Math.hypot(q[0]-p[0],q[1]-p[1])<(o.diameter+a.diameter)/2;}))issues.push('يتداخل ثقب اليد مع ثقب آخر في '+id+' · '+panel.label+'.');
  }
  if(keep.length||ops.length)targetPanel.operations=[...keep,...ops];else delete targetPanel.operations;
 }
}
export function cleanFinishSelection(v){
 if(!v||typeof v!=='object'||Array.isArray(v))return null;
 const out={};for(const [k,x] of Object.entries(v)){if(!owns(finishParts,k)||!id(x))return null;out[k]=x;}return out;
}
export function finishMembers(doc,catalog){
 const by=new Map(doc.kitchen.units.map(u=>[u.id,u])),result=[];
 for(const run of doc.kitchen.runs){
  const entries=doc.room.workshop?.rows?.[run.id]?.units;
  const managedUpper=run.tier==='upper'&&doc.room.workshop?.chains?.[run.wall]&&run.id.startsWith('wup-'+run.wall+'-')&&/^\d+-\d+$/.test(run.id.slice(('wup-'+run.wall+'-').length));
  const found=entries||[];
  for(const e of found){if(by.get(e.id)?.runId!==run.id)continue;
   const family=e.recipeId||(run.tier==='upper'&&e.family==='storage'?'upperStorage':e.family);
   if(catalog.families[family])result.push({...e,family});
  }
  if(managedUpper)for(const u of doc.kitchen.units.filter(x=>x.runId===run.id&&x.kind==='storage'&&!found.some(e=>e.id===x.id)))result.push({id:u.id,family:'upperStorage',locks:{}});
 }return result;
}
const chosen=(fin,id,key)=>fin?.partUnits?.[id]?.[key]??fin?.partDefaults?.[key];
export function setFacePanel(doc,cat,scope,sku){
 const material=cat.items.find(i=>i.sku===sku&&i.role==='front'&&i.kind==='panel');
 if(!material||(!material.available&&!(material.stockUnits>0)))throw Error('اختَر صنف واجهة منشورًا في كتالوج المشروع.');
 const w=doc.room.workshop||{},finishes={...w.finishes,units:{...w.finishes?.units}},members=finishMembers(doc,cat).filter(m=>cat.families[m.family].recipe.some(l=>l.role==='front')),available=new Set(members.map(u=>u.id));
 if(scope!=='all'&&!available.has(scope))throw Error('تغيرت الوحدة المختارة. أعد تحديدها.');
 for(const u of members.filter(u=>u.id===scope||scope==='all'&&!u.locks?.finish&&!finishes.units[u.id])){
   const f=cat.families[u.recipeId||u.family];if(f?.frontSkus?.length&&!f.frontSkus.includes(sku))throw Error('خامة الواجهة خارج بدائل وصفة '+f.label+' في الوحدة '+u.id+'؛ اختر لها صنفًا متوافقًا.');
 }
 if(scope==='all'){
   for(const u of members){if(u.locks?.finish&&!finishes.units[u.id]){const old=finishes.frontSku||cat.families[u.recipeId||u.family].recipe.find(l=>l.role==='front')?.sku;if(old)finishes.units[u.id]={frontSku:old};}}
   finishes.frontSku=sku;
 }else finishes.units[scope]={frontSku:sku};
 const units=doc.kitchen.units.map(u=>{
   if(!available.has(u.id)||(scope!=='all'&&scope!==u.id))return u;
   const actual=cat.items.find(i=>i.sku===(finishes.units[u.id]?.frontSku||finishes.frontSku));
   const colour=catalogDisplayColor(actual);
   return colour?{...u,frontColor:colour.toLowerCase()}:u;
 });
 return {...doc,room:{...doc.room,workshop:{...w,finishes}},kitchen:{...doc.kitchen,units}};
}

function selectedParts(family,fin,unitId,items){
 const slots=family?.finishSlots||{},actual=new Map(),physical=[],issues=[];
 const promised=Object.entries(fin?.partCoverage||{}).filter(([key,ids])=>fin.partDefaults?.[key]&&ids.includes(unitId)).map(([key])=>key);
 for(const k of new Set([...promised,...Object.keys(fin?.partUnits?.[unitId]||{})]))if(!ownKey(slots,k))issues.push('عائلة الوحدة '+unitId+' لم تعد تتيح '+finishParts[k]+' المختارة. راجع اختيار العميل.');
 for(const [k,s] of Object.entries(slots)){
  const sel=chosen(fin,unitId,k),sku=sel??s.source,base=items.get(s.source),item=items.get(sku);
  if(!base||!item||!s.skus.includes(sku)){issues.push('الصنف '+sku+' غير معتمد لـ '+finishParts[k]+' في '+unitId+'.');continue;}
  const changed=physicalKeys.filter(p=>(base[p]??null)!==(item[p]??null));
  if(changed.length){
   physical.push([k,...changed.map(p=>[p,item[p]??null])]);
   if(s.mode==='matching')issues.push('البديل '+sku+' يختلف في المقاس أو الوزن عن الصنف المتطابق الموثق لـ '+finishParts[k]+'.');
   else{
    // A change in section/board size needs a parametric cut or an explicit
    // groove/mitre check for that dimension. Constant offsets would be stale.
    for(const dim of changed){
     if(dim==='massKgM2')continue;
     const follows=family.recipe.some(l=>[...(l.termsA||[]),...(l.termsB||[])].some(t=>t.sku===s.source&&t.dimension===dim)||
       (l.grooveFit?.sku===s.source&&['grooveDepthMm','grooveWidthMm'].includes(dim))||
       (l.grooveFit&&s.labels.includes(l.label)&&l.sku===s.source&&dim==='thicknessMm')||
       (l.ends&&l.sku===s.source&&s.labels.includes(l.label)&&dim==='sectionWidthMm'));
     if(!follows)issues.push('يتطلب تغيير '+sku+' معادلة قص أو تحقق تعشيق مناسبة في وصفة '+unitId+' ('+dim+').');
    }
   }
  }
  if(s.drilling&&sku!==s.source){
   const dropMeta=({reference,machine,visual,...v})=>v;
   const old=dropMeta(s.drilling.models[s.source]),next=dropMeta(s.drilling.models[sku]);
   if(JSON.stringify(old)!==JSON.stringify(next))physical.push([k,'drilling',next]);
  }
  actual.set(k,item);
 }return {actual,physical,issues};
}
export function resolveFinishParts(family,fin,unitId,items){
 const slots=family?.finishSlots||{},plan=selectedParts(family,fin,unitId,items),lookups=new Map(),refs=new Set(family?.recipe.flatMap(l=>[...(l.termsA||[]).map(t=>t.sku),...(l.termsB||[]).map(t=>t.sku),...(l.grooveFit?[l.grooveFit.sku]:[])])||[]);
 function itemFor(line){
  const match=Object.entries(slots).find(([,s])=>s.source===line.sku&&s.labels.includes(line.label));
  return match?plan.actual.get(match[0]):items.get(line.sku);
 }
 for(const line of family?.recipe||[]){
  if(!refs.has(line.sku))continue;
  const item=itemFor(line);if(!item)continue;
  const prev=lookups.get(line.sku);
  if(prev&&prev.sku!==item.sku&&physicalKeys.some(k=>prev[k]!==item[k]))plan.issues.push('مرجع المقاس '+line.sku+' يشير إلى قطعتين بمقاسين مختلفين. عرّف لكل منهما مرجعًا منفصلًا في وصفة المصنع.');
  else lookups.set(line.sku,item);
 }
 return {...plan,itemFor,dimensions:{get:sku=>lookups.get(sku)||items.get(sku)}};
}
// Cut axes follow the machine panel (A × B). Map those same dimensions
// and centres onto the centred insert of each visible front without scaling.
export function factoryHandleMounts(room,kitchen,geometry){
 const ws=room?.workshop,cat=readWorkshopCatalog(ws),mounts=new Map();
 if(!cat?.families||!Object.values(cat.families).some(f=>f.finishSlots?.handle?.drilling))return mounts;
 const items=new Map(cat.items.map(i=>[i.sku,i])),units=new Map(geometry.units.map(u=>[u.id,u])),runs=new Map(geometry.runs.map(r=>[r.id,r]));
 for(const e of finishMembers({room,kitchen},cat)){
  const f=cat.families[e.family],slot=f.finishSlots?.handle,d=slot?.drilling,o=units.get(e.id);
  if(!d||!o||o.handleStyle==='handleless')continue;
  const line=f.recipe.find(l=>l.role==='front'&&l.label===d.target);
  const stock=f.recipe.find(l=>l.sku===slot.source&&slot.labels.includes(l.label));
  if(!line||!stock||!recipeLineApplies(line,e)||!recipeLineApplies(stock,e)){
   mounts.set(o.id,{locate:()=>[]});continue;
  }
  const lengthAxis=panelLengthAxis(d,line),parts=resolveFinishParts(f,ws.finishes,e.id,items);
  const sku=parts.actual.get('handle')?.sku,model=d.models[sku];
  if(!lengthAxis||!model||parts.issues.length)continue;
  const {dims}=factoryUnitSize(o,runs.get(o.runId),o);
  const a=applyMaterialTerms(dims[line.axis]+line.offsetMm,line.termsA,parts.dimensions).value;
  const b=applyMaterialTerms(dims[line.axis2]+line.offset2Mm,line.termsB,parts.dimensions).value;
  if(!(a>0&&b>0))continue;
  mounts.set(o.id,{sku,visual:model.visual,locate:(w,h,side)=>installedHandlePoints(slot,sku,lengthAxis,a,b,w,h,side)});
 }
 return mounts;
}
export function handlePreviewNote(slot,sku,recipe){
 const d=slot?.drilling,m=d?.models[sku];
 if(!m)return 'شكل تقريبي. لم ينشر المصنع قالب تثقيب لهذا الصنف.';
 const line=recipe.find(l=>l.role==='front'&&l.label===d.target);
 if(!line||!panelLengthAxis(d,line))return 'شكل تقريبي. اتجاه تركيب لوح الواجهة ينتظر تحديد المصنع.';
 const pitch=m.pitch?'تباعد المسمارين '+new Intl.NumberFormat('ar-SA').format(m.pitch)+' مم':'مسمار تثبيت واحد';
 return pitch+' · '+(m.visual?'نموذج دائري بأبعاد المصنع.':'الشكل تقريبي ومراكز التثبيت مأخوذة من قالب المصنع.');
}
export function factoryHandleSummary(doc,allowedIds,{customer=false}={}){
 const ws=doc.room.workshop,c=readWorkshopCatalog(ws);
 if(!c)return [];
 const allowed=allowedIds?new Set(allowedIds):null,units=new Map(doc.kitchen.units.map(u=>[u.id,u])),bySku=new Map(c.items.map(i=>[i.sku,i.name]));
 const lines=new Set();
 for(const e of finishMembers(doc,c)){
  const f=c.families[e.family],slot=f.finishSlots?.handle;
  if(!slot||allowed&&!allowed.has(e.id)||units.get(e.id)?.handleStyle==='handleless')continue;
  if(!f.recipe.some(l=>l.sku===slot.source&&slot.labels.includes(l.label)&&recipeLineApplies(l,e)))continue;
  const sku=chosen(ws.finishes,e.id,'handle')??slot.source;
  if(customer){const name=bySku.get(sku);if(name)lines.add(name);}
  else lines.add((bySku.get(sku)||sku)+' · '+sku+' · '+handlePreviewNote(slot,sku,f.recipe));
 }
 return [...lines];
}
export function patchFinishPart(doc,catalog,scope,part,sku){
 if(sku&&!catalog.approved)throw Error('يلزم نشر كتالوج معتمد من المصنع قبل تثبيت بدائل العميل.');
 if(!owns(finishParts,part))throw Error('نوع القطعة غير معروف.');
 const w=doc.room.workshop||{},f=w.finishes||{},defaults={...f.partDefaults},units={...f.partUnits},members=finishMembers(doc,catalog);
 const group=scope==='all',targets=members.filter(e=>group?catalog.families[e.family].finishSlots?.[part]&&!e.locks?.finish&&!units[e.id]?.[part]:e.id===scope);
 if(!targets.length&&sku)throw Error('لا توجد وحدات مؤهلة لهذا الاختيار.');
 const by=new Map(catalog.items.map(i=>[i.sku,i]));
 if(sku)for(const e of targets){
  const def=catalog.families[e.family],slot=def.finishSlots?.[part],item=by.get(sku);
  if(!slot?.skus.includes(sku)||!item||(!item.available&&!(item.stockUnits>0)))throw Error('الصنف غير متاح أو غير معتمد لـ '+e.id+'.');
 }
 function assign(id,partSku){
  const next={...units[id]};if(partSku)next[part]=partSku;else delete next[part];
  if(Object.keys(next).length)units[id]=next;else delete units[id];
 }
 if(group){for(const e of members){
   const slot=catalog.families[e.family].finishSlots?.[part];
   if(slot&&e.locks?.finish&&!units[e.id]?.[part])assign(e.id,defaults[part]||slot.source);
  }if(sku)defaults[part]=sku;else delete defaults[part];
 }else assign(scope,sku);
 const finishes={...f},coverage={...f.partCoverage};
 if(group){if(sku)coverage[part]=targets.map(e=>e.id);else delete coverage[part];}
 if(Object.keys(coverage).length)finishes.partCoverage=coverage;else delete finishes.partCoverage;
 if(Object.keys(defaults).length)finishes.partDefaults=defaults;else delete finishes.partDefaults;
 if(Object.keys(units).length)finishes.partUnits=units;else delete finishes.partUnits;
 for(const e of targets){const plan=resolveFinishParts(catalog.families[e.family],finishes,e.id,by);if(sku&&plan.issues.length)throw Error(plan.issues.join(' '));}
 return {...doc,room:{...doc.room,workshop:{...w,finishes}}};
}
export function finishGeometryChanges(doc,cat){
 const fin=doc.room.workshop?.finishes;if(!fin?.partDefaults&&!fin?.partUnits)return undefined;
 const items=new Map(cat.items.map(i=>[i.sku,i]));
 const changed=finishMembers(doc,cat).flatMap(e=>{const plan=selectedParts(cat.families[e.family],fin,e.id,items);return plan.physical.length?[[e.id,plan.physical]]:[];});
 return changed.length?changed:undefined;
}

const namedColors={'أبيض':'#f1efe8','رملي':'#c5aa87','أسود':'#262a29','عاجي':'#eee7d6','رمادي':'#92958f','فضي':'#aab4b3','بني':'#80654d'};
export function catalogDisplayColor(item){
 const value=item?.colorHex||item?.color||'';return /^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():namedColors[value]||null;
}

// Only tint named surfaces actually represented by the CAD mesh. A concealed
// tube or a custom consumable stays a BOM line; it cannot tint a random face.
const visualTags={side:'body',floor:'body',top:'body',back:'back','interior-shelf':'shelf','interior-divider':'divider','front-rail':'edge',
 'pull':'handle','open-door-pull':'handle','knob':'handle','knob-post':'handle','bar-post':'handle','bar-handle':'handle','inner-hinge-plate':'hinge'};
export function paintSelectedParts(room,kitchen,faces){
 const w=room?.workshop,c=readWorkshopCatalog(w);if(!c||!Object.values(c.families||{}).some(f=>f.finishSlots))return;
 const items=new Map(c.items.map(i=>[i.sku,i])),byUnit=new Map(),fin=w.finishes;
 for(const e of finishMembers({room,kitchen},c)){
  const f=c.families[e.family];if(!f.finishSlots)continue;
  const parts=selectedParts(f,fin,e.id,items);if(!parts.issues.length)byUnit.set(e.id,parts.actual);
 }
 for(const face of faces){if(face.part!=='module')continue;
  const item=byUnit.get(face.id)?.get(visualTags[face.tag]);if(!item)continue;face.partSku=item.sku;const color=catalogDisplayColor(item);if(!color)continue;
  face.color=color;face.partSku=item.sku;face.frontFinish=null;face.frontColor=null;
 }
}
