// Corner finishes are independent from rectangular CAD unit overrides.
// A purchased panel may be substituted only if explicitly listed by the maker.
export function cleanCornerFronts(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>96)return null;
 for(const [k,v] of Object.entries(raw))if(!/^corner:[a-z][a-z0-9-]{1,55}\+[a-z][a-z0-9-]{1,55}:(base|upper|tall)$/.test(k)||typeof v!=='string'||!/^[a-zA-Z0-9][\w.-]{0,47}$/.test(v))return null;
 return {...raw};
}
export function cornerFrontTargets(doc,catalog){
 const w=doc.room.workshop||{},out=[];
 for(const [key,c] of Object.entries(w.corners||{}))for(const [tier,q] of c.tall?[['tall',c.base]]:[['base',c.base],['upper',c.upper]]){
  const r=catalog?.cornerRecipes?.[q?.build?.recipe];if(!r)continue;
  const id='corner:'+key+':'+tier,defaultItem=catalog.items.find(i=>i.sku===r.frontSku);
  const allowed=catalog.items.filter(i=>[r.frontSku,...(r.frontSkus||[])].includes(i.sku)&&i.kind==='panel'&&i.role==='front'&&i.thicknessMm===defaultItem?.thicknessMm);
  out.push({id,tier,recipe:r,allowed,current:w.finishes?.cornerFronts?.[id]||r.frontSku});
 }
 return out;
}
export function setCornerFront(doc,catalog,id,sku){
 const t=cornerFrontTargets(doc,catalog).find(t=>t.id===id);
 if(!t||!t.allowed.some(i=>i.sku===sku&&i.available!==false))throw Error('الواجهة غير متاحة ضمن الألواح المعتمدة لهذا الركن.');
 const ws=doc.room.workshop,finishes={...ws.finishes},map={...finishes.cornerFronts};
 if(sku===t.recipe.frontSku)delete map[id];else map[id]=sku;
 if(Object.keys(map).length)finishes.cornerFronts=map;else delete finishes.cornerFronts;
 return {...doc,room:{...doc.room,workshop:{...ws,finishes}}};
}
