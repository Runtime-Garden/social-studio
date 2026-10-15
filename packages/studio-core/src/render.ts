// @ts-nocheck — Canvas renderer extracted VERBATIM from studio.js (P1, blueprint 8.1.3).
// DOM-free by construction: image lookups arrive through configureRenderer()
// so the offline adapter (assetCache/logoImages), the online app and tests can
// share one implementation. Output-neutrality is pinned by the render smoke,
// the committed goldens and the P0 evidence screenshots.

import { clamp, getFormat, SERIES_PACKS } from './registry.js';

export interface RendererAssets {
  /** Returns the decoded logo image for 'light'|'dark'|'mark'|'markDark', or null. */
  getLogo?: (key: string) => CanvasImageSource | null;
  /** Returns the decoded user image for a data-URI src, or null while loading. */
  getImage?: (src: string) => CanvasImageSource | null;
}

let rendererAssets: Required<RendererAssets> = { getLogo: () => null, getImage: () => null };

/** Wires image sources; the renderer itself never loads or decodes anything. */
export function configureRenderer(next: RendererAssets): void {
  rendererAssets = {
    getLogo: next.getLogo ?? (() => null),
    getImage: next.getImage ?? (() => null),
  };
}

export const C = {
  light:{bg:'#F6F8F3',surface:'#FFFFFF',soft:'#EDF2E9',ink:'#16271E',muted:'#506459',accent:'#286A47',accentSoft:'#DCEDE0',border:'#D8E1D6',warm:'#AD7742'},
  dark:{bg:'#0D1713',surface:'#15231B',soft:'#1B2C22',ink:'#EDF4ED',muted:'#AFBEB1',accent:'#8DD5A3',accentSoft:'#243E2C',border:'#304337',warm:'#D6AD77'}
};
export function palette(s){return C[s.theme]||C.light}
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
function drawLogo(ctx,s,y,width=280){if(!s.showLogo)return;const key=s.theme==='dark'?'dark':'light',im=rendererAssets.getLogo(key);if(im)ctx.drawImage(im,64,y,width,width*144/710);else mono(ctx,'> runtime garden',68,y+14,30,palette(s).ink)}
function drawMark(ctx,s,x,y,size=80){const key=s.theme==='dark'?'markDark':'mark',im=rendererAssets.getLogo(key);if(im)ctx.drawImage(im,x,y,size,size)}
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

export function frame(ctx,s,index,total,{guides=false}={}){
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
  const visible=rendererAssets.getImage(s.image);
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
 const ty=safeTop+11;const after=title(64,ty,940,Math.min(230,room*.28),73);subtitle(64,after+9,930,3);const y=Math.max(after+100,lower-430),h=Math.min(376,Math.max(180,lower-y-26));roundRect(ctx,64,y,952,h,12,t.soft,t.border);const im=rendererAssets.getImage(s.image);if(im){cropped(ctx,im,67,y+3,946,h-6,s.imageFit,s.imagePosition)}else{ctx.save();ctx.setLineDash([9,10]);roundRect(ctx,100,y+37,880,h-74,10,null,t.border);ctx.restore();mono(ctx,'ADD REAL SCREENSHOT / SYSTEM DIAGRAM',145,y+h/2-14,21,t.muted);drawMark(ctx,s,870,y+h/2-40,75)}drawLink(ctx,s,64,lower-24,t)
}
ctx.restore();commonBottom(ctx,s,virtualH,t);seriesMotif(ctx,s,index,total,virtualH,t);
if(guides){ctx.save();ctx.setLineDash([13,11]);ctx.strokeStyle='#AD7742';ctx.lineWidth=2;ctx.strokeRect(64,65,952,virtualH-190);line(ctx,t.warm,64,220,1016,220,1.5);ctx.restore()}ctx.restore();
}
