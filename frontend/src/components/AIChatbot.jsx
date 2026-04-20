import { useState, useRef, useEffect } from 'react'
import { Bot, X, Send, Sparkles, Loader2 } from 'lucide-react'
import api from '@/services/api'
import { useAuthStore } from '@/store/authStore'

export default function AIChatbot() {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'ai', text: `Halo ${user?.name?.split(' ')[0] || 'User'}! 👋\n\nSaya AI Asisten WMS LUTFHI. Tanya saya tentang:\n\n• 📦 Data stok & inventaris\n• 📊 Ringkasan & analisis\n• 🚨 Item kritis\n• 💡 Rekomendasi\n\nKetik pertanyaan Anda...` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const send = async () => {
    const msg = input.trim()
    if (!msg || loading) return

    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setInput('')
    setLoading(true)

    try {
      const res = await api.post('/ai/chat', { message: msg })
      const reply = res?.data?.reply || res?.reply || 'Maaf, tidak dapat memproses.'
      setMessages(prev => [...prev, { role: 'ai', text: reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: '❌ Gagal menghubungi AI. Coba lagi nanti.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const roleColor = {
    admin: 'from-emerald-500 to-emerald-600',
    staff: 'from-amber-500 to-amber-600',
    finance_procurement: 'from-blue-500 to-blue-600',
    manager: 'from-purple-500 to-purple-600',
  }

  if (!user) return null

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-navy-900 shadow-lg shadow-gold-500/30 hover:shadow-gold-500/50 hover:scale-110 transition-all duration-300 flex items-center justify-center group"
        >
          <Bot size={24} className="group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-pulse border-2 border-navy-900" />
        </button>
      )}

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[550px] max-h-[calc(100vh-4rem)] rounded-2xl border border-white/10 bg-navy-900/95 backdrop-blur-xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden">
          {/* Header */}
          <div className={`flex items-center gap-3 px-4 py-3 bg-gradient-to-r ${roleColor[user.role] || 'from-gold-500 to-gold-600'}`}>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold text-sm">AI Asisten WMS</h3>
              <p className="text-white/70 text-xs capitalize">{user.role?.replace('_', ' ')}</p>
            </div>
            <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-gold-500/20 text-gold-100 border border-gold-500/20 rounded-br-md'
                    : 'bg-white/[0.06] text-slate-200 border border-white/[0.06] rounded-bl-md'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/[0.06] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-gold-400" />
                  <span className="text-slate-400 text-sm">Sedang berpikir...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-1.5">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Tanya sesuatu..."
                disabled={loading}
                className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 outline-none disabled:opacity-50"
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-lg bg-gold-500 hover:bg-gold-400 disabled:opacity-30 disabled:hover:bg-gold-500 flex items-center justify-center text-navy-900 transition-colors"
              >
                <Send size={14} />
              </button>
            </div>
            <p className="text-slate-600 text-[10px] mt-1.5 text-center">Powered by Google Gemini • Data sesuai role Anda</p>
          </div>
        </div>
      )}
    </>
  )
}
