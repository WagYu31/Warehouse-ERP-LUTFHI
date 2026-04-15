import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: 'rgba(15, 22, 41, 0.95)',
              color: '#E2E8F0',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '14px',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            },
            success: {
              iconTheme: { primary: '#10B981', secondary: '#0A0F1E' },
              style: { borderLeft: '3px solid #10B981' },
            },
            error: {
              iconTheme: { primary: '#EF4444', secondary: '#0A0F1E' },
              style: { borderLeft: '3px solid #EF4444' },
            },
            loading: {
              style: { borderLeft: '3px solid #F59E0B' },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
