const { queryPageByOrderId } = require('./_notion-helpers');
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

exports.handler = async (event) => {
  const orderId = event.queryStringParameters?.order_id || '';

  if (!orderId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'order_id mancante' }) };
  }

  if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
    return { statusCode: 500, body: JSON.stringify({ error: 'NOTION_API_KEY e NOTION_DATABASE_ID non configurate.' }) };
  }

  try {
    const page = await queryPageByOrderId(orderId);
    if (!page) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Ordine non trovato.' }) };
    }

    const patchResponse = await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        properties: {
          Stato: {
            select: { name: 'approvato' },
          },
        },
      }),
    });

    if (!patchResponse.ok) {
      const errorData = await patchResponse.json().catch(() => ({}));
      throw new Error(errorData.message || 'Errore durante l\'aggiornamento su Notion.');
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, message: 'Ordine approvato.' }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Errore interno.' }) };
  }
};
