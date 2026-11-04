import {roomArchitecture} from './kitchen-architecture.js';
import {kitchenFeatureSpecs} from './kitchen-model.js';
import {pointTypes} from './kitchen-site-survey-model.js';
const f=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:3}).format(n),mm=n=>Math.round(n*10),inMM=v=>f(v)+' مم',area=v=>f(v/1e6)+' م²',per=v=>f(v/1000)+' م';
const shapes={rectangle:'مستطيل',notch:'ردّة قائمة / منور',chamfer:'ركن مشطوف',taper:'فرق عرض بين الطرفين',other:'مسقط مختلف',outline:'محيط متعدد الأضلاع'};
const cornerLabels={'front-right':'أمامي أيمن','front-left':'أمامي أيسر','back-right':'خلفي أيمن','back-left':'خلفي أيسر'};
const opts=d=>Object.entries(d).map(([value,label])=>({value,label}));
const known=e=>e?.state==='known',num=q=>q?.value; const designSource='من الرسم الحالي · ليس قياسًا ميدانيًا';
const shapeSource='من حدود الغرفة في الرسم';
const labels={width:'عرض الغرفة الداخلي',length:'عمق الغرفة الداخلي',height:'الارتفاع الصافي للغرفة',cutW:'عرض الجزء المقتطع',cutD:'عمق الجزء المقتطع'};
const fold=s=>String(s??'').normalize('NFKC').replace(/[إأآ]/g,'ا').replace(/[\u064b-\u065f\u0640]/g,'').trim();
const rawScale=u=>({'مم':1,'ملم':1,'mm':1,'سم':10,'cm':10,'م':1000,'m':1000})[String(u||'').trim()];
const polyCross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const on=(a,b,c)=>Math.abs(polyCross(a,b,c))<1e-7&&c[0]>=Math.min(a[0],b[0])-1e-7&&c[0]<=Math.max(a[0],b[0])+1e-7&&c[1]>=Math.min(a[1],b[1])-1e-7&&c[1]<=Math.max(a[1],b[1])+1e-7;
function crosses(a,b,c,d){return on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b)||(polyCross(a,b,c)*polyCross(a,b,d)<0&&polyCross(c,d,a)*polyCross(c,d,b)<0);}
function measuredFootprint(rows){const list=rows.filter(r=>r.inputCode==='SITE-03'&&r.valueType==='polygon'&&r.execution!=='excluded'&&(r.itemId==='room'||r.location?.endsWith('[room]'))&&/^(?:محيط|مسقط|حدود)[\s\S]*(?:الغرفه|الغرفة|المطبخ)/.test(fold(r.property)));
 if(list.length!==1||!['measured','documented'].includes(list[0].verification))return null;try{const r=list[0],scale=rawScale(r.unit);if(!scale)return null;let p=JSON.parse(r.value);if(!Array.isArray(p)||p.length<3||p.length>256||!p.every(t=>Array.isArray(t)&&t.length>=2&&t.slice(0,2).every(Number.isFinite)))return null;
 p=p.map(([x,z])=>[x*scale,z*scale]);if(p.length>3&&p[0].join()===p.at(-1).join())p.pop();
 if(new Set(p.map(t=>t.join(','))).size!==p.length)return null;let A=0,L=0;
 for(let i=0;i<p.length;i++){const j=(i+1)%p.length;A+=p[i][0]*p[j][1]-p[j][0]*p[i][1];L+=Math.hypot(p[i][0]-p[j][0],p[i][1]-p[j][1]);
 for(let k=i+1;k<p.length;k++){const l=(k+1)%p.length;if(k!==j&&l!==i&&crosses(p[i],p[j],p[k],p[l]))return null;}}
 return Math.abs(A)>1?{area:Math.abs(A)/2,length:L,row:r}:null;}catch{return null;}}
function contourParts(r){const A=roomArchitecture(r),cut=A.cut,shape=A.measured?'outline':cut?.kind||'rectangle',w=mm(A.width),d=mm(A.length),h=mm(A.height),sig=[shape,cut?.corner||'',w,d,h,mm(cut?.width||0),mm(cut?.depth||0)].join('-'),dims=inMM(w)+' × '+inMM(d)+' × '+inMM(h),detail=cut?' · '+cornerLabels[cut.corner]+' · '+inMM(mm(cut.width))+(shape==='taper'?'':' × '+inMM(mm(cut.depth))):'',ref=(r.name||'غرفة المطبخ')+' [room]';return {A,cut,shape,w,d,h,sig,dims,detail,ref};}
export function contourAttestation(room){const {sig,shape,dims,detail,ref}=contourParts(room);return {id:'room-contour-'+sig,code:'SITE-03',itemId:'room',type:'choice',location:ref,property:'مطابقة المسقط: '+shapes[shape]+' · '+dims+detail,label:'هل تحققت في الموقع من الشكل والأبعاد المعروضة؟',hint:'يشمل ذلك العرض والعمق والارتفاع وقطع الركن إن وُجد. إذا توفر قياس واحد فقط فاختر إدخال المقاسات.',options:opts({match:'تحققت منها وهي مطابقة',width:'العرض فقط مختلف؛ تحققت من الباقي',length:'العمق فقط مختلف؛ تحققت من الباقي',height:'الارتفاع فقط مختلف؛ تحققت من الباقي',manual:'شكل مختلف أو قياسات متعددة / جزئية'}),verification:'confirmed'};}
function siteSurvey(c){
 const r=c.room,{A,cut,shape,w,d,h,sig,dims,detail,ref}=contourParts(r);
 c.design('الغرفة في الرسم',shapes[shape]+' · '+dims+detail,designSource);
 const ar=A.area*100,perim=A.walls.reduce((s,x)=>s+x.length,0)*10;
 if(A.measured){const ref=r.architecture.outline.reference;c.derive('مساحة المحيط المسجل',area(ar),ref);c.derive('محيط الأضلاع المسجلة',per(perim),ref);return;}
 const base={itemId:'room',location:ref,scopeIds:['room'],type:'number',unit:'مم',min:1,max:30000,verification:'measured'};
 const question=(k,code,proposal,aliases,extra={})=>({...base,id:'room-'+k,code,property:labels[k],label:'كم '+labels[k]+' بعد التشطيب؟',aliases,defaultValue:proposal,defaultSource:proposal!=null?'المقاس في الرسم فقط':'',...extra});
 const ws=question('width','SITE-03',w,['العرض الداخلي','عرض الغرفة','عرض الغرفة بعد التشطيب']),ls=question('length','SITE-03',d,['الطول الداخلي','طول الغرفة','طول الغرفة الداخلي','عمق الغرفة','طول الغرفة بعد التشطيب']),hs=question('height','SITE-08',h,['الارتفاع الصافي','ارتفاع السقف','ارتفاع الغرفة','منسوب السقف','ارتفاع السقف عن الأرضية النهائية']);
 const polygon=measuredFootprint(c.rows.filter(v=>!c.options.revision||v.revision===c.options.revision));
 if(polygon){const src='من إحداثيات المسقط المقاس: '+(polygon.row.readingRef||polygon.row.itemId);c.derive('مساحة أرضية الموقع',area(polygon.area),src);c.derive('محيط الموقع',per(polygon.length),src);c.ask(hs);return;}
 const checks=[ws,ls,hs].map(q=>c.peek(q));const fallback=checks.every(ev=>ev.state==='missing');
 const confirmSpec=contourAttestation(r);
 const contourShape={id:'actual-shape',code:'SITE-03',itemId:'room',location:ref,scopeIds:['room'],type:'choice',property:'شكل المسقط المقاس',options:opts(shapes),aliases:['شكل الغرفة','شكل المسقط']};
 const shapeEv=c.peek(contourShape);const shapeOK=shapeEv.state==='missing'||known(shapeEv)&&shapeEv.value===shape;
 const cutWP=question('cutW','SITE-10',cut&&mm(cut.width),['عرض ردة المنور','فرق العرض بين الطرفين']),cutDP=question('cutD','SITE-10',cut&&mm(cut.depth),['عمق ردة المنور']);
 const relevantCuts=cut?[cutWP,...(shape==='taper'?[]:[cutDP])]:[];const cutOK=relevantCuts.every(q=>{const ev=c.peek(q);return ev.state==='missing'||known(ev)&&Math.abs(ev.value-q.defaultValue)<1e-7;});
 const existing=c.peek(confirmSpec);const check=(fallback||existing.state!=='missing')?c.ask(confirmSpec):null;
 if(check&&(!known(check)||check.value==='match'&&shapeOK&&cutOK&&checks.every((ev,i)=>ev.state==='missing'||known(ev)&&Math.abs(ev.value-[w,d,h][i])<1e-7))){
   const matched=known(check)&&check.value==='match',src=matched?'من المسقط بعد تأكيد الفني مطابقته':'تقدير من الرسم فقط، قبل الرفع';
   c.derive('مساحة الأرضية'+(matched?'':' في الرسم'),area(ar),src);c.derive('محيط الغرفة'+(matched?'':' في الرسم'),per(perim),src);if(shape==='rectangle')c.derive('القطر الهندسي المرجعي',inMM(Math.hypot(w,d)),src+'؛ للمقارنة مع قطر يُقاس مستقلًا');return;
 }
 if(known(check)&&['width','length','height'].includes(check.value)){
   const pos=['width','length','height'].indexOf(check.value),othersAgree=checks.every((ev,i)=>i===pos||ev.state==='missing'||known(ev)&&Math.abs(ev.value-[w,d,h][i])<1e-7);
   if(othersAgree&&cutOK&&shapeOK){
    const spec=[ws,ls,hs][pos];const actual=c.ask({...spec,defaultValue:undefined,defaultSource:'',hint:'أدخل القياس المختلف. تؤخذ بقية حدود الغرفة من الرسم الذي أكدت مطابقته.'});if(!known(actual))return;
    const baseDims=[w,d,h];baseDims[pos]=actual.value;const [W,L,H]=baseDims,X=cut?mm(cut.width):0,Y=cut&&shape!=='taper'?mm(cut.depth):0;
    if(X>=W||Y>=L){c.info('راجع حدود الركن','لا يترك القياس الجديد مساحة للقطع المرسوم.','أوقف الحساب');return;}
    let areaNow=W*L,perNow=2*(W+L);if(shape==='notch')areaNow-=X*Y;if(shape==='chamfer'){areaNow-=X*Y/2;perNow+=Math.hypot(X,Y)-X-Y;}if(shape==='taper'){areaNow-=X*L/2;perNow+=Math.hypot(X,L)-X-L;}
    const src=spec.property+' من الموقع؛ بقية الحدود من الرسم بعد تحقق الفني';c.derive('الأبعاد بعد الرفع',[W,L,H].map(inMM).join(' × '),src);c.derive('مساحة أرضية الموقع',area(areaNow),src);c.derive('محيط الموقع',per(perNow),src);
    const from=[w,d,h][pos];
    if(actual.record?.verification==='measured'&&Number.isInteger(actual.value)&&actual.value!==from&&actual.value>=600&&actual.value<=(check.value==='height'?6000:12000)){
     const label='تطبيق '+labels[check.value]+' على الرسم',evidenceIds=[check.record.id,actual.record.id];
     c.model.roomProposal={label,source:src,dimension:check.value,fromMM:from,toMM:actual.value,token:[sig,check.value,actual.value,...evidenceIds].join('|'),evidenceIds};}
    if(shape==='rectangle')c.derive('القطر الهندسي المرجعي',inMM(Math.hypot(W,L)),src+'؛ لا يغني عن قطر تحقق مستقل');return;
   }c.info('سجّلت اختلافًا في بُعد واحد','توجد قراءة مستقلة لبُعد آخر لا تطابق الرسم؛ يلزم مراجعة الأبعاد المعنية.','لذلك انتقل الرفع إلى القياسات المفصلة');
 }
 if(known(check)&&check.value==='match')c.info('الرفع يحتاج مراجعة','توجد قراءة تختلف عن المطابقة السابقة أو لم تُحسم. استُخدمت قراءات الموقع لكل خاصية على حدة.','المطابقة لا تتجاوز قراءة جديدة متعارضة');
 const kind=c.ask({id:'actual-shape',code:'SITE-03',itemId:'room',location:ref,scopeIds:['room'],type:'choice',property:'شكل المسقط المقاس',label:'ما شكل الأرضية في الموقع؟',options:opts(shapes),defaultValue:shape,defaultSource:'شكل الرسم فقط',aliases:['شكل الغرفة','شكل المسقط'],verification:'measured'});
 const we=c.ask(ws),le=c.ask(ls);c.ask(hs);
 if(!known(kind))return;const yesWidth=['notch','chamfer','taper'].includes(kind.value),yesD=['notch','chamfer'].includes(kind.value);
 const cw=yesWidth?c.ask(question('cutW','SITE-10',cut?.kind===kind.value?mm(cut.width):undefined,['عرض ردة المنور','فرق العرض بين الطرفين'],{label:kind.value==='taper'?'كم فرق العرض بين الطرفين؟':'كم عرض قطع الركن؟',max:known(we)?we.value-.1:30000})):null;
 const cd=yesD?c.ask(question('cutD','SITE-10',cut?.kind===kind.value?mm(cut.depth):undefined,['عمق ردة المنور'],{label:'كم عمق قطع الركن؟',max:known(le)?le.value-.1:30000})):null;
 if(kind.value==='other'){c.info('المسقط غير منتظم','اربط نقاط حدوده الفعلية كقراءة مضلع «محيط الغرفة» في سجل الغرفة، لتُحسب المساحة من الحدود.','العرض والعمق وحدهما لا يكفيان');return;}
 if(!known(we)||!known(le)||yesWidth&&!known(cw)||yesD&&!known(cd))return;
 const W=num(we),L=num(le),X=num(cw)||0,Y=num(cd)||0;let a=W*L,p=2*(W+L);if(kind.value==='notch')a-=X*Y;if(kind.value==='chamfer'){a-=X*Y/2;p+=Math.hypot(X,Y)-X-Y;}if(kind.value==='taper'){a-=X*L/2;p+=Math.hypot(X,L)-X-L;}
 if(a<=0||p<=0||X>=W||Y>=L){c.info('راجع حدود الركن','القطع المقاس أكبر من المسقط المقاس.','توقّف الحساب');return;}
 const src='من شكل الغرفة وأبعاد الرفع المسجّلة';c.derive('مساحة أرضية الموقع',area(a),src);c.derive('محيط الموقع',per(p),src);if(kind.value==='rectangle')c.derive('القطر الهندسي المرجعي',inMM(Math.hypot(W,L)),src+'؛ لا يغني عن قياس القطر للتحقق');
}
const featureCode={door:'SITE-11',window:'SITE-12',shaft:'SITE-10',beam:'SITE-09',column:'SITE-09',heater:'MEP-06',water:'MEP-01',drain:'MEP-03',vent:'MEP-13',electric:'MEP-09',gas:'MEP-08','floor-drain':'MEP-04','floor-water':'MEP-01','floor-cleanout':'MEP-03'};
const titleOf=k=>pointTypes[k]||kitchenFeatureSpecs[k]?.label||k;
function serviceSurvey(c,options){
 const r=c.room,A=roomArchitecture(r),features=(c.kitchen?.features||[]).filter(f=>featureCode[f.kind]),floor=(r.sitePoints||[]).filter(x=>featureCode[x.kind]),ls=[...features,...floor],targets=ls.map(t=>({id:t.id,label:titleOf(t.kind)+(t.wall?' · '+(A.walls.find(w=>w.id===t.wall)?.label||t.wall):' · الأرضية')+' · '+t.id}));targets.push({id:'unlisted',label:'تجهيز موجود خارج الرسم'});
 const selected=c.targets(targets,options.entityId);let o=ls.find(x=>x.id===selected),k=o?.kind,id=o?.id,wall=A.walls.find(w=>w.id===o?.wall),floorObj=!!o&&!o.wall;
 let location=o?titleOf(k)+' · '+(wall?.label||'الأرضية')+' ['+id+']':'',code=k?featureCode[k]:null;
 if(!o){const typ=c.ask({id:'unlisted-kind',itemId:'كشف الخدمات',code:'SITE-15',type:'choice',property:'نوع العنصر خارج الرسم الجاري رفعه',label:'أي عنصر غير مرسوم تراه في الموقع؟',options:Object.entries(featureCode).map(([v])=>({value:v,label:titleOf(v)})),verification:'confirmed'});
 if(!known(typ))return;k=typ.value;code=featureCode[k];floorObj=k.startsWith('floor-');
 const ident=c.ask({id:'unlisted-id-'+k,itemId:'كشف الخدمات',code:'SITE-15',type:'text',property:'معرّف '+titleOf(k)+' خارج الرسم الجاري رفعه',label:'بأي اسم ستسجل هذا العنصر؟',hint:'استخدم معرّفًا ثابتًا مثل «صرف-02»؛ يمكن العودة إليه من السجل.',verification:'confirmed'});
 if(!known(ident))return;id=ident.value;
 if(!floorObj){const w=c.ask({id:'survey-wall',itemId:id,code,type:'choice',property:'الجدار المضيف',label:'على أي جدار يقع؟',options:A.walls.map(w=>({value:w.id,label:w.label})),verification:'measured'});if(!known(w))return;wall=A.walls.find(t=>t.id===w.value);}location=wall?.label||'الأرضية';
 }
 const base={code,itemId:id,scopeIds:[id],location,verification:'measured'};
 let matched=false,signature='';
 if(o){const facts=floorObj?[mm(o.x),mm(o.z),mm(o.size)]:[mm(o.u-(wall?.start||0)),mm(o.bottom),mm(o.width),mm(o.height),mm(o.depth)];signature=facts.join('-')+'-'+(o.wall||'floor');
 const isSolid=['door','window','column','shaft','beam','heater'].includes(k);
 const dimsStr=(!floorObj&&isSolid)?' · العرض '+inMM(facts[2])+'، الارتفاع '+inMM(facts[3])+'، '+(['door','window'].includes(k)?'العمق ':'البروز ')+inMM(facts[4]):'';
 const centerText=(!floorObj&&!isSolid)?' · مركز النقطة: '+inMM(facts[0]+facts[2]/2)+' من بداية الضلع، '+inMM(facts[1]+facts[3]/2)+' عن أرضية الرسم · حجم الرمز '+inMM(facts[2])+' × '+inMM(facts[3])+'، بروز '+inMM(facts[4]):'';
 c.design('عنصر الرسم',floorObj?'من يسار المسقط '+inMM(facts[0])+'، من خلفه '+inMM(facts[1])+' · مقاس الغطاء '+inMM(facts[2]):(wall?.label||o.wall)+(isSolid?' · إلى الحافة الأولى '+inMM(facts[0])+' من بداية الضلع، منسوب أسفل '+inMM(facts[1])+dimsStr:centerText),designSource);
 const gate={...base,id:'exists-'+signature,type:'choice',property:'مطابقة العنصر المرسوم: '+signature,label:'ماذا وجدت عند معاينة '+titleOf(k)+'؟',options:opts({match:!floorObj&&!isSolid?'موجود وتحققت من موضع مركزه':'موجود، وتحققت من مطابقة مقاساته وموضعه',diff:'موجود، ولديّ قياسات فعلية',absent:'غير موجود في الموقع'}),verification:'confirmed'};
 const measuredProof=c.rows.find(v=>v.inputCode===code&&(v.itemId===id||v.location?.endsWith('['+id+']'))&&(!c.options.revision||v.revision===c.options.revision)&&v.verification==='measured'&&v.value!=null&&['existing','executed','unspecified'].includes(v.execution)&&['number','point','line','polygon'].includes(v.valueType));
 const gateEv=c.peek(gate);const inferred=measuredProof&&gateEv.state==='missing';
 const result=inferred?{state:'known',value:'diff'}:c.ask(gate);
 if(inferred)c.derive('وجود العنصر في الموقع','موثّق بقراءة موقع مرتبطة به',measuredProof.property+' · '+(measuredProof.readingRef||measuredProof.itemId));
 if(!known(result))return;if(result.value==='absent'){c.info('لا يلزم رفع مقاسات هذا العنصر','يبقى العنصر في التصميم إلى أن يراجعه المصمم.','سجّل الفني عدم وجوده');return;}matched=result.value==='match';
 }
 const askN=(idKey,property,label,old,aliases=[],max=30000,minimum=0)=>c.ask({...base,id:'fixture-'+idKey,type:'number',property,label,aliases,unit:'مم',min:minimum,max,defaultValue:old,defaultSource:old!=null?designSource:''});
 if(floorObj){if(!matched){askN('x','من يسار المسقط','كم يبعد المركز عن يسار المسقط؟',o&&mm(o.x));askN('z','من خلف المسقط','كم يبعد المركز عن خلف المسقط؟',o&&mm(o.z));askN('size','مقاس غطاء النقطة','كم مقاس الغطاء؟',o&&mm(o.size),[],1000,1);}askN('level','منسوب الغطاء عن صفر التشطيب','ما منسوب أعلى الغطاء عن صفر الأرضية النهائية؟',undefined,['منسوب الغطاء'],10000,-10000);return;}
 const opening=['door','window'].includes(k),built=['column','beam','shaft','heater'].includes(k);
 if(matched){if(opening||built)c.derive('منسوب الحافة العليا',inMM(mm(o.bottom+o.height)),'أسفل العنصر + ارتفاعه · من الرسم بعد مطابقة الفني');}
 else if(opening||built){askN('offset','بداية العنصر من بداية ضلع الجدار','ما بُعد الحافة الأولى عن بداية ضلع الجدار؟',o&&mm(o.u-(wall?.start||0)),['بداية الفتحة']);const b=askN('below','منسوب أسفل العنصر','ما ارتفاع أسفل العنصر عن صفر التشطيب؟',o&&mm(o.bottom),['منسوب جلسة الشباك']);askN('width','عرض العنصر الصافي','ما عرض '+titleOf(k)+'؟',o&&mm(o.width),['عرض الفتحة الصافي']);const ht=askN('height','ارتفاع العنصر الصافي','ما ارتفاعه؟',o&&mm(o.height),['ارتفاع الفتحة الصافي']);if(known(b)&&known(ht))c.derive('منسوب الحافة العليا',inMM(b.value+ht.value),'منسوب أسفل العنصر + ارتفاعه المقاس');if(built)askN('projection','البروز من وجه الجدار','كم يبرز داخل الغرفة؟',o&&mm(o.depth));}
 else{askN('center','بُعد مركز المخرج عن بداية الجدار','كم يبعد مركز النقطة عن بداية الضلع؟',o&&mm(o.u-(wall?.start||0)+o.width/2),['بعد المركز عن بداية الجدار']);askN('height-center','ارتفاع مركز المخرج عن الأرضية النهائية','ما منسوب مركز النقطة عن صفر التشطيب؟',o&&mm(o.bottom+o.height/2),['ارتفاع مركز المخرج']);}
 if(k==='water')c.ask({...base,id:'water-service',type:'choice',property:'نوع التغذية',label:'ما وظيفة هذه التغذية؟',options:opts({hot:'مياه حارة',cold:'مياه باردة',mix:'مختلط'})});
 if(k==='drain')askN('diameter','قطر المخرج','كم قطر مخرج الصرف؟',undefined,['قطر المخرج الظاهر'],1000,1);
 if(k==='door')c.ask({...base,id:'door-swing',type:'choice',property:'اتجاه فتح الباب في الموقع',label:'كيف يفتح الباب عند التجربة؟',options:opts({in:'للداخل',out:'للخارج',sliding:'سحّاب'}),defaultValue:o?.swing,defaultSource:o?.swing?designSource:''});
}
export function buildSite(ctx,id,options={}){if(id==='services')serviceSurvey(ctx,options);else siteSurvey(ctx);}
