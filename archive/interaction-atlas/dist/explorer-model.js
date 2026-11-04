import { axes, profiles } from './taxonomy.js';
import { examples, exampleById } from './catalog.js';

export { axes, profiles, examples, exampleById };
export const buttonExampleIds=['button-trace','button-phases'];
export const kinds = {principle:'قاعدة تحكم',application:'تطبيق',composition:'تركيب',comparison:'مقارنة'};
export const valueById = new Map(axes.flatMap(axis => axis.values.map(value => [value.id,{...value,axis:axis.id}])));
export const normalize = value => String(value).normalize('NFKD').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase().trim();
export function tagsFor(id, partial = false) { return Object.values((partial ? profiles[id]?.partial : profiles[id]?.axes) || {}).flat(); }
export function referencesFor(valueId) {
  return {full:examples.filter(m=>tagsFor(m.id).includes(valueId)),partial:examples.filter(m=>tagsFor(m.id,true).includes(valueId))};
}
export function filteredExamples({view='lab',query='',kind='all',filters=[]} = {}) {
  const words=normalize(query).split(/\s+/).filter(Boolean);
  return examples.filter(m=>{
    const profile=profiles[m.id];
    if(view==='button'&&!buttonExampleIds.includes(m.id))return false;
    if(!profile || (view==='compare' && profile.kind!=='comparison') || (kind!=='all' && profile.kind!==kind))return false;
    const allTags=[...tagsFor(m.id),...tagsFor(m.id,true)];
    if(![...filters].every(id=>allTags.includes(id)))return false;
    const content=normalize([m.name,m.title,profile.family,profile.summary,...allTags.map(id=>valueById.get(id)?.label||'')].join(' '));
    return words.every(word=>content.includes(word));
  });
}
export function relatedExamples(id,limit=3){
  const rules=profiles[id]?.axes.rule||[];
  return examples.filter(m=>m.id!==id).map(m=>({example:m,score:(profiles[m.id]?.axes.rule||[]).filter(v=>rules.includes(v)).length})).filter(m=>m.score).sort((a,b)=>b.score-a.score).slice(0,limit).map(m=>m.example);
}
