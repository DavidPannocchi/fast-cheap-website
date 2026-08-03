import Stripe from 'stripe';

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const ADDON_ID_TO_PRICE = {
  revisione_post: 'price_1Tx5xV6AHTHA0VN1gXnSwxH4',      // Revisione dopo la consegna €79
  assistenza_annuale: 'price_1TywDg6AHTHA0VN1XuMyEo6v',  // Assistenza annuale €119
  contenuti: 'price_1Tx5lZ6AHTHA0VN12lMcwuvj',            // Contenuti professionali €99
  multilingua: 'price_1Tx5XQ6AHTHA0VN13UBKdwxJ',          // Sito multilingua €69
};

export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await context.request.json().catch(() => ({}));
    const orderId = body.order_id || '';
    const addonId = body.addon_id || '';

    if (!orderId || !addonId) {
      return new Response(JSON.stringify({ error: 'order_id e addon_id sono obbligatori.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const priceId = ADDON_ID_TO_PRICE[addonId];

    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Addon non riconosciuto.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
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

    return new Response(JSON.stringify({ url: session.url }), {
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
