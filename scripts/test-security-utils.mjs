/**
 * Lightweight security utility checks (run with: node scripts/test-security-utils.mjs)
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let failed = 0;

function assert(name, condition) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    failed += 1;
  } else {
    console.log(`OK: ${name}`);
  }
}

assert('escapes script tag', escapeHtml('<script>alert(1)</script>') === '&lt;script&gt;alert(1)&lt;/script&gt;');
assert('escapes ampersand', escapeHtml('A & B') === 'A &amp; B');
assert('handles null', escapeHtml(null) === '');

if (failed > 0) {
  process.exit(1);
}

console.log('All security utility checks passed.');
