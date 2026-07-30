const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const ADDON_ID_TO_PRICE = {
  revisione_post: 'price_1Tx5xV6AHTHA0VN1gXnSwxH4',      // Revisione dopo la consegna €79
  assistenza_annuale: 'price_1TywDg6AHTHA0VN1XuMyEo6v',  // Assistenza annuale €119
  contenuti: 'price_1Tx5lZ6AHTHA0VN12lMcwuvj',            // Contenuti professionali €99
  multilingua: 'price_1Tx5XQ6AHTHA0VN13UBKdwxJ',          // Sito multilingua €69
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const orderId = body.order_id || '';
    const addonId = body.addon_id || '';

    if (!orderId || !addonId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'order_id e addon_id sono obbligatori.' }),
      };
    }

    const priceId = ADDON_ID_TO_PRICE[addonId];

    if (!priceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Addon non riconosciuto.' }),
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        order_id: orderId,
        addon_id: addonId,
      },
      success_url: `${process.env.URL || 'http://localhost:8888'}/ordine?order_id=${encodeURIComponent(orderId)}`,
      cancel_url: `${process.env.URL || 'http://localhost:8888'}/ordine?order_id=${encodeURIComponent(orderId)}`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Errore interno.' }),
    };
  }
};
