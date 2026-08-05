const stateBlocks = Array.from(document.querySelectorAll('.stato-blocco'));
const steps = Array.from(document.querySelectorAll('.step'));
const stepOrder = ['ricevuto', 'lavorazione', 'controllo', 'pronto', 'consegnato'];

const statusMeta = {
  pagato: { title: 'Ordine ricevuto', step: 'ricevuto' },
  brief_ricevuto: { title: 'Brief ricevuto, grazie!', step: 'ricevuto' },
  in_lavorazione: { title: 'Il tuo sito è in costruzione', step: 'lavorazione' },
  in_controllo: { title: 'Ultimo controllo in corso', step: 'controllo' },
  pronto_anteprima: { title: 'La tua anteprima è pronta', step: 'pronto' },
  revisione_richiesta: { title: 'Stiamo applicando le modifiche', step: 'controllo' },
  approvato: { title: 'Tutto approvato!', step: 'consegnato' },
  consegnato: { title: 'Il tuo sito è online 🎉', step: 'consegnato' },
  chiuso_supporto: { title: 'Il tuo sito è attivo', step: 'consegnato' },
};

const params = new URLSearchParams(window.location.search);
const orderId = params.get('order_id')?.trim();

const statusTitle = document.getElementById('status-title');
const customerName = document.getElementById('customer-name');
const deliveryDate = document.getElementById('delivery-date');
const revisionCounter = document.getElementById('revision-counter');
const previewEmbed = document.getElementById('preview-embed');
const previewIframe = document.getElementById('preview-iframe');
const previewEmbedUrl = document.getElementById('preview-embed-url');
const previewOpenTab = document.getElementById('preview-open-tab');
const previewStage = document.getElementById('preview-stage');
const previewFullscreenBtn = document.getElementById('preview-fullscreen');
const previewCloseFullscreenBtn = document.getElementById('preview-close-fullscreen');
const previewViewport = document.getElementById('preview-viewport');
const previewRevealOverlay = document.getElementById('preview-reveal-overlay');
const previewRevealBtn = document.getElementById('preview-reveal-btn');
const statusesWithPreviewEmbed = ['pronto_anteprima', 'approvato', 'consegnato'];
const revisionHistoryEl = document.getElementById('revision-history');
const revisionHistoryList = document.getElementById('revision-history-list');
const statusesWithRevisionHistory = ['pronto_anteprima', 'revisione_richiesta'];
const approveButton = document.getElementById('approve-order');
const revisionButton = document.getElementById('request-revision');
const extraRevisionButton = document.getElementById('add-revision-upgrade');
const upsellButtons = Array.from(document.querySelectorAll('[data-addon-id]'));

const briefPackage = document.getElementById('brief-package');
const briefSettoreRow = document.getElementById('brief-settore-row');
const briefSettore = document.getElementById('brief-settore');
const briefStileRow = document.getElementById('brief-stile-row');
const briefStile = document.getElementById('brief-stile');
const briefBlocchiGroup = document.getElementById('brief-blocchi-group');
const briefBlocchiList = document.getElementById('brief-blocchi-list');
const briefAddonGroup = document.getElementById('brief-addon-group');
const briefAddonList = document.getElementById('brief-addon-list');

const preUpsellCard = document.getElementById('pre-upsell-card');
const preUpsellHint = document.getElementById('pre-upsell-hint');
const preUpsellButtons = preUpsellCard ? Array.from(preUpsellCard.querySelectorAll('[data-addon-id]')) : [];
const statusesWithoutPreUpsell = ['consegnato', 'chiuso_supporto'];

function formatDateIt(rawDate) {
  if (!rawDate) return '';
  const match = String(rawDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return rawDate;
  const [, year, month, day] = match;
  return `${day}-${month}-${year}`;
}

function setActiveBlock(status) {
  stateBlocks.forEach((block) => block.classList.toggle('is-active', block.dataset.stato === status));
}

function setActiveStep(stepKey) {
  const currentIndex = stepOrder.indexOf(stepKey);
  steps.forEach((step) => {
    const stepIndex = stepOrder.indexOf(step.dataset.step);
    const isDone = currentIndex !== -1 && stepIndex !== -1 && stepIndex < currentIndex;
    const isCurrent = stepIndex === currentIndex;
    step.classList.toggle('is-done', isDone);
    step.classList.toggle('is-current', isCurrent);
  });
}

function renderOrder(data) {
  const status = data.stato || 'fallback';
  const meta = statusMeta[status] || { title: 'Abbiamo ricevuto il tuo ordine', step: 'ricevuto' };
  let remaining = 0;

  statusTitle.textContent = meta.title;
  customerName.textContent = data.cliente_nome || 'Cliente in attesa';
  deliveryDate.textContent = formatDateIt(data.data_stimata_consegna) || 'Da confermare';

  if (data.link_anteprima && statusesWithPreviewEmbed.includes(status)) {
    previewEmbed.hidden = false;
    previewIframe.src = data.link_anteprima;
    previewEmbedUrl.textContent = data.link_anteprima.replace(/^https?:\/\//, '');
    previewOpenTab.href = data.link_anteprima;

    const alreadyRevealed = orderId && sessionStorage.getItem(`preview-revealed-${orderId}`) === '1';
    if (alreadyRevealed) {
      previewViewport.classList.remove('is-pending-reveal');
      previewRevealOverlay.hidden = true;
    } else {
      previewViewport.classList.add('is-pending-reveal');
      previewRevealOverlay.hidden = false;
    }
  } else {
    previewEmbed.hidden = true;
    previewIframe.src = '';
  }

  if (status === 'pronto_anteprima') {
    const revisionsIncluded = Number(data.revisioni_incluse || 0);
    const revisionsUsed = Number(data.revisioni_usate || 0);
    remaining = Math.max(revisionsIncluded - revisionsUsed, 0);
    revisionCounter.textContent = remaining > 0
      ? `Hai ancora ${remaining} revisioni incluse`
      : 'Hai già usato tutte le revisioni incluse';
    document.getElementById('preview-actions').style.display = 'flex';
    if (extraRevisionButton) {
      extraRevisionButton.style.display = remaining > 0 ? 'none' : 'inline-flex';
      revisionButton.disabled = remaining <= 0;
      revisionButton.classList.toggle('is-disabled', remaining <= 0);
    }
  } else {
    document.getElementById('preview-actions').style.display = 'none';
  }

  if (status === 'consegnato' || status === 'chiuso_supporto') {
    const postDeliveryUpsell = document.getElementById('post-delivery-upsell');
    if (postDeliveryUpsell) {
      postDeliveryUpsell.style.display = 'block';
    }
  }

  const revisionHistory = Array.isArray(data.storico_revisioni) ? data.storico_revisioni : [];
  if (revisionHistory.length > 0 && statusesWithRevisionHistory.includes(status)) {
    revisionHistoryList.innerHTML = '';
    revisionHistory.forEach((entry) => {
      const li = document.createElement('li');
      li.textContent = entry;
      revisionHistoryList.appendChild(li);
    });
    revisionHistoryEl.hidden = false;
  } else {
    revisionHistoryEl.hidden = true;
  }

  renderBriefSummary(data);
  renderPreUpsell(data, status);

  setActiveBlock(status);
  setActiveStep(meta.step);
}

function renderBriefSummary(data) {
  if (data.pacchetto) {
    briefPackage.textContent = data.pacchetto;
    briefPackage.hidden = false;
  } else {
    briefPackage.hidden = true;
  }

  if (data.settore) {
    briefSettore.textContent = data.settore;
    briefSettoreRow.hidden = false;
  } else {
    briefSettoreRow.hidden = true;
  }

  if (data.stile) {
    briefStile.textContent = data.stile;
    briefStileRow.hidden = false;
  } else {
    briefStileRow.hidden = true;
  }

  const blocchi = Array.isArray(data.blocchi) ? data.blocchi : [];
  if (blocchi.length > 0) {
    briefBlocchiList.innerHTML = '';
    blocchi.forEach((blocco) => {
      const chip = document.createElement('span');
      chip.className = 'order-chip order-chip-block';
      chip.textContent = blocco;
      briefBlocchiList.appendChild(chip);
    });
    briefBlocchiGroup.hidden = false;
  } else {
    briefBlocchiGroup.hidden = true;
  }

  const addon = Array.isArray(data.addon) ? data.addon : [];
  if (addon.length > 0) {
    briefAddonList.innerHTML = '';
    addon.forEach((item) => {
      const chip = document.createElement('span');
      chip.className = 'order-chip order-chip-addon';
      chip.textContent = item;
      briefAddonList.appendChild(chip);
    });
    briefAddonGroup.hidden = false;
  } else {
    briefAddonGroup.hidden = true;
  }
}

function renderPreUpsell(data, status) {
  if (!preUpsellCard) return;

  if (statusesWithoutPreUpsell.includes(status)) {
    preUpsellCard.style.display = 'none';
    return;
  }

  preUpsellCard.style.display = '';
  const previewReady = Boolean(data.link_anteprima);
  preUpsellButtons.forEach((button) => {
    button.disabled = !previewReady;
  });
  preUpsellHint.style.display = previewReady ? 'none' : '';
}

function showError(message) {
  statusTitle.textContent = 'Non siamo riusciti a trovare il tuo ordine';
  customerName.textContent = '—';
  deliveryDate.textContent = '—';
  setActiveBlock('fallback');
  setActiveStep('ricevuto');
  document.querySelector('.state-card .muted-copy')?.remove();
  const note = document.createElement('p');
  note.className = 'muted-copy';
  note.textContent = message;
  document.querySelector('.state-card').appendChild(note);
}

async function loadOrder() {
  if (!orderId) {
    showError('Manca il parametro order_id nella pagina.');
    return;
  }

  try {
    const response = await fetch(`/api/get-order-status?order_id=${encodeURIComponent(orderId)}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Ordine non trovato');
    }

    const data = await response.json();
    renderOrder(data);
  } catch (error) {
    showError(error.message || 'Si è verificato un errore inatteso.');
  }
}

async function approveCurrentOrder() {
  if (!orderId) return;
  approveButton.disabled = true;
  approveButton.textContent = 'Sto confermando…';
  try {
    const response = await fetch(`/api/approve-order?order_id=${encodeURIComponent(orderId)}`, { method: 'POST' });
    if (!response.ok) {
      throw new Error('Impossibile aggiornare il tuo ordine al momento.');
    }
    window.location.reload();
  } catch (error) {
    approveButton.disabled = false;
    approveButton.textContent = 'Approva';
    alert(error.message || 'Si è verificato un errore.');
  }
}

async function requestRevision() {
  if (!orderId) return;
  const note = window.prompt('Scrivi qui il dettaglio che vuoi rivedere:');
  if (!note) return;

  revisionButton.disabled = true;
  revisionButton.textContent = 'Sto inviando…';
  try {
    const response = await fetch(`/api/request-revision?order_id=${encodeURIComponent(orderId)}&note=${encodeURIComponent(note)}`, { method: 'POST' });
    if (!response.ok) {
      throw new Error('Impossibile inviare la richiesta di revisione.');
    }
    window.location.reload();
  } catch (error) {
    revisionButton.disabled = false;
    revisionButton.textContent = 'Richiedi revisione';
    alert(error.message || 'Si è verificato un errore.');
  }
}

async function createAddonCheckout(addonId) {
  if (!orderId) return;
  try {
    const response = await fetch('/api/create-addon-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, addon_id: addonId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Impossibile avviare il checkout.');
    }

    const data = await response.json();
    if (data.url) {
      window.location.href = data.url;
    }
  } catch (error) {
    alert(error.message || 'Si è verificato un errore.');
  }
}

function enterPreviewFullscreen() {
  if (previewStage.requestFullscreen) {
    previewStage.requestFullscreen().catch(() => previewStage.classList.add('is-fullscreen-fallback'));
  } else {
    previewStage.classList.add('is-fullscreen-fallback');
  }
}

function exitPreviewFullscreen() {
  if (document.fullscreenElement === previewStage) {
    document.exitFullscreen();
  }
  previewStage.classList.remove('is-fullscreen-fallback');
}

if (previewFullscreenBtn) {
  previewFullscreenBtn.addEventListener('click', enterPreviewFullscreen);
  previewCloseFullscreenBtn.addEventListener('click', exitPreviewFullscreen);
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      previewStage.classList.remove('is-fullscreen-fallback');
    }
  });
}

function revealPreview() {
  if (!previewViewport.classList.contains('is-pending-reveal')) return;

  if (orderId) {
    sessionStorage.setItem(`preview-revealed-${orderId}`, '1');
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  previewViewport.classList.remove('is-pending-reveal');

  if (prefersReducedMotion) {
    previewRevealOverlay.hidden = true;
  } else {
    window.setTimeout(() => {
      previewRevealOverlay.hidden = true;
    }, 700);
  }
}

if (previewRevealBtn) {
  previewRevealBtn.addEventListener('click', revealPreview);
}

const supportEmailBtn = document.getElementById('support-email-btn');
if (supportEmailBtn) {
  // TODO: sostituire con l'indirizzo email reale del supporto pronto.site
  const SUPPORT_EMAIL = 'PLACEHOLDER@pronto.site';
  const subject = encodeURIComponent(`Assistenza ordine ${orderId || ''}`);
  supportEmailBtn.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}`;
}

approveButton.addEventListener('click', approveCurrentOrder);
revisionButton.addEventListener('click', requestRevision);
if (extraRevisionButton) {
  // "revisione_post" (€79) è l'addon post-consegna: prodotto Stripe diverso da
  // "revisione_extra" (€49) del configuratore iniziale — gli id non vanno confusi.
  extraRevisionButton.addEventListener('click', () => createAddonCheckout('revisione_post'));
}
upsellButtons.forEach((button) => {
  button.addEventListener('click', () => createAddonCheckout(button.dataset.addonId));
});

loadOrder();
