import { useEffect, useMemo, useState } from 'react';

export default function BriefPage() {
  const [orderData, setOrderData] = useState(null);
  const [tallyUrl, setTallyUrl] = useState('');
  const [error, setError] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [showDomain, setShowDomain] = useState(false);

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
        return;
      }

      try {
        const res = await fetch(`/api/get-session?session_id=${sessionId}`);
        const data = await res.json();

        if (!res.ok || data?.error) {
          throw new Error(data?.error || 'Impossibile recuperare il riepilogo del pagamento.');
        }

        const packageLabels = {
          vetrina: 'Vetrina',
          pro: 'Pro',
          'su-misura': 'Su Misura',
        };

        setOrderData({
          packageLabel: packageLabels[(data.tier || '').toLowerCase()] || 'Il tuo pacchetto',
          settore: data.settore || 'Da definire',
          stile: data.stile || 'Da definire',
          blocchi: (data.blocchi || '').split(',').map((b) => b.trim()).filter(Boolean),
        });

        if (!data.tallyUrl) {
          throw new Error('URL del brief non disponibile.');
        }
        setTallyUrl(data.tallyUrl);

        const dominio = params.get('dominio') || sessionStorage.getItem('dominio_scelto') || '';
        if (dominio) {
          setSelectedDomain(dominio);
          sessionStorage.setItem('dominio_scelto', dominio);
        }
      } catch (err) {
        setError(err.message || 'Si è verificato un errore durante il caricamento del riepilogo.');
      }
    }

    caricaRiepilogo();
  }, []);

  useEffect(() => {
    if (!selectedDomain) return;
    const timer = window.setTimeout(() => setShowDomain(true), 80);
    return () => window.clearTimeout(timer);
  }, [selectedDomain]);

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
            ) : orderData ? (
              <>
                <div className="brief-summary-top">
                  <span className="brief-package-pill">{orderData.packageLabel}</span>
                  <div className="brief-summary-pairs">
                    <div className="brief-summary-pair">
                      <span className="brief-summary-label">Settore</span>
                      <span className="brief-summary-value">{orderData.settore}</span>
                    </div>
                    <div className="brief-summary-pair">
                      <span className="brief-summary-label">Stile</span>
                      <span className="brief-summary-value">{orderData.stile}</span>
                    </div>
                  </div>
                </div>

                {orderData.blocchi.length > 0 && (
                  <div className="brief-blocks">
                    <span className="brief-summary-label">Sezioni incluse</span>
                    <div className="brief-blocks-list">
                      {orderData.blocchi.map((blocco) => (
                        <span key={blocco} className="brief-block-chip">{blocco}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDomain ? (
                  <div className={`brief-domain-badge${showDomain ? ' show' : ''}`}>
                    <span>Dominio confermato:</span>
                    <strong>{selectedDomain}</strong>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="brief-summary-loading">Sto caricando il riepilogo del tuo ordine…</p>
            )}

            {isMissingSession && !error ? (
              <p className="brief-hint">Aggiungi <strong>?session_id=...</strong> nell’URL per vedere il riepilogo.</p>
            ) : null}
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
