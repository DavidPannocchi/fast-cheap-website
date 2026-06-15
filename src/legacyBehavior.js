let initialized = false;
let cleanupFns = [];

export function initLegacyBehavior() {
  if (initialized) return;
  initialized = true;

// ── NAV SCROLL ──
const handleNavScroll = () => {
  document.getElementById('mainNav')?.classList.toggle('scrolled',window.scrollY>60);
};
window.addEventListener('scroll',handleNavScroll,{passive:true});
cleanupFns.push(() => window.removeEventListener('scroll',handleNavScroll));

// ── TOAST ──
let toastTimer=null;
function showToast(msg,icon='🔒'){
  const t=document.getElementById('toast');
  const ico=document.querySelector('.toast-ico');
  document.getElementById('toast-msg').textContent=msg;
  if(ico){
    ico.textContent=icon;
    ico.style.display=icon?'inline':'none';
  }
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2800);
}

// ── STATE ──
const BASE_PRICE=149;
const PRO_PRICE=349;
const BASE_SECTION_LIMIT=4;
const ST={base:BASE_PRICE,plan:'base',addons:0,flatAddonTotal:0,revisionRounds:0,settore:null,stile:null,blocks:[],addonNames:[],flatAddonNames:[]};
const REVISION_PRICE=59;
const MAX_REVISION_ROUNDS=3;
const FIXED_SECTION_MSG='Questa sezione ha una posizione fissa';

// ── STYLE ──
function pickStyle(el,name){
  document.querySelectorAll('.style-opt').forEach(o=>o.classList.remove('sel'));
  el.classList.add('sel');ST.stile=name;
  document.querySelector('#sl-sty .sl-v').textContent=name;
  document.querySelector('#sl-sty .sl-v').className='sl-v hi';
  document.getElementById('s3sub').textContent=name+' ✓';
  setTimeout(()=>openAcc(4),340);
}

// ── DYNAMIC DELIVERY DATE ──
function getDeliveryDate(){
  const now=new Date();
  const delivery=new Date(now.getTime()+48*60*60*1000);
  const giorni=['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
  const mesi=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const giorno=giorni[delivery.getDay()];
  const data=delivery.getDate();
  const mese=mesi[delivery.getMonth()];
  return {giorno,data,mese};
}
(function setDelivery(){
  const {giorno,data,mese}=getDeliveryDate();
  const hl=document.getElementById('deliveryHeadline');
  const sub=document.getElementById('deliverySub');
  if(hl) hl.textContent=`Pronto ${giorno}.`;
  if(sub) sub.textContent=`Ordina oggi — il tuo sito è online entro ${giorno} ${data} ${mese}.`;
  // also update hero bleed badge if visible
  const bbv=document.querySelector('.bb-val');
  if(bbv) bbv.innerHTML=`entro ${giorno} ⚡`;
})();

// ── SECTOR ──
const SECTOR_CONFIG={
  'Ristorazione':{allowed:['Menu','Copertina','Chi siamo','I nostri servizi','Contattaci','Dove siamo','Domande frequenti','I nostri prezzi','Cosa dicono di noi'],required:['Menu','Copertina']},
  'Professionista':{allowed:['Copertina','Chi siamo','I nostri servizi','Lavori realizzati','Cosa dicono di noi','Contattaci','Domande frequenti','I nostri prezzi','Clienti'],required:['Copertina','Clienti']},
  'Negozio online':{allowed:['Copertina','I nostri servizi','Lavori realizzati','Contattaci','I nostri prezzi','News e articoli','Domande frequenti','Cosa dicono di noi'],required:['Copertina']},
  'Artista / Creativo':{allowed:['Copertina','Lavori realizzati','News e articoli','Contattaci','Cosa dicono di noi','Domande frequenti'],required:['Copertina']},
  'Beauty & Benessere':{allowed:['Copertina','I nostri servizi','Cosa dicono di noi','Contattaci','Dove siamo','I nostri prezzi','Domande frequenti'],required:['Copertina']},
  'Altro…':{allowed:[]}
};

function resetPalette(){
  document.querySelectorAll('.palette .drag-chip').forEach(ch=>{ch.style.display='inline-flex';});
}

function filterPaletteForSector(name){
  resetPalette();
  const cfg=SECTOR_CONFIG[name];
  if(!cfg||name==='Altro…')return;
  const allowed=new Set(cfg.allowed||[]);
  document.querySelectorAll('.palette .drag-chip').forEach(ch=>{
    const b=ch.dataset.block;
    if(ch.dataset.locked==='true') { ch.style.display='inline-flex'; return; }
    if(!allowed.has(b)) ch.style.display='none';
    else ch.style.display='inline-flex';
  });
}

function applySectorConfig(name){
  const cfg=SECTOR_CONFIG[name];
  if(!cfg||!cfg.required)return;
  cfg.required.forEach(b=>{ if(!ST.blocks.includes(b)){
    addBlockToCanvas(b);
    const chip=document.querySelector(`.drag-chip[data-block="${b}"]`);
    if(chip)chip.classList.add('used');
  }});
}

function pickSector(el,name){
  document.querySelectorAll('.sec-chip').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  document.getElementById('altro-wrap').style.display='none';
  ST.settore=name;
  document.querySelector('#sl-set .sl-v').textContent=name;
  document.querySelector('#sl-set .sl-v').className='sl-v hi';
  document.getElementById('s1sub').textContent=name+' ✓';
  // filter available sections based on sector and auto-add required ones
  filterPaletteForSector(name);
  applySectorConfig(name);
  // auto-advance to step 2
  setTimeout(()=>openAcc(2),340);
}
function pickSectorAltro(el){
  document.querySelectorAll('.sec-chip').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  const wrap=document.getElementById('altro-wrap');
  wrap.style.display='block';
  document.getElementById('altro-input').focus();
  resetPalette();
}
function onAltroInput(inp){
  const val=inp.value.trim();
  ST.settore=val||null;
  const v=document.querySelector('#sl-set .sl-v');
  if(val){
    v.textContent=val;v.className='sl-v hi';
    document.getElementById('s1sub').textContent=val+' ✓';
  } else {
    v.textContent='—';v.className='sl-v';
    document.getElementById('s1sub').textContent='Descrivi la tua attività';
  }
}

// ── CONFIGURATION VALIDATION ──
const CONFIG_MIN_BLOCKS=2;
function canOpenStep(n){
  if(n===2 && !ST.settore){
    showToast('Seleziona prima la tua attività per proseguire.');
    return false;
  }
  if(n===3){
    const userBlocks=ST.blocks.filter(b=>b!=='Menu'&&b!=='Copertina').length;
    if(userBlocks<CONFIG_MIN_BLOCKS){
      showToast(`Aggiungi almeno ${CONFIG_MIN_BLOCKS} blocchi oltre a Menu e Copertina per continuare.`);
      return false;
    }
  }
  if(n===4 && !ST.stile){
    showToast('Scegli prima uno stile per continuare.');
    return false;
  }
  return true;
}

// ── ACCORDION (with openAcc helper) ──
function openAcc(n){
  const body=document.getElementById('cfg-b'+n);
  const hdr=body.previousElementSibling;
  body.classList.add('open');
  hdr.classList.add('open');
  requestAnimationFrame(()=>{
    body.scrollIntoView({behavior:'smooth',block:'center'});
  });
}
function toggleAcc(n,hdr){
  if(n>1 && !canOpenStep(n)) return;
  const body=document.getElementById('cfg-b'+n);
  const isOpen=body.classList.contains('open');
  if(isOpen){
    body.classList.remove('open');
    hdr.classList.remove('open');
  } else {
    body.classList.add('open');
    hdr.classList.add('open');
    requestAnimationFrame(()=>{
      body.scrollIntoView({behavior:'smooth',block:'center'});
    });
  }
}

// ── SHUFFLE CANVAS ──
function shuffleCanvas(){
  const locked=Array.from(canvas.querySelectorAll('.cb-wrap[data-block="Menu"],.cb-wrap[data-block="Copertina"]'));
  const movable=Array.from(canvas.querySelectorAll('.cb-wrap:not([data-block="Menu"]):not([data-block="Copertina"])'));
  // if there are not enough movable blocks, try to add a few random ones from the palette
  if(movable.length<2){
    const available=Array.from(document.querySelectorAll('.palette .drag-chip:not(.used):not([data-locked])'));
    if(available.length>0){
      const toAdd=Math.min(3,available.length);
      for(let i=0;i<toAdd;i++){
        const idx=Math.floor(Math.random()*available.length);
        const chip=available.splice(idx,1)[0];
        const name=chip.dataset.block;
        addBlockToCanvas(name);
        chip.classList.add('used');
      }
    }
  }
  const movableNow=Array.from(canvas.querySelectorAll('.cb-wrap:not([data-block="Menu"]):not([data-block="Copertina"])'));
  if(movableNow.length<2){showToast('Aggiungi almeno 2 sezioni per mescolare 🎲','');return;}
  // Fisher-Yates shuffle
  for(let i=movableNow.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [movableNow[i],movableNow[j]]=[movableNow[j],movableNow[i]];
  }
  movableNow.forEach(el=>{
    el.style.opacity='0';el.style.transform='scale(.95)';
    canvas.appendChild(el);
    setTimeout(()=>{el.style.transition='opacity .3s,transform .3s';el.style.opacity='1';el.style.transform='scale(1)';},50);
  });
  ST.blocks=Array.from(canvas.querySelectorAll('.cb-wrap')).map(w=>w.dataset.block);
  showToast('🔀 Sezioni mescolate!','');
}
// ── BLOCK DEFINITIONS ──
const BLOCKS={
  'Menu':{locked:true,inner:`<div class="bp-nav"><div class="bp-nav-logo"></div><div class="bp-nav-links"><div class="bp-nav-l"></div><div class="bp-nav-l"></div><div class="bp-nav-l"></div></div><div class="bp-nav-btn"></div></div>`},
  'Copertina':{locked:true,inner:`<div class="bp-hero"><div class="bph-txt"><div class="bph-h"></div><div class="bph-s"></div><div class="bph-b"></div></div><div class="bph-img"></div></div>`},
  'Chi siamo':{inner:`<div class="bp-about"><div class="bpa-img"></div><div class="bpa-txt"><div class="bpa-h"></div><div class="bpa-l"></div><div class="bpa-l2"></div></div></div>`},
  'I nostri servizi':{inner:`<div class="bp-services"><div class="bps-i"><div class="bps-ico" style="background:var(--yellow);"></div><div class="bps-t"></div></div><div class="bps-i"><div class="bps-ico" style="background:var(--lilac);"></div><div class="bps-t"></div></div><div class="bps-i"><div class="bps-ico" style="background:var(--mint);"></div><div class="bps-t"></div></div></div>`},
  'Lavori realizzati':{inner:`<div class="bp-portfolio"><div class="bpp-i"></div><div class="bpp-i"></div><div class="bpp-i" style="background:linear-gradient(135deg,var(--mint),rgba(194,240,224,.4));"></div></div>`},
  'Clienti':{inner:`<div class="bp-generic"><div class="bpg-wrap"><div class="bpg-b" style="width:90%;height:9px;background:var(--night);opacity:.08;"></div><div class="bpg-b" style="width:70%"></div></div></div>`},
  'Cosa dicono di noi':{inner:`<div class="bp-testimonials"><div class="bpt-c"><div class="bpt-stars">★★★★★</div><div class="bpt-t"></div><div class="bpt-n"></div></div></div>`},
  'News e articoli':{inner:`<div class="bp-blog"><div class="bpbl-i"><div class="bpbl-img c1"></div><div class="bpbl-t"></div></div><div class="bpbl-i"><div class="bpbl-img c2"></div><div class="bpbl-t"></div></div></div>`},
  'Contattaci':{inner:`<div class="bp-contact"><div class="bpc-form"><div class="bpc-in"></div><div class="bpc-in"></div><div class="bpc-btn"></div></div><div class="bpc-info"><div class="bpc-row"><div class="bpc-ico"></div><div class="bpc-ln"></div></div><div class="bpc-row"><div class="bpc-ico" style="background:var(--mint);"></div><div class="bpc-ln"></div></div></div></div>`},
  'Dove siamo':{inner:`<div class="bp-map"><div class="bpm-bg"></div><div class="bpm-grid"></div><div class="bpm-pin">📍</div></div>`},
  'Domande frequenti':{inner:`<div class="bp-faq"><div class="bpf-row"><span class="bpf-ico">▼</span><div class="bpf-t"></div></div><div class="bpf-row"><span class="bpf-ico">+</span><div class="bpf-t"></div></div><div class="bpf-row"><span class="bpf-ico">+</span><div class="bpf-t"></div></div></div>`},
  'I nostri prezzi':{inner:`<div class="bp-pricing"><div class="bppr-i"><div class="bppr-p"></div><div class="bppr-l" style="background:var(--border);"></div></div><div class="bppr-i"><div class="bppr-p"></div><div class="bppr-l"></div></div><div class="bppr-i"><div class="bppr-p"></div><div class="bppr-l" style="background:var(--border);"></div></div></div>`},
};

const canvas=document.getElementById('canvas');
const cvEmpty=document.getElementById('cvEmpty');

// Pre-populate canvas with Nav + Hero (locked)
function initCanvas(){
  addBlockToCanvas('Menu');
  addBlockToCanvas('Copertina');
  document.querySelectorAll('.drag-chip[data-locked="true"]').forEach(c=>c.classList.add('used'));
}

function addBlockToCanvas(name){
  const def=BLOCKS[name];if(!def)return;
  if(ST.blocks.includes(name))return;
  cvEmpty.style.display='none';
  const wrap=document.createElement('div');
  wrap.className='cb-wrap';wrap.dataset.block=name;
  const locked=def.locked||false;
  wrap.innerHTML=`
    <div class="cb-toolbar">
      <span class="cb-drag-handle ${locked?'locked':''}" title="${locked?'Posizione fissa':'Trascina per riordinare'}">${locked?'🔒':'⠿'}</span>
      <span class="cb-name">${name}</span>
      ${locked?'<span class="cb-lock" title="Sezione con posizione fissa">Fisso</span>':''}
      ${!locked?`<button class="cb-remove" onclick="removeBlock('${name}',this)" title="Rimuovi sezione">×</button>`:''}
    </div>
    ${def.inner}`;
  // drag-to-reorder on non-locked blocks
  if(!locked){
    wrap.setAttribute('draggable','true');
    wrap.addEventListener('dragstart',onCbDragStart);
    wrap.addEventListener('dragover',onCbDragOver);
    wrap.addEventListener('dragleave',onCbDragLeave);
    wrap.addEventListener('drop',onCbDrop);
    wrap.addEventListener('dragend',onCbDragEnd);
  } else {
    // locked: intercept dragover to show toast
    wrap.addEventListener('dragover',e=>{e.preventDefault();showToast(FIXED_SECTION_MSG);});
    wrap.querySelector('.cb-drag-handle')?.addEventListener('pointerdown',()=>showToast(FIXED_SECTION_MSG));
  }
  canvas.appendChild(wrap);
  ST.blocks.push(name);
  updateBlocksSummary();
}

function removeBlock(name,btn){
  const def=BLOCKS[name];
  if(def&&def.locked){showToast(FIXED_SECTION_MSG);return;}
  const wrap=btn.closest('.cb-wrap');
  if(wrap){
    wrap.style.transition='opacity .2s,transform .2s';
    wrap.style.opacity='0';wrap.style.transform='scale(.96)';
    setTimeout(()=>wrap.remove(),200);
  }
  ST.blocks=ST.blocks.filter(b=>b!==name);
  const chip=document.querySelector(`.drag-chip[data-block="${name}"]`);
  if(chip)chip.classList.remove('used');
  if(ST.blocks.length===0)cvEmpty.style.display='flex';
  updateBlocksSummary();
}

function updateProBadges(){
  Array.from(canvas.querySelectorAll('.cb-wrap')).forEach((wrap,idx)=>{
    const isPro=idx>=BASE_SECTION_LIMIT;
    wrap.classList.toggle('pro-block',isPro);
    const toolbar=wrap.querySelector('.cb-toolbar');
    let badge=wrap.querySelector('.cb-pro-badge');
    if(isPro&&!badge&&toolbar){
      badge=document.createElement('span');
      badge.className='cb-pro-badge';
      badge.textContent='PRO';
      const remove=toolbar.querySelector('.cb-remove');
      toolbar.insertBefore(badge,remove||null);
    }
    if(!isPro&&badge)badge.remove();
  });
}

function updatePlanSummary(prevCount=ST.blocks.length){
  const count=ST.blocks.length;
  const isPro=count>BASE_SECTION_LIMIT;
  ST.plan=isPro?'pro':'base';
  ST.base=isPro?PRO_PRICE:BASE_PRICE;

  const progress=document.getElementById('sectionProgress');
  const label=document.getElementById('sectionProgressLabel');
  const fill=document.getElementById('sectionProgressFill');
  const hint=document.getElementById('sectionProgressHint');
  const planPill=document.getElementById('sectionProgressPlan');
  const planLine=document.getElementById('sl-plan');
  const proNote=document.getElementById('sbProNote');

  if(progress){
    progress.classList.toggle('warn',count===BASE_SECTION_LIMIT);
    progress.classList.toggle('pro',isPro);
  }
  if(label)label.textContent=`Sezioni incluse nel piano Base: ${count} / ${BASE_SECTION_LIMIT}`;
  if(fill)fill.style.width=Math.min(100,(count/BASE_SECTION_LIMIT)*100)+'%';
  if(hint){
    hint.textContent=count===BASE_SECTION_LIMIT
      ?'La prossima sezione attiverà il piano PRO (sezioni illimitate)'
      :isPro
        ?'Piano PRO attivo: sezioni illimitate sbloccate.'
        :'Aggiungi fino a 4 sezioni nel piano Base.';
  }
  if(planPill)planPill.textContent=isPro?'PRO':'Base';
  if(planLine){
    planLine.querySelector('.sl-k').textContent=isPro?'Piano PRO':'Piano Base';
    planLine.querySelector('.sl-v').textContent='€'+ST.base;
  }
  if(proNote)proNote.classList.toggle('show',isPro);

  updateProBadges();
  syncAddonsSummary();

  if(prevCount<=BASE_SECTION_LIMIT&&count>BASE_SECTION_LIMIT){
    showToast('✨ Sei passato al Pacchetto PRO! Sezioni illimitate sbloccate.','');
  }
}

function updateBlocksSummary(prevCount=ST.blocks.length){
  const v=document.querySelector('#sl-blk .sl-v');
  v.textContent=ST.blocks.length>0?ST.blocks.length+' sezioni':'0';
  v.className='sl-v'+(ST.blocks.length>0?' hi':'');
  document.getElementById('s2sub').textContent=ST.blocks.length>0?`${ST.blocks.length} sezioni nella canvas`:'Trascina le sezioni sulla canvas';
  updatePlanSummary(prevCount);
}

// ── PALETTE CHIPS → click or drag onto canvas ──
document.querySelectorAll('.palette .drag-chip:not([data-locked])').forEach(chip=>{
  chip.addEventListener('click',()=>{
    if(chip.classList.contains('used'))return;
    addBlockToCanvas(chip.dataset.block);
    chip.classList.add('used');
  });
  chip.addEventListener('dragstart',e=>{
    e.dataTransfer.setData('block-name',chip.dataset.block);
    e.dataTransfer.effectAllowed='copy';
    setTimeout(()=>chip.style.opacity='.35',0);
  });
  chip.addEventListener('dragend',()=>{chip.style.opacity='';});
});

canvas.addEventListener('dragover',e=>{
  e.preventDefault();
  // only highlight if it's a palette chip drop (not a reorder)
  if(!draggedCb)canvas.classList.add('dov');
});
canvas.addEventListener('dragleave',()=>canvas.classList.remove('dov'));
canvas.addEventListener('drop',e=>{
  e.preventDefault();canvas.classList.remove('dov');
  const name=e.dataTransfer.getData('block-name');
  if(name&&!ST.blocks.includes(name)){
    addBlockToCanvas(name);
    const chip=document.querySelector(`.drag-chip[data-block="${name}"]`);
    if(chip)chip.classList.add('used');
  }
});

// ── CANVAS REORDER (drag between canvas blocks) ──
let draggedCb=null;
function onCbDragStart(e){
  draggedCb=this;
  e.dataTransfer.effectAllowed='move';
  setTimeout(()=>this.style.opacity='.4',0);
}
function onCbDragOver(e){
  e.preventDefault();e.stopPropagation();
  if(!draggedCb||draggedCb===this)return;
  const def=BLOCKS[this.dataset.block];
  if(def&&def.locked){
    // show where it would go if locked block is in the way
    showToast(FIXED_SECTION_MSG);
    return;
  }
  const rect=this.getBoundingClientRect();
  const mid=rect.top+rect.height/2;
  this.classList.remove('dragging-over-top','dragging-over-bot');
  this.classList.add(e.clientY<mid?'dragging-over-top':'dragging-over-bot');
}
function onCbDragLeave(){
  this.classList.remove('dragging-over-top','dragging-over-bot');
}
function onCbDrop(e){
  e.preventDefault();e.stopPropagation();
  this.classList.remove('dragging-over-top','dragging-over-bot');
  if(!draggedCb||draggedCb===this)return;
  // don't allow dropping before locked items
  const targetDef=BLOCKS[this.dataset.block];
  if(targetDef&&targetDef.locked){
    showToast(FIXED_SECTION_MSG);
    return;
  }
  const rect=this.getBoundingClientRect();
  const mid=rect.top+rect.height/2;
  if(e.clientY<mid) canvas.insertBefore(draggedCb,this);
  else canvas.insertBefore(draggedCb,this.nextSibling);
  // update ST.blocks order
  ST.blocks=Array.from(canvas.querySelectorAll('.cb-wrap')).map(w=>w.dataset.block);
  updateBlocksSummary();
}
function onCbDragEnd(){
  this.style.opacity='';
  document.querySelectorAll('.cb-wrap').forEach(w=>w.classList.remove('dragging-over-top','dragging-over-bot'));
  draggedCb=null;
}

// ── ADDONS ──
function syncAddonsSummary(){
  const revisionTotal=ST.revisionRounds*REVISION_PRICE;
  ST.addons=ST.flatAddonTotal+revisionTotal;
  ST.addonNames=[...ST.flatAddonNames];
  if(ST.revisionRounds>0){
    ST.addonNames.push(`Revisione extra x${ST.revisionRounds}`);
  }
  const v=document.querySelector('#sl-add .sl-v');
  v.textContent=ST.addons>0?'+€'+ST.addons:'—';
  v.className='sl-v'+(ST.addons>0?' hi':'');
  document.getElementById('totalPrice').textContent='€'+(ST.base+ST.addons);
  document.getElementById('s4sub').textContent=ST.addonNames.length?ST.addonNames.join(', '):'Potenzia il tuo sito';
}

function toggleAddon(el,price,name){
  el.classList.toggle('on');
  const on=el.classList.contains('on');
  if(on){
    ST.flatAddonTotal+=price;
    ST.flatAddonNames.push(name);
  } else {
    ST.flatAddonTotal-=price;
    ST.flatAddonNames=ST.flatAddonNames.filter(n=>n!==name);
  }
  syncAddonsSummary();
}

function changeRevisionRounds(delta,event){
  event?.stopPropagation();
  const next=Math.max(0,Math.min(MAX_REVISION_ROUNDS,ST.revisionRounds+delta));
  if(next===ST.revisionRounds)return;
  ST.revisionRounds=next;
  const row=document.getElementById('revisionAddon');
  const value=document.getElementById('revisionRounds');
  const price=document.getElementById('revisionPrice');
  if(row)row.classList.toggle('on',ST.revisionRounds>0);
  if(value)value.textContent=ST.revisionRounds;
  if(price)price.textContent=ST.revisionRounds>0?'+€'+(ST.revisionRounds*REVISION_PRICE):'+€0';
  syncAddonsSummary();
}

function selectRevisionAddon(){
  if(ST.revisionRounds===0){
    changeRevisionRounds(1);
  }
}

// ── CHECKOUT ──
function validateCheckout(){
  if(!ST.settore){
    showToast('Seleziona prima la tua attività nel primo step.');
    openAcc(1);
    return false;
  }
  const userBlocks=ST.blocks.filter(b=>b!=='Menu'&&b!=='Copertina').length;
  if(userBlocks<CONFIG_MIN_BLOCKS){
    showToast(`Aggiungi almeno ${CONFIG_MIN_BLOCKS} blocchi oltre a Menu e Copertina prima di procedere.`);
    openAcc(2);
    return false;
  }
  if(!ST.stile){
    showToast('Scegli prima uno stile visivo nel terzo step.');
    openAcc(3);
    return false;
  }
  return true;
}
function goCheckout(){
  if(!validateCheckout()) return;
  if(ST.addons===0){
    openModal();
    return;
  }
  checkoutFinalize();
}
function openModal(){
  const modal=document.getElementById('confirmModal');
  if(modal) modal.classList.remove('hidden');
}
function closeModal(){
  const modal=document.getElementById('confirmModal');
  if(modal) modal.classList.add('hidden');
}
function closeModalAndOpenAddons(){
  closeModal();
  openAcc(4);
}
function confirmCheckout(){
  closeModal();
  checkoutFinalize();
}
function checkoutFinalize(){
  const total=ST.base+ST.addons;
  alert(`✅ Totale: €${total}\n\nSettore: ${ST.settore||'—'}\nSezioni: ${ST.blocks.join(' → ')}\nStile: ${ST.stile||'—'}\nAdd-on: ${ST.addonNames.join(', ')||'—'}\n\n[Stripe checkout — in arrivo]`);
}

// ── FAQ ──
function toggleFaq(el){
  const was=el.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(i=>i.classList.remove('open'));
  if(!was)el.classList.add('open');
}

// ── SCROLL REVEAL ──
const ro=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('vis');ro.unobserve(e.target);}});
},{threshold:.1});
document.querySelectorAll('.reveal').forEach(el=>ro.observe(el));
cleanupFns.push(() => ro.disconnect());

// ── AI TERMINAL LOOP ──
function loopTerm(){
  const w=document.getElementById('nameWrong'),f=document.getElementById('nameFixed');
  if(!w||!f)return;
  w.style.animation='none';f.style.animation='none';
  void w.offsetWidth;
  setTimeout(()=>{w.style.animation='fadeRight .4s .5s forwards';f.style.animation='fadeRight .4s 2.6s forwards';},10);
}
const aio=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting){loopTerm();const termTimer=setInterval(loopTerm,6500);cleanupFns.push(() => clearInterval(termTimer));aio.unobserve(e.target);}});
},{threshold:.3});
const aiEl=document.getElementById('ai-check');if(aiEl)aio.observe(aiEl);
cleanupFns.push(() => aio.disconnect());

// ── INIT ──
initCanvas();

  window.pickStyle = pickStyle;
  window.pickSector = pickSector;
  window.pickSectorAltro = pickSectorAltro;
  window.onAltroInput = onAltroInput;
  window.toggleAcc = toggleAcc;
  window.shuffleCanvas = shuffleCanvas;
  window.removeBlock = removeBlock;
  window.toggleAddon = toggleAddon;
  window.changeRevisionRounds = changeRevisionRounds;
  window.selectRevisionAddon = selectRevisionAddon;
  window.goCheckout = goCheckout;
  window.closeModal = closeModal;
  window.closeModalAndOpenAddons = closeModalAndOpenAddons;
  window.confirmCheckout = confirmCheckout;
  window.toggleFaq = toggleFaq;
}

export function cleanupLegacyBehavior() {
  cleanupFns.forEach((fn) => fn());
  cleanupFns = [];
  initialized = false;
}
