// generate-site.js
// Wrapper HTTP per Netlify Functions attorno a _generation-core.js.
// Trigger pensato: chiamata webhook da Make dopo che il brief Tally è arrivato.
//
// ATTENZIONE — piano Netlify Free: le function sincrone hanno un limite di 10
// secondi di esecuzione. Questa pipeline (Gemini + deploy Netlify + update
// Notion in sequenza) rischia di superarlo facilmente, causando un "Internal
// Error" senza log utili. Finché sei su un piano con questo limite, usa lo
// script locale (generate-site-local.js) per la generazione vera e propria —
// questa function resta pronta per quando passerai a un piano che regge
// tempi più lunghi (o a un pattern a function separate/background).
//
// Variabili d'ambiente richieste: GEMINI_API_KEY, NETLIFY_API_TOKEN, NOTION_API_KEY

const { runGeneration } = require('./_generation-core');

exports.handler = async (event) => {
  console.log('generate-site: invocazione ricevuta, metodo', event.httpMethod);

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Metodo non consentito' }) };
  }

  let order;
  try {
    order = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body non valido' }) };
  }

  try {
    const result = await runGeneration(order);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Errore interno durante la generazione' }),
    };
  }
};
