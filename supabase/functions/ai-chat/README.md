# AI Chat Edge Function

Função Edge para integração com Google Gemini AI.

## Configuração

### 1. Variáveis de Ambiente

Configure no Supabase Dashboard ou via CLI:

```bash
supabase secrets set GOOGLE_AI_API_KEY=your_api_key_here
```

Para obter uma API key do Google AI:
1. Acesse: https://makersuite.google.com/app/apikey
2. Crie uma nova API key
3. Configure no Supabase

### 2. Deploy

```bash
supabase functions deploy ai-chat
```

## Recursos

### ✅ Modelos Suportados

A função tenta usar os modelos nesta ordem (com fallback automático):

1. **`gemini-1.5-flash-8b`** - Menor e mais rápido (FREE, ideal para alto volume)
2. **`gemini-1.5-flash`** - Rápido e eficiente (FREE, recomendado)

**Todos os modelos são GRATUITOS no Free Tier!**

> **Nota**: O modelo `gemini-1.5-pro` foi temporariamente removido devido a incompatibilidade com a versão atual da API. Será adicionado quando disponível.

### ✅ Funcionalidades

- ✅ Retry automático com exponential backoff
- ✅ Fallback entre modelos em caso de erro
- ✅ Suporte a histórico de conversação
- ✅ Suporte a instruções do sistema (system instructions)
- ✅ CORS habilitado
- ✅ Rate limiting handling
- ✅ Quota exceeded handling

## Uso

### Requisição Básica

```bash
curl -i --location --request POST 'https://YOUR_PROJECT.supabase.co/functions/v1/ai-chat' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "message": "Olá, como você pode me ajudar?"
  }'
```

### Com Histórico de Conversação

```bash
curl -i --location --request POST 'https://YOUR_PROJECT.supabase.co/functions/v1/ai-chat' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "message": "E sobre preços?",
    "history": [
      {
        "role": "user",
        "parts": [{"text": "Me fale sobre seu restaurante"}]
      },
      {
        "role": "model",
        "parts": [{"text": "Nosso restaurante oferece..."}]
      }
    ]
  }'
```

### Com System Instruction

```bash
curl -i --location --request POST 'https://YOUR_PROJECT.supabase.co/functions/v1/ai-chat' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "message": "Qual o prato do dia?",
    "systemInstruction": "Você é um assistente de um restaurante brasileiro. Seja sempre cordial e responda em português."
  }'
```

## Resposta

### Sucesso (200)

```json
{
  "response": "Olá! Posso ajudá-lo com informações sobre...",
  "model": "gemini-1.5-flash-8b",
  "timestamp": "2025-10-14T17:55:15.101Z"
}
```

### Erro (400)

```json
{
  "error": "Message is required"
}
```

### Erro (500)

```json
{
  "error": "All models failed. Last error: ...",
  "timestamp": "2025-10-14T17:55:15.101Z"
}
```

## Teste Local

```bash
# 1. Inicie o Supabase local
supabase start

# 2. Configure a API key localmente
supabase secrets set GOOGLE_AI_API_KEY=your_api_key_here --local

# 3. Teste a função
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/ai-chat' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  --header 'Content-Type: application/json' \
  --data '{"message":"Hello!"}'
```

## Logs

Ver logs em tempo real:

```bash
supabase functions logs ai-chat --follow
```

## Troubleshooting

### Erro: "GOOGLE_AI_API_KEY environment variable is not set"

**Solução:** Configure a API key:
```bash
supabase secrets set GOOGLE_AI_API_KEY=your_key
```

### Erro: "models/gemini-pro is not found"

**Solução:** Este código já usa os modelos corretos (`gemini-1.5-flash`, etc). Se você ver este erro, certifique-se de fazer o deploy desta versão atualizada.

### Erro: "Rate limit exceeded" (429)

**Solução:** A função tem retry automático e fallback entre modelos. Se persistir:
- Verifique seus limites na Google AI Console
- Considere upgrade do plano da API
- Implemente rate limiting no lado do cliente

### Erro: "Quota exceeded"

**Solução:** A função tentará usar modelos alternativos automaticamente. Para resolver permanentemente:
- Verifique quota na Google AI Console
- Aguarde o reset da quota (geralmente diário)
- Considere upgrade do plano

## Performance

- **Tempo médio de resposta:** 1-3 segundos
- **Rate limit:** Depende do plano da Google AI API
- **Timeout:** 60 segundos (padrão Supabase Edge Functions)

## Segurança

- ✅ CORS configurado para permitir requisições do frontend
- ✅ API key armazenada como secret (não exposta)
- ✅ Autenticação via Supabase Auth (header Authorization)
- ⚠️  Implemente validação adicional conforme necessário

## Atualizações

### v1.0 (2025-10-14)
- ✅ Corrigido erro com modelo `gemini-pro` depreciado
- ✅ Adicionado suporte para `gemini-1.5-flash` (padrão)
- ✅ Adicionado fallback automático entre modelos
- ✅ Adicionado retry com exponential backoff
- ✅ Melhorado tratamento de erros
- ✅ Adicionado suporte para system instructions
