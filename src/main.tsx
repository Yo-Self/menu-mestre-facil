import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { validateConfig } from './config/env'

// Validar configurações na inicialização
validateConfig();

createRoot(document.getElementById("root")!).render(<App />);
