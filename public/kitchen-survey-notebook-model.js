import {roomArchitecture} from './kitchen-architecture.js';
import {resolveChain,attestChain,confirmedChainFeature,sameSurveyReading} from './kitchen-chain-model.js';

const emptyChain=()=>({source:'drawing',rows:[]});
const sameAttestation=(a,b)=>a&&b&&['name','reference','date','key'].every(key=>a[key]===b[key]);

/**
 * Read-only view of a real project's wall survey. Dimensions are millimetres;
 * readingCount includes explicit start/stop/corner measurements. `valid` is
 * chain geometry validity, while `proofValid` requires the saved technician
 * attestation and matching saved CAD features. Neither field asserts release
 * readiness or coverage of independent CAD references on the same wall.
 *
 * The controller owns unsaved wall and pending gesture state and supplies
 * `dirty`/`pending`; the helper never writes storage or adds survey metadata.
 */
export function surveyNotebookSummary(doc,wall,chain,{dirty=false,pending=false}={}){
  const room=doc?.room,edge=room&&roomArchitecture(room).walls.find(item=>item.id===wall);
  const saved=room?.workshop?.chains?.[wall],candidate=chain??saved??emptyChain();
  const resolved=edge?resolveChain(room,wall,candidate):{ok:false,reason:'الجدار المحدد غير موجود في المشروع.'};
  let proofValid=false;
  if(!dirty&&!pending&&resolved.ok&&candidate.source==='field'&&saved?.source==='field'&&sameAttestation(candidate.attestation,saved.attestation)){
    const proof=attestChain(doc,wall,candidate,candidate.attestation);
    // A cached candidate must not hide a later saved-chain change. In a
    // corner-only survey there are no CAD features to perform this check.
    const savedProof=attestChain(doc,wall,saved,saved.attestation);
    if(proof.ok&&proof.chain.attestation.key===candidate.attestation.key&&savedProof.ok&&savedProof.chain.attestation.key===saved.attestation.key){
      const actual=new Map((doc.kitchen?.features||[]).map(feature=>[feature.id,feature]));
      // confirmedChainFeature compares its argument with the signed chain; pass
      // the actual CAD object so a later CAD-only edit cannot retain proof.
      proofValid=resolved.features.every(feature=>{
        const storedFeature=actual.get(feature.id);
        return sameSurveyReading(feature,storedFeature)&&confirmedChainFeature(doc,storedFeature);
      });
    }
  }
  const status=pending?'تعديل قياس بانتظار التطبيق'
    :dirty?'قياسات غير محفوظة'
    :!resolved.ok?'قياسات غير صالحة'
    :proofValid?'رفع ميداني موثّق'
    :candidate.attestation||candidate.source==='field'?'يحتاج إعادة توثيق'
    :saved?'محفوظ دون توثيق ميداني':'لم تُحفظ قياسات الجدار';
  const sourceLabel=({drawing:'مرجع من الرسم',example:'قياسات مثال',field:'رفع ميداني'})[candidate.source||'drawing']||'مصدر غير معروف';
  return {
    projectId:room?.projectId||'',projectName:room?.name||'',wallLabel:edge?.label||'',
    lengthMm:edge?edge.length*10:null,heightMm:Number.isFinite(room?.height)?room.height*10:null,
    readingCount:Array.isArray(candidate.rows)?candidate.rows.length:0,
    closed:resolved.ok&&resolved.closed,remainingMm:resolved.ok?resolved.remainingMm:null,
    valid:resolved.ok,error:resolved.ok?'':resolved.reason,proofValid,status,sourceLabel
  };
}
