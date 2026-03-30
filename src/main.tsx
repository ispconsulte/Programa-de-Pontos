import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { shouldUseHashRouter } from './lib/router'

if (typeof window !== 'undefined' && shouldUseHashRouter()) {
  const { pathname, search, hash } = window.location
  if (!hash && pathname !== '/' && pathname !== '/index.html') {
    const normalizedPath = `${pathname}${search}`
    window.history.replaceState(null, '', `/#${normalizedPath}`)
  }
}

createRoot(document.getElementById("root")!).render(<App />)
