const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const TALLY_FORM_URL = process.env.TALLY_FORM_URL || '';

const safeEncode = (value) => encodeURIComponent(value || '');

const buildTallyUrl = (metadata) => {
  const blocks = (metadata.blocchi || '')
    .split(',')
    .map((block) => block.trim())
    .filter(Boolean);

  const allBlocks = [
    'chisiamo',
    'menu',
    'servizi',
    'prodotti',
    'galleria',
    'contatti',
  ];

  const queryParts = [
    `order_id=${safeEncode(metadata.orderId || '')}`,
    `settore=${safeEncode(metadata.settore || '')}`,
    `stile=${safeEncode(metadata.stile || '')}`,
  ];

  allBlocks.forEach((block) => {
    const value = blocks.includes(block) ? 'si' : 'no';
    queryParts.push(`blocco_${block}=${safeEncode(value)}`);
  });

  if (metadata.addons) {
    queryParts.push(`addons=${safeEncode(metadata.addons)}`);
  }

  return `${TALLY_FORM_URL}?${queryParts.join('&')}`;
};

exports.handler = async (event) => {
  const sessionId = event.queryStringParameters.session_id;

  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'session_id mancante' }) };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const addons = [];
    try {
      addons.push(...JSON.parse(session.metadata.addons || '[]'));
    } catch (err) {
      // ignore malformed metadata
    }

    const tallyUrl = buildTallyUrl({
      ...session.metadata,
      orderId: session.id,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        email: session.customer_details?.email || '',
        orderId: session.id,
        settore: session.metadata.settore,
        blocchi: session.metadata.blocchi,
        stile: session.metadata.stile,
        tier: session.metadata.tier || '',
        addons,
        amount: session.amount_total / 100,
        tallyUrl,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};