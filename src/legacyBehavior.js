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
function showToast(msg,icon='🔒',variant='default'){
  const t=document.getElementById('toast');
  const ico=document.querySelector('.toast-ico');
  document.getElementById('toast-msg').textContent=msg;
  if(ico){
    ico.textContent=icon;
    ico.style.display=icon?'inline':'none';
  }
  t.classList.remove('success');
  if(variant==='success') t.classList.add('success');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2800);
}

// ── STATE ──
const BASE_PRICE=199;
const PRO_PRICE=399;
const BASE_SECTION_LIMIT=4;
const ST={base:BASE_PRICE,plan:'base',addons:0,flatAddonTotal:0,revisionRounds:0,settore:null,stile:null,blocks:[],addonNames:[],flatAddonNames:[]};

// ── ADDON CATALOG ──
// attivo:false nasconde l'addon dal configuratore senza rimuoverlo dal catalogo.
const ADDON_CATALOG = [
  { id: 'seo_base', nome: 'SEO Base', prezzo: 49, attivo: true, extraFlag: null, sub: 'Meta tag, sitemap, Google' },
  { id: 'dominio_email', nome: 'Dominio personalizzato + email professionale', prezzo: 39, attivo: true, extraFlag: null, sub: 'Registrazione dominio, DNS e casella email' },
  { id: 'logo', nome: 'Logo Design', prezzo: 59, attivo: true, extraFlag: 'extra_logo', sub: 'Logo su misura per il tuo brand' },
  { id: 'contenuti', nome: 'Contenuti professionali (testi e immagini)', prezzo: 99, attivo: true, extraFlag: 'extra_contenuti', sub: 'Testi e immagini preparati da noi' },
  { id: 'menu_qr', nome: 'Menu digitale + QR', prezzo: 39, attivo: true, extraFlag: 'extra_qr', sub: 'Menu online con QR code da stampare' },
  { id: 'multilingua', nome: 'Sito multilingua ita/eng', prezzo: 69, attivo: true, extraFlag: 'extra_multilingua', sub: 'Versione italiana e inglese' },
  { id: 'sezione_extra', nome: 'Sezione aggiuntiva', prezzo: 39, attivo: true, extraFlag: null, sub: 'Una sezione in più sul tuo sito' },
  { id: 'consegna_24h', nome: 'Consegna in 24 ore', prezzo: 69, attivo: true, extraFlag: null, sub: 'Il tuo sito online in un giorno' },
  { id: 'revisione_extra', nome: 'Revisione extra', prezzo: 49, attivo: true, extraFlag: null, sub: 'Fino a 3 round aggiuntivi' },
  { id: 'assistenza_annuale', nome: 'Assistenza annuale', prezzo: 119, attivo: true, extraFlag: null, sub: 'Aggiornamenti e supporto per 12 mesi' },
];
// "revisione_post" (€79) non entra qui: è un addon post-vendita, gestito solo in
// ordine/ordine.js, non nel configuratore iniziale — mantienilo separato.

const REVISION_PRICE=ADDON_CATALOG.find(a=>a.id==='revisione_extra')?.prezzo ?? 49;
// Stripe price IDs
const BASE_PRICE_ID = 'price_1TywRc6AHTHA0VN10uD9aQOY'; // Pacchetto Vetrina €199
const PRO_PRICE_ID = 'price_1TxTn46AHTHA0VN127SFfNMi';  // Pacchetto Pro €399
// TODO: sostituire ogni placeholder price_TODO_* con il Price ID one-time reale su Stripe.
// TODO: 'Dominio personalizzato + email professionale' e 'Assistenza annuale' su Stripe
//       esistono oggi solo come Price ricorrenti (€39/anno e €119/anno): va creato un
//       Price one-time equivalente sullo stesso Product prima di poterli vendere.
//       Vecchio price ricorrente dominio: price_1TxT4A6AHTHA0VN1WQgf0vNy
const ADDON_PRICE_IDS = {
  'SEO Base': 'price_1TywS46AHTHA0VN16mVckko4',
  'Dominio personalizzato + email professionale': 'price_1TxT4A6AHTHA0VN1WQgf0vNy',
  'Logo Design': 'price_1TywTi6AHTHA0VN1lAhvmQun',
  'Contenuti professionali (testi e immagini)': 'price_1TywU56AHTHA0VN19qZXGuSm',
  'Menu digitale + QR': 'price_1TywUF6AHTHA0VN1YXmLYrou',
  'Sito multilingua ita/eng': 'price_1TywUV6AHTHA0VN1mCRRrqnY',
  'Sezione aggiuntiva': 'price_1TywUm6AHTHA0VN1pplQMMcQ',
  'Consegna in 24 ore': 'price_1TywV76AHTHA0VN1zxY9PvDY',
  'Revisione extra': 'price_1TywVK6AHTHA0VN1VjV8ZjjJ',
  'Assistenza annuale': 'price_1TywVX6AHTHA0VN1NJIbMAtF',
};
// Finché il price ID è un placeholder non va inviato a Stripe: romperebbe il checkout.
const isPlaceholderPriceId=(id)=>!id||id.startsWith('price_TODO');
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
  if(sub) sub.textContent=`Ordina oggi, il tuo sito sarà online entro ${giorno} ${data} ${mese}.`;
  // also update hero bleed badge if visible
  const bbv=document.querySelector('.bb-val');
  if(bbv) bbv.innerHTML=`entro ${giorno} ⚡`;
})();

// ── SECTOR ──
const SECTOR_CONFIG={
  'Ristorazione':{allowed:['Chi siamo','Listino / Menu','Galleria','Recensioni','Orari e mappa','FAQ','Contattaci'],required:['Menu','Copertina']},
  'Professionista':{allowed:['Chi siamo','I nostri servizi','Listino / Menu','Galleria','Recensioni','FAQ','Contattaci'],required:['Menu','Copertina']},
  'Negozio online':{allowed:['Chi siamo','I nostri servizi','Listino / Menu','Galleria','Recensioni','FAQ','Contattaci'],required:['Menu','Copertina']},
  'Artista / Creativo':{allowed:['Chi siamo','I nostri servizi','Galleria','Recensioni','FAQ','Contattaci'],required:['Menu','Copertina']},
  'Beauty & Benessere':{allowed:['Chi siamo','I nostri servizi','Listino / Menu','Galleria','Recensioni','Orari e mappa','FAQ','Contattaci'],required:['Menu','Copertina']},
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
      const toAdd=Math.min(2,available.length);
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
  'Listino / Menu':{inner:`<div class="bp-pricing"><div class="bppr-i"><div class="bppr-p"></div><div class="bppr-l" style="background:var(--border);"></div></div><div class="bppr-i"><div class="bppr-p"></div><div class="bppr-l"></div></div><div class="bppr-i"><div class="bppr-p"></div><div class="bppr-l" style="background:var(--border);"></div></div></div>`},
  'Galleria':{inner:`<div class="bp-portfolio"><div class="bpp-i"></div><div class="bpp-i"></div><div class="bpp-i" style="background:linear-gradient(135deg,var(--mint),rgba(194,240,224,.4));"></div></div>`},
  'Recensioni':{inner:`<div class="bp-testimonials"><div class="bpt-c"><div class="bpt-stars">★★★★★</div><div class="bpt-t"></div><div class="bpt-n"></div></div></div>`},
  'Orari e mappa':{inner:`<div class="bp-map"><div class="bpm-bg"></div><div class="bpm-grid"></div><div class="bpm-pin">📍</div></div>`},
  'FAQ':{inner:`<div class="bp-faq"><div class="bpf-row"><span class="bpf-ico">▼</span><div class="bpf-t"></div></div><div class="bpf-row"><span class="bpf-ico">+</span><div class="bpf-t"></div></div><div class="bpf-row"><span class="bpf-ico">+</span><div class="bpf-t"></div></div></div>`},
  'Contattaci':{inner:`<div class="bp-contact"><div class="bpc-form"><div class="bpc-in"></div><div class="bpc-in"></div><div class="bpc-btn"></div></div><div class="bpc-info"><div class="bpc-row"><div class="bpc-ico"></div><div class="bpc-ln"></div></div><div class="bpc-row"><div class="bpc-ico" style="background:var(--mint);"></div><div class="bpc-ln"></div></div></div></div>`},
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
  const prevCount=ST.blocks.filter(b=>b!=='Menu'&&b!=='Copertina').length;
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
  updateBlocksSummary(prevCount);
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
  let userIndex=0;
  Array.from(canvas.querySelectorAll('.cb-wrap')).forEach(wrap=>{
    if(wrap.dataset.block==='Menu'||wrap.dataset.block==='Copertina') return;
    const isPro=userIndex>=BASE_SECTION_LIMIT;
    wrap.classList.toggle('pro-block',isPro);
    const toolbar=wrap.querySelector('.cb-toolbar');
    let badge=wrap.querySelector('.cb-pro-badge');
    if(isPro&&!badge&&toolbar){
      badge=document.createElement('span');
      badge.className='cb-pro-badge';
      badge.textContent='➕ PRO';
      const remove=toolbar.querySelector('.cb-remove');
      toolbar.insertBefore(badge,remove||null);
    }
    if(!isPro&&badge)badge.remove();
    userIndex++;
  });
}

function updatePlanSummary(prevCount=ST.blocks.filter(b=>b!=='Menu'&&b!=='Copertina').length){
  const count=ST.blocks.filter(b=>b!=='Menu'&&b!=='Copertina').length;
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
  if(label)label.textContent=isPro
    ?`${count} sezioni — Pacchetto PRO attivo`
    :`${count} / ${BASE_SECTION_LIMIT} sezioni nel piano Base`;
  if(fill){
    const width=Math.min(100,(count/BASE_SECTION_LIMIT)*100);
    fill.style.left='0';
    fill.style.width=width+'%';
  }
  const excess=document.getElementById('sectionProgressExcess');
  if(excess)excess.style.display=isPro?'block':'none';
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

  updateProIncludedAddons(isPro);
  updateProBadges();
  syncAddonsSummary();

  if(prevCount<=BASE_SECTION_LIMIT&&count>BASE_SECTION_LIMIT){
    showToast('Sei passato al Pacchetto PRO! Sezioni illimitate sbloccate.','✓','success');
  }
  if(prevCount<BASE_SECTION_LIMIT&&count===BASE_SECTION_LIMIT){
    progress?.classList.add('sparkle');
    setTimeout(()=>progress?.classList.remove('sparkle'),1400);
  }
}

function updateBlocksSummary(prevCount=ST.blocks.filter(b=>b!=='Menu'&&b!=='Copertina').length){
  const userCount=ST.blocks.filter(b=>b!=='Menu'&&b!=='Copertina').length;
  const v=document.querySelector('#sl-blk .sl-v');
  v.textContent=userCount>0?userCount+' sezioni':'0';
  v.className='sl-v'+(userCount>0?' hi':'');
  document.getElementById('s2sub').textContent=userCount>0?`${userCount} sezioni nella canvas`:'Trascina le sezioni sulla canvas';
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
// escape per literal JS dentro l'attributo onclick (setAttribute non decodifica entità HTML)
const escJs=(s)=>String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");

// Genera le righe .addon-r dello step 4 da ADDON_CATALOG (solo quelle con attivo===true).
function renderAddons(){
  const box=document.getElementById('cfg-b4');
  if(!box)return;
  box.innerHTML='';
  ADDON_CATALOG.filter(a=>a.attivo).forEach(a=>{
    const row=document.createElement('div');
    row.dataset.p=a.prezzo;
    if(a.id==='revisione_extra'){
      // caso speciale: riga con stepper invece del semplice toggle
      row.className='addon-r addon-spinner';
      row.id='revisionAddon';
      row.setAttribute('onclick','selectRevisionAddon()');
      row.innerHTML=`
        <div class="addon-cb">✓</div>
        <div class="addon-inf">
          <div class="addon-nm">Revisioni extra</div>
          <div class="addon-sb">${a.sub}</div>
        </div>
        <div class="stepper" aria-label="Round di revisioni extra">
          <button type="button" class="stepper-btn" onclick="changeRevisionRounds(-1,event)" aria-label="Diminuisci revisioni extra">−</button>
          <span class="stepper-val" id="revisionRounds">0</span>
          <button type="button" class="stepper-btn" onclick="changeRevisionRounds(1,event)" aria-label="Aumenta revisioni extra">+</button>
        </div>
        <div class="addon-pr" id="revisionPrice">+€${a.prezzo}</div>`;
    } else {
      row.className='addon-r';
      if(a.id==='seo_base')row.id='seoAddon';
      row.setAttribute('onclick',`toggleAddon(this,${a.prezzo},'${escJs(a.nome)}')`);
      row.innerHTML=`<div class="addon-cb">✓</div><div class="addon-inf"><div class="addon-nm">${a.nome}</div><div class="addon-sb">${a.sub}</div></div><div class="addon-pr">+€${a.prezzo}</div>`;
    }
    box.appendChild(row);
  });
}

function syncAddonsSummary(){
  const revisionTotal=ST.plan==='pro' ? 0 : ST.revisionRounds*REVISION_PRICE;
  ST.addons=ST.flatAddonTotal+revisionTotal;
  const addonNames=[...ST.flatAddonNames];
  if(ST.plan==='pro'){
    addonNames.unshift('SEO Base incluso', '2 revisioni incluse');
  } else if(ST.revisionRounds>0){
    addonNames.push(`Revisione extra x${ST.revisionRounds}`);
  }
  const v=document.querySelector('#sl-add .sl-v');
  v.textContent=ST.addons>0?'+€'+ST.addons:'—';
  v.className='sl-v'+(ST.addons>0?' hi':'');
  document.getElementById('totalPrice').textContent='€'+(ST.base+ST.addons);
  document.getElementById('s4sub').textContent=addonNames.length?addonNames.join(', '):'Potenzia il tuo sito';
}

function setAddonState(el,on,price,name,free=false){
  if(!el) return;
  const wasOn=el.classList.contains('on');
  const wasFree=el.dataset.free==='true';
  if(on){
    if(!wasOn){
      el.classList.add('on');
      if(free){
        el.dataset.free='true';
      } else {
        ST.flatAddonTotal+=price;
        ST.flatAddonNames.push(name);
        el.dataset.free='false';
      }
    } else if(free && !wasFree){
      ST.flatAddonTotal-=price;
      ST.flatAddonNames=ST.flatAddonNames.filter(n=>n!==name);
      el.dataset.free='true';
    } else if(!free && wasFree){
      ST.flatAddonTotal+=price;
      ST.flatAddonNames.push(name);
      el.dataset.free='false';
    }
  } else {
    if(wasOn){
      el.classList.remove('on');
      if(!wasFree){
        ST.flatAddonTotal-=price;
        ST.flatAddonNames=ST.flatAddonNames.filter(n=>n!==name);
      }
      el.dataset.free='false';
    }
  }
}

function disableRevisionStepper(disabled){
  const buttons=document.querySelectorAll('#revisionAddon .stepper-btn');
  buttons.forEach(btn=>btn.disabled=disabled);
  const row=document.getElementById('revisionAddon');
  if(row) row.classList.toggle('fixed-addon',disabled);
}

function updateProIncludedAddons(isPro){
  const seoAddon=document.getElementById('seoAddon');
  const revisionRow=document.getElementById('revisionAddon');
  const revisionValue=document.getElementById('revisionRounds');
  const revisionPrice=document.getElementById('revisionPrice');
  const revisionName=revisionRow?.querySelector('.addon-nm');
  const revisionSub=revisionRow?.querySelector('.addon-sb');

  if(isPro){
    if(seoAddon){
      seoAddon.dataset.fixed='true';
      setAddonState(seoAddon,true,49,'SEO Base',true);
      seoAddon.querySelector('.addon-pr').textContent='Incluso';
    }
    if(revisionRow){
      revisionRow.dataset.fixed='true';
      revisionRow.classList.add('on');
      if(revisionName) revisionName.textContent='2 revisioni incluse';
      if(revisionSub) revisionSub.textContent='Incluso nel pacchetto PRO';
      if(revisionValue) revisionValue.textContent='2';
      if(revisionPrice) revisionPrice.textContent='Incluso';
      ST.revisionRounds=2;
      disableRevisionStepper(true);
    }
  } else {
    if(revisionRow){
      if(revisionValue) revisionValue.textContent=ST.revisionRounds;
      if(revisionPrice) revisionPrice.textContent=ST.revisionRounds>0?'+€'+((ST.revisionRounds+1)*REVISION_PRICE):'+€'+REVISION_PRICE;
    }
    if(seoAddon){
      seoAddon.dataset.fixed='false';
      seoAddon.removeAttribute('data-fixed');
      seoAddon.querySelector('.addon-pr').textContent='+€49';
      if(seoAddon.dataset.free==='true'){
        setAddonState(seoAddon,false,49,'SEO Base',true);
      }
    }
    if(revisionRow){
      revisionRow.dataset.fixed='false';
      revisionRow.removeAttribute('data-fixed');
      if(revisionName) revisionName.textContent='Revisioni extra';
      if(revisionSub) revisionSub.textContent='Fino a 3 round aggiuntivi';
      ST.revisionRounds=0;
      if(revisionValue) revisionValue.textContent=0;
      if(revisionPrice) revisionPrice.textContent='+€'+REVISION_PRICE;
      revisionRow.classList.remove('on');
      disableRevisionStepper(false);
    }
  }
}

function toggleAddon(el,price,name){
  if(el.dataset.fixed==='true') return;
  setAddonState(el,!el.classList.contains('on'),price,name,false);
  syncAddonsSummary();
}

function changeRevisionRounds(delta,event){
  event?.stopPropagation();
  if(ST.plan==='pro') return;
  const next=Math.max(0,Math.min(MAX_REVISION_ROUNDS,ST.revisionRounds+delta));
  if(next===ST.revisionRounds) return;
  ST.revisionRounds=next;
  const row=document.getElementById('revisionAddon');
  const value=document.getElementById('revisionRounds');
  const price=document.getElementById('revisionPrice');
  if(row) row.classList.toggle('on',ST.revisionRounds>0);
  if(value) value.textContent=ST.revisionRounds;
  if(price) price.textContent=ST.revisionRounds>0?'+€'+((ST.revisionRounds+1)*REVISION_PRICE):'+€'+REVISION_PRICE;
  syncAddonsSummary();
}

function selectRevisionAddon(){
  if(ST.plan==='pro') return;
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
  void vaiAlPagamento();
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
  void vaiAlPagamento();
}

const REVISION_PRICE_ID = 'price_1TywVK6AHTHA0VN1VjV8ZjjJ'; // il nuovo Price ID da Stripe

async function vaiAlPagamento() {
  try {
    const basePriceId = ST.plan === 'pro' ? PRO_PRICE_ID : BASE_PRICE_ID;
    const items = [{ priceId: basePriceId, quantity: 1 }];

    ST.flatAddonNames.forEach((name) => {
      if (ADDON_PRICE_IDS[name]) items.push({ priceId: ADDON_PRICE_IDS[name], quantity: 1 });
    });

    if (ST.revisionRounds > 0) {
      items.push({ priceId: REVISION_PRICE_ID, quantity: ST.revisionRounds });
    }

    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        settore: ST.settore,
        blocchi: ST.blocks.join(','),
        stile: ST.stile,
        tier: ST.plan,
        addons: ST.flatAddonNames,
        revisioni_extra: ST.revisionRounds,
      }),
    });
    // ... resto invariato
    const data = await res.json();
    if (!res.ok || !data?.url) {
      throw new Error(data?.error || 'Impossibile avviare il pagamento.');
    }

    window.location.href = data.url;
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Errore durante il pagamento.');
  }
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
renderAddons();
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
