import {deliveryDrawing} from './kitchen-delivery-drawing.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=value=>new Intl.NumberFormat('ar-SA').format(value);
const statuses={open:'بلاغ مفتوح',reviewed:'شُخّص البلاغ',repaired:'أُصلح · ينتظر اعتماد العميل',closed:'مغلق بمحضر العميل'};

// This is a presentation adapter, not a second receipt or service state model.
// Delivery's geometry and check anchors are reused unchanged. A service ticket
// never becomes a delivery blocker, even when its priority is urgent.
export function maintenanceDrawing(unit,{tickets=[],selectedTicketId='',selectedCheck='',draftAnchor=null}={}){
 const rows=Array.isArray(tickets)?tickets.filter(ticket=>ticket&&typeof ticket.id==='string'&&(!ticket.unit||!unit?.id||ticket.unit===unit.id)):[];
 const observations=rows.map(ticket=>({
  id:ticket.id,
  text:['بلاغ صيانة',ticket.title,ticket.description].filter(value=>typeof value==='string'&&value.trim()).join(' · '),
  severity:'info',
  anchor:ticket.anchor,
  resolved:ticket.status==='closed'
 }));
 const selected=rows.find(ticket=>ticket.id===selectedTicketId),closed=rows.filter(ticket=>ticket.status==='closed').length;
 const drawing=deliveryDrawing(unit,{observations,selectedId:selectedTicketId,selectedCheck,draftAnchor});
 const legend='<div class="ms-case-legend" aria-label="دليل بلاغات الصيانة"><p>نقاط البلاغات تخص هذه الوحدة من إيصال الإصدار؛ لا تغيّر أبعادها أو محضر استلامها.</p>'+
  (rows.length?'<span class="ms-legend-open"><i aria-hidden="true"></i>'+count(rows.length-closed)+' بلاغات قيد المتابعة</span><span class="ms-legend-closed"><i aria-hidden="true"></i>'+count(closed)+' مغلقة</span>':'<span>لا توجد بلاغات مسجّلة لهذه الوحدة.</span>')+
  (selected?'<p class="ms-selected-ticket" data-status="'+esc(Object.hasOwn(statuses,selected.status)?selected.status:'unknown')+'"><strong>'+esc(selected.title||'البلاغ المحدد')+'</strong><span>'+esc(statuses[selected.status]||'حالة غير معروفة')+(selected.priority==='urgent'?' · أولوية عاجلة':'')+'</span></p>':'')+'</div>';
 return '<section class="ms-drawing" aria-label="مخطط مواضع بلاغات الصيانة">'+drawing+legend+'</section>';
}
