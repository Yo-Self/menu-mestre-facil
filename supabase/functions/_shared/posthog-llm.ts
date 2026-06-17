/**
 * PostHog LLM analytics for Supabase Edge Functions (Deno).
 * Sends $ai_generation events via the HTTP capture API.
 */

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

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
    'gemini-2.5-flash': { input: 0.075, output: 0.3 },
    'gemini-pro': { input: 0.5, output: 1.5 },
  }

  const modelPricing = pricing[model] || pricing['gemini-1.5-flash']
  const inputCost = (inputTokens / 1_000_000) * modelPricing.input
  const outputCost = (outputTokens / 1_000_000) * modelPricing.output
  return inputCost + outputCost
}

export async function capturePostHogAiGeneration(options: {
  distinctId: string
  input: string
  output: string
  model: string
  latencyMs: number
  traceId?: string
  properties?: Record<string, unknown>
}): Promise<void> {
  const posthogApiKey = Deno.env.get('POSTHOG_API_KEY')
  const posthogHost = Deno.env.get('POSTHOG_HOST') || 'https://us.i.posthog.com'

  if (!posthogApiKey) {
    console.warn('PostHog API key não configurada — pulando LLM tracking')
    return
  }

  const inputTokens = estimateTokens(options.input)
  const outputTokens = estimateTokens(options.output)
  const totalTokens = inputTokens + outputTokens
  const totalCost = calculateCost(inputTokens, outputTokens, options.model)
  const latencySec = options.latencyMs / 1000

  try {
    const response = await fetch(`${posthogHost}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: posthogApiKey,
        event: '$ai_generation',
        distinct_id: options.distinctId,
        properties: {
          $ai_model: options.model,
          $ai_latency: latencySec,
          $ai_input: options.input,
          $ai_input_tokens: inputTokens,
          $ai_output_choices: [
            { message: { content: options.output, role: 'assistant' } },
          ],
          $ai_output_tokens: outputTokens,
          $ai_total_tokens: totalTokens,
          $ai_input_cost_usd: calculateCost(inputTokens, 0, options.model),
          $ai_output_cost_usd: calculateCost(0, outputTokens, options.model),
          $ai_total_cost_usd: totalCost,
          $ai_provider: 'google',
          $ai_timestamp: new Date().toISOString(),
          $ai_trace_id: options.traceId,
          source: 'edge_function',
          app: 'menu-mestre-facil',
          ...options.properties,
        },
      }),
    })

    if (!response.ok) {
      console.error('Falha ao enviar $ai_generation ao PostHog:', await response.text())
    }
  } catch (error) {
    console.error('Erro ao capturar LLM no PostHog:', error)
  }
}
