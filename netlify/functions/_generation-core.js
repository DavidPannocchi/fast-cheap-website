// _generation-core.js
// Logica di generazione condivisa tra la Netlify Function (generate-site.js,
// per quando vorrai l'automazione via webhook Make) e lo script locale
// (generate-site-local.js, da usare oggi mentre il piano Netlify Free ha un
// limite di 10 secondi per function troppo stretto per questo carico di lavoro:
// Gemini + deploy + aggiornamento Notion in sequenza).
//
// Tenere questa logica in un file a sé — invece che duplicata in due posti —
// significa che quando passerai il progetto a un piano che supporta tempi più
// lunghi (o a una function in background), basta ricollegare questo stesso
// modulo alla Netlify Function, senza riscrivere nulla.

const { buildSystemPrompt, buildUserMessage, normalizeBlocchi } = require('./_prompt-builder');
const { queryPageByOrderId } = require('./_notion-helpers');

const MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Orchestratore principale: dato un ordine, esegue tutta la pipeline e
// restituisce lo stesso oggetto risultato sia che venga chiamato dalla
// Netlify Function sia dallo script locale.
async function runGeneration(order) {
  const { orderId } = order;
  if (!orderId) throw new Error('order_id mancante');

  try {
    const system = buildSystemPrompt();
    const { prompt, presetFinale, variante } = buildUserMessage(order);

    const rawText = await callGeminiWithRetry(system, prompt);
    const parsed = parseModelOutput(rawText);

    const indexFile = parsed.files.find((f) => f.path === 'index.html');
    const sectionCount = indexFile ? (indexFile.content.match(/<section/g) || []).length : 0;
    const expectedSections = normalizeBlocchi(order.blocchi).filter(
      (b) => b !== 'Copertina' && b !== 'Menu'
    ).length;
    const sectionMismatch = sectionCount !== expectedSections;

    const previewUrl = await deployToNetlify(orderId, parsed.files);

    await updateNotionAfterGeneration({
      orderId,
      stato: sectionMismatch ? 'in_controllo_urgente' : 'in_controllo',
      linkAnteprimaInterna: previewUrl,
      presetUsato: parsed.preset_usato || presetFinale,
      varianteUsata: parsed.variante_usata || variante,
      noteInterne: buildInternalNotes(parsed.flagged_requests, sectionMismatch, sectionCount, expectedSections),
    });

    return {
      ok: true,
      preview_url: previewUrl,
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

// Chiama Gemini con retry esponenziale sui 429. maxRetries più generoso di
// default rispetto alla versione precedente pensata per la Netlify Function:
// qui non c'è un timeout esterno stretto a cui stare attenti (né dal lato
// script locale, né idealmente da un futuro piano Netlify con limiti più alti).
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

async function deployToNetlify(orderId, files) {
  const siteName = `pronto-preview-${orderId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const crypto = require('crypto');

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
    const hash = crypto.createHash('sha1').update(f.content).digest('hex');
    fileDigests[`/${f.path}`] = hash;
    fileContents[hash] = f.content;
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
  for (const hash of required) {
    const path = Object.keys(fileDigests).find((p) => fileDigests[p] === hash);
    if (!path) continue;
    await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}/files${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${process.env.NETLIFY_API_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: fileContents[hash],
    });
  }

  return site.ssl_url || site.url;
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

module.exports = { runGeneration };
