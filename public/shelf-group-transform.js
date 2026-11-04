// Group handles edit the cabinet's real geometry, in wall cm. The graph below
// represents each physical board once, even if several nested openings share
// its edge. No divider, content or child ID is added, removed or reparented.
import {SHELF_LIMITS as L, rootPartition, partitionLayout, cellKey, moveCab, resizeCab, evaluateCab, updateCab} from './shelf-model.js';
import {scopedCells} from './shelf-selection-model.js';

const E = 1e-8, near = (a,b) => Math.abs(a-b) < E;
const clamp = (a,lo,hi) => Math.max(lo,Math.min(hi,a));
const rectangleChanged = (a,b) => ['x','y','w','h'].some(k=>!near(a[k],b[k]));
function envelope(cells) {
  if (!cells.length) return null;
  const x = Math.min(...cells.map(c=>c.x)), y = Math.min(...cells.map(c=>c.y));
  return {x,y,w:Math.max(...cells.map(c=>c.x+c.w))-x,h:Math.max(...cells.map(c=>c.y+c.h))-y};
}
function describe(leaves,keys) {
  const wanted = new Set(Array.isArray(keys) || keys instanceof Set ? keys : []);
  const sel = leaves.filter(c=>wanted.has(c.key)), ok = sel.length>0 && sel.length===wanted.size;
  return {ok,keys:ok?sel.map(c=>c.key):[],bounds:ok?envelope(sel):null,all:ok && sel.length===leaves.length,
    reason:ok?'':wanted.size?'بعض الخانات المحددة لم تعد موجودة. أعد تحديد المجموعة.':'حدّد خانة واحدة على الأقل.'};
}
export function groupInfo(plan,keys) { return describe(scopedCells(plan),keys); }

// Endpoints are a board centre plus a face offset, or the cabinet's inner
// frame edge with zero offset. Nested cells inherit the actual boundary node
// of their parent, not an independent point at the same numeric coordinate.
function geometry(plan) {
  const axes = [], ref=(node,offset=0)=>({node,offset});
  function node(g,at) {
    const v = {idx:g.nodes.length,at,out:[],inc:[],faces:[]}; g.nodes.push(v); return v;
  }
  for (const [s,len] of [['x','w'],['y','h']]) {
    const g = {s,len,nodes:[],wall:plan.wall[len]}; axes.push(g);
    g.start=node(g,plan.cab[s]+L.frame); g.end=node(g,plan.cab[s]+plan.cab[len]-L.frame);
  }
  const roots=axes.map(g=>[ref(g.start),ref(g.end)]), leaves=[];
  function visit(grid,rect,edges,key,root) {
    const layout=partitionLayout(grid,rect,false,root?L.frame:0);
    const cutNodes=axes.map((g,i)=>(i?layout.rows:layout.cols).map(f=>node(g,rect[g.s]+f*rect[g.len])));
    const nested=[];
    for (let index=0;index<layout.children.length;index++) {
      const ch=layout.children[index],k=root?cellKey(ch.col,ch.row):key+'/'+ch.node.id;
      const pair=cutNodes.map((ns,i)=>{
        const j=i?ch.row:ch.col;
        return [j?ref(ns[j-1],L.divider/2):edges[i][0],
          j===ns.length?edges[i][1]:ref(ns[j],-L.divider/2)];
      });
      if (ch.node.grid) nested.push({index,key:k,tree:visit(ch.node.grid,ch,pair,k,false)});
      else {
        leaves.push({key:k,pair});
        for (const [a,b] of pair) {
          // The saved-plan validator accepts sub-nanometre rounding at a
          // minimum. Such an opening must remain usable on the OTHER axis:
          // tolerate its existing rounding, but never reduce it further.
          const min=Math.min(L.minInterior+a.offset-b.offset,b.node.at-a.node.at);
          a.node.out.push([b.node.idx,min]); b.node.inc.push([a.node.idx,min]);
        }
      }
    }
    return {grid,rect,edges,cutNodes,nested,root};
  }
  const tree=visit(rootPartition(plan),plan.cab,roots,'',true);
  axes.forEach(g=>g.order=[...g.nodes].sort((a,b)=>a.at-b.at));
  return {axes,tree,leaves};
}

function weights(axis,g,leaves,wanted,spec,bounds) {
  for (const c of leaves) if (wanted.has(c.key)) {
    for (const {node,offset} of c.pair[axis]) node.faces.push(node.at+offset);
  }
  const low=bounds[g.s], high=low+bounds[g.len], nearSide=spec.type==='resize' && spec.corner.includes(axis===0?'w':'n');
  for (const node of g.nodes) {
    // Unselected outer cabinet faces are fixed. Unrelated internal dividers
    // prefer their old positions, but may yield when a neighbour needs space.
    if (!node.faces.length) {node.weight=node===g.start||node===g.end?0:null;continue;}
    if (spec.type==='move') {node.weight=1;continue;}
    const first=Math.min(...node.faces), last=Math.max(...node.faces);
    // Scale interior boards about their physical middle when BOTH faces are
    // selected. The extreme opening face tracks the actual dragged corner.
    const at=near(first,low)?low:near(last,high)?high:(first+last)/2;
    const fraction=clamp((at-low)/(high-low),0,1);
    node.weight=nearSide?1-fraction:fraction;
  }
}

// Difference constraints: every cabinet leaf opening must stay >= 14 cm.
// The existing geometry strictly orders the graph; a forward lower-bound
// pass and a backward upper-bound pass give the feasible interval per board.
function place(g,delta,output=false) {
  const lo=new Float64Array(g.nodes.length), hi=new Float64Array(g.nodes.length);
  lo.fill(-Infinity);hi.fill(Infinity);
  for (const v of g.nodes) if (v.weight!==null) lo[v.idx]=hi[v.idx]=v.at+v.weight*delta;
  if (lo[g.start.idx]<L.frame || hi[g.end.idx]>g.wall-L.frame) return false;
  for (const v of g.order) {
    for (const [w,min] of v.out) lo[w]=Math.max(lo[w],lo[v.idx]+min);
    if (lo[v.idx]>hi[v.idx]+1e-12) return false;
  }
  if (!output) return true;
  for(let j=g.order.length-1;j>=0;j--) {
    const v=g.order[j];for(const [w,min] of v.out) hi[v.idx]=Math.min(hi[v.idx],hi[w]-min);
  }
  const at=new Float64Array(g.nodes.length);
  for(const v of g.order) {
    let min=lo[v.idx];
    for(const [prev,gap] of v.inc) min=Math.max(min,at[prev]+gap);
    at[v.idx]=v.weight!==null?v.at+v.weight*delta:clamp(v.at,min,hi[v.idx]);
  }
  return at;
}
function solve(g,request) {
  const bounded=clamp(request,-g.wall,g.wall);let delta=bounded,limit=null;
  if(!place(g,bounded)) {
    // The zero displacement is feasible. Along a single gesture axis all
    // constraints are linear, so the reachable portion is a single interval.
    let lo=0,hi=1;
    for(let i=0;i<45;i++) {const m=(lo+hi)/2;if(place(g,bounded*m))lo=m;else hi=m;}
    delta=bounded*lo;
  }
  if(!near(request,delta)) {
    const direction=Math.sign(request);
    // Report the limiting constraint actually reached, rather than suggesting
    // an invisible wall when the nearest cell is at its minimum clear size.
    if(direction<0 && g.start.weight>0 && near(g.start.at+delta*g.start.weight,L.frame)
      || direction>0 && g.end.weight>0 && near(g.end.at+delta*g.end.weight,g.wall-L.frame)) limit='wall';
    else limit='clearance';
  }
  if(Math.abs(delta)<E)delta=0;
  return {delta,limit,at:place(g,delta,true)};
}

function install(plan,tree,solved) {
  const val=(i,r)=>solved[i].at[r.node.idx]+r.offset;
  const dimensions=tree.edges.map(([a,b],i)=>[val(i,a)-L.frame,val(i,b)+L.frame]);
  const [[x,r],[y,b]]=dimensions,cab={x,y,w:r-x,h:b-y};
  function rebuild(t) {
    const lists=t.cutNodes.map((ns,i)=>{
      const [l,h]=t.edges[i],pad=t.root?L.frame:0,start=val(i,l)-pad,span=val(i,h)+pad-start;
      const src=i?t.grid.rows:t.grid.cols;
      // A grid may already have fitted fractions from a prior resize. Keep
      // its saved representation untouched if its visible geometry didn't move.
      if(near(start,t.rect[i?'y':'x']) && near(span,t.rect[i?'h':'w'])
        && ns.every(n=>near(n.at,solved[i].at[n.idx])))return src;
      const fracs=ns.map(n=>(solved[i].at[n.idx]-start)/span);
      return fracs.every((f,j)=>Math.abs(f-src[j])<1e-14)?src:fracs;
    });
    let children=t.grid.children;
    for(const child of t.nested) {
      const grid=rebuild(child.tree);
      if(grid!==children[child.index].grid) {
        if(children===t.grid.children)children=children.slice();
        children[child.index]={...children[child.index],grid};
      }
    }
    if(lists[0]===t.grid.cols&&lists[1]===t.grid.rows&&children===t.grid.children)return t.grid;
    return {...t.grid,cols:lists[0],rows:lists[1],children};
  }
  const root=rebuild(tree),next={...plan,cab:rectangleChanged(plan.cab,cab)?cab:plan.cab,cols:root.cols,rows:root.rows};
  for(const c of tree.nested) if(root.children[c.index].grid!==plan.cellGrids[c.key]) {
    if(next.cellGrids===plan.cellGrids)next.cellGrids={...plan.cellGrids};
    next.cellGrids[c.key]=root.children[c.index].grid;
  }
  return next;
}

const limitText={wall:'حافة الجدار',clearance:'الحد الأدنى لخلوص الخانات'};
function reasonFor(limits) {
  const out=[];if(limits.x)out.push('أفقيًا عند '+limitText[limits.x]);if(limits.y)out.push('رأسيًا عند '+limitText[limits.y]);
  return out.length?'توقّفت الحركة '+out.join('، و')+'.':'';
}
export function transformGroup(plan,keys,spec) {
  const prior=scopedCells(plan),info=describe(prior,keys);
  const common={...info,plan,changed:false,beforeBounds:info.bounds,frameChanged:false,clamped:false,affectedKeys:[],limits:{x:null,y:null},applied:{dx:0,dy:0}};
  if(!info.ok)return common;
  if(!spec||!Number.isFinite(spec.dx)||!Number.isFinite(spec.dy)
    ||(spec.type!=='move'&&(spec.type!=='resize'||!['nw','ne','sw','se'].includes(spec.corner))))
    return {...common,ok:false,reason:'أدخل إزاحة صالحة وحدّد مقبض التحجيم.'};
  if(!spec.dx&&!spec.dy)return common;
  const wanted=new Set(info.keys),limits={x:null,y:null};let next;
  if(info.all) {
    const {cab:c}=plan,west=spec.type==='resize'&&spec.corner.includes('w'),north=spec.type==='resize'&&spec.corner.includes('n');
    next=spec.type==='move'?moveCab(plan,spec.dx,spec.dy):resizeCab(plan,spec.corner,
      {x:c.x+(west?0:c.w)+spec.dx,y:c.y+(north?0:c.h)+spec.dy});
  } else {
    const {axes,leaves,tree}=geometry(plan);
    const solved=axes.map((g,i)=>{
      weights(i,g,leaves,wanted,spec,info.bounds);return solve(g,i?spec.dy:spec.dx);
    });
    [limits.x,limits.y]=solved.map(s=>s.limit);
    next=solved.every(s=>s.delta===0)?plan:install(plan,tree,solved);
  }
  const post=next===plan?prior:scopedCells(next),bounds=envelope(post.filter(c=>wanted.has(c.key)));
  const previous=info.bounds;
  const applied={dx:bounds.x-previous.x,dy:bounds.y-previous.y};
  if(spec.type==='resize') {
    if(spec.corner.includes('e'))applied.dx+=bounds.w-previous.w;
    if(spec.corner.includes('s'))applied.dy+=bounds.h-previous.h;
  }
  if(info.all) for(const [axis,len,d] of [['x','w','dx'],['y','h','dy']]) if(!near(applied[d],spec[d])) {
    const c=next.cab,start=c[axis],end=start+c[len];
    const firstCanMove=spec.type==='move'||spec.corner.includes(axis==='x'?'w':'n');
    const lastCanMove=spec.type==='move'||!firstCanMove;
    limits[axis]=(spec[d]<0&&firstCanMove&&near(start,0))||(spec[d]>0&&lastCanMove&&near(end,plan.wall[len]))?'wall':'clearance';
  }
  return {...common,plan:next,changed:next!==plan,bounds,frameChanged:rectangleChanged(plan.cab,next.cab),
    applied,limits,clamped:!!(limits.x||limits.y),reason:reasonFor(limits),
    affectedKeys:post.filter((c,i)=>!wanted.has(c.key)&&rectangleChanged(c,prior[i])).map(c=>c.key)};
}

// Drawing specifies an exact target opening envelope, not a drag toward the
// nearest feasible position. Both translation and scale constraints must be
// satisfied together; an impossible request leaves the whole plan unchanged.
export function reframeGroup(plan,keys,rect) {
  const prior=scopedCells(plan),info=describe(prior,keys);
  const common={...info,plan,changed:false,beforeBounds:info.bounds,frameChanged:false,
    clamped:false,affectedKeys:[],limits:{x:null,y:null},applied:{dx:0,dy:0,dw:0,dh:0}};
  const fail=reason=>({...common,ok:false,reason});
  if(!info.ok)return common;
  if(!rect||!['x','y','w','h'].every(k=>Number.isFinite(rect[k]))||rect.w<=0||rect.h<=0)
    return fail('ارسم مستطيلاً له عرض وارتفاع داخل الجدار.');
  const right=rect.x+rect.w,bottom=rect.y+rect.h;
  if(rect.x<0||rect.y<0||right>plan.wall.w||bottom>plan.wall.h)
    return fail('يتجاوز المستطيل الجدار؛ ارسم غلاف المجموعة داخل حدوده.');
  if(rect.w<L.minInterior-E||rect.h<L.minInterior-E)
    return fail('المستطيل أصغر من الحد الأدنى لخلوص خانة واحدة (١٤ سم).');
  const old=info.bounds,wanted=new Set(info.keys);
  if(!rectangleChanged(old,rect))return common;
  let next;
  if(info.all) {
    const frame={x:rect.x-L.frame,y:rect.y-L.frame,w:rect.w+2*L.frame,h:rect.h+2*L.frame};
    const result=evaluateCab(plan,frame);
    if(!result.ok)return fail(result.reason);
    if(rectangleChanged(frame,result.rect))return fail('اترك مكانًا لإطار الدولاب بين غلاف الخانات وحافة الجدار.');
    next=updateCab(plan,frame);
  } else {
    const {axes,leaves,tree}=geometry(plan);
    const solved=[];
    for(const [i,g] of axes.entries()) {
      weights(i,g,leaves,wanted,{type:'resize',corner:'se'},old);
      const lowDelta=rect[g.s]-old[g.s],highDelta=lowDelta+(rect[g.len]-old[g.len]);
      for(const v of g.nodes)if(v.faces.length)v.weight=lowDelta*(1-v.weight)+highDelta*v.weight;
      // The locked face positions are affine in the two requested edges. Use
      // exactly progress=1; unlike resize handles there is no partial commit.
      if(g.start.at+g.start.weight<L.frame-E||g.end.at+g.end.weight>g.wall-L.frame+E)
        return fail('لا يتّسع الجدار للإطار عند هذا الموضع. اترك مسافة عن الحافة.');
      const at=place(g,1,true);
      if(!at)return fail('هذا المستطيل لا يترك خلوصًا كافيًا للخانات التي تتشارك الفواصل. غيّر موضعه أو أبعاده.');
      solved.push({at});
    }
    next=install(plan,tree,solved);
  }
  const post=scopedCells(next),bounds=envelope(post.filter(c=>wanted.has(c.key)));
  if(rectangleChanged(bounds,rect))return fail('لا يمكن تحقيق الغلاف المرسوم مع الاحتفاظ بالفواصل الحالية.');
  return {...common,plan:next,changed:next!==plan,bounds,frameChanged:rectangleChanged(plan.cab,next.cab),
    applied:{dx:bounds.x-old.x,dy:bounds.y-old.y,dw:bounds.w-old.w,dh:bounds.h-old.h},
    affectedKeys:post.filter((c,i)=>!wanted.has(c.key)&&rectangleChanged(c,prior[i])).map(c=>c.key)};
}
