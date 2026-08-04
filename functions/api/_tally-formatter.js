// _tally-formatter.js
// Il modulo Tally di Make restituisce un oggetto piatto — ogni domanda è già
// una chiave leggibile, il valore è già testo umano (Make/Tally risolvono gli
// ID delle opzioni multiple scelta prima ancora che arrivino qui). A volte
// quell'oggetto arriva incapsulato in un array di un solo elemento (dipende
// da come è mappato in Make) — gestiamo entrambi i casi.

const SKIP_KEYS = new Set(['order_id', 'email']); // già gestiti altrove (orderId, contatti.email)

export function formatTallyFields(tallyFields) {
  const flat = Array.isArray(tallyFields) ? tallyFields[0] : tallyFields;
  if (!flat || typeof flat !== 'object') return '(nessuna risposta ricevuta dal brief)';

  const righe = Object.entries(flat)
    .filter(([key, value]) => !SKIP_KEYS.has(key) && value !== null && value !== undefined && value !== '')
    .map(([key, value]) => {
      const risposta = Array.isArray(value) ? value.join(', ') : String(value);
      return `${key}: ${risposta}`;
    });

  return righe.length ? righe.join('\n') : '(nessuna risposta ricevuta dal brief)';
}
