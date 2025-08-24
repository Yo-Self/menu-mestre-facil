-- Migration: create_import_system
-- Description: Create import_logs table and import_status ENUM for MenuDino import system
-- Epic: 1 - Backend Core - Processamento Assíncrono da Importação
-- Story: 1.1 - Configuração da Infraestrutura da Base de Dados

-- Create ENUM for import status
CREATE TYPE public.import_status AS ENUM (
  'scraping',           -- A extração de dados está em andamento
  'processing',         -- Os dados estão a ser validados
  'preview_ready',      -- Os dados estão prontos para visualização
  'importing',          -- A importação final está a decorrer
  'import_success',     -- Importação concluída com sucesso
  'import_failed',      -- Erro durante a importação final
  'scraping_failed',    -- Erro durante a extração de dados
  'processing_failed',  -- Erro durante a validação dos dados
  'cancelled'           -- O utilizador cancelou o processo
);

-- Create import_logs table
CREATE TABLE public.import_logs (
  -- Identificação
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  
  -- Metadados básicos
  url text NOT NULL,
  status public.import_status NOT NULL DEFAULT 'scraping',
  source text NOT NULL DEFAULT 'menudino',
  
  -- Dados extraídos (completos para preview)
  scraped_data jsonb,
  
  -- Metadados de processamento
  error_message text,
  duration_ms integer,
  items_processed integer DEFAULT 0,
  items_total integer DEFAULT 0,
  categories_count integer DEFAULT 0,
  dishes_count integer DEFAULT 0,
  complements_count integer DEFAULT 0,
  
  -- Campos de auditoria
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Campos para controle de estado
  started_at timestamptz,
  completed_at timestamptz,
  retry_count integer DEFAULT 0
);

-- Create indexes for better performance
CREATE INDEX idx_import_logs_user_id ON public.import_logs(user_id);
CREATE INDEX idx_import_logs_status ON public.import_logs(status);
CREATE INDEX idx_import_logs_url ON public.import_logs(url);
CREATE INDEX idx_import_logs_created_at ON public.import_logs(created_at);
CREATE INDEX idx_import_logs_user_url ON public.import_logs(user_id, url);

-- Enable Row Level Security
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for import_logs
-- Users can only access their own import logs
CREATE POLICY "Users can view their own import logs" 
ON public.import_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own import logs" 
ON public.import_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own import logs" 
ON public.import_logs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own import logs" 
ON public.import_logs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_import_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_import_logs_updated_at
  BEFORE UPDATE ON public.import_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_import_logs_updated_at();

-- Create function to automatically set started_at and completed_at
CREATE OR REPLACE FUNCTION public.set_import_logs_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Set started_at when status changes to scraping
  IF NEW.status = 'scraping' AND OLD.status != 'scraping' THEN
    NEW.started_at = now();
  END IF;
  
  -- Set completed_at when status is final
  IF NEW.status IN ('import_success', 'import_failed', 'scraping_failed', 'processing_failed', 'cancelled') THEN
    NEW.completed_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set started_at and completed_at
CREATE TRIGGER set_import_logs_timestamps
  BEFORE UPDATE ON public.import_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_import_logs_timestamps();

-- Add comments for documentation
COMMENT ON TABLE public.import_logs IS 'Tabela para armazenar logs de importação de menus do MenuDino';
COMMENT ON COLUMN public.import_logs.id IS 'Identificador único do log de importação';
COMMENT ON COLUMN public.import_logs.user_id IS 'ID do usuário que iniciou a importação';
COMMENT ON COLUMN public.import_logs.restaurant_id IS 'ID do restaurante criado (se aplicável)';
COMMENT ON COLUMN public.import_logs.url IS 'URL do MenuDino sendo importada';
COMMENT ON COLUMN public.import_logs.status IS 'Status atual do processo de importação';
COMMENT ON COLUMN public.import_logs.source IS 'Fonte dos dados (menudino, etc.)';
COMMENT ON COLUMN public.import_logs.scraped_data IS 'Dados extraídos e estruturados do MenuDino';
COMMENT ON COLUMN public.import_logs.error_message IS 'Mensagem de erro em caso de falha';
COMMENT ON COLUMN public.import_logs.duration_ms IS 'Duração total do processo em milissegundos';
COMMENT ON COLUMN public.import_logs.items_processed IS 'Número de itens processados com sucesso';
COMMENT ON COLUMN public.import_logs.items_total IS 'Número total de itens encontrados';
COMMENT ON COLUMN public.import_logs.categories_count IS 'Número de categorias extraídas';
COMMENT ON COLUMN public.import_logs.dishes_count IS 'Número de pratos extraídos';
COMMENT ON COLUMN public.import_logs.complements_count IS 'Número de complementos extraídos';
COMMENT ON COLUMN public.import_logs.metadata IS 'Metadados adicionais do processo';
COMMENT ON COLUMN public.import_logs.started_at IS 'Timestamp de início do processo';
COMMENT ON COLUMN public.import_logs.completed_at IS 'Timestamp de conclusão do processo';
COMMENT ON COLUMN public.import_logs.retry_count IS 'Número de tentativas realizadas';

COMMENT ON TYPE public.import_status IS 'Enum para os possíveis estados de uma importação';
