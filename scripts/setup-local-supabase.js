import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

function runCommand(command) {
  try {
    console.log(`Running: ${command}`);
    return execSync(command, { cwd: projectRoot, encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] });
  } catch (error) {
    return error.stdout || '';
  }
}

async function setup() {
  console.log('🚀 Starting Local Supabase Setup for Gestor...');

  // 1. Verify Docker
  try {
    execSync('docker info', { stdio: 'ignore' });
  } catch (e) {
    console.error('❌ Error: Docker is not running. Please start Docker Desktop and try again.');
    process.exit(1);
  }

  // 2. Start Supabase (will do nothing if already running)
  console.log('📦 Starting local Supabase containers...');
  const startOutput = runCommand('npx supabase start');
  
  if (startOutput.includes('is already running')) {
    console.log('ℹ️ Local Supabase is already running.');
  }

  // 3. Get JSON status output to read keys
  console.log('🔍 Retrieving local credentials in JSON format...');
  const statusOutput = runCommand('npx supabase status -o json');

  if (!statusOutput) {
    console.error('❌ Error: Could not get Supabase status. Make sure the CLI started successfully.');
    process.exit(1);
  }

  let credentials;
  try {
    const jsonStart = statusOutput.indexOf('{');
    const jsonEnd = statusOutput.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('Could not find JSON object in status output');
    }
    const jsonString = statusOutput.slice(jsonStart, jsonEnd + 1);
    credentials = JSON.parse(jsonString);
  } catch (parseError) {
    console.error('❌ Error: Failed to parse supabase status JSON output:', parseError);
    console.log('Status Output was:\n', statusOutput);
    process.exit(1);
  }

  const supabaseUrl = credentials.API_URL;
  let anonKey = credentials.ANON_KEY;

  // Sign HS256 JWT local token if anonKey is in ES256 format (sb_publishable)
  if (anonKey && !anonKey.startsWith('eyJhbGciOiJIUzI1Ni')) {
    console.log('🔄 Local anon key is not in HS256 format. Re-signing locally using JWT_SECRET...');
    const jwtSecret = credentials.JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';
    
    const base64url = (str) => Buffer.from(str).toString('base64url');
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64url(JSON.stringify({ role: 'anon', iss: 'supabase', exp: 2096026924 }));
    const signature = crypto.createHmac('sha256', jwtSecret)
      .update(`${header}.${payload}`)
      .digest('base64url');
    
    anonKey = `${header}.${payload}.${signature}`;
  }

  if (!supabaseUrl || !anonKey) {
    console.error('❌ Error: Missing API_URL or ANON_KEY in parsed credentials.');
    process.exit(1);
  }

  console.log(`✅ Supabase Local URL: ${supabaseUrl}`);
  console.log('✅ Supabase Local Anon Key retrieved.');

  // 4. Create/Update .env.development
  const envPath = path.join(projectRoot, '.env.development');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Update or insert VITE_SUPABASE_URL
  if (envContent.includes('VITE_SUPABASE_URL=')) {
    envContent = envContent.replace(
      /VITE_SUPABASE_URL=.*/,
      `VITE_SUPABASE_URL=${supabaseUrl}`
    );
  } else {
    envContent += `\nVITE_SUPABASE_URL=${supabaseUrl}`;
  }

  // Update or insert VITE_SUPABASE_PUBLISHABLE_KEY
  if (envContent.includes('VITE_SUPABASE_PUBLISHABLE_KEY=')) {
    envContent = envContent.replace(
      /VITE_SUPABASE_PUBLISHABLE_KEY=.*/,
      `VITE_SUPABASE_PUBLISHABLE_KEY=${anonKey}`
    );
  } else {
    envContent += `\nVITE_SUPABASE_PUBLISHABLE_KEY=${anonKey}`;
  }

  envContent = envContent
    .replace(/^NEXT_PUBLIC_SUPABASE_URL=.*\n?/gm, '')
    .replace(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*\n?/gm, '');

  fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
  console.log('📝 .env.development created/updated successfully!');
  console.log('\n🎉 Setup complete! You can run the gestor app locally with local database.');
}

setup().catch(error => {
  console.error('❌ Setup failed with error:', error);
});
