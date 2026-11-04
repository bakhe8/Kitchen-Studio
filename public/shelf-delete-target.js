import {inspectSizedScreen} from './shelf-sized-object.js';
import {checkRemovalAt} from './shelf-point-model.js';
import {targetInfo} from './shelf-selection-model.js';

const names={books:'الكتب',boxes:'الصناديق',plant:'النبتة',vase:'المزهرية'};

// The front elevation paints one independent, rounded screen OVER both art
// and boards. Its box is not a cell: its owner may span several openings.
export function onScreenFace(plan,p){
  const r=inspectSizedScreen(plan)?.rect;if(!r||!p)return false;
  const {x,y,w,h}=r;if(p.x<x||p.x>x+w||p.y<y||p.y>y+h)return false;
  const radius=Math.min(w,h)*.025,dx=Math.max(x+radius-p.x,0,p.x-(x+w-radius)),dy=Math.max(y+radius-p.y,0,p.y-(y+h-radius));
  return dx*dx+dy*dy<=radius*radius+1e-10;
}
export function removalItem(sample){
  return sample?.screen?{screen:true}:sample?.art?{cellKey:sample.art.key}:sample?.hit?.dividerId?{dividerId:sample.hit.dividerId}:null;
}
export const removalKey=i=>i?.screen?'screen':i?.cellKey?'art:'+i.cellKey:i?.dividerId?'board:'+i.dividerId:'';
export function removalDescription(plan,item){
  if(item?.screen)return 'حذف الشاشة بمقاسها الفعلي فقط.';
  if(item?.cellKey){const c=targetInfo(plan,{kind:'cell',key:item.cellKey});return c&&names[c.content]?'حذف '+names[c.content]+' من '+c.label+' فقط.':'';}
  if(!item?.dividerId)return '';
  const r=checkRemovalAt(plan,item.dividerId);
  if(!r.id)return '';
  if(!r.ok&&!r.canForce)return r.title+' · '+r.reason;
  return 'إزالة '+r.title+(r.canForce?' · يتطلّب دمج محتويات الخانات تأكيدًا.':r.owner.kind==='wall'||r.owner.kind==='zone'?' · يزيل حدّ التخطيط فقط.':' · سيُزال اللوح بطوله.');
}
export function collisionDescription(check){
  const namesLost=(check.conflicts||[]).map(c=>names[c.removeContent]).filter(Boolean),count=namesLost.length;
  const examples=[...new Set(namesLost)].join('، ');
  return check.reason+(count&&examples?' المحتوى الذي سيُزال عند التأكيد: '+examples+'.':'')+' يمكنك التراجع عن الدمج.';
}
