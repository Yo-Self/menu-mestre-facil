import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const publicPrefixes = ['NEXT_PUBLIC_', 'VITE_'];
const sensitiveNamePattern =
  /(SECRET|SERVICE_ROLE|AUTH_TOKEN|PRIVATE|WEBHOOK_SECRET|STRIPE_SECRET_KEY|GOOGLE_AI_API_KEY)/i;
const frontendRuntimeForbidden = [
  'GOOGLE_AI_API_KEY',
  'POSTHOG_API_KEY',
  'SENTRY_AUTH_TOKEN',
  'STRIPE_SECRET_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SB_SECRET_KEY',
  'TELEGRAM_BOT_TOKEN',
];
const allowedNextPublicCompat = new Set([
  'NEXT_PUBLIC_DEV_IMAGE_MODE',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORM',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
]);
const ignoredDirectories = new Set([
  '.git',
  '.cursor',
  'dist',
  'node_modules',
  'out',
  'release',
]);
const scanExtensions = new Set([
  '.cjs',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function isPublicEnvName(name) {
  return publicPrefixes.some((prefix) => name.startsWith(prefix));
}

function isProductionBuild() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.GITHUB_ACTIONS === 'true' ||
    process.env.CI === 'true'
  );
}

function isLocalHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function validateEnvironmentNames() {
  for (const name of Object.keys(process.env)) {
    if (isPublicEnvName(name) && sensitiveNamePattern.test(name)) {
      fail(`Public environment variable "${name}" looks sensitive.`);
    }

    if (
      name.startsWith('NEXT_PUBLIC_') &&
      !allowedNextPublicCompat.has(name)
    ) {
      warn(`NEXT_PUBLIC variable "${name}" is public. Prefer VITE_* in this Vite project.`);
    }
  }

  for (const name of frontendRuntimeForbidden) {
    if (process.env[name]) {
      fail(`Server-only secret "${name}" is present during a frontend build.`);
    }
  }
}

function validateHttps() {
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  if (!supabaseUrl || !isProductionBuild()) {
    return;
  }

  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol === 'https:') {
      return;
    }
  } catch {
    fail('Supabase URL must be a valid URL.');
    return;
  }

  if (!isLocalHttpUrl(supabaseUrl)) {
    fail('Supabase URL must use HTTPS in production builds.');
  }
}

function walkFiles(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) {
      continue;
    }

    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      walkFiles(fullPath, files);
      continue;
    }

    const ext = entry.includes('.') ? entry.slice(entry.lastIndexOf('.')) : '';
    if (scanExtensions.has(ext)) {
      files.push(fullPath);
    }
  }

  return files;
}

function validateSource() {
  const root = process.cwd();
  const files = walkFiles(root);

  for (const file of files) {
    const rel = relative(root, file);
    if (rel === 'scripts/validate-public-env.js') {
      continue;
    }

    const content = readFileSync(file, 'utf8');

    if (/role"?\s*:\s*"?service_role/i.test(content) || /"role":"service_role"/i.test(content)) {
      fail(`Hardcoded service_role token payload found in ${rel}.`);
    }

    const authSensitivePath = /(auth|supabase\/client)/i.test(rel);
    const tokenLocalStorageLine = content
      .split('\n')
      .some(
        (line) =>
          /localStorage/.test(line) &&
          /(access_token|refresh_token|jwt|auth-token|sb-)/i.test(line),
      );

    if (
      /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(rel) &&
      /localStorage/.test(content) &&
      (authSensitivePath || tokenLocalStorageLine)
    ) {
      fail(`localStorage appears in an auth/token-sensitive context: ${rel}.`);
    }
  }
}

validateEnvironmentNames();
validateHttps();
validateSource();

for (const message of warnings) {
  console.warn(`[security-env] warning: ${message}`);
}

if (failures.length > 0) {
  console.error('[security-env] failed:');
  for (const message of failures) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log('[security-env] passed');
