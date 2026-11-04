export function cleanIdea(raw:unknown): {room:Record<string,any>; kitchen:{units:any[];runs:any[];features:any[]}}|null;
export function approvalState(doc:unknown):Promise<{keys:{release:string};valid:{customer:boolean;release:boolean};quote:{total:number|null;ready:boolean}}>;
export function releaseConcerns(doc:unknown,state:unknown):string[];
export function kitchenGeometry(k:unknown,r:unknown):{conflicts:Array<{type:string;label:string}>};
export function readChainRange(doc:unknown,wall:string):unknown;
export function batchReleaseState(doc:unknown,unitIds:unknown):Promise<{issues:string[];key?:string;scope?:{unitIds:string[]};quote?:{materialValue:number|null}}>;

export function portableFactoryCatalog(c:unknown): ({name:string;approved:boolean;[k:string]:unknown}|null);
export function catalogFingerprint(c:unknown):string;
// Runtime exports are bundled by prepare-shop-domain.mjs. Unknown inputs remain
// unknown at this boundary: each codec/merge performs its own domain validation.
export type CatalogRecordState={revision:number;approved:boolean};
export type CatalogRecordHeader=CatalogRecordState&{version:1};
export type CatalogItem={
 sku:string;name:string;kind:'bar'|'panel'|'piece';role:'front'|'body';color:string;
 thicknessMm:number;stockLengthMm:number;stockWidthMm:number;kerfMm:number;price:number|null;
 stockUnits:number|null;available:boolean;hardwareRole:'runner'|'other';
 offcuts:Array<{ref:string;count:number;lengthMm:number;widthMm:number}>;
 sectionWidthMm?:number;gaugeMm?:number;grooveWidthMm?:number;grooveDepthMm?:number;
 [field:string]:unknown;
};
export type StoreCatalogRecord=CatalogRecordHeader&{name:string;items:CatalogItem[]};
export type FactoryRecipesRecord=CatalogRecordHeader&{
 families:Record<string,unknown>;specials:Record<string,unknown>;[book:string]:unknown;
};
export type PricingTermsRecord=CatalogRecordHeader&{
 terms:{labor:number|null;installation:number|null;delivery:number|null;marginPct:number|null;taxPct:number|null;worktop:'include'|'separate'};
 wallRates:Record<string,number|null>;
};
export type CatalogRecords={
 storeCatalog:StoreCatalogRecord;factoryRecipes:FactoryRecipesRecord;pricingTerms:PricingTermsRecord;
 catalogMeta:{version:1;name:string;revision:number;layoutRevision:number;teamSource?:{id:string;version:number;digest:string}};
};
export type PortableCatalogRecords=CatalogRecords&{type:'kitchen-catalog-records';version:1};
export function catalogRecordsFromWorkshop(workshop:unknown):CatalogRecords|null;
export function catalogRecordStates(workshop:unknown):{store:CatalogRecordState;factory:CatalogRecordState;pricing:CatalogRecordState}|null;
export function hasWorkshopCatalog(workshop:unknown):boolean;
export function encodePortableCatalog(raw:unknown):PortableCatalogRecords|null;
export function decodePortableCatalog(raw:unknown):(CatalogRecords&{
 readonly catalog:NonNullable<ReturnType<typeof portableFactoryCatalog>>&{items:CatalogItem[]};
})|null;

export const projectScopeVersion:2;
export type ScopedAccess={role:string;subject:string;scopeVersion:1|2;status?:'assign-role-required'};
export type ProjectView={
 type:'kitchen-project-view';version:1;project:{id:string;revision:number};
 access:ScopedAccess&{scopeVersion:2};editable:Record<string,unknown>;context:Record<string,unknown>;
 approvedSale?:{status:'pending'}|{status:'approved';totalMinor:number;currency:'SAR';revision:number};
};
export type CatalogView={
 type:'kitchen-catalog-view';version:1;catalog:{id:string;version:number};
 access:ScopedAccess&{scopeVersion:1};editable:{storeCatalog?:StoreCatalogRecord;factoryRecipes?:FactoryRecipesRecord};context:Record<string,unknown>;
};
export type StudioDocument={room:Record<string,unknown>;kitchen:{units:Record<string,unknown>[];runs:Record<string,unknown>[];features:Record<string,unknown>[];[field:string]:unknown}};
export type StudioArchive={type:'kitchen-studio';version:1|2;design:StudioDocument;photos?:Record<string,string>;fieldFiles?:Array<{id:string;data:string}>;[field:string]:unknown};
export type DomainRejection={ok:false;reason:string};
export function projectView(role:string,archive:unknown,meta:{id:string;revision:number;subject:string;name?:string;approvedSale?:unknown}):ProjectView;
// The caller must validate this complete source with checkedPortableArchive;
// this merge validates the scoped edit, not an arbitrary archive envelope.
export function mergeProjectEdit(role:string,archive:StudioArchive,edit:unknown,options?:{expectedRevision?:number}):DomainRejection|{ok:true;archive:StudioArchive;mutates?:never;review?:never};
export function catalogView(role:string,catalog:unknown,meta:{id:string;version:number;subject:string}):CatalogView;
export function mergeCatalogEdit(role:string,catalog:unknown,edit:unknown,options?:{expectedVersion?:number}):DomainRejection|{ok:true;catalog:PortableCatalogRecords};
export function executeProjectOperation(role:string,archive:unknown,envelope:unknown,meta:{id:string;subject:string;expectedRevision:number}):DomainRejection|
 {ok:true;mutates:false;result:Record<string,unknown>;review:null;archive?:never}|
 {ok:true;mutates:true;result:Record<string,unknown>;review:string;archive:StudioArchive};

export type WholeKitchenOptions={walls?:string[];wanted?:{sink?:boolean;dishwasher?:boolean;rice?:boolean};limit?:number;pause?:()=>Promise<void>;cancel?:()=>boolean;pantryId?:string;riceMode?:string;widths?:unknown;allowProvisional?:boolean};
export type WholeKitchenQuestion={step:string;text:string;focus:Record<string,unknown>};
export type WholeKitchenCandidate={ok:true;doc:StudioDocument;key:string;total:number|null;questions:WholeKitchenQuestion[];provisional:boolean;[field:string]:unknown};
export function proposeWholeKitchen(doc:unknown,options?:WholeKitchenOptions):Promise<
 {ok:true;candidates:WholeKitchenCandidate[];tried:number;truncated:boolean;questions:WholeKitchenQuestion[]}|
 {ok:false;doc:unknown;reason:string;questions:WholeKitchenQuestion[];candidates:[];tried:number;truncated:boolean;cancelled?:true}
>;
export type ArchitecturePoint={x:number;z:number};
export function architectureWall(room:unknown,id:string):{
 id:string;label:string;a:ArchitecturePoint;b:ArchitecturePoint;start:number;end:number;uMin:number;uMax:number;length:number;
 origin:ArchitecturePoint;tangent:ArchitecturePoint;inward:ArchitecturePoint;
}|null;
export function checkedPortableArchive(raw:unknown):unknown;
export function orderHandoffUnits(doc:unknown,ids?:string[],mode?:"whole-filter"):Array<{id:string;name:string;partCount:number;scribes?:Array<{id:string;label:string}>;checks:Array<{key:string;label:string;nominal:number;unit:string;maxTolerance?:number}>}>;
export function manufacturingKeys(doc:unknown):Record<string,string>;
export function remainderStockRequirements(doc:unknown,ids:string[]):{issues:string[];purchases:Array<{sku:string;qty:number;layout?:Array<{ref:string;source:string}>}>;surfaces:unknown[]};

export function installJobIssues(released:unknown,current:unknown,unitId:string,phase:'ship'|'install'):string[];
export function releasedSurfaceDXF(doc:unknown,id:string):string|null;

export function releasedScribeDXF(doc:unknown,unitId:string,anchor:string):string|null;

export type ReleaseFileStamp={project:string;projectName:string;revision:string;scope:string;purpose:string;status:string;issued:string;release:string;cloudRevision:number};
// Geometry exports also accept the factory's public stamp, which deliberately
// omits the owner's receipt proof. Only releaseFileStamp promises that proof.
export type DrawingFileStamp=Omit<ReleaseFileStamp,'release'>&Partial<Pick<ReleaseFileStamp,'release'>>;
export function releaseFileStamp(doc:unknown,id:string,receipt:{issued:string;revision:number;receipt:string},scope:string,purpose:string):ReleaseFileStamp;
export function drawingDXF(source:string,stamp:DrawingFileStamp):string;
export function outputFilename(stamp:DrawingFileStamp,base:string,extension:string):string;
