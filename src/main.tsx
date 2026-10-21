import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles/tokens.css'
import './styles/base.css'
import './styles/sidebar.css'
import './styles/lesson.css'
import './styles/stage.css'
import './styles/bench.css'
import './styles/dialog.css'
import './styles/trainer.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
