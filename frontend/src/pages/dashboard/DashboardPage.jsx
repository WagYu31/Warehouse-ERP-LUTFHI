import { useEffect, useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Package, TrendingDown, ArrowDownCircle, ArrowUpCircle,
  ClipboardList, AlertTriangle, DollarSign, Warehouse,
  TrendingUp, RefreshCcw, FileText, ShoppingCart, PiggyBank,
  BarChart3, Users, Truck, RotateCcw
} from 'lucide-react'
import api from '@/services/api'
import { useAuthStore } from '@/store/authStore'

// ══════════════════════════════════════════════════════════════
// ANIMATED POWER BI-style Line Chart
// ══════════════════════════════════════════════════════════════
const CHART_CSS = `
  @keyframes drawLine {
    0%   { stroke-dashoffset: 3000 }
    100% { stroke-dashoffset: 0 }
  }
  @keyframes fadeArea {
    0%   { opacity: 0 }
    40%  { opacity: 0 }
    100% { opacity: 1 }
  }
  @keyframes popDot {
    0%   { opacity: 0; transform: scale(0) }
    70%  { transform: scale(1.3) }
    100% { opacity: 1; transform: scale(1) }
  }
  @keyframes pulseRing {
    0%   { r: 8;  opacity: 0.18 }
    50%  { r: 14; opacity: 0.06 }
    100% { r: 8;  opacity: 0.18 }
  }
`

const PAGE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap');
  .dash-root { font-family: 'Inter', sans-serif; }
  @keyframes slideUpFade {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmerSweep {
    0%   { transform: translateX(-120%) skewX(-15deg); }
    100% { transform: translateX(220%) skewX(-15deg); }
  }
  @keyframes borderGlow {
    0%, 100% { opacity: 0.4; }
    50%       { opacity: 1; }
  }
  @keyframes floatBadge {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-3px); }
  }
  @keyframes gradientText {
    0%   { background-position: 0% 50%; }
    100% { background-position: 100% 50%; }
  }
  .stat-card { animation: slideUpFade 0.5s cubic-bezier(.22,.68,0,1.2) both; }
  .stat-card:hover .shimmer-sweep { animation: shimmerSweep 0.7s ease; }
  .action-link:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
  .action-link { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease; }
  .role-badge { animation: floatBadge 3s ease-in-out infinite; }
  .section-in { animation: slideUpFade 0.5s cubic-bezier(.22,.68,0,1.2) both; }
`

function SvgLineChart({ series, labels, height = 280 }) {
  const svgRef   = useRef(null)
  const [hover, setHover] = useState(null)   // { idx, svgX, svgY }
  const [ready, setReady] = useState(false)

  // Trigger animation on mount
  useEffect(() => { const t = setTimeout(() => setReady(true), 100); return () => clearTimeout(t) }, [])

  const VW = 800, VH = height
  const PAD = { top: 28, right: 36, bottom: 52, left: 80 }
  const cw  = VW - PAD.left - PAD.right
  const ch  = VH - PAD.top  - PAD.bottom

  const allVals = series.flatMap(s => s.data)
  const rawMax  = Math.max(...allVals, 1)
  const mag     = Math.pow(10, Math.floor(Math.log10(rawMax)))
  const maxV    = Math.ceil(rawMax / mag) * mag

  const toX = i => PAD.left + (i / Math.max(labels.length - 1, 1)) * cw
  const toY = v => PAD.top  + ch - (v / maxV) * ch

  const fmtV = v =>
    v >= 1e9 ? `Rp ${(v/1e9).toFixed(2)} M`
    : v >= 1e6 ? `Rp ${(v/1e6).toFixed(1)} Jt`
    : v >= 1e3 ? `Rp ${(v/1e3).toFixed(0)} K`
    : `Rp ${Math.round(v)}`

  const fmtY = v =>
    v >= 1e9 ? `${(v/1e9).toFixed(1)}M`
    : v >= 1e6 ? `${(v/1e6).toFixed(0)} Jt`
    : v >= 1e3 ? `${(v/1e3).toFixed(0)}K`
    : String(Math.round(v))

  const bezier = (pts) => {
    if (!pts.length) return ''
    if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i-1], [x1, y1] = pts[i]
      const cpx = ((x0 + x1) / 2).toFixed(1)
      d += ` C ${cpx} ${y0.toFixed(1)} ${cpx} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`
    }
    return d
  }

  const linePath = data => bezier(data.map((v, i) => [toX(i), toY(v)]))
  const areaPath = data => {
    const pts = data.map((v, i) => [toX(i), toY(v)])
    return `${bezier(pts)} L ${toX(data.length-1).toFixed(1)} ${(PAD.top+ch).toFixed(1)} L ${PAD.left.toFixed(1)} ${(PAD.top+ch).toFixed(1)} Z`
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ val: maxV * f, y: toY(maxV * f) }))
  const uid = useMemo(() => Math.random().toString(36).slice(2,6), [])

  // Mouse → nearest X index
  const onMouseMove = e => {
    const el = svgRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px   = (e.clientX - rect.left)
    const svgX = (px / rect.width) * (VW)
    let bestI = 0, bestD = Infinity
    labels.forEach((_, i) => { const d = Math.abs(toX(i) - svgX); if (d < bestD) { bestD = d; bestI = i } })
    setHover({ idx: bestI, px })
  }

  // Tooltip position (keep inside bounds)
  const tipW = 170, tipX = hover
    ? Math.min(Math.max(toX(hover.idx) - tipW / 2, PAD.left), PAD.left + cw - tipW)
    : 0

  return (
    <div className="relative w-full" style={{ height }}>
      <style>{CHART_CSS}</style>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full h-full cursor-crosshair"
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHover(null)}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {series.map((s, si) => [
            <linearGradient key={`ag${si}`} id={`ag${uid}${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity="0.5" />
              <stop offset="50%"  stopColor={s.color} stopOpacity="0.12" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>,
            <filter key={`gf${si}`} id={`gf${uid}${si}`} x="-30%" y="-80%" width="160%" height="280%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>,
          ])}
          <clipPath id={`cc${uid}`}>
            <rect x={PAD.left} y={PAD.top - 8} width={cw} height={ch + 8} />
          </clipPath>
          <filter id={`tipShadow${uid}`} x="-10%" y="-15%" width="120%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* ── Column banding ── */}
        {labels.map((_, i) => i % 2 === 1 ? (
          <rect key={i}
            x={toX(i) - (toX(1)-toX(0))/2} y={PAD.top}
            width={toX(1)-toX(0)} height={ch}
            fill="rgba(255,255,255,0.016)" />
        ) : null)}

        {/* ── Y grid ── */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={t.y} x2={PAD.left+cw} y2={t.y}
              stroke={i===0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}
              strokeWidth={i===0 ? 1.2 : 0.7}
              strokeDasharray={i===0 ? '' : '6,5'} />
            <text x={PAD.left-12} y={t.y+4} textAnchor="end"
              fill="#4B5563" fontSize="12" fontFamily="Inter,sans-serif">
              {fmtY(t.val)}
            </text>
          </g>
        ))}

        {/* ── V grid ── */}
        {labels.map((_, i) => (
          <line key={i} x1={toX(i)} y1={PAD.top} x2={toX(i)} y2={PAD.top+ch}
            stroke="rgba(255,255,255,0.025)" strokeWidth="0.7" />
        ))}

        {/* ── Area fills (animated fade) ── */}
        <g clipPath={`url(#cc${uid})`}>
          {series.map((s, si) => (
            <path key={si} d={areaPath(s.data)} fill={`url(#ag${uid}${si})`}
              style={ready ? {
                animation: `fadeArea ${1.2 + si * 0.2}s ease-out both`,
              } : { opacity: 0 }}
            />
          ))}
        </g>

        {/* ── Lines (animated draw) ── */}
        <g clipPath={`url(#cc${uid})`}>
          {series.map((s, si) => (
            <g key={si}>
              {/* outer bloom */}
              <path d={linePath(s.data)} fill="none" stroke={s.color}
                strokeWidth="9" opacity="0.1"
                strokeLinejoin="round" strokeLinecap="round"
                style={ready ? {
                  strokeDasharray: 3000,
                  animation: `drawLine ${1.3 + si*0.15}s cubic-bezier(.4,0,.2,1) ${si*0.1}s both`,
                } : { strokeDasharray: 3000, strokeDashoffset: 3000 }}
              />
              {/* main line */}
              <path d={linePath(s.data)} fill="none" stroke={s.color}
                strokeWidth="2.8"
                strokeLinejoin="round" strokeLinecap="round"
                filter={`url(#gf${uid}${si})`}
                style={ready ? {
                  strokeDasharray: 3000,
                  animation: `drawLine ${1.3 + si*0.15}s cubic-bezier(.4,0,.2,1) ${si*0.1}s both`,
                } : { strokeDasharray: 3000, strokeDashoffset: 3000 }}
              />
            </g>
          ))}
        </g>

        {/* ── Hover vertical line ── */}
        {hover && (
          <line
            x1={toX(hover.idx)} y1={PAD.top}
            x2={toX(hover.idx)} y2={PAD.top+ch}
            stroke="rgba(255,255,255,0.22)" strokeWidth="1.2"
            strokeDasharray="5,4"
          />
        )}

        {/* ── X axis labels ── */}
        {labels.map((lbl, i) => (
          <text key={i} x={toX(i)} y={VH-12} textAnchor="middle"
            fill={hover?.idx === i ? 'var(--chart-label-hover, #e2e8f0)' : '#6B7280'}
            fontSize="12.5" fontFamily="Inter,sans-serif" fontWeight={hover?.idx===i?'600':'400'}
            style={{ transition: 'fill .15s' }}>
            {lbl}
          </text>
        ))}

        {/* ── Data dots ── */}
        {series.map((s, si) =>
          s.data.map((v, i) => (
            <g key={`${si}-${i}`}
              style={ready ? {
                transformOrigin: `${toX(i)}px ${toY(Math.max(v,0))}px`,
                animation: `popDot 0.4s ease-out ${0.9 + si*0.1 + i*0.04}s both`,
              } : { opacity: 0 }}>
              {v > 0 ? (
                <>
                  {/* outer pulse ring */}
                  <circle cx={toX(i)} cy={toY(v)} r="9" fill={s.color}
                    style={{ animation: hover?.idx===i ? 'pulseRing 1.5s ease-in-out infinite' : 'none' }}
                    opacity={hover?.idx===i ? 0.18 : 0.08}
                  />
                  <circle cx={toX(i)} cy={toY(v)} r="5"  fill={s.color} opacity="0.3" />
                  <circle cx={toX(i)} cy={toY(v)} r="3.5" fill={s.color} stroke="#0b1120" strokeWidth="1.5" />
                  <circle cx={toX(i)} cy={toY(v)} r="1.3" fill="white"  opacity="0.9" />
                </>
              ) : (
                <circle cx={toX(i)} cy={toY(0)} r="2.5" fill={s.color} opacity="0.15" />
              )}
            </g>
          ))
        )}

        {/* ── Tooltip ── */}
        {hover && (() => {
          const tipH  = 18 + series.length * 22
          const tipY  = Math.max(PAD.top, Math.min(toY(Math.max(...series.map(s=>s.data[hover.idx]||0))), PAD.top + ch - tipH - 10))
          return (
            <g>
              {/* shadow rect */}
              <rect x={tipX-1} y={tipY-1} width={tipW+2} height={tipH+2}
                rx="9" fill="black" opacity="0.4" filter={`url(#tipShadow${uid})`} />
              {/* body */}
              <rect x={tipX} y={tipY} width={tipW} height={tipH}
                rx="8" fill="#141c2e" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
              {/* label */}
              <text x={tipX+10} y={tipY+15} fill="#94a3b8" fontSize="10.5" fontFamily="Inter,sans-serif" fontWeight="600">
                {labels[hover.idx]}
              </text>
              {/* series rows */}
              {series.map((s, si) => (
                <g key={si}>
                  <circle cx={tipX+13} cy={tipY+26+si*22} r="4" fill={s.color} />
                  <text x={tipX+22} y={tipY+30+si*22} fill="#cbd5e1" fontSize="11" fontFamily="Inter,sans-serif" fontWeight="400">
                    {s.label}:
                  </text>
                  <text x={tipX+tipW-10} y={tipY+30+si*22} textAnchor="end"
                    fill={s.color} fontSize="11.5" fontFamily="Inter,sans-serif" fontWeight="700">
                    {fmtV(s.data[hover.idx] || 0)}
                  </text>
                </g>
              ))}
            </g>
          )
        })()}

        {/* ── X baseline ── */}
        <line x1={PAD.left} y1={PAD.top+ch} x2={PAD.left+cw} y2={PAD.top+ch}
          stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      </svg>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Premium Stat Card
// ══════════════════════════════════════════════════════════════
const CARD_CFG = {
  gold:   { g:'from-amber-500/30 via-yellow-600/10 to-transparent',  b:'border-amber-500/35',  t:'text-amber-400',   glow:'234,179,8',   bg:'bg-amber-500/15' },
  red:    { g:'from-rose-500/30 via-red-600/10 to-transparent',      b:'border-rose-500/35',   t:'text-rose-400',    glow:'244,63,94',   bg:'bg-rose-500/15' },
  blue:   { g:'from-blue-500/30 via-cyan-600/10 to-transparent',     b:'border-blue-500/35',   t:'text-blue-400',    glow:'59,130,246',  bg:'bg-blue-500/15' },
  green:  { g:'from-emerald-500/30 via-teal-600/10 to-transparent',  b:'border-emerald-500/35',t:'text-emerald-400', glow:'16,185,129',  bg:'bg-emerald-500/15' },
  purple: { g:'from-violet-500/30 via-purple-600/10 to-transparent', b:'border-violet-500/35', t:'text-violet-400',  glow:'139,92,246',  bg:'bg-violet-500/15' },
  orange: { g:'from-orange-500/30 via-red-600/10 to-transparent',    b:'border-orange-500/35', t:'text-orange-400',  glow:'249,115,22',  bg:'bg-orange-500/15' },
}
function StatCard({ icon: Icon, label, value, sub, color = 'gold', delay = 0 }) {
  const c = CARD_CFG[color] || CARD_CFG.gold
  return (
    <div className={`stat-card relative rounded-2xl border bg-gradient-to-br overflow-hidden group cursor-default ${c.g} ${c.b}`}
      style={{ animationDelay: `${delay}s`, boxShadow: `0 0 0 0 rgba(${c.glow},0)`, transition: 'box-shadow .3s ease' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow=`0 0 28px rgba(${c.glow},0.18)`}
      onMouseLeave={e => e.currentTarget.style.boxShadow=`0 0 0 0 rgba(${c.glow},0)`}>
      {/* Shimmer sweep on hover */}
      <div className="shimmer-sweep absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent -translate-x-full skew-x-[-15deg] pointer-events-none" />
      {/* Ambient glow blob */}
      <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-40 ${c.bg}`} />
      {/* Big ghost icon */}
      <div className="absolute bottom-2 right-3 opacity-[0.06]"><Icon size={56} /></div>
      <div className="relative p-5">
        {/* Icon badge */}
        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${c.bg} border ${c.b} mb-4`}>
          <Icon size={18} className={c.t} />
        </div>
        {/* Label */}
        <p className="text-slate-400 text-[11px] font-semibold tracking-widest uppercase mb-1.5">{label}</p>
        {/* Value */}
        <p className={`text-2xl font-black leading-none ${c.t}`}
          style={{ fontFamily: "'Space Grotesk',sans-serif", textShadow: `0 0 24px rgba(${c.glow},0.35)` }}>
          {value ?? '—'}
        </p>
        {sub && <p className="text-slate-500 text-xs mt-2 leading-snug">{sub}</p>}
        {/* Bottom accent */}
        <div className={`absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent ${c.bg} to-transparent opacity-70`} />
      </div>
    </div>
  )
}

function RecentRow({ item, delay = 0 }) {
  const sc = {
    confirmed: { cls:'text-emerald-400 bg-emerald-500/15 border border-emerald-500/25', dot:'bg-emerald-400' },
    pending:   { cls:'text-amber-400 bg-amber-500/15 border border-amber-500/25',       dot:'bg-amber-400' },
    rejected:  { cls:'text-rose-400 bg-rose-500/15 border border-rose-500/25',          dot:'bg-rose-400' },
  }
  const s = sc[item.status] || { cls:'text-slate-400 bg-white/[0.05] border border-white/10', dot:'bg-slate-400' }
  return (
    <div className="section-in flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] rounded-lg px-2 -mx-2 transition-colors"
      style={{ animationDelay: `${delay}s` }}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <ArrowDownCircle size={14} className="text-blue-400" />
        </div>
        <div>
          <div className="text-white text-sm font-semibold" style={{ fontFamily:"'Space Grotesk',sans-serif" }}>{item.ref}</div>
          <div className="text-slate-500 text-xs mt-0.5">{item.date}</div>
        </div>
      </div>
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        {item.status}
      </div>
    </div>
  )
}

const ACTIONS = {
  admin: [
    { label: 'Catat Barang Masuk',  icon: ArrowDownCircle,  to: '/inbound',     color: 'text-blue-400 bg-blue-500/10' },
    { label: 'Catat Barang Keluar', icon: ArrowUpCircle,    to: '/outbound',    color: 'text-orange-400 bg-orange-500/10' },
    { label: 'Buat SPB',            icon: ClipboardList,    to: '/requests',    color: 'text-gold-400 bg-gold-500/10' },
    { label: 'Cek Inventaris',      icon: Package,          to: '/inventory',   color: 'text-emerald-400 bg-emerald-500/10' },
    { label: 'Stock Opname',        icon: RefreshCcw,       to: '/opname',      color: 'text-purple-400 bg-purple-500/10' },
    { label: 'Kelola Pengguna',     icon: Users,            to: '/admin/users', color: 'text-cyan-400 bg-cyan-500/10' },
  ],
  staff: [
    { label: 'Catat Barang Masuk',  icon: ArrowDownCircle,  to: '/inbound',         color: 'text-blue-400 bg-blue-500/10' },
    { label: 'Catat Barang Keluar', icon: ArrowUpCircle,    to: '/outbound',        color: 'text-orange-400 bg-orange-500/10' },
    { label: 'Cek Inventaris',      icon: Package,          to: '/inventory',       color: 'text-emerald-400 bg-emerald-500/10' },
    { label: 'Stock Opname',        icon: RefreshCcw,       to: '/opname',          color: 'text-purple-400 bg-purple-500/10' },
    { label: 'Transfer Stok',       icon: Truck,            to: '/stock-transfers', color: 'text-cyan-400 bg-cyan-500/10' },
    { label: 'Retur Barang',        icon: RotateCcw,        to: '/returns',         color: 'text-red-400 bg-red-500/10' },
  ],
  finance_procurement: [
    { label: 'Purchase Order', icon: ShoppingCart,  to: '/erp/purchase-orders', color: 'text-purple-400 bg-purple-500/10' },
    { label: 'Invoice',        icon: FileText,      to: '/erp/invoices',        color: 'text-emerald-400 bg-emerald-500/10' },
    { label: 'Budget',         icon: PiggyBank,     to: '/erp/budget',          color: 'text-gold-400 bg-gold-500/10' },
    { label: 'Supplier',       icon: Users,         to: '/erp/suppliers',       color: 'text-blue-400 bg-blue-500/10' },
    { label: 'Laporan ERP',    icon: BarChart3,     to: '/erp/reports',         color: 'text-orange-400 bg-orange-500/10' },
    { label: 'Reorder Point',  icon: AlertTriangle, to: '/erp/reorder',         color: 'text-red-400 bg-red-500/10' },
  ],
  manager: [
    { label: 'Laporan Stok',   icon: BarChart3,     to: '/reports',                 color: 'text-blue-400 bg-blue-500/10' },
    { label: 'Laporan ERP',    icon: DollarSign,    to: '/erp/reports',             color: 'text-emerald-400 bg-emerald-500/10' },
    { label: 'Cek Inventaris', icon: Package,       to: '/inventory',               color: 'text-purple-400 bg-purple-500/10' },
    { label: 'Item Kritis',    icon: AlertTriangle, to: '/inventory?filter=kritis', color: 'text-red-400 bg-red-500/10' },
  ],
}

const ROLE_INFO = {
  admin:               { label: 'Administrator',        desc: 'Kendali penuh atas seluruh modul WMS & ERP',               emoji: '👑' },
  staff:               { label: 'Warehouse Staff',      desc: 'Kelola operasional barang masuk, keluar, dan stok opname', emoji: '📦' },
  finance_procurement: { label: 'Finance & Procurement',desc: 'Kelola purchase order, invoice, dan anggaran',             emoji: '💰' },
  manager:             { label: 'Manager / Viewer',     desc: 'Pantau ringkasan operasional dan laporan',                  emoji: '📊' },
}

const CHART_SERIES_CFG = [
  { label: 'Invoice', color: '#a78bfa', key: 'trendInvoice', total: 'totalInvoiceVal' },
  { label: 'Dibayar', color: '#34d399', key: 'trendPaid',    total: 'totalPaidVal' },
  { label: 'PO',      color: '#60a5fa', key: 'trendPO',      total: 'totalPOVal' },
]

// ══════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { user } = useAuthStore()
  const [stats,        setStats]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [financeStats, setFinanceStats] = useState(null)
  const [rawERP,       setRawERP]       = useState({ pos: [], invs: [] })
  const [chartYear,    setChartYear]    = useState(new Date().getFullYear())
  const [hiddenSeries, setHiddenSeries] = useState({})

  const role     = user?.role || 'staff'
  const roleInfo = ROLE_INFO[role] || ROLE_INFO.staff
  const actions  = ACTIONS[role] || ACTIONS.staff
  const toggleSeries = key => setHiddenSeries(h => ({ ...h, [key]: !h[key] }))

  const fetchStats = async () => {
    try {
      const res = await api.get('/dashboard/stats')
      setStats(res.data)

      if (role === 'finance_procurement' || role === 'admin') {
        const [poRes, invRes, budRes] = await Promise.all([
          api.get('/erp/purchase-orders').catch(() => ({ data: [] })),
          api.get('/erp/invoices').catch(()        => ({ data: [] })),
          api.get('/erp/budgets').catch(()         => ({ data: [] })),
        ])
        const pos  = Array.isArray(poRes)  ? poRes  : (poRes.data  || [])
        const invs = Array.isArray(invRes) ? invRes : (invRes.data  || [])
        const buds = Array.isArray(budRes) ? budRes : (budRes.data  || [])

        // Detect default year from latest data
        const allDates = [
          ...invs.map(i => i.invoice_date||''),
          ...pos.map(p => p.order_date||''),
        ].filter(Boolean).sort().reverse()
        const latestYear = allDates[0] ? +allDates[0].slice(0,4) : new Date().getFullYear()
        setChartYear(latestYear)
        setRawERP({ pos, invs })

        setFinanceStats({
          totalPO:       pos.length,
          poPending:     pos.filter(p => p.status==='draft'||p.status==='sent').length,
          totalInvoice:  invs.length,
          invoiceUnpaid: invs.filter(i => i.status==='unpaid'||i.status==='overdue').length,
          totalBudget:   buds.reduce((a,b) => a+(+b.total_budget||+b.total||0), 0),
          usedBudget:    buds.reduce((a,b) => a+(+b.used_budget||+b.spent||0), 0),
        })
      }
    } catch {
      setStats({ total_items:0, critical_items:0, total_suppliers:0, pending_requests:0, stock_value:0, recent_transactions:[] })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  const fmt         = n => Number(n||0).toLocaleString('id-ID')
  const fmtCurrency = n => 'Rp ' + Number(n||0).toLocaleString('id-ID')
  const fmtShort    = n => n>=1e9?`Rp ${(n/1e9).toFixed(1)} M`:n>=1e6?`Rp ${(n/1e6).toFixed(1)} Jt`:fmtCurrency(n)

  // ── Chart data keyed by selected year (12 months) ──
  const chartData = useMemo(() => {
    const { pos, invs } = rawERP
    const months = Array.from({ length: 12 }, (_, k) => {
      const d = new Date(chartYear, k, 1)
      return {
        key:   `${chartYear}-${String(k+1).padStart(2,'0')}`,
        label: d.toLocaleDateString('id-ID', { month: 'short' }),
      }
    })
    const byMonth = (arr, dateField, valField) =>
      months.map(m => arr.filter(r => (r[dateField]||'').startsWith(m.key)).reduce((s,r) => s+(+r[valField]||0), 0))

    const invYear = invs.filter(i => +(i.invoice_date||'').slice(0,4) === chartYear)
    const poYear  = pos.filter(p  => +(p.order_date||'').slice(0,4)   === chartYear)

    return {
      chartLabels:     months.map(m => m.label),
      trendInvoice:    byMonth(invs, 'invoice_date', 'total_amount'),
      trendPaid:       byMonth(invs.filter(i=>i.status==='paid'), 'invoice_date', 'total_amount'),
      trendPO:         byMonth(pos, 'order_date', 'total_amount'),
      totalInvoiceVal: invYear.reduce((a,i) => a+(+i.total_amount||0), 0),
      totalPaidVal:    invYear.filter(i=>i.status==='paid').reduce((a,i) => a+(+i.total_amount||0), 0),
      totalPOVal:      poYear.reduce((a,p) => a+(+p.total_amount||+p.total||0), 0),
    }
  }, [rawERP, chartYear])

  const getStatCards = () => {
    const base = [
      { icon: Package,       label: 'Total Item',  value: fmt(stats?.total_items),    color: 'blue' },
      { icon: AlertTriangle, label: 'Item Kritis', value: fmt(stats?.critical_items), color: 'red' },
    ]
    if (role === 'admin')   return [...base, { icon:Warehouse, label:'Supplier', value:fmt(stats?.total_suppliers), color:'purple'}, { icon:ClipboardList, label:'SPB Pending', value:fmt(stats?.pending_requests), color:'gold'}]
    if (role === 'staff')   return [...base, { icon:ArrowDownCircle, label:'Barang Masuk', value:fmt(stats?.recent_inbound||stats?.total_items), color:'green'}, { icon:ClipboardList, label:'SPB Pending', value:fmt(stats?.pending_requests), color:'gold'}]
    if (role === 'manager') return [...base, { icon:Warehouse, label:'Supplier', value:fmt(stats?.total_suppliers), color:'purple'}, { icon:DollarSign, label:'Nilai Stok', value:fmtCurrency(stats?.stock_value), color:'green'}]
    if (role === 'finance_procurement') return [
      { icon:ShoppingCart, label:'PO Pending',     value:fmt(financeStats?.poPending),                color:'purple' },
      { icon:FileText,     label:'Invoice Belum',  value:fmt(financeStats?.invoiceUnpaid),           color:'red' },
      { icon:DollarSign,   label:'Total Anggaran', value:fmtCurrency(financeStats?.totalBudget),     color:'gold', sub:`Terpakai: ${fmtCurrency(financeStats?.usedBudget)}` },
      { icon:Warehouse,    label:'Total Supplier', value:fmt(stats?.total_suppliers),                color:'blue' },
    ]
    return [...base, { icon:ArrowDownCircle, label:'Barang Masuk', value:fmt(stats?.recent_inbound||stats?.total_items), color:'green'}, { icon:ClipboardList, label:'SPB Pending', value:fmt(stats?.pending_requests), color:'gold'}]
  }

  // Budget utilization
  const budgetPct = financeStats
    ? Math.min(Math.round(((financeStats.usedBudget||0) / Math.max(financeStats.totalBudget||1, 1)) * 100), 100)
    : 0

  return (
    <div className="dash-root p-6 lg:p-8 space-y-7 min-h-full">
      <style>{PAGE_CSS}</style>

      {/* ── Greeting ── */}
      <div className="section-in" style={{ animationDelay:'0s' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-black text-white" style={{ fontFamily:"'Space Grotesk',sans-serif" }}>
            Selamat datang,{' '}
            <span style={{
              background:'linear-gradient(90deg,#f59e0b,#a78bfa,#34d399,#f59e0b)',
              backgroundSize:'200% auto', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              animation:'gradientText 4s linear infinite',
            }}>{user?.name}</span>{' '}{roleInfo.emoji}
          </h1>
          <span className="role-badge px-3.5 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-400 border border-amber-500/30" style={{ boxShadow:'0 0 16px rgba(234,179,8,0.12)' }}>
            {roleInfo.label}
          </span>
        </div>
        <p className="text-slate-500 text-sm mt-2 font-medium">
          {roleInfo.desc} &middot;{' '}
          <span className="text-slate-400">{new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>
        </p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {getStatCards().map((s, i) => <StatCard key={i} {...s} delay={0.08 * i} />)}
      </div>

      {/* ── Sisa Anggaran + Quick Actions ── */}
      <div className="section-in grid grid-cols-1 lg:grid-cols-3 gap-5" style={{ animationDelay:'0.2s' }}>

        {/* Sisa Anggaran / Nilai Stok */}
        <div className="lg:col-span-1 relative rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-yellow-600/5 to-transparent overflow-hidden p-6 flex flex-col justify-between"
          style={{ boxShadow:'0 0 32px rgba(234,179,8,0.06)' }}>
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full blur-3xl bg-amber-500/15" />
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/25">
                <DollarSign size={16} className="text-amber-400" />
              </div>
              <span className="text-white font-semibold text-sm" style={{ fontFamily:"'Space Grotesk',sans-serif" }}>
                {role==='finance_procurement' ? 'Sisa Anggaran' : 'Nilai Stok Gudang'}
              </span>
            </div>
            <p className="text-4xl font-black text-amber-400 break-all leading-none"
              style={{ fontFamily:"'Space Grotesk',sans-serif", textShadow:'0 0 30px rgba(234,179,8,0.25)' }}>
              {loading ? '—' : role==='finance_procurement'
                ? fmtShort((financeStats?.totalBudget||0)-(financeStats?.usedBudget||0))
                : fmtShort(stats?.stock_value||0)}
            </p>
            <p className="text-slate-500 text-xs mt-2">
              {role==='finance_procurement' ? 'Sisa dari total anggaran aktif' : 'Total estimasi nilai inventaris'}
            </p>
            {role === 'finance_procurement' && financeStats && (
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-500">Terpakai</span>
                  <span className="text-amber-400 font-bold">{budgetPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-1000"
                    style={{ width:`${budgetPct}%`, boxShadow:'0 0 8px rgba(234,179,8,0.4)' }} />
                </div>
              </div>
            )}
          </div>
          <div className="mt-5 flex items-center gap-2 text-emerald-400 text-xs font-medium">
            <TrendingUp size={13} /><span>Real-time · data aktif</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
          <h3 className="text-white font-bold text-sm mb-4" style={{ fontFamily:"'Space Grotesk',sans-serif" }}>⚡ Aksi Cepat</h3>
          <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3">
            {actions.map((a, ai) => (
              <Link key={a.to} to={a.to}
                className="action-link flex items-center gap-2.5 p-3 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]">
                <div className={`p-2 rounded-lg ${
                  a.color.includes('purple')?'bg-violet-500/15 border border-violet-500/25'
                  :a.color.includes('emerald')?'bg-emerald-500/15 border border-emerald-500/25'
                  :a.color.includes('gold')||a.color.includes('amber')?'bg-amber-500/15 border border-amber-500/25'
                  :a.color.includes('blue')||a.color.includes('cyan')?'bg-blue-500/15 border border-blue-500/25'
                  :a.color.includes('orange')?'bg-orange-500/15 border border-orange-500/25'
                  :'bg-rose-500/15 border border-rose-500/25'
                }`}><a.icon size={14} className={a.color.split(' ')[0]} /></div>
                <span className="text-slate-400 group-hover:text-white text-xs font-medium leading-snug">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Power BI Chart ── */}
      {role === 'finance_procurement' && chartData.chartLabels && (
        <div className="section-in rounded-2xl border border-white/[0.08] overflow-hidden" style={{
          animationDelay:'0.3s',
          background:'linear-gradient(145deg,rgba(255,255,255,0.025) 0%,rgba(255,255,255,0.01) 100%)',
          boxShadow:'0 20px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-white/[0.06]" style={{ background:'rgba(255,255,255,0.012)' }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-white font-bold text-base" style={{ fontFamily:"'Space Grotesk',sans-serif" }}>📈 Tren Keuangan</h3>
                <p className="text-slate-500 text-xs mt-0.5">Invoice · Pembayaran · Purchase Order · hover untuk nilai detail</p>
              </div>
              {/* Year dropdown */}
              <select value={chartYear} onChange={e => setChartYear(+e.target.value)}
                className="appearance-none pl-4 pr-9 py-2 rounded-xl text-xs font-bold border cursor-pointer focus:outline-none transition-all"
                style={{
                  background:'rgba(234,179,8,0.08)', color:'#fbbf24',
                  border:'1px solid rgba(234,179,8,0.3)', fontFamily:"'Space Grotesk',sans-serif",
                  backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23fbbf24' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center',
                }}>
                {Array.from({ length: new Date().getFullYear()-2015+1 }, (_, i) => 2015+i).reverse()
                  .map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {/* Series toggle */}
            <div className="flex gap-3 flex-wrap mt-4">
              {CHART_SERIES_CFG.map(s => (
                <button key={s.label} onClick={() => toggleSeries(s.key)}
                  className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all duration-200"
                  style={{
                    background: hiddenSeries[s.key] ? 'rgba(255,255,255,0.02)' : `${s.color}12`,
                    border: `1px solid ${hiddenSeries[s.key] ? 'rgba(255,255,255,0.06)' : s.color+'40'}`,
                    opacity: hiddenSeries[s.key] ? 0.45 : 1,
                  }}>
                  <div style={{ width:18, height:3, borderRadius:99,
                    background: hiddenSeries[s.key] ? '#374151' : s.color,
                    boxShadow: hiddenSeries[s.key] ? 'none' : `0 0 10px ${s.color}80` }} />
                  <div>
                    <p className={`text-[11px] font-semibold leading-none ${hiddenSeries[s.key]?'text-slate-500':'text-slate-700 dark-mode-light'}`}
                      style={{ fontFamily:"'Inter',sans-serif" }}>{s.label}</p>
                    <p className="text-[13px] font-black leading-none mt-0.5"
                      style={{ color: hiddenSeries[s.key]?'#94a3b8':s.color, fontFamily:"'Space Grotesk',sans-serif" }}>{fmtShort(chartData[s.total]||0)}</p>
                  </div>
                </button>
              ))}
              <span className="ml-auto self-end text-slate-600 text-[11px] pb-0.5">Klik legend untuk sembunyikan</span>
            </div>
          </div>
          {/* Chart */}
          <div className="px-1">
            <SvgLineChart key={chartYear} labels={chartData.chartLabels} height={280}
              series={CHART_SERIES_CFG.filter(s => !hiddenSeries[s.key]).map(s => ({ label:s.label, color:s.color, data:chartData[s.key] }))}
            />
          </div>
          {/* Footer */}
          <div className="px-6 py-3 border-t border-white/[0.05] flex justify-between" style={{ background:'rgba(255,255,255,0.01)' }}>
            <span className="text-slate-600 text-[11px]">📅 Sumber: invoice_date · order_date · Tahun {chartYear}</span>
            <span className="text-slate-600 text-[11px]">Jan – Des {chartYear} · auto refresh</span>
          </div>
        </div>
      )}

      {/* ── Recent Transactions ── */}
      <div className="section-in rounded-2xl border border-white/[0.07] overflow-hidden" style={{
        animationDelay:'0.35s', background:'rgba(255,255,255,0.015)',
      }}>
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between" style={{ background:'rgba(255,255,255,0.012)' }}>
          <h3 className="text-white font-bold" style={{ fontFamily:"'Space Grotesk',sans-serif" }}>🕐 Transaksi Terbaru</h3>
          <Link to="/inbound" className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors">Lihat semua →</Link>
        </div>
        <div className="px-4 py-2">
          {loading ? (
            <div className="space-y-2 py-2">
              {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-white/[0.04] animate-pulse" />)}
            </div>
          ) : stats?.recent_transactions?.length > 0 ? (
            stats.recent_transactions.map((t, i) => <RecentRow key={i} item={t} delay={0.04*i} />)
          ) : (
            <div className="text-center py-10 text-slate-500 text-sm">Belum ada transaksi — catat barang masuk pertama!</div>
          )}
        </div>
      </div>

    </div>
  )
}
