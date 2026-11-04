// Before a perimeter closes, only this wall's horizontal station and vertical
// elevation exist. No floor layout or field evidence is recorded at this stage.
import {mountChainStep} from './kitchen-chain-ui.js';
import {wallPairDatum,cleanWallPairs} from './kitchen-wall-pair.js';
import {cleanChains} from './kitchen-chain-model.js';

export function stagedPairDatum(lengthMm,heightMm){
 return wallPairDatum({room:{width:lengthMm/10,length:100,height:heightMm/10}},'back');
}
export function mountOutlineWallEntry(host,{lengthMm,heightMm,chain,pairs,wallLabel,onSave,onPairSave,onClose}){
 if(!(Number.isFinite(lengthMm)&&lengthMm>=1&&lengthMm<=18000&&Number.isFinite(heightMm)&&heightMm>=600&&heightMm<=6000)){
  throw Error('أدخل طول الجدار وارتفاع السقف قبل رفع عناصره.');
 }
 const rows=structuredClone(chain?.rows||[]).map(row=>{
  // This is an uncommitted field reading. Only the final wall can own a CAD id.
  delete row.featureId;
  return row;
 });
 const room={width:lengthMm/10,length:100,height:heightMm/10,workshop:{chains:{back:{source:'drawing',rows}}}};
 if(pairs&&Object.keys(pairs).length)room.workshop.wallPairs=cleanWallPairs({back:pairs});
 let local={room,kitchen:{version:1,nextId:1,features:[],runs:[],units:[]}};
 const controls=mountChainStep(host,{
  getDoc:()=>local,apply(next){
   const value=next.room.workshop.wallPairs?.back;
   const out=onPairSave?.(value);
   if(out?.ok===false)return out;
   local=next;return {ok:true,saved:true};
  },focus:{wall:'back'},
  localFace:{
   label:wallLabel,close:onClose,
   save(draft){
    const clean=cleanChains({back:{source:'drawing',rows:draft.rows}})?.back;
    if(!clean)return {ok:false,reason:'راجع مواضع العناصر وأبعادها على الجدار.'};
    return onSave(clean,local.room.workshop.wallPairs?.back);
   }
  }
 });
 const dispose=()=>controls.destroy();
 dispose.requestLeave=controls.requestLeave;
 return dispose;
}
