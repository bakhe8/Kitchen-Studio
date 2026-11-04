import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));

export async function prepareWorkbookReader(){
 await build({
  absWorkingDir:root,
  stdin:{contents:"export {default as readXlsx} from 'read-excel-file/universal'; export {unzipSync} from 'fflate';",resolveDir:root,sourcefile:'workbook-reader.js'},
  bundle:true,platform:'browser',target:'es2022',format:'esm',treeShaking:true,minify:true,
  legalComments:'eof',outfile:root+'public/vendor/workshop-xlsx.mjs',
 });
 const licenses=await Promise.all(['read-excel-file','fflate','saxen'].map(async name=>name+'\n'+await readFile(root+'node_modules/'+name+'/LICENSE','utf8')));
 await writeFile(root+'public/vendor/workshop-xlsx.LICENSE.txt',licenses.join('\n\n'));
}
if(process.argv[1]===fileURLToPath(import.meta.url))await prepareWorkbookReader();
