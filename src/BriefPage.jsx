import { useEffect, useMemo, useState } from 'react';

const packageLabels = {
  base: 'Vetrina',
  pro: 'Pro',
  'su-misura': 'Su Misura',
};

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

        setOrderData({
          packageLabel: packageLabels[(data.tier || '').toLowerCase()] || 'Il tuo pacchetto',
          settore: data.settore || 'Da definire',
          stile: data.stile || 'Da definire',
          blocchi: (data.blocchi || '').split(',').map((b) => b.trim()).filter(Boolean),
          addons: Array.isArray(data.addons) ? data.addons : [],
        });

        if (!data.tallyUrl) {
          throw new Error('Link al brief non disponibile.');
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
            Abbiamo già raccolto il tuo acquisto. Qui trovi il riepilogo del pacchetto — il passo successivo è completare il brief.
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
                  <div className="brief-tag-group">
                    <span className="brief-summary-label">Sezioni incluse</span>
                    <div className="brief-tag-list">
                      {orderData.blocchi.map((blocco) => (
                        <span key={blocco} className="brief-chip brief-chip-section">{blocco}</span>
                      ))}
                    </div>
                  </div>
                )}

                {orderData.addons.length > 0 && (
                  <div className="brief-tag-group">
                    <span className="brief-summary-label">Extra selezionati</span>
                    <div className="brief-tag-list">
                      {orderData.addons.map((addon) => (
                        <span key={addon} className="brief-chip brief-chip-addon">{addon}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDomain ? (
                  <div className={`brief-domain-badge${showDomain ? ' show' : ''}`}>
                    <span>Dominio confermato</span>
                    <span className="brief-domain-value">{selectedDomain}</span>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="brief-summary-loading">Sto caricando il riepilogo del tuo ordine…</p>
            )}

            {isMissingSession && !error ? (
              <p className="brief-hint">Aggiungi ?session_id=... nell'URL per vedere il riepilogo.</p>
            ) : null}
          </div>
        </section>

        <section className="brief-card brief-card-form">
          <div className="brief-form-heading">
            <span className="s-tag">Prossimo passo</span>
            <h2>Completa il brief</h2>
            <p>Rispondi a poche domande per darci tutti i dettagli del tuo sito — ci vogliono pochi minuti.</p>
          </div>

          {tallyUrl ? (
            <a href={tallyUrl} className="brief-cta-button">Completa il brief →</a>
          ) : (
            <span className="brief-cta-button brief-cta-button-loading">Preparazione del link in corso…</span>
          )}
        </section>
      </main>
    </div>
  );
}
