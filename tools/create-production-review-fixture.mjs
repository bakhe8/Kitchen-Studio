import {mkdirSync,writeFileSync} from 'node:fs';
import {makeProductionReadyFixture} from './fixture-kitchen-production-ready.mjs';
const directory=new URL('../docs/kitchen-studio/production-studio-review/',import.meta.url);
mkdirSync(directory,{recursive:true});
const doc=await makeProductionReadyFixture();
writeFileSync(new URL('input-project.json',directory),JSON.stringify({type:'kitchen-studio',version:2,design:doc,photos:{},fieldFiles:[],fixture:{testOnly:true,syntheticSurvey:true,syntheticPrices:true,syntheticMachine:true,purpose:'رحلة اختبار محلية لمراجعة القص والتجميع؛ ليست أمر تصنيع حقيقيًا.'}},null,2),'utf8');
console.log(new URL('input-project.json',directory).pathname);
