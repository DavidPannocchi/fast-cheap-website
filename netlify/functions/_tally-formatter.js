// _tally-formatter.js
// Trasforma l'array grezzo `fields` del webhook Tally in un blocco di testo
// leggibile "Domanda: Risposta", che sostituisce la mappatura manuale campo per
// campo in Make. Make si limita a inoltrare l'array così com'è; tutta
// l'interpretazione — compreso il meccanismo "non saprei -> genera tu" e la
// gestione dei file caricati — è demandata al modello via istruzioni nel system
// prompt (vedi _prompt-builder.js), non a logica scritta qui o in Make.

// Risolve il valore di un singolo field, traducendo eventuali id di opzione
// (dropdown, checkbox, scelta multipla) nella loro etichetta testuale.
function resolveFieldValue(field) {
  const { value, options } = field;

  if (value === undefined || value === null || value === '') return '(non risposto)';

  if (Array.isArray(value)) {
    if (Array.isArray(options) && options.length) {
      const labels = value
        .map((id) => options.find((o) => o.id === id)?.text || id)
        .join(', ');
      return labels || '(non risposto)';
    }
    return value.length ? value.join(', ') : '(non risposto)';
  }

  if (Array.isArray(options) && options.length) {
    const opt = options.find((o) => o.id === value);
    if (opt) return opt.text;
  }

  return String(value);
}

// Converte l'intero array di field in un blob di testo, un rigo per domanda.
// Filtra elementi puramente decorativi (titoli/paragrafi di sezione nel form)
// che non sono vere domande e non vanno interpretati come risposte del cliente.
function formatTallyFields(fields) {
  if (!Array.isArray(fields) || !fields.length) return '(nessuna risposta ricevuta dal brief)';

  const DECORATIVE_TYPES = new Set(['HEADING', 'TEXT_BLOCK', 'DIVIDER', 'IMAGE']);

  return fields
    .filter((f) => f.label && !DECORATIVE_TYPES.has(f.type))
    .map((f) => {
      const risposta = resolveFieldValue(f);
      const tipo = f.type ? ` [tipo: ${f.type}]` : '';
      return `${f.label}${tipo}: ${risposta}`;
    })
    .join('\n');
}

module.exports = { formatTallyFields };
