import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { validateConfig } from './config/env'
import { initObservability } from './lib/sentry'

validateConfig()

initObservability().then(() => {
  createRoot(document.getElementById('root')!).render(<App />)
})
