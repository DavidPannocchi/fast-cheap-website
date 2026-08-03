// generate-site-local.mjs
// Versione ESM (richiesta da _generation-core.js dopo la migrazione a Cloudflare).
// Stessa identica logica della versione precedente — solo import/export invece
// di require/module.exports, e percorso aggiornato a functions/api/.
//
// USO:
//   node generate-site-local.mjs esempio-ordine.json            (locale, nessun credito)
//   node generate-site-local.mjs esempio-ordine.json --deploy   (deploy Netlify vero, consuma crediti)

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { runGeneration, deployToNetlify, deployToCloudflareWorkers, writeFilesLocally } from './functions/api/_generation-core.js';

async function main() {
  const orderFilePath = process.argv[2];
  const useNetlifyDeploy = process.argv.includes('--deploy');
  const useCloudflareDeploy = process.argv.includes('--deploy-cloudflare');

  if (!orderFilePath) {
    console.error('Uso: node generate-site-local.mjs percorso/ordine.json [--deploy | --deploy-cloudflare]');
    console.error('Senza flag: scrive in ./output/<orderId>/, nessun credito consumato.');
    console.error('--deploy: crea un sito Netlify vero.');
    console.error('--deploy-cloudflare: crea un Worker Cloudflare vero (Fase 2, appena implementata — testala qui prima di fidartene su Make).');
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

  let deliver = writeFilesLocally;
  let isLocalPreview = true;
  let modeLabel = '(modalità locale — nessun credito consumato, i file finiscono in ./output/)';

  if (useNetlifyDeploy) {
    deliver = deployToNetlify;
    isLocalPreview = false;
    modeLabel = '(deploy su Netlify attivo — consuma crediti)';
  } else if (useCloudflareDeploy) {
    deliver = deployToCloudflareWorkers;
    isLocalPreview = false;
    modeLabel = '(deploy su Cloudflare Workers attivo — Fase 2, prima volta che la testi)';
  }

  console.log(`Generazione avviata per l'ordine ${order.orderId}...`);
  console.log(modeLabel);

  try {
    const result = await runGeneration(order, { deliver, isLocalPreview });
    console.log('\n✅ Generazione completata.');
    console.log(isLocalPreview ? 'File salvati in:' : 'Anteprima online:', result.preview_url);
    if (isLocalPreview) {
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
