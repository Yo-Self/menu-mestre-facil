import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { importLogs, importStatusEnum } from './schema.ts';

// Configuração da conexão com o banco
const connectionString = Deno.env.get('SUPABASE_DB_URL') ?? 
  Deno.env.get('DATABASE_URL') ?? 
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

// Cliente Postgres
const client = postgres(connectionString, { 
  max: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 30 
});

// Cliente Drizzle
export const db = drizzle(client);

// Exportar as tabelas para uso
export { importLogs, importStatusEnum };

// Função para fechar a conexão (útil para cleanup)
export async function closeConnection() {
  await client.end();
}
