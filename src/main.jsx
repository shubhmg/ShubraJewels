import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { useThemeStore } from './store/themeStore.js'
import { SettingsProvider } from './lib/SettingsProvider.jsx'

// Apply saved dark/light theme before first paint
useThemeStore.getState().init()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </StrictMode>,
)
