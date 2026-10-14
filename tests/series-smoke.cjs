const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const file=path.join(__dirname,'../studio.js');let src=fs.readFileSync(file,'utf8').replace(/start\(\)\.catch\(e=>\{console\.error\(e\);toast\('Studio initialization failed: '\+e.message\)\}\);\s*$/,'');
const sand={structuredClone,console,confirm:()=>true};vm.createContext(sand);vm.runInContext(src,sand);
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
const r=JSON.parse(vm.runInContext(script,sand));assert.deepEqual(r.failures,[]);console.log('Series smoke:',r);
// Write example editable projects generated from the real JS templates / pack definitions.
vm.runInContext(`
const fsOutput=[];
for(const pack of SERIES_PACKS){app={name:'Runtime Garden · '+pack.name,seriesPack:'none',slides:[NEW_SLIDE('cover')],selected:0};applySeriesPack(pack.id);fsOutput.push({id:pack.id,payload:JSON.stringify({format:'runtime-garden-social-studio',version:2,...app},null,2)})};
`,sand);
let docs=vm.runInContext('fsOutput',sand);
for(const d of docs){fs.writeFileSync(path.join(__dirname,'../examples/series-'+d.id+'.rgstudio.json'),d.payload)}
