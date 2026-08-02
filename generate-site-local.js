// generate-site-local.js
// Esegue la generazione di un sito DAL TUO COMPUTER, non da una Netlify Function.
// Nessun limite di 10 secondi, nessun consumo di crediti Netlify per il compute.
//
// USO:
//   1. Crea un file JSON con i dati dell'ordine (vedi esempio-ordine.json come modello)
//   2. Esporta le variabili d'ambiente necessarie nel terminale, oppure crea un
//      file .env nella stessa cartella (richiede il pacchetto "dotenv": npm i dotenv)
//   3. Lancia: node generate-site-local.js esempio-ordine.json
//
// Variabili d'ambiente richieste: GEMINI_API_KEY, NETLIFY_API_TOKEN, NOTION_API_KEY,
// NOTION_DATABASE_ID (le stesse già impostate su Netlify — copiale in locale)

try {
  require('dotenv').config();
} catch {
  // dotenv non installato: va bene comunque, assumiamo che le env vars siano
  // già esportate nel terminale (export GEMINI_API_KEY=... prima di lanciare lo script)
}

const fs = require('fs');
const path = require('path');
const { runGeneration } = require('./netlify/functions/_generation-core');

async function main() {
  const orderFilePath = process.argv[2];
  if (!orderFilePath) {
    console.error('Uso: node generate-site-local.js percorso/ordine.json');
    process.exit(1);
  }

  const resolvedPath = path.resolve(orderFilePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File non trovato: ${resolvedPath}`);
    process.exit(1);
  }

  const order = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));

  console.log(`Generazione avviata per l'ordine ${order.orderId}...`);
  console.log('(nessun limite di tempo qui — Gemini + deploy possono richiedere anche 30-60 secondi, è normale)');

  try {
    const result = await runGeneration(order);
    console.log('\n✅ Generazione completata.');
    console.log('Anteprima interna:', result.preview_url);
    console.log('Sezioni ok:', !result.section_mismatch);
    if (result.flagged_requests?.length) {
      console.log('Richieste fuori scope rilevate:', result.flagged_requests.join('; '));
    }
  } catch (error) {
    console.error('\n❌ Generazione fallita:', error.message);
    console.error('Notion è già stato aggiornato con stato "errore_generazione" e la nota interna.');
    process.exit(1);
  }
}

main();
