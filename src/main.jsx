import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/:tab" element={<App />} />
        <Route path="/" element={<Navigate to="/analytics" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
