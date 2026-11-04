import assert from 'node:assert/strict';
import {createScopedProjectClient,scopedStorageKey,checkedScopedProjectView} from '../public/kitchen-scoped-client.js';
import {projectView} from '../public/kitchen-project-scope.js';
import {executeProjectOperation} from '../public/kitchen-scoped-operations.js';
import {operationFixture} from './check-kitchen-project-operations.mjs';
const id='11111111-2222-3333-4444-555555555555',fixture=operationFixture(),storage=new Map(),store={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
let archive=fixture.archive,revision=1,role='factory',subject='factory-member',mode='',posts=0;
const get=()=>projectView(role,archive,{id,revision,subject});
const fetcher=async(url,options={})=>{const q=new URL(url,'https://test.invalid').searchParams,action=q.get('action');
 if(action==='session')return Response.json({subject});
 if(action==='access')return Response.json({id,revision,role,subject,scopeVersion:2});
 if(options.method==='POST'){
  posts++;const body=JSON.parse(options.body),out=executeProjectOperation(role,archive,body,{id,subject,expectedRevision:revision});
  if(mode==='reject')return Response.json({error:'Rejected operation'},{status:422});
  if(mode==='revoke'){role='store';return Response.json({error:'Role revoked'},{status:403});}
  if(!out.ok)return Response.json({error:out.reason},{status:422});
  if(action==='operation-apply'){assert.equal(body.review,out.review);archive=out.archive;revision++;return Response.json({id,revision});}
  return Response.json({type:'kitchen-operation-preview',version:1,project:{id,revision},access:{role,subject:mode==='foreign'?'foreign':subject,scopeVersion:2},operation:{kind:body.operation.kind},result:out.result,review:out.review});
 }
 return Response.json(get());
};
const old={...get(),access:{...get().access,scopeVersion:1}},oldKey=scopedStorageKey(old);storage.set(oldKey,JSON.stringify({type:'kitchen-project-draft',version:1,view:old}));
assert.throws(()=>checkedScopedProjectView(old));
const client=createScopedProjectClient({fetcher,storage:store});await client.load(id);assert.equal(client.draftFor(get()),null);assert(storage.has(oldKey),'Old scoped draft is retained for recovery but not loaded');
const open=await client.previewOperation({kind:'interior.open',unitId:fixture.unitId}),plan=structuredClone(open.result.plan);plan.cells['0:0']='boxes';
const op={kind:'interior.set',unitId:fixture.unitId,plan},preview=await client.previewOperation(op);assert.match(preview.review,/^[a-f0-9]{64}$/);assert.equal(revision,1);
const saved=await client.applyOperation(op,preview.review);assert.equal(saved.project.revision,2);assert.equal(saved.access.scopeVersion,2);assert(storage.has(oldKey));
mode='reject';await assert.rejects(client.applyOperation(op,preview.review),e=>e.status===422);assert(client.getView(),'Validation failure retains authorized scope');mode='';
revision++;const count=posts;await assert.rejects(client.previewOperation({kind:'workbench.read'}),e=>e.status===409);assert.equal(posts,count,'Stale operations stop before POST');assert(client.getView());await client.load(id);
mode='foreign';await assert.rejects(client.previewOperation({kind:'workbench.read'}));assert.equal(client.getView(),null,'Foreign preview closes the sensitive workspace');mode='';await client.load(id);
mode='revoke';await assert.rejects(client.previewOperation({kind:'workbench.read'}),e=>e.status===403);assert.equal(client.getView(),null);client.dispose();
console.log('PASS operation transport: real projected commands, apply/reload, scope2 migration quarantine, validation draft retention, stale preflight, foreign/revoked response rejection.');

// The server records a request before its response may be lost. Retrying must
// replay that exact command, including its original optimistic base revision.
function recoveryHarness(){
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},receipts=new Map(),sent=[],states=[];
 let archive=structuredClone(fixture.archive),revision=1,role='factory',subject='recover-factory',mode='',offline=false;
 const view=()=>projectView(role,archive,{id,revision,subject});
 const fetcher=async(url,options={})=>{const q=new URL(url,'https://test.invalid').searchParams,action=q.get('action');
  if(offline)throw new TypeError('Offline during authority check');
  if(action==='session')return Response.json({subject});
  if(action==='access')return Response.json({id,revision,role,subject,scopeVersion:2});
  if(options.method!=='POST')return Response.json(view());
  const body=JSON.parse(options.body);sent.push({action,request:q.get('request'),expected:q.get('expected'),text:options.body,body});
  if(mode==='500'||mode==='500-offline'){offline=mode==='500-offline';return Response.json({error:'Temporary server failure'},{status:500});}
  if(mode==='lost-before-commit'&&action==='operation-apply')throw new TypeError('Connection lost before commit');
  if(action==='operation-apply'&&receipts.has(q.get('request'))){assert.equal(receipts.get(q.get('request')),options.body,'Replay request bytes must remain identical');return Response.json(view());}
  const out=executeProjectOperation(role,archive,body,{id,subject,expectedRevision:revision});assert(out.ok,out.reason);
  if(action==='operation-apply'){
   assert.equal(body.review,out.review);assert.equal(Number(q.get('expected')),revision);receipts.set(q.get('request'),options.body);archive=out.archive;revision++;
   if(mode==='lost-response')throw new TypeError('Response lost after commit');
   if(mode==='concurrent-save')revision++;
   return Response.json(view());
  }
  return Response.json({type:'kitchen-operation-preview',version:1,project:{id,revision},access:{role,subject,scopeVersion:2},operation:{kind:body.operation.kind},result:out.result,review:out.review});
 };
 return {data,storage,sent,states,view,make:()=>createScopedProjectClient({fetcher,storage,onTransition:s=>states.push(s.status)}),setMode:v=>{mode=v;offline=false;},setActor:(r,s)=>{role=r;subject=s;},get revision(){return revision;}};
}
const recovery=recoveryHarness();let retry=recovery.make();await retry.load(id);
assert.equal(typeof retry.operationDraftFor,'function','Submitted operation drafts must be recoverable separately from project DTO drafts');
const ropen=await retry.previewOperation({kind:'interior.open',unitId:fixture.unitId}),rplan=structuredClone(ropen.result.plan);rplan.cells['0:0']='boxes';
const command={kind:'interior.set',unitId:fixture.unitId,plan:rplan},review=await retry.previewOperation(command);assert.deepEqual(retry.operationDraftFor(recovery.view()).operation,command);
const beforeBadReview=recovery.sent.length;await assert.rejects(retry.applyOperation(command,'0'.repeat(64)),e=>e.status===409);assert.equal(recovery.sent.length,beforeBadReview,'A different review cannot corrupt the saved command preview');
recovery.setMode('lost-response');await assert.rejects(retry.applyOperation(command,review.review),/Response lost/);assert(retry.getView(),'Verified unchanged authority keeps the mounted editor after a lost response');
const lost=recovery.sent.at(-1),retained=retry.operationDraftFor(recovery.view());assert(retained.conflict);assert(retained.requestId);assert.equal(retained.body.baseRevision,1);assert.deepEqual(retained.operation,command);
await assert.rejects(retry.previewOperation({...command,unitId:'other-unit'}),e=>e.status===409);assert.equal(recovery.sent.at(-1),lost,'A new command cannot overwrite an unresolved submitted command');
retry.dispose();retry=recovery.make();await retry.load(id);assert.equal(retry.getView().project.revision,2);assert.deepEqual(retry.operationDraftFor(recovery.view()).operation,command);
recovery.setMode('');const postsBefore=recovery.sent.length,cached=await retry.previewOperation(command);assert.equal(cached.review,review.review);assert.equal(recovery.sent.length,postsBefore,'A matching retry returns its authenticated cached preview despite the advanced revision');
const recovered=await retry.applyOperation(command,cached.review);assert.equal(recovered.project.revision,2);const replay=recovery.sent.at(-1);assert.equal(replay.request,lost.request);assert.equal(replay.text,lost.text);assert.equal(replay.expected,'1');assert.equal(recovery.revision,2);assert.equal(retry.operationDraftFor(recovered),null,'Confirmed replay clears the operation draft');retry.dispose();

const transient=recoveryHarness(),c=transient.make();await c.load(id);transient.setMode('500');const underway=c.previewOperation(command);assert.throws(()=>c.discardOperationDraft(),e=>e.status===409,'Cannot discard while an operation is in flight');await assert.rejects(underway,e=>e.status===500);assert(c.getView());assert.equal(transient.states.at(-1),'ready');assert.deepEqual(c.operationDraftFor(transient.view()).operation,command);
transient.setMode('500-offline');await assert.rejects(c.previewOperation(command));assert.equal(c.getView(),null);assert.equal(transient.states.at(-1),'locked');assert.deepEqual(c.operationDraftFor(transient.view()).operation,command,'Fail-closed authority loss retains only the submitted own operation in its partition');
const oldView=transient.view(),storedBefore=[...transient.data];transient.setMode('');transient.setActor('rep','new-representative');await c.load(id);assert.equal(c.operationDraftFor(transient.view()),null);assert.deepEqual([...transient.data],storedBefore,'Account/role changes never overwrite another scope recovery');assert.deepEqual(c.operationDraftFor(oldView).operation,command);transient.setMode('500');await assert.rejects(c.previewOperation(command));assert(c.operationDraftFor(transient.view()));c.discardOperationDraft();assert.equal(c.operationDraftFor(transient.view()),null);assert.deepEqual([...transient.data],storedBefore,'Explicit discard touches only the active scope partition');c.dispose();

const raced=recoveryHarness(),racedClient=raced.make();await racedClient.load(id);const racing=await racedClient.previewOperation(command);raced.setMode('concurrent-save');await assert.rejects(racedClient.applyOperation(command,racing.review),e=>e.status===409);assert.equal(racedClient.getView().project.revision,1,'A later response revision cannot silently become the base for the old mounted interior');assert(racedClient.operationDraftFor(raced.view()));racedClient.dispose();
const guarded=recoveryHarness(),guardedClient=guarded.make();await guardedClient.load(id);const guardPreview=await guardedClient.previewOperation(command);guarded.setMode('lost-before-commit');await assert.rejects(guardedClient.applyOperation(command,guardPreview.review));const beforePatch=guarded.sent.length;await assert.rejects(guardedClient.save(guarded.view().editable),e=>e.status===409);assert.equal(guarded.sent.length,beforePatch,'General PATCH cannot advance the base while an operation has an unresolved request ID');assert(guardedClient.operationDraftFor(guarded.view()).requestId);guardedClient.dispose();
const quota=recoveryHarness(),quotaClient=quota.make();await quotaClient.load(id);quota.storage.setItem=()=>{throw Error('quota');};await assert.rejects(quotaClient.previewOperation(command),e=>e.status===507);assert.equal(quota.sent.length,0,'No operation POST precedes durable recovery storage');assert(quotaClient.getView(),'Verified scope keeps the editor mounted after storage failure');quotaClient.dispose();
console.log('PASS operation recovery: durable scoped commands, verified transient-error retention, fail-closed offline recovery, exact idempotent retry across reload and advanced revision, partition isolation, and newer-writer conflict.');
