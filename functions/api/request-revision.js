import { queryPageByOrderId, getDisplayValue, findProperty } from './_notion-helpers.js';

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const orderId = url.searchParams.get('order_id') || '';
  const note = url.searchParams.get('note') || '';

  if (!orderId) {
    return new Response(JSON.stringify({ error: 'order_id mancante' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
    return new Response(JSON.stringify({ error: 'NOTION_API_KEY e NOTION_DATABASE_ID non configurate.' }), {
      status: 500,
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

    const properties = {
      Stato: {
        select: { name: 'revisione_richiesta' },
      },
    };

    const revisionCounterProperty = findProperty(page.properties || {}, ['Revisioni usate', 'Revisions used', 'Contatore revisioni usate']);
    if (revisionCounterProperty) {
      const currentValue = Number(getDisplayValue(revisionCounterProperty) || 0);
      properties.RevisioniUsate = {
        number: currentValue + 1,
      };
    } else {
      console.warn(`Property revision counter not found for order ${orderId}`);
    }

    if (page.properties && Object.prototype.hasOwnProperty.call(page.properties, 'Note')) {
      properties.Note = {
        rich_text: [{ text: { content: note || 'Richiesta di revisione inviata dal cliente.' } }],
      };
    }

    const patchResponse = await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({ properties }),
    });

    if (!patchResponse.ok) {
      const errorData = await patchResponse.json().catch(() => ({}));
      throw new Error(errorData.message || 'Errore durante l\'aggiornamento su Notion.');
    }

    return new Response(JSON.stringify({ ok: true, message: 'Richiesta di revisione registrata.' }), {
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
