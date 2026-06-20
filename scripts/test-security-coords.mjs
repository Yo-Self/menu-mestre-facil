/**
 * SEC-09 regression checks for delivery coordinate validation in SQL migrations.
 * Run with: node scripts/test-security-coords.mjs
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const migrationFiles = [
  'supabase/migrations/20260618000000_fix_delivery_coords_rls_sanitize.sql',
  'supabase/migrations/20260620120000_security_ordering_delivery_geocode.sql',
];

let failed = 0;

function assert(name, condition) {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    failed += 1;
    return;
  }
  console.log(`OK: ${name}`);
}

const combinedSql = migrationFiles
  .map((file) => readFileSync(join(root, file), 'utf8'))
  .join('\n');

assert('create_customer_order raises missing_coordinates', /RAISE EXCEPTION 'missing_coordinates'/.test(combinedSql));
assert('delivery requires delivery_coords_lat/lng path', /delivery_coords_lat/.test(combinedSql));
assert('online_ordering_disabled guard exists', /online_ordering_disabled/.test(combinedSql));
assert('delivery_coords_mismatch guard exists', /delivery_coords_mismatch/.test(combinedSql));
assert('geocode_delivery_address function exists', /FUNCTION public\.geocode_delivery_address/.test(combinedSql));
assert('create_waiter_call RPC exists', /FUNCTION public\.create_waiter_call/.test(readFileSync(join(root, 'supabase/migrations/20260620100000_security_waiter_calls_rpc.sql'), 'utf8')));
assert('dishes_public view exists', /VIEW public\.dishes_public/.test(readFileSync(join(root, 'supabase/migrations/20260620110000_security_dishes_public_view.sql'), 'utf8')));

if (failed > 0) {
  process.exit(1);
}

console.log('All delivery/security migration regression checks passed.');
