import {build} from 'esbuild';
await build({entryPoints:['public/kitchen-app.js'],bundle:true,format:'esm',platform:'browser',write:false,logLevel:'warning'});
await build({entryPoints:['public/kitchen-delivery-studio.css'],bundle:true,write:false,logLevel:'warning'});
console.log('PASS: kitchen-app.js and delivery studio CSS browser bundles');
