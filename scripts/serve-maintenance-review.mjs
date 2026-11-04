// Isolated after-sales review. The delivery fixture supplies actual bundled API
// handlers and in-memory data; this wrapper adds real acceptance/warranty events.
// Its cookie is deliberately different: cookies are shared across local ports.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDeliveryReviewFixture} from './serve-delivery-review.mjs';

const actors=['owner','factory','viewer','outside'];
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const must=async(response,status=201)=>{const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;};
const shiftDay=(day,days)=>{const value=new Date(day+'T12:00:00.000Z');value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);};

export async function createMaintenanceReviewFixture({origin='http://127.0.0.1:8767'}={}){
 const base=await createDeliveryReviewFixture({origin});
 try{
  const {projectId,receipt}=base.seed;
  const job=await must(await base.call('owner','/api/jobs',{id:projectId,receipt}),200);
  assert(job.serverNow&&Number.isFinite(Date.parse(job.serverNow)),'real jobs API supplies the authoritative review date');
  assert(job.units.length>=4,'maintenance fixture requires three accepted units and an unaccepted neighbour');
  const event=(actor,unit,action,data)=>{
   const history=base.snapshot().events.filter(e=>e.unit===unit.id),expected=history.at(-1)?.seq||0;
   return base.call(actor,'/api/jobs',{id:projectId,receipt,request:randomUUID()},{action,unit:unit.id,expected,...data});
  };
  const accepted=job.units.slice(0,3);
  for(const unit of accepted){
   let state=base.snapshot().events.filter(e=>e.unit===unit.id).at(-1)?.state||'issued';
   if(state==='issued'){await must(await event('owner',unit,'plan',{reference:'SYNTHETIC-SERVICE-TOLERANCES',tolerances:Object.fromEntries(unit.checks.map(check=>[check.key,check.unit==='قطعة'?0:Math.min(1,check.maxTolerance??1,check.nominal)]))}));state='planned';}
   if(state==='planned'){await must(await event('factory',unit,'qc',{actual:Object.fromEntries(unit.checks.map(check=>[check.key,check.nominal])),note:'Synthetic accepted-unit quality check.'}));state='passed';}
   if(state==='passed'){await must(await event('factory',unit,'pack',{note:'Synthetic accepted-unit packing.'}));state='packed';}
   if(state==='packed'){await must(await event('factory',unit,'install',{location:'Synthetic wall A',note:'Synthetic installation for after-sales review.'}));state='installed';}
   if(state==='installed')await must(await event('owner',unit,'accept',{customer:'Synthetic maintenance customer',note:'Synthetic customer acceptance; no real customer transaction.'}));
  }
  const today=job.serverNow.slice(0,10),terms={reference:'SYNTHETIC-WARRANTY-A',provider:'Synthetic service provider',startsOn:shiftDay(today,-30),endsOn:shiftDay(today,365),coverage:'Synthetic workmanship coverage requiring an explicit owner review for each ticket.',exclusions:'Synthetic misuse exclusion; this is test data.'};
  await must(await event('owner',accepted[0],'warranty-record',{terms}));
  await must(await event('owner',accepted[2],'warranty-record',{terms:{...terms,reference:'SYNTHETIC-WARRANTY-EXPIRED',startsOn:shiftDay(today,-400),endsOn:shiftDay(today,-1)}}));
  const {packedUnitId:previousPacked,qcUnitId:previousQc,...baseSeed}=base.seed;
  const seed={...baseSeed,testOnly:true,browserUrl:origin+'/index.html?panel=workshop&step=maintenance',serverNow:job.serverNow,acceptedUnitIds:accepted.map(unit=>unit.id),activeWarrantyUnitId:accepted[0].id,noWarrantyUnitId:accepted[1].id,expiredWarrantyUnitId:accepted[2].id,unacceptedUnitId:job.units[3].id};
  const snapshot=()=>({...base.snapshot(),seed});
  const handle=async request=>{
   const url=new URL(request.url);
   if(url.pathname==='/__fixture/status')return json(snapshot());
   if(url.pathname==='/__fixture/actor'){
    const name=url.searchParams.get('name');if(!actors.includes(name))return json({error:'Unknown maintenance fixture identity.'},400);
    return new Response(null,{status:303,headers:{Location:seed.browserUrl,'Set-Cookie':'maintenance_review_actor='+name+'; Path=/; SameSite=Strict; HttpOnly','Cache-Control':'no-store'}});
   }
   if(url.pathname==='/__fixture')return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><title>Isolated maintenance review</title><body><h1>Synthetic local maintenance fixture</h1><p>Real API handlers and actual upload/release/acceptance events in isolated memory. No cloud service is used.</p><p>'+actors.map(name=>'<a href="/__fixture/actor?name='+name+'">'+name+'</a>').join(' · ')+'</p><p><a href="'+seed.browserUrl+'">Open actual maintenance UI</a> · <a href="/__fixture/status">Inspect saved fixture events</a></p><pre>'+JSON.stringify(seed,null,2)+'</pre></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
   // Ignore any delivery_review_actor cookie received from the 8766 origin.
   const actor=request.headers.get('Cookie')?.match(/(?:^|;\s*)maintenance_review_actor=([a-z]+)/)?.[1]||'owner';
   const headers=new Headers(request.headers);headers.set('Cookie','delivery_review_actor='+(actors.includes(actor)?actor:'outside'));
   return base.handle(new Request(request,{headers}));
  };
  return {...base,seed,snapshot,handle};
 }catch(error){base.close();throw error;}
}

export async function serveMaintenanceReview({port=8767}={}){
 const origin='http://127.0.0.1:'+port,fixture=await createMaintenanceReviewFixture({origin});
 const server=createServer(async(req,res)=>{
  try{
   if(!['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket.remoteAddress)){res.writeHead(403);res.end();return;}
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const request=new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
   const response=await fixture.handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
  }catch(error){console.error(error);res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Isolated maintenance fixture failure.'}));}
 });
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});}catch(error){fixture.close();throw error;}
 return {fixture,server,async close(){await new Promise(resolve=>server.close(resolve));fixture.close();}};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.includes('--check')){const fixture=await createMaintenanceReviewFixture();console.log(JSON.stringify(fixture.snapshot(),null,2));fixture.close();}
 else{const arg=process.argv.find(a=>a.startsWith('--port=')),running=await serveMaintenanceReview({port:arg?Number(arg.slice(7)):8767});console.log('ISOLATED MAINTENANCE REVIEW '+JSON.stringify(running.fixture.seed));console.log('Fixture controls: '+running.fixture.seed.origin+'/__fixture');for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void running.close().then(()=>process.exit(0)));}
}
