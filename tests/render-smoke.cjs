const vm=require('node:vm'),fs=require('fs');let js=fs.readFileSync(__dirname+'/../studio.js','utf8');js=js.replace(/start\(\)\.catch\(e=>\{console\.error\(e\);toast\('Studio initialization failed: '\+e.message\)\}\);\s*$/,'');
const ctxObj={structuredClone};vm.createContext(ctxObj);vm.runInContext(js,ctxObj);const src=`
const log=[];
const context={canvas:{width:1080,height:1080},save(){},restore(){},scale(){},fillRect(){},strokeRect(){},beginPath(){},rect(){},clip(){},arc(){},roundRect(){},fill(){},stroke(){},moveTo(){},lineTo(){},drawImage(){},setLineDash(){},measureText(s){return {width:String(s).length*Number((this.font||'20px').match(/(\\d+(?:\\.\\d+)?)px/)?.[1]||20)*.51}},fillText(s,x,y){if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('invalid canvas coord');this.calls++},calls:0};
for(const f of FORMATS){for(const template of SAMPLES){let s=NEW_SLIDE(template.id);s.format=f.id;for(const theme of ['light','dark']){s.theme=theme;frame(context,s,0,4);if(context.calls<1)throw Error('no text drawn: '+template.id)}}}
[SAMPLES.length,FORMATS.length,context.calls]
`;
console.log('smoke results:',vm.runInContext(src,ctxObj));
