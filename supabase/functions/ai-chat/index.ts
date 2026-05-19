// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { GoogleGenerativeAI } from "npm:@google/generative-ai@^0.21.0"

// Configure API version to use v1 instead of v1beta
const API_VERSION = 'v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function for retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      // Check if it's a rate limit error
      if (error instanceof Error && error.message.includes('429')) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      // If it's not a rate limit error, throw immediately
      throw error
    }
  }
  
  throw lastError || new Error('Max retries exceeded')
}

// Helper function to try multiple models with fallback
async function tryModelWithFallback(
  genAI: GoogleGenerativeAI,
  message: string,
  history: any[] = [],
  systemInstruction?: string
): Promise<{ text: string; model: string }> {
  // List of models to try in order (models that work with current API)
  // Using latest stable models
  const models = [
    'gemini-2.0-flash-exp',     // Latest experimental flash model
    'gemini-1.5-flash-latest',  // Latest stable flash
    'gemini-1.5-flash-002',     // Specific stable version
    'gemini-1.5-flash',         // Base model
  ]
  
  let lastError: Error | null = null
  
  for (const modelName of models) {
    try {
      console.log(`Trying model: ${modelName}`)
      
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemInstruction
      })
      
      const chat = model.startChat({
        history: history,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
        },
      })
      
      const result = await chat.sendMessage(message)
      const response = result.response
      const text = response.text()
      
      console.log(`✅ Success with model: ${modelName}`)
      return { text, model: modelName }
      
    } catch (error) {
      lastError = error as Error
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`❌ Failed with model ${modelName}:`, errorMessage)
      
      // If it's a quota/rate limit error, try next model
      if (errorMessage.includes('429') || errorMessage.includes('quota')) {
        console.log(`Rate limit/quota exceeded for ${modelName}, trying next model...`)
        continue
      }
      
      // If it's a "model not found" error, try next model
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        console.log(`Model ${modelName} not found, trying next model...`)
        continue
      }
      
      // For other errors, throw immediately
      throw error
    }
  }
  
  // If all models failed
  throw new Error(`All models failed. Last error: ${lastError?.message || 'Unknown error'}`)
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set')
    }

    // Parse request body with error handling
    let body
    try {
      body = await req.json()
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { message, history = [], systemInstruction } = body

    // Validate message
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Message is required and must be a non-empty string' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate history
    if (!Array.isArray(history)) {
      return new Response(
        JSON.stringify({ error: 'History must be an array' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('📩 Received message:', message)
    console.log('📜 History length:', history.length)

    const genAI = new GoogleGenerativeAI(apiKey)

    // Use retry logic with model fallback
    const result = await retryWithBackoff(
      () => tryModelWithFallback(genAI, message, history, systemInstruction),
      3, // max retries
      1000 // base delay in ms
    )

    console.log('✅ Generated response successfully')

    return new Response(
      JSON.stringify({ 
        response: result.text,
        model: result.model,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error in ai-chat function:', error)
    
    // Safe error message extraction
    let errorMessage = 'Internal server error'
    if (error && typeof error === 'object') {
      if (error instanceof Error && error.message) {
        errorMessage = error.message
      } else if ('message' in error && typeof error.message === 'string') {
        errorMessage = error.message
      } else {
        errorMessage = String(error)
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/ai-chat' \
    --header 'Authorization: Bearer YOUR_ANON_KEY' \
    --header 'Content-Type: application/json' \
    --data '{"message":"Hello, how are you?"}'

*/
