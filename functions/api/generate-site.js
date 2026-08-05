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
// Flusso asincrono: la generazione vera (Gemini + deploy Cloudflare, che può
// richiedere decine di secondi) gira dentro context.waitUntil DOPO che questa
// funzione ha già risposto 202 a Make. Senza questo, Make resta bloccato ad
// aspettare l'intera generazione e rischia il timeout della sua HTTP request.
// L'esito reale (successo/errore) arriva via Notion + notifica Telegram, non
// più nella risposta HTTP.

import { runGenerationAsync, updateNotionAfterGeneration } from './_generation-core.js';

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

  const orderId = order.orderId;
  if (!orderId) {
    return new Response(JSON.stringify({ error: 'order_id mancante' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await updateNotionAfterGeneration({ orderId, stato: 'in_lavorazione' });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Errore aggiornamento Notion' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  context.waitUntil(runGenerationAsync(context, orderId, order));

  return new Response(JSON.stringify({ status: 'accepted', order_id: orderId }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  });
}
