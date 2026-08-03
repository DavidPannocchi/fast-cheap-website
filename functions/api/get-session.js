import Stripe from 'stripe';

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const TALLY_FORM_URL = process.env.TALLY_FORM_URL || '';

const safeEncode = (value) => encodeURIComponent(value || '');

// Le 8 sezioni selezionabili nel configuratore. `nome` è l'etichetta usata in
// src/legacyBehavior.js (BLOCKS) e salvata in metadata.blocchi da Stripe.
// "Menu" (navbar) e "Copertina" restano blocchi fissi e non entrano qui.
const allBlocks = [
  { slug: 'chisiamo', nome: 'Chi siamo' },
  { slug: 'servizi', nome: 'I nostri servizi' },
  { slug: 'listino', nome: 'Listino / Menu' },
  { slug: 'galleria', nome: 'Galleria' },
  { slug: 'recensioni', nome: 'Recensioni' },
  { slug: 'orari', nome: 'Orari e mappa' },
  { slug: 'faq', nome: 'FAQ' },
  { slug: 'contattaci', nome: 'Contattaci' },
];

// Replica di ADDON_CATALOG in src/legacyBehavior.js — tenere allineati id/nome/extraFlag.
// Qui serve solo la parte che genera i flag Tally, quindi niente prezzo/attivo.
const ADDON_CATALOG = [
  { id: 'seo_base', nome: 'SEO Base', extraFlag: null },
  { id: 'dominio_email', nome: 'Dominio personalizzato + email professionale', extraFlag: null },
  { id: 'logo', nome: 'Logo Design', extraFlag: 'extra_logo' },
  { id: 'contenuti', nome: 'Contenuti professionali (testi e immagini)', extraFlag: 'extra_contenuti' },
  { id: 'menu_qr', nome: 'Menu digitale + QR', extraFlag: 'extra_qr' },
  { id: 'multilingua', nome: 'Sito multilingua ita/eng', extraFlag: 'extra_multilingua' },
  { id: 'sezione_extra', nome: 'Sezione aggiuntiva', extraFlag: null },
  { id: 'consegna_24h', nome: 'Consegna in 24 ore', extraFlag: null },
  { id: 'revisione_extra', nome: 'Revisione extra', extraFlag: null },
  { id: 'assistenza_annuale', nome: 'Assistenza annuale', extraFlag: null },
];

const buildTallyUrl = (metadata, addons = []) => {
  const blocks = (metadata.blocchi || '')
    .split(',')
    .map((block) => block.trim().toLowerCase())
    .filter(Boolean);

  const selectedAddons = addons.map((addon) => String(addon).trim().toLowerCase());

  const queryParts = [
    `order_id=${safeEncode(metadata.orderId || '')}`,
    `settore=${safeEncode(metadata.settore || '')}`,
    `stile=${safeEncode(metadata.stile || '')}`,
  ];

  if (metadata.email) {
    queryParts.push(`email=${safeEncode(metadata.email)}`);
  }

  allBlocks.forEach(({ slug, nome }) => {
    const value = blocks.includes(nome.toLowerCase()) ? 'si' : 'no';
    queryParts.push(`blocco_${slug}=${safeEncode(value)}`);
  });

  ADDON_CATALOG.forEach(({ nome, extraFlag }) => {
    if (!extraFlag) return;
    const value = selectedAddons.includes(nome.toLowerCase()) ? 'si' : 'no';
    queryParts.push(`${extraFlag}=${safeEncode(value)}`);
  });

  if (metadata.addons) {
    queryParts.push(`addons=${safeEncode(metadata.addons)}`);
  }

  return `${TALLY_FORM_URL}?${queryParts.join('&')}`;
};

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'session_id mancante' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const addons = [];
    try {
      addons.push(...JSON.parse(session.metadata.addons || '[]'));
    } catch (err) {
      // ignore malformed metadata
    }

    const tallyUrl = buildTallyUrl(
      {
        ...session.metadata,
        orderId: session.id,
        email: session.customer_details?.email || '',
      },
      addons,
    );


    return new Response(JSON.stringify({
      email: session.customer_details?.email || '',
      orderId: session.id,
      settore: session.metadata.settore,
      blocchi: session.metadata.blocchi,
      stile: session.metadata.stile,
      tier: session.metadata.tier || '',
      addons,
      amount: session.amount_total / 100,
      tallyUrl,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
