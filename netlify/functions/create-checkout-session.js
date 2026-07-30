const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);

    const priceIds = Array.isArray(body.priceIds) && body.priceIds.length ? body.priceIds : (body.priceId ? [body.priceId] : []);

    const line_items = priceIds.map((pid) => ({ price: pid, quantity: 1 }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      metadata: {
        settore: body.settore || '',
        blocchi: body.blocchi || '',
        stile: body.stile || '',
        tier: body.tier || '',
        addons: JSON.stringify(body.addons || []),
      },
      success_url: `${process.env.URL}/dominio?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};