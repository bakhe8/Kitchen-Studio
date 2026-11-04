import {inheritedName} from './kitchen-safe-keys.js';
// Surface-mounted constant-voltage DC lighting. Only the lowest occupied
// upper tier on the chosen wall is in scope. Leads use a star or a measured
// parallel jumper from the feed point of an earlier section. All strip segments are parallel.
import {convexIntersection} from './kitchen-oriented.js';
import {inwardDoorSectors} from './kitchen-placement.js';
import {architectureWall} from './kitchen-architecture.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
const req=(s,n=160)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const key=s=>typeof s==='string'&&/^[a-z0-9][a-z0-9_.-]{0,47}$/i.test(s)&&!inheritedName(s)&&!['constructor','prototype','__proto__'].includes(s);
const n=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
const rnd=x=>Math.round(x*1000)/1000;
const digest=v=>offlineDigest(new TextEncoder().encode(JSON.stringify(v)));
export const lightParts={strip:'شريط LED',channel:'قناة التثبيت',cover:'غطاء القناة',lead:'كابل تغذية ثنائي',connector:'وصلة طرفية',driver:'المحوّل'};
export const lightNumbers={volts:'جهد الشريط الاسمي (V DC)',driverVolts:'جهد خرج المحوّل (V DC)',wattMetre:'قدرة الشريط (واط/م)',capacityW:'قدرة المحوّل الاسمية (واط)',reservePct:'نسبة الاحتياطي المطلوبة من القدرة (%)',step:'خطوة قص الشريط (مم)',minLength:'أقل مقطع مسموح (مم)',maxLength:'أطول مقطع قابل للتغذية من طرف واحد (مم)',inset:'الارتداد عن كل نهاية مستقلة (مم)',dark:'أقصى باقٍ غير مضاء بعد التقريب (مم)',setback:'المسافة من مقدمة جسم العلوي إلى محور القناة (مم)',channelWidth:'عرض القناة المركّبة (مم)',channelHeight:'نزول القناة عن جسم العلوي (مم)',ohmsM:'مقاومة موصل واحد أوم/م عند التشغيل',maxDropPct:'أقصى هبوط تراكمي للجهد (%)',amps:'تيار الكابل والوصلة المسموح (أمبير)'};
const fields={volts:[1,120],driverVolts:[1,120],wattMetre:[.01,1000],capacityW:[.01,20000],reservePct:[0,99],step:[1,1000],minLength:[1,20000],maxLength:[1,30000],inset:[0,500],dark:[0,1000],setback:[0,1500],channelWidth:[1,200],channelHeight:[1,200],ohmsM:[.000001,20],maxDropPct:[.001,50],amps:[.001,500]};
export function cleanLinearKits(raw,by){
 if(raw==null)return {};if(typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>48)return null;
 const out={};
 for(const [id,r] of Object.entries(raw)){
  if(!key(id)||!r||!req(r.label,84)||!req(r.reference)||!req(r.wiringRef))return null;
  const v={label:r.label.trim(),reference:r.reference.trim(),wiringRef:r.wiringRef.trim()};
  for(const k of Object.keys(lightParts)){if(by.get(r[k])?.kind!==(['connector','driver'].includes(k)?'piece':'bar'))return null;v[k]=r[k];}
  for(const [k,[a,b]] of Object.entries(fields)){if(!n(r[k],a,b))return null;v[k]=r[k];}
  if(r.maxLength<r.minLength||r.channelWidth/2>r.setback||!Number.isInteger(r.step))return null;
  out[id]=v;
 }return out;
}
const sectionId=s=>typeof s==='string'&&/^ls-[a-f0-9]{24}$/.test(s);
export function cleanLinearChoice(v){
 if(!v||!['none','factory'].includes(v.state))return null;
 if(v.state==='none')return {state:'none'};if(!key(v.recipe)||!Array.isArray(v.feeds)||v.feeds.length>128)return null;
 const set=new Set(),feeds=[];
 for(const f of v.feeds){
  if(!f||!sectionId(f.section)||set.has(f.section)||!req(f.driver,64)||(!sectionId(f.parent)&&f.parent!=='driver')||!n(f.length,0,30000)||!req(f.ref)||!/^[a-f0-9]{64}$/.test(f.anchor))return null;
  set.add(f.section);feeds.push({section:f.section,driver:f.driver,parent:f.parent,length:f.length,ref:f.ref.trim(),anchor:f.anchor});
 }
 if(v.existingDrivers!=null&&(!Array.isArray(v.existingDrivers)||v.existingDrivers.length>128||new Set(v.existingDrivers).size!==v.existingDrivers.length||v.existingDrivers.some(id=>!req(id,64))))return null;
 return {state:'factory',recipe:v.recipe,feeds,...(v.existingDrivers?.length?{existingDrivers:[...v.existingDrivers]}:{})};
}
export function lightSections(doc,wall,r,catalog){
 const runs=doc.kitchen.runs.filter(a=>a.wall===wall&&a.tier==='upper'),spans=[],sections=[],issues=[],warnings=[];
 const material=sku=>catalog.items.find(i=>i.sku===sku);
 if(!r||!runs.length)return {sections,issues:['أنشئ الصف العلوي المدعوم قبل تفصيل الإنارة.'],warnings};
 const bodies=runs.flatMap(run=>doc.kitchen.units.filter(u=>u.runId===run.id).map(u=>({u,run})));
 if(!bodies.length)return {sections,issues:['لا توجد وحدات علوية فعلية لحمل القنوات.'],warnings};
 const supports=bodies.filter(x=>['storage','open-shelf'].includes(x.u.kind)),lowest=Math.min(...supports.map(({run})=>run.bottom));
 for(const {u,run} of supports.filter(x=>x.run.bottom===lowest).sort((a,b)=>a.u.u-b.u.u)){
  const a=rnd(u.u*10),b=rnd((u.u+u.width)*10),y=rnd(run.bottom*10),z=rnd(run.depth*10-r.setback),last=spans.at(-1);
  if(y-r.channelHeight<0){issues.push('تنخفض القناة أسفل منسوب الأرض.');continue;}
  if(z-r.channelWidth/2<0){issues.push('عمق جسم '+u.id+' لا يتيح موضع القناة المحدد.');continue;}
  if(last&&last.end>a+.001){issues.push('تراكب وحدات إنارة عند نفس المنسوب.');continue;}
  if(last&&Math.abs(last.end-a)<.001&&last.z===z&&last.y===y){last.end=b;last.units.push(u.id);}
  else spans.push({from:a,end:b,y,z,units:[u.id]});
 }
 if(!spans.length)issues.push('لا يوجد امتداد سفلي مكشوف صالح على مستوى الخزائن المحدد.');
 const cap=Math.min(r.maxLength,...['strip','channel','cover'].map(k=>material(r[k])?.stockLengthMm??0));
 let limit=Math.floor(cap/r.step);const min=Math.ceil(r.minLength/r.step);
 while(limit>0&&['strip','channel','cover'].some(k=>{const i=material(r[k]);return i&&i.stockLengthMm-limit*r.step>.0001&&i.stockLengthMm-limit*r.step<i.kerfMm-.0001;}))limit--;
 if(limit<min)return {sections,issues:['مقاس الخام وخطوة القص لا يتيحان أقصر مقطع معلوم.'],warnings};
 for(const s of spans){
  const mm=rnd(s.end-s.from-2*r.inset),steps=Math.floor((mm+.000001)/r.step),dark=rnd(mm-steps*r.step),count=Math.ceil(steps/limit);
  if(count<1||count>128||steps<count*min||dark>r.dark+.001){issues.push('تعذر تشكيل امتداد '+s.from+'–'+s.end+' مم على خطوة القص وحدود الجزء غير المضاء.');continue;}
  let from=s.from+r.inset;
  for(let j=0;j<count;j++){
   const len=(Math.floor(steps/count)+(j<steps%count?1:0))*r.step,end=rnd(from+len),id='ls-'+digest([wall,s.y,s.z,from,end]).slice(0,24);
   sections.push({id,wall,from,end,y:s.y,z:s.z,width:r.channelWidth,height:r.channelHeight,length:len,watts:rnd(len*r.wattMetre/1000),units:s.units});
   from=end;
  }if(dark)warnings.push('يبقى '+dark+' مم دون شريط عند نهاية الامتداد '+s.end+'.');
 }
 if(sections.length>128)return {sections:[],issues:['تجاوز عدد المقاطع حد هذه الدائرة. قسّم التفصيل.'],warnings};
 return {sections,issues,warnings};
}
export function lightFeedAnchor(doc,wall,seg,driver,parent){
 const edge=architectureWall(doc.room,wall);
 if(!edge||!driver||driver.kind!=='access'||driver.service!=='driver'||driver.wall!==wall)return '';
 return digest([wall,edge.a,edge.b,doc.room.height,seg.id,driver.id,driver.startMm,driver.endMm,driver.bottomMm,driver.topMm,driver.depthMm,parent?.id||'driver']);
}
export function calculateWallLighting(doc,wall,catalog){
 const choice=doc.room.workshop?.options?.[wall]?.linearLight;if(!choice||choice.state==='none')return null;
 const r=catalog.linearKits?.[choice.recipe],issues=[],releaseIssues=[],pieces=[],loads=[],zones=doc.room.workshop?.serviceZones?.zones||[],edge=architectureWall(doc.room,wall);
 const result={issues,releaseIssues,pieces,loads,sections:[],warnings:[]};
 if(!r||!edge){issues.push('ينقص موديل إنارة المصنع أو الجدار.');return result;}
 const spans=lightSections(doc,wall,r,catalog);issues.push(...spans.issues);result.sections=spans.sections;result.warnings=spans.warnings;
 const segs=spans.sections,by=new Map(segs.map((s,i)=>[s.id,{...s,index:i}])),feedMap=new Map(choice.feeds.map(f=>[f.section,f]));
 if(r.volts!==r.driverVolts)issues.push('جهد خرج المحوّل لا يطابق شريط الإنارة.');
 if(choice.feeds.some(f=>!by.has(f.section)))issues.push('تغيّرت مقاطع إنارة مرتبطة بمسار مقاس. حدّث التغذيات على الرسم الحالي.');
 const add=(sku,label,count,a=null)=>{const item=catalog.items.find(i=>i.sku===sku);if(item)pieces.push({unitId:'wall:'+wall+':lighting',runId:wall,family:'lighting',sku,label,count,a,b:null,kind:item.kind,recipeId:choice.recipe,drawing:r.reference,operation:a==null?'تركيب حسب مخطط التغذية':'قص مقاس من خام الصنف'});};
 const drivers=new Map(),nodes=[];
 for(const s of segs){
  const label=' · '+s.from+'–'+s.end+' مم';add(r.strip,'شريط'+label,1,s.length);add(r.channel,'قناة'+label,1,s.length);add(r.cover,'غطاء قناة'+label,1,s.length);
  const f=feedMap.get(s.id),z=zones.find(z=>z.id===f?.driver&&z.kind==='access'&&z.service==='driver'&&z.wall===wall),parent=f?.parent==='driver'?null:by.get(f?.parent);
  const u={s,f,parent:null,driver:z,amps:s.watts/r.volts,drop:0};nodes.push(u);
  if(!f||!z||f.parent!=='driver'&&(!parent||parent.index>=nodes.length-1||feedMap.get(parent.id)?.driver!==f.driver)){issues.push('ينقص مسار تغذية موثق أو محوّل صالح للمقطع'+label+'.');continue;}
  if(f.anchor!==lightFeedAnchor(doc,wall,s,z,parent))issues.push('تغيّر مرجع موضع التغذية للمقطع'+label+'.');
  const gap=(v,a,b)=>Math.max(0,a-v,v-b);
  const minD=parent?Math.hypot(s.from-parent.from,s.y-parent.y,s.z-parent.z):Math.hypot(gap(s.from-edge.start*10,z.startMm,z.endMm),gap(s.y,z.bottomMm,z.topMm),gap(s.z,0,z.depthMm));
  if(f.length+.001<minD)issues.push('طول الوصلة أقل من المسافة الهندسية الدنيا '+rnd(minD)+' مم للمقطع'+label+'.');
  if(f.length>0)add(r.lead,'كابل تغذية'+label,1,f.length);add(r.connector,'وصلتا مسار التغذية'+label,2);
  if(!drivers.has(z.id)){drivers.set(z.id,{zone:z,watts:0,loss:0});if(!choice.existingDrivers?.includes(z.id))add(r.driver,'محوّل '+z.name,1);}
  u.parent=parent?nodes[parent.index]:null;
 }
 for(const node of [...nodes].reverse())if(node.parent)node.parent.amps+=node.amps;
 for(const u of nodes){
  if(!u.f||!u.driver||!drivers.has(u.driver.id))continue;
  const group=drivers.get(u.driver.id),resistance=2*u.f.length/1000*r.ohmsM;
  u.drop=(u.parent?.drop||0)+u.amps*resistance;group.watts+=u.s.watts;group.loss+=u.amps*u.amps*resistance;
  if(u.amps>r.amps+.00001)issues.push('تيار الفرع يتجاوز حد الكابل أو الوصلة عند '+u.s.from+' مم.');
  if(100*u.drop/r.volts>r.maxDropPct+.00001)issues.push('هبوط الجهد التراكمي يتجاوز حد الموديل عند '+u.s.from+' مم.');
 }
 for(const {zone,watts,loss} of drivers.values()){
  let existing=0;for(const z of zones.filter(z=>z.kind==='light'&&z.driverId===zone.id)){
   if(z.wattsPerM==null){issues.push('قدرة مقطع إنارة آخر على المحوّل '+zone.name+' مجهولة.');continue;}
   existing+=Math.hypot(z.endMm-z.startMm,z.topMm-z.bottomMm)*z.wattsPerM/1000;
  }
  if(zone.capacityW==null||Math.abs(zone.capacityW-r.capacityW)>.001)issues.push('قدرة المحوّل الموثقة بالموقع لا تطابق قدرة موديل المصنع '+zone.name+'.');
  const demand=watts+loss+existing,available=r.capacityW*(1-r.reservePct/100);
  if(demand>available+.00001)issues.push('حمل المحوّل '+zone.name+' يتجاوز القدرة المتاحة بعد الاحتياطي بمقدار '+rnd(demand-available)+' واط.');
  loads.push({id:zone.id,stripW:rnd(watts),lossW:rnd(loss),otherW:rnd(existing),requiredW:rnd(demand),availableW:rnd(available)});
 }
 return result;
}

export function lightBodies(doc,wall,catalog){
 const v=doc.room.workshop?.options?.[wall]?.linearLight,r=v?.state==='factory'&&catalog?.linearKits?.[v.recipe];if(!r)return [];
 const {sections}=lightSections(doc,wall,r,catalog);return sections.map(s=>({role:'under-light',section:s.id,wall,featureId:'light-'+s.id,x:s.from,y:s.y-r.channelHeight,z:s.z-r.channelWidth/2,w:s.length,h:r.channelHeight,d:r.channelWidth,color:'#f1dfa0'}));
}

export function linearCollisionIssues(geo,wall,scope){
 const selected=scope&&new Set(scope.unitIds);
 const bodies=geo.units.filter(u=>!selected||selected.has(u.id)).flatMap(u=>[...(u.bodyParts||[u]),...u.openParts].map(v=>({...v,owner:u.id})));
 if(!scope)bodies.push(...geo.worktops,...geo.features.filter(f=>['heater','column','beam','shaft','window','door'].includes(f.kind)),...inwardDoorSectors(geo),...(geo.cornerBodies||[]).flatMap(c=>c.parts),
  ...(geo.wallAccessories||[]).filter(v=>v.role!=='under-light').map(v=>({...v,bottom:v.y/10,height:v.h/10})));
 const issues=new Set();
 for(const l of (geo.wallAccessories||[]).filter(v=>v.role==='under-light'&&v.wall===wall)){
  for(const v of bodies)if(Math.min((l.y+l.h)/10,v.bottom+v.height)>Math.max(l.y/10,v.bottom)+.00001&&convexIntersection(l.polygon,v.polygon).length)
   issues.add('قناة الإنارة أسفل الصف تتعارض مع '+(v.owner||v.id||v.featureId||v.role||'عنصر مرسوم')+' عند '+l.x+' مم.');
 }
 return [...issues];
}
