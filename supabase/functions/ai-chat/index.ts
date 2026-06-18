import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.11.2'
import { captureEdgeException } from '../_shared/sentry.ts'
import { createServiceSupabase, enforceRateLimit, getClientIp } from '../_shared/rateLimit.ts'
import { getUserFromRequest, isValidUuid } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Configuração dos modelos disponíveis
// Lista de modelos para tentar em ordem de preferência
const MODELS = [
  'gemini-3.5-flash',          // Modelo mais novo, extremamente inteligente e rápido
  'gemini-2.5-flash',          // Modelo estável de alta performance
  'gemini-2.5-flash-lite',     // Modelo rápido e econômico
  'gemini-flash-latest',       // Modelo de fallback estável (Gemini 1.5 Flash)
]

// Função para estimar tokens baseado no texto
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

// Função para calcular custo em USD
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gemini-2.0-flash-exp': { input: 0, output: 0 },
    'gemini-1.5-pro-latest': { input: 1.25, output: 5.0 },
    'gemini-1.5-pro': { input: 1.25, output: 5.0 },
    'gemini-1.5-flash': { input: 0.075, output: 0.3 },
    'gemini-pro': { input: 0.5, output: 1.5 },
  }

  const modelPricing = pricing[model] || pricing['gemini-1.5-flash']

  const inputCost = (inputTokens / 1_000_000) * modelPricing.input
  const outputCost = (outputTokens / 1_000_000) * modelPricing.output

  return inputCost + outputCost
}

// Função para capturar evento no PostHog via HTTP API
async function capturePostHogEvent(
  distinctId: string,
  input: string,
  output: string,
  model: string,
  latency: number,
  traceId?: string,
  properties?: Record<string, any>,
) {
  const posthogApiKey = Deno.env.get('POSTHOG_API_KEY')
  const posthogHost = Deno.env.get('POSTHOG_HOST') || 'https://us.i.posthog.com'

  if (!posthogApiKey) {
    console.warn('PostHog API key não configurada - pulando tracking')
    return
  }

  const inputTokens = estimateTokens(input)
  const outputTokens = estimateTokens(output)
  const totalTokens = inputTokens + outputTokens
  const totalCost = calculateCost(inputTokens, outputTokens, model)

  try {
    const response = await fetch(`${posthogHost}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: posthogApiKey,
        event: '$ai_generation',
        distinct_id: distinctId,
        properties: {
          $ai_model: model,
          $ai_latency: latency,
          $ai_input: input,
          $ai_input_tokens: inputTokens,
          $ai_output_choices: [
            { message: { content: output, role: 'assistant' } },
          ],
          $ai_output_tokens: outputTokens,
          $ai_total_tokens: totalTokens,
          $ai_input_cost_usd: calculateCost(inputTokens, 0, model),
          $ai_output_cost_usd: calculateCost(0, outputTokens, model),
          $ai_total_cost_usd: totalCost,
          $ai_provider: 'google',
          $ai_timestamp: new Date().toISOString(),
          $ai_trace_id: traceId,
          source: 'edge_function',
          ...properties,
        },
      }),
    })

    if (!response.ok) {
      console.error(
        'Falha ao enviar evento para PostHog:',
        await response.text(),
      )
    } else {
      console.log('📊 PostHog event captured (edge function):', {
        model,
        latency: `${latency.toFixed(2)}s`,
        tokens: totalTokens,
        cost: `$${totalCost.toFixed(6)}`,
      })
    }
  } catch (error) {
    console.error('Erro ao capturar evento do PostHog:', error)
  }
}

// Função de busca de fallback quando a IA falha
function searchFallback(message: string, restaurantData: any): string {
  if (!restaurantData || !restaurantData.menu_items) {
    return 'Desculpe, não consigo acessar o cardápio no momento.'
  }

  const query = message.toLowerCase()
  // Remove pontuação e caracteres especiais, mantendo apenas letras, números e espaços
  const cleanQuery = query.replace(/[^\w\s\u00C0-\u00FF]/g, ' ')
  const keywords = cleanQuery.split(/\s+/).filter((w) => w.length > 3) // Ignora palavras curtas

  if (keywords.length === 0) {
    return 'Poderia repetir com mais detalhes o que você procura?'
  }

  const matches = restaurantData.menu_items.filter((item: any) => {
    const textToSearch =
      `${item.name} ${item.description} ${item.ingredients || ''}`.toLowerCase()
    // Verifica se alguma palavra-chave está presente
    return keywords.some((keyword) => textToSearch.includes(keyword))
  })

  if (matches.length > 0) {
    // Limitar a 3 sugestões
    const suggestions = matches.slice(0, 3).map((item: any) =>
      `*${item.name}* - ${item.description} (R$ ${item.price})`
    ).join('\n\n')

    return `A IA está temporariamente indisponível, mas encontrei estes pratos relacionados ao que você pediu:\n\n${suggestions}\n\nPosso ajudar com algo mais específico?`
  }

  return "A IA está indisponível no momento e não encontrei pratos exatos com esses termos. Tente buscar por ingredientes como 'camarão', 'carne' ou 'doce'."
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function validateMessage(message: unknown): string | null {
  if (typeof message !== 'string') return 'Message must be a string'
  const trimmed = message.trim()
  if (!trimmed) return 'Message is required'
  if (trimmed.length > 2000) return 'Message too long (max 2000 characters)'
  return null
}

function normalizeHistory(raw: unknown): any[] {
  if (!Array.isArray(raw)) return []

  return raw.slice(-20).flatMap((item) => {
    if (!item || typeof item !== 'object') return []

    const record = item as { role?: unknown; content?: unknown; parts?: unknown[] }
    let content = typeof record.content === 'string' ? record.content : ''

    if (!content && Array.isArray(record.parts)) {
      content = record.parts
        .map((part) => (part && typeof part === 'object' && 'text' in part ? String((part as { text?: unknown }).text ?? '') : ''))
        .filter(Boolean)
        .join('')
    }

    if (!content.trim()) return []

    const role = record.role === 'assistant' || record.role === 'model' ? 'model' : 'user'
    return [{ role, content }]
  })
}

async function loadRestaurantFromDb(
  supabase: ReturnType<typeof createServiceSupabase>,
  restaurantId: string,
) {
  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('id, name, slug, description, open, is_open_for_orders')
    .eq('id', restaurantId)
    .single()

  if (error || !restaurant || restaurant.open !== true || restaurant.is_open_for_orders !== true) {
    return null
  }

  const { data: dishes } = await supabase
    .from('dishes')
    .select('name, description, price, is_available')
    .eq('restaurant_id', restaurantId)
    .eq('is_available', true)
    .order('name')
    .limit(200)

  const menu_items = (dishes ?? []).map((d) => ({
    name: d.name,
    description: d.description ?? '',
    price: d.price,
  }))

  return { ...restaurant, menu_items }
}

function buildPublicRestaurantContext(restaurantData: {
  name?: string
  description?: string
  menu_items?: Array<{ name: string; description?: string; price?: unknown }>
}): string {
  return `
      Você é um assistente especializado em gastronomia para o restaurante "${restaurantData?.name || 'Restaurante'}".
      
      Informações do restaurante:
      - Nome: ${restaurantData?.name || 'N/A'}
      - Descrição: ${restaurantData?.description || 'N/A'}
      
      Cardápio disponível:
      ${
    restaurantData?.menu_items?.map(
      (item) => `- ${item.name}: ${item.description || ''} (R$ ${item.price})`,
    ).join('\n') || 'Nenhum item disponível'
  }
      
      Instruções:
      1. Responda de forma amigável e útil sobre os pratos do restaurante
      2. Ajude os clientes a escolherem pratos baseado em suas preferências
      3. Forneça informações sobre ingredientes, sabores e combinações
      4. Seja específico sobre preços e disponibilidade
      5. Responda em português brasileiro
      6. Mantenha as respostas concisas mas informativas
      7. Quando mencionar pratos específicos, use exatamente os nomes do cardápio
    `
}

// Função para retry com backoff exponencial
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Se é o último attempt ou não é um erro de sobrecarga, não tenta novamente
      if (attempt === maxRetries || !error.message?.includes('overloaded')) {
        throw error
      }

      // Aguarda com backoff exponencial
      const delay = baseDelay * Math.pow(2, attempt)
      console.log(
        `Tentativa ${
          attempt + 1
        } falhou, aguardando ${delay}ms antes da próxima tentativa...`,
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

// Função para tentar diferentes modelos em caso de falha
async function tryModelWithFallback(
  genAI: GoogleGenerativeAI,
  message: string,
  restaurantContext: string,
  chatHistory: any[],
  distinctId: string,
  traceId?: string,
  properties?: Record<string, any>,
  restaurantData?: any, // Adicionado para fallback
): Promise<{ result: any; modelName: string }> {
  let lastError: any = null

  // Usar diretamente o array MODELS
  for (const modelName of MODELS) {
    const startTime = Date.now()

    try {
      console.log(`Tentando modelo: ${modelName}`)

      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      })

      const chat = model.startChat({
        history: chatHistory?.map((msg: any) => ({
          role: msg.role === 'assistant' ? 'model' : msg.role,
          parts: [{ text: msg.content }],
        })) || [],
      })

      const fullMessage = `${restaurantContext}\n\nCliente: ${message}`
      const result = await chat.sendMessage(fullMessage)
      const response = await result.response
      const text = response.text()

      const endTime = Date.now()
      const latency = (endTime - startTime) / 1000 // Segundos

      console.log(`Modelo ${modelName} funcionou com sucesso`)

      // Capturar evento no PostHog
      await capturePostHogEvent(
        distinctId,
        fullMessage,
        text,
        modelName,
        latency,
        traceId,
        properties,
      )

      return { result, modelName }
    } catch (error) {
      console.log(`Modelo ${modelName} falhou:`, (error as Error).message)
      lastError = error
      // Continua para o próximo modelo
      continue
    }
  }

  // Se todos os modelos falharem, usar fallback de busca
  console.log('Todos os modelos falharam, ativando fallback de busca local')
  const fallbackText = searchFallback(message, restaurantData)

  // Retorna um objeto que imita a resposta do Gemini para compatibilidade
  return {
    result: {
      response: {
        text: () => fallbackText,
      },
    },
    modelName: 'local-search-fallback',
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let body: Record<string, unknown> = {}

  try {
    const supabase = createServiceSupabase()
    const clientIp = getClientIp(req)

    const ipLimitResponse = await enforceRateLimit(supabase, 'ai-chat:ip', clientIp, 20, 60)
    if (ipLimitResponse) {
      return new Response(ipLimitResponse.body, {
        status: ipLimitResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    body = await req.json()
    const {
      message,
      restaurant_id,
      restaurantData: _clientRestaurantData,
      chatHistory,
      history,
      systemInstruction,
      distinct_id,
      trace_id,
    } = body as {
      message?: unknown
      restaurant_id?: unknown
      restaurantData?: unknown
      chatHistory?: unknown
      history?: unknown
      systemInstruction?: unknown
      distinct_id?: unknown
      trace_id?: unknown
    }

    const messageError = validateMessage(message)
    if (messageError) {
      return jsonResponse({ error: messageError }, 400)
    }

    const normalizedMessage = (message as string).trim()
    const normalizedHistory = normalizeHistory(chatHistory ?? history)

    const authUser = await getUserFromRequest(req)
    let restaurantContext: string
    let restaurantDataForFallback: Record<string, unknown> | null = null
    let trackingProps: Record<string, unknown> = {
      message_length: normalizedMessage.length,
      history_length: normalizedHistory.length,
    }

    if (authUser) {
      const userLimitResponse = await enforceRateLimit(
        supabase,
        'ai-chat:user',
        authUser.userId,
        60,
        60,
      )
      if (userLimitResponse) {
        return new Response(userLimitResponse.body, {
          status: userLimitResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (typeof systemInstruction === 'string' && systemInstruction.length > 4000) {
        return jsonResponse({ error: 'systemInstruction too long' }, 400)
      }

      restaurantContext = typeof systemInstruction === 'string' && systemInstruction.trim()
        ? systemInstruction.trim()
        : 'Você é um assistente útil para gestores de restaurantes. Responda em português brasileiro de forma concisa.'
      trackingProps = { ...trackingProps, profile: 'manager', user_id: authUser.userId }
    } else {
      if (!isValidUuid(restaurant_id)) {
        return jsonResponse({ error: 'restaurant_id is required for public chat' }, 403)
      }

      const restaurantLimitResponse = await enforceRateLimit(
        supabase,
        'ai-chat:restaurant',
        `${clientIp}:${restaurant_id}`,
        20,
        60,
      )
      if (restaurantLimitResponse) {
        return new Response(restaurantLimitResponse.body, {
          status: restaurantLimitResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const loadedRestaurant = await loadRestaurantFromDb(supabase, restaurant_id)
      if (!loadedRestaurant) {
        return jsonResponse({ error: 'Restaurant not found or not accepting orders' }, 403)
      }

      restaurantDataForFallback = loadedRestaurant
      restaurantContext = buildPublicRestaurantContext(loadedRestaurant)
      trackingProps = {
        ...trackingProps,
        profile: 'public_menu',
        restaurant_id,
        restaurant_name: loadedRestaurant.name,
        restaurant_slug: loadedRestaurant.slug,
      }
    }

    // Verificar se a API key está configurada
    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    if (!apiKey) {
      const fallbackText = searchFallback(normalizedMessage, restaurantDataForFallback ?? _clientRestaurantData)
      return jsonResponse({
        message: fallbackText,
        timestamp: new Date().toISOString(),
        model: 'local-search-no-key',
      }, 200)
    }

    const genAI = new GoogleGenerativeAI(apiKey)

    const { result, modelName } = await tryModelWithFallback(
      genAI,
      normalizedMessage,
      restaurantContext,
      normalizedHistory,
      typeof distinct_id === 'string' ? distinct_id : (authUser?.userId ?? 'anonymous'),
      typeof trace_id === 'string' ? trace_id : undefined,
      trackingProps,
      restaurantDataForFallback ?? _clientRestaurantData,
    )

    const response = await result.response
    const text = response.text()

    return jsonResponse({
      message: text,
      response: text,
      timestamp: new Date().toISOString(),
      model: modelName,
    }, 200)
  } catch (error) {
    console.error('Erro na Edge Function:', error)
    await captureEdgeException(error, {
      functionName: 'ai-chat',
      tags: { handled_with_fallback: 'true' },
    })

    const fallbackText = searchFallback(
      typeof body.message === 'string' ? body.message : '',
      body.restaurantData ?? {},
    )

    return jsonResponse({
      message: fallbackText,
      model: 'local-search-error',
      timestamp: new Date().toISOString(),
    }, 200)
  }
})

