// _generation-core.js
// Logica di generazione condivisa, ora su Cloudflare Pages Functions.
//
// Differenze rispetto alla versione Netlify:
// - Sintassi import/export (richiesta dal runtime Workers)
// - node:crypto importato esplicitamente in cima al file (con prefisso "node:",
//   richiesto dal flag nodejs_compat)
// - process.env funziona qui SOLO perché wrangler.jsonc ha il flag "nodejs_compat"
//   con compatibility_date recente — senza, le variabili d'ambiente non
//   sarebbero visibili così
// - deployToNetlify resta per compatibilità (se vuoi ancora usarlo con crediti
//   residui), ma NON è più il default — la Fase 2 aggiungerà un deploy verso
//   Cloudflare basato sulla API ufficiale Workers Direct Upload, non quella
//   (non documentata) di Pages

import { createHash } from 'node:crypto';
import { buildSystemPrompt, buildUserMessage, normalizeBlocchi } from './_prompt-builder.js';
import { queryPageByOrderId } from './_notion-helpers.js';

const MODEL = 'gemini-3.6-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export async function runGeneration(order, { deliver = writeFilesLocally, isLocalPreview = true } = {}) {
  const { orderId } = order;
  if (!orderId) throw new Error('order_id mancante');

  try {
    const system = buildSystemPrompt();
    const { prompt, presetFinale, variante } = buildUserMessage(order);

    // Il modello, generando un JSON molto grande (un sito intero come stringhe
    // annidate), occasionalmente sbaglia l'escaping di un carattere e produce
    // JSON non valido. È un errore statistico, non sistematico — ritentare
    // l'intera chiamata (non solo il parsing) di solito risolve, perché il
    // modello non sbaglia sempre nello stesso punto.
    const MAX_PARSE_RETRIES = 2;
    let parsed;
    let lastParseError;
    for (let attempt = 0; attempt <= MAX_PARSE_RETRIES; attempt++) {
      const rawText = await callGeminiWithRetry(system, prompt);
      try {
        parsed = parseModelOutput(rawText);
        lastParseError = null;
        break;
      } catch (err) {
        lastParseError = err;
        console.log(`Tentativo ${attempt + 1}/${MAX_PARSE_RETRIES + 1}: JSON non valido, ${attempt < MAX_PARSE_RETRIES ? 'riprovo' : 'esaurito il numero di tentativi'}.`);
      }
    }
    if (lastParseError) throw lastParseError;

    const indexFile = parsed.files.find((f) => f.path === 'index.html');
    const sectionCount = indexFile ? (indexFile.content.match(/<section/g) || []).length : 0;
    const expectedSections = normalizeBlocchi(order.blocchi).filter(
      (b) => b !== 'Copertina' && b !== 'Menu'
    ).length;
    const sectionMismatch = sectionCount !== expectedSections;

    const previewLocation = await deliver(orderId, parsed.files);

    const notes = buildInternalNotes(parsed.flagged_requests, sectionMismatch, sectionCount, expectedSections);

    await updateNotionAfterGeneration({
      orderId,
      stato: sectionMismatch ? 'in_controllo_urgente' : 'in_controllo',
      linkAnteprimaInterna: isLocalPreview ? null : previewLocation,
      presetUsato: parsed.preset_usato || presetFinale,
      varianteUsata: parsed.variante_usata || variante,
      noteInterne: isLocalPreview
        ? [`Anteprima generata in locale: ${previewLocation}`, notes].filter(Boolean).join('\n')
        : notes,
    });

    return {
      ok: true,
      preview_url: previewLocation,
      section_mismatch: sectionMismatch,
      flagged_requests: parsed.flagged_requests || [],
    };
  } catch (error) {
    await updateNotionAfterGeneration({
      orderId,
      stato: 'errore_generazione',
      noteInterne: `Errore durante la generazione: ${error.message}`,
    }).catch(() => {});
    throw error;
  }
}

async function callGeminiWithRetry(systemInstruction, userPrompt, maxRetries = 4) {
  const url = `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`;

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 16000,
    },
  });

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (res.ok) {
      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p) => p.text || '').join('');
      if (!text) throw new Error('Risposta Gemini vuota o bloccata (controlla finishReason/safety ratings)');
      return text;
    }

    if (res.status === 429 && attempt < maxRetries - 1) {
      const backoffMs = Math.min(15000, 1500 * 2 ** attempt) + Math.random() * 1000;
      await new Promise((r) => setTimeout(r, backoffMs));
      continue;
    }

    throw new Error(`Errore API Gemini (${res.status}): ${await res.text()}`);
  }
}

function parseModelOutput(rawText) {
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Output del modello non è JSON valido: ${e.message}`);
  }
  if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
    throw new Error('Output del modello privo di file generati');
  }
  return parsed;
}

function buildInternalNotes(flaggedRequests, sectionMismatch, sectionCount, expectedSections) {
  const notes = [];
  if (sectionMismatch) {
    notes.push(
      `⚠️ Controllo sezioni fallito: generate ${sectionCount}, attese ${expectedSections}. Rivedi manualmente prima di procedere.`
    );
  }
  if (Array.isArray(flaggedRequests) && flaggedRequests.length) {
    notes.push(`Richieste fuori scope rilevate nel brief (possibile upsell): ${flaggedRequests.join('; ')}`);
  }
  return notes.join('\n') || '';
}

// Deploy Netlify — lasciato per compatibilità, non più il default. Utilizzabile
// solo se hai ancora NETLIFY_API_TOKEN impostato e crediti residui.
// Deploy su Cloudflare Workers (Direct Upload API), la Fase 2 promessa.
// A differenza di Netlify, qui servono 3 chiamate in sequenza, ognuna che passa
// un token temporaneo alla successiva. Parti segnate "DA VERIFICARE" sono
// dedotte dalla documentazione ma non testate — controllale col test locale
// prima di fidartene in automatico.
// Determina il content-type corretto in base all'estensione del file — senza
// questo, Cloudflare serve tutto come testo semplice e il browser mostra il
// codice sorgente invece di renderizzare la pagina.
function getContentType(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const map = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    ico: 'image/x-icon',
  };
  return map[ext] || 'application/octet-stream';
}

export async function deployToCloudflareWorkers(orderId, files) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  const MAX_NAME_LENGTH = 37;
  const prefix = 'pronto-preview-';
  const rawName = `${prefix}${orderId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const hash6 = createHash('sha1').update(String(orderId)).digest('hex').slice(0, 6);
  const scriptName = rawName.length > MAX_NAME_LENGTH
    ? `${rawName.slice(0, MAX_NAME_LENGTH - hash6.length - 1)}-${hash6}`
    : rawName;

  // Passo 1 — manifest: un hash per file, SHA-256 troncato ai primi 16 byte (32
  // caratteri hex), non SHA-1 completo come su Netlify.
  const manifest = {};
  const fileByHash = {};
  files.forEach((f) => {
    const fullHash = createHash('sha256').update(f.content).digest('hex');
    const shortHash = fullHash.slice(0, 32);
    const filePath = f.path.startsWith('/') ? f.path : `/${f.path}`;
    manifest[filePath] = { hash: shortHash, size: Buffer.byteLength(f.content, 'utf-8') };
    fileByHash[shortHash] = f;
  });

  const sessionRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/assets-upload-session`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest }),
    }
  );
  if (!sessionRes.ok) throw new Error(`Errore submit manifest Cloudflare: ${await sessionRes.text()}`);
  const sessionData = await sessionRes.json();
  // DA VERIFICARE: il nome esatto del campo con l'elenco hash da caricare e col
  // JWT temporaneo può differire da questa ipotesi — controlla la risposta reale
  // nel test locale e correggi qui se serve.
  const uploadJwt = sessionData.result?.jwt;
  const hashesToUpload = sessionData.result?.buckets?.flat() || Object.keys(fileByHash);

  // Passo 2 — carica solo i file richiesti, base64, multipart/form-data.
  // Se ci sono file da caricare, il token di completamento arriva nella
  // risposta di QUESTA chiamata (quando l'ultimo file atteso viene ricevuto,
  // Cloudflare risponde 201 col JWT finale dentro result.jwt) — non serve
  // (ed era sbagliato) fare una seconda chiamata separata per recuperarlo.
  let completionJwt = uploadJwt;
  if (hashesToUpload.length > 0) {
    const form = new FormData();
    hashesToUpload.forEach((h) => {
      const f = fileByHash[h];
      if (!f) return;
      const base64Content = Buffer.from(f.content, 'utf-8').toString('base64');
      const blob = new Blob([base64Content], { type: getContentType(f.path) });
      form.append(h, blob, h);
    });

    const uploadRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/assets/upload?base64=true`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${uploadJwt}` },
        body: form,
      }
    );
    if (!uploadRes.ok) throw new Error(`Errore upload file Cloudflare: ${await uploadRes.text()}`);
    const uploadData = await uploadRes.json();
    completionJwt = uploadData.result?.jwt || uploadJwt;
  }

  // Passo 3 — finalizza: un worker.js minimo che serve solo gli asset caricati
  const workerScript = `export default { async fetch(request, env) { return env.ASSETS.fetch(request); } };`;
  const metadata = {
    main_module: 'worker.js',
    compatibility_date: '2026-08-01',
    assets: { jwt: completionJwt },
  };

  const finalizeForm = new FormData();
  finalizeForm.append('metadata', JSON.stringify(metadata));
  finalizeForm.append('worker.js', new Blob([workerScript], { type: 'application/javascript+module' }), 'worker.js');

  const finalizeRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`,
    { method: 'PUT', headers: { Authorization: `Bearer ${apiToken}` }, body: finalizeForm }
  );
  if (!finalizeRes.ok) throw new Error(`Errore finalizzazione Worker Cloudflare: ${await finalizeRes.text()}`);

  // Attivazione esplicita del sottodominio workers.dev per QUESTO script — senza
  // questa chiamata, il Worker esiste ma non risponde su nessun URL pubblico
  // ("no active routes" è esattamente questo stato).
  const enableSubdomainRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, previews_enabled: true }),
    }
  );
  if (!enableSubdomainRes.ok) {
    throw new Error(`Errore attivazione sottodominio Cloudflare: ${await enableSubdomainRes.text()}`);
  }

  const subdomainRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`,
    { headers: { Authorization: `Bearer ${apiToken}` } }
  );
  const subdomainData = await subdomainRes.json().catch(() => ({}));
  const subdomain = subdomainData.result?.subdomain || accountId;

  return `https://${scriptName}.${subdomain}.workers.dev`;
}

export async function deployToNetlify(orderId, files) {
  const MAX_SUBDOMAIN_LENGTH = 37;
  const prefix = 'pronto-preview-';
  const rawName = `${prefix}${orderId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const hash = createHash('sha1').update(String(orderId)).digest('hex').slice(0, 6);
  const siteName = rawName.length > MAX_SUBDOMAIN_LENGTH
    ? `${rawName.slice(0, MAX_SUBDOMAIN_LENGTH - hash.length - 1)}-${hash}`
    : rawName;

  const createSiteRes = await fetch('https://api.netlify.com/api/v1/sites', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.NETLIFY_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: siteName }),
  });

  if (!createSiteRes.ok) {
    throw new Error(`Errore creazione sito Netlify: ${await createSiteRes.text()}`);
  }
  const site = await createSiteRes.json();

  const fileDigests = {};
  const fileContents = {};
  files.forEach((f) => {
    const hash2 = createHash('sha1').update(f.content).digest('hex');
    fileDigests[`/${f.path}`] = hash2;
    fileContents[hash2] = f.content;
  });

  const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${site.id}/deploys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.NETLIFY_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files: fileDigests }),
  });

  if (!deployRes.ok) {
    throw new Error(`Errore avvio deploy Netlify: ${await deployRes.text()}`);
  }
  const deploy = await deployRes.json();

  const required = deploy.required || [];
  for (const hash3 of required) {
    const path = Object.keys(fileDigests).find((p) => fileDigests[p] === hash3);
    if (!path) continue;
    await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}/files${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${process.env.NETLIFY_API_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: fileContents[hash3],
    });
  }

  return site.ssl_url || site.url;
}

// Modalità locale: scrive i file su disco invece di deployarli. Nota bene: questa
// funzione presuppone un filesystem (Node "fs"), disponibile in locale ma NON dentro
// una Pages Function (il runtime Workers non ha accesso al filesystem). Usala solo
// da generate-site-local.js, mai come "deliver" di default in una Pages Function —
// per questo il default della function online andrà cambiato in Fase 2, non lasciato
// così com'è.
export async function writeFilesLocally(orderId, files) {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const outputDir = path.resolve(process.cwd(), 'output', String(orderId));
  fs.mkdirSync(outputDir, { recursive: true });

  files.forEach((f) => {
    const filePath = path.join(outputDir, f.path);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, f.content, 'utf-8');
  });

  return outputDir;
}

async function updateNotionAfterGeneration({ orderId, stato, linkAnteprimaInterna, presetUsato, varianteUsata, noteInterne }) {
  const page = await queryPageByOrderId(orderId);
  if (!page) throw new Error(`Ordine ${orderId} non trovato in Notion`);

  const properties = {
    Stato: { select: { name: stato } },
  };
  if (linkAnteprimaInterna) properties['Link anteprima interna'] = { url: linkAnteprimaInterna };
  if (presetUsato) properties['Preset stile'] = { select: { name: presetUsato } };
  if (varianteUsata) properties['Variante stile'] = { select: { name: varianteUsata } };
  if (noteInterne) properties['Note interne'] = { rich_text: [{ text: { content: noteInterne.slice(0, 2000) } }] };

  const res = await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties }),
  });

  if (!res.ok) throw new Error(`Errore aggiornamento Notion: ${await res.text()}`);
  return res.json();
}
