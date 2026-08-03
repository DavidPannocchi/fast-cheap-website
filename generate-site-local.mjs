// generate-site-local.mjs
// Versione ESM (richiesta da _generation-core.js dopo la migrazione a Cloudflare).
// Stessa identica logica della versione precedente — solo import/export invece
// di require/module.exports, e percorso aggiornato a functions/api/.
//
// USO:
//   node generate-site-local.mjs esempio-ordine.json            (locale, nessun credito)
//   node generate-site-local.mjs esempio-ordine.json --deploy   (deploy Netlify vero, consuma crediti)

import 'dotenv/config'; // richiede: npm install dotenv
import fs from 'node:fs';
import path from 'node:path';
import { runGeneration, deployToNetlify, writeFilesLocally } from './functions/api/_generation-core.js';

async function main() {
  const orderFilePath = process.argv[2];
  const useNetlifyDeploy = process.argv.includes('--deploy');

  if (!orderFilePath) {
    console.error('Uso: node generate-site-local.mjs percorso/ordine.json [--deploy]');
    console.error('Senza --deploy, i file vengono scritti in ./output/<orderId>/ (nessun credito consumato).');
    console.error('Con --deploy, viene creato un sito Netlify vero (consuma crediti, se ne hai ancora).');
    process.exitCode = 1;
    return;
  }

  const resolvedPath = path.resolve(orderFilePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File non trovato: ${resolvedPath}`);
    process.exitCode = 1;
    return;
  }

  const order = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));

  console.log(`Generazione avviata per l'ordine ${order.orderId}...`);
  console.log(useNetlifyDeploy
    ? '(deploy su Netlify attivo — consuma crediti)'
    : '(modalità locale — nessun credito consumato, i file finiscono in ./output/)');

  try {
    const result = await runGeneration(order, {
      deliver: useNetlifyDeploy ? deployToNetlify : writeFilesLocally,
      isLocalPreview: !useNetlifyDeploy,
    });
    console.log('\n✅ Generazione completata.');
    console.log(useNetlifyDeploy ? 'Anteprima online:' : 'File salvati in:', result.preview_url);
    if (!useNetlifyDeploy) {
      console.log(`Apri ${path.join(result.preview_url, 'index.html')} nel browser per vederlo.`);
    }
    console.log('Sezioni ok:', !result.section_mismatch);
    if (result.flagged_requests?.length) {
      console.log('Richieste fuori scope rilevate:', result.flagged_requests.join('; '));
    }
  } catch (error) {
    console.error('\n❌ Generazione fallita:', error.message);
    console.error('Notion è già stato aggiornato con stato "errore_generazione" e la nota interna.');
    process.exitCode = 1;
  }
}

main();
