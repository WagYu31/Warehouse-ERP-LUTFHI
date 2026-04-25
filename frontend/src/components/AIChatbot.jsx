import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, X, Send, Sparkles, Loader2, Copy, Check, Trash2, ChevronDown, Minus } from 'lucide-react'
import api from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'

// ── Quick suggestion chips per role ──────────────────────────
const QUICK_CHIPS = {
  admin:               ['📈 Barang apa yang perlu diperbanyak?', '📉 Barang slow-moving apa?', '🚨 Item kritis sekarang?', '📊 Ringkasan inventaris'],
  staff:               ['📈 Barang fast-moving?', '📉 Dead stock ada?', '🚨 Item hampir habis?', '📋 SPB pending berapa?'],
  finance_procurement: ['💰 Sisa anggaran berapa?', '📄 Invoice belum dibayar?', '📈 Rekomen restock apa?', '🚨 Ada invoice overdue?'],
  manager:             ['📊 Analisis pergerakan barang?', '📈 Rekomen perbanyak stok?', '📉 Barang yang harus dikurangi?', '💰 Status anggaran?'],
}

// ── Typing dots animation ─────────────────────────────────────
function TypingDots({ isLight }) {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map(i => (
        <div key={i}
          className={`w-2 h-2 rounded-full ${isLight ? 'bg-slate-400' : 'bg-slate-500'}`}
          style={{ animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </div>
  )
}

// ── Individual message bubble ─────────────────────────────────
function MessageBubble({ msg, isLight }) {
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
            ? isLight
              ? 'bg-slate-100 text-slate-800 border border-slate-200 rounded-tl-md shadow-sm'
              : 'bg-white/[0.07] text-slate-200 border border-white/[0.08] rounded-tl-md shadow-sm'
            : 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-md shadow-md shadow-violet-500/20'
        }`}>
          {msg.text}
        </div>

        {/* Timestamp + copy */}
        <div className={`flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
          <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>{msg.time || ''}</span>
          {isAI && (
            <button onClick={copy}
              className={`flex items-center gap-0.5 text-[10px] ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-600 hover:text-slate-400'} transition-colors`}
              style={{ minHeight: 'auto', minWidth: 'auto' }}>
              {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
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
  const { user }  = useAuthStore()
  const { theme } = useThemeStore()
  const isLight   = theme === 'light'

  const firstName = user?.name?.split(' ')[0] || 'User'

  const makeInitMsg = () => ({
    role: 'ai',
    text: `Halo ${firstName}! 👋\n\nSaya AI Asisten WMS LUTFHI. Saya terhubung ke data sistem secara real-time.\n\nTanyakan apa saja tentang:\n📦 Stok & inventaris\n🚨 Item kritis\n💰 Anggaran & invoice\n🛒 Purchase Order\n📊 Laporan & ringkasan`,
    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  })

  const [open,      setOpen]      = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [messages,  setMessages]  = useState([makeInitMsg()])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)

  const chatRef  = useRef(null)
  const inputRef = useRef(null)
  const chips    = QUICK_CHIPS[user?.role] || QUICK_CHIPS.admin

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, loading])

  useEffect(() => {
    if (open && !minimized && inputRef.current) inputRef.current.focus()
  }, [open, minimized])

  const send = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    const now    = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    const userMsg = { role: 'user', text: msg, time: now }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const history = messages.slice(1).slice(-10).map(m => ({ role: m.role, text: m.text }))
    try {
      const res   = await api.post('/ai/chat', { message: msg, history })
      const reply = res?.data?.reply || res?.reply || 'Maaf, tidak mendapat respons.'
      const aiTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      setMessages(prev => [...prev, { role: 'ai', text: reply, time: aiTime }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: '❌ Gagal menghubungi AI. Periksa koneksi atau coba beberapa saat lagi.',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      }])
    } finally {
      setLoading(false)
    }
  }, [input, messages, loading])

  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
  const clearChat = () => setMessages([makeInitMsg()])

  if (!user) return null

  // ── Theme-aware tokens ────────────────────────────────────
  const T = {
    window:    isLight
      ? 'background:#FFFFFF; border:1px solid #E2E8F0; box-shadow:0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06);'
      : 'background:linear-gradient(165deg,rgba(13,18,35,0.98) 0%,rgba(10,14,28,0.99) 100%); border:1px solid rgba(255,255,255,0.08); box-shadow:0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06); backdrop-filter:blur(20px);',
    messages:  isLight ? 'background:#F8FAFC;' : 'background:linear-gradient(180deg,transparent 0%,rgba(0,0,0,0.1) 100%);',
    inputWrap:  isLight
      ? 'background:#F1F5F9; border-color:#CBD5E1;'
      : 'background:rgba(255,255,255,0.04); border-color:rgba(255,255,255,0.08);',
    inputFocus: isLight ? '#3B82F6' : 'rgba(139,92,246,0.5)',
    input:      isLight ? 'color:#1E293B;' : 'color:#E2E8F0;',
    footer:     isLight ? 'border-color:#E2E8F0;' : 'border-color:rgba(255,255,255,0.06);',
    footerText: isLight ? 'color:#94A3B8;' : 'color:#4B5563;',
    chip:       isLight
      ? 'border-color:#DDD6FE; color:#6D28D9; background:#EDE9FE;'
      : 'border-color:rgba(139,92,246,0.3); color:#A78BFA; background:rgba(139,92,246,0.1);',
    chipHover:  isLight ? '#D8B4FE' : 'rgba(139,92,246,0.2)',
    btnDelete:  isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)',
    charCount:  isLight ? '#94A3B8' : '#4B5563',
  }

  const CSS = `
    @keyframes typingBounce {
      0%,60%,100% { transform:translateY(0); opacity:.4; }
      30%          { transform:translateY(-6px); opacity:1; }
    }
    @keyframes msgSlideIn {
      from { opacity:0; transform:translateY(8px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes chatSlideUp {
      from { opacity:0; transform:translateY(16px) scale(0.97); }
      to   { opacity:1; transform:translateY(0) scale(1); }
    }
    @keyframes fabPulse {
      0%,100% { box-shadow:0 0 0 0 rgba(124,58,237,0.4); }
      50%      { box-shadow:0 0 0 10px rgba(124,58,237,0); }
    }
    .ai-chip:hover { opacity:.85; }
    .ai-icon-btn { transition:background .15s; }
    .ai-icon-btn:hover { background:${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.15)'} !important; }
    .ai-input-wrap:focus-within { border-color:${T.inputFocus} !important; }
    .ai-scrollbar::-webkit-scrollbar { width:4px; }
    .ai-scrollbar::-webkit-scrollbar-thumb { background:${isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'}; border-radius:99px; }
  `

  return (
    <>
      <style>{CSS}</style>

      {/* ── FAB ── */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
          style={{ background:'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow:'0 8px 24px rgba(124,58,237,0.45)', animation:'fabPulse 2.5s ease-in-out infinite' }}
          title="AI Asisten WMS">
          <Bot size={24} className="text-white" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
        </button>
      )}

      {/* ── Chat Window ── */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl overflow-hidden"
          style={{
            width:400, maxWidth:'calc(100vw - 2rem)',
            height: minimized ? 60 : 560, maxHeight:'calc(100vh - 4rem)',
            cssText: T.window,
            // inline fallback (cssText doesn't work in React)
            ...(isLight
              ? { background:'#FFFFFF', border:'1px solid #E2E8F0', boxShadow:'0 20px 60px rgba(0,0,0,0.12)' }
              : { background:'linear-gradient(165deg,rgba(13,18,35,0.98) 0%,rgba(10,14,28,0.99) 100%)', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 24px 64px rgba(0,0,0,0.6)', backdropFilter:'blur(20px)' }),
            animation:'chatSlideUp 0.3s cubic-bezier(.22,.68,0,1.2)',
            transition:'height 0.3s cubic-bezier(.22,.68,0,1.2)',
          }}>

          {/* ── Header ── */}
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ background:'linear-gradient(135deg,#4c1d95 0%,#312e81 100%)', borderBottom: isLight ? '1px solid #3730a3' : '1px solid rgba(255,255,255,0.07)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background:'rgba(255,255,255,0.15)' }}>
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
              {[
                { title:'Bersihkan', icon:<Trash2 size={13} />, action: clearChat },
                { title: minimized ? 'Perluas' : 'Kecilkan',
                  icon: minimized ? <ChevronDown size={13} style={{ transform:'rotate(180deg)' }}/> : <Minus size={13}/>,
                  action: () => setMinimized(!minimized) },
                { title:'Tutup', icon:<X size={13} />, action: () => setOpen(false) },
              ].map((btn, bi) => (
                <button key={bi} onClick={btn.action} title={btn.title}
                  className="ai-icon-btn w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white"
                  style={{ background:'transparent', minHeight:'auto', minWidth:'auto' }}>
                  {btn.icon}
                </button>
              ))}
            </div>
          </div>

          {/* ── Body ── */}
          {!minimized && (
            <>
              {/* Messages */}
              <div ref={chatRef} className="flex-1 overflow-y-auto ai-scrollbar p-4 space-y-3"
                style={isLight ? { background:'#F8FAFC' } : { background:'transparent' }}>
                {messages.map((m, i) => (
                  <MessageBubble key={i} msg={m} isLight={isLight} />
                ))}
                {loading && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles size={13} className="text-white" />
                    </div>
                    <div className="rounded-2xl rounded-tl-md text-sm"
                      style={isLight
                        ? { background:'#E2E8F0', border:'1px solid #CBD5E1' }
                        : { background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.08)' }}>
                      <TypingDots isLight={isLight} />
                    </div>
                  </div>
                )}
              </div>

              {/* Quick chips */}
              <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto flex-shrink-0"
                style={{ borderTop: isLight ? '1px solid #E2E8F0' : '1px solid rgba(255,255,255,0.05)', paddingTop:8 }}>
                {chips.map((chip, ci) => (
                  <button key={ci} onClick={() => send(chip)} disabled={loading}
                    className="ai-chip flex-shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition-all disabled:opacity-40 whitespace-nowrap"
                    style={{
                      minHeight:'auto', minWidth:'auto',
                      ...(isLight
                        ? { background:'#EDE9FE', borderColor:'#DDD6FE', color:'#5B21B6' }
                        : { background:'rgba(139,92,246,0.1)', borderColor:'rgba(139,92,246,0.3)', color:'#A78BFA' }),
                    }}>
                    {chip}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="px-3 pb-3 flex-shrink-0 pt-2"
                style={{ borderTop: isLight ? '1px solid #E2E8F0' : '1px solid rgba(255,255,255,0.06)' }}>
                <div className="ai-input-wrap flex items-end gap-2 rounded-xl px-3 py-2 border transition-all"
                  style={isLight
                    ? { background:'#F1F5F9', borderColor:'#CBD5E1' }
                    : { background:'rgba(255,255,255,0.04)', borderColor:'rgba(255,255,255,0.08)' }}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Tanya sesuatu tentang WMS..."
                    disabled={loading}
                    rows={1}
                    className="flex-1 bg-transparent text-sm outline-none resize-none disabled:opacity-50 leading-relaxed placeholder-slate-400"
                    style={{
                      maxHeight:80, minHeight:'auto', minWidth:0, border:'none', boxShadow:'none',
                      color: isLight ? '#1E293B' : '#E2E8F0',
                    }}
                    onInput={e => {
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
                    }}
                  />
                  <button onClick={() => send()} disabled={!input.trim() || loading}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all flex-shrink-0 disabled:opacity-30"
                    style={{
                      background: input.trim() && !loading ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : (isLight ? '#E2E8F0' : 'rgba(255,255,255,0.06)'),
                      minHeight:32, minWidth:32,
                    }}>
                    {loading
                      ? <Loader2 size={14} className={`animate-spin ${isLight ? 'text-slate-400' : 'text-slate-400'}`} />
                      : <Send size={14} className={input.trim() ? 'text-white' : (isLight ? 'text-slate-400' : 'text-slate-500')} />
                    }
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5 px-1">
                  <p className="text-[10px]" style={{ color: isLight ? '#94A3B8' : '#4B5563' }}>
                    ✨ Powered by Groq LLaMA · Data sesuai role Anda
                  </p>
                  <span className="text-[10px]" style={{ color: input.length > 400 ? '#EF4444' : (isLight ? '#94A3B8' : '#4B5563') }}>
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
