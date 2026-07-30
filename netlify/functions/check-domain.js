// netlify/functions/check-domain.js
//
// Check disponibilità dominio via RDAP (no whitelist IP, no costi, no account).
// Restituisce uno stato minimale per la UI: libero / occupato / non_verificabile.

const RDAP_SERVERS = {
  it: 'https://rdap.nic.it/domain/',
  com: 'https://rdap.verisign.com/com/v1/domain/',
  net: 'https://rdap.verisign.com/net/v1/domain/',
  eu: 'https://rdap.eurid.eu/domain/',
  info: 'https://rdap.afilias.info/rdap/info/domain/',
};

const FALLBACK_BOOTSTRAP = (domain) => `https://rdap.org/domain/${domain}`;

function normalizeDomain(input) {
  return input
    .toLowerCase()
    .trim();
}

function validDomainFormat(domain) {
  return domain.includes('.') && domain.length <= 253 && /^[a-z0-9.-]+$/.test(domain);
}

async function queryRdap(domain, server, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${server}${domain}`, {
      signal: controller.signal,
      headers: { Accept: 'application/rdap+json' },
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export default async (req, context) => {
  const url = new URL(req.url);
  const domainRaw = url.searchParams.get('domain') || '';
  const domain = normalizeDomain(domainRaw);

  if (!domain || !validDomainFormat(domain)) {
    return new Response(JSON.stringify({ status: 'non_verificabile', domain, error: 'dominio non valido' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parts = domain.split('.');
  const tld = parts.pop();
  const server = RDAP_SERVERS[tld];

  try {
    const res = server
      ? await queryRdap(domain, server)
      : await queryRdap(domain, FALLBACK_BOOTSTRAP(domain));

    if (res.status === 404) {
      return new Response(JSON.stringify({ status: 'libero', domain }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (res.status === 200) {
      return new Response(JSON.stringify({ status: 'occupato', domain }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ status: 'non_verificabile', domain, error: `status_${res.status}` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (!server) {
      return new Response(JSON.stringify({ status: 'non_verificabile', domain, error: 'bootstrap_failed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const fallbackRes = await queryRdap(domain, FALLBACK_BOOTSTRAP(domain));
      if (fallbackRes.status === 404) {
        return new Response(JSON.stringify({ status: 'libero', domain }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (fallbackRes.status === 200) {
        return new Response(JSON.stringify({ status: 'occupato', domain }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ status: 'non_verificabile', domain, error: `status_${fallbackRes.status}` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (fallbackErr) {
      return new Response(JSON.stringify({ status: 'non_verificabile', domain, error: 'unreachable' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
};

export const config = {
  path: '/api/check-domain',
};
