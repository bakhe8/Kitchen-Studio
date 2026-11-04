// Owner lifecycle fixture: real project/job handlers, separate local document,
// independently owned team projects, isolated memory and its own browser cookie.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMaintenanceReviewFixture} from './serve-maintenance-review.mjs';
import {makeProductionReadyFixture} from '../tools/fixture-kitchen-production-ready.mjs';

const actors=['owner','factory','viewer','outside'];
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const archive=design=>({type:'kitchen-studio',version:2,design,fieldFiles:[],photos:{}});
const must=async(response,status=201)=>{const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;};

export async function createOversightReviewFixture({origin='http://127.0.0.1:8768'}={}){
 const base=await createMaintenanceReviewFixture({origin});
 try{
  const localDoc=await makeProductionReadyFixture({structureApproved:false,customerApproved:false,projectId:'K-4F56524C4F43414C'});
  localDoc.room.name='مشروع محلي مستقل — لم يرفع إلى الفريق';
  delete localDoc.room.workshop.upstand; // A real unanswered guide choice for preview/save/history review.
  const remoteDraft=await makeProductionReadyFixture({structureApproved:false,customerApproved:false,projectId:'K-4F565252454D4F54'});
  remoteDraft.room.name='مشروع فريق ب — ينتظر اعتماد الهيكل والعميل';
  const draftProjectId=randomUUID();
  await must(await base.call('owner','/api/projects',{id:draftProjectId,expected:0,request:randomUUID(),name:remoteDraft.room.name},archive(remoteDraft)));
  const {projectId,receipt,activeWarrantyUnitId:unitId}=base.seed,ticketId=randomUUID();
  const current=base.snapshot().events.filter(event=>event.unit===unitId).at(-1);
  await must(await base.call('owner','/api/jobs',{id:projectId,receipt,request:ticketId},{action:'service-open',unit:unitId,expected:current.seq,ticket:{title:'بلاغ خدمة لاختبار الإشراف',description:'Synthetic owner lifecycle follow-up; no actual customer complaint.',priority:'normal',anchor:{kind:'front',x:.3,y:.4}}}));
  const seed={...base.seed,browserUrl:origin+'/index.html?panel=workshop&step=oversight',draftProjectId,draftProjectRevision:1,localProjectId:localDoc.room.projectId,serviceUnitId:unitId,serviceTicketId:ticketId,localArchiveUrl:origin+'/__fixture/local-project'};
  const snapshot=()=>({...base.snapshot(),seed,projects:base.db.prepare('SELECT p.id,p.owner,v.name,v.revision FROM studio_projects p JOIN studio_versions v ON v.project_id=p.id AND v.revision=(SELECT MAX(revision) FROM studio_versions WHERE project_id=p.id) ORDER BY p.id').all(),projectVersions:base.db.prepare('SELECT project_id,revision,digest FROM studio_versions ORDER BY project_id,revision').all()});
  const handle=async request=>{
   const url=new URL(request.url);
   if(url.pathname==='/__fixture/status')return json(snapshot());
   if(url.pathname==='/__fixture/local-project')return new Response(JSON.stringify(archive(localDoc),null,2),{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="oversight-local-project.json"','Cache-Control':'no-store'}});
   if(url.pathname==='/__fixture/actor'){
    const name=url.searchParams.get('name');if(!actors.includes(name))return json({error:'Unknown oversight fixture identity.'},400);
    return new Response(null,{status:303,headers:{Location:seed.browserUrl,'Set-Cookie':'oversight_review_actor='+name+'; Path=/; SameSite=Strict; HttpOnly','Cache-Control':'no-store'}});
   }
   if(url.pathname==='/__fixture')return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><title>Isolated oversight review</title><body><h1>Synthetic owner lifecycle fixture</h1><p>Two independent team projects plus a separate local archive. Real API handlers and in-memory records; no cloud service.</p><p>'+actors.map(name=>'<a href="/__fixture/actor?name='+name+'">'+name+'</a>').join(' · ')+'</p><p><a href="'+seed.browserUrl+'">Open actual owner overview</a> · <a href="/__fixture/status">Inspect saved fixture records</a> · <a href="/__fixture/local-project">Download separate local project</a></p><pre>'+JSON.stringify(seed,null,2)+'</pre></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
   const actor=request.headers.get('Cookie')?.match(/(?:^|;\s*)oversight_review_actor=([a-z]+)/)?.[1]||'owner';
   const headers=new Headers(request.headers);headers.set('Cookie','maintenance_review_actor='+(actors.includes(actor)?actor:'outside'));
   return base.handle(new Request(request,{headers}));
  };
  return {...base,seed,localDoc,remoteDraft,handle,snapshot};
 }catch(error){base.close();throw error;}
}

export async function serveOversightReview({port=8768}={}){
 const origin='http://127.0.0.1:'+port,fixture=await createOversightReviewFixture({origin});
 const server=createServer(async(req,res)=>{
  try{
   if(!['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket.remoteAddress)){res.writeHead(403);res.end();return;}
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const request=new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
   const response=await fixture.handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
  }catch(error){console.error(error);res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Isolated oversight fixture failure.'}));}
 });
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});}catch(error){fixture.close();throw error;}
 return {fixture,server,async close(){await new Promise(resolve=>server.close(resolve));fixture.close();}};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.includes('--check')){const fixture=await createOversightReviewFixture();console.log(JSON.stringify(fixture.snapshot(),null,2));fixture.close();}
 else{const arg=process.argv.find(a=>a.startsWith('--port=')),running=await serveOversightReview({port:arg?Number(arg.slice(7)):8768});console.log('ISOLATED OVERSIGHT REVIEW '+JSON.stringify(running.fixture.seed));console.log('Fixture controls: '+running.fixture.seed.origin+'/__fixture');for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void running.close().then(()=>process.exit(0)));}
}
