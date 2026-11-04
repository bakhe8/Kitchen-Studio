// Minimal DOM boundary for mounted workshop navigation checks.
import assert from 'node:assert/strict';
const decode=s=>String(s).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const encode=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
const attrList=s=>Object.fromEntries([...s.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(m=>[m[1],decode(m[2]??m[3]??m[4]??'')]));
const dataKey=s=>s.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
const voidTags=new Set(['input','img','br','hr','meta','link','wbr','source','area','base','embed','param']);
export class Node {
 constructor(tag='div',attrs={},parent=null){
  this.tagName=tag.toUpperCase();this.attrs={...attrs};this.parentNode=parent;this.children=[];this.listeners=new Map();
  this.style={setProperty(){}};this.scrollTop=0;this.dataset=Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[dataKey(k),v]));
  this.classList={add:(...names)=>this.setAttribute('class',[...new Set([...this.classes(),...names])].join(' ')),remove:(...names)=>this.setAttribute('class',this.classes().filter(n=>!names.includes(n)).join(' ')),contains:name=>this.classes().includes(name),toggle:(name,force)=>{const yes=force??!this.classes().includes(name);this.classList[yes?'add':'remove'](name);return yes;}};
 }
 classes(){return (this.attrs.class||'').split(/\s+/).filter(Boolean);}
 get isConnected(){return this.root===true||!!this.parentNode?.isConnected;}
 get value(){if(this._value!==undefined)return this._value;if(this.tagName==='SELECT'){const options=this.querySelectorAll('option');return (options.find(n=>n.hasAttribute('selected'))||options[0])?.getAttribute('value')??'';}return this.getAttribute('value')??'';}
 set value(v){this._value=String(v);}
 get disabled(){return this.hasAttribute('disabled');}set disabled(v){v?this.setAttribute('disabled',''):this.removeAttribute('disabled');}
 get options(){return this.querySelectorAll('option');}
 get textContent(){return this.children.map(n=>typeof n==='string'?decode(n):n.textContent).join('');}
 set textContent(v){this.detach();this.children=[String(v)];}
 detach(){for(const child of this.children)if(typeof child!=='string')child.parentNode=null;}
 get innerHTML(){return this.children.map(n=>typeof n==='string'?n:n.outerHTML).join('');}
 set innerHTML(html){
  this.detach();this.children=[];const stack=[this];
  for(const token of String(html).match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)||[]){
   if(token.startsWith('<!--'))continue;
   if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}
   if(token.startsWith('<')){
    const m=token.match(/^<([\w:-]+)([\s\S]*?)\/?\s*>$/);if(!m)continue;
    const parent=stack.at(-1),node=new Node(m[1],attrList(m[2]),parent);parent.children.push(node);
    if(!voidTags.has(m[1].toLowerCase())&&!token.endsWith('/>'))stack.push(node);
   }else stack.at(-1).children.push(token);
  }
 }
 get outerHTML(){const tag=this.tagName.toLowerCase(),attrs=Object.entries(this.attrs).map(([k,v])=>' '+k+'="'+encode(v)+'"').join('');return '<'+tag+attrs+'>'+this.innerHTML+(voidTags.has(tag)?'':'</'+tag+'>');}
 getAttribute(k){return this.attrs[k]??null;}
 hasAttribute(k){return Object.hasOwn(this.attrs,k);}
 setAttribute(k,v){this.attrs[k]=String(v);if(k.startsWith('data-'))this.dataset[dataKey(k)]=String(v);}
 removeAttribute(k){delete this.attrs[k];if(k.startsWith('data-'))delete this.dataset[dataKey(k)];}
 matches(selector){return selector.split(',').some(s=>{
  s=s.trim();const absent=[...s.matchAll(/:not\(([^)]+)\)/g)].map(m=>m[1]);s=s.replace(/:not\([^)]+\)/g,'');if(absent.some(x=>this.matches(x)))return false;
  if(s.includes(':disabled')&&!this.disabled)return false;s=s.replace(/:disabled/g,'');
  const tag=s.match(/^[\w-]+/)?.[0];if(tag&&tag.toUpperCase()!==this.tagName)return false;
  if([...s.matchAll(/\.([\w-]+)/g)].some(m=>!this.classes().includes(m[1])))return false;
  return [...s.matchAll(/\[([^\]=\s]+)(?:=["']?([^\]"']*)["']?)?\]/g)].every(m=>this.hasAttribute(m[1])&&(m[2]===undefined||this.getAttribute(m[1])===m[2]));
 });}
 closest(selector){for(let n=this;n;n=n.parentNode)if(n.matches(selector))return n;return null;}
 querySelectorAll(selector){
  const parts=selector.trim().split(/\s+(?=(?:[^"']|"[^"]*"|'[^']*')*$)/),last=parts.pop(),out=[];
  const walk=node=>{for(const child of node.children)if(typeof child!=='string'){
   if(child.matches(last)){let n=child.parentNode;const ancestors=[...parts];while(ancestors.length&&n){if(n.matches(ancestors.at(-1)))ancestors.pop();n=n.parentNode;}if(!ancestors.length)out.push(child);}
   walk(child);
  }};walk(this);return out;
 }
 querySelector(s){return this.querySelectorAll(s)[0]??null;}
 contains(target){for(let n=target;n;n=n.parentNode)if(n===this)return true;return false;}
 focus(){this.focused=true;}getBoundingClientRect(){return {left:0,top:0,right:900,bottom:600,width:900,height:600};}
 getScreenCTM(){return {inverse:()=>({a:1,b:0,c:0,d:1,e:0,f:0})};}
 createSVGPoint(){return {x:0,y:0,matrixTransform(m){return {x:this.x*m.a+this.y*m.c+m.e,y:this.x*m.b+this.y*m.d+m.f};}};}
 addEventListener(type,fn,options){const list=this.listeners.get(type)||[];list.push({fn,capture:options===true||!!options?.capture});this.listeners.set(type,list);}
 removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(e=>e.fn!==fn));}
}
export async function fire(type,target,more={}){
 assert(target,'the requested control exists in actual rendered markup');
 const path=[];for(let node=target;node;node=node.parentNode)path.push(node);
 const event={type,target,button:0,detail:1,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediateStopped=this.stopped=true;},...more};
 for(const node of [...path].reverse())for(const {fn,capture} of [...(node.listeners.get(type)||[])]){if(capture&&!event.immediateStopped)await fn(event);}
 if(!event.stopped)for(const node of path){
  if(typeof node['on'+type]==='function')await node['on'+type](event);
  for(const {fn,capture} of [...(node.listeners.get(type)||[])])if(!capture&&!event.immediateStopped)await fn(event);
  if(event.stopped)break;
 }
 return event;
}

// Workshop shell and dynamic children need normal ownership and reparenting.
Object.defineProperties(Node.prototype,{
 className:{get(){return this.attrs.class||'';},set(value){this.setAttribute('class',value);}},
 ownerDocument:{get(){return this._document||this.parentNode?.ownerDocument||globalThis.document;},set(value){this._document=value;}}
});
Node.prototype.append=function(...nodes){for(const node of nodes){node.remove?.();if(typeof node!=='string')node.parentNode=this;this.children.push(node);}};
Node.prototype.replaceChildren=function(...nodes){this.detach();this.children=[];this.append(...nodes);};
Node.prototype.remove=function(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;};
Node.prototype.getClientRects=function(){return this.isConnected&&!this.hidden?[this.getBoundingClientRect()]:[];};
Node.prototype.focus=function(){this.focused=true;this.ownerDocument.activeElement=this;};
export class Store{data=new Map();getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
