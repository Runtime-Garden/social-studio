/* Runtime Garden Social Studio · local-first canvas editor
   The official Design Kit v2 palette and vector logos are deliberately immutable. */
'use strict';
const $ = id => document.getElementById(id);
const C = {
  light:{bg:'#F6F8F3',surface:'#FFFFFF',soft:'#EDF2E9',ink:'#16271E',muted:'#506459',accent:'#286A47',accentSoft:'#DCEDE0',border:'#D8E1D6',warm:'#AD7742'},
  dark:{bg:'#0D1713',surface:'#15231B',soft:'#1B2C22',ink:'#EDF4ED',muted:'#AFBEB1',accent:'#8DD5A3',accentSoft:'#243E2C',border:'#304337',warm:'#D6AD77'}
};
/* Pure registry extracted to packages/studio-core (P1, output-neutral).
   Loaded as a classic script before this file (see index.html); the standalone
   build inlines packages/studio-core/dist/studio-core.js the same way. */
const { FORMATS, getFormat, SAMPLES, SERIES_PACKS, DEFAULTS, SERIES_CONTENT, clamp, uid, NEW_SLIDE } = RGStudioCore;
let app={name:'Untitled collection',seriesPack:'none',slides:[NEW_SLIDE('cover')],selected:0};
let history=[],future=[],historyStart=null,saveTimer=null,zoom=1,showGuides=false,leftTab='templates',inspectorTab='content',filter='all',assetCache=new Map(),renderTicket=0,logoImages={};
let imageImportOriginal=null;
function slide(){return app.slides[app.selected]}
function palette(s){return C[s.theme]||C.light}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function safeName(s){return String(s||'runtime-garden-post').toLowerCase().replace(/[^a-z0-9-_]+/g,'-').replace(/-+/g,'-').slice(0,66)||'post'}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3200)}
function snapshot(){return JSON.stringify(app)}
function remember(){history.push(snapshot());if(history.length>70)history.shift();future=[];updateHistory()}
function updateHistory(){$('undoBtn').disabled=!history.length;$('redoBtn').disabled=!future.length}
function restoreFrom(text){const parsed=JSON.parse(text);if(!parsed||!Array.isArray(parsed.slides)||parsed.slides.length<1||parsed.slides.length>100)throw Error('Not a valid Social Studio project.');
const slides=parsed.slides.map(s=>{if(!s||!SAMPLES.some(t=>t.id===s.id))throw Error('Unknown layout in imported project.');const clean=NEW_SLIDE(s.id);for(const k of Object.keys(clean)){if(!Object.hasOwn(s,k))continue;const v=s[k];if(typeof clean[k]==='string'&&typeof v==='string')clean[k]=v.slice(0,k==='image'?6500000:15000);else if(typeof clean[k]==='number'&&typeof v==='number'&&Number.isFinite(v))clean[k]=v;else if(typeof clean[k]==='boolean'&&typeof v==='boolean')clean[k]=v;else if(k==='image'&&(v===null||typeof v==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(v)&&v.length<6500000))clean[k]=v;}clean.uid=uid();clean.scale=clamp(clean.scale,.7,1.25);clean.customWidth=clamp(Math.round(clean.customWidth),400,4096);clean.customHeight=clamp(Math.round(clean.customHeight),300,4096);if(!SERIES_PACKS.some(p=>p.id===clean.series))clean.series='none';clean.imagePosition=clamp(clean.imagePosition,0,100);return clean});
return {name:String(parsed.name||'Imported collection').slice(0,100),seriesPack:SERIES_PACKS.some(p=>p.id===parsed.seriesPack)?parsed.seriesPack:'none',selected:clamp(Number(parsed.selected)||0,0,slides.length-1),slides}}
function undo(){if(!history.length)return;future.push(snapshot());app=restoreFrom(history.pop());refresh();saveSoon();updateHistory()}
function redo(){if(!future.length)return;history.push(snapshot());app=restoreFrom(future.pop());refresh();saveSoon();updateHistory()}
function saveSoon(){clearTimeout(saveTimer);$('saveStatus').textContent='Saving…';saveTimer=setTimeout(()=>{try{localStorage.setItem('rg-social-studio-v1',snapshot());$('saveStatus').textContent='Saved locally'}catch(e){$('saveStatus').textContent='Not saved';toast('Browser storage is full. Download the project JSON to keep your work.')}},650)}
function setSlideProp(k,v){slide()[k]=v;render();updateCanvasMeta();saveSoon()}
function mutate(fn){remember();fn();refresh();saveSoon()}
function initLogos(){return Promise.all(Object.entries(RG_OFFICIAL_LOGOS).map(([key,src])=>new Promise(resolve=>{const im=new Image();im.onload=()=>{logoImages[key]=im;resolve()};im.onerror=resolve;im.src=src})))}
function getCachedImage(src){if(!src)return null;if(!assetCache.has(src)){const im=new Image();const ob={image:im,ok:false};assetCache.set(src,ob);im.onload=()=>{ob.ok=true;render()};im.onerror=()=>{ob.failed=true};im.src=src}const cached=assetCache.get(src);return cached.ok?cached.image:null}
function waitImage(src){return new Promise(resolve=>{if(!src)return resolve();const im=getCachedImage(src);if(im)return resolve();const obj=assetCache.get(src);if(!obj||obj.failed)return resolve();obj.image.addEventListener('load',resolve,{once:true});obj.image.addEventListener('error',resolve,{once:true})})}
const fontSans='Inter, Geist, system-ui, sans-serif',fontMono='"IBM Plex Mono", "JetBrains Mono", monospace',fontSerif='Newsreader, Georgia, serif';
function font(ctx,weight,size,family=fontSans){ctx.font=`${weight} ${size}px ${family}`}
function fill(ctx,color,x,y,w,h){ctx.fillStyle=color;ctx.fillRect(x,y,w,h)}
function line(ctx,color,x1,y1,x2,y2,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
function roundRect(ctx,x,y,w,h,r,bg,border){if(w<=0||h<=0)return;ctx.beginPath();ctx.roundRect(x,y,w,h,clamp(r,0,Math.min(w,h)/2));if(bg){ctx.fillStyle=bg;ctx.fill()}if(border){ctx.strokeStyle=border;ctx.lineWidth=1.5;ctx.stroke()}}
function text(ctx,s,x,y,size,color,weight=500,family=fontSans,align='left'){ctx.textBaseline='top';ctx.fillStyle=color;font(ctx,weight,size,family);ctx.textAlign=align;ctx.fillText(String(s??''),x,y)}
function maxText(ctx,str,maxWidth,size,minSize,weight=700,family=fontSans){let n=size;while(n>minSize){font(ctx,weight,n,family);if(ctx.measureText(str).width<=maxWidth)break;n-=1}return n}
function breakLines(ctx,s,maxWidth,size,weight=500,family=fontSans,maxLines=99){font(ctx,weight,size,family);const lines=[];for(const para of String(s||'').split('\n')){const words=para.trim().split(/\s+/).filter(Boolean);let current='';if(!words.length){lines.push('');continue}for(const word of words){const next=current?current+' '+word:word;if(ctx.measureText(next).width>maxWidth&&current){lines.push(current);current=word}else current=next;}if(current)lines.push(current)}if(lines.length>maxLines){const visible=lines.slice(0,maxLines);let last=visible[maxLines-1];while(last.length>0&&ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);visible[maxLines-1]=last+'…';return visible}return lines}
function block(ctx,s,x,y,w,opt={}){const size=opt.size||34,lh=opt.lh||1.32,weight=opt.weight||500,typ=opt.family||fontSans,col=opt.color||'#16271E',maxLines=opt.maxLines||100;const lines=breakLines(ctx,s,w,size,weight,typ,maxLines);lines.forEach((l,i)=>text(ctx,l,x,y+i*size*lh,size,col,weight,typ,opt.align||'left'));return y+lines.length*size*lh}
function headline(ctx,s,x,y,w,lim,theme,size=88,typ=fontSans,weight=700){let fs=size;let lines=[];do{font(ctx,weight,fs,typ);lines=breakLines(ctx,s,w,fs,weight,typ,9);if(lines.length*fs*1.1<=lim)break;fs-=2;}while(fs>36);lines.forEach((l,i)=>text(ctx,l,x,y+i*fs*1.11,fs,theme.ink,weight,typ));return y+lines.length*fs*1.11}
function mono(ctx,s,x,y,size,color,weight=500){text(ctx,String(s).toUpperCase(),x,y,size,color,weight,fontMono)}
function cropped(ctx,image,x,y,w,h,fit='cover',position=50){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();const ir=image.width/image.height,rr=w/h;let dw,dh;if(fit==='contain'){if(ir>rr){dw=w;dh=w/ir}else{dh=h;dw=h*ir}}else{if(ir>rr){dh=h;dw=h*ir}else{dw=w;dh=w/ir}}ctx.drawImage(image,x+(w-dw)/2,y+(h-dh)*(position/100),dw,dh);ctx.restore()}
function drawLogo(ctx,s,y,width=280){if(!s.showLogo)return;const key=s.theme==='dark'?'dark':'light',im=logoImages[key];if(im)ctx.drawImage(im,64,y,width,width*144/710);else mono(ctx,'> runtime garden',68,y+14,30,palette(s).ink)}
function drawMark(ctx,s,x,y,size=80){const key=s.theme==='dark'?'markDark':'mark';if(logoImages[key])ctx.drawImage(logoImages[key],x,y,size,size)}
function pattern(ctx,s,t,H){if(s.pattern==='none')return;ctx.save();ctx.globalAlpha=s.pattern==='grid'?.42:.3;ctx.strokeStyle=t.border;ctx.fillStyle=t.border;if(s.pattern==='dots'){for(let x=650;x<1030;x+=27)for(let y=230;y<Math.min(H-170,910);y+=27){ctx.beginPath();ctx.arc(x,y,1.7,0,2*Math.PI);ctx.fill()}}else{for(let x=660;x<1040;x+=56)line(ctx,t.border,x,230,x,Math.min(H-170,920));for(let y=230;y<Math.min(H-170,920);y+=56)line(ctx,t.border,660,y,1040,y)}ctx.restore()}
function commonTop(ctx,s,i,total,H,t){const base=s.theme==='dark'?t.bg:t.bg;fill(ctx,base,0,0,1080,H);if(s.id==='minimal')return;line(ctx,t.border,64,151,1016,151,1.8);drawLogo(ctx,s,66,286);mono(ctx,s.kicker||'RUNTIME GARDEN',64,189,17,t.accent,600);if(s.numbering)text(ctx,`${String(i+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}`,1016,189,16,t.muted,500,fontMono,'right');}
function commonBottom(ctx,s,H,t){const y=H-125;line(ctx,t.border,64,y,1016,y,1.8);mono(ctx,s.customFooter||s.label||'WHERE IDEAS GROW INTO SYSTEMS',64,y+26,14,t.muted,500);if(s.showDomain)text(ctx,'RUNTIMEGARDEN.COM',1016,y+26,14,t.accent,600,fontMono,'right');}
function pill(ctx,s,x,y,txt,t,opt={}){if(!txt||!s.showTag)return 0;const sz=opt.size||16,padding=opt.padding||16;font(ctx,600,sz,fontMono);const w=clamp(ctx.measureText(String(txt).toUpperCase()).width+padding*2,90,890);roundRect(ctx,x,y,w,sz+padding*1.2,8,opt.bg||t.accentSoft,opt.border||null);mono(ctx,String(txt).slice(0,80),x+padding,y+padding*.55,sz,t.accent,600);return w}
function drawLink(ctx,s,x,y,t){if(s.detail)mono(ctx,String(s.detail).slice(0,90),x,y,17,t.accent,600)}
function drawList(ctx,items,x,y,w,t,{size=30,numbered=false,limit=6,space=70}={}){const arr=String(items||'').split('\n').filter(Boolean).slice(0,limit);arr.forEach((a,i)=>{const yy=y+i*space;roundRect(ctx,x,yy-5,numbered?44:22,numbered?44:22,numbered?9:11,t.accentSoft);if(numbered)mono(ctx,String(i+1).padStart(2,'0'),x+8,yy+8,16,t.accent,600);else fill(ctx,t.accent,x+8,yy+3,6,6);block(ctx,a,x+(numbered?63:40),yy,w-(numbered?63:40),{size,color:t.ink,weight:550,maxLines:2})});return arr.length*space}

const EXTRA_LAYOUT_IDS=new Set(['chapter','thesis','stat','timeline','layers','spotlight','beforeafter','method','findings','questions','tradeoffs','dosdonts','faq','terminal','resources','release','roadmap','closing','digest','principle','diagram','myth','hero','insight']);
function seriesMotif(ctx,s,index,total,H,t){
 if(!s.series||s.series==='none')return;
 const family=SERIES_PACKS.find(p=>p.id===s.series);if(!family)return;
 ctx.save(); // Family markers occupy protected outer margins; no content recoloring.
 fill(ctx,t.accent,0,0,12,H);
 for(let i=0;i<total;i++){const x=64+(i*(952/Math.max(1,total)));fill(ctx,i<=index?t.accent:t.border,x,H-12,Math.max(6,952/Math.max(1,total)-7),5)}
 mono(ctx,family.name+' / '+(index===0?'OPENING':index===total-1?'CLOSING':'FIELD '+String(index+1).padStart(2,'0')),64,20,12,t.accent,600);
 // Family-specific technical ornaments stay subtle and outside the reading zone.
 if(['labbook','system','terminal','research','observatory'].includes(s.series)){for(let j=0;j<4;j++)line(ctx,t.border,1033,280+j*35,1050,280+j*35,2)}
 if(['manifesto','field','open','guide','community'].includes(s.series)){ctx.strokeStyle=t.border;ctx.lineWidth=2;ctx.beginPath();ctx.arc(1035,330,31,Math.PI*.5,Math.PI*1.5);ctx.stroke()}
 ctx.restore();
}
function renderExtraLayout(ctx,s,t,{safeTop,lower,room,title,subtitle,cap,primary}){
 const x=64,w=952,ty=safeTop+14,items=String(s.bullets||'').split('\n').filter(Boolean);
 if(room<760){ // Dedicated readable square composition instead of overlapping portrait modules.
   const y=headline(ctx,s.title,x,ty,945,250,t,clamp(67*(s.scale||1),46,70),['principle','thesis'].includes(s.id)?fontSerif:fontSans,650);
   if(s.showSubtitle)block(ctx,s.subtitle,x,y+18,925,{size:23,color:t.muted,maxLines:2,lh:1.3});
   const panelTop=Math.max(ty+295,lower-308);roundRect(ctx,x,panelTop,952,233,13,t.surface,t.border);
   fill(ctx,t.accent,x,panelTop,8,233);
   if(s.id==='terminal'){String(s.code||'').split('\n').slice(0,4).forEach((v,i)=>block(ctx,'$ '+v,x+27,panelTop+20+i*51,887,{size:18,color:t.ink,family:fontMono,maxLines:1}));}
   else if(items.length){items.slice(0,3).forEach((v,i)=>{mono(ctx,String(i+1).padStart(2,'0'),x+28,panelTop+19+i*67,19,t.accent);block(ctx,v.split('|').join(' / '),x+90,panelTop+18+i*67,810,{size:21,color:t.ink,maxLines:2});});}
   else{mono(ctx,s.tag||'RUNTIME GARDEN',x+27,panelTop+32,22,t.accent);drawMark(ctx,s,800,panelTop+50,105);block(ctx,s.detail||'',x+29,panelTop+105,715,{size:24,color:t.ink,maxLines:2});}
   return;
 }
 const normal=(max=275,sz=81)=>{const y=title(x,ty,w,max,sz);subtitle(x,y+20,890,3);return y};
 const card=(cx,cy,cw,ch,strip=false)=>{roundRect(ctx,cx,cy,cw,ch,13,t.surface,t.border);if(strip)fill(ctx,t.accent,cx,cy,6,ch)};
 const detail=()=>mono(ctx,s.detail||'',x,lower-42,16,t.accent);
 if(['chapter','thesis','principle','hero','closing'].includes(s.id)){
  if(s.id==='chapter'){mono(ctx,'—  '+(s.detail||'A NEW CHAPTER'),x,ty+24,21,t.accent);text(ctx,String(s.chapterNumber||1).padStart(2,'0'),746,ty+104,205,t.accentSoft,700,fontMono);line(ctx,t.accent,x,ty+107,310,ty+107,5);const y=title(x,ty+174,920,room*.57,105);subtitle(x,y+29,840,4)}
  else if(s.id==='closing'){drawMark(ctx,s,766,ty+10,160);line(ctx,t.accent,x,ty+155,1016,ty+155,4);const y=title(x,ty+195,910,room*.53,103);subtitle(x,y+35,830,4)}
  else if(s.id==='hero'){card(x,ty+10,w,clamp(room*.20,95,165));mono(ctx,'ENGINEERING / RESEARCH / SYSTEMS',x+30,ty+36,21,t.accent);drawMark(ctx,s,866,ty+33,86);const y=title(x,ty+232,910,room*.50,100);subtitle(x,y+25,840,3)}
  else{mono(ctx,s.id==='principle'?'ENGINEERING PRINCIPLE':'A FIELD NOTE',x,ty+30,20,t.accent);line(ctx,t.accent,x,ty+92,182,ty+92,5);const y=headline(ctx,s.title,x,ty+145,920,room*.58,t,primary(103),fontSerif,500);subtitle(x,y+50,860,4)}detail();return;
 }
 if(s.id==='stat'){normal(205,70);const [figure,figLabel]=String(items[0]||'—|REPLACE WITH VERIFIED DATA').split('|');mono(ctx,figure,x+12,lower-380,148,t.accent,600);line(ctx,t.border,x,lower-170,1016,lower-170,3);block(ctx,figLabel||'',x+5,lower-139,830,{size:28,color:t.ink,maxLines:2});detail();return}
 if(s.id==='spotlight'){normal(235,78);card(x,lower-400,585,296,true);mono(ctx,'THE WORK',x+30,lower-364,18,t.accent);drawList(ctx,items,x+29,lower-291,520,t,{size:23,limit:3,space:65});card(675,lower-400,339,296);drawMark(ctx,s,763,lower-333,152);detail();return}
 if(['timeline','diagram','layers'].includes(s.id)){
  normal(220,77);const arr=items.slice(0,4);const y=lower-340;if(s.id==='layers')arr.forEach((v,i)=>{card(x+i*13,y+i*75,w-i*26,62,true);block(ctx,v,x+38+i*13,y+19+i*75,760,{size:23,color:t.ink,weight:600,maxLines:1})});
  else arr.forEach((v,i)=>{const colx=x+i*242;card(colx,y,224,240);mono(ctx,String(i+1).padStart(2,'0'),colx+22,y+21,35,t.accent);block(ctx,v,colx+22,y+101,180,{size:22,color:t.ink,weight:650,maxLines:3});if(i<arr.length-1)line(ctx,t.accent,colx+224,y+111,colx+241,y+111,3)});detail();return}
 if(['beforeafter','dosdonts','myth'].includes(s.id)){
  normal(235,78);const parts=items.slice(0,2);parts.forEach((entry,i)=>{const [label,...points]=entry.split('|'),bx=x+i*486,y=lower-425;card(bx,y,466,326,true);mono(ctx,label||`OPTION ${i+1}`,bx+26,y+28,24,t.accent,600);line(ctx,t.border,bx+25,y+81,bx+440,y+81);points.slice(0,3).forEach((v,j)=>block(ctx,v,bx+27,y+105+j*66,400,{size:22,color:t.ink,maxLines:2}))});detail();return}
 if(s.id==='terminal'){normal(218,78);const y=lower-445;card(x,y,w,350);fill(ctx,t.soft,x,y,w,58);mono(ctx,'◯   ◯   ◯     TERMINAL / NOTES',x+24,y+17,17,t.muted);String(s.code||'').split('\n').slice(0,6).forEach((v,i)=>block(ctx,'$ '+v,x+33,y+92+i*44,876,{size:23,family:fontMono,color:t.ink,maxLines:1}));detail();return}
 if(s.id==='faq'){normal(255,78);card(x,lower-440,w,343,true);const qa=items.map(v=>v.split('|'));qa.slice(0,2).forEach((pair,i)=>{mono(ctx,pair[0]||'Q',x+32,lower-407+i*155,30,t.accent);block(ctx,pair[1]||'',x+96,lower-403+i*155,815,{size:i?29:31,color:t.ink,maxLines:3});if(!i)line(ctx,t.border,x+24,lower-248,1000,lower-248)});detail();return}
 if(['method','findings','questions','tradeoffs','resources','release','roadmap','digest','insight'].includes(s.id)){
  normal(260,77);const arr=items.slice(0,s.id==='insight'?3:5);const ys=lower-(arr.length>4?437:390),space=clamp((lower-ys-50)/Math.max(1,arr.length),69,110);
  arr.forEach((a,i)=>{const yy=ys+i*space;roundRect(ctx,x,yy,64,54,8,t.accentSoft);mono(ctx,String(i+1).padStart(2,'0'),x+15,yy+13,21,t.accent);block(ctx,a,x+94,yy+9,820,{size:26,color:t.ink,weight:550,maxLines:2});line(ctx,t.border,x+91,yy+space-18,1016,yy+space-18)});detail();return}
 normal(270,79);drawList(ctx,items,x,lower-360,900,t,{size:26,limit:5,space:70});detail();
}

function frame(ctx,s,index,total,{guides=false}={}){
const fmt=getFormat(s);const W=fmt.w,H=fmt.h,scale=W/1080,virtualH=H/scale;
ctx.canvas.width=W;ctx.canvas.height=H;ctx.save();ctx.scale(scale,scale);const t={...palette(s)};if(s.backgroundMode==='soft')t.bg=t.soft;else if(s.backgroundMode==='surface')t.bg=t.surface;const safeTop=260,lower=virtualH-150,room=Math.max(180,lower-safeTop);
if(virtualH<580){ // Dedicated horizontal banner / header layout; no cropped portrait layout.
 fill(ctx,t.bg,0,0,1080,virtualH);fill(ctx,t.accent,0,0,13,virtualH);line(ctx,t.border,55,66,1025,66,1.5);drawLogo(ctx,s,20,225);
 mono(ctx,s.kicker||'RUNTIME GARDEN',56,100,15,t.accent);drawMark(ctx,s,905,115,102);
 headline(ctx,s.title,56,140,795,Math.max(90,virtualH-210),t,clamp(72*(s.scale||1),43,75),fontSans,700);
 line(ctx,t.border,55,virtualH-69,1025,virtualH-69,1.5);mono(ctx,'WHERE IDEAS GROW INTO SYSTEMS',56,virtualH-48,12,t.muted);if(s.showDomain)mono(ctx,'RUNTIMEGARDEN.COM',819,virtualH-48,12,t.accent);
 seriesMotif(ctx,s,index,total,virtualH,t);ctx.restore();return;
}
commonTop(ctx,s,index,total,virtualH,t);
// Wide social cards use a dedicated condensed composition: the portrait layout
// cannot simply be cropped to fit a 1200x630 or 16:9 canvas.
if(virtualH<850){
  const left=64,top=240,bodyBottom=virtualH-143,maxTitleHeight=clamp(virtualH-380,150,360);
  roundRect(ctx,806,242,210,Math.max(114,bodyBottom-244),10,t.soft,t.border);
  const visible=getCachedImage(s.image);
  if(s.id==='image'&&visible){cropped(ctx,809,245,204,Math.max(104,bodyBottom-250),s.imageFit,s.imagePosition)}
  else if(s.id==='code'){const lines=String(s.code||'').split('\n').slice(0,5);lines.forEach((v,j)=>block(ctx,`$ ${v}`,822,263+j*39,175,{size:13,color:t.ink,family:fontMono,maxLines:2}))}
  else if(['checklist','numbered','architecture','lab','project','metrics','changelog','comparison'].includes(s.id)){const items=String(s.bullets||'').split('\n').filter(Boolean).slice(0,4);items.forEach((v,j)=>{mono(ctx,String(j+1).padStart(2,'0'),822,261+j*48,14,t.accent);block(ctx,v.split('|').join(' / '),855,261+j*48,145,{size:14,color:t.ink,weight:600,maxLines:2})})}
  else{drawMark(ctx,s,858,267,104);line(ctx,t.accent,838,390,979,390,3);mono(ctx,'FIELD NOTES',844,406,12,t.muted)}
  const wideEnd=headline(ctx,s.title,left,top,705,maxTitleHeight,t,clamp(63*(s.scale||1),42,75),s.id==='quote'?fontSerif:fontSans,s.id==='quote'?500:700);
  // Suppress excerpts when there is not enough vertical room to avoid collisions.
  if(s.showSubtitle&&s.subtitle&&wideEnd+36<bodyBottom)block(ctx,s.subtitle,left,wideEnd+13,696,{size:18,color:t.muted,lh:1.3,maxLines:2});
  if(guides){ctx.save();ctx.setLineDash([9,8]);ctx.strokeStyle=t.warm;ctx.strokeRect(64,65,952,virtualH-190);ctx.restore()}
  commonBottom(ctx,s,virtualH,t);seriesMotif(ctx,s,index,total,virtualH,t);ctx.restore();return;
}
ctx.save();ctx.beginPath();ctx.rect(0,224,1080,Math.max(0,virtualH-364));ctx.clip();pattern(ctx,s,t,virtualH);const primary=(size=90)=>size*(s.scale||1),secondary=(size=31)=>size*(.8+.2*(s.scale||1));const subtitle=(x,y,w,max=6)=>{if(s.showSubtitle&&s.subtitle)return block(ctx,s.subtitle,x,y,w,{size:secondary(28),color:t.muted,lh:1.5,maxLines:max});return y};const title=(x,y,w,limit=room*.45,size=92,typ=fontSans,wt=700)=>headline(ctx,s.title,x,y,w,limit,t,primary(size),typ,wt);const cap=(x=64,y=lower-60)=>pill(ctx,s,x,y,s.tag,t);
if(EXTRA_LAYOUT_IDS.has(s.id)){renderExtraLayout(ctx,s,t,{safeTop,lower,room,title,subtitle,cap,primary});
}else if(s.id==='cover'){
  const ty=safeTop+Math.min(90,room*.12);pill(ctx,s,64,ty,s.tag,t);const after=title(64,ty+102,930,Math.min(room*.54,480),98);const subY=Math.max(after+35,lower-220);subtitle(65,subY,820,4);drawLink(ctx,s,66,lower-34,t);line(ctx,t.accent,64,ty+77,165,ty+77,5);
}else if(s.id==='journal'){
  const ty=safeTop+40;mono(ctx,'01 — DOCUMENT',64,ty,18,t.warm);const after=title(64,ty+64,910,Math.min(455,room*.55),94);line(ctx,t.accent,64,after+18,236,after+18,4);subtitle(64,after+58,850,5);cap(64,lower-66);drawLink(ctx,s,64,lower-15,t);
}else if(s.id==='lab'){
  const ty=safeTop+20;pill(ctx,s,64,ty,s.tag,t);const after=title(64,ty+90,950,Math.min(280,room*.38),78);subtitle(64,after+22,880,3);const start=Math.max(after+130,lower-365);const list=String(s.bullets||'').split('\n').filter(Boolean).slice(0,4);const gap=17,bw=(950-gap*(list.length-1))/Math.max(1,list.length);list.forEach((b,j)=>{const x=64+j*(bw+gap);roundRect(ctx,x,start,bw,145,12,t.surface,t.border);mono(ctx,`0${j+1}`,x+20,start+20,15,t.accent);block(ctx,b,x+20,start+64,bw-30,{size:20,color:t.ink,weight:600,maxLines:2});if(j<list.length-1)line(ctx,t.accent,x+bw,start+72,x+bw+gap,start+72,2)});drawLink(ctx,s,64,lower-25,t)
}else if(s.id==='project'){
 const ty=safeTop+22;mono(ctx,'PROJECT / STATUS TRACKER',64,ty,16,t.muted);const after=title(64,ty+49,920,Math.min(290,room*.41),82);subtitle(64,after+26,850,3);const boxes=String(s.bullets||'').split('\n').filter(Boolean).slice(0,4);const start=Math.max(after+134,lower-325);boxes.forEach((b,i)=>{const x=64+(i%2)*484,y=start+Math.floor(i/2)*126;roundRect(ctx,x,y,466,107,12,t.surface,t.border);mono(ctx,`0${i+1}`,x+20,y+18,16,t.accent);block(ctx,b,x+70,y+24,375,{size:27,color:t.ink,weight:650,maxLines:2})});drawLink(ctx,s,64,lower-26,t)
}else if(s.id==='code'){
 const ty=safeTop+8;const after=title(64,ty,950,Math.min(230,room*.3),76);subtitle(64,after+18,920,2);let y=Math.max(after+110,lower-400);let height=clamp(lower-y-35,220,425);roundRect(ctx,64,y,952,height,14,t.surface,t.border);roundRect(ctx,65,y+1,950,54,12,t.soft);line(ctx,t.border,65,y+55,1015,y+55);[t.accent,t.warm,t.border].forEach((col,i)=>{ctx.fillStyle=col;ctx.beginPath();ctx.arc(90+i*24,y+28,7,0,Math.PI*2);ctx.fill()});mono(ctx,'TERMINAL / SHELL',720,y+20,13,t.muted);const codeLines=String(s.code||'').split('\n').slice(0,9);codeLines.forEach((row,j)=>{const yy=y+83+j*43;const size=maxText(ctx,row,880,24,13,500,fontMono);text(ctx,row.startsWith('#')?row:`$ ${row}`,90,yy,size,row.startsWith('#')?t.muted:t.ink,500,fontMono)});drawLink(ctx,s,64,lower-20,t)
}else if(s.id==='quote'){
 const ty=safeTop+15;text(ctx,'“',64,ty-45,190,t.accent,400,fontSerif);const after=title(64,ty+125,938,Math.min(550,room*.65),94,fontSerif,500);line(ctx,t.accent,64,after+25,160,after+25,4);subtitle(64,after+66,840,4);drawLink(ctx,s,64,lower-30,t)
}else if(s.id==='metrics'){
 const ty=safeTop+22;const after=title(64,ty,950,Math.min(270,room*.36),83);subtitle(64,after+20,900,3);const vals=String(s.bullets||'').split('\n').filter(Boolean).slice(0,3),start=Math.max(after+140,lower-330);vals.forEach((l,i)=>{const [value,label]=l.split('|'),x=64+i*323;roundRect(ctx,x,start,305,210,12,t.surface,t.border);mono(ctx,value||'—',x+20,start+30,62,t.accent,600);line(ctx,t.border,x+20,start+114,x+283,start+114);block(ctx,label||'',x+20,start+135,260,{size:22,color:t.ink,maxLines:2,weight:600})});drawLink(ctx,s,64,lower-24,t)
}else if(s.id==='comparison'){
 const ty=safeTop+15;const after=title(64,ty,920,Math.min(260,room*.34),80);subtitle(64,after+12,900,3);const content=String(s.bullets||'').split('\n').filter(Boolean).slice(0,2),start=Math.max(after+135,lower-400);content.forEach((part,i)=>{const [name,...items]=part.split('|'),x=64+i*484;roundRect(ctx,x,start,464,Math.min(340,lower-start-30),12,t.surface,t.border);fill(ctx,i===0?t.accent:t.ink,x,start,464,7);block(ctx,name||`Approach ${i+1}`,x+24,start+29,415,{size:28,color:t.ink,weight:700,maxLines:2});items.slice(0,4).forEach((b,j)=>{line(ctx,t.border,x+22,start+108+j*61,x+441,start+108+j*61);block(ctx,b,x+24,start+116+j*61,410,{size:19,color:t.muted,maxLines:2})})});drawLink(ctx,s,64,lower-27,t)
}else if(s.id==='checklist'){
 const ty=safeTop+10;const after=title(64,ty,900,Math.min(265,room*.36),86);subtitle(64,after+23,850,3);let y=Math.max(after+131,lower-415);const items=String(s.bullets||'').split('\n').filter(Boolean).slice(0,6),spacing=Math.min(82,(lower-y-25)/Math.max(items.length,1));items.forEach((b,i)=>{roundRect(ctx,64,y+i*spacing,43,43,8,t.accentSoft,t.border);line(ctx,t.accent,75,y+i*spacing+20,85,y+i*spacing+30,3);line(ctx,t.accent,85,y+i*spacing+30,97,y+i*spacing+12,3);block(ctx,b,132,y+i*spacing+7,835,{size:27,color:t.ink,weight:550,maxLines:1});line(ctx,t.border,132,y+(i+1)*spacing-16,1016,y+(i+1)*spacing-16)});drawLink(ctx,s,64,lower-28,t)
}else if(s.id==='announcement'){
 const ty=safeTop+24;pill(ctx,s,64,ty,s.tag,t);line(ctx,t.accent,64,ty+75,1016,ty+75,4);const after=title(64,ty+112,930,Math.min(450,room*.57),101);subtitle(64,after+45,860,5);drawMark(ctx,s,818,Math.min(lower-240,after+120),154);drawLink(ctx,s,64,lower-28,t)
}else if(s.id==='changelog'){
 const ty=safeTop+14;const after=title(64,ty,910,Math.min(255,room*.33),82);subtitle(64,after+15,920,3);const start=Math.max(after+129,lower-395),items=String(s.bullets||'').split('\n').filter(Boolean).slice(0,5);items.forEach((b,i)=>{const y=start+i*78;roundRect(ctx,64,y,90,54,8,t.accentSoft);mono(ctx,`+ 0${i+1}`,78,y+19,17,t.accent);block(ctx,b,190,y+7,795,{size:24,color:t.ink,weight:550,maxLines:2});line(ctx,t.border,190,y+64,1016,y+64)});drawLink(ctx,s,64,lower-24,t)
}else if(s.id==='architecture'){
 const ty=safeTop+10;const after=title(64,ty,930,Math.min(210,room*.3),76);subtitle(64,after+10,920,3);const arr=String(s.bullets||'').split('\n').filter(Boolean).slice(0,4),start=Math.max(after+155,lower-355);const bw=205,gap=40;arr.forEach((a,i)=>{const x=64+i*(bw+gap);roundRect(ctx,x,start,bw,183,12,t.surface,t.border);mono(ctx,`0${i+1} / NODE`,x+19,start+21,13,t.accent);block(ctx,a,x+19,start+76,bw-32,{size:23,color:t.ink,weight:650,maxLines:2});if(i<Math.min(3,arr.length-1)){line(ctx,t.accent,x+bw,start+90,x+bw+gap-8,start+90,3);line(ctx,t.accent,x+bw+gap-20,start+82,x+bw+gap-8,start+90,3);line(ctx,t.accent,x+bw+gap-20,start+98,x+bw+gap-8,start+90,3)}});mono(ctx,'SEPARATE RESPONSIBILITIES. MAKE THE FLOW VISIBLE.',64,start+230,15,t.muted);drawLink(ctx,s,64,lower-24,t)
}else if(s.id==='community'){
 const ty=safeTop+40;mono(ctx,'COMMUNITY IS A PRACTICE',64,ty,17,t.warm);const after=title(64,ty+64,950,Math.min(410,room*.5),99);subtitle(64,after+32,890,4);const y=Math.max(after+175,lower-195),items=String(s.bullets||'').split('\n').filter(Boolean).slice(0,3);items.forEach((a,j)=>{const x=64+j*323;roundRect(ctx,x,y,306,88,12,t.surface,t.border);block(ctx,a,x+17,y+28,280,{size:20,color:t.ink,weight:650,maxLines:2})});drawLink(ctx,s,64,lower-25,t)
}else if(s.id==='minimal'){
 fill(ctx,t.bg,0,0,1080,virtualH);drawLogo(ctx,s,70,288);mono(ctx,s.kicker,64,198,18,t.accent);line(ctx,t.accent,64,248,195,248,4);const after=title(64,295,942,Math.min(600,room*.69),104);subtitle(64,after+56,890,4);line(ctx,t.border,64,virtualH-165,1016,virtualH-165);drawLink(ctx,s,64,virtualH-135,t)
}else if(s.id==='numbered'){
 const ty=safeTop+11;pill(ctx,s,64,ty,s.tag,t);const after=title(64,ty+85,900,Math.min(270,room*.35),84);subtitle(64,after+13,900,3);const items=String(s.bullets||'').split('\n').filter(Boolean).slice(0,5),start=Math.max(after+125,lower-415),spacing=Math.min(91,(lower-start-20)/Math.max(1,items.length));items.forEach((b,i)=>{const y=start+i*spacing;mono(ctx,String(i+1).padStart(2,'0'),64,y+4,36,t.accent,600);block(ctx,b,142,y+7,864,{size:27,color:t.ink,weight:550,maxLines:1});line(ctx,t.border,142,y+spacing-19,1016,y+spacing-19)});drawLink(ctx,s,64,lower-26,t)
}else if(s.id==='image'){
 const ty=safeTop+11;const after=title(64,ty,940,Math.min(230,room*.28),73);subtitle(64,after+9,930,3);const y=Math.max(after+100,lower-430),h=Math.min(376,Math.max(180,lower-y-26));roundRect(ctx,64,y,952,h,12,t.soft,t.border);const im=getCachedImage(s.image);if(im){cropped(ctx,im,67,y+3,946,h-6,s.imageFit,s.imagePosition)}else{ctx.save();ctx.setLineDash([9,10]);roundRect(ctx,100,y+37,880,h-74,10,null,t.border);ctx.restore();mono(ctx,'ADD REAL SCREENSHOT / SYSTEM DIAGRAM',145,y+h/2-14,21,t.muted);drawMark(ctx,s,870,y+h/2-40,75)}drawLink(ctx,s,64,lower-24,t)
}
ctx.restore();commonBottom(ctx,s,virtualH,t);seriesMotif(ctx,s,index,total,virtualH,t);
if(guides){ctx.save();ctx.setLineDash([13,11]);ctx.strokeStyle='#AD7742';ctx.lineWidth=2;ctx.strokeRect(64,65,952,virtualH-190);line(ctx,t.warm,64,220,1016,220,1.5);ctx.restore()}ctx.restore();
}
function render(){const canvas=$('postCanvas');if(!canvas)return;frame(canvas.getContext('2d'),slide(),app.selected,app.slides.length,{guides:showGuides});fitCanvas();}
function fitCanvas(){const canvas=$('postCanvas'),holder=document.querySelector('.canvas-holder'),stage=$('previewStage');if(!canvas||!stage)return;const stageW=Math.max(150,stage.clientWidth-60),stageH=Math.max(170,stage.clientHeight-55),scale=Math.min(stageW/canvas.width,stageH/canvas.height)*zoom;canvas.style.width=Math.max(20,canvas.width*scale)+'px';canvas.style.height=Math.max(20,canvas.height*scale)+'px';holder.style.width=canvas.style.width;holder.style.height=canvas.style.height;$('zoomVal').textContent=zoom===1?'Fit':Math.round(zoom*100)+'%';}
function formatOption(v){return FORMATS.map(f=>`<option value="${f.id}" ${f.id===v?'selected':''}>${esc(f.label)} · ${f.w}×${f.h}</option>`).join('')}
function field(k,title,opts={}){const s=slide(),val=s[k]??'',help=opts.help?`<span class="field-meta">${esc(opts.help)}</span>`:'',attr=`data-prop="${k}"`,limit=opts.max||1600;let input;
if(opts.type==='textarea')input=`<textarea ${attr} ${opts.code?'class="code-field"':''} rows="${opts.rows||4}" maxlength="${limit}" placeholder="${esc(opts.placeholder||'')}" spellcheck="true">${esc(val)}</textarea>`;
else if(opts.type==='select')input=`<select ${attr}>${opts.options.map(v=>`<option value="${esc(v.value)}" ${v.value===val?'selected':''}>${esc(v.name)}</option>`).join('')}</select>`;
else if(opts.type==='range')input=`<input ${attr} type="range" min="${opts.min||0}" max="${opts.max||100}" step="${opts.step||1}" value="${val}" />`;
else input=`<input ${attr} type="text" value="${esc(val)}" maxlength="${limit}" placeholder="${esc(opts.placeholder||'')}" />`;
return `<div class="field"><label for="fld-${k}">${esc(title)} ${help}</label>${input.replace('data-prop=',`id="fld-${k}" data-prop=`)}</div>`}
function toggle(k,title,description){return `<label class="checkbox-row"><input type="checkbox" data-prop="${k}" ${slide()[k]?'checked':''}/><span><b>${esc(title)}</b><small>${esc(description||'')}</small></span></label>`}
function segment(k,title,options){return `<div class="field"><span class="field-label">${esc(title)}</span><div class="segment">${options.map(o=>`<button data-seg-key="${k}" data-seg-value="${o.value}" class="${slide()[k]===o.value?'on':''}">${esc(o.label)}</button>`).join('')}</div></div>`}
function renderContentInspector(){let s=slide();const html=`<h3>01 / Content and messaging</h3>`+
field('kicker','Section / reference',{help:'MONO LABEL',max:90})+
field('title','Main headline',{type:'textarea',rows:3,max:260})+
field('subtitle','Supporting copy',{type:'textarea',rows:4,max:600})+
field('tag','Category badge',{max:75})+
field('detail','Secondary callout',{max:110})+
`<hr class="group-divider"/><h3>02 / Layout-specific content</h3>`+
((['code','terminal'].includes(s.id))?field('code','Code or terminal lines',{type:'textarea',rows:5,max:800,code:true}):
(['lab','project','metrics','comparison','checklist','changelog','architecture','community','numbered','stat','timeline','layers','spotlight','beforeafter','method','findings','questions','tradeoffs','dosdonts','faq','resources','release','roadmap','digest','diagram','myth','insight'].includes(s.id))?field('bullets',['metrics','stat'].includes(s.id)?'Metrics (number|label)':(['beforeafter','dosdonts','myth','faq','comparison'].includes(s.id)?'Cards (header|point|point)':'Rows (one per line)'),{type:'textarea',rows:6,max:1200,code:true,help:'ONE PER LINE'}):`<p class="tip-text">This layout focuses on typography. For structured lists, diagrams, or code, switch to one of the technical layouts.</p>`)+
`<hr class="group-divider"/><h3>03 / Post signature</h3>`+field('label','Footer micro-label',{max:90})+field('customFooter','Custom footer (optional)',{max:90,placeholder:'Uses footer label if empty'})+
field('sourceUrl','Source / article URL',{max:450,placeholder:'https://runtimegarden.com/...'});
$('contentInspector').innerHTML=html;attachFormHandlers($('contentInspector'))}
function renderStyleInspector(){const s=slide(),t=palette(s);$('styleInspector').innerHTML=`<h3>01 / Canvas format</h3>`+
field('format','Social platform / dimensions',{type:'select',options:FORMATS.map(f=>({value:f.id,name:`${f.label} · ${f.w}×${f.h}`}))})+
`<div class="custom-dims ${s.format==='custom'?'':'hidden'}" id="customDims">${field('customWidth','Custom width (px)',{max:4})}${field('customHeight','Custom height (px)',{max:4})}</div>`+
`<button class="dashed-btn" id="syncFormatBtn" type="button">Apply this size to every slide</button>`+
`<hr class="group-divider"/><h3>02 / Connected collection styles</h3>`+
`<p class="tip-text">Match the entire collection with one shared visual rhythm and progression marker.</p>`+
`<select id="seriesStyleSelect" aria-label="Series family">${SERIES_PACKS.map(p=>`<option value="${p.id}" ${app.seriesPack===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`+
`<button class="dashed-btn" type="button" id="applySeriesStyleBtn">Apply series identity to all slides</button>`+
segment('theme','Color mode',[{value:'light',label:'Light-first'},{value:'dark',label:'Dark'}])+
segment('pattern','System texture',[{value:'dots',label:'Dots'},{value:'grid',label:'Grid'},{value:'none',label:'None'}])+
segment('backgroundMode','Surface treatment',[{value:'default',label:'Paper'},{value:'soft',label:'Muted'},{value:'surface',label:'Card'}])+
field('scale','Headline scale',{type:'range',min:.7,max:1.25,step:.05,help:Math.round(s.scale*100)+'%'})+
`<hr class="group-divider"/><h3>02 / Brand-safe visibility</h3>`+
toggle('showLogo','Original v2 logo','Use authentic color-correct SVG lockup.')+
toggle('showDomain','Domain in footer','The canonical runtimegarden.com URL.')+
toggle('showTag','Category badge','Small monospaced label in system green.')+
toggle('showSubtitle','Supporting text','Hide when you need a more minimal post.')+
toggle('numbering','Carousel pagination','Show current slide and total at the top.')+
`<hr class="group-divider"/><h3>03 / Protected visual language</h3><div class="palette">${Object.entries(t).filter(([k])=>['bg','surface','ink','muted','accent','accentSoft','border','warm'].includes(k)).map(([key,v])=>`<div><div class="swatch" style="background:${v}"></div><span>${key}</span></div>`).join('')}</div>`+
`<div class="brand-locked"><span>♧</span><div><b>Design Kit v2 is locked</b><div>The correct palette, original terminal-leaf identity and approved font stacks are enforced across every layout.</div></div></div>`+
`<hr class="group-divider"/><h3>04 / Image handling</h3>`+
field('imageFit','Image crop mode',{type:'select',options:[{value:'cover',name:'Crop to fill'},{value:'contain',name:'Fit entire image'}]})+
field('imagePosition','Vertical image position',{type:'range',min:0,max:100,step:5,help:s.imagePosition+'%'})+
`<button class="dashed-btn" type="button" id="goAssetsBtn">＋ Open media library</button><p class="tip-text">Images are used only by the “Visual Case Study” layout. Other layouts remain editorial and diagram-first.</p>`;
attachFormHandlers($('styleInspector'));$('goAssetsBtn').onclick=()=>switchLeft('assets');$('syncFormatBtn').onclick=setFormatForAll;$('applySeriesStyleBtn').onclick=()=>applySeriesStyle($('seriesStyleSelect').value)}
function makeCaption(){const s=slide();const body=(s.caption||`${s.title}\n\n${s.subtitle}`).trim();const url=s.sourceUrl.trim();const tags=s.hashtags.trim();return [body,url,tags].filter(Boolean).join('\n\n')}
function preflight(){
  const s=slide(),messages=[];
  const issues=[];
  if(!String(s.title||'').trim())issues.push('Add a headline before exporting.');
  if(String(s.title||'').length>115)issues.push('Very long headline. Check the canvas for clipping.');
  if(s.id==='image'&&!s.image)issues.push('Visual Case Study has no screenshot / diagram yet.');
  if(s.sourceUrl){try{const u=new URL(s.sourceUrl);if(!['http:','https:'].includes(u.protocol))issues.push('Source URL must be HTTP(S).')}catch{issues.push('Source URL format is not valid.')}}
  const sizes=new Set(app.slides.map(x=>x.format));if(sizes.size>1)issues.push('Mixed canvas sizes: use “Apply this format to all slides” for a carousel.');
  const template=SAMPLES.find(t=>t.id===s.id);
  if(template&&s.title===template.title)messages.push('Example template headline: replace with content tied to a real piece of work.');
  if(!s.sourceUrl)messages.push('No source URL set. Add one when referencing a real published article or project.');
  messages.push('Verify all claims, stats, dates, and statuses manually. This tool does not fact-check.');
  return {issues,messages};
}
function preflightHTML(){const p=preflight();return `<div class="preflight"><div class="preflight-heading">${p.issues.length?'Review needed':'Layout ready for review'}</div>${p.issues.map(x=>`<div class="preflight-line"><span class="preflight-warn">!</span><span>${esc(x)}</span></div>`).join('')}${p.messages.map(x=>`<div class="preflight-line"><span class="preflight-info">i</span><span>${esc(x)}</span></div>`).join('')}</div>`}
function renderPublishInspector(){let s=slide();$('publishInspector').innerHTML=`<h3>01 / Write your caption</h3>`+
field('caption','Post copy',{type:'textarea',rows:6,max:3000,placeholder:'Leave blank to use headline + supporting copy'})+
field('hashtags','Tags / discovery',{type:'textarea',rows:2,max:500})+
field('date','Planned publication date',{max:40,placeholder:'YYYY-MM-DD (optional)'})+
`<hr class="group-divider"/><h3>02 / Preview caption</h3><div class="publish-sample" id="captionPreview">${esc(makeCaption())}</div><div class="action-inline"><button id="copyCaptionBtn">Copy caption</button><button id="exportAllBtn">Export ZIP</button></div>`+
`<hr class="group-divider"/><h3>03 / Export specification</h3><div class="format-card"><b>${esc(getFormat(s).label||'')}</b><span>${getFormat(s).w} × ${getFormat(s).h} px · sRGB browser canvas</span></div>`+
`<h3>04 / Preflight review</h3>`+preflightHTML()+
`<h3>Keyboard shortcuts</h3><div class="key-tip"><kbd>Ctrl</kbd> + <kbd>Z</kbd> Undo<br/><kbd>Ctrl</kbd> + <kbd>Y</kbd> Redo<br/><kbd>Ctrl</kbd> + <kbd>S</kbd> Save JSON<br/><kbd>←</kbd> / <kbd>→</kbd> Switch slide</div>`;
attachFormHandlers($('publishInspector'));$('copyCaptionBtn').onclick=copyCaption;$('exportAllBtn').onclick=()=>exportZip()}
function attachFormHandlers(container){container.querySelectorAll('[data-prop]').forEach(el=>{
 let original=null;
 el.addEventListener('focus',()=>{original=snapshot()});
 el.addEventListener('input',()=>{let v=el.type==='checkbox'?el.checked:el.value;if(el.type==='range')v=Number(v);setSlideProp(el.dataset.prop,v);if(el.dataset.prop==='format'){render();if($('customDims'))$('customDims').classList.toggle('hidden',v!=='custom')}if(['customWidth','customHeight'].includes(el.dataset.prop)){slide()[el.dataset.prop]=clamp(Math.round(Number(v)||1080),el.dataset.prop==='customWidth'?400:300,4096);render();updateCanvasMeta()}if(el.dataset.prop==='scale'||el.dataset.prop==='imagePosition'){const span=el.parentElement.querySelector('.field-meta');if(span)span.textContent=el.dataset.prop==='scale'?Math.round(v*100)+'%':v+'%'}if(el.dataset.prop==='caption'||el.dataset.prop==='hashtags'){const cp=$('captionPreview');if(cp)cp.textContent=makeCaption()}});
 el.addEventListener('change',()=>{if(original&&original!==snapshot()){history.push(original);if(history.length>70)history.shift();future=[];updateHistory();original=null}updateCanvasMeta();if(['format','theme'].includes(el.dataset.prop))renderStyleInspector()})
 });container.querySelectorAll('[data-seg-key]').forEach(btn=>btn.addEventListener('click',()=>mutate(()=>{slide()[btn.dataset.segKey]=btn.dataset.segValue}))) }
function updateCanvasMeta(){const s=slide(),t=SAMPLES.find(t=>t.id===s.id),f=getFormat(s);$('workTitle').textContent=t?.name||'Social post';$('workSubtitle').textContent=t?.desc||'';$('formatPill').textContent=`${f.w} × ${f.h}`;if($('quickFormat'))$('quickFormat').value=s.format;$('canvasInfo').textContent=`${f.w}×${f.h} px · ${s.theme} · ${app.slides.length} slide${app.slides.length!==1?'s':''}`;$('slideIndicator').textContent=`${String(app.selected+1).padStart(2,'0')} / ${String(app.slides.length).padStart(2,'0')}`;$('slideCount').textContent=app.slides.length;$('projectName').value=app.name;$('prevSlideBtn').disabled=app.selected===0;$('nextSlideBtn').disabled=app.selected===app.slides.length-1;}
const thumbnailCache=new Map();
function makeThumb(template,width=240,height=150,overrideSlide=null){
 const key=overrideSlide?null:`${template.id}-${width}-${height}`;
 if(key&&thumbnailCache.has(key))return thumbnailCache.get(key);
 const raw=document.createElement('canvas'),ss=overrideSlide||{...NEW_SLIDE(template.id),format:'linkedin',showDomain:false,showLogo:true};
 frame(raw.getContext('2d'),ss,0,1);
 const c=document.createElement('canvas');c.width=Math.ceil(width*2);c.height=Math.ceil(height*2);
 const ctx=c.getContext('2d'), ratio=Math.min(c.width/raw.width,c.height/raw.height),dw=raw.width*ratio,dh=raw.height*ratio;
 ctx.fillStyle=palette(ss).bg;ctx.fillRect(0,0,c.width,c.height);
 ctx.drawImage(raw,(c.width-dw)/2,(c.height-dh)/2,dw,dh);
 // The DOM holds only a tiny raster thumbnail rather than a full-resolution Canvas.
 raw.width=1;raw.height=1;c.style.width=width+'px';c.style.height=height+'px';
 if(key)thumbnailCache.set(key,c);return c;
}

function applySeriesPack(packId){const pack=SERIES_PACKS.find(p=>p.id===packId);if(!pack)return; if(app.slides.length>1&&!confirm('Replace the current collection with '+pack.slides.length+' coordinated slides? Save the current project JSON first if needed.'))return;
 mutate(()=>{const format=slide().format,customWidth=slide().customWidth,customHeight=slide().customHeight;app.name=pack.name+' · Runtime Garden';app.seriesPack=pack.id;app.selected=0;app.slides=pack.slides.map((id,i)=>{const s=NEW_SLIDE(id);s.format=format;s.customWidth=customWidth;s.customHeight=customHeight;s.theme=pack.theme;s.pattern=pack.pattern;s.series=pack.id;s.seriesLabel=pack.name;s.seriesVariant=i===0?'opening':i===pack.slides.length-1?'closing':'regular';s.chapterNumber=i+1;s.numbering=true;const txt=SERIES_CONTENT[id];if(txt){s.title=txt[0];s.subtitle=txt[1]}if(id==='stat')s.bullets='—|ADD A VERIFIED METRIC';return s})});switchLeft('slides');toast(`${pack.slides.length} connected slides created: ${pack.name}. Edit every slide before publishing.`);
}
function applySeriesStyle(packId){const pack=SERIES_PACKS.find(p=>p.id===packId);if(!pack)return;mutate(()=>{app.seriesPack=pack.id;app.slides.forEach((s,i)=>{s.series=pack.id;s.seriesLabel=pack.name;s.seriesVariant=i===0?'opening':i===app.slides.length-1?'closing':'regular';s.theme=pack.theme;s.pattern=pack.pattern})});toast('Unified series styling applied to all slides.');}
function renderSeries(){const g=$('seriesGrid');if(!g)return;g.innerHTML='';SERIES_PACKS.forEach((p,i)=>{const el=document.createElement('button');el.type='button';el.className='series-card';const sample={...NEW_SLIDE(p.slides[0]),theme:p.theme,pattern:p.pattern,series:p.id,format:'square'};el.appendChild(makeThumb(SAMPLES.find(t=>t.id===p.slides[0]),78,91,sample));const info=document.createElement('div');info.className='series-description';info.innerHTML=`<b>${esc(p.name)}</b><span>${esc(p.desc)}</span><small>${p.slides.length} connected frames · ${esc(p.theme)} · ${esc(p.pattern)}</small>`;el.appendChild(info);el.onclick=()=>applySeriesPack(p.id);g.appendChild(el)});}
function setFormatForAll(){mutate(()=>{const f=getFormat(slide());app.slides.forEach(s=>{s.format=slide().format;s.customWidth=f.w;s.customHeight=f.h})});toast('All slides now share '+getFormat(slide()).w+'×'+getFormat(slide()).h+' dimensions.')}

function renderTemplates(){const q=$('templateSearch').value.trim().toLowerCase(),grid=$('templateGrid');grid.innerHTML='';let filtered=SAMPLES.filter(t=>(filter==='all'||t.category===filter)&&(t.name+' '+t.desc+' '+t.category).toLowerCase().includes(q));filtered.forEach((t,i)=>{const card=document.createElement('button');card.type='button';card.className='template-card'+(slide().id===t.id?' selected':'');card.setAttribute('aria-label','Apply '+t.name+' template');card.appendChild(makeThumb(t,130,104));const bottom=document.createElement('div');bottom.className='temp-bottom';bottom.innerHTML=`<div><b>${esc(t.name)}</b><small>${esc(t.category)}</small></div><span class="temp-index">${String(SAMPLES.indexOf(t)+1).padStart(2,'0')}</span>`;card.appendChild(bottom);card.onclick=()=>mutate(()=>{const old=slide(),neo=NEW_SLIDE(t.id);neo.format=old.format;neo.theme=old.theme;neo.numbering=old.numbering;neo.image=old.image;neo.uid=old.uid;neo.series=old.series;neo.seriesVariant=old.seriesVariant;neo.customWidth=old.customWidth;neo.customHeight=old.customHeight;app.slides[app.selected]=neo});grid.appendChild(card)});if(!filtered.length)grid.innerHTML='<p class="tip-text">No matching layouts. Try a different search.</p>'}
function renderSlides(){const el=$('slidesList');el.innerHTML='';app.slides.forEach((s,i)=>{const card=document.createElement('div');card.className='slide-card'+(i===app.selected?' current':'');card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`Select slide ${i+1}`);card.onclick=e=>{if(e.target.closest('.slide-controls'))return;app.selected=i;refresh()};card.onkeydown=e=>{if(e.key==='Enter'){app.selected=i;refresh()}};card.appendChild(makeThumb(SAMPLES.find(x=>x.id===s.id),75,75,{...s,format:'square',showDomain:false}));const details=document.createElement('div');details.className='slide-details';details.innerHTML=`<b>${esc(s.title||'Untitled')}</b><small>${String(i+1).padStart(2,'0')} · ${esc(SAMPLES.find(t=>t.id===s.id)?.name||'')}</small><div class="slide-controls"><button title="Move up" data-act="up" ${i===0?'disabled':''}>↑</button><button title="Move down" data-act="down" ${i===app.slides.length-1?'disabled':''}>↓</button><button title="Duplicate" data-act="duplicate">⧉</button><button title="Delete" data-act="delete" ${app.slides.length===1?'disabled':''}>×</button></div>`;details.querySelectorAll('[data-act]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();slideAction(btn.dataset.act,i)});card.appendChild(details);el.appendChild(card)})}
function renderAssets(){const g=$('assetGallery');g.innerHTML='';const imgs=new Map();for(const s of app.slides){if(s.image&&typeof s.image==='string')imgs.set(s.image,{name:'Slide image'})}if(imgs.size===0){g.innerHTML='<p class="tip-text">No images yet. Upload an original screenshot or system diagram to use on a Visual Case Study slide.</p>';return}for(const [src,ob] of imgs){const b=document.createElement('button');b.className='asset-item';const im=document.createElement('img');im.src=src;im.alt='Image in this collection';const txt=document.createElement('span');txt.textContent=ob.name;b.append(im,txt);b.onclick=()=>mutate(()=>{slide().image=src;if(slide().id!=='image'){const old=slide(),neo=NEW_SLIDE('image');neo.format=old.format;neo.theme=old.theme;neo.image=src;neo.uid=old.uid;app.slides[app.selected]=neo}});g.appendChild(b)}}
function refresh(){updateCanvasMeta();render();renderTemplates();if(leftTab==='series')renderSeries();renderSlides();renderAssets();if(inspectorTab==='content')renderContentInspector();if(inspectorTab==='style')renderStyleInspector();if(inspectorTab==='publish')renderPublishInspector();updateHistory()}
function switchLeft(tab){leftTab=tab;document.querySelectorAll('[data-left]').forEach(b=>b.classList.toggle('selected',b.dataset.left===tab));['templates','series','slides','assets'].forEach(p=>$(p+'Panel').classList.toggle('hidden',p!==tab));if(tab==='slides')renderSlides();if(tab==='series')renderSeries();if(tab==='assets')renderAssets()}
function switchInspector(tab){inspectorTab=tab;document.querySelectorAll('[data-inspect]').forEach(b=>b.classList.toggle('selected',b.dataset.inspect===tab));['content','style','publish'].forEach(p=>$(p+'Inspector').classList.toggle('hidden',p!==tab));if(tab==='content')renderContentInspector();if(tab==='style')renderStyleInspector();if(tab==='publish')renderPublishInspector()}
function slideAction(action,i){if(action==='delete'&&app.slides.length===1)return;mutate(()=>{if(action==='up'&&i>0){[app.slides[i-1],app.slides[i]]=[app.slides[i],app.slides[i-1]];app.selected=i-1}else if(action==='down'&&i<app.slides.length-1){[app.slides[i+1],app.slides[i]]=[app.slides[i],app.slides[i+1]];app.selected=i+1}else if(action==='delete'){app.slides.splice(i,1);app.selected=clamp(app.selected,0,app.slides.length-1)}else if(action==='duplicate'&&app.slides.length<100){const copy=structuredClone(app.slides[i]);copy.uid=uid();app.slides.splice(i+1,0,copy);app.selected=i+1}})}
function addSlide(duplicate=false){if(app.slides.length>=100){toast('Maximum of 100 slides per collection.');return}mutate(()=>{let s;if(duplicate){s=structuredClone(slide());s.uid=uid()}else{s=NEW_SLIDE('numbered');s.format=slide().format;s.customWidth=slide().customWidth;s.customHeight=slide().customHeight;s.theme=slide().theme;s.series=slide().series}s.numbering=true;app.slides.splice(app.selected+1,0,s);app.selected++});switchLeft('slides')}
function download(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
function saveProject(){download(new Blob([JSON.stringify({format:'runtime-garden-social-studio',version:2,exported:new Date().toISOString(),...app},null,2)],{type:'application/json'}),safeName(app.name)+'.rgstudio.json');toast('Editable project JSON exported.')}
function asBlob(canvas,type='image/png',quality=0.94){return new Promise((resolve,reject)=>{try{canvas.toBlob(b=>b?resolve(b):reject(Error('Image export failed.')),type,quality)}catch(e){reject(e)}})}
async function makeFullCanvas(s,i,total){await waitImage(s.image);if(document.fonts?.ready)await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,1600))]);const c=document.createElement('canvas');frame(c.getContext('2d'),s,i,total);return c}
let exporting=false;
async function exportSingle(type='png'){if(exporting)return;exporting=true;try{const cn=await makeFullCanvas(slide(),app.selected,app.slides.length),mime=type==='png'?'image/png':type==='jpeg'?'image/jpeg':'image/webp',blob=await asBlob(cn,mime);download(blob,`${safeName(app.name)}-${String(app.selected+1).padStart(2,'0')}-${slide().id}.${type==='jpeg'?'jpg':type}`);toast(`${type.toUpperCase()} exported at ${cn.width}×${cn.height}px`)}catch(e){toast('Export error: '+e.message)}finally{exporting=false}}
function zipFile(files){ // Standard ZIP 2.0, STORE method, no external dependency.
const encoder=new TextEncoder(),crcTable=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?(0xEDB88320^(c>>>1)):(c>>>1);crcTable[i]=c>>>0}
const crc32=data=>{let crc=0xffffffff;for(const byte of data)crc=crcTable[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0};let sections=[],directory=[],offset=0;const now=new Date(),dosTime=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1),dosDate=((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
for(const f of files){const name=encoder.encode(f.name),bytes=f.data,crc=crc32(bytes),local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x0800,true);lv.setUint16(8,0,true);lv.setUint16(10,dosTime,true);lv.setUint16(12,dosDate,true);lv.setUint32(14,crc,true);lv.setUint32(18,bytes.length,true);lv.setUint32(22,bytes.length,true);lv.setUint16(26,name.length,true);local.set(name,30);sections.push(local,bytes);
const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);cv.setUint16(12,dosTime,true);cv.setUint16(14,dosDate,true);cv.setUint32(16,crc,true);cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);central.set(name,46);directory.push(central);offset+=local.length+bytes.length}
const dirBytes=directory.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,dirBytes,true);ev.setUint32(16,offset,true);return new Blob([...sections,...directory,end],{type:'application/zip'})}
async function exportZip(){if(exporting)return;exporting=true;try{const files=[];for(let i=0;i<app.slides.length;i++){const s=app.slides[i],c=await makeFullCanvas(s,i,app.slides.length),blob=await asBlob(c);files.push({name:`${String(i+1).padStart(2,'0')}-${safeName(s.id)}.png`,data:new Uint8Array(await blob.arrayBuffer())})}files.push({name:'captions.txt',data:new TextEncoder().encode(app.slides.map((s,i)=>`SLIDE ${i+1}\n${(s.caption||s.title+'\n'+s.subtitle).trim()}\n${s.sourceUrl||''}\n${s.hashtags||''}`).join('\n\n-----\n\n'))});const blob=zipFile(files);download(blob,safeName(app.name)+'-carousel.zip');const sizes=new Set(app.slides.map(s=>s.format)).size;toast(sizes>1?`ZIP exported. Note: slides use ${sizes} different formats; social carousels usually require one size.`:`${app.slides.length} full-resolution slides packed into ZIP.`)}catch(e){toast('ZIP export failed: '+e.message)}finally{exporting=false}}

async function exportFormatBundle(){if(exporting)return;exporting=true;try{
 const select=$('exportFormats'),formats=[...select.selectedOptions].map(o=>o.value);if(!formats.length){toast('Select at least one output format.');return}
 const files=[];for(const fid of formats){const f=FORMATS.find(x=>x.id===fid);if(!f||fid==='custom')continue;for(let i=0;i<app.slides.length;i++){const sr={...app.slides[i],format:fid},c=await makeFullCanvas(sr,i,app.slides.length),blob=await asBlob(c);files.push({name:`${safeName(fid)}/${String(i+1).padStart(2,'0')}-${safeName(sr.id)}.png`,data:new Uint8Array(await blob.arrayBuffer())});}}
 files.push({name:'README.txt',data:new TextEncoder().encode('Runtime Garden Social Studio / export bundle\nEach folder contains the complete series sized for the specified target.\nCheck platform-specific crops and visibility before publishing.\n')});
 download(zipFile(files),safeName(app.name)+'-multi-format.zip');toast(`${files.length-1} images exported across ${formats.length} formats.`);
 }catch(e){toast('Multi-format export failed: '+e.message)}finally{exporting=false}}

async function copyCaption(){try{await navigator.clipboard.writeText(makeCaption());toast('Caption copied.')}catch{const t=document.createElement('textarea');t.value=makeCaption();document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();toast('Caption copied.')}}
function importProjectFile(file){if(!file)return;if(file.size>22000000){toast('Project JSON is too large (maximum 22 MB).');return}file.text().then(txt=>{const next=restoreFrom(txt);remember();app=next;refresh();saveSoon();toast(`Loaded ${app.slides.length} slides from project.`)}).catch(e=>toast('Cannot import: '+e.message))}
function resizeImageFile(file){return new Promise((resolve,reject)=>{if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>8000000)return reject(Error('Choose a JPG/PNG/WebP under 8 MB.'));const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{try{const factor=Math.min(1,1800/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*factor));c.height=Math.max(1,Math.round(im.height*factor));c.getContext('2d').drawImage(im,0,0,c.width,c.height);const d=c.toDataURL('image/jpeg',.86);resolve(d)}catch(e){reject(e)}finally{URL.revokeObjectURL(u)}};im.onerror=()=>{URL.revokeObjectURL(u);reject(Error('This image cannot be read.'))};im.src=u})}
function openModal(){$('exportModal').classList.remove('hidden')}
function closeModal(){$('exportModal').classList.add('hidden')}
function bindUI(){
 document.querySelectorAll('[data-left]').forEach(b=>b.onclick=()=>switchLeft(b.dataset.left));document.querySelectorAll('[data-inspect]').forEach(b=>b.onclick=()=>switchInspector(b.dataset.inspect));$('templateSearch').oninput=renderTemplates;for(const id of ['quickFormat','exportFormats']){const sel=$(id);if(sel)sel.innerHTML=FORMATS.filter(f=>id==='quickFormat'||f.id!=='custom').map(f=>`<option value="${f.id}">${esc(f.label)} · ${f.w}×${f.h}</option>`).join('')} $('quickFormat').onchange=e=>mutate(()=>slide().format=e.target.value);$('syncAllFormats').onclick=setFormatForAll;
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(n=>n.classList.toggle('active',n===b));renderTemplates()});
 $('projectName').addEventListener('focus',()=>{historyStart=snapshot()});$('projectName').oninput=e=>{app.name=e.target.value;saveSoon()};$('projectName').addEventListener('change',()=>{if(historyStart&&historyStart!==snapshot()){history.push(historyStart);future=[];updateHistory()}historyStart=null});
 $('addSlideBtn').onclick=()=>addSlide(false);$('duplicateSlideBtn').onclick=()=>addSlide(true);
 $('prevSlideBtn').onclick=()=>{if(app.selected>0){app.selected--;refresh()}};$('nextSlideBtn').onclick=()=>{if(app.selected<app.slides.length-1){app.selected++;refresh()}};
 $('undoBtn').onclick=undo;$('redoBtn').onclick=redo;
 $('saveBtn').onclick=saveProject;$('importBtn').onclick=()=>$('projectImportFile').click();$('projectImportFile').onchange=e=>{importProjectFile(e.target.files?.[0]);e.target.value=''};
 $('exportBtn').onclick=openModal;$('closeExportBtn').onclick=closeModal;$('exportModal').addEventListener('click',e=>{if(e.target.id==='exportModal')closeModal()});
 $('quickExportBtn').onclick=()=>exportSingle('png');document.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>{const kind=b.dataset.export;closeModal();if(kind==='png'||kind==='jpeg'||kind==='webp')exportSingle(kind);else if(kind==='zip')exportZip();else if(kind==='bundle')exportFormatBundle();else if(kind==='project')saveProject();else if(kind==='caption')copyCaption()});
 $('imageUpload').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=await resizeImageFile(f);mutate(()=>{slide().image=data;if(slide().id!=='image'){const old=slide(),neo=NEW_SLIDE('image');neo.image=data;neo.format=old.format;neo.theme=old.theme;neo.uid=old.uid;neo.series=old.series;neo.customWidth=old.customWidth;neo.customHeight=old.customHeight;app.slides[app.selected]=neo}});toast('Image imported locally and added to Visual Case Study.')}catch(e){toast(e.message)}e.target.value=''};
 $('removeImageBtn').onclick=()=>mutate(()=>slide().image=null);
 $('zoomOutBtn').onclick=()=>{zoom=clamp(Math.round((zoom-.1)*10)/10,.5,2);fitCanvas()};$('zoomInBtn').onclick=()=>{zoom=clamp(Math.round((zoom+.1)*10)/10,.5,2);fitCanvas()};$('fitBtn').onclick=()=>{zoom=1;fitCanvas()};$('gridBtn').onclick=()=>{showGuides=!showGuides;$('gridBtn').textContent='Guides: '+(showGuides?'on':'off');render()};
 document.addEventListener('keydown',e=>{const editable=e.target.matches('input,textarea,select,[contenteditable]');if(e.key==='Escape')closeModal();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject();return}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!editable){e.preventDefault();undo()}if((e.ctrlKey||e.metaKey)&&['y'].includes(e.key.toLowerCase())&&!editable){e.preventDefault();redo()}if(!editable&&e.key==='ArrowLeft'&&app.selected>0){app.selected--;refresh()}if(!editable&&e.key==='ArrowRight'&&app.selected<app.slides.length-1){app.selected++;refresh()}});
 window.addEventListener('resize',fitCanvas);new ResizeObserver(fitCanvas).observe($('previewStage'));
}
async function start(){try{const raw=localStorage.getItem('rg-social-studio-v1');if(raw){app=restoreFrom(raw)}}catch(e){console.warn('Local project could not be restored:',e)}
 bindUI();await initLogos();if(document.fonts?.ready){await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,1300))])}refresh();switchInspector('content');switchLeft('templates');updateHistory();window.__RG_STUDIO_TEST__={getApp:()=>app,frame,templates:SAMPLES.length,series:SERIES_PACKS.length,getSlide:slide,getFormat,exportZip,applySeriesPack,makeCaption};}
start().catch(e=>{console.error(e);toast('Studio initialization failed: '+e.message)});
