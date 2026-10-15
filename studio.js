/* Runtime Garden Social Studio · local-first canvas editor
   The official Design Kit v2 palette and vector logos are deliberately immutable. */
'use strict';
const $ = id => document.getElementById(id);
/* Canvas renderer (palette, drawing helpers, frame) extracted to
   packages/studio-core/src/render.ts (P1, output-neutral) and consumed below
   via the RGStudioCore global; images/logos are injected through
   RGStudioCore.configureRenderer(). */
/* Pure registry extracted to packages/studio-core (P1, output-neutral).
   Loaded as a classic script before this file (see index.html); the standalone
   build inlines packages/studio-core/dist/studio-core.js the same way.
   Project import delegates to RGStudioCore.restoreProject (explicit schema
   markers + v1→v2 migrations, P1). */
const { FORMATS, getFormat, SAMPLES, SERIES_PACKS, DEFAULTS, SERIES_CONTENT, clamp, uid, NEW_SLIDE, palette, frame } = RGStudioCore;
let app={name:'Untitled collection',seriesPack:'none',slides:[NEW_SLIDE('cover')],selected:0};
let history=[],future=[],historyStart=null,saveTimer=null,zoom=1,showGuides=false,leftTab='templates',inspectorTab='content',filter='all',assetCache=new Map(),renderTicket=0,logoImages={};
let imageImportOriginal=null;
function slide(){return app.slides[app.selected]}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function safeName(s){return String(s||'runtime-garden-post').toLowerCase().replace(/[^a-z0-9-_]+/g,'-').replace(/-+/g,'-').slice(0,66)||'post'}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3200)}
function snapshot(){return JSON.stringify(app)}
function remember(){history.push(snapshot());if(history.length>70)history.shift();future=[];updateHistory()}
function updateHistory(){$('undoBtn').disabled=!history.length;$('redoBtn').disabled=!future.length}
function restoreFrom(text){return RGStudioCore.restoreProject(text)}
function undo(){if(!history.length)return;future.push(snapshot());app=restoreFrom(history.pop());refresh();saveSoon();updateHistory()}
function redo(){if(!future.length)return;history.push(snapshot());app=restoreFrom(future.pop());refresh();saveSoon();updateHistory()}
function saveSoon(){clearTimeout(saveTimer);$('saveStatus').textContent='Saving…';saveTimer=setTimeout(()=>{try{localStorage.setItem('rg-social-studio-v1',snapshot());$('saveStatus').textContent='Saved locally'}catch(e){$('saveStatus').textContent='Not saved';toast('Browser storage is full. Download the project JSON to keep your work.')}},650)}
function setSlideProp(k,v){slide()[k]=v;render();updateCanvasMeta();saveSoon()}
function mutate(fn){remember();fn();refresh();saveSoon()}
function initLogos(){return Promise.all(Object.entries(RG_OFFICIAL_LOGOS).map(([key,src])=>new Promise(resolve=>{const im=new Image();im.onload=()=>{logoImages[key]=im;resolve()};im.onerror=resolve;im.src=src})))}
function getCachedImage(src){if(!src)return null;if(!assetCache.has(src)){const im=new Image();const ob={image:im,ok:false};assetCache.set(src,ob);im.onload=()=>{ob.ok=true;render()};im.onerror=()=>{ob.failed=true};im.src=src}const cached=assetCache.get(src);return cached.ok?cached.image:null}
function waitImage(src){return new Promise(resolve=>{if(!src)return resolve();const im=getCachedImage(src);if(im)return resolve();const obj=assetCache.get(src);if(!obj||obj.failed)return resolve();obj.image.addEventListener('load',resolve,{once:true});obj.image.addEventListener('error',resolve,{once:true})})}
RGStudioCore.configureRenderer({getLogo:key => logoImages[key] ?? null, getImage:src => getCachedImage(src)});
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
