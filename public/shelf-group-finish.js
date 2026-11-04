import {ownKey} from './kitchen-safe-keys.js';
// Only the backing and its inset edges inherit a bay's finish. The cabinet
// frame uses plan.finish; planning zones and the wall never get wood finishes.
import {asScopedPlan,finishIds} from './shelf-model.js';
import {currentLeafKeys} from './shelf-marquee.js';

function resolve(plan,key) {
  if(typeof key!=='string')return null;
  const [base,...ids]=key.split('/');
  if(!ownKey(plan.cells,base))return null;
  let inherited=plan.finish,own=plan.bayFinishes?.[base],grid=plan.cellGrids?.[base];
  for(const id of ids) {
    const child=grid?.children.find(c=>String(c.id)===id);
    if(!child)return null;
    inherited=own||inherited;own=child.finish;grid=child.grid;
  }
  return {base,ids,inherited,effective:own||inherited};
}
export function effectiveFinish(plan,key) {return resolve(plan,key)?.effective||plan.finish;}

function writeGrid(grid,ids,i,finish) {
  const children=grid.children.map(c=>{
    if(String(c.id)!==ids[i])return c;
    if(i+1<ids.length)return {...c,grid:writeGrid(c.grid,ids,i+1,finish)};
    const next={...c};if(finish)next.finish=finish;else delete next.finish;return next;
  });
  return {...grid,children};
}
export function groupFinish(plan,keys,finish) {
  const none={plan,changed:false,keys:[],count:0};
  const wanted=new Set(Array.isArray(keys)||keys instanceof Set?keys:[]);
  if(!wanted.size||!finishIds.includes(finish))return none;
  const current=currentLeafKeys(plan,wanted);if(current.length!==wanted.size)return none;
  let next=plan,count=0;
  for(const key of current) {
    const {base,ids,inherited,effective}=resolve(next,key);
    if(effective===finish)continue;
    const override=finish!==inherited?finish:null;
    next=asScopedPlan(next);
    if(ids.length)next={...next,cellGrids:{...next.cellGrids,[base]:writeGrid(next.cellGrids[base],ids,0,override)}};
    else {
      const map={...next.bayFinishes};if(override)map[base]=override;else delete map[base];
      next={...next};if(Object.keys(map).length)next.bayFinishes=map;else delete next.bayFinishes;
    }
    count++;
  }
  return {plan:next,changed:count!==0,keys:current,count};
}
