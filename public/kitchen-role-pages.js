import {mainGateways,pageOwner} from './kitchen-gateways.js';
// Navigation is a convenience boundary. The server and project write policy
// independently check the complete change against authenticated membership.
const roles=new Set(['owner','editor','viewer','store','factory','rep']);
const externalRep=new Set(['field','assist','placement','cad-run','cad-material','unit-interior','room-finish','field-part','floor-point']);
export const roleLabels={owner:'المالك',store:'المتجر',factory:'المصنع',rep:'المندوب',editor:'محرر سابق',viewer:'عرض فقط'};
export function visibleGatewayIds(role){
 if(role==='owner')return mainGateways.map(g=>g.id);
 if(role==='editor'||role==='viewer')return mainGateways.filter(g=>g.id!=='owner').map(g=>g.id);
 return ['store','factory','rep'].includes(role)?[role]:[];
}
export const roleHome=role=>role==='store'?'store':role==='factory'?'recipes':role==='rep'?'survey':'home';
export function canOpenWorkshopPage(role,page){
 if(['home','sync'].includes(page))return true;
 if(!roles.has(role))return false;
 if(page==='oversight')return role==='owner';
 if(['owner','editor','viewer'].includes(role))return !!pageOwner(page)||externalRep.has(page)||['defaults','top-detail'].includes(page);
 if(page==='quote')return true;
 if(page==='team')return role==='store'||role==='factory';
 if(['field','defaults'].includes(page))return role==='rep'||role==='factory';
 if(externalRep.has(page))return role==='rep';
 if(page==='top-detail')return role==='factory';
 return pageOwner(page)?.gateway.id===role;
}
export function canEditWorkshopPage(role,page){
 if(!canOpenWorkshopPage(role,page)||role==='viewer'||!roles.has(role)||page==='home')return false;
 if(page==='oversight')return role==='owner';
 // The quote studio edits both store prices and commercial terms. Only the
 // owner has both authorities; scoped roles retain their original editors.
 if(page==='quote')return role==='owner';
 if(['production','maintenance'].includes(page))return role==='owner'||role==='factory';
 if(role==='owner')return true;
 if(page==='sync')return true; // Individual server actions enforce their own authority.
 if(role==='editor')return !['store','libraries','recipes','machines','template','sale','team','inventory'].includes(page);
 return true;
}
