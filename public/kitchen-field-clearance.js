import {ownKey} from './kitchen-safe-keys.js';
// Kitchen-Inputs.xlsx v2 · «اختبر أثر التعلية». These demo numbers are
// hypothetical, never site readings. A selected record is linked by stable ID.
import {readFieldRegister} from './kitchen-field-model.js';
const slots=[
 {key:'ledge',ref:'D2-LEDGE',code:'SITE-19',name:'منسوب أعلى التعلية',demo:100},
 {key:'floor',ref:'D2-FLOOR',code:'SITE-19',name:'منسوب أرضية فراغ الجهاز',demo:0},
 {key:'top',ref:'D2-TOP',code:'CAT-17',name:'منسوب أسفل الرخام',demo:880},
 {key:'min',ref:'D2-MIN',code:'EQP-02',name:'الحد الأدنى لارتفاع فتحة الموديل',demo:820}
];
const unitFactor={'مم':1,'ملم':1,'مليمتر':1,'ملليمتر':1,'ملي متر':1,'mm':1,'سم':10,'سنتيمتر':10,'cm':10,'م':1000,'متر':1000,'m':1000};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:3}).format(n);
const toArabicNumber=s=>String(s??'').trim().replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<'۰'?0x660:0x6f0))).replace(/٫/g,'.').replace(/٬/g,'');
export function fieldMM(row){
 if(!row||['unknown','na','conflict'].includes(row.verification)||row.execution==='excluded'||row.valueType!=='number'||typeof row.value!=='number'||!Number.isFinite(row.value))return null;
 const u=String(row.unit||'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f]/g,'').replace(/\.$/,'').trim();return ownKey(unitFactor,u)?row.value*unitFactor[u]:null;
}
const normalizeName=s=>String(s||'').normalize('NFKC').replace(/[\u064b-\u065f\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي');
export function isClearanceCandidate(slot,r){
 const codes={ledge:['SITE-19'],floor:['SITE-19','SITE-07'],top:['CAT-17','SITE-18'],min:['EQP-02']};
 const c=slot.key;if(!codes[c]?.includes(r.inputCode)||r.execution==='excluded')return false;
 if(r.valueType!=='number'&&!['unknown','na','conflict'].includes(r.verification))return false;
 if(r.value!=null&&r.valueType==='number'&&!ownKey(unitFactor,String(r.unit||'').toLowerCase().trim()))return false;
 if(normalizeName(r.readingRef).toUpperCase()===slot.ref)return true;
 const p=normalizeName(r.property);
 if(c==='ledge')return /(منسوب|ارتفاع)/.test(p)&&/تعلي|قاعد|ارتكاز/.test(p);
 if(c==='floor')return /(منسوب|ارتفاع)/.test(p)&&/ارضي|فراغ/.test(p);
 if(c==='top')return /(منسوب|ارتفاع)/.test(p)&&/(اسفل|باطن|تحت)/.test(p)&&/رخام|سطح/.test(p);
 return /ارتفاع/.test(p)&&/ادني|اقل|فتحه|فتحة|خلوص/.test(p);
}
export function evaluateLedgeClearance(values){
 const fin=Number.isFinite,round=v=>Math.round(v*1e7)/1e7;
 return ['ledge','floor'].map(k=>{const missing=[k,'top','min'].filter(t=>!fin(values[t])||(t==='min'&&values.min<=0));
 if(missing.length)return {key:k,missing,outcome:'waiting'};
 const available=round(values.top-values[k]),delta=round(available-values.min);
 return {key:k,available,delta,outcome:delta<0?'short':'fits',missing:[]};});
}
const mem=new Map(),projectKey=rows=>rows.map(r=>r.id).sort().join('|');
export function mountClearanceCheck(host,{getDoc,onBack}){
 let mode='project',demo=Object.fromEntries(slots.map(s=>[s.key,String(s.demo)])),rows=[],selected={},activeKey='';
 const currentRows=()=>readFieldRegister(getDoc().room).records;
 function loadRows(){rows=currentRows();const k=projectKey(rows);if(k!==activeKey||!Object.keys(selected).length){const prior=mem.get(k)||{};selected={};for(const s of slots){const matches=rows.filter(r=>r.readingRef?.toUpperCase()===s.ref&&isClearanceCandidate(s,r));selected[s.key]=rows.some(r=>r.id===prior[s.key])?prior[s.key]:matches.length===1?matches[0].id:'';}activeKey=k;}}
 const rowFor=k=>rows.find(r=>r.id===selected[k]);
 const idOf=r=>[r.readingRef,r.revision,r.itemId,r.property].filter(Boolean).join(' · ');
 function drawInputs(){
  return '<div class="fr-clear-inputs">'+slots.map(s=>{
   if(mode==='example')return '<label><span>'+s.name+' (مم)</span><input type="text" inputmode="decimal" dir="ltr" data-ck-number="'+s.key+'" value="'+esc(demo[s.key])+'"></label>';
   const opts=rows.filter(r=>isClearanceCandidate(s,r));
   return '<label><span>'+s.name+'</span><select title="'+s.code+' · '+s.ref+'" data-ck-row="'+s.key+'"><option value="">اختر قراءة…</option>'+opts.map(r=>'<option value="'+esc(r.id)+'" '+(r.id===selected[s.key]?'selected':'')+'>'+esc(idOf(r)+(r.value!=null?' · '+r.value+' '+(r.unit||''):''))+'</option>').join('')+'</select>'+(!opts.length?'<small><bdi>'+s.code+' · '+s.ref+'</bdi></small>':'')+'</label>';
  }).join('')+'</div>';
 }
 function results(){const vals={};for(const s of slots){if(mode==='project')vals[s.key]=fieldMM(rowFor(s.key));else{const v=toArabicNumber(demo[s.key]);vals[s.key]=/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v)&&Number.isFinite(Number(v))?Number(v):null;}}
 const names={ledge:'كل الأرجل فوق التعلية',floor:'كل الأرجل في الفراغ'},labels=Object.fromEntries(slots.map(s=>[s.key,s.name]));
 const res=evaluateLedgeClearance(vals);const msg=e=>{if(e.missing.length)return '<p>بانتظار '+e.missing.map(k=>labels[k]).join('، ')+'.</p>';const provisional=mode==='project'&&[e.key,'top','min'].some(k=>!['measured','documented','confirmed'].includes(rowFor(k)?.verification));
 return '<strong>'+ (e.outcome==='short'?'ينقص '+fmt(-e.delta)+' مم':e.delta===0?'يطابق الحد الأدنى تمامًا':'فائض '+fmt(e.delta)+' مم')+'</strong><p>الارتفاع المتاح: '+fmt(e.available)+' مم'+(provisional?' · نتيجة مبدئية':'')+'</p>';};
 host.querySelector('[data-ck-results]').innerHTML=res.map(e=>'<article data-outcome="'+e.outcome+'"><h4>'+names[e.key]+'</h4>'+msg(e)+'</article>').join('');
 }
 function draw(){loadRows();host.innerHTML='<div class="fr-clearance"><button type="button" class="fr-back" data-ck-back>→ رجوع</button><small>فحص من سجل الفني</small><h2>فحص ارتفاع غسالة الصحون</h2><div class="fr-clear-mode">'+[['project','قراءات المشروع'],['example','مثال الملف']].map(([k,l])=>'<button type="button" data-ck-mode="'+k+'" aria-pressed="'+(mode===k)+'">'+l+'</button>').join('')+'</div><p>'+(mode==='example'?'قيم توضيحية بالمليمتر؛ غيّرها لترى الأثر. لا تُحفظ في المشروع.':'اختر قراءات من مرجع رأسي واحد. القيمة المجهولة أو المتعارضة لا تدخل الحساب.')+'</p>'+drawInputs()+'<div class="fr-clear-results" aria-live="polite" data-ck-results></div><details><summary>كيف يُحسب؟</summary><p>الارتفاع المتاح = منسوب أسفل الرخام − منسوب ارتكاز الأرجل. نقارن الناتج بالحد الأدنى لفتحة الموديل.</p><p>إذا توزعت الأرجل بين منسوبين، افحص الارتكاز والتسوية على حدة. يبقى العرض والعمق والتهوية ومسار الفتح مستقلًا عن هذا الفحص.</p></details></div>';results();}
 function click(e){const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-ck-back'))onBack?.();if(b.dataset.ckMode){mode=b.dataset.ckMode;draw();}}
 function change(e){const k=e.target.dataset.ckRow;if(k){selected[k]=e.target.value;if(mem.size>48)mem.delete(mem.keys().next().value);mem.set(activeKey,{...selected});results();}}
 function input(e){const k=e.target.dataset.ckNumber;if(k){demo[k]=e.target.value;results();}}
 host.addEventListener('click',click);host.addEventListener('change',change);host.addEventListener('input',input);draw();
 return {refresh:draw,destroy(){host.removeEventListener('click',click);host.removeEventListener('change',change);host.removeEventListener('input',input);}};
}
