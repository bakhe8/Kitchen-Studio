// Material flow for one SKU/finish/orientation. Offcuts are dimensioned stock
// on this project; results are a proposal, not a concurrent inventory ledger.
const rnd=v=>Math.round(v*1000)/1000;
const eps=1e-7;
export function cleanOffcuts(v,item){
 if(v==null)return [];
 if(!Array.isArray(v)||v.length>80||item.kind==='piece'&&v.length)return null;
 const names=new Set(),res=[];let qty=0;
 for(const x of v){
  if(!x||typeof x.ref!=='string'||!x.ref.trim()||x.ref.length>64||names.has(x.ref.trim())||!Number.isInteger(x.count)||x.count<1||
   !Number.isFinite(x.lengthMm)||x.lengthMm<=0||x.lengthMm>item.stockLengthMm)return null;
  if(item.kind==='panel'&&(!Number.isFinite(x.widthMm)||x.widthMm<=0||x.widthMm>item.stockWidthMm))return null;
  qty+=x.count;if(qty>1000)return null;names.add(x.ref.trim());
  res.push({ref:x.ref.trim(),count:x.count,lengthMm:x.lengthMm,widthMm:item.kind==='panel'?x.widthMm:0});
 }
 return res;
}
export const spanFits=(have,take,kerf)=>take<=have+eps&&(Math.abs(have-take)<eps||have-take+eps>=kerf);
export function packedStock(item,parts){
 const isSheet=item.kind==='panel',area=(w,h)=>isSheet?w*h:w,unit=isSheet?'م²':'م طولي',scale=isSheet?1e6:1000;
 const freshSize=area(item.stockLengthMm,item.stockWidthMm),blocks=[],uses=new Map(),layout=[];let qty=0,net=0,loss=0;
 const stock=(id,source,w,h)=>({id,source,x:0,y:0,w,h});
 for(const o of item.offcuts||[])for(let i=1;i<=o.count;i++)blocks.push(stock(o.ref+' #'+i,'offcut',o.lengthMm,o.widthMm));
 blocks.sort((a,b)=>area(a.w,a.h)-area(b.w,b.h));
 const pieces=parts.flatMap(p=>Array(p.count).fill(p)).sort((a,b)=>area(b.a,b.b)-area(a.a,a.b));
 const fits=(block,p)=>spanFits(block.w,p.a,item.kerfMm)&&(!isSheet||spanFits(block.h,p.b,item.kerfMm));
 for(const p of pieces){
  let i=blocks.findIndex(b=>b.source==='offcut'&&fits(b,p));
  if(i<0)i=blocks.findIndex(b=>fits(b,p));
  if(i<0){const b=stock('خام '+(qty+1),'stock',item.stockLengthMm,item.stockWidthMm);if(!fits(b,p))return null;qty++;blocks.push(b);i=blocks.length-1;}
  const b=blocks.splice(i,1)[0],kx=b.w>p.a+eps?item.kerfMm:0,ky=isSheet&&b.h>p.b+eps?item.kerfMm:0;
  const right=rnd(b.w-p.a-kx),down=isSheet?rnd(b.h-p.b-ky):0;
  if(right>0)blocks.push({...b,x:b.x+p.a+kx,w:right});
  if(down>0)blocks.push({...b,y:b.y+p.b+ky,w:p.a,h:down});
  const pieceSize=area(p.a,p.b),saw=isSheet?b.h*kx+p.a*ky:kx;
  net+=pieceSize;loss+=saw;
  if(b.source==='offcut')uses.set(b.id,(uses.get(b.id)||0)+pieceSize+saw);
  layout.push({ref:b.id,source:b.source,unitId:p.unitId,label:p.label,xMm:rnd(b.x),yMm:isSheet?rnd(b.y):null,a:p.a,b:p.b});
 }
 const usedRemnants=[...uses.values()].reduce((a,b)=>a+b,0);
 const leftovers=blocks.filter(b=>b.source==='stock'||uses.has(b.id)).map(b=>({ref:b.id,source:b.source,xMm:rnd(b.x),yMm:isSheet?rnd(b.y):null,lengthMm:b.w,widthMm:isSheet?b.h:null}));
 return {qty,net:rnd(net/scale),purchased:rnd(qty*freshSize/scale),offcutUse:rnd(usedRemnants/scale),
  valueUnits:qty+usedRemnants/freshSize,loss:rnd(loss/scale),unit,layout,leftovers};
}
