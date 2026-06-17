import { useEffect, useRef } from 'react'
import { isLocalOutboxOrder } from '@/types/orders'

interface UseOrderNotificationsProps {
  orders: any[]
  loading: boolean
  onNewOrderDetected?: () => void
}

export function useOrderNotifications({ 
  orders, 
  loading, 
  onNewOrderDetected 
}: UseOrderNotificationsProps) {
  const previousOrderIds = useRef<Set<string>>(new Set())
  const isInitialLoad = useRef(true)

  const playNotificationSound = () => {
    console.log('🎵 Tocando som de notificação de novo pedido...')
    try {
      // Usar a função global se disponível
      if (typeof window !== 'undefined' && (window as any).createNotificationSound) {
        console.log('Usando função global createNotificationSound')
        ;(window as any).createNotificationSound()
      } else {
        console.log('Usando Web Audio API diretamente')
        // Fallback: criar som diretamente
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        
        // Resumir contexto se estiver suspenso (necessário para autoplay)
        if (audioContext.state === 'suspended') {
          audioContext.resume()
        }
        
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        // Som mais audível
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2)
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.3)
        
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4)
        
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.4)
        
        console.log('Som tocado com sucesso')
      }
    } catch (error) {
      console.error('Erro ao tocar som de notificação:', error)
    }
  }

  const playDoubleNotificationSound = () => {
    console.log('🔔 Novo pedido detectado! Tocando som duplo...')
    // Toca o som duas vezes com intervalo de 500ms
    playNotificationSound()
    setTimeout(() => {
      playNotificationSound()
    }, 500)
  }

  useEffect(() => {
    if (!loading && orders) {
      const serverOrders = orders.filter((order) => !isLocalOutboxOrder(order))
      const currentOrderIds = new Set(serverOrders.map((order) => order.id))
      
      if (isInitialLoad.current) {
        console.log('Initial load, setting previous order IDs')
        previousOrderIds.current = currentOrderIds
        isInitialLoad.current = false
      } else {
        console.log('Checking for new orders...', { 
          currentCount: currentOrderIds.size, 
          previousCount: previousOrderIds.current.size 
        })
        
        // Detecta novos pedidos comparando IDs
        const newOrderIds = [...currentOrderIds].filter(id => !previousOrderIds.current.has(id))
        
        if (newOrderIds.length > 0) {
          console.log(`Novos pedidos detectados: ${newOrderIds.length}`, newOrderIds)
          playDoubleNotificationSound()
          
          // Chama callback se fornecido
          if (onNewOrderDetected) {
            onNewOrderDetected()
          }
        }
        
        previousOrderIds.current = currentOrderIds
      }
    }
  }, [orders, loading, onNewOrderDetected])

  return {
    playNotificationSound,
    playDoubleNotificationSound
  }
}
