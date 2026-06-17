import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { GoogleGenerativeAI } from "npm:@google/generative-ai@^0.21.0"
import { captureEdgeException } from '../_shared/sentry.ts'
import { capturePostHogAiGeneration } from '../_shared/posthog-llm.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DishAnalysisResult {
  name: string
  description: string
  category: string
  suggested_price: number
  confidence: number
}

const VISION_MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
]

function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.endsWith('.supabase.co')) return false
    return (
      parsed.pathname.includes('/storage/v1/object/public/images/') ||
      parsed.pathname.includes('/storage/v1/render/image/public/images/')
    )
  } catch {
    return false
  }
}

function parseAnalysisJson(text: string): DishAnalysisResult | null {
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned)
    if (
      typeof parsed.name === 'string' &&
      typeof parsed.description === 'string' &&
      typeof parsed.category === 'string'
    ) {
      return {
        name: parsed.name.trim(),
        description: parsed.description.trim(),
        category: parsed.category.trim() || 'Geral',
        suggested_price: Number(parsed.suggested_price) || 0,
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      }
    }
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (typeof parsed.name === 'string') {
          return {
            name: parsed.name.trim(),
            description: String(parsed.description || '').trim(),
            category: String(parsed.category || 'Geral').trim(),
            suggested_price: Number(parsed.suggested_price) || 0,
            confidence: Number(parsed.confidence) || 0.5,
          }
        }
      } catch {
        // fall through
      }
    }
  }
  return null
}

async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  if (!isAllowedImageUrl(imageUrl)) {
    throw new Error('URL de imagem não permitida. Use apenas imagens do storage do projeto.')
  }

  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Não foi possível baixar a imagem: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return {
    data: btoa(binary),
    mimeType: contentType.split(';')[0],
  }
}

async function analyzeWithVision(
  genAI: GoogleGenerativeAI,
  imageUrl: string,
  cuisineType?: string,
  existingCategories?: string[]
): Promise<{ result: DishAnalysisResult; model: string }> {
  const { data, mimeType } = await fetchImageAsBase64(imageUrl)

  const categoryHint =
    existingCategories && existingCategories.length > 0
      ? `Categorias já existentes no cardápio: ${existingCategories.join(', ')}. Prefira reutilizar uma delas quando fizer sentido.`
      : ''

  const prompt = `Analise esta foto de um prato de restaurante brasileiro.
Tipo de cozinha do restaurante: ${cuisineType || 'Geral'}.
${categoryHint}

Retorne APENAS um JSON válido (sem markdown) com esta estrutura exata:
{
  "name": "nome do prato em português",
  "description": "descrição curta e apetitosa em português (1-2 frases)",
  "category": "categoria sugerida em português",
  "suggested_price": 0.00,
  "confidence": 0.85
}

Regras:
- suggested_price em reais (BRL), valor realista para restaurante no Brasil
- confidence entre 0 e 1
- Se não reconhecer o prato, sugira um nome genérico baseado na aparência`

  let lastError: Error | null = null

  for (const modelName of VISION_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const response = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType, data } },
      ])

      const text = response.response.text()
      const result = parseAnalysisJson(text)
      if (!result) {
        throw new Error('Resposta da IA não é JSON válido')
      }

      return { result, model: modelName }
    } catch (error) {
      lastError = error as Error
      console.error(`Modelo ${modelName} falhou:`, lastError.message)
    }
  }

  throw lastError || new Error('Todos os modelos de visão falharam')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set')
    }

    const body = await req.json()
    const { image_url, cuisine_type, existing_categories, distinct_id } = body

    if (!image_url || typeof image_url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'image_url é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!isAllowedImageUrl(image_url)) {
      return new Response(
        JSON.stringify({ error: 'URL de imagem não permitida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const startedAt = Date.now()

    const { result, model } = await analyzeWithVision(
      genAI,
      image_url,
      cuisine_type,
      Array.isArray(existing_categories) ? existing_categories : undefined
    )

    const latencyMs = Date.now() - startedAt
    await capturePostHogAiGeneration({
      distinctId: typeof distinct_id === 'string' ? distinct_id : 'onboarding-anonymous',
      input: `analyze-dish: ${image_url}`,
      output: JSON.stringify(result),
      model,
      latencyMs,
      properties: {
        feature: 'onboarding_menu',
        cuisine_type: cuisine_type || null,
      },
    })

    return new Response(
      JSON.stringify({ result, model, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro em ai-analyze-dish:', error)
    await captureEdgeException(error, { functionName: 'ai-analyze-dish' })

    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage, timestamp: new Date().toISOString() }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
