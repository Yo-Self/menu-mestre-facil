export function getAppPlatform(): 'electron' | 'web' {
  if (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')) {
    return 'electron'
  }
  return 'web'
}

export function getAppVersion(): string {
  return import.meta.env.VITE_APP_VERSION || '0.0.0'
}
