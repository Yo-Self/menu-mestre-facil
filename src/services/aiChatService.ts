// Service para integração com a Edge Function AI Chat
import { supabase } from '@/integrations/supabase/client'
import { getSupabaseConfig } from '@/config/global-config'
import posthog from 'posthog-js'

export interface ChatMessage {
  role: 'user' | 'model'
  parts: { text: string }[]
}

export interface ChatRequest {
  message: string
  history?: ChatMessage[]
  systemInstruction?: string
  distinct_id?: string
  trace_id?: string
}

export interface ChatResponse {
  response: string
  model: string
  timestamp: string
}

export class AIChatService {
  /**
   * Envia uma mensagem para o AI Chat
   */
  static async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      // Validações de entrada
      if (!request || typeof request !== 'object') {
        throw new Error('Invalid request: must be an object')
      }

      if (!request.message || typeof request.message !== 'string') {
        throw new Error('Invalid request: message must be a non-empty string')
      }

      if (request.history && !Array.isArray(request.history)) {
        throw new Error('Invalid request: history must be an array')
      }

      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session || !session.access_token) {
        throw new Error('User not authenticated')
      }

      const supabaseUrl = getSupabaseConfig().url
      if (!supabaseUrl || typeof supabaseUrl !== 'string') {
        throw new Error('Supabase URL not configured')
      }

      const distinctId =
        request.distinct_id ||
        (posthog.__loaded ? posthog.get_distinct_id() : session.user.id)
      const traceId = request.trace_id || crypto.randomUUID()

      const response = await fetch(
        `${supabaseUrl}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...request,
            distinct_id: distinctId,
            trace_id: traceId,
          }),
        }
      )

      if (!response.ok) {
        let errorMessage = 'Failed to get AI response'
        try {
          const error = await response.json()
          if (error && error.error) {
            errorMessage = error.error
          }
        } catch (e) {
          // Se não conseguir parsear o JSON do erro, usa mensagem genérica
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data: ChatResponse = await response.json()
      
      // Valida resposta
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response from server')
      }

      if (!data.response || typeof data.response !== 'string') {
        throw new Error('Invalid response: missing or invalid response text')
      }

      return data

    } catch (error) {
      console.error('Error sending message to AI Chat:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Unknown error occurred')
    }
  }

  /**
   * Envia uma mensagem simples (sem histórico)
   */
  static async sendSimpleMessage(message: string): Promise<string> {
    const response = await this.sendMessage({ message })
    return response.response
  }

  /**
   * Formata histórico de mensagens para o formato esperado pela API
   */
  static formatHistory(messages: { role: 'user' | 'assistant', content: string }[]): ChatMessage[] {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }))
  }
}

// Exemplo de uso:
/*
// 1. Mensagem simples
const response = await AIChatService.sendSimpleMessage('Olá!')
console.log(response)

// 2. Com histórico
const history = AIChatService.formatHistory([
  { role: 'user', content: 'Olá!' },
  { role: 'assistant', content: 'Olá! Como posso ajudar?' }
])

const response = await AIChatService.sendMessage({
  message: 'Qual o horário de funcionamento?',
  history: history
})

// 3. Com system instruction
const response = await AIChatService.sendMessage({
  message: 'Me fale sobre o cardápio',
  systemInstruction: 'Você é um assistente virtual de um restaurante. Seja sempre educado e prestativo.'
})
*/
