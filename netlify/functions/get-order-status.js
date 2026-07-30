const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

const notionHeaders = {
  Authorization: `Bearer ${NOTION_API_KEY}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28',
};

function getDisplayValue(property) {
  if (!property) return '';

  switch (property.type) {
    case 'title':
      return property.title?.map((item) => item.plain_text).join('') || '';
    case 'rich_text':
      return property.rich_text?.map((item) => item.plain_text).join('') || '';
    case 'select':
      return property.select?.name || '';
    case 'number':
      return property.number ?? '';
    case 'url':
      return property.url || '';
    case 'date':
      return property.date?.start || '';
    default:
      return '';
  }
}

function findProperty(properties, aliases) {
  if (!properties) return null;

  const keys = Object.keys(properties);
  const normalizedAliases = aliases.map((alias) => alias.toLowerCase());

  const match = keys.find((key) => normalizedAliases.includes(key.toLowerCase().replace(/\s+/g, '')));
  return match ? properties[match] : null;
}

async function queryPageByOrderId(orderId) {
  if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
    throw new Error('NOTION_API_KEY e NOTION_DATABASE_ID devono essere configurate.');
  }

  const queryPayloads = [
    { filter: { property: 'Order ID', rich_text: { equals: orderId } } },
    { filter: { property: 'Order ID', rich_text: { contains: orderId } } },
    { filter: { property: 'Order ID', title: { equals: orderId } } },
    { filter: { property: 'Order ID', title: { contains: orderId } } },
  ];

  for (const payload of queryPayloads) {
    const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers: notionHeaders,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Errore durante la ricerca su Notion.');
    }

    const data = await response.json();
    if (data.results?.length) {
      return data.results[0];
    }
  }

  return null;
}

exports.handler = async (event) => {
  const orderId = event.queryStringParameters?.order_id || '';

  if (!orderId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'order_id mancante' }),
    };
  }

  try {
    const page = await queryPageByOrderId(orderId);

    if (!page) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Ordine non trovato.' }),
      };
    }

    const properties = page.properties || {};
    const stato = getDisplayValue(findProperty(properties, ['Stato', 'Status']));
    const pacchetto = getDisplayValue(findProperty(properties, ['Pacchetto', 'Package']));
    const clienteNome = getDisplayValue(findProperty(properties, ['Cliente', 'Nome cliente', 'Customer name']));
    const linkAnteprima = getDisplayValue(findProperty(properties, ['Link anteprima', 'Preview link', 'Link preview']));
    const revisioniUsate = Number(getDisplayValue(findProperty(properties, ['Revisioni usate', 'Revisions used'])) || 0);
    const revisioniIncluse = Number(getDisplayValue(findProperty(properties, ['Revisioni incluse', 'Revisions included'])) || 0);
    const dataStimataConsegna = getDisplayValue(findProperty(properties, ['Data stimata consegna', 'Delivery date', 'Data consegna']));

    return {
      statusCode: 200,
      body: JSON.stringify({
        stato,
        pacchetto,
        cliente_nome: clienteNome,
        link_anteprima: linkAnteprima,
        revisioni_usate: revisioniUsate,
        revisioni_incluse: revisioniIncluse,
        data_stimata_consegna: dataStimataConsegna,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Errore interno.' }),
    };
  }
};
