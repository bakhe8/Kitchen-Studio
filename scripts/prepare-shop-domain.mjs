import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function prepareShopDomain(){
 await build({absWorkingDir:root,stdin:{contents:`
  export {releaseFileStamp,drawingDXF,outputFilename} from './public/kitchen-drawing-output.js';
  export {approvalState,releaseConcerns,batchReleaseState} from './public/kitchen-workshop-state.js';
   export {portableFactoryCatalog,catalogFingerprint,encodePortableCatalog,decodePortableCatalog} from './public/kitchen-factory-template.js';
   export {catalogRecordsFromWorkshop,catalogRecordStates,hasWorkshopCatalog} from './public/kitchen-catalog-records.js';
   export {authorizeProjectChange,authorizeCatalogChange} from './public/kitchen-access-policy.js';
   export {projectView,mergeProjectEdit,catalogView,mergeCatalogEdit,projectScopeVersion} from './public/kitchen-project-scope.js';
   export {executeProjectOperation} from './public/kitchen-scoped-operations.js';
   export {proposeWholeKitchen} from './public/kitchen-whole-plan.js';
   export {architectureWall} from './public/kitchen-architecture.js';
  export {checkedPortableArchive} from './public/kitchen-archive-validation.js';
  export {releasedScribeDXF,releasedSurfaceDXF,orderHandoffUnits,manufacturingKeys,remainderStockRequirements} from './public/kitchen-order-domain.js';
  export {installJobIssues} from './public/kitchen-install-readiness.js';
  export {cleanIdea} from './public/kitchen-ideas.js';
  export {kitchenGeometry} from './public/kitchen-model.js';
  export {readChainRange} from './public/kitchen-chain-model.js';
 `,resolveDir:root,sourcefile:'verified-shop-domain.js'},bundle:true,platform:'browser',target:'es2022',format:'esm',treeShaking:true,minify:true,legalComments:'none',outfile:root+'lib/generated-shop-domain.mjs'});
}
if(process.argv[1]===fileURLToPath(import.meta.url))await prepareShopDomain();
