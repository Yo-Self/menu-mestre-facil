/**
 * URL security checks for scrape-ifood SSRF protection.
 * Run with: node scripts/test-url-security.mjs
 */

function parseIpv4Octets(host) {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => part < 0 || part > 255)) {
    return null;
  }
  return parts;
}

function isIpv4(host) {
  return parseIpv4Octets(host) !== null;
}

function isPrivateOrReservedIpv4(host) {
  const octets = parseIpv4Octets(host);
  if (!octets) return false;

  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

function isPrivateOrReservedHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === 'metadata.google.internal' || host === 'metadata') return true;

  if (isIpv4(host)) {
    return isPrivateOrReservedIpv4(host);
  }

  if (host.includes(':')) {
    if (host === '::1') return true;
    if (host.startsWith('fe80:')) return true;
    if (host.startsWith('fc') || host.startsWith('fd')) return true;
  }

  return false;
}

const ALLOWED_HOST_SUFFIXES = ['ifood.com.br', 'ifood-static.com.br'];

function assertAllowedIfoodUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('URL inválida');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Protocolo não permitido');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URL não permitida');
  }

  const hostname = parsed.hostname.toLowerCase();

  if (isPrivateOrReservedHost(hostname)) {
    throw new Error('URL não permitida');
  }

  const hostAllowed = ALLOWED_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );

  if (!hostAllowed) {
    throw new Error('Host não permitido');
  }

  return parsed;
}

let failed = 0;

function assert(name, fn, expectedError) {
  try {
    fn();
    if (expectedError) {
      console.error(`FAIL: ${name} (expected error)`);
      failed += 1;
    } else {
      console.log(`OK: ${name}`);
    }
  } catch (error) {
    if (!expectedError) {
      console.error(`FAIL: ${name} (${error.message})`);
      failed += 1;
      return;
    }

    if (error.message === expectedError) {
      console.log(`OK: ${name}`);
      return;
    }

    console.error(`FAIL: ${name} (got "${error.message}")`);
    failed += 1;
  }
}

assert('allows official ifood delivery url', () => {
  const parsed = assertAllowedIfoodUrl('https://www.ifood.com.br/delivery/sao-paulo/restaurante/uuid');
  if (!parsed.hostname.includes('ifood.com.br')) {
    throw new Error('unexpected host');
  }
});

assert('allows static ifood asset host', () => {
  assertAllowedIfoodUrl('https://static.ifood-static.com.br/image/upload/logo.png');
});

assert('blocks metadata ip', () => {
  assertAllowedIfoodUrl('http://169.254.169.254/');
}, 'URL não permitida');

assert('blocks localhost', () => {
  assertAllowedIfoodUrl('http://127.0.0.1/');
}, 'URL não permitida');

assert('blocks private network', () => {
  assertAllowedIfoodUrl('http://10.0.0.1/');
}, 'URL não permitida');

assert('blocks non-ifood host', () => {
  assertAllowedIfoodUrl('https://evil.example.com/');
}, 'Host não permitido');

assert('blocks credential smuggling', () => {
  assertAllowedIfoodUrl('https://user@www.ifood.com.br/');
}, 'URL não permitida');

if (failed > 0) {
  process.exit(1);
}

console.log('All URL security checks passed.');
