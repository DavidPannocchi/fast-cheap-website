import { useEffect, useMemo, useRef, useState } from 'react';

const DOMAIN_CHECK_DELAY = 500;
const MAKE_DOMAIN_WEBHOOK_URL = 'https://hook.eu1.make.com/TUO_WEBHOOK_DOMINIO';
const CHECK_DOMAIN_PATH = '/api/check-domain';

function normalizeInput(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9.-]/g, '');
}

function buildDomain(value) {
  if (!value) return '';
  return value.includes('.') ? value : `${value}.it`;
}

function isDomainLike(value) {
  return value.includes('.') && value.length <= 253 && /[a-z0-9]/.test(value);
}

function createDomainSuggestions(value) {
  if (!value) return [];
  const base = value.replace(/\.[^.]+$/,'');
  const clean = base.replace(/[^a-z0-9-]/g, '');
  if (!clean) return [];
  return [`${clean}.com`, `${clean}.net`, `${clean}-it.it`];
}

export default function DominioPage() {
  const [sessionId, setSessionId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [status, setStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('Digita il nome del dominio che vuoi verificare.');
  const [domainCandidate, setDomainCandidate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasDomainStep, setHasDomainStep] = useState(false);
  const debounceRef = useRef(null);

  const chosenCandidate = useMemo(() => buildDomain(normalizeInput(inputValue)), [inputValue]);
  const manualDomain = useMemo(() => buildDomain(normalizeInput(manualValue)), [manualValue]);
  const suggestions = useMemo(() => {
    if (status !== 'occupato') return [];
    return createDomainSuggestions(chosenCandidate);
  }, [status, chosenCandidate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session_id');
    if (!sid) {
      setError('Ordine non valido: manca il riferimento alla sessione. Torna al checkout.');
      return;
    }
    setSessionId(sid);

    fetch(`/api/get-session?session_id=${encodeURIComponent(sid)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data?.error) throw new Error(data?.error || 'Impossibile caricare l’ordine.');
        return data;
      })
      .then((data) => {
        const tier = (data.tier || '').toLowerCase();
        const addons = Array.isArray(data.addons) ? data.addons : [];
        const hasAddon = addons.some((a) => String(a).toLowerCase() === 'dominio personalizzato + email professionale');
        const hasTier = tier === 'pro' || tier === 'business';
        if (!hasTier && !hasAddon) {
          window.location.href = `/brief?session_id=${encodeURIComponent(sid)}`;
          return;
        }
        setOrderId(data.orderId || sid);
        setHasDomainStep(true);
        setReady(true);
      })
      .catch((err) => {
        setError(err.message || 'Errore durante il caricamento dell’ordine.');
      });
  }, []);

  useEffect(() => {
    if (!ready || manualMode) return;
    if (!inputValue.trim()) {
      setStatus('idle');
      setStatusMessage('Digita il nome del dominio che vuoi verificare.');
      return;
    }

    clearTimeout(debounceRef.current);
    setStatus('verificando');
    setStatusMessage('Verifica in corso…');

    debounceRef.current = window.setTimeout(async () => {
      const candidate = chosenCandidate;
      if (!isDomainLike(candidate)) {
        setStatus('non_verificabile');
        setStatusMessage('Dominio non valido. Prova con un nome semplice.');
        setDomainCandidate('');
        return;
      }

      setDomainCandidate(candidate);
      try {
        const res = await fetch(`${CHECK_DOMAIN_PATH}?domain=${encodeURIComponent(candidate)}`);
        const data = await res.json();
        const nextStatus = data?.status || 'non_verificabile';
        setStatus(nextStatus);
        if (nextStatus === 'libero') {
          setStatusMessage('Questo dominio sembra disponibile.');
        } else if (nextStatus === 'occupato') {
          setStatusMessage('Già preso: prova una variante oppure usa un dominio diverso.');
        } else {
          setStatusMessage('Non riesco a verificarlo in questo momento, puoi comunque procedere.');
        }
      } catch (err) {
        setStatus('non_verificabile');
        setStatusMessage('Non riesco a verificarlo in questo momento, puoi comunque procedere.');
      }
    }, DOMAIN_CHECK_DELAY);

    return () => clearTimeout(debounceRef.current);
  }, [inputValue, ready, manualMode, chosenCandidate]);

  const canConfirm = useMemo(() => {
    if (manualMode) return Boolean(manualDomain);
    if (!domainCandidate) return false;
    return status === 'libero' || status === 'non_verificabile';
  }, [manualMode, manualDomain, domainCandidate, status]);

  const confirmDomain = async () => {
    const dominio = manualMode ? manualDomain : domainCandidate;
    if (!dominio) {
      setError('Inserisci un dominio valido prima di procedere.');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      order_id: orderId || sessionId,
      dominio,
      mode: manualMode ? 'manual' : 'auto',
    };

    try {
      await fetch(MAKE_DOMAIN_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('Webhook dominio non disponibile.', err);
    } finally {
      sessionStorage.setItem('dominio_scelto', dominio);
      window.location.href = `/brief?session_id=${encodeURIComponent(sessionId)}&dominio=${encodeURIComponent(dominio)}`;
    }
  };

  if (error) {
    return (
      <div className="domain-page">
        <div className="domain-card domain-card-error">
          <h1>Errore</h1>
          <p>{error}</p>
          <a href="/" className="nav-pill brief-nav-pill">Torna al sito</a>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="domain-page">
        <div className="domain-card domain-card-loading">
          <h1>Caricamento ordine…</h1>
          <p>Stiamo preparando la pagina del dominio per il tuo ordine.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="domain-page">
      <nav className="brief-nav">
        <a href="/" className="brief-logo">pronto<em>.site</em></a>
        <a href="/" className="nav-pill brief-nav-pill">Torna al sito</a>
      </nav>

      <main className="domain-main">
        <section className="domain-card domain-card-summary">
          <span className="s-tag">Dominio</span>
          <h1>Scegli il dominio giusto per il tuo sito</h1>
          <p className="brief-intro">
            Se hai già un dominio, usalo qui. Altrimenti scegli il nome che vuoi verificare ora e confermalo prima del brief.
          </p>

          <div className="domain-form">
            <label className="domain-label" htmlFor="domainSearch">Nome dominio</label>
            <input
              id="domainSearch"
              className="domain-input"
              type="text"
              placeholder="es. nomeattivita"
              value={manualMode ? manualValue : inputValue}
              onChange={(event) => {
                setError('');
                if (manualMode) setManualValue(event.target.value);
                else setInputValue(event.target.value);
              }}
            />
            {!manualMode ? (
              <p className="domain-help">Verifica live la disponibilità e conferma il dominio prima di completare il brief.</p>
            ) : (
              <p className="domain-help">Inserisci il tuo dominio esistente; lo useremo per la configurazione DNS manuale.</p>
            )}

            <div className={`domain-status status-${status}`}>
              <span className="status-label">Stato:</span>
              <span>{statusMessage}</span>
            </div>

            {status === 'occupato' && suggestions.length > 0 ? (
              <div className="domain-suggestions">
                <span>Prova questi:</span>
                <div className="suggestion-list">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="suggestion-chip"
                      onClick={() => setInputValue(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="domain-actions">
              <button
                className="domain-confirm-btn"
                type="button"
                disabled={!canConfirm || isSubmitting}
                onClick={confirmDomain}
              >
                {manualMode ? 'Usa questo dominio' : 'Conferma dominio'}
              </button>
              <button
                className="domain-secondary-btn"
                type="button"
                onClick={() => {
                  setManualMode(!manualMode);
                  setError('');
                  setStatus('idle');
                  setStatusMessage('Digita il nome del dominio che vuoi verificare.');
                }}
              >
                {manualMode ? 'Torna alla verifica live' : 'Hai già un dominio? Usa quello'}
              </button>
            </div>

            {error ? <p className="brief-error">{error}</p> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
