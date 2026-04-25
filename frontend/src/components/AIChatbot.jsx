import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, X, Send, Sparkles, Loader2, Copy, Check, Trash2, ChevronDown, RefreshCw, Minus } from 'lucide-react'
import api from '@/services/api'
import { useAuthStore } from '@/store/authStore'

// ── Quick suggestion chips per role ──────────────────────────
const QUICK_CHIPS = {
  admin: [
    '📦 Berapa item yang kritis?',
    '📊 Ringkasan inventaris hari ini',
    '🔄 Transaksi bulan ini?',
    '🚨 Item stok paling rendah',
  ],
  staff: [
    '📦 Berapa item yang kritis?',
    '🔄 Transaksi barang masuk bulan ini?',
    '📋 SPB pending berapa?',
    '🚨 Item hampir habis?',
  ],
  finance_procurement: [
    '💰 Sisa anggaran berapa?',
    '📄 Invoice belum dibayar?',
    '🛒 PO yang masih pending?',
    '🚨 Ada invoice overdue?',
  ],
  manager: [
    '📊 Ringkasan semua modul',
    '💰 Status anggaran bulan ini?',
    '📦 Kondisi inventaris gudang?',
    '📄 Laporan keuangan singkat?',
  ],
}

// ── Typing indicator dots animation ──────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-2 h-2 rounded-full bg-slate-400"
          style={{ animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </div>
  )
}

// ── Individual message bubble ─────────────────────────────────
function MessageBubble({ msg, isLatest }) {
  const [copied, setCopied] = useState(false)
  const isAI = msg.role === 'ai'

  const copy = () => {
    navigator.clipboard.writeText(msg.text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={`flex gap-2.5 ${isAI ? 'justify-start' : 'justify-end'} group`}
      style={{ animation: 'msgSlideIn 0.25s ease-out both' }}>

      {/* AI avatar */}
      {isAI && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-violet-500/30">
          <Sparkles size={13} className="text-white" />
        </div>
      )}

      <div className={`max-w-[85%] flex flex-col ${isAI ? 'items-start' : 'items-end'}`}>
        <div className={`relative rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isAI
            ? 'bg-white/[0.07] text-slate-200 border border-white/[0.08] rounded-tl-md shadow-sm'
            : 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-md shadow-md shadow-violet-500/20'
        }`}>
          {msg.text}
        </div>

        {/* Bottom row: timestamp + copy */}
        <div className={`flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
          <span className="text-slate-600 text-[10px]">{msg.time || ''}</span>
          {isAI && (
            <button onClick={copy}
              className="flex items-center gap-0.5 text-[10px] text-slate-600 hover:text-slate-400 transition-colors">
              {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
              {copied ? 'Disalin!' : 'Salin'}
            </button>
          )}
        </div>
      </div>

      {/* User avatar */}
      {!isAI && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-amber-500/30">
          <span className="text-white text-[10px] font-bold">U</span>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function AIChatbot() {
  const { user } = useAuthStore()
  const firstName = user?.name?.split(' ')[0] || 'User'

  const initMsg = {
    role: 'ai',
    text: `Halo ${firstName}! 👋\n\nSaya AI Asisten WMS LUTFHI. Saya terhubung ke data sistem secara real-time.\n\nTanyakan apa saja tentang:\n📦 Stok & inventaris\n🚨 Item kritis\n💰 Anggaran & invoice\n🛒 Purchase Order\n📊 Laporan & ringkasan`,
    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  }

  const [open,      setOpen]      = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [messages,  setMessages]  = useState([initMsg])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)

  const chatRef  = useRef(null)
  const inputRef = useRef(null)

  const chips = QUICK_CHIPS[user?.role] || QUICK_CHIPS.admin

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, loading])

  // Focus input on open
  useEffect(() => {
    if (open && !minimized && inputRef.current) inputRef.current.focus()
  }, [open, minimized])

  const send = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    const userMsg = { role: 'user', text: msg, time: now }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    // Build history (exclude init message, keep last 10)
    const history = messages.slice(1, -0).slice(-10).map(m => ({ role: m.role, text: m.text }))

    try {
      const res = await api.post('/ai/chat', { message: msg, history })
      const reply = res?.data?.reply || res?.reply || 'Maaf, tidak mendapat respons.'
      const aiTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      setMessages(prev => [...prev, { role: 'ai', text: reply, time: aiTime }])
    } catch (e) {
      setError('Gagal terhubung ke AI. Coba lagi.')
      setMessages(prev => [...prev, {
        role: 'ai',
        text: '❌ Gagal menghubungi AI. Periksa koneksi atau coba beberapa saat lagi.',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      }])
    } finally {
      setLoading(false)
    }
  }, [input, messages, loading])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const clearChat = () => {
    setMessages([{ ...initMsg, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }])
    setError(null)
  }

  if (!user) return null

  const CSS = `
    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30%            { transform: translateY(-6px); opacity: 1; }
    }
    @keyframes msgSlideIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes chatSlideUp {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes fabPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.4); }
      50%       { box-shadow: 0 0 0 10px rgba(139,92,246,0); }
    }
  `

  return (
    <>
      <style>{CSS}</style>

      {/* ── Floating Action Button ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            boxShadow: '0 8px 24px rgba(124,58,237,0.45)',
            animation: 'fabPulse 2.5s ease-in-out infinite',
          }}
          title="AI Asisten WMS">
          <Bot size={24} className="text-white" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#0A0F1E] animate-pulse" />
        </button>
      )}

      {/* ── Chat Window ── */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl overflow-hidden border border-white/[0.1]"
          style={{
            width: 400, maxWidth: 'calc(100vw - 2rem)',
            height: minimized ? 60 : 560, maxHeight: 'calc(100vh - 4rem)',
            background: 'linear-gradient(165deg, rgba(13,18,35,0.98) 0%, rgba(10,14,28,0.99) 100%)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
            animation: 'chatSlideUp 0.3s cubic-bezier(.22,.68,0,1.2)',
            transition: 'height 0.3s cubic-bezier(.22,.68,0,1.2)',
          }}>

          {/* ── Header ── */}
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 border-b border-white/[0.07]"
            style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #312e81 100%)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
              <Sparkles size={17} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm leading-tight">AI Asisten WMS</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-white/60 text-[11px]">Online · Data real-time</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={clearChat}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 text-white/60 hover:text-white transition-colors"
                title="Bersihkan chat">
                <Trash2 size={13} />
              </button>
              <button onClick={() => setMinimized(!minimized)}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 text-white/60 hover:text-white transition-colors"
                title={minimized ? 'Perluas' : 'Kecilkan'}>
                {minimized ? <ChevronDown size={13} style={{ transform: 'rotate(180deg)' }} /> : <Minus size={13} />}
              </button>
              <button onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/15 text-white/60 hover:text-white transition-colors"
                title="Tutup">
                <X size={13} />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* ── Messages area ── */}
              <div ref={chatRef} className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3"
                style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.1) 100%)' }}>
                {messages.map((m, i) => (
                  <MessageBubble key={i} msg={m} isLatest={i === messages.length - 1} />
                ))}
                {loading && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles size={13} className="text-white" />
                    </div>
                    <div className="bg-white/[0.07] border border-white/[0.08] rounded-2xl rounded-tl-md text-sm"
                      style={{ animation: 'msgSlideIn 0.2s ease-out' }}>
                      <TypingDots />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Quick chips ── */}
              <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto scrollbar-none flex-shrink-0">
                {chips.map((chip, ci) => (
                  <button key={ci}
                    onClick={() => send(chip)}
                    disabled={loading}
                    className="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-violet-500/30 text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 hover:border-violet-500/50 transition-all disabled:opacity-40 whitespace-nowrap"
                    style={{ minHeight: 'auto', minWidth: 'auto' }}>
                    {chip}
                  </button>
                ))}
              </div>

              {/* ── Input area ── */}
              <div className="px-3 pb-3 flex-shrink-0 border-t border-white/[0.06] pt-2">
                <div className="flex items-end gap-2 rounded-xl px-3 py-2 border transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Tanya sesuatu tentang WMS..."
                    disabled={loading}
                    rows={1}
                    className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 outline-none resize-none disabled:opacity-50 leading-relaxed"
                    style={{ maxHeight: 80, minHeight: 'auto', minWidth: 0, border: 'none', boxShadow: 'none' }}
                    onInput={e => {
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
                    }}
                  />
                  <button
                    onClick={() => send()}
                    disabled={!input.trim() || loading}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all flex-shrink-0 disabled:opacity-30"
                    style={{
                      background: input.trim() && !loading
                        ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                        : 'rgba(255,255,255,0.06)',
                      minHeight: 32, minWidth: 32,
                    }}>
                    {loading
                      ? <Loader2 size={14} className="animate-spin text-slate-400" />
                      : <Send size={14} className={input.trim() ? 'text-white' : 'text-slate-400'} />
                    }
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5 px-1">
                  <p className="text-slate-600 text-[10px]">
                    ✨ Powered by Groq LLaMA · Data sesuai role Anda
                  </p>
                  <span className={`text-[10px] ${input.length > 400 ? 'text-rose-400' : 'text-slate-600'}`}>
                    {input.length}/500
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
