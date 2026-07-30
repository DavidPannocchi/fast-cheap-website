const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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

    // TODO: sostituire con i reali Price ID Stripe degli addon.
    const priceId = process.env.STRIPE_ADDON_PRICE_ID || '';

    if (!priceId) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Price ID add-on non configurato.' }),
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
