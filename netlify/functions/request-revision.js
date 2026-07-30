const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

async function findOrderPage(orderId) {
  const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      filter: {
        property: 'Order ID',
        rich_text: { equals: orderId },
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Errore nella ricerca dell’ordine.');
  }

  const data = await response.json();
  return data.results?.[0] || null;
}

exports.handler = async (event) => {
  const orderId = event.queryStringParameters?.order_id || '';
  const note = event.queryStringParameters?.note || '';

  if (!orderId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'order_id mancante' }) };
  }

  if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
    return { statusCode: 500, body: JSON.stringify({ error: 'NOTION_API_KEY e NOTION_DATABASE_ID non configurate.' }) };
  }

  try {
    const page = await findOrderPage(orderId);
    if (!page) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Ordine non trovato.' }) };
    }

    const properties = {
      Stato: {
        select: { name: 'revisione_richiesta' },
      },
    };

    if (page.properties && Object.prototype.hasOwnProperty.call(page.properties, 'Note')) {
      properties.Note = {
        rich_text: [{ text: { content: note || 'Richiesta di revisione inviata dal cliente.' } }],
      };
    }

    await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({ properties }),
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, message: 'Richiesta di revisione registrata.' }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Errore interno.' }) };
  }
};
