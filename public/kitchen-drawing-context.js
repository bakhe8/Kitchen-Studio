// One context menu for mouse, pen, keyboard and stationary touch. Commands are
// supplied by the selected editor, so opening the menu cannot change the design.
export function mountDrawingContext(host,{getSvg,actionsAt,cancelGesture=()=>{}}){
 const doc=host.ownerDocument||globalThis.document,win=doc?.defaultView||globalThis.window,cleanup=[];
 let menu=null,pending=null,timer=null,suppress=null,focusOwner=null;
 function on(node,type,fn,options){node?.addEventListener?.(type,fn,options);cleanup.push(()=>node?.removeEventListener?.(type,fn,options));}
 function inside(node,target){return !!node&&(node===target||node.contains?.(target));}
 function stop(e){e.preventDefault?.();e.stopImmediatePropagation?.();}
 function clearHold(){clearTimeout(timer);timer=null;pending=null;}
 function close(restore=false){
  clearHold();if(!menu)return;menu.remove();menu=null;
  if(restore&&focusOwner?.isConnected!==false)focusOwner?.focus?.({preventScroll:true});focusOwner=null;
 }
 function open(e,svg){
  if(!doc?.body||!svg||!inside(svg,e.target))return false;
  clearHold();cancelGesture();
  const current=getSvg();
  if(current!==svg){
   if(!current)return false;
   const hit=doc.elementFromPoint?.(e.clientX,e.clientY);
   if(!e.keyboard&&!inside(current,hit))return false;
   svg=current;e={...e,target:e.keyboard?svg:hit};
  }
  const spec=actionsAt(e,svg);if(!spec?.actions?.length){close();return false;}
  close();focusOwner=svg;menu=doc.createElement('div');
  menu.className='k-drawing-menu';menu.dir='rtl';menu.setAttribute('role','menu');menu.setAttribute('aria-label',spec.title||'خيارات الرسم');
  if(spec.title){const heading=doc.createElement('strong');heading.textContent=spec.title;menu.append(heading);}
  const buttons=spec.actions.map(({label,run})=>{
   const b=doc.createElement('button');b.type='button';b.textContent=label;b.setAttribute('role','menuitem');
   b.addEventListener('click',()=>{const current=getSvg()===svg&&svg.isConnected!==false;close(true);if(current)run();});menu.append(b);return b;
  });
  menu.addEventListener('keydown',ev=>{
   if(ev.key==='Escape'){stop(ev);close(true);return;}
   if(ev.key==='Tab'){close(true);return;}
   const i=buttons.indexOf(doc.activeElement);
   const dest={ArrowDown:(i+1)%buttons.length,ArrowUp:(i+buttons.length-1)%buttons.length,Home:0,End:buttons.length-1}[ev.key];
   if(dest!==undefined){stop(ev);buttons[dest].focus();}
  });
  doc.body.append(menu);
  const box=menu.getBoundingClientRect(),width=win?.innerWidth||doc.documentElement?.clientWidth||1024,height=win?.innerHeight||doc.documentElement?.clientHeight||768;
  menu.style.left=Math.max(6,Math.min(e.clientX,width-box.width-6))+'px';
  menu.style.top=Math.max(6,Math.min(e.clientY,height-box.height-6))+'px';
  buttons[0].focus({preventScroll:true});return true;
 }
 function down(e){
  if(!inside(getSvg(),e.target)||!['touch','pen'].includes(e.pointerType)||e.button!==0||e.isPrimary===false)return;
  clearHold();const svg=getSvg(),point={target:e.target,clientX:e.clientX,clientY:e.clientY,pointerType:e.pointerType,pointerId:e.pointerId,keyboard:false};
  pending=point;timer=setTimeout(()=>{
   if(pending!==point||getSvg()!==svg||!svg.isConnected)return;
   if(open(point,svg))suppress={id:point.pointerId,until:Date.now()+1600};
  },540);
 }
 function trigger(e){
  const svg=getSvg(),held=pending;
  // Native touch menus can arrive before our timer, after the stroke has
  // captured the pointer on the paper. Keep the originally pressed object.
  const useHold=held&&['touch','pen'].includes(e.pointerType||held.pointerType)&&inside(svg,held.target);
  const target=useHold?held.target:e.target;
  if(!inside(svg,target))return;
  if(suppress&&menu&&Date.now()<suppress.until){stop(e);return;}
  const keyboard=!useHold&&!e.clientX&&!e.clientY&&e.button!==2;
  const b=keyboard?svg.getBoundingClientRect():null;
  const point=useHold?held:{target,clientX:b?b.left+b.width/2:e.clientX,clientY:b?b.top+b.height/2:e.clientY,pointerType:e.pointerType,keyboard};
  if(open(point,svg)){stop(e);if(useHold)suppress={id:held.pointerId,until:Date.now()+1600};}
 }
 function key(e){
  const svg=getSvg();if(!(e.key==='ContextMenu'||e.key==='F10'&&e.shiftKey)||!inside(svg,e.target))return;
  const b=svg.getBoundingClientRect();if(open({target:e.target,keyboard:true,clientX:b.left+b.width/2,clientY:b.top+b.height/2},svg))stop(e);
 }
 function globalDown(e){
  suppress=null;if(pending&&pending.pointerId!==e.pointerId)clearHold();
  if(menu&&!inside(menu,e.target))close();
 }
 function move(e){if(pending?.pointerId===e.pointerId&&Math.hypot(e.clientX-pending.clientX,e.clientY-pending.clientY)>7)clearHold();}
 function end(e){if(pending?.pointerId===e.pointerId)clearHold();if(suppress?.id===e.pointerId){suppress.until=Date.now()+700;stop(e);}}
 function click(e){if(suppress&&Date.now()<suppress.until&&(e.pointerId==null||e.pointerId===-1||e.pointerId===suppress.id)){suppress=null;stop(e);}}
 on(doc,'pointerdown',globalDown,true);on(host,'pointerdown',down,true);on(doc,'pointermove',move,true);on(doc,'pointerup',end,true);
 on(doc,'pointercancel',e=>{if(pending?.pointerId===e.pointerId)clearHold();},true);
 on(doc,'click',click,true);on(host,'contextmenu',trigger,true);on(host,'keydown',key,true);
 on(doc,'focusin',e=>{if(menu&&!inside(menu,e.target))close();},true);
 on(doc,'scroll',e=>{if(!inside(menu,e.target))close();},true);
 on(win,'resize',()=>close());on(win,'blur',()=>close());
 return {close,destroy(){close();cleanup.forEach(f=>f());}};
}
