// _tally-formatter.js
// Logica identica alla versione Netlify — solo sintassi import/export.

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

export function formatTallyFields(fields) {
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
