# 🚀 Configuração do Supabase Local

Este guia te ajudará a configurar e executar o Supabase localmente para desenvolvimento.

## 📋 Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e rodando
- [Supabase CLI](https://supabase.com/docs/guides/cli) instalado
- macOS (este guia foi testado no macOS)

## 🛠️ Instalação

### 1. Docker Desktop
```bash
brew install --cask docker
```
Após a instalação, abra o Docker Desktop e aguarde inicializar.

### 2. Supabase CLI
```bash
brew install supabase/tap/supabase
```

## 🚀 Primeira Execução

### 1. Iniciar o Supabase Local
```bash
# Usar o script automatizado (recomendado)
./scripts/supabase-local.sh start

# Ou manualmente
supabase start
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo de exemplo e configure suas variáveis:
```bash
cp env.local.example .env.local
```

Edite o `.env.local` com as credenciais locais:
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

## 📊 Acessos

Após iniciar o Supabase local, você terá acesso a:

- **Dashboard**: http://localhost:54323
- **API**: http://127.0.0.1:54321
- **Database**: postgresql://postgres:postgres@127.0.0.1:54322/postgres

## 🎯 Comandos Úteis

### Script Automatizado
```bash
# Iniciar
./scripts/supabase-local.sh start

# Parar
./scripts/supabase-local.sh stop

# Ver status
./scripts/supabase-local.sh status

# Ver logs
./scripts/supabase-local.sh logs

# Resetar banco (⚠️ CUIDADO!)
./scripts/supabase-local.sh reset
```

### Comandos Manuais
```bash
# Iniciar
supabase start

# Parar
supabase stop

# Status
supabase status

# Logs
supabase logs

# Resetar banco
supabase db reset
```

## 🗄️ Banco de Dados

### Credenciais Padrão
- **Host**: 127.0.0.1
- **Port**: 54322
- **Database**: postgres
- **User**: postgres
- **Password**: postgres

### Aplicar Migrações
```bash
# Aplicar todas as migrações
supabase db reset

# Ou aplicar migrações específicas
supabase db push
```

## 🔧 Configuração

### Arquivo de Configuração
O arquivo `supabase/config.local.toml` contém as configurações locais:
- Portas dos serviços
- Configurações de autenticação
- Configurações de storage
- Configurações de email

### Personalização
Você pode editar o `supabase/config.local.toml` para:
- Alterar portas
- Configurar provedores de autenticação externa
- Ajustar limites de upload
- Configurar email

## 🚨 Solução de Problemas

### Docker não está rodando
```bash
# Verificar status do Docker
docker info

# Se não estiver rodando, abra o Docker Desktop
open /Applications/Docker.app
```

### Porta já em uso
```bash
# Verificar portas em uso
lsof -i :54321
lsof -i :54322
lsof -i :54323

# Parar serviços conflitantes ou alterar portas no config.local.toml
```

### Erro de permissão
```bash
# Verificar permissões do script
chmod +x scripts/supabase-local.sh
```

### Resetar tudo
```bash
# Parar e remover todos os containers
supabase stop
docker system prune -a

# Iniciar novamente
supabase start
```

## 📱 Desenvolvimento

### 1. Iniciar o Supabase Local
```bash
./scripts/supabase-local.sh start
```

### 2. Iniciar o Frontend
```bash
npm run dev
```

### 3. Acessar a aplicação
- **Frontend**: http://localhost:5173
- **Supabase Dashboard**: http://localhost:54323

## 🔄 Migrações

### Estrutura das Migrações
```
supabase/
├── migrations/
│   ├── 20250801000001_initial_schema.sql
│   ├── 20250807114201_*.sql
│   └── ...
```

### Aplicar Migrações
```bash
# Aplicar todas as migrações
supabase db reset

# Ver histórico
supabase migration list

# Criar nova migração
supabase migration new nome_da_migracao
```

## 🎉 Próximos Passos

1. ✅ Configure o Supabase local
2. 🔄 Aplique as migrações existentes
3. 🚀 Inicie o desenvolvimento
4. 📊 Use o dashboard local para gerenciar dados
5. 🔐 Teste autenticação localmente

## 📚 Recursos Adicionais

- [Documentação Oficial do Supabase](https://supabase.com/docs)
- [CLI Reference](https://supabase.com/docs/reference/cli)
- [Local Development](https://supabase.com/docs/guides/getting-started/local-development)

---

**💡 Dica**: Mantenha o Docker Desktop rodando sempre que for usar o Supabase local!
