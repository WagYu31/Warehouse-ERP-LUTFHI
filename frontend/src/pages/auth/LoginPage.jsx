import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Package, Loader2, ShieldCheck, Cpu, Globe } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'

/* ── Floating particle component ── */
function Particle({ style }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        background: 'radial-gradient(circle, rgba(245,158,11,0.3) 0%, transparent 70%)',
        animation: `float ${3 + Math.random() * 3}s ease-in-out infinite`,
        animationDelay: `${Math.random() * 3}s`,
        ...style,
      }}
    />
  )
}

const PARTICLES = Array.from({ length: 8 }, (_, i) => ({
  width:  `${60 + Math.random() * 100}px`,
  height: `${60 + Math.random() * 100}px`,
  top:    `${Math.random() * 100}%`,
  left:   `${Math.random() * 100}%`,
  opacity: 0.15 + Math.random() * 0.2,
}))

const ROLE_LABELS = {
  admin:               '👑 Administrator',
  staff:               '📦 Warehouse Staff',
  requester:           '📋 Requester',
  finance_procurement: '💼 Finance & Procurement',
  manager:             '👁️ Manager / Viewer',
}

const FEATURES = [
  { icon: Package,    label: 'Multi-Gudang', desc: 'Real-time stok management' },
  { icon: Cpu,        label: 'ERP Terintegrasi', desc: 'Purchase Order & Invoice' },
  { icon: Globe,      label: 'PWA Mobile', desc: 'Works on any device' },
  { icon: ShieldCheck,label: 'ISO 27001 Security', desc: 'Enterprise-grade security' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading]         = useState(false)
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [lockUntil, setLockUntil]         = useState(null)

  // Auto-reset lockout after 2 menit
  useEffect(() => {
    if (!lockUntil) return
    const ms = lockUntil - Date.now()
    if (ms <= 0) { setLoginAttempts(0); setLockUntil(null); return }
    const t = setTimeout(() => { setLoginAttempts(0); setLockUntil(null) }, ms)
    return () => clearTimeout(t)
  }, [lockUntil])

  const { register, handleSubmit, formState: { errors }, setError, setValue } = useForm()

  /* Animated counter for stats */
  const [stats, setStats] = useState({ warehouses: 0, items: 0, users: 0 })
  useEffect(() => {
    const targets = { warehouses: 12, items: 4800, users: 240 }
    const duration = 1800
    const steps = 60
    const interval = duration / steps
    let step = 0
    const timer = setInterval(() => {
      step++
      const progress = step / steps
      const ease = 1 - Math.pow(1 - progress, 3)
      setStats({
        warehouses: Math.round(targets.warehouses * ease),
        items:      Math.round(targets.items * ease),
        users:      Math.round(targets.users * ease),
      })
      if (step >= steps) clearInterval(timer)
    }, interval)
    return () => clearInterval(timer)
  }, [])

  const onSubmit = async (data) => {
    if (lockUntil && Date.now() < lockUntil) {
      const sisa = Math.ceil((lockUntil - Date.now()) / 1000)
      toast.error(`Terlalu banyak percobaan. Tunggu ${sisa} detik.`)
      return
    }
    setIsLoading(true)
    try {
      const res = await api.post('/auth/login', data)
      // api interceptor sudah unwrap response.data → res = { message, token, user, refresh_token }
      setAuth(res.user, res.token, res.refresh_token)
      setLoginAttempts(0)
      setLockUntil(null)
      toast.success(`Selamat datang, ${res.user.name}! 👋`)
      navigate('/dashboard')
    } catch (err) {
      const newAttempts = loginAttempts + 1
      setLoginAttempts(newAttempts)
      if (newAttempts >= 5) {
        setLockUntil(Date.now() + 2 * 60 * 1000) // lock 2 menit
        toast.error('Terlalu banyak percobaan. Terkunci 2 menit.')
      } else {
        const msg = err.response?.data?.message || 'Email atau password salah'
        setError('password', { message: msg })
        toast.error(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex overflow-hidden bg-[#0A0F1E]">

      {/* ── LEFT PANEL — Hero ──────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/hero-bg.jpg)' }}
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950/80 via-navy-900/60 to-[#1a1040]/70" />
        {/* Particles */}
        {PARTICLES.map((p, i) => <Particle key={i} style={p} />)}

        {/* Content */}
        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 animate-fade-down">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-glow-gold">
              <img src="/logo.png" alt="WMS LUTFHI" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-display font-bold text-white text-xl tracking-tight">WMS LUTFHI</div>
              <div className="text-gold-400 text-xs font-semibold tracking-widest uppercase">Enterprise Edition</div>
            </div>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-gold-400 bg-gold-500/10 border border-gold-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
              v2.0 — Premium Edition
            </div>
            <h1 className="font-display text-5xl font-bold text-white leading-tight">
              Warehouse <br />
              <span className="text-gradient-gold">Management</span> <br />
              System
            </h1>
            <p className="text-slate-300 text-lg leading-relaxed max-w-md">
              Platform manajemen gudang terintegrasi dengan ERP Mini, real-time analytics, dan mobile PWA.
            </p>
          </div>

          {/* Feature chips */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.label}
                className="glass-card p-4 animate-fade-up"
                style={{ animationDelay: `${0.2 + i * 0.1}s` }}
              >
                <f.icon size={18} className="text-gold-400 mb-2" />
                <div className="text-white text-sm font-semibold">{f.label}</div>
                <div className="text-slate-400 text-xs">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative z-10 animate-fade-up" style={{ animationDelay: '0.6s' }}>
          <div className="glass-card p-5 flex items-center justify-around gap-6">
            {[
              { label: 'Gudang', value: stats.warehouses, suffix: '+' },
              { label: 'Item SKU', value: stats.items.toLocaleString('id'), suffix: '+' },
              { label: 'Pengguna', value: stats.users, suffix: '+' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-display text-2xl font-bold text-gradient-gold">
                  {s.value}{s.suffix}
                </div>
                <div className="text-slate-400 text-xs font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Login Form ───────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-md animate-fade-up">

          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center animate-fade-down">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-glow-gold">
              <img src="/logo.png" alt="WMS" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-display font-bold text-white text-lg">WMS LUTFHI</div>
              <div className="text-gold-400 text-xs font-semibold tracking-widest uppercase">Enterprise Edition</div>
            </div>
          </div>

          {/* Form Card */}
          <div className="glass-card p-8 sm:p-10">
            {/* Header */}
            <div className="mb-8">
              <h2 className="font-display text-2xl font-bold text-white mb-2">
                Selamat Datang
              </h2>
              <p className="text-slate-400 text-sm">
                Masuk ke sistem manajemen gudang Anda
              </p>
              {/* Gold divider */}
              <div className="mt-4 w-16 h-0.5 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

              {/* Email */}
              <div>
                <label className="label-premium" htmlFor="email">
                  Alamat Email
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="nama@perusahaan.com"
                    className={`input-premium ${errors.email ? 'error' : ''}`}
                    {...register('email', {
                      required: 'Email wajib diisi',
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Format email tidak valid' }
                    })}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1 animate-fade-down">
                    <span>⚠</span> {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="label-premium" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••••"
                    className={`input-premium pr-12 ${errors.password ? 'error' : ''}`}
                    {...register('password', {
                      required: 'Password wajib diisi',
                      minLength: { value: 6, message: 'Minimal 6 karakter' }
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-gold-400 transition-colors p-1"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    style={{ minHeight: 'unset', minWidth: 'unset' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1 animate-fade-down">
                    <span>⚠</span> {errors.password.message}
                  </p>
                )}
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-4 h-4 rounded border border-white/20 peer-checked:bg-gold-500 peer-checked:border-gold-500 transition-all" />
                  </div>
                  <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors select-none">
                    Ingat saya
                  </span>
                </label>
                <button type="button" className="text-xs text-gold-400 hover:text-gold-300 transition-colors font-medium" style={{ minHeight: 'unset', minWidth: 'unset' }}>
                  Lupa password?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                id="btn-login"
                className="btn btn-gold btn-full mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  <>
                    Masuk ke Sistem
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Demo credentials */}
            <div className="mt-6 pt-6 border-t border-white/5">
              <p className="text-center text-xs text-slate-500 mb-3 uppercase tracking-wide font-semibold">
                Demo Credentials
              </p>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { role: 'admin',               email: 'admin@wms-lutfhi.com',   pass: 'Admin@2026' },
                  { role: 'staff',                email: 'staff@wms-lutfhi.com',   pass: 'Staff@2026' },
                  { role: 'finance_procurement',  email: 'finance@wms-lutfhi.com', pass: 'Finance@2026' },
                  { role: 'manager',              email: 'manager@wms-lutfhi.com', pass: 'Manager@2026' },
                ].map((d) => (
                  <button
                    key={d.role}
                    type="button"
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs
                               bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06]
                               hover:border-gold-500/20 transition-all duration-200 text-left group"
                    style={{ minHeight: 'unset' }}
                    onClick={() => {
                      setValue('email', d.email, { shouldValidate: false })
                      setValue('password', d.pass, { shouldValidate: false })
                    }}
                  >
                    <span className="font-semibold text-white group-hover:text-gold-400 transition-colors">
                      {ROLE_LABELS[d.role]}
                    </span>
                    <span className="text-slate-500 font-mono text-2xs">{d.email}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-600 mt-6">
            WMS LUTFHI v2.0 &bull; ISO 9241 &bull; PWA
          </p>
        </div>
      </div>
    </div>
  )
}
