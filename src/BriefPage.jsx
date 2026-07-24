import { useEffect, useMemo, useState } from 'react';

const TALLY_FORM_ID = 'QKaQyY';

export default function BriefPage() {
  const [summary, setSummary] = useState('Sto caricando il riepilogo del tuo ordine…');
  const [tallyUrl, setTallyUrl] = useState('');
  const [error, setError] = useState('');

  const isMissingSession = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return !params.get('session_id');
  }, []);

  useEffect(() => {
    async function caricaRiepilogo() {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');

      if (!sessionId) {
        setError('Nessun ordine trovato. Torna al checkout e completa il pagamento per continuare.');
        setSummary('');
        return;
      }

      try {
        const res = await fetch(`/.netlify/functions/get-session?session_id=${sessionId}`);
        const data = await res.json();

        if (!res.ok || data?.error) {
          throw new Error(data?.error || 'Impossibile recuperare il riepilogo del pagamento.');
        }

        const packageLabel = Number(data.amount) >= 349 ? 'Pacchetto Pro' : 'Pacchetto Base';
        const blocks = (data.blocchi || '').split(',').filter(Boolean).join(' • ');
        const style = data.stile || 'Da definire';
        const settore = data.settore || 'Da definire';

        setSummary(`Hai scelto: ${packageLabel}, settore ${settore}, blocchi ${blocks || '—'}, stile ${style}.`);

        const tallyParams = new URLSearchParams();
        tallyParams.set('order_id', data.orderId || sessionId);
        if (data.email) {
          tallyParams.set('email', data.email);
        }

        const url = `https://tally.so/r/${TALLY_FORM_ID}?${tallyParams.toString()}`;
        setTallyUrl(url);
      } catch (err) {
        setError(err.message || 'Si è verificato un errore durante il caricamento del riepilogo.');
      }
    }

    caricaRiepilogo();
  }, []);

  return (
    <div className="brief-page">
      <nav className="brief-nav">
        <a href="/" className="brief-logo">pronto<em>.site</em></a>
        <a href="/" className="nav-pill brief-nav-pill">Torna al sito</a>
      </nav>

      <main className="brief-main">
        <section className="brief-card brief-card-summary">
          <span className="s-tag">Brief</span>
          <h1>Il tuo ordine è stato confermato</h1>
          <p className="brief-intro">
            Abbiamo già raccolto il tuo acquisto. Qui trovi il riepilogo del pacchetto e puoi completare il brief in un secondo step.
          </p>

          <div className="brief-summary-box" id="riepilogo">
            {error ? (
              <p className="brief-error">{error}</p>
            ) : (
              <>
                <p className="brief-summary-line">{summary}</p>
                {isMissingSession && !error ? (
                  <p className="brief-hint">Aggiungi <strong>?session_id=...</strong> nell’URL per vedere il riepilogo.</p>
                ) : null}
              </>
            )}
          </div>
        </section>

        <section className="brief-card brief-card-form">
          <div className="brief-form-heading">
            <span className="s-tag">Form</span>
            <h2>Completa il brief</h2>
            <p>Il modulo Tally è già pronto con i dati del pagamento collegati all’ordine.</p>
          </div>

          {tallyUrl ? (
            <iframe
              id="tally-iframe"
              className="brief-iframe"
              src={tallyUrl}
              title="Tally form per il brief"
              loading="eager"
            />
          ) : (
            <div className="brief-loading">Caricamento del form…</div>
          )}
        </section>
      </main>
    </div>
  );
}
