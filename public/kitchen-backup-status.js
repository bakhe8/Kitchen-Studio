// When this project was last copied out of the browser (a downloaded project file or a cloud upload), and whether it changed afterwards.
// A browser can clear a site's storage, so a project that was never copied out has only one home.
import {stableHash} from './kitchen-measurement-identity.js';
export const backupKey=projectId=>'atlas-kitchen:backup:'+projectId;
const places={file:'ملف المشروع',cloud:'السحابة'};
const when=new Intl.DateTimeFormat('ar-SA',{calendar:'gregory',day:'numeric',month:'long',hour:'numeric',minute:'2-digit',timeZone:'Asia/Riyadh'});
const storeOf=store=>store??globalThis.localStorage;
const stampOf=text=>stableHash(String(text??''));

// `text` is the project exactly as stored in this browser when the copy was made. Only the latest copy is kept.
export function recordBackup({store,projectId,text,kind,now=Date.now()}){
 if(!projectId||typeof text!=='string'||!places[kind])return false;
 try{storeOf(store).setItem(backupKey(projectId),JSON.stringify({at:now,kind,stamp:stampOf(text)}));return true;}catch{return false;}
}
export function backupStatus({store,projectId,text}){
 if(!projectId)return {state:'unknown'};
 let saved=null;
 try{saved=JSON.parse(storeOf(store)?.getItem(backupKey(projectId)));}catch{/* no record */}
 if(!saved||!Number.isFinite(saved.at)||!places[saved.kind]||typeof saved.stamp!=='string')return {state:'never'};
 return {state:saved.stamp===stampOf(text)?'current':'changed',kind:saved.kind,at:saved.at};
}
export function backupText(status){
 if(status.state==='never')return 'لم تُؤخذ نسخة احتياطية من هذا المشروع خارج المتصفح. إن مُسحت بيانات المتصفح أو فُقد الجهاز ضاع المشروع.';
 if(status.state!=='current'&&status.state!=='changed')return '';
 const last='آخر نسخة احتياطية: '+places[status.kind]+' · '+when.format(new Date(status.at))+'. ';
 return last+(status.state==='current'?'لم يتغيّر المشروع بعدها.':'تغيّر المشروع بعدها، فخذ نسخة جديدة.');
}
// A short line to add after a milestone (the customer's approval, the factory release) when the work is not yet copied out.
export function backupReminder(status){
 if(status.state==='never')return ' لم تُؤخذ نسخة احتياطية من هذا المشروع بعد. نزّل ملف المشروع من «ملف المشروع».';
 if(status.state==='changed')return ' تغيّر المشروع بعد آخر نسخة احتياطية. نزّل ملف المشروع من جديد.';
 return '';
}
