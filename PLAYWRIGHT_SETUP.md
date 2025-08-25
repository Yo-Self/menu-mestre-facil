# 🚀 Configuração do Playwright para Desenvolvimento

Este projeto implementa uma solução híbrida que usa **Playwright** (navegador headless real) em desenvolvimento local e **Cheerio** (parsing HTML estático) em produção.

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Acesso à internet para baixar o Chromium

## 🔧 Instalação

### 1. Instalar Dependências

```bash
npm install
```

### 2. Instalar Playwright e Chromium

```bash
npm run playwright:install
```

Este comando baixa o navegador Chromium necessário para o Playwright funcionar.

### 3. Verificar Instalação

```bash
npm run playwright:test
```

## 🎯 Como Funciona

### Modo Desenvolvimento (Local)
- ✅ **Playwright Real**: Usa um navegador Chromium real
- ✅ **JavaScript Executado**: Carrega páginas completas com JS
- ✅ **Interações Simuladas**: Clica em botões, rola a página
- ✅ **Menu Completo**: Extrai categorias e pratos reais
- ✅ **Dados Reais**: Preços, descrições, imagens

### Modo Produção (Edge Function)
- ✅ **Cheerio**: Parsing HTML estático
- ✅ **Múltiplas Estratégias**: 7 métodos diferentes de extração
- ✅ **Headers Avançados**: Simula navegador real
- ✅ **Fallbacks Robustos**: Múltiplas tentativas
- ⚠️ **Limitações**: Menu pode não estar completo devido às proteções do iFood

## 🔍 Detecção Automática

O sistema detecta automaticamente o ambiente:

```typescript
function isDevelopment(): boolean {
  return Deno.env.get('ENVIRONMENT') === 'development' || 
         Deno.env.get('NODE_ENV') === 'development' ||
         Deno.env.get('SUPABASE_ENV') === 'local';
}
```

## 🚀 Uso em Desenvolvimento

### 1. Configurar Variáveis de Ambiente

Crie um arquivo `.env.local`:

```bash
ENVIRONMENT=development
NODE_ENV=development
SUPABASE_ENV=local
```

### 2. Executar Localmente

```bash
# Iniciar o projeto
npm run dev

# Em outro terminal, testar o scraper
npm run playwright:test "https://www.ifood.com.br/delivery/..."
```

### 3. Testar a Edge Function

```bash
# Em desenvolvimento, a edge function usará Playwright automaticamente
curl -X POST "http://localhost:54321/functions/v1/scrape-ifood" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.ifood.com.br/delivery/..."}'
```

## 🛠️ Estrutura dos Arquivos

```
├── supabase/functions/scrape-ifood/
│   └── index.ts              # Edge function principal
├── scripts/
│   └── playwright-scraper.js # Script Playwright local
├── package.json              # Dependências
└── PLAYWRIGHT_SETUP.md       # Este arquivo
```

## 🔧 Configuração do Playwright

O script `playwright-scraper.js` inclui:

- **Navegador Headless**: Chromium sem interface gráfica
- **User-Agent Real**: Simula navegador Chrome real
- **Headers Avançados**: Inclui headers de segurança
- **Interações Simuladas**: Clica em botões de expansão
- **Scroll da Página**: Carrega conteúdo lazy
- **Timeout Configurável**: 30 segundos para carregamento
- **Tratamento de Erros**: Fallbacks robustos

## 📊 Comparação de Resultados

### Com Playwright (Desenvolvimento)
```json
{
  "restaurant_name": "Restaurante Manaira",
  "menu_items": [
    {
      "name": "X-Burger",
      "description": "Hambúrguer com queijo e salada",
      "price": "R$ 25,90",
      "image": "https://...",
      "category": "Lanches"
    }
  ],
  "extraction_method": "playwright_real_browser"
}
```

### Com Cheerio (Produção)
```json
{
  "restaurant_name": "Restaurante Manaira",
  "menu_items": [],
  "extraction_method": "menu_not_found",
  "warning": "Não foi possível extrair o cardápio..."
}
```

## ⚠️ Considerações Importantes

### 1. **Termos de Uso**
- Verifique se o scraping é permitido pelo iFood
- Respeite rate limits e políticas da plataforma
- Use apenas para desenvolvimento e testes

### 2. **Performance**
- Playwright é mais lento (10-30 segundos)
- Requer mais recursos (memória, CPU)
- Ideal apenas para desenvolvimento

### 3. **Manutenção**
- Seletores CSS podem mudar
- Estrutura do iFood pode evoluir
- Atualize regularmente os seletores

## 🚨 Solução de Problemas

### Erro: "Playwright not found"
```bash
npm run playwright:install
```

### Erro: "Chromium download failed"
```bash
# Limpar cache e reinstalar
npx playwright install --force chromium
```

### Erro: "Permission denied"
```bash
# Dar permissão de execução
chmod +x scripts/playwright-scraper.js
```

### Erro: "Timeout exceeded"
- Aumente o timeout no script
- Verifique a conexão com a internet
- O iFood pode estar bloqueando

## 🔄 Atualizações

### 1. Atualizar Playwright
```bash
npm update playwright
npx playwright install chromium
```

### 2. Atualizar Seletores
- Monitore mudanças no iFood
- Atualize os seletores CSS no script
- Teste regularmente

### 3. Atualizar Edge Function
```bash
cd supabase
supabase functions deploy scrape-ifood
```

## 📝 Logs e Debug

### Habilitar Logs Detalhados
```typescript
// No script Playwright
console.log('Navegando para:', url);
console.log('Dados extraídos:', scrapedData);
```

### Verificar Console do Navegador
```typescript
// Capturar logs do console
page.on('console', msg => console.log('Browser:', msg.text()));
```

## 🎉 Conclusão

Esta solução oferece o **melhor dos dois mundos**:

- **Desenvolvimento**: Playwright real para extração completa
- **Produção**: Cheerio robusto para estabilidade
- **Detecção Automática**: Sem configuração manual
- **Fallbacks Múltiplos**: Múltiplas estratégias de extração

Para desenvolvimento, você terá acesso ao menu completo do iFood. Para produção, a edge function tentará extrair o máximo possível usando as melhores práticas de scraping web.
