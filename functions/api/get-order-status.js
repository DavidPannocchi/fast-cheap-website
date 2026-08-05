import { getDisplayValue, findProperty, queryPageByOrderId } from './_notion-helpers.js';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const orderId = url.searchParams.get('order_id') || '';

  if (!orderId) {
    return new Response(JSON.stringify({ error: 'order_id mancante' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const page = await queryPageByOrderId(orderId);

    if (!page) {
      return new Response(JSON.stringify({ error: 'Ordine non trovato.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const properties = page.properties || {};
    const stato = getDisplayValue(findProperty(properties, ['Stato', 'Status']));
    const pacchetto = getDisplayValue(findProperty(properties, ['Pacchetto', 'Package']));
    const clienteNome = getDisplayValue(findProperty(properties, ['Cliente', 'Nome cliente', 'Customer name']));
    const linkAnteprima = getDisplayValue(findProperty(properties, ['Link anteprima', 'Preview link', 'Link preview']));
    const revisioniUsate = Number(getDisplayValue(findProperty(properties, ['Revisioni usate', 'Revisions used', 'Contatore revisioni usate'])) || 0);
    const revisioniIncluse = Number(getDisplayValue(findProperty(properties, ['Revisioni incluse', 'Revisions included'])) || 0);
    const dataStimataConsegna = getDisplayValue(findProperty(properties, ['Data stimata consegna', 'Delivery date', 'Data consegna']));

    // Settore/stile/blocchi/add-on non hanno colonne Notion dedicate: arrivano
    // tutti dentro la colonna "Metadata" (testo semplice con il JSON copiato
    // pari pari da metadata di Stripe, vedi create-checkout-session.js).
    let orderMetadata = {};
    const metadataRaw = getDisplayValue(properties['Metadata']);
    if (metadataRaw) {
      try {
        orderMetadata = JSON.parse(metadataRaw);
      } catch (err) {
        console.warn(`Colonna "Metadata" non è un JSON valido per l'ordine ${orderId}: ${err.message}`);
      }
    }

    const settore = orderMetadata.settore || orderMetadata.Settore || '';
    const stile = orderMetadata.stile || orderMetadata.Stile || '';
    const blocchi = (orderMetadata.blocchi || '').split(',').map((b) => b.trim()).filter(Boolean);

    // metadata.addons può arrivare già come array (se l'automazione Notion ha
    // deserializzato il JSON di Stripe) oppure come stringa JSON annidata
    // (se è stato copiato pari pari da Stripe, che accetta solo stringhe).
    let addon = [];
    if (Array.isArray(orderMetadata.addons)) {
      addon = orderMetadata.addons;
    } else if (typeof orderMetadata.addons === 'string' && orderMetadata.addons) {
      try {
        addon = JSON.parse(orderMetadata.addons);
      } catch (err) {
        addon = [];
      }
    }

    const storicoRevisioniRaw = getDisplayValue(properties['Storico revisioni'] || properties['Note']);
    const storicoRevisioni = storicoRevisioniRaw
      ? storicoRevisioniRaw.split('\n').map((line) => line.trim()).filter(Boolean)
      : [];

    return new Response(JSON.stringify({
      stato,
      pacchetto,
      cliente_nome: clienteNome,
      link_anteprima: linkAnteprima,
      revisioni_usate: revisioniUsate,
      revisioni_incluse: revisioniIncluse,
      data_stimata_consegna: dataStimataConsegna,
      storico_revisioni: storicoRevisioni,
      settore,
      stile,
      blocchi,
      addon,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Errore interno.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
