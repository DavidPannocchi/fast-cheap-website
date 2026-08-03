// functions/api/generate-site.js
// Pages Function equivalente al vecchio netlify/functions/generate-site.js.
// Disponibile su: https://<progetto>.pages.dev/api/generate-site
//
// Differenze principali rispetto a Netlify Functions:
// - onRequestPost/onRequestGet invece di un unico handler che controlla
//   event.httpMethod — Cloudflare instrada automaticamente in base al metodo
// - context.request è un oggetto Request standard (Web API), non un evento
//   Lambda-style — quindi si legge con .json() invece di JSON.parse(event.body)
// - si ritorna un vero oggetto Response, non {statusCode, body}
//
// IMPORTANTE: passiamo esplicitamente deliver: deployToNetlify qui, perché il
// default di runGeneration (scrittura su disco) NON funziona in questo runtime
// (nessun filesystem in Cloudflare Workers) — funzionava solo per lo script
// locale. La Fase 2 sostituirà questo deployToNetlify con l'equivalente Cloudflare.

import { runGeneration, deployToNetlify } from './_generation-core.js';

export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo non consentito, usa POST' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log('generate-site: invocazione ricevuta (POST)');

  let order;
  try {
    order = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body non valido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await runGeneration(order, {
      deliver: deployToNetlify,
      isLocalPreview: false,
    });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Errore interno durante la generazione' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
