import assert from 'node:assert/strict';
import {supplierFrames,prepareSupplierPlacement} from '../public/kitchen-supplier.js';
import {createKitchen,addRun,addFeature,kitchenGeometry,validateKitchen} from '../public/kitchen-model.js';
const room={width:360,length:300,height:260},empty=createKitchen(room,'empty');
for(const ref of supplierFrames){
  const origin=JSON.stringify(empty),r=prepareSupplierPlacement(empty,room,ref.article,{mode:'new',wall:'back',u:76.25,bottom:ref.tier==='upper'?142.5:0});
  assert.ok(r.ok,r.reason);assert.equal(JSON.stringify(empty),origin);assert.equal(r.kitchen.runs.length,1);assert.equal(r.kitchen.units.length,1);assert(validateKitchen(r.kitchen,room));
  const u=kitchenGeometry(r.kitchen,room).units[0];assert.equal(u.id,r.id);assert.deepEqual([u.width,u.depth,u.height],[ref.width,ref.depth,ref.height]);assert.equal(u.u,76.25);assert.equal(u.tier,ref.tier);assert.deepEqual(u.interior,{shelves:0,dividers:0});assert.ok(ref.url.startsWith('https://www.ikea.com/sa/ar/p/'));
}
const f=supplierFrames.find(v=>v.article==='702.055.31');
let row=addRun(empty,room,{tier:'upper',wall:'back',start:0,end:200,depth:36.6,height:80,bottom:141});
assert(row.ok);const first=prepareSupplierPlacement(row.kitchen,room,f.article,{mode:'existing',runId:row.id,u:10}),next=prepareSupplierPlacement(first.kitchen,room,f.article,{mode:'existing',runId:row.id,u:61});
assert.ok(first.ok&&next.ok);assert.equal(next.kitchen.runs.length,1);assert.notEqual(next.id,first.id);assert.equal(next.kitchen.units.length,2);
const clash=prepareSupplierPlacement(next.kitchen,room,f.article,{mode:'existing',runId:row.id,u:10});assert.equal(clash.ok,false);assert.equal(clash.kitchen,next.kitchen);
row=addRun(empty,room,{tier:'upper',wall:'right',start:30,end:240,depth:37,height:80,bottom:140});
assert.equal(prepareSupplierPlacement(row.kitchen,room,f.article,{mode:'existing',runId:row.id,u:45}).ok,false,'the nominal 37-cm system is not a 36.6-cm bare frame');
const withWindow=addFeature(empty,room,{kind:'window',wall:'back',u:64,width:88,bottom:134,height:86}).kitchen;
const blocked=prepareSupplierPlacement(withWindow,room,f.article,{mode:'new',wall:'back',u:82,bottom:145});
assert(!blocked.ok);assert.equal(blocked.kitchen,withWindow,'no orphan run when its frame is blocked by an opening');assert.equal(blocked.kitchen.runs.length,0);
console.log('METOD references: four exact bare-frame envelopes, incompatible nominal depth and occupied starts refused; fitting existing rows are reused and failed new run+unit is atomic.');
