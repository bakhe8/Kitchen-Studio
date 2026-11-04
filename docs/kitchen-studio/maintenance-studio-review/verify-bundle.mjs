import {build} from 'esbuild';
await build({entryPoints:['public/kitchen-app.js'],bundle:true,format:'esm',platform:'browser',write:false,logLevel:'warning'});
await build({entryPoints:['public/kitchen-maintenance-studio.css'],bundle:true,write:false,logLevel:'warning'});
console.log('PASS: kitchen-app.js and maintenance studio CSS browser bundles');
