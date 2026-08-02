// generate-site.js
// Trigger: chiamata webhook da Make dopo che il brief Tally è stato ricevuto
// (dopo lo Scenario B che aggiorna Notion a "brief_ricevuto").
//
// Cosa fa:
// 1. Riceve i dati dell'ordine (o li recupera da Notion dato order_id)
// 2. Costruisce il prompt e chiama Claude
// 3. Valida l'output: conta le sezioni generate contro quelle pagate
// 4. Deploya su Netlify come sito INTERNO (staff-only), non ancora visibile al cliente
// 5. Aggiorna Notion: Stato -> "in_controllo", Link anteprima interna -> URL,
//    Note interne -> eventuali richieste fuori scope rilevate
//
// IMPORTANTE: questa function NON porta mai un ordine direttamente a "pronto_anteprima".
// Quello step resta manuale (o comunque una decisione esplicita separata) — è la garanzia
// del controllo umano che comunichi ai clienti nella sezione "AI veloce, occhio umano".
//
// Variabili d'ambiente richieste:
// - GEMINI_API_KEY (da Google AI Studio — gratuita per iniziare, nessuna carta richiesta)
// - NETLIFY_API_TOKEN (Personal Access Token, per creare/deployare siti via API)
// - NOTION_API_KEY (probabilmente già presente per le altre function esistenti)
//
// NOTA SUL MODELLO: uso Gemini 2.5 Flash perché è quello con il miglior rapporto
// qualità/quota gratuita al momento. Il free tier ha rate limit bassi (poche
// richieste al minuto/giorno) — per iniziare va benissimo dato il volume atteso,
// ma verifica i limiti aggiornati su Google AI Studio prima di collegare Make in
// automatico: se un giorno ricevi più ordini del previsto rischi 429 a raffica.
// Quando i volumi cresceranno, il passaggio a un piano a pagamento (o a Claude,
// vedi versione precedente di questo file) richiede solo di cambiare questa
// sezione — il prompt builder resta identico.

const { buildSystemPrompt, buildUserMessage } = require('./_prompt-builder');

const MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Metodo non consentito' }) };
  }

  let order;
  try {
    order = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body non valido' }) };
  }

  const { orderId } = order;
  if (!orderId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'order_id mancante' }) };
  }

  try {
    // 1. Costruisci il prompt
    const system = buildSystemPrompt();
    const { prompt, presetFinale, variante } = buildUserMessage(order);

    // 2. Chiama Gemini
    const rawText = await callGeminiWithRetry(system, prompt);
    const parsed = parseModelOutput(rawText);

    // 3. Validazione: numero sezioni generate vs sezioni pagate.
    // Controllo grezzo ma efficace: conta i tag <section nel file index.html
    // e confronta col numero di blocchi attesi (escludendo Copertina/nav che non sono <section>).
    const indexFile = parsed.files.find((f) => f.path === 'index.html');
    const sectionCount = indexFile ? (indexFile.content.match(/<section/g) || []).length : 0;
    const expectedSections = (order.blocchi || []).filter(
      (b) => b !== 'Copertina' && b !== 'Menu'
    ).length;
    const sectionMismatch = sectionCount !== expectedSections;

    // 4. Deploy su Netlify come sito interno (staff-only, nome tecnico non comunicato al cliente)
    const previewUrl = await deployToNetlify(orderId, parsed.files);

    // 5. Aggiorna Notion
    await updateNotionAfterGeneration({
      orderId,
      stato: sectionMismatch ? 'in_controllo_urgente' : 'in_controllo',
      linkAnteprimaInterna: previewUrl,
      presetUsato: parsed.preset_usato || presetFinale,
      varianteUsata: parsed.variante_usata || variante,
      noteInterne: buildInternalNotes(parsed.flagged_requests, sectionMismatch, sectionCount, expectedSections),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        preview_url: previewUrl,
        section_mismatch: sectionMismatch,
        flagged_requests: parsed.flagged_requests || [],
      }),
    };
  } catch (error) {
    // In caso di errore, non lasciare l'ordine in un limbo silenzioso:
    // aggiorna Notion con uno stato che ti fa notare il problema.
    await updateNotionAfterGeneration({
      orderId,
      stato: 'errore_generazione',
      noteInterne: `Errore durante la generazione automatica: ${error.message}`,
    }).catch(() => {}); // non bloccare la risposta di errore se anche l'update Notion fallisce

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Errore interno durante la generazione' }),
    };
  }
};

// Chiama Gemini con retry esponenziale sui 429 — indispensabile sul free tier,
// dove i rate limit sono bassi e un 429 occasionale è normale, non un'eccezione.
async function callGeminiWithRetry(systemInstruction, userPrompt, maxRetries = 4) {
  const url = `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`;

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      // Forza Gemini a restituire JSON puro, senza bisogno di ripulire fence markdown
      // a mano come dovevamo fare con l'output testuale di Claude.
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
      const backoffMs = Math.min(30000, 1000 * 2 ** attempt) + Math.random() * 1000;
      await new Promise((r) => setTimeout(r, backoffMs));
      continue;
    }

    throw new Error(`Errore API Gemini (${res.status}): ${await res.text()}`);
  }
}

// Estrae e valida il JSON prodotto dal modello, tollerando eventuali fence markdown
// residui (```json ... ```) nonostante responseMimeType lo renda raro con Gemini.
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

// Deploy su Netlify tramite API. Crea un sito con nome tecnico basato sull'order_id
// (es. pronto-preview-{orderId}) — è un URL interno, non quello che il cliente vedrà:
// il link definitivo/pulito viene assegnato manualmente al momento della consegna finale.
async function deployToNetlify(orderId, files) {
  const siteName = `pronto-preview-${orderId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // Netlify richiede un digest SHA1 dei file per il deploy via API "digest deploy".
  // Per semplicità in questa prima versione usiamo l'endpoint di deploy diretto
  // con i file inline (va bene per progetti piccoli come questi siti statici).
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

  // Upload dei file richiesti (quelli che Netlify segnala come "required")
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

// Aggiorna Notion. Riusa idealmente lo stesso helper _notion-helpers.js già presente
// nel progetto per get-order-status.js — qui assumo una funzione di update per pagina.
async function updateNotionAfterGeneration({ orderId, stato, linkAnteprimaInterna, presetUsato, varianteUsata, noteInterne }) {
  const { queryPageByOrderId } = require('./_notion-helpers');
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
