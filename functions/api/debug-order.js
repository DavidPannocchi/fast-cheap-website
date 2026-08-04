// Endpoint di servizio temporaneo per ispezionare i dati grezzi di un ordine
// così come arrivano da Notion, senza nessuna estrazione/formattazione.
// Non collegato dalla UI: nessun link da ordine.js o altrove — raggiungibile
// solo conoscendo l'URL esatto.
import { queryPageByOrderId } from './_notion-helpers.js';

export async function onRequestGet(context) {
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

    return new Response(JSON.stringify(page.properties, null, 2), {
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
