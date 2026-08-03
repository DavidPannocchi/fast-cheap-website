import Stripe from 'stripe';

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await context.request.json();

    let line_items = [];

    if (Array.isArray(body.items) && body.items.length) {
      // nuovo formato: [{ priceId, quantity }]
      line_items = body.items.map((item) => ({
        price: item.priceId,
        quantity: item.quantity || 1,
      }));
    } else {
      // vecchio formato: compatibilità con priceIds piatto
      const priceIds = Array.isArray(body.priceIds) && body.priceIds.length ? body.priceIds : (body.priceId ? [body.priceId] : []);
      line_items = priceIds.map((pid) => ({ price: pid, quantity: 1 }));
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      metadata: {
        settore: body.settore || '',
        blocchi: body.blocchi || '',
        stile: body.stile || '',
        tier: body.tier || '',
        addons: JSON.stringify(body.addons || []),
        revisioni_extra: String(body.revisioni_extra || 0),
      },
      success_url: `${process.env.URL}/dominio?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
