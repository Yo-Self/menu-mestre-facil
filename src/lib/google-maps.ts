import { getAppPlatform } from '@/lib/platform'

/**
 * Chave do Google Maps para o ambiente atual.
 * No desktop (Electron), prefira VITE_GOOGLE_MAPS_API_KEY_ELECTRON — chave sem restrição
 * de HTTP referrer, ou com http://127.0.0.1:47832/* autorizado no Google Cloud Console.
 */
export function getGoogleMapsApiKey(): string {
  const electronKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY_ELECTRON as string | undefined
  const defaultKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

  if (getAppPlatform() === 'electron' && electronKey?.trim()) {
    return electronKey.trim()
  }

  return defaultKey?.trim() ?? ''
}

export function buildGoogleMapsScriptUrl(): string {
  const key = getGoogleMapsApiKey()
  const params = new URLSearchParams({
    key,
    libraries: 'places,geometry',
    loading: 'async',
  })
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`
}
