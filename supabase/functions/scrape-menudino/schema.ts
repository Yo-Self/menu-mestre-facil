import { pgTable, uuid, text, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';

// Enum para os status de importação
export const importStatusEnum = pgEnum('import_status', [
  'scraping',
  'processing', 
  'preview_ready',
  'importing',
  'import_success',
  'import_failed',
  'scraping_failed',
  'processing_failed',
  'cancelled'
]);

// Tabela import_logs
export const importLogs = pgTable('import_logs', {
  // Identificação
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
  restaurantId: uuid('restaurant_id').references(() => restaurants.id, { onDelete: 'set null' }),
  
  // Metadados básicos
  url: text('url').notNull(),
  status: importStatusEnum('status').notNull(),
  source: text('source').notNull().default('menudino'),
  
  // Dados extraídos (completos para preview)
  scrapedData: jsonb('scraped_data'),
  
  // Metadados de processamento
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms'),
  itemsProcessed: integer('items_processed').default(0),
  itemsTotal: integer('items_total').default(0),
  categoriesCount: integer('categories_count').default(0),
  dishesCount: integer('dishes_count').default(0),
  complementsCount: integer('complements_count').default(0),
  
  // Campos de auditoria
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  
  // Campos para controle de estado
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  retryCount: integer('retry_count').default(0)
});

// Tabelas de referência (para as foreign keys)
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey()
});

export const restaurants = pgTable('restaurants', {
  id: uuid('id').primaryKey()
});

// Tipos TypeScript
export type ImportLog = typeof importLogs.$inferSelect;
export type NewImportLog = typeof importLogs.$inferInsert;
export type ImportStatus = typeof importStatusEnum.enumValues[number];
