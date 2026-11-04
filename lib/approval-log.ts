// Approval stamps and technician attestations are typed into the project JSON by whoever has edit access, so a stamp alone
// proves nothing about who made it. Reps legitimately record customer approvals, so the server does not refuse them. It records
// who introduced each stamp and when, from the signed-in session, so the owner can see it and nobody can deny it later.
type Who={userId:string;displayName:string;email:string};
type Stamp={kind:string;subject:string;key:string;name:string;date:string;detail:string};
type Latest={kind:string;subject:string;stamp_key:string;stamp_name:string;stamp_date:string};
const KINDS=["structure","customer","release"];
const clip=(value:unknown,limit:number)=>typeof value==="string"?value.trim().slice(0,limit):"";
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);

export function approvalStamps(archive:unknown):Stamp[]{
 const design=record(archive)?archive.design:null,room=record(design)?design.room:null,workshop=record(room)?room.workshop:null;
 if(!record(workshop))return [];
 const out:Stamp[]=[];
 if(record(workshop.approvals))for(const kind of KINDS){
  const s=workshop.approvals[kind];
  if(record(s)&&typeof s.key==="string"&&typeof s.name==="string")out.push({kind,subject:"",key:clip(s.key,160),name:clip(s.name,160),date:clip(s.date,40),detail:""});
 }
 if(record(workshop.chains))for(const [wall,chain] of Object.entries(workshop.chains)){
  const a=record(chain)?chain.attestation:null;
  if(record(a)&&typeof a.key==="string"&&typeof a.name==="string")out.push({kind:"chain",subject:clip(wall,64),key:clip(a.key,160),name:clip(a.name,160),date:clip(a.date,40),detail:clip(a.reference,160)});
 }
 return out.filter(s=>s.key&&s.name);
}

export async function logApprovals(db:D1Database,project:string,revision:number,user:Who,archive:unknown){
 try{
  const stamps=approvalStamps(archive);if(!stamps.length)return;
  const rows=(await db.prepare(`SELECT kind,subject,stamp_key,stamp_name,stamp_date FROM studio_approvals a WHERE project_id=?
   AND revision=(SELECT MAX(revision) FROM studio_approvals b WHERE b.project_id=a.project_id AND b.kind=a.kind AND b.subject=a.subject)`).bind(project).all<Latest>()).results;
  const latest=new Map(rows.map(r=>[r.kind+"/"+r.subject,r]));
  const fresh=stamps.filter(s=>{const l=latest.get(s.kind+"/"+s.subject);return !l||l.stamp_key!==s.key||l.stamp_name!==s.name||l.stamp_date!==s.date;});
  if(!fresh.length)return;
  const now=new Date().toISOString(),by=user.displayName||user.email;
  await db.batch(fresh.map(s=>db.prepare(`INSERT INTO studio_approvals(project_id,revision,kind,subject,stamp_key,stamp_name,stamp_date,detail,actor,actor_name,recorded)
   SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM studio_versions WHERE project_id=? AND revision=? AND actor=?) ON CONFLICT DO NOTHING`)
   .bind(project,revision,s.kind,s.subject,s.key,s.name,s.date,s.detail,user.userId,by,now,project,revision,user.userId)));
 }catch(error){
  // The save is already committed. A missing entry shows in the panel as "not recorded yet" and a retry of the same save repairs it.
  console.error("studio approval log failed:",error instanceof Error?error.message:String(error));
 }
}
