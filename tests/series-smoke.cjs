const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const file=path.join(__dirname,'../studio.js');let src=fs.readFileSync(file,'utf8').replace(/start\(\)\.catch\(e=>\{console\.error\(e\);toast\('Studio initialization failed: '\+e\.message\)\}\);\s*$/,'');
const core=fs.readFileSync(path.join(__dirname,'../packages/studio-core/dist/studio-core.js'),'utf8');
const sand={structuredClone,console,confirm:()=>true};vm.createContext(sand);vm.runInContext(core,sand);vm.runInContext(src,sand);
const script=`
mutate=fn=>fn();switchLeft=()=>{};toast=()=>{};
const failures=[];
for(const pack of SERIES_PACKS){
  app={name:'New collection',seriesPack:'none',slides:[NEW_SLIDE('cover')],selected:0};
  applySeriesPack(pack.id);
  if(app.slides.length!==pack.slides.length)failures.push(pack.id+': count');
  if(app.slides.some(s=>s.series!==pack.id||s.theme!==pack.theme||s.pattern!==pack.pattern))failures.push(pack.id+': style');
  const result=restoreFrom(JSON.stringify(app));if(result.slides.length!==app.slides.length)failures.push(pack.id+': roundtrip');
}
app={name:'custom-test',seriesPack:'none',slides:[NEW_SLIDE('cover')],selected:0};app.slides[0].format='custom';app.slides[0].customWidth=2460;app.slides[0].customHeight=1640;
const fmt=getFormat(app.slides[0]);if(fmt.w!==2460||fmt.h!==1640)failures.push('custom dimensions');
const roundtrip=restoreFrom(JSON.stringify(app));if(roundtrip.slides[0].customWidth!==2460)failures.push('custom roundtrip');
JSON.stringify({passes:SERIES_PACKS.length,packs:SERIES_PACKS.map(x=>x.name),layouts:SAMPLES.length,formats:FORMATS.length,failures});`;
const r=JSON.parse(vm.runInContext(script,sand));assert.deepEqual(r.failures,[]);
// Verify the committed example projects still load and match their pack definitions.
// This test no longer rewrites tracked files; use `npm run refresh:examples` for that.
const packs=JSON.parse(vm.runInContext('JSON.stringify(SERIES_PACKS)',sand));
const exampleFailures=[];
for(const pack of packs){
  const p=path.join(__dirname,'../examples/series-'+pack.id+'.rgstudio.json');
  if(!fs.existsSync(p)){exampleFailures.push(pack.id+': missing example file');continue}
  const restored=vm.runInContext('restoreFrom('+JSON.stringify(fs.readFileSync(p,'utf8'))+')',sand);
  if(restored.slides.length!==pack.slides.length)exampleFailures.push(pack.id+': example slide count');
  if(restored.slides.some((s,i)=>s.id!==pack.slides[i]))exampleFailures.push(pack.id+': example layout order');
  if(restored.slides.some(s=>s.series!==pack.id))exampleFailures.push(pack.id+': example series id');
  if(restored.slides.some(s=>s.theme!==pack.theme))exampleFailures.push(pack.id+': example theme');
}
assert.deepEqual(exampleFailures,[]);
console.log('Series smoke:',{...r,examplesChecked:packs.length});
