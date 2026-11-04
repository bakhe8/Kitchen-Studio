import assert from 'node:assert/strict';
import {cleanWarrantyTerms,cleanServiceTicket,serviceWarranty,warrantyStatus,serviceTickets,serviceActionFor,reviewMaintenanceCommand} from '../public/kitchen-maintenance-domain.js';
const unit={id:'unit-a',checks:[{key:'width',nominal:600,unit:'مم'},{key:'height',nominal:800,unit:'مم'}]},clone=structuredClone;
const terms={reference:'TEST-WARRANTY-1',provider:'TEST provider',startsOn:'2026-01-01',endsOn:'2026-12-31',coverage:'TEST documented workmanship coverage',exclusions:''};
assert.deepEqual(cleanWarrantyTerms(terms),terms);assert.deepEqual(cleanWarrantyTerms(Object.fromEntries(Object.entries(terms).filter(([k])=>k!=='exclusions'))),terms);
for(const bad of [{...terms,startsOn:'2026-02-30'},{...terms,endsOn:'2025-12-31'},{...terms,provider:''},{...terms,automatic:true},{...terms,coverage:'x'.repeat(501)}])assert.equal(cleanWarrantyTerms(bad),null);
assert(cleanWarrantyTerms({...terms,startsOn:'2024-02-29'}));assert.equal(warrantyStatus(null,'2026-06-01'),'unknown');assert.equal(warrantyStatus(terms,'invalid'),'unknown');
assert.equal(warrantyStatus(terms,'2026-01-01T00:00:00Z'),'within');assert.equal(warrantyStatus(terms,'2026-12-31T23:59:59Z'),'within');assert.equal(warrantyStatus(terms,'2025-12-31'),'upcoming');assert.equal(warrantyStatus(terms,'2027-01-01'),'expired');assert.equal(warrantyStatus(terms,'2026-12-31T23:30:00-03:00'),'expired');
const ticket={title:'TEST hinge issue',description:'TEST door needs inspection',priority:'normal',anchor:{kind:'front',x:.3,y:.7}};
assert.deepEqual(cleanServiceTicket(unit,ticket),ticket);assert.equal(cleanServiceTicket(unit,{...ticket,id:'client-id'}),null);assert.equal(cleanServiceTicket(unit,{...ticket,anchor:{kind:'check',key:'other-unit-check'}}),null);
console.log('PASS explicit warranty dates/terms and exact released-unit ticket anchors');

let events=[{unit:unit.id,seq:1,action:'accept',state:'accepted',date:'2026-05-01T12:00:00Z',data:{customer:'PRIVATE original customer',note:'PRIVATE handover'}}];
const original=clone(events[0]);
function command(action,values={},now='2026-06-01T12:00:00Z',requestId='test-request-00001'){
 const body={action,unit:unit.id,expected:events.at(-1).seq,...values};return reviewMaintenanceCommand(unit,events,body,{requestId,now});
}
function append(action,values={},now='2026-06-01T12:00:00Z',requestId='test-request-00001'){
 const payload=command(action,values,now,requestId);const event={unit:unit.id,seq:events.at(-1).seq+1,action,state:'accepted',date:now,data:payload};events.push(event);return event;
}
append('service-open',{ticket});let first=serviceTickets(events)[0];assert.equal(first.status,'open');assert.equal(first.handoverSeq,1);assert.equal(first.openedAt,first.cycleOpenedAt);assert.equal(serviceWarranty(events),null);
assert.equal(serviceActionFor(first,'owner'),'service-review');assert.equal(serviceActionFor(first,'factory'),null);
assert.throws(()=>command('service-review',{ticketId:first.id,diagnosis:'TEST inspection',coverage:'covered',reference:'TEST decision'}),/ضمان|شروط|فترة/);
append('warranty-record',{terms});const warranty=serviceWarranty(events);assert.deepEqual(warranty,{...terms,seq:3,date:'2026-06-01T12:00:00Z'});
append('service-review',{ticketId:first.id,diagnosis:'TEST inspection',coverage:'covered',reference:'TEST decision'});
first=serviceTickets(events)[0];assert.equal(first.status,'reviewed');assert.deepEqual(first.review.warranty,warranty);assert.equal(serviceActionFor(first,'factory'),'service-repair');
append('warranty-record',{terms:{...terms,coverage:'TEST different later terms'}});
assert.deepEqual(serviceTickets(events)[0].review.warranty,warranty,'later terms do not rewrite the prior coverage decision');
append('service-repair',{ticketId:first.id,work:'TEST hinge adjusted',verification:'TEST cycled door'});first=serviceTickets(events)[0];assert.equal(first.status,'repaired');assert.equal(serviceActionFor(first,'owner'),'service-close');assert.equal(serviceActionFor(first,'factory'),null);
append('service-close',{ticketId:first.id,customer:'PRIVATE service customer',note:'PRIVATE service acceptance'});assert.equal(serviceTickets(events)[0].status,'closed');
append('service-reopen',{ticketId:first.id,reason:'TEST recurrence'},'2027-02-01T00:00:00Z');first=serviceTickets(events)[0];assert.equal(first.status,'open');assert.equal(first.openedAt,'2026-06-01T12:00:00Z');assert.equal(first.cycleOpenedAt,'2027-02-01T00:00:00Z');assert.equal(first.review,undefined);assert.equal(first.repair,undefined);assert.equal(first.closure,undefined);assert(first.history.some(e=>e.action==='service-close'));
assert.throws(()=>command('service-review',{ticketId:first.id,diagnosis:'TEST second inspection',coverage:'covered',reference:'TEST second decision'}),/فترة|ضمان/);
append('service-review',{ticketId:first.id,diagnosis:'TEST second inspection',coverage:'goodwill',reference:'TEST goodwill'});assert.equal(serviceTickets(events)[0].review.coverage,'goodwill');
assert.deepEqual(events[0],original);assert(events.every(e=>e.state==='accepted'));
const copy=serviceTickets(events);copy[0].history[0].data.ticket.title='changed';copy[0].review.warranty.coverage='changed';assert.equal(serviceTickets(events)[0].title,ticket.title);assert.equal(serviceWarranty(events).coverage,'TEST different later terms');
console.log('PASS immutable accepted handover, independent ticket cycle, coverage evidence snapshot and reopened-cycle UTC eligibility');

append('service-open',{ticket:{...ticket,title:'TEST second independent issue'}},'2027-02-01T00:00:00Z','test-request-00002');assert.equal(serviceTickets(events).length,2);
assert.throws(()=>command('service-repair',{ticketId:'test-request-00002',work:'too early',verification:'none'}),/مرحلة|تشخيص/);
assert.throws(()=>command('service-close',{ticketId:first.id,customer:'A',note:'too early'}),/مرحلة|إصلاح/);
assert.throws(()=>command('service-review',{ticketId:'another-unit-ticket',diagnosis:'x',coverage:'outside',reference:'x'}),/بلاغ|وحدة/);
assert.throws(()=>command('service-open',{ticket,handoverSeq:88}),/حقول|بيانات/);
const foreign={unit:'unit-b',seq:99,action:'service-close',state:'accepted',date:'2027-03-01T00:00:00Z',data:{ticketId:first.id,customer:'B',note:'wrong unit',status:'closed'}};assert.equal(serviceTickets([...events,foreign])[0].status,'reviewed');
assert.throws(()=>reviewMaintenanceCommand(unit,[],{action:'service-open',unit:unit.id,expected:0,ticket},{requestId:'test-request-00003',now:'2026-06-01T00:00:00Z'}),/استلام/);
assert.equal(serviceActionFor(serviceTickets(events)[0],'rep'),null);
console.log('PASS ticket/role isolation, strict commands, transition guards and accepted-only reporting');
