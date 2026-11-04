import {kitchenUnitSpecs} from './kitchen-catalog.js';

const fmt=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
const txt=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lock='<svg aria-hidden="true" viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.4" y="7" width="9.2" height="6.8" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';
/** Select cabinets by their physical order, including a unit hidden by a
 * surface or another tier. u increases to the right when facing the wall. */
export function kitchenRowStrip(k,runId,selectedId=''){
 const r=k?.runs?.find(x=>x.id===runId);if(!r?.autoFill||!Number.isFinite(r.end-r.start)||r.end<=r.start)return '';
 const pieces=[...k.units.filter(x=>x.runId===runId).map(x=>({u:x.u,width:x.width,unit:x})),...(r.fillGaps||[]).map(x=>({...x,reserved:true}))].sort((a,b)=>a.u-b.u);
 const cells=[],cm=n=>fmt.format(n)+' سم',labelPos=v=>cm(v-r.start)+' من بداية الصف';
 const gap=(pos,width,reserved=false)=>{
   if(width<.01)return;
   const name=reserved?'فراغ محجوز':'غير معبّأ',label=name+' · '+cm(width)+' · '+labelPos(pos);
   cells.push('<span class="krs-gap" role="img" aria-label="'+txt(label)+'" title="'+txt(label)+'" style="--krs-w:'+width+'"><span aria-hidden="true">⋯</span><bdi>'+fmt.format(width)+'</bdi></span>');
 };
 let at=r.start;
 for(const s of pieces){
  if(![s.u,s.width].every(Number.isFinite)||s.width<=0)continue;gap(at,s.u-at);
  if(s.unit){const x=s.unit,auto=x.fillRole==='auto',name=kitchenUnitSpecs[x.kind]?.label||'وحدة',state=auto?'تلقائية':'مثبّتة',hint=name+' · '+cm(x.width)+' · '+labelPos(x.u)+' · '+state;
   cells.push('<button type="button" class="krs-cell" data-k-row-unit="'+txt(x.id)+'" data-krs-mode="'+(auto?'auto':'pinned')+'" aria-pressed="'+(x.id===selectedId)+'" aria-label="'+txt(hint)+'" title="'+txt(hint)+'" style="--krs-w:'+x.width+'"><small aria-hidden="true">'+(auto?'':lock)+txt(name.replace('خزانة تخزين','تخزين').replace('وحدة ',''))+'</small><bdi>'+fmt.format(x.width)+'</bdi></button>');
  }else gap(s.u,s.width,true);at=Math.max(at,s.u+s.width);
 }
 gap(at,r.end-at);
 return '<section class="krs" aria-label="وحدات الصف بحسب موضعها"><header><b>وحدات الصف</b><small>العرض بالسنتيمتر</small></header><div class="krs-track" dir="ltr" role="group" aria-label="اختر وحدة لتخصيصها">'+cells.join('')+'</div><footer><span>البداية</span><span>النهاية</span></footer></section>';
}
