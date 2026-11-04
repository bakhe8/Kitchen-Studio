// This module owns the pointer cycle, not the plan. The caller resolves a
// viewport point against the live canvas and decides whether a drop is valid.
const selector = 'button[data-drag-divider],button[data-drag-content]';
const items = new Map([
  ['empty','إفراغ الخانة'], ['books','كتب'], ['boxes','صناديق'], ['plant','نبتة'], ['vase','مزهرية']
]);
const svgNS = 'http://www.w3.org/2000/svg';
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const coords = e => ({x:e.clientX, y:e.clientY});
const validPoint = p => Number.isFinite(p.x) && Number.isFinite(p.y);

function payloadFor(button) {
  const {dragDivider:axis,dragContent:content} = button.dataset;
  if (axis === 'row' || axis === 'col') return Object.freeze({kind:'divider',axis});
  return items.has(content) ? Object.freeze({kind:'content',content}) : null;
}

function makeGhost(doc,payload) {
  const divider = payload.kind === 'divider';
  const symbol = divider ? payload.axis : payload.content;
  const title = divider ? (payload.axis === 'row' ? 'تقسيم أفقي' : 'تقسيم رأسي') : items.get(symbol);
  const ghost = doc.createElement('div');
  ghost.className = 'sp-palette-ghost';
  ghost.dataset.kind = payload.kind;
  ghost.setAttribute('aria-hidden','true');
  ghost.dir = 'rtl';
  const svg = doc.createElementNS(svgNS,'svg'), use = doc.createElementNS(svgNS,'use');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  use.setAttribute('href',`#sp-i-${symbol}`);
  svg.append(use);
  const copy=doc.createElement('span'), label=doc.createElement('strong'), hint=doc.createElement('small');
  copy.className='sp-palette-ghost-copy';
  hint.hidden=true;
  label.textContent = title;
  copy.append(label,hint);
  ghost.append(svg,copy);
  doc.body.append(ghost);
  return {ghost,hint};
}

/**
 * root may be the document or a container holding the source buttons. All
 * callback points are CSS viewport pixels, including after page scrolling.
 * onPreview may return {ok:true|false|null,label:string} for visual feedback;
 * onPreview and onCancel must not mutate the plan. onDrop validates the final
 * location; its invocation says only that a drag ended, not that it is valid.
 */
export function mountPaletteDrag(root,{onPreview,onDrop,onCancel,onNotice} = {}) {
  if (!root?.addEventListener) throw new TypeError('mountPaletteDrag requires a DOM root');
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const win = doc.defaultView;
  const controller = new (win.AbortController || AbortController)();
  const capt = {capture:true,passive:false,signal:controller.signal};
  const guards = new Map();
  const contacts = new Set();
  let session = null, frame = 0, destroyed = false;

  function clearGuard(id) {
    const guard = guards.get(id);
    if (guard?.timer) win.clearTimeout(guard.timer);
    guards.delete(id);
  }
  function suppress(id,source,p,released) {
    clearGuard(id);
    const guard = {source,p,timer:0};
    guards.set(id,guard);
    if (released) guard.timer = win.setTimeout(() => { if (guards.get(id) === guard) clearGuard(id); },900);
    // A page may lose the final up (e.g. after blur). Retain a bounded set
    // until release or the *next* actual down, never suppressing a later tap.
    if (guards.size > 8) clearGuard(guards.keys().next().value);
  }
  function onClick(e) {
    // Keyboard and assistive activation are independent of a pointer gesture.
    if (!e.detail && !e.pointerType) return;
    const knownId = Number.isFinite(e.pointerId) && e.pointerId >= 0;
    let hit;
    if (knownId && guards.has(e.pointerId)) hit = e.pointerId;
    if (!knownId) for (const [id,g] of guards) {
      const sameSource = g.source && (e.target === g.source || g.source.contains?.(e.target));
      const samePoint = g.p && Math.hypot(e.clientX-g.p.x,e.clientY-g.p.y) <= 4;
      if (sameSource || samePoint) {hit=id;break;}
    }
    if (hit === undefined) return;
    clearGuard(hit);
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  function sourceAt(e) {
    const source = e.target.closest?.(selector) || e.composedPath?.().find(el => el.matches?.(selector));
    return source && root.contains(source) && !source.disabled && !source.closest('[inert],[hidden]') ? source : null;
  }
  const inRoot = node => !!node && (node===root || !!node.nodeType && root.contains(node));
  function clean(g) {
    // Clear first: releasing capture also generates lostpointercapture.
    session = null;
    if (frame) {win.cancelAnimationFrame(frame);frame=0;}
    g.ghost?.remove();
    g.source.classList.remove('sp-palette-origin-active');
    if (g.dragging) doc.documentElement.classList.remove('sp-palette-is-dragging');
    try { if (g.dragging && g.source.hasPointerCapture(g.id)) g.source.releasePointerCapture(g.id); } catch { /* Already released. */ }
  }
  function cancel(released = false) {
    const g = session;
    if (!g) return false;
    suppress(g.id,g.source,g.last,released);
    clean(g);
    onCancel?.();
    return true;
  }
  function usable(g) {
    return g.source.isConnected && !g.source.disabled && !g.source.closest('[hidden],[inert],details:not([open])');
  }
  function preview(g) {
    if (session !== g) return;
    const p = g.last;
    let result;
    try {result=onPreview?.(g.payload,{...p});} catch(error) {cancel();throw error;}
    if (session !== g) return;
    if (g.ghost) {
      const state=result?.ok===true?'valid':result?.ok===false?'invalid':'neutral';
      const hint=typeof result?.label==='string'?result.label:'';
      if(g.feedbackState!==state || g.hint.textContent!==hint || !g.ghostW){
        g.feedbackState=state;g.ghost.dataset.feedback=state;g.hint.textContent=hint;g.hint.hidden=!hint;
        const box=g.ghost.getBoundingClientRect();g.ghostW=box.width;g.ghostH=box.height;
      }
      const width=win.innerWidth, height=win.innerHeight, gap=g.touch?23:14;
      let x=g.touch?p.x-g.ghostW/2:p.x+gap, y=g.touch?p.y-g.ghostH-gap:p.y+gap;
      if (x+g.ghostW>width-4) x=p.x-g.ghostW-gap;
      if (y+g.ghostH>height-4) y=p.y-g.ghostH-gap;
      if (y<4) y=p.y+gap;
      x=clamp(x,4,Math.max(4,width-g.ghostW-4));y=clamp(y,4,Math.max(4,height-g.ghostH-4));
      g.ghost.style.transform=`translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
    }
    g.dirty=false;
  }
  function queueFrame() {if (!frame && session?.dragging) frame=win.requestAnimationFrame(tick);}
  function tick(time) {
    frame=0;
    const g=session;
    if (!g?.dragging) return;
    if (!usable(g)) {cancel();return;}
    const dt=g.tickTime?clamp(time-g.tickTime,6,32):16;
    g.tickTime=time;
    const edge=clamp(win.innerHeight*.12,36,82), {x,y}=g.last;
    const inside=x>=0 && x<=win.innerWidth && y>=0 && y<=win.innerHeight;
    const ratio=!inside?0:y<edge?-(edge-y)/edge:y>win.innerHeight-edge?(y-(win.innerHeight-edge))/edge:0;
    let scrolled=false;
    if (ratio) {
      const page=doc.scrollingElement || doc.documentElement;
      const before=page.scrollTop, max=Math.max(0,page.scrollHeight-page.clientHeight);
      const step=Math.sign(ratio)*Math.max(1,Math.round(760*ratio*ratio*dt/1000));
      const next=clamp(before+step,0,max);
      if (Math.abs(next-before)>=.5) {
        win.scrollBy({left:0,top:next-before,behavior:'instant'});
        scrolled=Math.abs(page.scrollTop-before)>=.5;
      }
    }
    if (g.dirty || scrolled) preview(g);
    if (scrolled && session===g) queueFrame();
  }
  function startDrag(g,capture) {
    if (g.dragging) return;
    g.dragging=true;
    if (capture) try {g.source.setPointerCapture(g.id);} catch { /* Window listeners still track the active pointer. */ }
    if (session!==g) return;
    g.source.classList.add('sp-palette-origin-active');
    doc.documentElement.classList.add('sp-palette-is-dragging');
    Object.assign(g,makeGhost(doc,g.payload));
  }
  function onDown(e) {
    if (destroyed) return;
    // A primary pen and a primary touch can both exist at the same time. One
    // is sufficient to reject a palette start while the other is still held.
    const otherHeld=[...contacts].some(id=>id!==e.pointerId);
    contacts.add(e.pointerId);
    // A fresh down for the same primary contact means its previous up was
    // outside this window. Never finish a stale drag using the new click.
    if(session?.id===e.pointerId && e.isPrimary!==false && e.button===0 && e.buttons===1) cancel(true);
    if (session) {
      if (session.id!==e.pointerId || e.button!==0 || e.buttons!==1) {
        // Also prevent a second contact on the planner from activating its own
        // button while it interrupts this gesture.
        if (session.id!==e.pointerId && inRoot(e.target)) suppress(e.pointerId,e.target,coords(e),false);
        cancel();
        if (inRoot(e.target)) {e.preventDefault();e.stopPropagation();}
      }
      return;
    }
    clearGuard(e.pointerId);
    const source=sourceAt(e);
    if (otherHeld || e.isPrimary===false) {
      if (source) {suppress(e.pointerId,source,coords(e),false);e.preventDefault();e.stopPropagation();}
      return;
    }
    if (e.button!==0 || e.buttons!==1) return;
    const payload=source && payloadFor(source), p=coords(e);
    if (!payload || !validPoint(p)) return;
    // Do not capture/prevent a short press. The browser preserves normal button
    // focus, click and the usual release-outside behavior until drag starts.
    session={id:e.pointerId,source,payload,start:p,last:p,touch:e.pointerType==='touch',
      threshold:e.pointerType==='touch'?8:5,dragging:false,ghost:null,dirty:false,tickTime:0};
  }
  const crossed=(g,p)=>Math.hypot(p.x-g.start.x,p.y-g.start.y)>=g.threshold;
  function onMove(e) {
    if (!e.buttons) contacts.delete(e.pointerId);
    const g=session;
    if (!g || g.id!==e.pointerId) return;
    const p=coords(e);
    if (!usable(g) || !validPoint(p) || e.isPrimary===false || e.buttons!==1) {cancel(e.buttons===0);return;}
    g.last=p;
    if (!g.dragging && !crossed(g,p)) return;
    e.preventDefault();
    if (!g.dragging) {startDrag(g,true);preview(g);} else g.dirty=true;
    queueFrame();
  }
  function onUp(e) {
    contacts.delete(e.pointerId);
    const g=session, p=coords(e);
    if (!g || g.id!==e.pointerId) {
      const b=guards.get(e.pointerId);
      if (b) suppress(e.pointerId,b.source,p,true);
      return;
    }
    if (!validPoint(p) || !usable(g) || e.isPrimary===false || e.button!==0 || e.buttons!==0) {cancel(true);return;}
    g.last=p;
    if (!g.dragging && !crossed(g,p)) {clean(g);return;}
    e.preventDefault();
    // Some devices coalesce the last move into up. Always resolve this exact
    // release point, even if there were no intervening move events at all.
    if (!g.dragging) startDrag(g,false);
    preview(g);
    if (session!==g) return;
    suppress(g.id,g.source,p,true);
    clean(g);
    onDrop?.(g.payload,{...p});
  }
  function interrupted(e) {
    if (e.type==='pointercancel') contacts.delete(e.pointerId);
    if (session?.id===e.pointerId) {
      // Touch can give implicit capture to an SVG *inside* the button. Moving
      // capture to the source button legitimately releases that inner node.
      if(e.type==='lostpointercapture' && e.target!==session.source && session.source.hasPointerCapture?.(e.pointerId)) return;
      cancel(e.type==='pointercancel');
    }
    else if(e.type==='pointercancel' && guards.has(e.pointerId)) suppress(e.pointerId,guards.get(e.pointerId).source,coords(e),true);
  }
  function scrolled() {if(session?.dragging){session.dirty=true;queueFrame();}}
  win.addEventListener('pointerdown',onDown,capt);
  win.addEventListener('pointermove',onMove,capt);
  win.addEventListener('pointerup',onUp,capt);
  win.addEventListener('pointercancel',interrupted,capt);
  win.addEventListener('lostpointercapture',interrupted,capt);
  win.addEventListener('pointerout',e=>{
    if (session?.id===e.pointerId && !e.relatedTarget && !session.source.hasPointerCapture?.(e.pointerId)) cancel();
  },capt);
  win.addEventListener('click',onClick,capt);
  win.addEventListener('blur',()=>{contacts.clear();cancel();},{signal:controller.signal});
  win.addEventListener('scroll',scrolled,{capture:true,passive:true,signal:controller.signal});
  win.addEventListener('resize',scrolled,{passive:true,signal:controller.signal});
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden){contacts.clear();cancel();}},{signal:controller.signal});
  doc.addEventListener('keydown',e=>{if(e.key==='Escape' && session){e.preventDefault();cancel();onNotice?.('أُلغي السحب.');}},{signal:controller.signal});
  return {
    cancel:()=>cancel(),
    destroy(){if(destroyed)return;destroyed=true;try{cancel();}finally{controller.abort();contacts.clear();for(const id of [...guards.keys()])clearGuard(id);}}
  };
}
