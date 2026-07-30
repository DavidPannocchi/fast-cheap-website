const stateBlocks = Array.from(document.querySelectorAll('.stato-blocco'));
const steps = Array.from(document.querySelectorAll('.step'));

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
const packageName = document.getElementById('package-name');
const deliveryDate = document.getElementById('delivery-date');
const previewLink = document.getElementById('preview-link');
const revisionCounter = document.getElementById('revision-counter');
const approveButton = document.getElementById('approve-order');
const revisionButton = document.getElementById('request-revision');
const extraRevisionButton = document.getElementById('add-revision-upgrade');
const upsellButtons = Array.from(document.querySelectorAll('[data-addon-id]'));

function setActiveBlock(status) {
  stateBlocks.forEach((block) => block.classList.toggle('is-active', block.dataset.stato === status));
}

function setActiveStep(stepKey) {
  steps.forEach((step) => step.classList.toggle('is-current', step.dataset.step === stepKey));
}

function renderOrder(data) {
  const status = data.stato || 'fallback';
  const meta = statusMeta[status] || { title: 'Abbiamo ricevuto il tuo ordine', step: 'ricevuto' };
  let remaining = 0;

  statusTitle.textContent = meta.title;
  customerName.textContent = data.cliente_nome || 'Cliente in attesa';
  packageName.textContent = data.pacchetto || 'In definizione';
  deliveryDate.textContent = data.data_stimata_consegna || 'Da confermare';

  if (data.link_anteprima) {
    previewLink.href = data.link_anteprima;
    previewLink.textContent = 'Apri l’anteprima';
  } else {
    previewLink.removeAttribute('href');
    previewLink.textContent = 'Anteprima in arrivo';
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

  setActiveBlock(status);
  setActiveStep(meta.step);
}

function showError(message) {
  statusTitle.textContent = 'Non siamo riusciti a trovare il tuo ordine';
  customerName.textContent = '—';
  packageName.textContent = '—';
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
    const response = await fetch(`/.netlify/functions/get-order-status?order_id=${encodeURIComponent(orderId)}`);
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
    const response = await fetch(`/.netlify/functions/approve-order?order_id=${encodeURIComponent(orderId)}`, { method: 'POST' });
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
    const response = await fetch(`/.netlify/functions/request-revision?order_id=${encodeURIComponent(orderId)}&note=${encodeURIComponent(note)}`, { method: 'POST' });
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
    const response = await fetch('/.netlify/functions/create-addon-checkout', {
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

approveButton.addEventListener('click', approveCurrentOrder);
revisionButton.addEventListener('click', requestRevision);
if (extraRevisionButton) {
  extraRevisionButton.addEventListener('click', () => createAddonCheckout('revisione_extra'));
}
upsellButtons.forEach((button) => {
  button.addEventListener('click', () => createAddonCheckout(button.dataset.addonId));
});

loadOrder();
