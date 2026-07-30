const { getDisplayValue, findProperty, queryPageByOrderId } = require('./_notion-helpers');

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
    const revisioniUsate = Number(getDisplayValue(findProperty(properties, ['Revisioni usate', 'Revisions used', 'Contatore revisioni usate'])) || 0);
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
