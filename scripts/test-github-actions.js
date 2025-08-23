#!/usr/bin/env node

console.log('🔧 Testando variáveis de ambiente no GitHub Actions...');

// Verificar variáveis específicas
const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'TINYPNG_API_KEY',
  'NODE_ENV'
];

console.log('📋 Variáveis específicas necessárias:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (varName.includes('KEY') || varName.includes('URL')) {
    console.log(`  ${varName}: ${value ? '✓' : '✗'}`);
  } else {
    console.log(`  ${varName}: ${value || 'não definido'}`);
  }
});

// Verificar se as variáveis estão definidas
const missingVars = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.log(`\n❌ Variáveis faltando: ${missingVars.join(', ')}`);
} else {
  console.log('\n✅ Todas as variáveis necessárias estão definidas');
}

// Verificar se as variáveis têm valores válidos
console.log('\n🔍 Verificação de valores:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    if (varName.includes('KEY') || varName.includes('URL')) {
      console.log(`  ${varName}: ${value.substring(0, 10)}... (${value.length} chars)`);
    } else {
      console.log(`  ${varName}: ${value}`);
    }
  } else {
    console.log(`  ${varName}: não definido`);
  }
});
