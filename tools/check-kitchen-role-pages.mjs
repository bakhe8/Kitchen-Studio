import assert from 'node:assert/strict';
import {canOpenWorkshopPage,canEditWorkshopPage,visibleGatewayIds,roleHome} from '../public/kitchen-role-pages.js';
import {gateways,ownedPages} from '../public/kitchen-gateways.js';
assert.deepEqual(visibleGatewayIds('owner'),['store','factory','rep','result','owner']);
for(const role of ['store','factory','rep']){
 assert.deepEqual(visibleGatewayIds(role),[role]);
 assert(canOpenWorkshopPage(role,roleHome(role)));
 assert(canOpenWorkshopPage(role,'sync'));assert(canOpenWorkshopPage(role,'quote'));
 for(const page of ['sale','approve','sign','oversight'])assert.equal(canOpenWorkshopPage(role,page),false,role+' cannot enter '+page);
}
assert(!canOpenWorkshopPage('store','recipes'));assert(!canOpenWorkshopPage('factory','store'));assert(!canOpenWorkshopPage('rep','inventory'));
assert(canOpenWorkshopPage('factory','team'),'factory can reach its independently authorized team catalogs');
for(const page of ownedPages)assert(canOpenWorkshopPage('owner',page),page);
assert(canEditWorkshopPage('owner','oversight'),'the owner can save overview decisions and use project history');
for(const role of ['editor','viewer','store','factory','rep',null,undefined])assert(!canEditWorkshopPage(role,'oversight'),'oversight edits remain owner-only');
assert.equal(gateways.filter(g=>!g.minor).length,5);
assert(canEditWorkshopPage('store','store'));assert(!canEditWorkshopPage('store','quote'));
assert(canEditWorkshopPage('factory','recipes'));assert(canEditWorkshopPage('rep','survey'));
for(const role of ['owner','factory'])assert(canEditWorkshopPage(role,'production'));
for(const role of ['editor','viewer','store','rep'])assert(!canEditWorkshopPage(role,'production'));
for(const role of ['owner','factory'])assert(canEditWorkshopPage(role,'maintenance'));
for(const role of ['editor','viewer','store','rep'])assert(!canEditWorkshopPage(role,'maintenance'));
for(const page of ownedPages)assert(!canEditWorkshopPage('viewer',page),'viewer cannot edit '+page);
assert(canOpenWorkshopPage('editor','sign')&&canEditWorkshopPage('editor','sign'),'legacy editor keeps prior approvals access');
assert(!canEditWorkshopPage('editor','sale'),'legacy editor cannot edit protected commercial records');
for(const unknown of [null,undefined,'admin','constructor']){
 assert.deepEqual(visibleGatewayIds(unknown),[]);
 assert(!canOpenWorkshopPage(unknown,'store'));assert(!canEditWorkshopPage(unknown,'survey'));
 assert(canOpenWorkshopPage(unknown,'sync'),'locked access can still reconnect');
}
console.log('PASS: five gateways, scoped routes, owner approvals/pricing, legacy reader/editor and unknown-role denial.');
