import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useRestaurant } from '../../../hooks/useRestaurant'
import { useOrders } from '../../../hooks/useOrders'
import { Utensils, CheckCircle, Tv, Volume2 } from 'lucide-react'
import { supabase } from '../../../integrations/supabase/client'

const openIndexedDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("MenuMestreFilaDB", 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains("videos")) {
        db.createObjectStore("videos")
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const getVideoFromDB = async (): Promise<File | null> => {
  try {
    const db = await openIndexedDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("videos", "readonly")
      const store = transaction.objectStore("videos")
      const request = store.get("promo_video")
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch (e) {
    console.error("IndexedDB not supported or failed", e)
    return null
  }
}

export default function OrderPresentationPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>()
  const [resolvedId, setResolvedId] = useState<string | undefined>(undefined)
  const [resolvingSlug, setResolvingSlug] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)
  
  useEffect(() => {
    if (!restaurantId) return

    const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(restaurantId)
    
    if (isUUID) {
      setResolvedId(restaurantId)
      setResolveError(null)
    } else {
      setResolvingSlug(true)
      setResolveError(null)
      supabase
        .from('restaurants')
        .select('id')
        .eq('slug', restaurantId)
        .single()
        .then(({ data, error }) => {
          if (data && !error) {
            setResolvedId(data.id)
            setResolveError(null)
          } else {
            console.error('Failed to resolve restaurant slug:', error)
            setResolveError(`O restaurante com o slug "${restaurantId}" não foi encontrado. Por favor, verifique se digitou o endereço corretamente ou se o restaurante está ativo no painel administrativo.`)
          }
          setResolvingSlug(false)
        })
    }
  }, [restaurantId])

  const { restaurant, loading: loadingRestaurant, error: restaurantError } = useRestaurant(resolvedId)
  const { orders, loading: loadingOrders, error: ordersError } = useOrders(resolvedId)
  
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [identifierMode, setIdentifierMode] = useState(localStorage.getItem("queue_identifier_mode") || "senha")
  const [promoVideoUrl, setPromoVideoUrl] = useState(localStorage.getItem("queue_promo_video_url") || "")
  const [promoVideoType, setPromoVideoType] = useState(localStorage.getItem("queue_promo_video_type") || "youtube")
  const [promoVideoOrientation, setPromoVideoOrientation] = useState(localStorage.getItem("queue_promo_video_orientation") || "vertical")
  const [localVideoBlobUrl, setLocalVideoBlobUrl] = useState<string>("")
  const [queueTheme, setQueueTheme] = useState(localStorage.getItem("queue_theme") || "dark")

  useEffect(() => {
    let objectUrl = ""
    if (promoVideoType === 'local' && promoVideoUrl) {
      getVideoFromDB().then((file) => {
        if (file) {
          objectUrl = URL.createObjectURL(file)
          setLocalVideoBlobUrl(objectUrl)
        } else {
          setLocalVideoBlobUrl("")
        }
      })
    } else {
      setLocalVideoBlobUrl("")
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [promoVideoUrl, promoVideoType])

  // 1. Sincronizar configurações iniciais a partir do restaurante (banco de dados)
  useEffect(() => {
    if (restaurant && restaurant.queue_settings) {
      const settings = restaurant.queue_settings as any
      if (settings.video_url !== undefined) setPromoVideoUrl(settings.video_url)
      if (settings.video_type !== undefined) setPromoVideoType(settings.video_type)
      if (settings.video_orientation !== undefined) setPromoVideoOrientation(settings.video_orientation)
      if (settings.theme !== undefined) setQueueTheme(settings.theme)
      if (settings.identifier !== undefined) setIdentifierMode(settings.identifier)
    }
  }, [restaurant])

  // 2. Escutar alterações no banco de dados em tempo real
  useEffect(() => {
    if (!resolvedId) return

    const restaurantSubscription = supabase
      .channel('restaurant_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'restaurants',
          filter: `id=eq.${resolvedId}`
        },
        (payload) => {
          console.log('Restaurant change received in real-time:', payload)
          if (payload.new) {
            const newRestaurant = payload.new as any
            const settings = newRestaurant.queue_settings || {}
            
            if (settings.video_url !== undefined) setPromoVideoUrl(settings.video_url)
            if (settings.video_type !== undefined) setPromoVideoType(settings.video_type)
            if (settings.video_orientation !== undefined) setPromoVideoOrientation(settings.video_orientation)
            if (settings.theme !== undefined) setQueueTheme(settings.theme)
            if (settings.identifier !== undefined) setIdentifierMode(settings.identifier)
          }
        }
      )
      .subscribe()

    return () => {
      restaurantSubscription.unsubscribe()
    }
  }, [resolvedId])

  // 3. Fallback de sincronização via parâmetros da URL e LocalStorage (para testes locais rápidos)
  useEffect(() => {
    const syncSettings = () => {
      const params = new URLSearchParams(window.location.search)
      
      const urlVideo = params.get("video")
      const urlType = params.get("type") || (urlVideo ? "youtube" : "")
      const urlOrientation = params.get("orientation")
      const urlTheme = params.get("theme")
      const urlIdentifier = params.get("identifier")
      
      if (urlVideo) setPromoVideoUrl(urlVideo)
      if (urlType) setPromoVideoType(urlType)
      if (urlOrientation) setPromoVideoOrientation(urlOrientation)
      if (urlTheme) setQueueTheme(urlTheme)
      if (urlIdentifier) setIdentifierMode(urlIdentifier)
    }
    
    syncSettings()
    window.addEventListener("storage", syncSettings)
    return () => window.removeEventListener("storage", syncSettings)
  }, [])

  const extractYouTubeId = (url: string) => {
    if (!url) return null
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
    const match = url.match(regExp)
    return (match && match[2].length === 11) ? match[2] : null
  }
  
  const [prevReadyIds, setPrevReadyIds] = useState<string[]>([])
  const isFirstLoad = useRef(true)

  // Chime Sound Synthesizer using native Web Audio API
  const playChimeSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return
      const ctx = new AudioContextClass()

      const playBell = (freq: number, startTime: number, duration: number) => {
        // Fundamental
        const osc1 = ctx.createOscillator()
        const gain1 = ctx.createGain()
        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(freq, startTime)
        
        // Harmonic (one octave up)
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(freq * 2, startTime)
        
        // Third overtone (tine ring)
        const osc3 = ctx.createOscillator()
        const gain3 = ctx.createGain()
        osc3.type = 'sine'
        osc3.frequency.setValueAtTime(freq * 3.01, startTime)

        // Gains
        gain1.gain.setValueAtTime(0, startTime)
        gain1.gain.linearRampToValueAtTime(0.3, startTime + 0.02)
        gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

        gain2.gain.setValueAtTime(0, startTime)
        gain2.gain.linearRampToValueAtTime(0.15, startTime + 0.015)
        gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.8)

        gain3.gain.setValueAtTime(0, startTime)
        gain3.gain.linearRampToValueAtTime(0.08, startTime + 0.01)
        gain3.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.5)

        osc1.connect(gain1)
        osc2.connect(gain2)
        osc3.connect(gain3)

        gain1.connect(ctx.destination)
        gain2.connect(ctx.destination)
        gain3.connect(ctx.destination)

        osc1.start(startTime)
        osc2.start(startTime)
        osc3.start(startTime)

        osc1.stop(startTime + duration)
        osc2.stop(startTime + duration)
        osc3.stop(startTime + duration)
      }

      // Airport "Ding-Dong" chime (C5 followed by G4)
      playBell(523.25, ctx.currentTime, 1.2) // C5
      playBell(392.00, ctx.currentTime + 0.35, 1.5) // G4
    } catch (error) {
      console.error('Failed to play synthesized chime:', error)
    }
  }

  // Handle manual audio enable click
  const enableAudio = () => {
    setAudioEnabled(true)
    // Play a gentle sound immediately to verify audio is enabled
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContextClass) {
        const ctx = new AudioContextClass()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, ctx.currentTime) // short A5 click
        gain.gain.setValueAtTime(0.05, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.1)
      }
    } catch (e) {
      console.warn('Audio check bypassed', e)
    }
  }

  // Voice Speech Synthesis with client-side fallback for Smart TVs (like LG webOS)
  const speakText = (text: string) => {
    if (!audioEnabled) return

    // 1. Try native Web Speech API Synthesis (Works in standard browsers, Electron, Chrome)
    const synth = window.speechSynthesis
    if (synth && typeof synth.speak === 'function') {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'pt-BR'
      utterance.rate = 0.92 // slightly slower for better TV audio clarity
      utterance.volume = 1.0
      
      const voices = synth.getVoices()
      const ptVoice = voices.find(v => v.lang.toLowerCase().includes('pt'))
      if (ptVoice) {
        utterance.voice = ptVoice
      }
      synth.speak(utterance)
      return
    }

    // 2. Fallback to Google Translate TTS (specifically for Smart TVs like LG webOS where speech synthesis is disabled)
    try {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=pt-BR&client=tw-ob&q=${encodeURIComponent(text)}`
      const audio = new Audio(url)
      audio.volume = 1.0
      audio.play().catch(err => {
        console.warn('Failed to play fallback TTS audio stream:', err)
      })
    } catch (error) {
      console.error('TTS Fallback audio stream failed:', error)
    }
  }

  // Monitor status changes for chime sound and voice announcements
  useEffect(() => {
    if (loadingOrders) return

    const currentReadyIds = orders
      .filter(order => order.status === 'ready')
      .map(order => order.id)

    if (isFirstLoad.current) {
      setPrevReadyIds(currentReadyIds)
      isFirstLoad.current = false
      return
    }

    const newReady = currentReadyIds.filter(id => !prevReadyIds.includes(id))

    if (newReady.length > 0) {
      const isChimeEnabled = localStorage.getItem("queue_chime_enabled") !== "false"
      if (audioEnabled && isChimeEnabled) {
        playChimeSound()
      }

      // Voice TTS Callout for new ready orders
      if (audioEnabled) {
        const newReadyOrders = orders.filter(order => newReady.includes(order.id))
        newReadyOrders.forEach((order, idx) => {
          setTimeout(() => {
            const label = getOrderLabel(order)
            let announcementText = ""
            if (identifierMode === "mesa" && order.table_name) {
              announcementText = `Mesa ${label} pronta!`
            } else {
              const isNumeric = /^\d+$/.test(label)
              if (isNumeric) {
                announcementText = `Pedido número ${label} pronto!`
              } else {
                announcementText = `Pedido ${label} pronto!`
              }
            }
            speakText(announcementText)
          }, 1500 + idx * 4000) // Trigger 1.5s after chime, space out multiple calls by 4s
        })
      }

      setPrevReadyIds(currentReadyIds)
    } else if (currentReadyIds.length !== prevReadyIds.length) {
      setPrevReadyIds(currentReadyIds)
    }
  }, [orders, loadingOrders, audioEnabled, prevReadyIds])

  // Filter lists
  const preparingOrders = orders.filter(order => order.status === 'new' || order.status === 'in_preparation')
  const readyOrders = orders.filter(order => order.status === 'ready')

  const getOrderLabel = (order: any) => {
    if (identifierMode === "mesa" && order.table_name) {
      return order.table_name
    }
    if (order.customer_info && typeof order.customer_info === 'object') {
      const password = (order.customer_info as any).queue_password
      if (password) return password
    }
    if (order.table_name) {
      return order.table_name
    }
    return `#${order.id.slice(-4).toUpperCase()}`
  }

  const isLoading = (loadingRestaurant || loadingOrders || resolvingSlug || resolvedId === undefined) && !resolveError && !restaurantError && !ordersError
  const isDark = queueTheme === "dark"
  const hasError = resolveError || restaurantError || ordersError

  if (hasError) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen font-sans p-6 text-center transition-colors duration-500 ${isDark ? 'bg-[#0e0e0e] text-white' : 'bg-slate-50 text-slate-800'}`}>
        <div className={`max-w-md p-8 rounded-2xl border flex flex-col items-center gap-4 shadow-2xl transition-colors duration-500 ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-slate-200'}`}>
          <div className="h-16 w-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center animate-bounce">
            <Utensils className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold uppercase tracking-wider text-red-500">Acesso Indisponível</h3>
          <p className={`text-xs leading-relaxed font-semibold ${isDark ? 'text-zinc-450' : 'text-slate-500'}`}>
            {resolveError || (restaurantError || ordersError)?.message || 'Não foi possível carregar as informações desta fila de atendimento no momento.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full mt-2 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white font-black py-3 rounded-xl uppercase text-xs tracking-wider transition-all duration-300 border border-zinc-750"
          >
            🔄 Tentar Novamente
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen font-sans transition-colors duration-500 ${isDark ? 'bg-[#0e0e0e] text-white' : 'bg-slate-50 text-slate-800'}`}>
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className={`rounded-full p-4 border transition-colors duration-500 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <Tv className="h-10 w-10 text-emerald-500 animate-bounce" />
          </div>
          <span className={`text-xl font-bold tracking-widest bg-gradient-to-r bg-clip-text text-transparent transition-colors duration-500 ${isDark ? 'from-zinc-200 to-zinc-400' : 'from-slate-700 to-slate-500'}`}>
            INICIALIZANDO PAINEL...
          </span>
          <p className={`text-xs font-mono transition-colors duration-500 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Carregando dados da fila de atendimento</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`h-screen p-8 font-sans overflow-hidden select-none flex flex-col transition-colors duration-500 ${
        isDark 
          ? "dark bg-[#0e0e0e] text-[#e5e2e1]" 
          : "bg-slate-50 text-slate-800"
      }`}
      onClick={() => {
        if (!audioEnabled) enableAudio()
      }}
    >
      {/* Audio initialization overlay (unblocks media autoplay for Smart TVs / browsers) */}
      {!audioEnabled && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl max-w-sm text-center shadow-2xl flex flex-col items-center gap-4">
            <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center animate-bounce">
              <Volume2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-white uppercase tracking-wider">Ativar Alertas de Voz</h3>
            <p className="text-xs font-medium text-zinc-400 leading-relaxed">
              Clique no botão abaixo para permitir que a TV emita alertas sonoros e chame as senhas dos pedidos em voz alta.
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation()
                enableAudio()
              }}
              className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black py-3 rounded-xl shadow-lg shadow-emerald-500/15 uppercase text-xs tracking-wider transition-all duration-300"
            >
              🔔 Iniciar Fila
            </button>
          </div>
        </div>
      )}

      {/* Ambient background glows */}
      <div className={`absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none transition-colors duration-500 ${
        isDark ? "bg-amber-500/[0.02]" : "bg-amber-500/[0.05]"
      }`} />
      <div className={`absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none transition-colors duration-500 ${
        isDark ? "bg-emerald-500/[0.02]" : "bg-emerald-500/[0.05]"
      }`} />

      {promoVideoUrl && promoVideoOrientation === 'horizontal' ? (
        /* SPECIAL HORIZONTAL VIDEO LAYOUT: SIDE-BY-SIDE SPLIT FROM THE VERY TOP */
        <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-8 h-full pb-8 relative z-10 overflow-hidden">
          {/* Left Column: Branding Header + Preparing */}
          <div className="flex flex-col h-full gap-6 overflow-hidden">
            {/* Header Branding (Only on the left side) */}
            <header className="flex items-center gap-8 md:gap-10 py-4 border-b border-slate-200 dark:border-zinc-800/80 pb-6 relative z-10">
              {restaurant?.image_url ? (
                <div className="relative group shrink-0">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-emerald-500 rounded-xl blur opacity-40 group-hover:opacity-75 transition duration-300" />
                  <img 
                    src={restaurant.image_url} 
                    alt={restaurant.name} 
                    className="relative h-24 w-auto max-w-[140px] rounded-xl object-contain border-2 border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0e0e0e] p-1"
                  />
                </div>
              ) : (
                <div className="h-24 w-24 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center shrink-0 shadow-inner">
                  <Utensils className="h-12 w-12 text-amber-500" />
                </div>
              )}
              
              <div className="flex flex-col">
                <span className="text-xs font-bold text-amber-500 tracking-[0.25em] uppercase font-mono">Fila de Atendimento</span>
                <h1 className={`text-4xl sm:text-5xl font-black tracking-tight uppercase mt-1 drop-shadow-md transition-colors duration-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {restaurant?.name || 'Menu Mestre'}
                </h1>
                <div className="h-1 w-24 bg-amber-500 rounded-full mt-2" />
              </div>
            </header>

            {/* Em Preparo Panel */}
            <section className="flex flex-col flex-grow bg-white/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/50 rounded-2xl overflow-hidden shadow-sm shadow-amber-500/5 dark:shadow-none glow-amber">
              <div className="bg-slate-50 dark:bg-zinc-900/80 px-8 py-5 flex items-center justify-between border-b border-amber-500/10 header-pulse">
                <h2 className="text-2xl font-black text-amber-500 uppercase tracking-widest flex items-center gap-3">
                  <Utensils className="h-6 w-6" />
                  Em Preparo
                </h2>
                <span className="font-mono text-xs font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800 px-3 py-1 rounded-full shadow-inner">
                  {preparingOrders.length} {preparingOrders.length === 1 ? 'PEDIDO' : 'PEDIDOS'}
                </span>
              </div>

              <div className="flex-grow p-6 overflow-y-auto flex flex-col gap-4 min-h-0 custom-scrollbar">
                {preparingOrders.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {preparingOrders.map((order, index) => {
                      const label = getOrderLabel(order)
                      return (
                        <div 
                          key={order.id}
                          className="order-card order-card-entrance preparing-card-shimmer border-2 border-amber-500/20 dark:border-amber-500/30 rounded-xl bg-white dark:bg-zinc-900/40 flex flex-col items-center justify-center p-6 text-center shadow-sm dark:shadow-none hover:scale-[1.03]"
                          style={{ animationDelay: `${0.1 + (index * 0.1)}s` }}
                        >
                          <span className="font-mono text-4xl sm:text-5xl font-black text-amber-500 dark:text-amber-400 tracking-wide">
                            {label}
                          </span>
                          {order.delivery_type === 'dine_in' && order.table_name && (
                            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 mt-2 uppercase tracking-widest">
                              Local / {order.table_name}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-zinc-700 py-16">
                    <Utensils className="h-12 w-12 text-slate-300 dark:text-zinc-800 mb-3 stroke-[1.5]" />
                    <p className="text-sm font-semibold tracking-wide uppercase">Nenhum pedido em preparo</p>
                    <p className="text-xs text-slate-400 dark:text-zinc-700 mt-1">Os novos pratos em andamento surgirão aqui.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Massive Widescreen Video + Ready List */}
          <div className="flex flex-col h-full gap-6 min-h-0">
            {/* Promotional Video — height is explicit so the iframe has a concrete px anchor */}
            <section className="relative rounded-2xl overflow-hidden shadow-sm dark:shadow-none glow-video bg-black shrink-0" style={{ height: '58%' }}>
              {promoVideoType === 'youtube' ? (() => {
                const videoId = extractYouTubeId(promoVideoUrl)
                if (videoId) {
                  return (
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&iv_load_policy=3&playsinline=1`}
                      title="Promotional Video"
                      className="absolute inset-0 w-full h-full border-0"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  )
                }
                return (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-xs font-semibold text-zinc-500">URL do YouTube Inválida</p>
                  </div>
                )
              })() : (
                <video
                  src={localVideoBlobUrl || promoVideoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
            </section>

            {/* Pronto Panel */}
            <section className="flex flex-col flex-grow bg-white/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/50 rounded-2xl overflow-hidden shadow-sm shadow-emerald-500/5 dark:shadow-none glow-emerald">
              <div className="bg-slate-50 dark:bg-zinc-900/80 px-8 py-5 flex items-center justify-between border-b border-emerald-500/10 header-pulse">
                <h2 className="text-2xl font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-3">
                  <CheckCircle className="h-6 w-6" />
                  Pronto
                </h2>
                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full animate-pulse shadow-inner">
                  {readyOrders.length} {readyOrders.length === 1 ? 'PEDIDO' : 'PEDIDOS'}
                </span>
              </div>

              <div className="flex-grow p-6 overflow-y-auto flex flex-col gap-4 min-h-0 custom-scrollbar">
                {readyOrders.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {readyOrders.map((order, index) => {
                      const label = getOrderLabel(order)
                      return (
                        <div 
                          key={order.id}
                          className="order-card ready-card ready-card-pulse order-card-entrance rounded-xl flex flex-col items-center justify-center p-6 text-center relative overflow-hidden group hover:scale-[1.05]"
                          style={{ animationDelay: `${0.1 + (index * 0.1)}s` }}
                        >
                          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="font-mono text-5xl sm:text-6xl font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)] z-10 tracking-wider">
                            {label}
                          </span>
                          {order.delivery_type === 'dine_in' && order.table_name ? (
                            <span className="text-[10px] font-extrabold text-emerald-100/90 mt-2.5 uppercase tracking-widest bg-emerald-800/80 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-400/20 dark:border-white/10 z-10 shadow-sm">
                              {order.table_name}
                            </span>
                          ) : (
                            <span className="text-[10px] font-extrabold text-emerald-100/90 mt-2.5 uppercase tracking-widest bg-emerald-800/80 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-400/20 dark:border-white/10 z-10 shadow-sm">
                              RETIRAR
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-zinc-700 py-16">
                    <CheckCircle className="h-12 w-12 text-slate-300 dark:text-zinc-800 mb-3 stroke-[1.5]" />
                    <p className="text-sm font-semibold tracking-wide uppercase">Nenhum pedido pronto</p>
                    <p className="text-xs text-slate-400 dark:text-zinc-700 mt-1">Sinais visuais piscarão aqui ao concluir pratos.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      ) : (
        <>
          {/* Top Header Branding Section */}
          <header className="flex flex-col sm:flex-row justify-between items-center w-full py-6 mb-10 border-b border-slate-200 dark:border-zinc-800/80 pb-8 relative z-10">
            <div className="flex items-center gap-8 md:gap-10">
              {restaurant?.image_url ? (
                <div className="relative group shrink-0">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-emerald-500 rounded-xl blur opacity-40 group-hover:opacity-75 transition duration-300" />
                  <img 
                    src={restaurant.image_url} 
                    alt={restaurant.name} 
                    className="relative h-24 w-auto max-w-[140px] rounded-xl object-contain border-2 border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0e0e0e] p-1"
                  />
                </div>
              ) : (
                <div className="h-24 w-24 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center shrink-0 shadow-inner">
                  <Utensils className="h-12 w-12 text-amber-500" />
                </div>
              )}
              
              <div className="flex flex-col text-center sm:text-left">
                <span className="text-xs font-bold text-amber-500 tracking-[0.25em] uppercase font-mono">Fila de Atendimento</span>
                <h1 className={`text-4xl sm:text-5xl font-black tracking-tight uppercase mt-1 drop-shadow-md transition-colors duration-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {restaurant?.name || 'Menu Mestre'}
                </h1>
                <div className="h-1 w-24 bg-amber-500 rounded-full mt-2 self-center sm:self-start" />
              </div>
            </div>
          </header>

          {/* Main Grid View */}
          <main className={`relative z-10 flex-grow grid gap-8 h-full pb-8 ${
            promoVideoUrl && promoVideoOrientation === 'vertical'
              ? "grid-cols-1 xl:grid-cols-10" 
              : "grid-cols-1 lg:grid-cols-2"
          }`}>
            {/* Left Column: Preparing (Em Preparo) */}
            <section className={`flex flex-col h-full bg-white/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/50 rounded-2xl overflow-hidden shadow-sm shadow-amber-500/5 dark:shadow-none glow-amber ${
              promoVideoUrl && promoVideoOrientation === 'vertical' ? "xl:col-span-3" : ""
            }`}>
              <div className="bg-slate-50 dark:bg-zinc-900/80 px-8 py-5 flex items-center justify-between border-b border-amber-500/10 header-pulse">
                <h2 className="text-2xl font-black text-amber-500 uppercase tracking-widest flex items-center gap-3">
                  <Utensils className="h-6 w-6" />
                  Em Preparo
                </h2>
                <span className="font-mono text-xs font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800 px-3 py-1 rounded-full shadow-inner">
                  {preparingOrders.length} {preparingOrders.length === 1 ? 'PEDIDO' : 'PEDIDOS'}
                </span>
              </div>

              <div className="flex-grow p-6 overflow-y-auto flex flex-col gap-4 max-h-[calc(100vh-280px)] custom-scrollbar">
                {preparingOrders.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {preparingOrders.map((order, index) => {
                      const label = getOrderLabel(order)
                      return (
                        <div 
                          key={order.id}
                          className="order-card order-card-entrance preparing-card-shimmer border-2 border-amber-500/20 dark:border-amber-500/30 rounded-xl bg-white dark:bg-zinc-900/40 flex flex-col items-center justify-center p-6 text-center shadow-sm dark:shadow-none hover:scale-[1.03]"
                          style={{ animationDelay: `${0.1 + (index * 0.1)}s` }}
                        >
                          <span className="font-mono text-4xl sm:text-5xl font-black text-amber-500 dark:text-amber-400 tracking-wide">
                            {label}
                          </span>
                          {order.delivery_type === 'dine_in' && order.table_name && (
                            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 mt-2 uppercase tracking-widest">
                              Local / {order.table_name}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-zinc-700 py-16">
                    <Utensils className="h-12 w-12 text-slate-300 dark:text-zinc-800 mb-3 stroke-[1.5]" />
                    <p className="text-sm font-semibold tracking-wide uppercase">Nenhum pedido em preparo</p>
                    <p className="text-xs text-slate-400 dark:text-zinc-700 mt-1">Os novos pratos em andamento surgirão aqui.</p>
                  </div>
                )}
              </div>
            </section>

            <>
                {/* Right Column: Ready (Pronto) */}
                <section className={`flex flex-col h-full bg-white/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/50 rounded-2xl overflow-hidden shadow-sm shadow-emerald-500/5 dark:shadow-none glow-emerald ${
                  promoVideoUrl && promoVideoOrientation === 'vertical' ? "xl:col-span-3" : ""
                }`}>
                  <div className="bg-slate-50 dark:bg-zinc-900/80 px-8 py-5 flex items-center justify-between border-b border-emerald-500/10 header-pulse">
                    <h2 className="text-2xl font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-3">
                      <CheckCircle className="h-6 w-6" />
                      Pronto
                    </h2>
                    <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full animate-pulse shadow-inner">
                      {readyOrders.length} {readyOrders.length === 1 ? 'PEDIDO' : 'PEDIDOS'}
                    </span>
                  </div>

                  <div className="flex-grow p-6 overflow-y-auto flex flex-col gap-4 max-h-[calc(100vh-280px)] custom-scrollbar">
                    {readyOrders.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {readyOrders.map((order, index) => {
                          const label = getOrderLabel(order)
                          return (
                            <div 
                              key={order.id}
                              className="order-card ready-card ready-card-pulse order-card-entrance rounded-xl flex flex-col items-center justify-center p-6 text-center relative overflow-hidden group hover:scale-[1.05]"
                              style={{ animationDelay: `${0.1 + (index * 0.1)}s` }}
                            >
                              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                              <span className="font-mono text-5xl sm:text-6xl font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)] z-10 tracking-wider">
                                {label}
                              </span>
                              {order.delivery_type === 'dine_in' && order.table_name ? (
                                <span className="text-[10px] font-extrabold text-emerald-100/90 mt-2.5 uppercase tracking-widest bg-emerald-800/80 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-400/20 dark:border-white/10 z-10 shadow-sm">
                                  {order.table_name}
                                </span>
                              ) : (
                                <span className="text-[10px] font-extrabold text-emerald-100/90 mt-2.5 uppercase tracking-widest bg-emerald-800/80 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-400/20 dark:border-white/10 z-10 shadow-sm">
                                  RETIRAR
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-zinc-700 py-16">
                        <CheckCircle className="h-12 w-12 text-slate-300 dark:text-zinc-800 mb-3 stroke-[1.5]" />
                        <p className="text-sm font-semibold tracking-wide uppercase">Nenhum pedido pronto</p>
                        <p className="text-xs text-slate-400 dark:text-zinc-700 mt-1">Sinais visuais piscarão aqui ao concluir pratos.</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Right Column: Video Panel (Vertical) */}
                {promoVideoUrl && promoVideoOrientation === 'vertical' && (
                  <section className="flex flex-col h-full bg-white/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/50 rounded-2xl overflow-hidden shadow-sm dark:shadow-none glow-video xl:col-span-4 relative">
                    <div className="bg-slate-50 dark:bg-zinc-900/80 px-8 py-5 flex items-center justify-between border-b border-slate-200 dark:border-zinc-800/50">
                      <h2 className="text-2xl font-black text-slate-850 dark:text-zinc-200 uppercase tracking-widest flex items-center gap-3">
                        <span className="animate-pulse text-amber-500">🎬</span>
                        Destaques do Dia
                      </h2>
                    </div>
                    
                    <div className="flex-grow p-6 flex items-center justify-center max-h-[calc(100vh-280px)] overflow-hidden bg-black/40">
                      {promoVideoType === 'youtube' ? (() => {
                        const videoId = extractYouTubeId(promoVideoUrl)
                        if (videoId) {
                          return (
                            <iframe
                              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&iv_load_policy=3&playsinline=1`}
                              title="Promotional Video"
                              className="w-full h-full rounded-xl border-0 aspect-video max-h-full"
                              allow="autoplay; encrypted-media; picture-in-picture"
                              allowFullScreen
                            />
                          )
                        }
                        return (
                          <div className="text-center p-4">
                            <p className="text-sm font-semibold text-zinc-500">URL do YouTube Inválida</p>
                            <p className="text-xs text-zinc-600 mt-1 font-mono">{promoVideoUrl}</p>
                          </div>
                        )
                      })() : (
                        <video
                          src={localVideoBlobUrl || promoVideoUrl}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover rounded-xl shadow-lg border border-zinc-850/20 dark:border-zinc-800/50 max-h-full"
                        />
                      )}
                    </div>
                  </section>
                )}
              </>
          </main>
        </>
      )}


      {/* Stitch inspired CSS animations and overrides */}
      <style>{`
        body {
          background-color: ${isDark ? '#0e0e0e' : '#f8fafc'} !important;
          transition: background-color 0.5s ease;
        }
        .glow-amber {
          box-shadow: 0 0 40px ${isDark ? 'rgba(245, 158, 11, 0.03)' : 'rgba(245, 158, 11, 0.06)'};
        }
        .glow-emerald {
          box-shadow: 0 0 40px ${isDark ? 'rgba(16, 185, 129, 0.03)' : 'rgba(16, 185, 129, 0.06)'};
        }
        .glow-video {
          box-shadow: 0 0 40px ${isDark ? 'rgba(245, 158, 11, 0.02), 0 0 40px rgba(16, 185, 129, 0.02)' : 'rgba(100, 116, 139, 0.06)'};
        }
        
        /* Entrance Animations */
        @keyframes slide-fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .order-card-entrance {
          animation: slide-fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Ready Card Pulse */
        @keyframes card-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 30px rgba(16, 185, 129, 0.15); }
          50% { transform: scale(1.02); box-shadow: 0 0 50px rgba(16, 185, 129, 0.4); }
        }
        .ready-card-pulse {
          animation: card-pulse 3s infinite ease-in-out;
        }

        /* Preparing Card Float/Shimmer */
        @keyframes float-shimmer {
          0%, 100% { transform: translateY(0); border-color: ${isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.2)'}; }
          50% { transform: translateY(-4px); border-color: ${isDark ? 'rgba(245, 158, 11, 0.6)' : 'rgba(245, 158, 11, 0.5)'}; }
        }
        .preparing-card-shimmer {
          animation: float-shimmer 4s infinite ease-in-out;
        }

        /* Header Glow Pulse */
        @keyframes header-glow-pulse {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 1; filter: brightness(1.1); }
        }
        .header-pulse {
          animation: header-glow-pulse 5s infinite ease-in-out;
        }

        .order-card {
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ready-card {
          background: linear-gradient(135deg, #10b981 0%, #047857 100%);
          border: 2px solid rgba(52, 211, 153, 0.35);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: ${isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.08)'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.18)'};
        }
      `}</style>
    </div>
  )
}
