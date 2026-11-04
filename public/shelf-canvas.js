import {snapPlacementAt,snapDividerAt,equalDistribution,distributionCapacity} from './shelf-layout-tools.js';
import {renderShelfVolume} from './shelf-volume.js';
import {renderSizedScreen,inspectSizedScreen} from './shelf-sized-object.js';
import {onScreenFace,removalItem,removalKey,removalDescription} from './shelf-delete-target.js';
import {sharedSelectionReach,groupSharedDividers} from './shelf-shared-selection.js';
import {effectiveFinish} from './shelf-group-finish.js';
import {groupInfo,transformGroup,reframeGroup} from './shelf-group-transform.js';
import {marqueeCells} from './shelf-marquee.js';
import {drawCab,evaluateDraw,moveCab,resizeCab,SHELF_LIMITS} from './shelf-model.js';
import {scopedCells,wallZones,scopedDividers,targetInfo,dividerReach,dividerDragStatus,moveScopedDivider,planContentDrop} from './shelf-selection-model.js';

// All geometry is in wall centimetres, left-to-right and top-to-bottom. The
// page is Arabic/RTL; the SVG coordinate system is deliberately never flipped.
const NS='http://www.w3.org/2000/svg';
const ar=new Intl.NumberFormat('ar',{maximumFractionDigits:2});
const cm=n=>`${ar.format(n)} سم`;
const n=v=>Number.isFinite(v)?Number(v.toFixed(4)):0;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const attr=v=>String(v).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const transform=(x,y)=>`translate(${n(x)} ${n(y)})`;
const rect=(x,y,w,h,fill,extra='')=>`<rect x="${n(x)}" y="${n(y)}" width="${n(Math.max(0,w))}" height="${n(Math.max(0,h))}" fill="${fill}" ${extra}/>`;
const finishes={
  oak:{name:'بلوط',face:'#bd9464',edge:'#9d774c',light:'#dcba8a',grain:'#755331',back:'#c2a47b',rear:'#a28460',side:'#95704d',top:'#d1b184',grainOpacity:.23},
  walnut:{name:'جوز',face:'#78533e',edge:'#543929',light:'#a47a5b',grain:'#341e15',back:'#876a52',rear:'#66503f',side:'#594332',top:'#94755b',grainOpacity:.31},
  ivory:{name:'عاجي',face:'#e1dccc',edge:'#b6af9e',light:'#fbf7e9',grain:'#9e9789',back:'#e1ddcf',rear:'#c8c3b5',side:'#c4beae',top:'#efeadd',grainOpacity:.08}
};
const walls={sand:['#f5ecdc','#e5d7c0','#cdbda5'],sage:['#e5e9df','#cbd4c5','#adbcae'],stone:['#efefeb','#d8d8d1','#bfc2bc']};
const fOf=p=>finishes[p.finish]||finishes.oak;
const floorHeight=p=>clamp(p.wall.h*.07,6,18);
let serial=0;

const grainArt=f=>`<path d="M-2 1.1C8 .2 14 1.8 24 1.1S38 .4 46 1M-1 3.6C9 4.5 14 2.4 26 3.5S39 4.2 46 3.1M-3 5.6C9 5.3 15 6.9 25 5.8S38 4.8 45 5.9" fill="none" stroke="${f.grain}" stroke-width=".15" opacity="${f.grainOpacity}"/><path d="M2 2.1c5-.8 8-.7 12 .1M24 4.7c5-.6 9-.7 16 .1" fill="none" stroke="${f.light}" stroke-width=".12" opacity=".38"/>`;
function openingDefs(id){
  return Object.entries(finishes).map(([name,f])=>`<linearGradient id="${id}-back-${name}" x1="0" y1="0" x2=".29" y2="1"><stop stop-color="${f.rear}"/><stop offset=".35" stop-color="${f.back}"/><stop offset=".96" stop-color="${f.back}"/><stop offset="1" stop-color="${f.top}"/></linearGradient><pattern id="${id}-lining-${name}" patternUnits="userSpaceOnUse" width="44" height="7" patternTransform="rotate(90)">${grainArt(f)}</pattern>`).join('');
}
const leafFinish=(plan,c)=>effectiveFinish(plan,c.key);
function defs(plan,id){
  const wall=walls[plan.wallColor]||walls.sand,f=fOf(plan);
  const grain=grainArt(f);
  return `<linearGradient id="${id}-wall" x1="0" y1="0" x2="1" y2=".85" gradientUnits="objectBoundingBox"><stop stop-color="${wall[0]}"/><stop offset=".58" stop-color="${wall[1]}"/><stop offset="1" stop-color="${wall[2]}"/></linearGradient>
    <linearGradient id="${id}-floor" x2="0" y2="1"><stop stop-color="#ad967b"/><stop offset=".12" stop-color="#c6b298"/><stop offset="1" stop-color="#e4d8c5"/></linearGradient>
    <linearGradient id="${id}-face" x1="0" y1="0" x2=".15" y2="1"><stop stop-color="${f.light}"/><stop offset=".19" stop-color="${f.face}"/><stop offset=".78" stop-color="${f.face}"/><stop offset="1" stop-color="${f.edge}"/></linearGradient>
    <linearGradient id="${id}-vertical" x2="1" y2="0"><stop stop-color="${f.light}"/><stop offset=".25" stop-color="${f.face}"/><stop offset="1" stop-color="${f.edge}"/></linearGradient>
    ${openingDefs(id)}
    <linearGradient id="${id}-shade" x2="0" y2="1"><stop stop-color="#30271e" stop-opacity=".29"/><stop offset=".48" stop-color="#30271e" stop-opacity=".095"/><stop offset="1" stop-color="#30271e" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}-glaze" x1="0" y1="0" x2="1" y2=".12"><stop stop-color="#6a7769"/><stop offset=".2" stop-color="#9da999"/><stop offset=".48" stop-color="#a8b1a2"/><stop offset=".84" stop-color="#7e8a79"/><stop offset="1" stop-color="#5f6d61"/></linearGradient>
    <linearGradient id="${id}-clay" x2="1" y2=".1"><stop stop-color="#a56950"/><stop offset=".31" stop-color="#d49a76"/><stop offset=".65" stop-color="#bf8467"/><stop offset="1" stop-color="#96614b"/></linearGradient>
    <linearGradient id="${id}-porcelain" x2="1" y2=".1"><stop stop-color="#b0a793"/><stop offset=".26" stop-color="#efe8d6"/><stop offset=".58" stop-color="#e2d9c2"/><stop offset="1" stop-color="#b8ad94"/></linearGradient>
    <pattern id="${id}-grain-h" patternUnits="userSpaceOnUse" width="44" height="7">${grain}</pattern>
    <pattern id="${id}-grain-v" patternUnits="userSpaceOnUse" width="44" height="7" patternTransform="rotate(90)">${grain}</pattern>
    <pattern id="${id}-linen" patternUnits="userSpaceOnUse" width="3" height="3"><path d="M0 1H3M1 0V3" fill="none" stroke="#f6e6cb" stroke-width=".55" opacity=".18"/></pattern>
    <filter id="${id}-drop" x="-24%" y="-24%" width="155%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="2.1"/></filter>
    <filter id="${id}-ground-blur" x="-20%" y="-120%" width="145%" height="360%"><feGaussianBlur stdDeviation="1.35"/></filter>`;
}

function wallScene(plan,id,photo){
  const {w,h}=plan.wall,fh=floorHeight(plan),base=clamp(h*.018,2.4,5),wall=walls[plan.wallColor]||walls.sand;
  let seams='';const count=clamp(Math.round(w/48),3,18);for(let i=1;i<count;i++){
    const x=w*i/count;seams+=`<path d="M${n(x)} ${h}l${n((x-w/2)*.065)} ${n(fh)}" stroke="#927e69" stroke-opacity=".33" stroke-width=".28"/>`;
  }
  const surface=photo?`<image href="${attr(photo)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none"/>`:
    `${rect(0,0,w,h,`url(#${id}-wall)`)}<path d="M0 0H${n(w*.35)}L${n(w*.03)} ${n(h*.72)}H0Z" fill="#fff9e8" opacity=".10"/>${rect(0,h-base,w,base,wall[0])}${rect(0,h-base,w,.42,wall[2])}${rect(0,h-.55,w,.55,'#7b6d5d','opacity=".24"')}`;
  return `${surface}${rect(0,h,w,fh,`url(#${id}-floor)`)}${seams}<path d="M0 ${n(h+fh*.72)}H${w}" stroke="#b5a38c" stroke-opacity=".33" stroke-width=".25"/>`;
}

const bookColours=['#5d7567','#a96851','#d4c29a','#788c92','#c19b59','#6e584c','#a7a389','#d6d4c3'];
function books(seed){
  const heights=[51,58,46,55,53],widths=[9,8,11,8,10];let x=3,s='';
  for(let i=0;i<5;i++){
    const h=heights[(i+seed)%5],w=widths[i],c=bookColours[(seed+i*3)%bookColours.length];
    s+=`<g><rect x="${x}" y="${-h}" width="${w}" height="${h}" rx="1.1" fill="${c}"/><path d="M${x+1.4} ${-h+1}v${h-2}" stroke="#fff8e2" stroke-opacity=".32" stroke-width=".8"/><path d="M${x+w-1} ${-h+1}v${h-1}" stroke="#312c25" stroke-opacity=".22" stroke-width="1.2"/><path d="M${x+2} ${-h+7}h${w-4}M${x+2} -5h${w-4}" stroke="#e8d8b2" stroke-width="1.3"/><path d="M${x+w/2} ${-h+14}v${Math.min(13,h/4)}" stroke="#dfd6ba" stroke-width="1.5" opacity=".78"/></g>`;x+=w+.8;
  }
  if(seed%2){s+=`<g transform="translate(${x+10} 0) rotate(-10)"><rect x="0" y="-54" width="10" height="54" rx=".8" fill="#a99267"/><path d="M2 -45h6m-6 3h6M2 -7h6" stroke="#e8d8ae"/><path d="M1 -53v52" stroke="#e4cda6" stroke-width="1.2"/></g>`;}
  else{s+=`<g transform="translate(${x+3} 0)"><path d="M0 -6h32v6H0z" fill="#776858"/><path d="M2 -5h28v3H2z" fill="#d7c9ac"/><path d="M2 -12h29v6H2z" fill="#747e6e"/><path d="M4 -11h25v3H4z" fill="#e1d4b8"/><path d="M0 -17h28v5H0z" fill="#b58458"/><path d="M2 -16h24v2H2z" fill="#e5d7bb"/></g>`;}
  return {w:seed%2?78:91,h:60,max:32,body:s};
}
function oneBox(x,y,w,h,base,lid,id){
  return `<g transform="${transform(x,y)}"><path d="M0 ${-h}l4 -3h${w-5}l2 3Z" fill="${lid}"/><rect x="0" y="${-h}" width="${w}" height="${h}" rx="1.5" fill="${base}"/><rect x="0" y="${-h}" width="${w}" height="${h}" rx="1.5" fill="url(#${id}-linen)"/><path d="M0 ${-h}h${w}v5H0Z" fill="${lid}"/><path d="M0 ${-h+5}h${w}" stroke="#5a5141" stroke-opacity=".42" stroke-width="1"/><path d="M${w-2} ${-h+6}v${h-8}" stroke="#534b3d" stroke-opacity=".2" stroke-width="2.5"/><rect x="${w*.36}" y="${-h*.64}" width="${w*.28}" height="${h*.25}" rx="1.1" fill="#aa8960" stroke="#75603e" stroke-width=".65"/><rect x="${w*.36+1.3}" y="${-h*.64+1.1}" width="${w*.28-2.6}" height="${h*.25-2.2}" fill="#e8dfc8"/><path d="M${w*.42} ${-h*.51}h${w*.15}" stroke="#99907c" stroke-width=".7"/></g>`;
}
function boxes(seed,id){
  const palettes=[['#9c9b83','#b6b49b'],['#ab8d71','#c1a386'],['#85908b','#a3aba0']];const a=palettes[seed%3],b=palettes[(seed+1)%3];
  return {w:88,h:61,max:32,body:oneBox(2,0,78,29,a[0],a[1],id)+oneBox(10,-29,62,25,b[0],b[1],id)};
}
function leaf(x,y,angle,size,colour){return `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${size})"><path d="M0 0C-10 -3 -13 -15 -9 -23C1 -20 7 -8 0 0Z" fill="${colour}"/><path d="M-.6 -1Q-5 -10 -8 -20" fill="none" stroke="#c2c9a0" stroke-opacity=".54" stroke-width=".8"/></g>`;}
function plant(seed,id){
  const tone=seed%2?'clay':'porcelain',greens=['#48634e','#657e5c','#7e9069','#385a48','#91a17d'];
  const leafy=`<g stroke="#516b4d" stroke-width="1.45" fill="none" stroke-linecap="round"><path d="M43 -26Q44 -48 37 -73M43 -27Q48 -47 61 -62M42 -27Q36 -43 22 -51M44 -29Q49 -55 47 -79"/></g>${[[40,-55,-62,.86],[38,-66,12,.8],[45,-52,65,.98],[48,-70,35,.78],[58,-58,88,.73],[53,-50,47,.8],[28,-47,-68,.80],[23,-50,-27,.84],[42,-44,-82,.75],[47,-72,-4,.62]].map((v,i)=>leaf(...v,greens[(seed+i)%greens.length])).join('')}`;
  const pot=`<path d="M24 -29Q42 -32 61 -29L56 -5Q55 -.4 43 0Q29 -.3 28 -5Z" fill="url(#${id}-${tone})"/><ellipse cx="42.5" cy="-29" rx="18.5" ry="3.4" fill="#d6c3a1"/><ellipse cx="42.5" cy="-29.4" rx="15.9" ry="2.2" fill="#685c46"/><path d="M24.5 -27Q42 -22.8 60 -27" fill="none" stroke="#f6e6c7" stroke-opacity=".49" stroke-width="1.15"/><path d="M29 -23l3 15" fill="none" stroke="#f5dec1" stroke-opacity=".31" stroke-width="1.6"/>`;
  return {w:88,h:97,max:42,body:`${pot}${leafy}`};
}
function vase(seed,id){
  const tone=['glaze','clay','porcelain'][seed%3];
  const wide=`<path d="M26 -68Q36 -70 46 -68L45 -52Q46 -48 53 -42C69 -29 62 -7 50 -2Q37 2 24 -2C10 -8 7 -29 21 -42Q28 -49 28 -53Z" fill="url(#${id}-${tone})"/><ellipse cx="36" cy="-68" rx="10.1" ry="2.2" fill="#c9c4af"/><ellipse cx="36" cy="-68.3" rx="7.2" ry="1.05" fill="#645f51"/><path d="M24 -40Q14 -29 20 -17" fill="none" stroke="#fcf1d5" stroke-opacity=".33" stroke-linecap="round" stroke-width="2.4"/><path d="M23 -4q13 5 28 .2" stroke="#514d41" stroke-opacity=".24" fill="none" stroke-width="1.2"/>`;
  const bowl=`<path d="M58 -13Q74 -16 88 -13Q86 -2 75 -.8Q62 -.7 58 -13Z" fill="url(#${id}-porcelain)"/><ellipse cx="73" cy="-13" rx="15" ry="2.6" fill="#b9ae93"/><ellipse cx="73" cy="-13.4" rx="12.8" ry="1.2" fill="#9b927b"/>`;
  return {w:90,h:72,max:36,body:wide+bowl};
}
const keyToken=key=>String(key).replace(/[^0-9a-z_-]/gi,'-');
const artId=(id,key)=>`${id}-art-${keyToken(key)}`;
function ornament(kind,r,seed,id){
  if(!kind||kind==='empty')return '';
  const draw={books,boxes,plant,vase}[kind];if(!draw)return '';
  const obj=draw(seed,id),margin=Math.max(.7,Math.min(r.w,r.h)*.045),width=r.w-margin*2,height=r.h-margin*2;
  const s=Math.max(0,Math.min(width/obj.w,height/obj.h,obj.max/obj.h));
  const horizontal=[.25,.55,.70,.38,.62][seed%5],tx=r.x+margin+(width-obj.w*s)*horizontal,ty=r.y+r.h-Math.min(.65,margin*.7);
  return `<g data-shc-art-slot="${attr(r.key)}"><g id="${artId(id,r.key)}" transform="translate(${n(tx)} ${n(ty)}) scale(${n(s)})" data-content-art="${kind}" aria-hidden="true"><ellipse cx="${n(obj.w*.50)}" cy="-.25" rx="${n(obj.w*.46)}" ry="2.2" fill="#322b21" opacity=".17" pointer-events="none"/>${obj.body}</g></g>`;
}

// Rendering, hit testing, previews and exports consume the SAME wall-space
// geometry. A wall planning line is never a physical shelf board.
const geometryCache=new WeakMap();
function sceneGeometry(plan){
  let geo=geometryCache.get(plan);if(geo)return geo;
  const dividers=scopedDividers(plan);geo={cells:scopedCells(plan),zones:wallZones(plan),dividers,boards:dividers.filter(d=>d.kind==='cabinet'),lines:dividers.filter(d=>d.kind==='wall')};geometryCache.set(plan,geo);return geo;
}
const sameTarget=(a,b)=>!!a&&!!b&&a.kind===b.kind&&(!['cell','zone'].includes(a.kind)||a.key===b.key);
const asTarget=v=>v?.key!==undefined&&['cell','zone'].includes(v.kind)?{kind:v.kind,key:v.key}:{kind:v?.kind||'cabinet'};
const inRect=(p,r)=>!!r&&p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
// Point selection is independent of the previously selected scope. Ink hit
// testing reflects paint order: wooden boards/frame/leaf in the cabinet;
// planning lines are selectable only on their exposed parts of the wall.
const coarsePointer=()=>typeof matchMedia!=='undefined'&&matchMedia('(pointer:coarse)').matches;
const parallelAt=(d,p)=>d.axis==='col'?p.y:p.x;
const crossDistance=(d,p)=>Math.abs((d.axis==='col'?p.x:p.y)-d.cm);
const physicalHalf=d=>(d.axis==='col'?d.w:d.h)/2;
const onSegment=(reach,at)=>reach?.segments.some(s=>at>=s.start-1e-7&&at<=s.end+1e-7);
// At phone sizes a board can be less than one CSS pixel across. Keep its
// assistance smaller than one fifth of even the minimum legal clear cell.
const bodyHalf=(d,pix,coarse)=>Math.max(physicalHalf(d),Math.min((coarse?4.5:3)*pix,physicalHalf(d)+SHELF_LIMITS.minInterior*.18));
const groupKeys=st=>Array.isArray(st.multiKeys)?st.multiKeys:st.multiKeys instanceof Set?[...st.multiKeys]:[];
const grouped=st=>groupKeys(st).length>=2;
const memberAt=(st,hit)=>hit&&!hit.dividerId&&hit.target.kind==='cell'&&groupKeys(st).includes(hit.target.key)?hit.target.key:null;
const sameMembers=(st,keys)=>keys.length===groupKeys(st).length&&keys.every(key=>groupKeys(st).includes(key));
const adaptiveShape=g=>g?.kind==='group-transform'||g?.kind==='group-reframe';
const sharedDrag=g=>g?.kind==='divider'&&g.via==='shared-selection';
const groupOperation=g=>adaptiveShape(g)||sharedDrag(g);
const noOwner=st=>grouped(st)||(st.tool==='select'&&st.noSelection===true);
const sharedView=(st,g)=>noOwner(st)||(g?.kind==='marquee'&&g.moved);
const guardedGesture=g=>g?.kind==='equal'||g?.kind==='marquee'||g?.kind==='delete'||g?.kind==='group-insert'||groupOperation(g);
const canShare=st=>grouped(st)&&(st.tool==='move'||st.tool==='select');
const hoverFeedback=st=>['point-insert','move','delete'].includes(st.tool)||canShare(st);
function sharedGrips(r,d,pix,coarse){
  return r.segments.map(seg=>{
    // Pick the middle of a real face-to-face contact, not an intersection
    // with a perpendicular shelf (nor the middle of the whole cabinet).
    let lo=seg.start,hi=seg.end,best=0;
    for(const c of r.contacts){const a=Math.max(c.start,seg.start),b=Math.min(c.end,seg.end);if(b-a>best){best=b-a;lo=a;hi=b;}}
    const span=hi-lo,mid=(lo+hi)/2,long=Math.min(8.3*pix,span*.32),half=Math.min(2.85*pix,physicalHalf(d)+1),
      pad=Math.min((coarse?12:6.5)*pix,physicalHalf(d)+SHELF_LIMITS.minInterior*.29),along=Math.min(span*.47,Math.max(long,(coarse?15:11)*pix));
    return {seg,mid,long,half,pad,along};
  });
}
function sharedWidgets(plan,geo,st,pix,coarse,pad){
  if(!canShare(st))return '';
  return groupSharedDividers(plan,groupKeys(st)).map(r=>{
    const d=geo.boards.find(b=>b.id===r.id);if(!d)return '';const v=d.axis==='col';
    return sharedGrips(r,d,pix,coarse).map(({seg,mid,long,half,pad:side,along})=>{
      const x=v?d.cm:mid,y=v?mid:d.cm,id=attr(d.id),data=`data-axis="${d.axis}" data-reach-start="${n(seg.start)}" data-reach-end="${n(seg.end)}" data-grip-at="${n(mid)}"`;
      if(pad)return rect(x-(v?side:along),y-(v?along:side),2*(v?side:along),2*(v?along:side),'transparent',`data-shelf-group-shared-pad="${id}" ${data} pointer-events="all"`);
      const title=v?'اسحب لضبط الفاصل الرأسي بين الخانات المحدّدة':'اسحب لضبط الرف بين الخانات المحدّدة';
      const ticks=[-.38,0,.38].map(k=>v?`M${n(-half*.54)} ${n(k*long*1.38)}h${n(half*1.08)}`:`M${n(k*long*1.38)} ${n(-half*.54)}v${n(half*1.08)}`).join('');
      return `<g data-shelf-group-shared-grip="${id}" ${data} transform="${transform(x,y)}" pointer-events="all" aria-label="${title}"><title>${title}</title>${rect(-(v?half:long),-(v?long:half),2*(v?half:long),2*(v?long:half),'#975323',`rx="${n(Math.min(half,2.5*pix))}" stroke="#fff8da" stroke-width="${n(.95*pix)}"`)}<path d="${ticks}" fill="none" stroke="#fff8da" stroke-width="${n(.9*pix)}"/></g>`;
    }).join('');
  }).join('');
}
function pointHit(plan,p,geo,pix,ev,state={}){
  if(!p||!inRect(p,{x:0,y:0,...plan.wall}))return null;
  const near=sel=>ev?.target?.closest?.(sel),inside=inRect(p,plan.cab),t=scope(plan,state),coarse=coarsePointer();
  const ds=inside?geo.boards:geo.lines,picked=d=>({target:asTarget(d.owner),dividerId:d.id});
  if(inside){
    const c=plan.cab,f=SHELF_LIMITS.frame,inner={x:c.x+f,y:c.y+f,w:c.w-2*f,h:c.h-2*f};
    if(!inRect(p,inner)||near('[data-shelf-frame]'))return {target:{kind:'cabinet'}};
  }
  const actual=d=>{
    const at=parallelAt(d,p),lo=d.axis==='col'?d.y:d.x,hi=lo+(d.axis==='col'?d.h:d.w);
    // Check the ink itself, not just a nearby mouse inside its hit halo.
    if(d.kind==='wall'&&inRect(d.axis==='col'?{x:d.cm,y:p.y}:{x:p.x,y:d.cm},plan.cab))return false;
    return at>=lo&&at<=hi&&crossDistance(d,p)<=(inside?physicalHalf(d):Math.min(2.5*pix,bodyHalf(d,pix,coarse)))+1e-7;
  };
  if(inside&&canShare(state)){
    // Only the compact grip gets additional hit pixels. The rest of each
    // selected opening stays a group move or a marquee right up to the wood.
    const ink=near('[data-shelf-group-shared-grip]'),pad=near('[data-shelf-group-shared-pad]'),gid=ink?.dataset.shelfGroupSharedGrip||pad?.dataset.shelfGroupSharedPad;
    const d=gid&&ds.find(b=>b.id===gid),reach=d&&sharedSelectionReach(plan,groupKeys(state),d),at=d&&parallelAt(d,p);
    const marker=reach&&onSegment(reach,at)&&sharedGrips(reach,d,pix,coarse).some(g=>Math.abs(g.mid-at)<=(ink?g.long:g.along)+1e-7&&crossDistance(d,p)<=(ink?g.half:g.pad)+1e-7);
    if(marker&&ink)return picked(d);
    let winner=null,min=Infinity;const material=near('[data-shelf-material-divider]')?.dataset.shelfMaterialDivider;
    for(const b of ds){if(!actual(b))continue;const shared=sharedSelectionReach(plan,groupKeys(state),b);if(!onSegment(shared,parallelAt(b,p)))continue;
      const delta=crossDistance(b,p);if(!winner||delta<min||b.id===material&&delta===min){winner=b;min=delta;}}
    if(winner)return picked(winner);
    if(marker&&pad&&!ds.some(actual)&&!paintedCell(ev,p,geo))return picked(d);
  }
  const selectedHint=near('[data-shelf-selected-hit]')?.dataset.shelfSelectedHit;
  const selected=ds.find(d=>d.id===state.selectedDividerId&&(state.tool==='point-insert'||sameTarget(d.owner,t))&&actual(d));
  // The exact selected material wins at its intersections, even when a
  // different grip was last painted on top. A stale DOM hint cannot win.
  if(!noOwner(state)&&isDirect(state.tool)&&selected)return picked(selected);
  const gripId=near('[data-shelf-quick-grip]')?.dataset.shelfQuickGrip||near('[data-scoped-grip]')?.dataset.scopedGrip;
  const grip=gripId&&ds.find(d=>d.id===gripId),gr=grip&&dividerReach(plan,t,grip);
  if(!noOwner(state)&&isPicker(state.tool)&&gr&&onSegment(gr,parallelAt(grip,p))&&insideGrip(grip,geo,t,gr,p,pix,coarse,isDirect(state.tool)))return picked(grip);
  const targetId=near('[data-shelf-material-divider]')?.dataset.shelfMaterialDivider||selectedHint;
  const exact=ds.find(d=>d.id===targetId&&actual(d));if(exact)return picked(exact);
  let ink=null,min=Infinity;for(let i=ds.length-1;i>=0;i--){const d=ds[i],delta=crossDistance(d,p);if(actual(d)&&delta<min){ink=d;min=delta;}}
  if(ink)return picked(ink);
  const art=near('[data-shelf-art-key]')||ev?.composedPath?.().some(node=>node?.dataset?.shelfArtKey);
  if(!art&&!noOwner(state)&&isPicker(state.tool)){
    const hinted=near('[data-shelf-direct-divider]')?.dataset.shelfDirectDivider;
    let candidate=null,min=Infinity;for(const d of ds){const delta=crossDistance(d,p);if(delta>bodyHalf(d,pix,coarse))continue;
      if(!onSegment(dividerReach(plan,t,d),parallelAt(d,p)))continue;
      if(delta<min||(Math.abs(delta-min)<1e-7&&d.id===hinted)){candidate=d;min=delta;}}
    if(candidate)return picked(candidate);
  }
  if(inside){const cell=geo.cells.find(r=>inRect(p,r));return {target:cell?{kind:'cell',key:cell.key}:{kind:'cabinet'}};}
  const z=near('[data-shelf-wall]')?null:geo.zones.find(r=>inRect(p,r));return {target:z?{kind:'zone',key:z.key}:{kind:'wall'}};
}
// SVG <use> points to the same paths, transformations and cell clip as the
// painted ornament. Neither a non-empty model cell nor its bounding box is an
// artwork hit: the browser must actually have picked one of its painted paths.
function paintedCell(ev,p,geo){
  const el=ev?.target?.closest?.('[data-shelf-art-key]')||ev?.target?.correspondingUseElement?.closest?.('[data-shelf-art-key]')||ev?.composedPath?.().find(node=>node?.dataset?.shelfArtKey);
  return el&&geo.cells.find(r=>r.key===el.dataset.shelfArtKey&&r.content!=='empty'&&inRect(p,r));
}
function removalCue(plan,geo,hit,id,pix){
  if(!hit)return '';if(hit.screen){const r=inspectSizedScreen(plan)?.rect;return r?rect(r.x,r.y,r.w,r.h,'#bb3637',`data-delete-screen="" rx="${n(Math.min(r.w,r.h)*.025)}" fill-opacity=".32" stroke="#b33c36" stroke-width="${n(1.6*pix)}"`):'';}const d=hit.dividerId&&geo.dividers.find(r=>r.id===hit.dividerId);
  if(d){const v=d.axis==='col',ink='#b13c33';
    const path=d.kind==='cabinet'?rect(d.x,d.y,d.w,d.h,ink,`fill-opacity=".42" stroke="${ink}" stroke-width="${n(pix)}"`):
      (dividerReach(plan,d.owner,d)?.segments||[]).map(r=>`<path d="M${n(v?d.cm:r.start)} ${n(v?r.start:d.cm)}${v?'v':'h'}${n(r.end-r.start)}" fill="none" stroke="${ink}" stroke-width="${n(3*pix)}"/>`).join('');
    return `<g data-delete-divider="${attr(d.id)}">${path}</g>`;
  }
  const r=geo.cells.find(c=>c.key===hit.cellKey);if(!r)return '';
  const fid=id+'-delete-ink';return `<g data-delete-content="${attr(r.key)}" transform="${transform(plan.cab.x,plan.cab.y)}"><defs><filter id="${fid}" x="-5%" y="-5%" width="110%" height="110%"><feFlood flood-color="#bd3739" flood-opacity=".82"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs><g clip-path="url(#${id}-cell-${keyToken(r.key)})"><use href="#${artId(id,r.key)}" filter="url(#${fid})"/></g></g>`;
}
function scope(plan,state){const fallback=state.selected??plan.selectedCell;return targetInfo(plan,state.target|| (fallback?{kind:'cell',key:fallback}:{kind:'cabinet'}))||targetInfo(plan,{kind:'cabinet'});}
function cabinetArt(plan,id,geo=sceneGeometry(plan)){
  const {w,h,x:cx,y:cy}=plan.cab,f=fOf(plan),th=SHELF_LIMITS.frame;
  let cells='',clips='';for(const r0 of geo.cells){
    const r={...r0,x:r0.x-cx,y:r0.y-cy},x=r.x,y=r.y,rr=x+r.w,bb=y+r.h,d=Math.min(2.6,r.w*.06,r.h*.065),key=`${id}-cell-${keyToken(r.key)}`;
    const finish=leafFinish(plan,r0),lining=finishes[finish]||f;
    const variant=[...r.key.slice(`${r.col}:${r.row}`.length)].reduce((score,ch)=>(score*3+ch.charCodeAt(0))%101,0);
    clips+=`<clipPath id="${key}" clipPathUnits="userSpaceOnUse">${rect(x,y,r.w,r.h,'white')}</clipPath>`;
    cells+=`<g data-finish-cell="${attr(r.key)}" data-shelf-leaf-finish="${attr(finish)}" clip-path="url(#${key})">${rect(x,y,r.w,r.h,`url(#${id}-back-${finish})`)}${rect(x,y,r.w,r.h,`url(#${id}-lining-${finish})`,'opacity=".44"')}
      <path d="M${n(x)} ${n(y)}L${n(x+d)} ${n(y+d)}V${n(bb-d*.65)}L${n(x)} ${n(bb)}Z" fill="${lining.side}" opacity=".73"/><path d="M${n(rr)} ${n(y)}L${n(rr-d)} ${n(y+d)}V${n(bb-d*.65)}L${n(rr)} ${n(bb)}Z" fill="${lining.edge}" opacity=".47"/>
      <path d="M${n(x)} ${n(y)}H${n(rr)}L${n(rr-d)} ${n(y+d)}H${n(x+d)}Z" fill="${lining.side}" opacity=".79"/><path d="M${n(x)} ${n(bb)}L${n(x+d)} ${n(bb-d*.65)}H${n(rr-d)}L${n(rr)} ${n(bb)}Z" fill="${lining.top}" opacity=".9"/>
      ${rect(x,y,r.w,Math.min(r.h*.3,11),`url(#${id}-shade)`)}${ornament(r.content,r,(r.col*17+r.row*31+7+variant)%101,id)}</g>`;
  }
  const vBoard=(x,y,w,h)=>rect(x,y,w,h,`url(#${id}-vertical)`)+rect(x,y,w,h,`url(#${id}-grain-v)`);
  const hBoard=(x,y,w,h)=>rect(x,y,w,h,`url(#${id}-face)`)+rect(x,y,w,h,`url(#${id}-grain-h)`)+`<path d="M${n(x)} ${n(y+.16)}h${n(w)}" stroke="${f.light}" stroke-width=".25"/>`;
  const inner=geo.boards.map(b=>`<g data-shelf-material-divider="${attr(b.id)}" data-board-scope="${attr(b.owner.kind)}" data-board-length="${n(b.axis==='col'?b.h:b.w)}">${(b.axis==='col'?vBoard:hBoard)(b.x-cx,b.y-cy,b.w,b.h)}</g>`).join('');
  return `<defs>${clips}</defs>${rect(1.5,2.3,w,h,'#30291e',`opacity=".32" filter="url(#${id}-drop)"`)}${rect(0,0,w,h,f.edge)}${cells}${inner}<g data-shelf-frame="">${vBoard(0,0,th,h)}${vBoard(w-th,0,th,h)}${hBoard(0,0,w,th)}${hBoard(0,h-th,w,th)}</g><rect x="0" y="0" width="${n(w)}" height="${n(h)}" fill="none" stroke="${f.edge}" stroke-width=".32"/>`;
}

function groundShadow(plan,id){
  const c=plan.cab,gap=plan.wall.h-c.y-c.h,opacity=.21*Math.max(0,1-gap/65);
  return opacity>0?`<ellipse cx="${n(c.x+c.w*.51)}" cy="${n(plan.wall.h+1.2)}" rx="${n(c.w*.51)}" ry="${n(clamp(c.w*.017,1,4))}" fill="#534334" opacity="${n(opacity)}" filter="url(#${id}-ground-blur)"/>`:'';
}

const rasterData=u=>typeof u==='string'&&/^data:image\/(?:png|jpeg|jpg|webp|gif|bmp|avif);base64,/i.test(u);
const localPhoto=u=>{if(rasterData(u))return u;if(typeof u!=='string'||!u.startsWith('blob:'))return null;try{return new URL(u).origin===location.origin?u:null;}catch{return null;}};
// A and B share one wall, photograph, origin, and scale, in centimetres.
export function comparisonArtwork(a,b,photo){
  const id='shelf-compare',left=id+'-a',right=id+'-b',w=b.wall.w,h=b.wall.h,total=h+floorHeight(b);
  const adjusted={...a,wall:b.wall,cab:{...a.cab,y:b.wall.h-a.wall.h+a.cab.y}};
  const scene=(p,name)=>groundShadow(p,name)+'<g transform="'+transform(p.cab.x,p.cab.y)+'">'+cabinetArt(p,name)+'</g>'+renderSizedScreen(p,{preview:true});
  const layer=(name,p,from,to)=>'<clipPath id="'+id+'-clip-'+name+'"><rect data-compare-clip="'+name+'" x="'+n(from)+'" y="0" width="'+n(to-from)+'" height="'+n(total)+'"/></clipPath><g clip-path="url(#'+id+'-clip-'+name+')">'+scene(p,name==='a'?left:right)+'</g>';
  return {w,total,svg:'<svg xmlns="'+NS+'" viewBox="0 0 '+n(w)+' '+n(total)+'" role="img" aria-label="الخيار المحفوظ يسار خط المقارنة والتصميم الحالي يمينه"><defs>'+defs(adjusted,left)+defs(b,right)+'</defs>'+wallScene(b,right,localPhoto(photo))+layer('a',adjusted,0,w/2)+layer('b',b,w/2,w)+'</svg>'};
}
function cleanSvg(plan,id,photo){
  const {w,h}=plan.wall,total=h+floorHeight(plan),scale=Math.min(1600/w,1500/total);
  return `<svg xmlns="${NS}" width="${Math.round(w*scale)}" height="${Math.round(total*scale)}" viewBox="0 0 ${n(w)} ${n(total)}" preserveAspectRatio="xMidYMid meet" role="img"><title>مخطط الرفوف — معاينة أمامية</title><desc>جدار ${cm(w)} × ${cm(h)}. دولاب ${cm(plan.cab.w)} × ${cm(plan.cab.h)}، تشطيب ${fOf(plan).name}.</desc><defs>${defs(plan,id)}</defs>${wallScene(plan,id,photo)}${groundShadow(plan,id)}<g transform="${transform(plan.cab.x,plan.cab.y)}">${cabinetArt(plan,id)}</g>${renderSizedScreen(plan,{preview:true})}</svg>`;
}

function dimension(x1,y1,x2,y2,text,pix,vertical=false){
  const mid={x:(x1+x2)/2,y:(y1+y2)/2},q=3.3*pix,fs=11*pix;
  // Opaque tag keeps numerals readable over a photograph or a wood finish.
  const labelWidth=(text.length*6.4+9)*pix,labelHeight=16*pix;
  const ends=vertical?`M${n(x1-q)} ${n(y1)}h${n(q*2)}M${n(x2-q)} ${n(y2)}h${n(q*2)}`:`M${n(x1)} ${n(y1-q)}v${n(q*2)}M${n(x2)} ${n(y2-q)}v${n(q*2)}`;
  return `<g pointer-events="none" data-shelf-dimension="${vertical?'height':'width'}"><path d="M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}${ends}" fill="none" stroke="#3a6557" stroke-width="${n(.95*pix)}"/><g transform="${transform(mid.x,mid.y)}${vertical?' rotate(-90)':''}">${rect(-labelWidth/2,-labelHeight/2,labelWidth,labelHeight,'#faf8ef',`rx="${n(2.3*pix)}" opacity=".97"`)}<text x="0" y="0" text-anchor="middle" dominant-baseline="central" direction="rtl" font-size="${n(fs)}" font-family="Tahoma,Arial,sans-serif" fill="#244f42">${attr(text)}</text></g></g>`;
}
function scopeCaption(t){return t.kind==='wall'?'الجدار كاملًا':t.kind==='cabinet'?'الدولاب كاملًا':t.kind==='zone'?(t.leaf?'منطقة الجدار':'مجموعة مناطق'):(t.leaf?'الخانة':'مجموعة الخانات');}
function highlight(t,pix,hideCaption=false){
  if(!t)return '';const zone=t.kind==='wall'||t.kind==='zone',colour=zone?'#386b84':t.kind==='cabinet'?'#98603a':'#216b50';
  const label=scopeCaption(t),inner=1.25*pix,short=Math.min(t.w,t.h),inset=Math.min(inner,short*.05),labelW=(label.length*6.4+14)*pix,labelH=18*pix;
  return `<g pointer-events="none" data-shelf-active="${attr(t.kind)}" data-shelf-selection="${attr(t.key||t.kind)}">${rect(t.x+inset,t.y+inset,t.w-2*inset,t.h-2*inset,colour,`fill-opacity="${zone?.045:.065}" stroke="${colour}" stroke-width="${n(1.8*pix)}" ${zone?`stroke-dasharray="${n(7*pix)} ${n(3*pix)}"`:''}`)}${!hideCaption&&t.w>labelW+8*pix&&t.h>labelH+6*pix?`<g data-shelf-scope-caption="" transform="${transform(t.x+4*pix,t.y+4*pix)}"><text x="${n(labelW/2)}" y="${n(labelH/2)}" text-anchor="middle" dominant-baseline="central" direction="rtl" font-family="Tahoma,Arial,sans-serif" font-size="${n(10.5*pix)}" fill="#284a40" stroke="#fffcef" stroke-width="${n(2.4*pix)}" paint-order="stroke" stroke-linejoin="round">${label}</text></g>`:''}</g>`;
}
function groupDrawing(plan,geo,st,g,pix){
  if(st.preview)return '';
  const live=g?.kind==='marquee'&&g.moved?g.marquee:null,keys=live?.keys||(g?.fromGroupHandle&&g.moved?g.keys:groupKeys(st));
  if(!live&&keys.length<2)return '';
  const members=new Set(keys),line=live?'#206983':'#237458',fill=live?'#3fa7bd':'#4baf83';
  let html='';for(const c of geo.cells)if(members.has(c.key)){
    // Draw inside the clear opening; do not paint over shared wood edges.
    const inset=Math.min(1.35*pix,c.w*.08,c.h*.08);
    html+=rect(c.x+inset,c.y+inset,c.w-2*inset,c.h-2*inset,fill,`data-shelf-${live?'marquee':'group'}-cell="${attr(c.key)}" fill-opacity="${live?.23:.19}" stroke="${line}" stroke-width="${n(inset)}"`);
  }
  if(!live){
    const info=groupInfo(plan,keys),b=info.bounds;if(!info.ok||!b)return '';
    html+=rect(b.x,b.y,b.w,b.h,'none',`data-shelf-group-bounds="" data-group-x="${n(b.x)}" data-group-y="${n(b.y)}" data-group-width="${n(b.w)}" data-group-height="${n(b.h)}" stroke="#256749" stroke-width="${n(1.35*pix)}" stroke-dasharray="${n(6*pix)} ${n(4*pix)}"`);
    if(st.tool==='measure'&&st.showDims)html+=scopeDimensions({...b,kind:'group'},plan,pix);
    const affected=new Set(adaptiveShape(g)&&g.moved&&g.result?.ok?g.result.affectedKeys:[]);
    for(const c of geo.cells)if(affected.has(c.key)&&!members.has(c.key)){
      const inset=Math.min(1.6*pix,c.w*.09,c.h*.09);
      html+=rect(c.x+inset,c.y+inset,c.w-2*inset,c.h-2*inset,'#e8a14d',`data-shelf-group-affected="${attr(c.key)}" fill-opacity=".14" stroke="#935018" stroke-width="${n(1.45*pix)}" stroke-dasharray="${n(4*pix)} ${n(3*pix)}"`);
    }
  }
  if(g?.kind==='group-reframe'&&g.moved&&g.rect){
    const {x,y,w,h}=g.rect,valid=g.result?.ok===true,colour=valid?'#176885':'#ab4134';
    const mark=`data-shelf-group-reframe="${valid?'valid':'invalid'}" data-reframe-x="${n(x)}" data-reframe-y="${n(y)}" data-reframe-width="${n(w)}" data-reframe-height="${n(h)}" stroke="${colour}" stroke-width="${n(1.9*pix)}" stroke-dasharray="${n(6*pix)} ${n(3*pix)}"`;
    html+=w>0&&h>0?rect(x,y,w,h,colour,`${mark} fill-opacity=".06"`):`<path d="M${n(x)} ${n(y)}l${n(w)} ${n(h)}" fill="none" ${mark}/>`;
    if(st.showDims&&w>36*pix&&h>20*pix&&x>=0&&x+w<=plan.wall.w&&y>=0&&y+h<=plan.wall.h)html+=dimension(x,y+h*.5,x+w,y+h*.5,`${ar.format(w)} × ${cm(h)}`,pix);
  }
  if(sharedDrag(g)&&g.moved){
    const d=geo.boards.find(b=>b.id===g.dividerId);if(d)html+=rect(d.x,d.y,d.w,d.h,'#ac5c1d',`data-shelf-group-shared-active="${attr(d.id)}" data-axis="${d.axis}" fill-opacity=".62" stroke="#743a15" stroke-width="${n(.9*pix)}"`);
  }
  if(live?.rect){
    const {x,y,w,h}=live.rect,meta=`data-shelf-marquee="" data-marquee-count="${members.size}" data-marquee-x="${n(x)}" data-marquee-y="${n(y)}" data-marquee-width="${n(w)}" data-marquee-height="${n(h)}"`;
    const outline=`stroke="${line}" stroke-width="${n(1.55*pix)}" stroke-dasharray="${n(5*pix)} ${n(3*pix)}"`;
    html+=w>0&&h>0?rect(x,y,w,h,'#63b6cb',`${meta} fill-opacity=".07" ${outline}`):`<path ${meta} d="M${n(x)} ${n(y)}l${n(w)} ${n(h)}" fill="none" ${outline}/>`;
    const label=`الخانات: ${ar.format(members.size)}`,bw=(label.length*7.4+16)*pix,bh=21*pix;
    const cx=clamp(g.last.x+10*pix,0,Math.max(0,plan.wall.w-bw)),cy=clamp(g.last.y-29*pix,0,Math.max(0,plan.wall.h-bh));
    html+=`<g transform="${transform(cx,cy)}" data-shelf-marquee-count="${members.size}">${rect(0,0,bw,bh,line,`rx="${n(4*pix)}"`)}<text x="${n(bw/2)}" y="${n(bh/2)}" direction="rtl" text-anchor="middle" dominant-baseline="central" fill="#fff" font-family="Tahoma,Arial,sans-serif" font-size="${n(12*pix)}">${attr(label)}</text></g>`;
  }
  return `<g pointer-events="none" aria-label="${attr('عدد الخانات المحددة: '+ar.format(members.size))}">${html}</g>`;
}
// A nested owner and an explicit marquee are distinct selections. The handle
// snapshots the exact leaves it represents; the root revalidates them before
// committing. A label in other tools is just a caption, never a pretend grip.
function groupHandleFor(plan,st,geo,t){
  if(st.preview||st.placingContent||!['move','select','point-insert'].includes(st.tool))return null;
  const explicit=groupKeys(st);
  if(explicit.length>=2){const info=groupInfo(plan,explicit);return info.ok?{keys:[...info.keys],bounds:info.bounds,owner:null}:null;}
  if(st.noSelection||st.target?.kind!=='cell'||t?.kind!=='cell'||t.leaf||st.target.key!==t.key)return null;
  const keys=geo.cells.filter(c=>c.key.startsWith(t.key+'/')).map(c=>c.key);
  return keys.length>=2?{keys,bounds:t,owner:{kind:'cell',key:t.key}}:null;
}
function matchesGestureGroup(st,g){
  if(g.fromGroupHandle&&st.placingContent)return false;
  if(!g.handleOwner)return sameMembers(st,g.keys);
  if(grouped(st)||st.noSelection||st.placingContent||!sameTarget(st.target,g.handleOwner))return false;
  const current=sceneGeometry(st.plan).cells.filter(c=>c.key.startsWith(g.handleOwner.key+'/'));
  return current.length===g.keys.length&&current.every(c=>g.keys.includes(c.key));
}
// Only the actual drawn surface receives pointer events. The six dots are a
// grip texture; the independent arrow says whether to drag on one or two axes.
function dragHandle({x,y,w,h,pix,kind,attrs,label,title,axis,compact}){
  const group=kind==='group',ink=group?'#285641':'#24596b',pale=group?'#eef6ea':'#eff6f4',light='#fffdf3';
  const unit=Math.min(pix,h/20,w/29),cy=h/2,l=7.1*unit,r=w-8.1*unit;
  const dots=[-1,0,1].map(j=>[0,1].map(i=>`<circle cx="${n(l+i*3.35*unit)}" cy="${n(cy+j*3.75*unit)}" r="${n(1.02*unit)}"/>`).join('')).join('');
  const arrow=group?'M-5 0H5M-5 0l2-2m-2 2l2 2m8-2l-2-2m2 2l-2 2M0-5V5M0-5l-2 2m2-2l2 2m-2 8l-2-2m2 2l2-2':'M-5.1 0H5.1M-5.1 0l2.2-2.1m-2.2 2.1l2.2 2.1m8-2.1l-2.2-2.1m2.2 2.1l-2.2 2.1';
  return `<g ${attrs} data-shelf-drag-handle="${kind}" class="shc-labeled-grip" transform="${transform(x,y)}" role="group" aria-roledescription="مقبض سحب" aria-label="${attr(title)}" pointer-events="visiblePainted"><title>${attr(title)}</title>${rect(0,0,w,h,pale,`class="shc-grip-surface" rx="${n(4.4*unit)}" stroke="${ink}" stroke-width="${n(1.05*unit)}"`)}<path d="M${n(4*unit)} ${n(1.9*unit)}H${n(w-4*unit)}" stroke="${light}" stroke-width="${n(unit)}" pointer-events="none"/><g data-grip-dots="6" fill="${ink}" pointer-events="none">${dots}</g>${compact?'':`<text x="${n((l+5*unit+r-6*unit)/2)}" y="${n(cy)}" direction="rtl" text-anchor="middle" dominant-baseline="central" fill="${ink}" font-family="Tahoma,Arial,sans-serif" font-weight="600" font-size="${n(10.8*unit)}" pointer-events="none">${label}</text>`}<g data-grip-direction="${group?'move':axis}" transform="translate(${n(r)} ${n(cy)}) scale(${n(unit)})${!group&&axis==='row'?' rotate(90)':''}" fill="none" stroke="${ink}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.45" pointer-events="none"><path d="${arrow}"/></g></g>`;
}
function groupMoveHandle(plan,pix,handle){
  if(!handle)return '';const b=handle.bounds,wall=plan.wall,full=b.w>77*pix,w=Math.min((full?100:33)*pix,wall.w),h=Math.min(21*pix,wall.h),gap=3*pix;
  const x=clamp(b.x,0,Math.max(0,wall.w-w)),y=b.y>=h+gap?b.y-h-gap:b.y+b.h+h+gap<=wall.h?b.y+b.h+gap:clamp(b.y+b.h-h-gap,0,wall.h-h);
  return dragHandle({kind:'group',x,y,w,h,pix,compact:!full,attrs:`data-shelf-group-move="" data-group-handle-owner="${attr(handle.owner?.key||'')}" data-handle-count="${handle.keys.length}"`,label:'مجموعة خانات',title:`اسحب هذا المقبض لتحريك المجموعة أفقيًا ورأسيًا · عدد الخانات ${ar.format(handle.keys.length)}`});
}
function groupControls(plan,st,pix,coarse){
  const b=groupInfo(plan,groupKeys(st)).bounds;if(!b)return '';
  const radius=(coarse?16:11)*pix;
  if(st.tool==='move')return '';
  return [['nw',b.x,b.y],['ne',b.x+b.w,b.y],['sw',b.x,b.y+b.h],['se',b.x+b.w,b.y+b.h]].map(([corner,x,y])=>`<g data-shelf-group-handle="${corner}" class="shc-handle shc-${corner}" pointer-events="all" transform="${transform(x,y)}"><title>اسحب الزاوية لتغيير مقاسات المجموعة</title><circle r="${n(radius)}" fill="transparent"/>${rect(-4.5*pix,-4.5*pix,9*pix,9*pix,'#fffceb',`rx="${n(1.5*pix)}" stroke="#256749" stroke-width="${n(2*pix)}"`)}</g>`).join('');
}
function scopeDimensions(t,plan,pix){
  if(!t)return '';const {x,y,w,h}=t,gap=16*pix;
  if(w<35*pix||h<27*pix)return ''; // Exact values remain in the strip below the scope selector.
  const dy=t.kind==='wall'?-gap*.52:y>gap+5*pix?y-gap:y+h+gap<=plan.wall.h+floorHeight(plan)?y+h+gap:y+10*pix;
  const dx=t.kind==='wall'?plan.wall.w+gap*.53:x+w+gap<plan.wall.w?x+w+gap:x>gap?x-gap:x+w-10*pix;
  return dimension(x,dy,x+w,dy,cm(w),pix)+dimension(dx,y,dx,y+h,cm(h),pix,true);
}
const isDirect=tool=>tool==='select'||tool==='point-insert';
const isPicker=tool=>isDirect(tool)||tool==='structure';
const finitePoint=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const wallPoint=(p,wall)=>({x:clamp(p.x,0,wall.w),y:clamp(p.y,0,wall.h)});
function rulerDrawing(plan,ruler,pix,live=false,clipped=false){
  if(!finitePoint(ruler?.a)||!finitePoint(ruler?.b))return '';
  const {wall}=plan,a=wallPoint(ruler.a,wall),b=wallPoint(ruler.b,wall),d=Math.hypot(b.x-a.x,b.y-a.y),label=cm(d),colour='#215c79';
  const bw=(label.length*7.1+17)*pix,bh=20*pix;
  const cx=bw>=wall.w?wall.w/2:clamp((a.x+b.x)/2,bw/2,wall.w-bw/2),cy=clamp((a.y+b.y)/2-12*pix,bh/2,Math.max(bh/2,wall.h-bh/2));
  const line=`x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}"`;
  const dot=(p,key)=>`<circle data-ruler-end="${key}" cx="${n(p.x)}" cy="${n(p.y)}" r="${n(4.25*pix)}" fill="#fffdf7" stroke="${key==='b'&&clipped?'#a5662c':colour}" stroke-width="${n(1.8*pix)}"/>`;
  return `<g data-shelf-ruler="${live?'live':'saved'}" data-ruler-live="${live}" data-ruler-clipped="${clipped}" data-ruler-cm="${n(d)}" data-ruler-ax="${n(a.x)}" data-ruler-ay="${n(a.y)}" data-ruler-bx="${n(b.x)}" data-ruler-by="${n(b.y)}" pointer-events="none" role="img" aria-label="مسطرة: المسافة المستقيمة ${attr(label)}"><line ${line} stroke="#fffdf5" stroke-width="${n(4.5*pix)}"/><line data-shelf-ruler-line="" ${line} stroke="${colour}" stroke-width="${n(1.9*pix)}"/>${dot(a,'a')}${dot(b,'b')}<g transform="${transform(cx,cy)}">${rect(-bw/2,-bh/2,bw,bh,colour,`rx="${n(4*pix)}"`)}<text x="0" y="0" text-anchor="middle" dominant-baseline="central" direction="rtl" font-size="${n(12*pix)}" font-family="Tahoma,Arial,sans-serif" fill="#fffdf6">${attr(label)}</text></g></g>`;
}
function gripFor(d,geo,t,r){
  const v=d.axis==='col';let a=r.start,b=r.end;
  // For owned boards place the grip between perpendicular shelves. A boundary
  // grip is centred on the selected edge, never a sibling's piece of board.
  if(d.kind==='cabinet'&&r.relation==='owned'){
    const spans=geo.cells.map(c=>{const edge=v?c.x:c.y,far=edge+(v?c.w:c.h),lo=v?c.y:c.x,hi=lo+(v?c.h:c.w);
      return Math.min(Math.abs(d.cm-edge),Math.abs(d.cm-far))<=physicalHalf(d)+.01?[Math.max(a,lo),Math.min(b,hi)]:[0,0];
    }).filter(([x,y])=>y>x).sort((u,w)=>(w[1]-w[0])-(u[1]-u[0]));
    if(spans.length)[a,b]=spans[0];
  }
  return {x:v?d.cm:(a+b)/2,y:v?(a+b)/2:d.cm,span:b-a};
}
function gripMetrics(d,geo,t,r,pix,coarse,quick){
  const g=gripFor(d,geo,t,r),long=Math.min((quick?9.5:coarse?17:13)*pix,g.span*.28),
    hit=Math.min((quick?(coarse?9:6):coarse?14:10)*pix,Math.max(physicalHalf(d),SHELF_LIMITS.minInterior*.42)),
    along=Math.min(Math.max(long,hit),g.span*.49),short=Math.min((quick?3.1:3.4)*pix,hit);
  return {...g,long,hit,along,short};
}
function insideGrip(d,geo,t,r,p,pix,coarse,quick){
  const g=gripMetrics(d,geo,t,r,pix,coarse,quick);return Math.abs(parallelAt(d,p)-parallelAt(d,g))<=g.along+.01&&crossDistance(d,p)<=g.hit+.01;
}
function dividerControl(plan,d,geo,t,pix,drag,coarse,quick=false,part='both'){
  const r=dividerReach(plan,t,d);if(!r)return '';
  const v=d.axis==='col',wall=d.kind==='wall',half=bodyHalf(d,pix,coarse),axis=d.axis,id=attr(d.id);
  const attrs=`data-axis="${axis}" data-divider-scope="${d.owner.kind}" data-divider-relation="${r.relation}"`;
  const legacy=d.owner.kind==='cabinet'&&Number.isInteger(d.index)?`${axis}:${d.index}`:id,cls=`class="shc-divider shc-divider-${axis}"`;
  const title=`<title>${wall?'حدّ منطقة الجدار':v?'فاصل رأسي':'رف أفقي'} · ${r.relation==='boundary'?'حافة مشتركة مع التحديد':'داخل التحديد'} · اسحب لتغيير موضعه</title>`;
  let out='';if(part!=='grip')for(const seg of r.segments){
    const len=seg.end-seg.start,x=v?d.cm-half:seg.start,y=v?seg.start:d.cm-half,extra=`data-reach-start="${n(seg.start)}" data-reach-end="${n(seg.end)}"`;
    out+=`<g ${cls} ${attrs} ${extra} data-shelf-direct-divider="${id}" ${quick?'':`data-scoped-divider="${id}" data-shelf-divider="${attr(legacy)}"`} pointer-events="all">${title}${rect(x,y,v?half*2:len,v?len:half*2,'transparent')}</g>`;
  }
  if(part==='body')return out;
  const {x,y,long,short,hit,along}=gripMetrics(d,geo,t,r,pix,coarse,quick);
  const identify=quick?`data-shelf-quick-grip="${id}"`:`data-scoped-divider="${id}" data-scoped-grip="${id}" data-shelf-divider="${attr(legacy)}" data-shelf-divider-grip="${attr(legacy)}"`;
  return out+`<g ${cls} ${attrs} ${identify} data-reach-start="${n(r.start)}" data-reach-end="${n(r.end)}" data-shelf-hit="grip" pointer-events="all">${title}${rect(x-(v?hit:along),y-(v?along:hit),2*(v?hit:along),2*(v?along:hit),'transparent')}${rect(x-(v?short:long),y-(v?long:short),2*(v?short:long),2*(v?long:short),wall?'#edf4f6':'#fbf8ed',`rx="${n(2.5*pix)}" stroke="${wall?'#376d83':'#45674f'}" stroke-width="${n(pix)}"`)}<path d="${v?`M${n(x)} ${n(y-long*.58)}v${n(long*1.16)}`:`M${n(x-long*.58)} ${n(y)}h${n(long*1.16)}`}" stroke="${wall?'#376d83':'#45674f'}" stroke-width="${n(1.1*pix)}"/></g>`;
}
function selectedDividerMark(d,pix){
  if(!d)return '';const v=d.axis==='col',x1=v?d.cm:d.x,y1=v?d.y:d.cm,x2=x1+(v?0:d.w),y2=y1+(v?d.h:0),wall=d.kind==='wall';
  const xy=`x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"`,colour=wall?'#155f83':'#a44824';
  const handle=wall?`<line ${xy} fill="none" stroke="transparent" stroke-width="${n(5*pix)}" pointer-events="stroke"/>`:rect(d.x,d.y,d.w,d.h,'transparent','pointer-events="all"');
  return `<g data-shelf-selected-divider="${attr(d.id)}" data-axis="${d.axis}" data-point-divider="${attr(d.id)}" class="shc-selected-divider shc-divider-${d.axis}"><title>${wall?'حد الجدار المحدد':v?'الفاصل المحدد':'الرف المحدد'} · اسحب لتغيير موضعه</title><g pointer-events="none">${wall?'':rect(d.x,d.y,d.w,d.h,colour,'fill-opacity=".58"')}<line ${xy} stroke="#fff9eb" stroke-width="${n(3.8*pix)}"/><line ${xy} stroke="${colour}" stroke-width="${n(2.1*pix)}"/>${[[x1,y1],[x2,y2]].map(([x,y])=>`<circle cx="${n(x)}" cy="${n(y)}" r="${n(2.8*pix)}" fill="#fffdf6" stroke="${colour}" stroke-width="${n(1.4*pix)}"/>`).join('')}</g><g data-shelf-selected-hit="${attr(d.id)}">${handle}</g></g>`;
}
function zoneControls(plan,state,pix,drag,geo,t,coarse){
  if(state.preview)return '';const {w,h}=plan.wall,pick=isPicker(state.tool),showScope=drag?.kind!=='draw'&&!sharedView(state,drag),wallScope=t?.kind==='wall'||t?.kind==='zone';let s='';
  if(pick){if(geo.zones.length){for(const z of geo.zones)s+=rect(z.x,z.y,z.w,z.h,'transparent',`data-shelf-zone="${attr(z.key)}" data-shelf-hit="zone" pointer-events="all"`);}else s+=rect(0,0,w,h,'transparent','data-shelf-wall="" data-shelf-hit="wall" pointer-events="all"');}
  if(wallScope&&showScope)s+=highlight(t,pix);
  for(const d of geo.lines){const v=d.axis==='col',a=v?d.cm:d.x,b=v?d.y:d.cm,path=`M${n(a)} ${n(b)}${v?'v':'h'}${n(v?d.h:d.w)}`;
    s+=`<path d="${path}" data-zone-planning-line="${attr(d.id)}" fill="none" stroke="#396d85" stroke-opacity="${wallScope?.95:.62}" stroke-width="${n((wallScope?1.6:1.2)*pix)}" stroke-dasharray="${n(6*pix)} ${n(4*pix)}" pointer-events="none"/>`;
  }
  if(wallScope&&state.showDims&&showScope)s+=scopeDimensions(t,plan,pix);
  if(!sharedView(state,drag)&&isDirect(state.tool)&&state.selectedDividerId)s+=selectedDividerMark(geo.lines.find(d=>d.id===state.selectedDividerId&&(state.tool==='point-insert'||sameTarget(d.owner,t))),pix);
  if(!sharedView(state,drag)&&isPicker(state.tool))for(const d of geo.lines)s+=dividerControl(plan,d,geo,t,pix,drag,coarse,isDirect(state.tool));
  if(pick&&geo.zones.length)s+=rect(0,0,w,h,'none',`stroke="transparent" stroke-width="${n(5*pix)}" pointer-events="stroke" data-shelf-wall="" aria-label="اختيار الجدار كاملاً من حافته"`);
  return s;
}
function equalKeys(state,geo){
  const k=groupKeys(state);if(k.length>=2)return k;
  const selected=state.target?.kind==='cell'?state.target.key:state.selected||state.plan?.selectedCell;
  const key=[state.equalHint,selected,geo.cells[0]?.key].find(x=>x&&geo.cells.some(c=>c.key===x));
  return key?[key]:[];
}
function equalHandle(plan,state,pix,geo){
  if(state.preview||state.tool!=='point-insert')return '';
  const keys=equalKeys(state,geo),axis=state.placeAxis==='col'?'col':'row';
  const c=geo.cells.find(l=>l.key===(keys.includes(state.equalHint)?state.equalHint:keys[0]));if(!c)return '';
  const capacity=distributionCapacity(plan,keys,axis);
  // On tiny openings place a compact handle immediately outside the cabinet
  // instead of stretching an invisible catchment across neighbouring wood.
  const full=c.w>=78*pix&&c.h>=31*pix,inside=c.w>=39*pix&&c.h>=28*pix,wall=plan.wall;
  const w=Math.min((full?71:32)*pix,wall.w),h=Math.min(20*pix,wall.h),gap=3*pix;
  const x=clamp(inside?c.x+c.w-w-gap:plan.cab.x+plan.cab.w-w,0,Math.max(0,wall.w-w));
  const y=inside?c.y+gap:plan.cab.y>=h+gap?plan.cab.y-h-gap:clamp(plan.cab.y+plan.cab.h+gap,0,wall.h-h);
  return dragHandle({kind:'equal',axis,x,y,w,h,pix,compact:!full,attrs:`data-shelf-equal-handle="${attr(c.key)}" data-axis="${axis}" data-max-openings="${capacity}"`,label:'توزيع',title:`اسحب ${axis==='col'?'أفقيًا':'رأسيًا'} لتوزيع الفتحات بالتساوي؛ ارجع لتقليل العدد. أقصى عدد: ${ar.format(capacity)}.`});

}
function layoutFeedback(guide,g,pix){
  if(g?.kind==='equal'&&g.equal){
    const e=g.equal,lines=e.ok?e.lines.map(l=>`<line data-shelf-equal-line="${attr(l.owner?.key||'')}" x1="${n(l.x1)}" y1="${n(l.y1)}" x2="${n(l.x2)}" y2="${n(l.y2)}" stroke="#19745b" stroke-width="${n(2.3*pix)}"/>`).join(''):'';
    return `<g data-shelf-equal-preview="${e.ok?'valid':'invalid'}" data-count="${e.count}" data-boards="${e.boards}">${lines}</g>`;
  }
  if(!guide)return '';const v=guide.axis==='col',xy=v?`x1="${n(guide.cm)}" y1="${n(guide.from)}" x2="${n(guide.cm)}" y2="${n(guide.to)}"`:`x1="${n(guide.from)}" y1="${n(guide.cm)}" x2="${n(guide.to)}" y2="${n(guide.cm)}"`;
  return `<g data-shelf-align-guide="${attr(guide.reference)}" data-axis="${guide.axis}" data-cm="${n(guide.cm)}"><line ${xy} stroke="#fff9ec" stroke-width="${n(3.4*pix)}" stroke-opacity=".8"/><line ${xy} stroke="#934478" stroke-width="${n(1.65*pix)}" stroke-dasharray="${n(6*pix)} ${n(3*pix)}"/></g>`;
}
function equalNotice(e){
  if(!e.ok)return e.reason;
  const heights=e.openings.map(o=>o.clear),lo=Math.min(...heights),hi=Math.max(...heights),val=Math.abs(hi-lo)<.001?cm(lo):ar.format(lo)+'–'+cm(hi);
  return `الفتحات في كل خانة: ${ar.format(e.count)} · الألواح الجديدة إجمالًا: ${ar.format(e.boards)} · ${e.axis==='row'?'الارتفاع':'العرض'} الصافي: ${val}.`;
}
function controls(plan,state,pix,drag,geo,t,coarse,id){
  if(state.preview)return '';const c=plan.cab,{x,y,w,h}=c,tool=state.tool||'select',hit=(coarse?22:13)*pix,stroke=1.25*pix;let s='';
  const groupGrip=groupHandleFor(plan,state,geo,t);
  if(isPicker(tool))for(const r of geo.cells)s+=rect(r.x,r.y,r.w,r.h,'transparent',`data-shelf-cell="${attr(r.key)}" data-shelf-hit="cell" pointer-events="all"`);
  if(!sharedView(state,drag)&&isDirect(tool))for(const d of geo.boards)s+=dividerControl(plan,d,geo,t,pix,drag,coarse,true,'body');
  if(canShare(state)&&!drag?.moved)s+=sharedWidgets(plan,geo,state,pix,coarse,true);
  // Use the actual painted book spines/leaves/vase/etc. for the art hit, not
  // the ornament bounds or a transparent hit covering its entire compartment.
  // Referencing the rendered paths preserves the original transform and clip.
  if(!state.view3d&&(isDirect(tool)||tool==='move'||tool==='delete'))s+=`<g transform="${transform(x,y)}" data-shc-art-picks="">${geo.cells.filter(r=>r.content!=='empty').map(r=>`<g clip-path="url(#${id}-cell-${keyToken(r.key)})"><use href="#${artId(id,r.key)}" data-shelf-art-key="${attr(r.key)}" data-art-kind="${attr(r.content)}" opacity="0" pointer-events="visiblePainted"><title>${tool==='delete'?'انقر لحذف هذه القطعة':'اسحب القطعة لنقلها إلى خانة أخرى'}</title></use></g>`).join('')}</g>`;
  if(tool==='draw'){
    if(grouped(state))return s; // Only the group's envelope belongs to this tool while a group is selected.
    if(drag?.kind==='draw'&&drag.evaluation?.rect){const r=drag.evaluation.rect,colour=drag.evaluation.ok?'#297458':'#ab5549';s+=rect(r.x,r.y,r.w,r.h,colour,`fill-opacity=".09" stroke="${colour}" stroke-width="${n(1.8*pix)}" stroke-dasharray="${n(6*pix)} ${n(3*pix)}" data-shelf-draw-preview="${drag.evaluation.ok?'valid':'small'}" pointer-events="none"`);if(state.showDims&&r.w>28*pix&&r.h>18*pix)s+=dimension(r.x,r.y+r.h*.5,r.x+r.w,r.y+r.h*.5,`${ar.format(r.w)} × ${cm(r.h)}`,pix);return s;}
    s+=rect(x,y,w,h,'none',`stroke="#527a65" stroke-opacity=".55" stroke-width="${n(stroke)}" stroke-dasharray="${n(5*pix)} ${n(4*pix)}" pointer-events="none"`);
  }
  if(!sharedView(state,drag)&&t&&['cabinet','cell'].includes(t.kind)){s+=highlight(t,pix,!!groupGrip);if(state.showDims)s+=scopeDimensions(t,plan,pix);}
  if(tool==='measure')return state.view3d?s:s+rulerDrawing(plan,drag?.kind==='measure'?drag.ruler:state.ruler,pix,drag?.kind==='measure',!!drag?.clipped);
  if(tool==='structure'){for(const d of geo.boards)s+=dividerControl(plan,d,geo,t,pix,drag,coarse);return s;}
  if(!sharedView(state,drag)&&isDirect(tool)&&state.selectedDividerId)s+=selectedDividerMark(geo.boards.find(d=>d.id===state.selectedDividerId&&(state.tool==='point-insert'||sameTarget(d.owner,t))),pix);
  if(canShare(state)&&!drag?.moved)s+=sharedWidgets(plan,geo,state,pix,coarse,false);
  if(isDirect(tool)){s+=groupMoveHandle(plan,pix,groupGrip);if(!sharedView(state,drag))for(const d of geo.boards)s+=dividerControl(plan,d,geo,t,pix,drag,coarse,true,'grip');return s+equalHandle(plan,state,pix,geo);}
  if(tool==='move'&&groupGrip)return s+groupMoveHandle(plan,pix,groupGrip);
  if(grouped(state)&&(tool==='move'||tool==='resize'))return s+groupControls(plan,state,pix,coarse);
  if(tool==='move'){
  const mx=x+w/2,my=y,gw=Math.min(w*.20,17*pix),gh=5.1*pix;
  s+=`<g class="shc-move" data-shelf-move="" data-shelf-hit="move" pointer-events="all"><title>اسحب لتحريك الدولاب</title>${rect(mx-Math.max(gw,hit),my-hit,2*Math.max(gw,hit),hit+Math.min(SHELF_LIMITS.frame,gh),'transparent')}${rect(mx-gw,my-gh,gw*2,gh*2,'#326451',`rx="${n(4*pix)}" stroke="#fff9e8" stroke-width="${n(pix)}"`)}${[-1,0,1].map(i=>`<circle cx="${n(mx+i*4*pix)}" cy="${n(my)}" r="${n(pix)}" fill="#f6f5e9"/>`).join('')}</g>`;
  return s;}
  if(tool==='resize')for(const [corner,hx,hy] of [['nw',x,y],['ne',x+w,y],['sw',x,y+h],['se',x+w,y+h]]){const rad=4.2*pix;s+=`<g data-shelf-handle="${corner}" data-shelf-hit="resize" class="shc-handle shc-${corner}" pointer-events="all"><title>اسحب الزاوية لتغيير أبعاد الدولاب</title><circle cx="${n(hx)}" cy="${n(hy)}" r="${n(hit)}" fill="transparent"/>${rect(hx-rad,hy-rad,2*rad,2*rad,'#fffbee',`rx="${n(1.3*pix)}" stroke="#2e6c52" stroke-width="${n(1.6*pix)}"`)}</g>`;}
  return s;
}

// The grip lies on the exposed *depth* edge, rather than coinciding with a
// front-plane corner. At a perfectly straight-on angle there is no projected
// depth direction to drag; the model's numeric depth remains available.
function depthControl(P,c,depth,pix){
  const o=P.project(0,0,0),one=P.project(0,0,1),vx=one.x-o.x,vy=one.y-o.y;
  if(Math.hypot(vx,vy)*depth<6*pix)return '';
  const shift=P.unproject(one.x,one.y,0),vertical=Math.abs(shift.x)>=Math.abs(shift.y);
  const x=vertical?(shift.x<0?c.x+c.w:c.x):c.x+c.w*.64,y=vertical?c.y+c.h*.43:(shift.y<0?c.y+c.h:c.y);
  const a=P.project(x,y,0),b=P.project(x,y,depth),at=P.project(x,y,depth*.52);
  const w=49*pix,h=20*pix,tx=at.x-w/2,ty=at.y-h/2;
  return `<g data-shelf-depth-handle="" data-depth="${n(depth)}" role="img" aria-label="اسحب في اتجاه عمق الدولاب" style="cursor:grab"><title>عمق الدولاب: ${cm(depth)}. اسحب باتجاه امتداد الجانب.</title><line x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}" stroke="#835c36" stroke-width="${n(1.8*pix)}" stroke-dasharray="${n(3*pix)} ${n(2*pix)}" pointer-events="none"/>${rect(tx,ty,w,h,'#775335',`rx="${n(4*pix)}" stroke="#fff9e9" stroke-width="${n(pix)}" pointer-events="all"`)}<text x="${n(at.x)}" y="${n(at.y)}" text-anchor="middle" dominant-baseline="central" direction="rtl" fill="#fff9e6" font-family="Tahoma,Arial,sans-serif" font-size="${n(10*pix)}" pointer-events="none">عمق ${ar.format(depth)}</text></g>`;
}

const itemName={books:'الكتب',boxes:'الصناديق',plant:'النبات',vase:'المزهرية',empty:'المحتوى'};
function dropBadge(plan,p,main,detail,pix,colour){
  if(!finitePoint(p))return '';const {w,h}=plan.wall,limit=Math.max(60,Math.min(330,w/pix-10));
  function shorten(v,step){const count=Math.max(4,Math.floor((limit-18)/step));return v.length>count?v.slice(0,count-1)+'…':v;}
  const line1=shorten(main,6.6),line2=shorten(detail,6.05),bw=Math.min(limit,Math.max(70,line1.length*6.6+18,line2.length*6.05+18))*pix,bh=(line2?36:22)*pix;
  const x=clamp(p.x-bw/2,2*pix,Math.max(2*pix,w-bw-2*pix)),above=p.y-bh-16*pix,y=clamp(above>=2*pix?above:p.y+16*pix,2*pix,Math.max(2*pix,h-bh-2*pix));
  return `<g transform="${transform(x,y)}" data-drop-badge="">${rect(0,0,bw,bh,'#fffdf7',`rx="${n(5*pix)}" stroke="${colour}" stroke-width="${n(1.3*pix)}"`)}<text x="${n(bw/2)}" y="${n((line2?11:11.5)*pix)}" text-anchor="middle" dominant-baseline="middle" direction="rtl" font-family="Tahoma,Arial,sans-serif" font-size="${n(11.5*pix)}" font-weight="600" fill="${colour}">${attr(line1)}</text>${line2?`<text x="${n(bw/2)}" y="${n(25.5*pix)}" text-anchor="middle" dominant-baseline="middle" direction="rtl" font-family="Tahoma,Arial,sans-serif" font-size="${n(10.5*pix)}" fill="#48584e">${attr(line2)}</text>`:''}</g>`;
}
function dropDrawing(plan,pr,pix,id,compact=false,volumeView=false){
  if(!pr||!['divider','content'].includes(pr.kind))return {html:'',notice:'',tone:''};
  if(pr.kind==='divider'&&Array.isArray(pr.lines)){
    const valid=pr.ok===true&&pr.lines.length>0&&pr.lines.every(l=>l?.owner?.key&&['col','row'].includes(l.axis)&&[l.x1,l.y1,l.x2,l.y2,l.cm].every(Number.isFinite));
    const tone=valid?'valid':'invalid',count=valid?pr.lines.length:0,notice=valid?`المعاينة: فاصل في كل خانة محدّدة · عدد الفواصل: ${ar.format(count)}.`:(pr.reason||'تعذّر إدراج الفواصل في المجموعة؛ لن يُضاف أي فاصل.');
    const shapes=valid?pr.lines.map(l=>{const xy=`x1="${n(l.x1)}" y1="${n(l.y1)}" x2="${n(l.x2)}" y2="${n(l.y2)}"`;return `<line ${xy} stroke="#fffbea" stroke-width="${n(4.8*pix)}"/><line data-shelf-group-drop-line="${attr(l.owner.key)}" data-shelf-drop-line="" data-drop-axis="${l.axis}" data-drop-cm="${n(l.cm)}" ${xy} stroke="#14724b" stroke-width="${n(2.5*pix)}"/>`;}).join(''):'';
    return {tone,notice,html:`<g data-shelf-drop-preview="divider" data-drop-state="${tone}" data-drop-ok="${valid}" data-group-drop-count="${count}" pointer-events="none" role="img" aria-label="${attr(notice)}">${shapes}</g>`};
  }
  const divider=pr.kind==='divider',line=pr.line,cell=pr.cell;
  const goodRect=r=>r&&[r.x,r.y,r.w,r.h].every(Number.isFinite)&&r.w>0&&r.h>0;
  const goodLine=line&&[line.x1,line.y1,line.x2,line.y2,line.cm].every(Number.isFinite)&&['row','col'].includes(line.axis);
  const noop=pr.ok&&pr.effect==='noop',accepted=pr.ok===true&&!noop&&(divider?!!goodLine:goodRect(cell));
  const tone=noop?'noop':accepted?'valid':'invalid',colour=noop?'#59665e':accepted?'#16764c':'#974636';
  const bounds=pr.target?targetInfo(plan,pr.target):null;
  const anchor=finitePoint(pr.p)?pr.p:goodRect(cell)?{x:cell.x+cell.w/2,y:cell.y+cell.h/2}:goodLine?{x:(line.x1+line.x2)/2,y:(line.y1+line.y2)/2}:null;
  let shape='',title='',detail='',full='';
  if(divider){
    if(goodRect(bounds))shape+=rect(bounds.x,bounds.y,bounds.w,bounds.h,colour,`data-drop-scope="${attr(bounds.kind)}" fill-opacity=".04" stroke="${colour}" stroke-opacity=".73" stroke-width="${n(1.15*pix)}" stroke-dasharray="${n(5*pix)} ${n(3*pix)}"`);
    if(goodLine){
      const v=line.axis==='col',span=Math.hypot(line.x2-line.x1,line.y2-line.y1),offset=bounds?line.cm-(v?bounds.x:bounds.y):line.cm;
      const xy=`x1="${n(line.x1)}" y1="${n(line.y1)}" x2="${n(line.x2)}" y2="${n(line.y2)}"`;
      if(accepted){
        const thick=Math.max(0,Number(line.thickness)||0);
        if(thick>0)shape+=rect(line.x1-(v?thick/2:0),line.y1-(v?0:thick/2),v?thick:span,v?span:thick,colour,'fill-opacity=".42"');
        shape+=`<line ${xy} stroke="#fffdf5" stroke-width="${n(4*pix)}"/><line data-shelf-drop-line="" ${xy} data-drop-axis="${line.axis}" data-drop-cm="${n(line.cm)}" data-drop-span="${n(span)}" data-drop-offset="${n(offset)}" stroke="${colour}" stroke-width="${n(2.4*pix)}"/>`;
        for(const p of [{x:line.x1,y:line.y1},{x:line.x2,y:line.y2}])shape+=`<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(3.25*pix)}" fill="#fffef5" stroke="${colour}" stroke-width="${n(1.5*pix)}"/>`;
        title=line.kind==='wall'?(v?'حدّ جداري رأسي':'حدّ جداري أفقي'):(v?'فاصل رأسي مقترح':'رف أفقي مقترح');
        detail=`الطول ${cm(span)} · ${v?'من يسار':'من أعلى'} النطاق ${cm(offset)}`;
        full=`${title} داخل ${bounds?.label||'النطاق المحدد'}. ${detail}.`;
      }else shape+=`<line data-shelf-drop-invalid-line="" ${xy} stroke="${colour}" stroke-width="${n(1.5*pix)}" stroke-dasharray="${n(5*pix)} ${n(4*pix)}"/>`;
    }
  }else{
    const name=itemName[pr.content]||'القطعة',prior=itemName[pr.previousContent]||'المحتوى الحالي';
    if(goodRect(cell))shape+=rect(cell.x,cell.y,cell.w,cell.h,colour,`data-shelf-drop-cell="${attr(cell.key)}" fill-opacity="${accepted?.16:.055}" stroke="${colour}" stroke-width="${n(2*pix)}" ${accepted?'':`stroke-dasharray="${n(5*pix)} ${n(3*pix)}"`}`);
    if(accepted){
      title=({assign:`وضع ${name}`,replace:`ضع ${name} مكان ${prior}`,move:`نقل ${name}`,swap:`تبادل ${name} و${prior}`,clear:'إفراغ الخانة'})[pr.effect]||'إفلات داخل الخانة';
      detail=bounds?.label||'الخانة المستقبلة';full=`${title} · ${detail}. ${pr.label||''}`;
    }
    if(pr.fromKey&&finitePoint(pr.dragOrigin)&&finitePoint(pr.p)){
      const source=targetInfo(plan,{kind:'cell',key:pr.fromKey});
      if(source?.leaf){
        if(source.key!==cell?.key)shape+=rect(source.x,source.y,source.w,source.h,'none',`data-drop-source="${attr(source.key)}" stroke="#876d47" stroke-width="${n(1.25*pix)}" stroke-dasharray="${n(4*pix)} ${n(3*pix)}"`);
        if(!volumeView)shape+=`<g data-shelf-drag-ghost="${attr(source.key)}" opacity=".72" transform="${transform(plan.cab.x+pr.p.x-pr.dragOrigin.x,plan.cab.y+pr.p.y-pr.dragOrigin.y)}"><use href="#${artId(id,source.key)}"/></g>`;
      }
    }
  }
  if(!accepted){title=noop?'لا تغيير عند الإفلات':'لا يمكن الإفلات هنا';detail='';full=noop?(pr.label||'بقيت القطعة في خانتها.'):(pr.reason||'اختر موضعًا صالحًا داخل النطاق.');}
  return {tone,notice:full,html:`<g data-shelf-drop-preview="${pr.kind}" data-drop-state="${tone}" data-drop-ok="${!!accepted}" data-drop-effect="${attr(pr.effect||'')}" pointer-events="none" role="img" aria-label="${attr(full)}">${shape}${compact?'':dropBadge(plan,anchor,title,detail,pix,colour)}</g>`};
}

export function mountShelfCanvas(container,{getState,onAction}){
  if(!container||typeof getState!=='function'||typeof onAction!=='function')throw new Error('Shelf canvas: invalid controller');
  const id=`shc-${++serial}`;
  container.innerHTML=`<div class="shc-view" data-shelf-canvas><svg xmlns="${NS}" class="shc-board" data-shelf-board preserveAspectRatio="xMidYMid meet" direction="ltr" role="group" aria-label="واجهة الجدار والدولاب"><title>واجهة الجدار والدولاب</title><defs data-shc-defs></defs><g data-shc-wall></g><g data-shc-zones></g><g data-shc-ground pointer-events="none"></g><g data-shc-cabinet></g><g data-shc-sized-screen pointer-events="none"></g><g data-shc-multi-layer pointer-events="none"></g><g data-shc-controls></g><g data-shc-depth-handle></g><g data-shc-volume-ruler pointer-events="none"></g><g data-shc-pointer-cue pointer-events="none"></g><g data-shc-volume-drag-ghost pointer-events="none" opacity=".74"></g><g data-shc-drop-layer pointer-events="none"></g><g data-shc-layout-layer pointer-events="none"></g></svg><div class="shc-caption" data-shc-caption role="status" hidden></div></div>`;
  const root=container.querySelector('[data-shelf-canvas]'),svg=root.querySelector('[data-shelf-board]');
  const q=s=>root.querySelector(s),caption=q('[data-shc-caption]');
  const dnode=q('[data-shc-defs]'),wall=q('[data-shc-wall]'),zoneLayer=q('[data-shc-zones]'),ground=q('[data-shc-ground]'),cab=q('[data-shc-cabinet]'),guides=q('[data-shc-controls]'),multiLayer=q('[data-shc-multi-layer]'),cueLayer=q('[data-shc-pointer-cue]'),dropLayer=q('[data-shc-drop-layer]'),layoutLayer=q('[data-shc-layout-layer]');
  const sizedLayer=q('[data-shc-sized-screen]'),depthLayer=q('[data-shc-depth-handle]'),volumeRuler=q('[data-shc-volume-ruler]');let sizedKey='';
  const vGhost=q('[data-shc-volume-drag-ghost]');let ghostKey=null,ghostPlan=null,ghostFaces=[],redFaces=[],volumeFrozen=false;
  let volume=null,volumePlan=null,volumeStamp='',volumePhoto=null,was3d=false,cueZ=0,depthMarkup='',rulerMarkup='';
  const controller=new AbortController(),on=(target,type,fn,extra={})=>target.addEventListener(type,fn,{...extra,signal:controller.signal});
  let disposed=false,gesture=null,raf=0,defsKey='',wallKey='',geometryKey='',layoutKey='',guidesKey='',lastWidth=-1,photoKey=null,photoData=null,photoFailed=false,photoImage=null;
  let external=null,lastDropHtml='',fadedKey=null,fadedGeometry=null,fadedNode=null;
  let insertAim=null,equalHint=null,lastLayout='';
  let secondary=null,lastPick=null,hoverFrame=0,hoverEvent=null;
  let cuePlan=null,cueKey='',deleteHint='',lastGroupHtml='';
  const current=()=>getState();
  function primePhoto(url){
    if(url===photoKey)return;photoKey=url;photoData=rasterData(url)?url:null;photoFailed=false;
    if(photoImage){photoImage.onload=photoImage.onerror=null;photoImage=null;}
    if(!url||photoData)return;
    // Decode only an explicitly supplied local blob; no remote resource is
    // fetched or referenced by an exported drawing.
    const img=new Image();photoImage=img;img.onload=()=>{
      if(disposed||photoKey!==url)return;
      try{const limit=2600,ratio=Math.min(1,limit/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*ratio));c.height=Math.max(1,Math.round(img.naturalHeight*ratio));const ctx=c.getContext('2d');ctx.drawImage(img,0,0,c.width,c.height);photoData=c.toDataURL('image/png');}catch{photoFailed=true;}
      photoImage=null;
    };img.onerror=()=>{if(photoKey===url){photoFailed=true;photoImage=null;}};img.src=url;
  }
  const depthOf=plan=>clamp(Number.isFinite(plan?.depth)?plan.depth:36,5,150);
  const cameraKey=st=>[!!st.view3d,st.camera?.yaw??24,st.camera?.pitch??12,st.camera?.zoom??1].join('/');
  const matrixFor=(projection,z)=>{const a=projection.project(0,0,z),b=projection.project(1,0,z),c=projection.project(0,1,z);return `matrix(${b.x-a.x} ${b.y-a.y} ${c.x-a.x} ${c.y-a.y} ${a.x} ${a.y})`;};
  function pose(node,z){if(!volume){node.removeAttribute('transform');return;}const value=matrixFor(volume.projection,z);if(node.getAttribute('transform')!==value)node.setAttribute('transform',value);}
  function svgPoint(event){const mat=svg.getScreenCTM();if(!mat)return null;try{const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const v=p.matrixTransform(mat.inverse());return finitePoint(v)?{x:v.x,y:v.y}:null;}catch{return null;}}
  function planeAt(q,z,projection=volume?.projection){if(!q)return null;if(!projection)return {...q};const p=projection.unproject(q.x,q.y,z);return finitePoint(p)?{x:p.x,y:p.y}:null;}
  function inSvg(clientX,clientY){const r=svg.getBoundingClientRect?.();return !r||r.width>0&&r.height>0&&clientX>=r.left&&clientX<=r.right&&clientY>=r.top&&clientY<=r.bottom;}
  function clientPointFromWall(p,z=undefined){
    if(disposed||!finitePoint(p))return null;const st=current();if(st.preview||!st.plan?.wall||!inRect(p,{x:0,y:0,...st.plan.wall}))return null;
    const m=svg.getScreenCTM();if(!m)return null;
    try{const q=svg.createSVGPoint(),v=st.view3d&&volume?volume.projection.project(p.x,p.y,Number.isFinite(z)?z:inRect(p,st.plan.cab)?depthOf(st.plan):0):p;q.x=v.x;q.y=v.y;const c=q.matrixTransform(m);return finitePoint(c)?{x:c.x,y:c.y}:null;}catch{return null;}
  }
  // Picking is visual first, dimensional second. Real walls and fronts have
  // different inverse transforms; a side board is never an opening behind it.
  // Interactive helper handles are allowed only when actually targeted.
  function surfaceAt(event,allowHandles=true){
    if(disposed||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY)||!inSvg(event.clientX,event.clientY))return null;
    const st=current(),plan=st.plan;if(st.preview||!plan?.wall)return null;
    const q=svgPoint(event);if(!q)return null;
    const geo=sceneGeometry(plan),pix=1/pxPerCm(),target=event.target?.closest?event.target:document.elementFromPoint?.(event.clientX,event.clientY);
    const ev={target},near=sel=>target?.closest?.(sel);
    if(!st.view3d){if(st.tool==='delete'&&onScreenFace(plan,q))return {p:q,hit:{target:{kind:'cabinet'}},art:null,screen:true,z:0,plane:'wall',blocked:true,q};if(!inRect(q,{x:0,y:0,...plan.wall}))return null;return {p:q,hit:pointHit(plan,q,geo,pix,ev,st),art:paintedCell(ev,q,geo),z:0,plane:'wall',blocked:false,q};}
    if(!volume)return null;
    const depth=depthOf(plan),front=planeAt(q,depth),physical=volume.hitTest(q.x,q.y);
    const grip=allowHandles&&near('[data-shelf-handle],[data-shelf-move],[data-shelf-group-handle],[data-shelf-group-move],[data-shelf-equal-handle],[data-shelf-depth-handle],[data-shelf-quick-grip],[data-scoped-grip],[data-shelf-group-shared-grip]');
    if(grip){const z=zoneLayer.contains(grip)?0:depth,p=planeAt(q,z),hit=pointHit(plan,p,geo,pix,ev,st);return {p,hit:hit||{target:{kind:'cabinet'}},art:null,z,plane:z?'front':'wall',blocked:false,q};}
    if(!physical||physical.part==='floor')return null;
    if(physical.part==='screen')return st.tool==='delete'?{p:{x:physical.p.x,y:physical.p.y},hit:{target:{kind:'cabinet'}},art:null,screen:true,z:physical.z,plane:'front',blocked:true,q}:null;
    if(physical.part==='wall'){
      const p=planeAt(q,0);if(!p||!inRect(p,{x:0,y:0,...plan.wall}))return null;
      if(st.tool==='delete'){
        const found=geo.lines.filter(d=>Math.abs(d.axis==='col'?d.cm-p.x:d.cm-p.y)<=2*pix&&parallelAt(d,p)>=(d.axis==='col'?d.y:d.x)&&parallelAt(d,p)<=(d.axis==='col'?d.y+d.h:d.x+d.w)).sort((a,b)=>crossDistance(a,p)-crossDistance(b,p))[0];
        return {p,hit:found?{target:asTarget(found.owner),dividerId:found.id}:{target:{kind:'wall'}},art:null,z:0,plane:'wall',blocked:false,q};
      }
      return {p,hit:pointHit(plan,p,geo,pix,ev,st),art:null,z:0,plane:'wall',blocked:false,q};
    }
    if(physical.part==='divider'||physical.part==='frame'){
      const board=physical.dividerId&&geo.dividers.find(d=>d.id===physical.dividerId),p=physical.p;
      if(!finitePoint(p))return null;
      const hit=board?{target:asTarget(board.owner),dividerId:board.id}:{target:{kind:'cabinet'}};
      return {p:{x:p.x,y:p.y},hit,art:null,z:Number.isFinite(p.z)?p.z:depth,plane:'front',blocked:physical.face!=='front',q};
    }
    if(!['cell','art'].includes(physical.part))return null;
    const cell=geo.cells.find(r=>r.key===physical.key);
    if(!cell)return null;
    const atMouth=front&&inRect(front,cell),raw=atMouth?front:physical.p;
    if(!finitePoint(raw)||!inRect(raw,cell))return null;
    const p={x:raw.x,y:raw.y},z=atMouth?depth:Number.isFinite(physical.p.z)?physical.p.z:0;
    // Preserve the measured front-plane hover tolerance on real openings,
    // while painted decorations take precedence over an invisible halo.
    const hit=physical.part==='art'||st.tool==='delete'?{target:{kind:'cell',key:cell.key}}:pointHit(plan,p,geo,pix,ev,st)||{target:{kind:'cell',key:cell.key}};
    return {p,hit,art:physical.part==='art'?cell:null,z,plane:'front',blocked:false,q};
  }
  function pickClient(clientX,clientY){const a=surfaceAt({clientX,clientY},false);return a&&!a.blocked?{p:a.p,hit:a.hit,plane:a.plane,z:a.z}:null;}
  function wallPointFromClient(x,y){return pickClient(x,y)?.p||null;}
  function alignPlacement(p,hit=null,axis=current().placeAxis||'row',keys=groupKeys(current())){
    const st=current();if(!p||st.preview||!st.plan){insertAim=null;paintDrop(st);return {p,rawP:p,hit,guide:null};}
    const result=snapPlacementAt(st.plan,axis,p,{hit,keys,enabled:st.snapEnabled!==false,cmPerPx:1/pxPerCm(),lock:insertAim?.plan===st.plan&&insertAim.axis===axis?insertAim.lock:null});
    insertAim={...result,plan:st.plan,axis,tool:st.tool};return result;
  }
  function insertAction(g,event){
    if(modifiers(event)||!g.hit||!wallPointFromClient(event.clientX,event.clientY))return;
    const q=alignPlacement(g.start,g.hit);
    onAction({type:'insert-point',p:q.p,rawP:g.start,hit:g.hit,guide:q.guide,client:{x:g.clientX,y:g.clientY}});
  }
  function clearSecondary(){secondary=null;}
  const modifiers=e=>!!(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey);
  function beginSecondary(event){
    clearSecondary();const st=current(),tool=st.tool||'select';if(disposed||event.pointerType!=='mouse'||event.isPrimary===false||st.preview||!isDirect(tool))return;
    const sample=surfaceAt(event);if(!sample)return;const p=sample.p;
    if(gesture||(external&&tool!=='point-insert')||event.buttons!==2||modifiers(event)){if(gesture){detach();lastPick=null;render();}return;}
    const hit=sample.hit;if(!hit)return;
    stopHover();lastPick=null;
    secondary={id:event.pointerId,tool,base:st.plan,p,hit,x:event.clientX,y:event.clientY,blocked:false};
  }
  function endSecondary(event){
    const r=secondary;clearSecondary();if(!r||r.id!==event.pointerId||event.pointerType!=='mouse')return;
    const s=current(),p=surfaceAt(event,false)?.p;
    if(r.blocked||disposed||gesture||s.preview||(s.tool||'select')!==r.tool||s.plan!==r.base||!p||event.buttons!==0||modifiers(event)||Math.hypot(event.clientX-r.x,event.clientY-r.y)>3.5)return;
    // One physical release = one toggle, independently of when the browser
    // dispatches contextmenu (or whether it dispatches it at all).
    onAction({type:'toggle-insert-axis',p:r.p,hit:r.hit,client:{x:r.x,y:r.y}});
  }
  function pickPoint(g,event){
    if(!surfaceAt(event))return;
    // Keep the hit, model point, and menu anchor from the same actual pick:
    // slight hand jitter before release must not attach one leaf to another.
    const p={...(g.pickStart||g.start)},client=clientPointFromWall(p,g.pickZ),hit=g.hit||pointHit(g.base,p,sceneGeometry(g.base),1/pxPerCm(),event,current());if(!hit||!client)return;
    const time=performance.now(),identity=`${hit.target.kind}/${hit.target.key||''}/${hit.dividerId||''}`;
    if(lastPick&&lastPick.identity===identity&&time-lastPick.time<=330&&Math.hypot(client.x-lastPick.x,client.y-lastPick.y)<3.5){lastPick=null;return;}
    lastPick={identity,time,...client};onAction({type:'point-pick',hit,p,client});
  }
  function clearCue(){if(deleteHint&&caption.textContent===deleteHint){caption.hidden=true;caption.textContent='';}deleteHint='';for(const el of redFaces)el.style.removeProperty('filter');redFaces=[];if(cueKey)cueLayer.innerHTML='';cueKey='';cuePlan=null;delete root.dataset.deleteHit;}
  function stopHover(){if(hoverFrame)cancelAnimationFrame(hoverFrame);hoverFrame=0;hoverEvent=null;delete root.dataset.hoverDivider;delete root.dataset.groupMoveHit;clearCue();}
  function hoverTool(event){
    hoverEvent=event;if(hoverFrame)return;
    hoverFrame=requestAnimationFrame(()=>{hoverFrame=0;const ev=hoverEvent,st=current();hoverEvent=null;
      if(!ev||disposed||gesture||secondary||st.preview||!hoverFeedback(st))return;
      const sample=surfaceAt(ev),p=sample?.p||null,geo=sceneGeometry(st.plan),hit=sample?.hit||null;cueZ=sample?.plane==='wall'?0:depthOf(st.plan);pose(cueLayer,cueZ);
      const d=hit?.dividerId&&geo.dividers.find(v=>v.id===hit.dividerId);
      if(d&&(!grouped(st)||(canShare(st)&&onSegment(sharedSelectionReach(st.plan,groupKeys(st),d),parallelAt(d,p)))))root.dataset.hoverDivider=d.axis;else delete root.dataset.hoverDivider;
      if(grouped(st)&&st.tool==='move'){root.dataset.groupMoveHit=(memberAt(st,hit)||ev.target?.closest?.('[data-shelf-group-move]'))?'yes':'no';return;}
      if(st.tool==='delete'){
        const item=removalItem(sample),key=removalKey(item);
        if(!key){clearCue();return;}
        if(cueKey!==key||cuePlan!==st.plan){clearCue();cueKey=key;cuePlan=st.plan;const selector=item.screen?'[data-vol-part="screen"]:not([data-vol-diagnostic])':item.cellKey?'[data-shelf-art-key="'+item.cellKey+'"]':item.dividerId?'[data-vol-divider="'+item.dividerId+'"]':null;redFaces=volume&&selector?[...cab.querySelectorAll(selector)]:[];for(const el of redFaces)el.style.setProperty('filter','sepia(1) saturate(6) hue-rotate(310deg) brightness(.82)');cueLayer.innerHTML=redFaces.length?'':removalCue(st.plan,geo,item,id,1/pxPerCm());deleteHint=removalDescription(st.plan,item);caption.hidden=!deleteHint;caption.textContent=deleteHint;caption.dataset.dropTone='';}
        root.dataset.deleteHit=item.screen?'screen':item.dividerId?'divider':'content';
      }else if(st.tool==='point-insert'){
        if(ev.target?.closest?.('[data-shelf-equal-handle],[data-shelf-group-move]')){delete root.dataset.hoverDivider;insertAim=null;external=null;paintDrop(st);return;}
        const leaf=hit?.target.kind==='cell'&&!hit.dividerId?hit.target.key:null;
        if(leaf&&(!grouped(st)||groupKeys(st).includes(leaf))&&(equalHint?.plan!==st.plan||equalHint.key!==leaf)){equalHint={plan:st.plan,key:leaf};render();}
        const q=alignPlacement(sample?.blocked?null:p,hit);onAction({type:'hover-insert',p:q.p,rawP:p,hit,guide:q.guide});
      }
    });
  }
  function pxPerCm(){const m=svg.getScreenCTM(),k=m&&Math.hypot(m.a,m.b)||1;if(!volume)return k;const p=volume.projection,a=p.project(0,0,0),b=p.project(1,0,0),c=p.project(0,1,0);return Math.max(.01,k*Math.min(Math.hypot(b.x-a.x,b.y-a.y),Math.hypot(c.x-a.x,c.y-a.y)));}
  function detach(){const old=gesture;gesture=null;if(old)try{if(svg.hasPointerCapture(old.id))svg.releasePointerCapture(old.id);}catch{}root.removeAttribute('data-dragging');return old;}
  function schedule(){if(!raf&&!disposed)raf=requestAnimationFrame(()=>{raf=0;render();});}
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;}
  function paintDrop(st,pix=1/pxPerCm()){
    if(external&&(st.preview||st.plan!==external.plan||(st.tool||'select')!==external.tool||!sameTarget(external.target,scope(st.plan,st))))external=null;
    const own=!st.preview&&gesture?.kind==='art'&&gesture.moved?gesture.drop:null;
    const pr=st.preview?null:(own||external?.data||null),target=pr?.line?.owner||pr?.target||pr?.cell,z=target?.kind==='wall'||target?.kind==='zone'?0:pr?.p&&!target&&!inRect(pr.p,st.plan.cab)?0:depthOf(st.plan);
    pose(dropLayer,z);pose(layoutLayer,gesture?.kind==='divider'&&gesture.target?.kind?.match(/^(wall|zone)$/)?0:z);
    const v=dropDrawing(st.plan,pr,pix,id,st.tool==='point-insert'&&pr?.kind==='divider',!!volume);
    root.toggleAttribute('data-aiming-other-scope',!!(st.tool==='point-insert'&&pr?.kind==='divider'&&pr.target&&!sameTarget(pr.target,st.target)));
    if(v.html!==lastDropHtml){dropLayer.innerHTML=v.html;lastDropHtml=v.html;}
    const guide=st.preview||st.snapEnabled===false?null:gesture?.kind==='divider'&&gesture.moved?gesture.snap?.guide:!gesture&&external&&insertAim?.plan===st.plan&&insertAim.tool===st.tool&&(!external.data?.line?.axis||external.data.line.axis===insertAim.axis)?insertAim.guide:null;
    const layout=st.preview?'':layoutFeedback(guide,gesture,pix);if(layout!==lastLayout){layoutLayer.innerHTML=layout;lastLayout=layout;}
    const source=own?.fromKey||null,ghostSource=volume&&source&&finitePoint(own.p)&&finitePoint(own.dragOrigin)?source:null;
    if(ghostSource!==ghostKey||ghostSource&&volume!==ghostPlan){
      for(const el of ghostFaces)el.removeAttribute('opacity');ghostFaces=[];
      ghostKey=ghostSource;ghostPlan=volume;vGhost.replaceChildren();
      if(ghostSource){
        ghostFaces=[...cab.querySelectorAll('[data-shelf-art-key="'+ghostSource+'"]')];vGhost.replaceChildren(...ghostFaces.map(el=>el.cloneNode(true)));
        for(const el of ghostFaces)el.setAttribute('opacity','.34');
      }
    }
    if(ghostSource){
      const P=volume.projection,a=P.project(own.dragOrigin.x,own.dragOrigin.y,0),b=P.project(own.p.x,own.p.y,0);
      vGhost.setAttribute('transform',transform(b.x-a.x,b.y-a.y));
    }
    if(source!==fadedKey||geometryKey!==fadedGeometry){
      fadedNode?.removeAttribute('opacity');fadedNode=source&&!volume?cab.querySelector(`[data-shc-art-slot="${source}"]`):null;fadedNode?.setAttribute('opacity','.34');fadedKey=source;fadedGeometry=geometryKey;
    }
    const dividerNote=!st.preview&&gesture?.kind==='divider'&&gesture.moved?(gesture.dragStatus?.reason||(sharedDrag(gesture)?'يتحرّك اللوح المتصل بطوله؛ قد تتغيّر أيضًا خانات غير محدّدة تشترك فيه. تبقى المجموعة محدّدة.':gesture.via==='boundary'?'هذه الحافة جزء من فاصل متصل؛ يتحرك الفاصل كله وتبقى الخانة أو المنطقة محددة.':'')):'';
    const gt=adaptiveShape(gesture)&&gesture.moved?gesture.result:null;
    const groupNote=!st.preview&&gt?(!gt.ok?(gt.reason||'تعذّر تطبيق التغيير على المجموعة.'):[gt.clamped?(gt.reason||'بلغت المجموعة حدّ الحركة.'):'',gt.affectedKeys?.length?`الخانات المجاورة التي تتأثر بالفواصل المشتركة: ${ar.format(gt.affectedKeys.length)}. تظهر بالبرتقالي.`:'',gt.frameChanged?'يتغيّر إطار الدولاب مع المجموعة.':''].filter(Boolean).join(' ')||'تظهر الآن النتيجة عند الإفلات.'):'';
    const note=(!st.preview&&st.tool==='delete'&&deleteHint)||(!st.preview&&gesture?.kind==='equal'&&gesture.equal?equalNotice(gesture.equal):'')||[guide?.label,v.notice||groupNote||dividerNote].filter(Boolean).join(' ')||(!st.preview&&gesture?.kind==='draw'&&gesture.moved&&!gesture.evaluation?.ok?gesture.evaluation?.reason||'ارسم مساحة كافية للدولاب.':!st.preview&&gesture?.kind==='measure'&&gesture.clipped?'ثُبّتت نهاية المسطرة عند حافة الجدار.':'');
    caption.hidden=!note;caption.dataset.dropTone=(gesture?.kind==='equal'&&!gesture.equal?.ok?'invalid':'')||v.tone||(gt&&!gt.ok?'invalid':'')||(gesture?.kind==='divider'&&gesture.moved&&gesture.dragStatus?.clamped?'limit':'');if(caption.textContent!==note)caption.textContent=note;
  }
  function setDropPreview(data){
    if(disposed)return false;const st=current();const allowed=!st.preview&&!gesture&&st.plan&&data&&['divider','content'].includes(data.kind);
    if(allowed&&st.tool!=='point-insert')clearSecondary();
    if(!allowed)insertAim=null;
    external=allowed?{data,plan:st.plan,tool:st.tool||'select',target:asTarget(scope(st.plan,st))}:null;paintDrop(st);return !!allowed||data==null;
  }
  function paint(){
    if(disposed)return;const state=current();if(!state?.plan?.cab)return;
    if(secondary&&(state.plan!==secondary.base||state.preview||(state.tool||'select')!==secondary.tool))clearSecondary();
    if(state.preview||(state.tool||'select')!=='select')lastPick=null;
    if(gesture&&(gesture.cameraStamp!==cameraKey(state)||state.plan!==gesture.base||state.preview||(state.tool||'select')!==gesture.tool||groupOperation(gesture)&&!matchesGestureGroup(state,gesture)))detach();
    // Drawing previews the proposed rectangle only. Moving/resizing an
    // existing cabinet and adjusting a divider preview the actual geometry.
    const p=gesture?.kind==='draw'?state.plan:(gesture?.nextPlan||state.plan),c=p.cab,w=p.wall.w,h=p.wall.h,preview=!!state.preview,tool=state.tool||'select';
    if(cuePlan&&(preview||tool!=='delete'||cuePlan!==p))clearCue();
    if(preview||root.dataset.tool!==tool){delete root.dataset.hoverDivider;delete root.dataset.groupMoveHit;}
    root.dataset.groupActive=String(!preview&&grouped(state));
    const src=localPhoto(state.photoUrl);primePhoto(src);
    root.dataset.tool=tool;root.dataset.preview=String(preview);svg.dataset.wallWidth=String(w);svg.dataset.wallHeight=String(h);
    root.dataset.cabinetRect=[n(c.x),n(c.y),n(c.w),n(c.h)].join(',');
    const isVolume=!!state.view3d,depth=depthOf(p),geo=sceneGeometry(p),t=scope(p,state);
    if(was3d!==isVolume){stopHover();external=null;insertAim=null;equalHint=null;geometryKey='';wallKey='';guidesKey='';sizedKey='';lastGroupHtml='';lastDropHtml='';lastLayout='';multiLayer.replaceChildren();dropLayer.replaceChildren();layoutLayer.replaceChildren();clearCue();was3d=isVolume;}
    root.dataset.view3d=String(isVolume);root.dataset.depthCm=String(n(depth));
    const pad=preview?0:clamp((w+h)*.021,4,17),fh=floorHeight(p);
    let viewBox=`${n(-pad)} ${n(-pad)} ${n(w+pad*2)} ${n(h+fh+pad*2)}`,ratioW=w+pad*2,ratioH=h+fh+pad*2,geom;
    const dk=`${p.finish}|${p.wallColor}`;if(dk!==defsKey){dnode.innerHTML=defs(p,id);defsKey=dk;}
    if(isVolume){
      const camera=state.camera||{},stamp=[camera.yaw??24,camera.pitch??12,depth,preview,pad].join('/'),frozen=gesture?.frozenProjection;
      if(!volume||p!==volumePlan||stamp!==volumeStamp||volumePhoto!==src||volumeFrozen!==!!frozen||frozen&&volume.projection!==frozen){
        if(cueKey)clearCue(); // Previous projected material no longer occupies these screen pixels.
        volume=renderShelfVolume(p,{...camera,depth,pad:Math.max(3,pad),photoUrl:src,prefix:id+'-vol',...(frozen?{projection:frozen}:{})});
        volumePlan=p;volumeStamp=stamp;volumePhoto=src;volumeFrozen=!!frozen;wall.innerHTML=volume.wallHtml;cab.innerHTML=volume.cabinetHtml;
      }
      const b=(frozen||volume.projection).bounds,z=clamp(Number.isFinite(camera.zoom)?camera.zoom:1,.7,2);ratioW=b.w/z;ratioH=b.h/z;
      viewBox=`${n(b.x+(b.w-ratioW)/2)} ${n(b.y+(b.h-ratioH)/2)} ${n(ratioW)} ${n(ratioH)}`;
      cab.removeAttribute('transform');cab.setAttribute('pointer-events','visiblePainted');ground.replaceChildren();sizedLayer.replaceChildren();
      geom='volume:'+JSON.stringify([c.x,c.y,c.w,c.h,depth,geo.dividers.map(d=>[d.id,n(d.cm)]),geo.cells.map(r=>[r.key,r.content])]);geometryKey=geom;
    }else{
      volume=null;volumePlan=null;volumeStamp='';volumePhoto=null;
      const wk=`${w}|${h}|${p.wallColor}`;
      if(wallKey!==wk||wall._shcPhoto!==src){wall.innerHTML=wallScene(p,id,src);wallKey=wk;wall._shcPhoto=src;}
      ground.innerHTML=groundShadow(p,id);
      geom=JSON.stringify([n(c.w),n(c.h),p.finish,geo.cells.map(r=>[r.key,n(r.x-c.x),n(r.y-c.y),n(r.w),n(r.h),r.content,leafFinish(p,r)]),geo.boards.map(d=>[d.id,n(d.x-c.x),n(d.y-c.y),n(d.w),n(d.h)])]);
      if(geom!==geometryKey){cab.innerHTML=cabinetArt(p,id,geo);geometryKey=geom;}
      cab.setAttribute('transform',transform(c.x,c.y));cab.setAttribute('pointer-events',preview?'none':'visiblePainted');
      const sk=p.sizedObject?JSON.stringify([geom,c.x,c.y,p.sizedObject,preview]):'';if(sizedKey!==sk){sizedKey=sk;sizedLayer.innerHTML=renderSizedScreen(p,{preview});}
    }
    if(layoutKey!==viewBox){svg.setAttribute('viewBox',viewBox);svg.style.setProperty('--shc-ratio',`${n(ratioW)} / ${n(ratioH)}`);layoutKey=viewBox;}
    cab.dataset.shelfBody='';
    pose(zoneLayer,0);pose(guides,gesture?.kind==='draw'&&gesture?.evaluation?.rect?gesture.planeZ:depth);pose(multiLayer,depth);pose(cueLayer,cueZ);
    const pix=1/pxPerCm(),coarse=typeof matchMedia!=='undefined'&&matchMedia('(pointer:coarse)').matches;
    const gk=JSON.stringify([isVolume,geom,n(c.x),n(c.y),w,h,t.kind,t.key,t.leaf,state.selectedDividerId||null,geo.zones.map(z=>[z.key,n(z.x),n(z.y),n(z.w),n(z.h)]),preview,tool,state.showDims,sharedView(state,gesture),!!gesture?.moved,!!state.placingContent,groupKeys(state),state.placeAxis||'row',equalHint?.plan===state.plan?equalHint.key:null,n(pix),coarse,gesture?.kind,gesture?.dividerId,gesture?.evaluation?.rect,gesture?.evaluation?.ok,tool==='measure'?(gesture?.ruler||state.ruler):null,gesture?.clipped]);
    if(guidesKey!==gk){zoneLayer.innerHTML=zoneControls(p,{...state,tool},pix,gesture,geo,t,coarse);guides.innerHTML=controls(p,{...state,tool,equalHint:equalHint?.plan===state.plan?equalHint.key:null},pix,gesture,geo,t,coarse,id);guidesKey=gk;}
    const multiHtml=groupDrawing(p,geo,state,gesture,pix);if(lastGroupHtml!==multiHtml){multiLayer.innerHTML=multiHtml;lastGroupHtml=multiHtml;}
    const ruler=gesture?.kind==='measure'?gesture.ruler:state.ruler,rz=Number.isFinite(ruler?.a?.z)?ruler.a.z:0;
    pose(volumeRuler,rz);const rulerText=isVolume&&!preview&&tool==='measure'?rulerDrawing(p,ruler,pix,gesture?.kind==='measure',!!gesture?.clipped):'';
    if(rulerText!==rulerMarkup){rulerMarkup=rulerText;volumeRuler.innerHTML=rulerText;}
    const dh=isVolume&&!preview&&tool==='resize'&&!grouped(state)?depthControl(volume.projection,c,depth,pix):'';
    if(dh!==depthMarkup){depthMarkup=dh;depthLayer.innerHTML=dh;}
    root.dataset.targetKind=t.kind;root.dataset.targetKey=t.key||'';root.dataset.leafCount=String(geo.cells.length);root.dataset.zoneCount=String(geo.zones.length);
    root.dataset.selectedDivider=!preview&&!sharedView(state,gesture)&&isDirect(tool)?(geo.dividers.find(d=>d.id===state.selectedDividerId&&(tool==='point-insert'||sameTarget(d.owner,t)))?.id||''):'';
    paintDrop(state,pix);
    const names={select:'انقر لتحديد عنصر، أو اسحب من مساحة فارغة لتحديد الخانات داخل مستطيل',draw:grouped(state)?'رسم غلاف جديد للخانات المحددة':'رسم حدود الدولاب',move:'اسحب الرف أو الفاصل أو القطعة لتحريكها؛ واسحب من إطار الدولاب أو مساحة فارغة فيه لتحريك الدولاب كله',delete:'انقر على فاصل أو حدّ جداري أو قطعة ظاهرة أو الشاشة لحذف ذلك العنصر وحده',resize:'تغيير أبعاد الدولاب من الزوايا',structure:'اختيار نطاق التقسيم وتحريك فواصله',measure:'قياس المسافة بين نقطتين على الجدار','point-insert':'انقر لإدراج فاصل هنا، وبدّل اتجاهه بزر الفأرة الأيمن. اسحب فاصلًا أو قطعة موجودة لتحريكها.'};
    svg.setAttribute('aria-label',`${isVolume?'منظور مجسّم للدولاب والجدار':'واجهة الجدار والدولاب'}، ${preview?'معاينة نظيفة':names[tool]||names.select}`);
  }
  function render(){stop();paint();}
  function prospective(g,p){
    g.last=p;
    if(g.kind==='equal'){
      const delta=g.axis==='col'?p.x-g.start.x:p.y-g.start.y;
      const count=1+Math.floor(Math.abs(delta)*g.pxScale/20);
      if(g.equal?.count===count)return;
      g.equal=equalDistribution(g.base,g.keys,g.axis,count,false);return;
    }
    if(g.kind==='group-reframe'){
      if(!g.moved)return;
      // Keep the user's actual envelope: unlike free cabinet drawing, an
      // impossible group reframe is refused as a whole, never clipped.
      const rect={x:Math.min(g.start.x,p.x),y:Math.min(g.start.y,p.y),w:Math.abs(p.x-g.start.x),h:Math.abs(p.y-g.start.y)};
      if(g.rect&&['x','y','w','h'].every(k=>rect[k]===g.rect[k]))return;
      g.rect=rect;const r=g.result=reframeGroup(g.base,g.keys,rect);
      g.nextPlan=r.ok?r.plan:g.base;g.action=r.ok?{type:'group-reframe',keys:[...g.keys],rect:{...rect}}:null;return;
    }
    if(g.kind==='group-transform'){
      if(!g.moved)return;const dx=p.x-g.start.x,dy=p.y-g.start.y;
      if(g.spec&&g.spec.dx===dx&&g.spec.dy===dy)return;
      g.spec=g.corner?{type:'resize',corner:g.corner,dx,dy}:{type:'move',dx,dy};
      const r=g.result=transformGroup(g.base,g.keys,g.spec);
      g.nextPlan=r.ok?r.plan:g.base;g.action=r.ok&&r.changed?{type:g.fromGroupHandle?'handle-group-move':'group-transform',keys:[...g.keys],spec:{...g.spec},...(g.handleOwner?{owner:g.handleOwner}:{})}:null;return;
    }
    if(g.kind==='marquee'){if(g.moved){g.last=wallPoint(p,g.base.wall);g.marquee=marqueeCells(g.base,g.start,g.last);}return;}
    if(g.kind==='art'){
      if(!g.moved)return;const r=planContentDrop(g.base,{fromKey:g.fromKey},p);
      g.drop={...r,kind:'content',p:{...p},dragOrigin:g.start};g.action=r.ok&&r.changed&&['move','swap'].includes(r.operation)?{type:'content-transfer',fromKey:g.fromKey,p:{...p}}:null;
    }
    else if(g.kind==='measure'){const b=wallPoint(p,g.base.wall),a=g.frozenProjection?{...g.start,z:g.planeZ}:g.start;if(g.frozenProjection)b.z=g.planeZ;g.ruler={a,b};g.clipped=b.x!==p.x||b.y!==p.y;g.action={type:'measure',a,b};}
    else if(g.kind==='draw'){g.evaluation=evaluateDraw(g.base,g.start,p);g.action={type:'draw',a:g.start,b:p};g.nextPlan=g.evaluation.ok?drawCab(g.base,g.start,p):g.base;}
    else if(g.kind==='move'){const dx=p.x-g.start.x,dy=p.y-g.start.y;g.action={type:'move',dx,dy};g.nextPlan=moveCab(g.base,dx,dy);}
    else if(g.kind==='resize'){const q={x:p.x+g.offset.x,y:p.y+g.offset.y};g.action={type:'resize',corner:g.corner,p:q};g.nextPlan=resizeCab(g.base,g.corner,q);}
    else if(g.kind==='divider'){
      const rawCm=g.baseCm+(g.axis==='col'?p.x-g.start.x:p.y-g.start.y);
      g.snap=g.moved?snapDividerAt(g.base,g.dividerId,rawCm,{lock:g.snap?.lock,enabled:current().snapEnabled!==false,cmPerPx:1/pxPerCm()}):null;
      const value=g.snap?.cm??rawCm;
      g.nextPlan=moveScopedDivider(g.base,g.dividerId,value);
      const status=g.dragStatus=dividerDragStatus(g.base,g.originTarget,g.dividerId,value,g.nextPlan);
      g.action=status.ok?{type:'scoped-divider',id:g.dividerId,cm:value,actualCm:status.actualCm,target:g.target,via:g.via,...(sharedDrag(g)?{keys:[...g.keys],sharedAt:g.sharedAt}:{}),...(status.clamped?{constraint:status.reason}:{})}:null;
      if(!status.ok)g.nextPlan=g.base;
    }
  }
  function updateGesture(event){const g=gesture;if(!g||event.pointerId!==g.id)return false;
    const q=svgPoint(event),p=planeAt(q,g.planeZ,g.frozenProjection);if(!p)return false;
    if(g.kind==='depth'){
      if(Math.hypot(event.clientX-g.clientX,event.clientY-g.clientY)>2.5)g.moved=true;
      const {x,y}=g.depthVector,dd=((q.x-g.screenStart.x)*x+(q.y-g.screenStart.y)*y)/(x*x+y*y);
      const maxDepth=Math.min(150,current().maxCabDepth??150);const depth=Math.min(maxDepth,Math.round(clamp(g.depthStart+dd,5,maxDepth)*10)/10);
      if(Math.abs(depth-g.depthStart)>.01){g.nextPlan={...g.base,depth};g.action={type:'cabinet-depth',depth};}else{g.nextPlan=g.base;g.action=null;}return true;
    }
    if(g.kind==='art'&&g.frozenProjection){
      const at=surfaceAt({clientX:event.clientX,clientY:event.clientY},false);
      const physical=at?.hit?.target?.kind==='cell'&&!at.hit.dividerId&&!at.blocked?at.p:null;
      if(!physical){if(Math.hypot(event.clientX-g.clientX,event.clientY-g.clientY)>(g.pointerType==='touch'?8:5))g.moved=true;g.drop={kind:'content',ok:false,p,reason:'أفلت فوق فتحة خانة ظاهرة من هذا الجانب.'};g.action=null;return true;}
      p.x=physical.x;p.y=physical.y;
    }
    if(Math.hypot(event.clientX-g.clientX,event.clientY-g.clientY)>((g.kind==='art'||g.kind==='marquee'||adaptiveShape(g))?(g.pointerType==='touch'?8:5):2.5))g.moved=true;
    if(g.kind==='art'&&g.moved)root.dataset.dragging='art-transfer';
    if(g.kind==='marquee'&&g.moved)root.dataset.dragging='marquee';
    if(g.moved&&external?.tool==='point-insert')external=null;
    if(g.kind!=='select'&&g.kind!=='insert')prospective(g,p);else g.last=p;return true;
  }
  on(svg,'pointerdown',event=>{
    if(guardedGesture(gesture)&&(event.button!==0||event.pointerId!==gesture.id||event.isPrimary===false)){cancel();return;}
    if(event.button===2){beginSecondary(event);return;}
    if(secondary){secondary.blocked=true;return;}clearSecondary();stopHover();
    if(disposed||gesture||(external&&current().tool!=='point-insert')||event.isPrimary===false||event.button!==0||(event.pointerType==='mouse'&&event.buttons!==1))return;
    const state=current(),plan=state.plan;if(state.preview||!plan?.cab)return;const sample=surfaceAt(event);if(!sample)return;const {p}=sample;
    const tool=state.tool||'select',c=plan.cab,inside=inRect(p,c),onWall=(inRect(p,{x:0,y:0,...plan.wall})||tool==='delete'&&sample.screen),geo=sceneGeometry(plan),t=scope(plan,state);
    const handle=event.target.closest?.('[data-shelf-handle]'),move=event.target.closest?.('[data-shelf-move]');
    const artCell=onWall&&sample.art;
    const hit=onWall?sample.hit:null,d=hit?.dividerId&&geo.dividers.find(v=>v.id===hit.dividerId);
    const reach=d&&!noOwner(state)&&isPicker(tool)&&dividerReach(plan,t,d),atReach=reach&&onSegment(reach,parallelAt(d,p));
    const shared=d&&canShare(state)&&sharedSelectionReach(plan,groupKeys(state),d),along=shared?parallelAt(d,p):null;
    const piece=shared&&shared.segments.find(s=>along>=s.start-1e-7&&along<=s.end+1e-7),eligible=!!piece,sharedAt=piece?clamp(along,piece.start,piece.end):null;
    const via=eligible?'shared-selection':d&&tool==='select'&&noOwner(state)&&!shared?'group-board':d&&tool==='move'?'move-board':d&&tool==='point-insert'?'place-board':atReach?(tool==='select'&&d.id===state.selectedDividerId&&sameTarget(t,d.owner)?'point':reach.relation):null;
    let kind='',data={};
    if(['point-insert','delete'].includes(tool)&&(!hit||modifiers(event)))return;
    if(sample.blocked && tool==='point-insert' && (!d||grouped(state)))return;
    if(tool==='delete'&&event.buttons!==1)return;
    const hasGroup=grouped(state),keys=hasGroup?[...groupKeys(state)]:null,member=hasGroup&&memberAt(state,hit);
    const repeat=tool==='point-insert'&&event.target.closest?.('[data-shelf-equal-handle]');
    const groupGripEl=event.target.closest?.('[data-shelf-group-move]');
    if(groupGripEl){
      const bundle=groupHandleFor(plan,state,geo,t);
      if(!bundle||modifiers(event)||event.buttons!==1||!onWall||(groupGripEl.dataset.groupHandleOwner||'')!==(bundle.owner?.key||''))return;
      kind='group-transform';data={keys:[...bundle.keys],fromGroupHandle:true,handleOwner:bundle.owner};
    }
    else if(repeat){const key=repeat.dataset.shelfEqualHandle,selected=hasGroup?keys:[key];if(!onWall||event.buttons!==1||modifiers(event)||!selected.includes(key)||!geo.cells.some(c=>c.key===key))return;
      kind='equal';data={axis:state.placeAxis==='col'?'col':'row',keys:selected,grouped:hasGroup,pxScale:pxPerCm()};insertAim=null;external=null;
    }
    else if(eligible){
      if(event.buttons!==1||modifiers(event))return;
      kind='divider';data={axis:d.axis,dividerId:d.id,baseCm:d.cm,target:asTarget(d.owner),originTarget:asTarget(shared.target),via:'shared-selection',sharedAt,keys};
    }
    else if(hasGroup&&['move','resize','point-insert','draw'].includes(tool)){
      if(event.buttons!==1||modifiers(event)||!onWall)return;
      const corner=event.target.closest?.('[data-shelf-group-handle]')?.dataset.shelfGroupHandle,grip=event.target.closest?.('[data-shelf-group-move]');
      if(tool==='draw'){kind='group-reframe';data={keys};}
      else if(tool==='move'){if(!member&&!grip)return;kind='group-transform';data={keys};}
      else if(tool==='resize'){if(!['nw','ne','sw','se'].includes(corner))return;kind='group-transform';data={keys,corner};}
      else{kind='group-insert';data={keys};}
    }
    else if(tool==='resize'&&state.view3d&&event.target.closest?.('[data-shelf-depth-handle]')){
      const zero=volume.projection.project(0,0,0),one=volume.projection.project(0,0,1),v={x:one.x-zero.x,y:one.y-zero.y};if(Math.hypot(v.x,v.y)<1e-4)return;kind='depth';data={depthStart:depthOf(plan),depthVector:v,screenStart:sample.q};
    }
    else if(tool==='draw'||tool==='measure'){if(!onWall)return;kind=tool;}
    else if(tool==='resize'&&handle){kind='resize';const corner=handle.dataset.shelfHandle;data={corner,offset:{x:c.x+(corner[1]==='e'?c.w:0)-p.x,y:c.y+(corner[0]==='s'?c.h:0)-p.y}};}
    else if(via){kind='divider';data={axis:d.axis,dividerId:d.id,baseCm:d.cm,target:asTarget(d.owner),originTarget:asTarget(atReach?t:d.owner),via};}
    else if(tool==='delete'){kind='delete';data={item:removalItem(sample)};}
    else if((isDirect(tool)||tool==='move')&&artCell&&['mouse','touch','pen'].includes(event.pointerType)){kind='art';data={fromKey:artCell.key,target:{kind:'cell',key:artCell.key}};}
    else if(tool==='move'&&(move||inside)){kind='move';}
    else if(tool==='point-insert'){kind='insert';}
    else if(tool==='select'&&hit){
      const blank=!d&&!artCell&&['wall','zone','cell'].includes(hit.target.kind);
      if(blank&&(event.buttons!==1||modifiers(event)))return;
      kind=blank?'marquee':'select';data={target:hit.target};
    }
    else if(tool==='structure'&&hit){kind='select';data={target:hit.target};}
    else return;
    if(tool==='point-insert'&&!['insert','group-insert'].includes(kind))external=null;
    event.preventDefault();
    const P=state.view3d?volume.projection:null,chosenZ=P&&(['marquee','group-transform','group-reframe','equal','resize'].includes(kind))?depthOf(plan):sample.z;
    const start=P&&chosenZ!==sample.z?planeAt(sample.q,chosenZ,P):p;
    gesture={kind,...data,id:event.pointerId,pointerType:event.pointerType,start,last:start,pickStart:p,pickZ:sample.z,planeZ:chosenZ,frozenProjection:P,cameraStamp:cameraKey(state),hit,base:plan,nextPlan:plan,tool,clientX:event.clientX,clientY:event.clientY,moved:false,action:null};
    root.dataset.dragging=kind==='art'?'art-pending':kind==='marquee'?'marquee-pending':kind;try{svg.setPointerCapture(event.pointerId);}catch{}if(kind!=='select'&&kind!=='insert')prospective(gesture,p);schedule();
  });
  on(svg,'pointermove',event=>{const s=current();if(!gesture&&!secondary&&!s.preview&&hoverFeedback(s)&&event.isPrimary!==false&&event.buttons===0)hoverTool(event);});
  on(svg,'pointerleave',()=>{stopHover();const s=current();if(!disposed&&!gesture&&!s.preview&&s.tool==='point-insert')onAction({type:'hover-insert',p:null,hit:null});});
  on(window,'pointermove',event=>{
    if(secondary&&event.pointerId===secondary.id&&(event.buttons!==2||modifiers(event)||Math.hypot(event.clientX-secondary.x,event.clientY-secondary.y)>3.5))secondary.blocked=true;
    if(!gesture||event.pointerId!==gesture.id)return;if(guardedGesture(gesture)&&(event.buttons!==1||event.isPrimary===false||modifiers(event))){cancel();return;}if(event.pointerType==='mouse'&&event.buttons!==1){detach();lastPick=null;render();return;}event.preventDefault();if(updateGesture(event)){if(gesture.moved)lastPick=null;schedule();}
  },{passive:false});
  // Mouse chords can generate mousedown without a second pointerdown.
  // Extra fingers, barrel buttons or mixed buttons cancel destructive clicks and box selection.
  on(window,'pointerdown',event=>{if(guardedGesture(gesture)&&(event.pointerId!==gesture.id||event.button!==0||event.isPrimary===false))cancel();},{capture:true});
  on(window,'mousedown',event=>{if(guardedGesture(gesture)&&(event.button!==0||event.buttons!==1))cancel();},{capture:true});
  on(svg,'contextmenu',event=>{
    const st=current();if(disposed||st.preview||!isDirect(st.tool||'select')||event.button!==2||modifiers(event)||!surfaceAt(event,false))return;
    // In the editable wall a secondary click rotates placement. The menu
    // event is never itself an action; other tools and surfaces stay native.
    event.preventDefault();
  });
  on(window,'pointerup',event=>{
    if(event.button===2){if(guardedGesture(gesture))cancel();endSecondary(event);return;}
    if(gesture&&event.pointerId===gesture.id&&(event.pointerType==='mouse'||guardedGesture(gesture))&&event.buttons!==0&&event.button===0){detach();render();return;}
    if(!gesture||event.pointerId!==gesture.id||event.button!==0)return;const ok=updateGesture(event),g=detach();stop();
    const st=current();if(!ok||!g||st.preview||st.plan!==g.base||(st.tool||'select')!==g.tool){paint();return;}
    if((groupOperation(g)||g.kind==='group-insert')&&!matchesGestureGroup(st,g)){paint();return;}
    if(g.kind==='equal'){
      if((st.placeAxis||'row')===g.axis&&(!g.grouped||sameMembers(st,g.keys))&&g.equal){
        if(g.moved&&g.equal.ok&&g.equal.count>1)onAction({type:'equal-distribute',keys:[...g.keys],axis:g.axis,count:g.equal.count});
        else if(g.moved&&!g.equal.ok)onAction({type:'notice',text:g.equal.reason});
      }
    }
    else if(g.kind==='group-reframe'){
      if(g.moved&&g.action)onAction(g.action);
      else onAction({type:'notice',text:g.result?.reason||'اسحب لرسم المستطيل الجديد للخانات المحدّدة.'});
    }
    else if(g.kind==='group-transform'){
      if(g.moved&&g.action)onAction(g.action);
      else if(g.moved&&g.result?.reason)onAction({type:'notice',text:g.result.reason});
    }
    else if(g.kind==='group-insert'){
      if(!g.moved)insertAction(g,event);
    }
    else if(g.kind==='marquee'){
      if(!modifiers(event)){if(g.moved&&g.marquee)onAction({type:'marquee-select',keys:[...g.marquee.keys]});else if(!g.moved)pickPoint(g,event);}
    }
    else if(g.kind==='delete'&&!g.moved&&!modifiers(event)){
      // Capture sends pointerup to SVG itself. Resolve the physical element
      // now under the pointer rather than treating the entire cell as art.
      const atRelease=surfaceAt(event,false);
      if(atRelease){
        let item=g.item;
        if(typeof document.elementFromPoint==='function'){
          const el=document.elementFromPoint(event.clientX,event.clientY);
          if(!el||!svg.contains(el))item=null;
          else{const at=surfaceAt({clientX:event.clientX,clientY:event.clientY,target:el},false);item=removalItem(at);}
        }
        if(g.item&&item&&removalKey(item)===removalKey(g.item))onAction({type:'delete-hit',...item});
        else if(!g.item)onAction({type:'notice',text:'لم يُحذف شيء. انقر على لوح داخلي أو حدّ جداري أو قطعة ظاهرة أو الشاشة نفسها. لا يُحذف إطار الدولاب.'});
      }
    }
    else if(g.tool==='point-insert'&&!g.moved){
      if(!g.hit?.dividerId)insertAction(g,event);else if(!modifiers(event)&&surfaceAt(event,false)?.hit?.dividerId===g.hit.dividerId)onAction({type:'direct-board',p:{...g.start},hit:g.hit,client:{x:g.clientX,y:g.clientY}});
    }
    else if((g.kind==='select'||g.kind==='divider'||g.kind==='art')&&!sharedDrag(g)&&!g.moved&&g.target){if(g.tool==='select')pickPoint(g,event);else if(g.tool==='structure')onAction({type:'target',target:g.target});}
    else if(g.kind==='art'&&g.moved&&g.action)onAction(g.action);
    else if(g.kind==='measure'&&g.moved&&g.action&&Math.hypot(g.ruler.b.x-g.ruler.a.x,g.ruler.b.y-g.ruler.a.y)>1e-8)onAction(g.action);
    else if(g.kind==='draw'&&!g.evaluation?.ok)onAction({type:'notice',text:g.evaluation?.reason||'ارسم مساحة كافية للدولاب.'});
    else if(g.kind==='divider'&&g.moved){
      if(g.action&&g.dragStatus?.changed)onAction(g.action);
      else if(g.dragStatus?.reason)onAction({type:'notice',text:g.dragStatus.reason});
    }
    else if(g.moved&&g.action&&g.nextPlan!==g.base)onAction(g.action);
    if(!disposed)paint();
  });
  function cancel(e){stopHover();if(!e||e.pointerId===secondary?.id)clearSecondary();if(!gesture||(e?.pointerId!==undefined&&e.pointerId!==gesture.id))return;detach();render();}
  on(window,'keydown',e=>{if(e.key==='Escape'&&(gesture?.kind==='marquee'||gesture?.kind==='equal'||groupOperation(gesture))){e.preventDefault();e.stopImmediatePropagation?.();cancel();}},{capture:true});
  on(window,'pointercancel',cancel);on(svg,'lostpointercapture',cancel);on(window,'blur',()=>cancel());on(document,'visibilitychange',()=>{if(document.hidden)cancel();});
  on(window,'resize',schedule);const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width||0;if(Math.abs(width-lastWidth)>.5){lastWidth=width;schedule();}}):null;
  observer?.observe(container);render();
  return {render,pickClient,wallPointFromClient,clientPointFromWall,alignPlacement,setDropPreview,externalDropPreview:setDropPreview,cancelGesture(){if(disposed)return false;stopHover();const had=!!(gesture||secondary);clearSecondary();if(!had)return false;detach();render();return true;},destroy(){if(disposed)return;disposed=true;stop();stopHover();clearSecondary();detach();observer?.disconnect();controller.abort();external=null;fadedNode=null;if(photoImage)photoImage.onload=photoImage.onerror=null;photoImage=null;photoData=null;root.remove();},
    exportSvg(){const s=current(),photo=localPhoto(s.photoUrl);primePhoto(photo);if(s.photoUrl&&(!photo||!photoData))throw new Error(photoFailed?'تعذّر تضمين صورة الجدار في ملف التصدير. اختر صورة PNG أو JPEG أو WebP محلية.':'انتظر اكتمال تحميل صورة الجدار قبل التصدير.');return cleanSvg(s.plan,`${id}-export`,photoData);}
  };
}
