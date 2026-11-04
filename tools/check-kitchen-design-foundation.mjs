import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const shell=await readFile(new URL('public/kitchen-shell.css',root),'utf8');
const foundation=await readFile(new URL('public/kitchen-design-system.css',root),'utf8').catch(()=> '');

assert.match(shell,/^@import\s+["']\.\/kitchen-design-system\.css["'];/,'design foundation must load before shell and feature rules');
for(const token of ['--ks-canvas','--ks-surface-1','--ks-ink-strong','--ks-action','--ks-complete','--ks-attention','--ks-danger','--ks-focus-ring','--ks-target']){
  assert.ok(foundation.includes(token),`missing semantic token ${token}`);
}
const tokenValue=name=>foundation.match(new RegExp(`${name}:([^;]+)`))?.[1].trim();
const luminance=hex=>{
  const channels=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
};
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
for(const surface of ['--ks-canvas','--ks-surface-inset','--ks-action-soft','--ks-complete-soft']) assert.ok(contrast(tokenValue('--ks-ink-muted'),tokenValue(surface))>=4.5,`muted normal text must meet 4.5:1 on ${surface}`);
assert.ok(contrast(tokenValue('--ks-attention'),tokenValue('--ks-attention-soft'))>=4.5,'attention text must meet 4.5:1 contrast');
assert.ok(foundation.includes('--ks-focus-ring-dark'),'dark structural surfaces need a dedicated focus token');
assert.ok(contrast(tokenValue('--ks-focus-ring-dark'),tokenValue('--ks-ink-strong'))>=3,'dark-surface focus indicator must meet 3:1 contrast');
assert.match(foundation,/:focus-visible[^}]*outline:\s*3px\s+solid\s+var\(--ks-focus-ring\)/s,'focus must be a visible 3px semantic ring');
assert.match(foundation,/@media\s*\(prefers-reduced-motion:\s*reduce\)/,'foundation must respect reduced motion');
assert.doesNotMatch(foundation,/\.(visit|studio|factory|proposal|shelf)-/,'foundation must not override feature components during migration');

console.log('PASS kitchen design foundation');
