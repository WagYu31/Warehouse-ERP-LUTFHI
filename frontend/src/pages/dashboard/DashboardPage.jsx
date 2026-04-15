import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Package, TrendingDown, ArrowDownCircle, ArrowUpCircle,
  ClipboardList, AlertTriangle, DollarSign, Warehouse,
  TrendingUp, RefreshCcw
} from 'lucide-react'
import api from '@/services/api'
import { useAuthStore } from '@/store/authStore'

function StatCard({ icon: Icon, label, value, sub, color = 'gold', trend }) {
  const colors = {
    gold:   'from-yellow-500/20 to-amber-600/10 border-yellow-500/20 text-yellow-400',
    red:    'from-red-500/20 to-rose-600/10 border-red-500/20 text-red-400',
    blue:   'from-blue-500/20 to-cyan-600/10 border-blue-500/20 text-blue-400',
    green:  'from-emerald-500/20 to-teal-600/10 border-emerald-500/20 text-emerald-400',
    purple: 'from-purple-500/20 to-violet-600/10 border-purple-500/20 text-purple-400',
  }
  return (
    <div className={`relative rounded-2xl border bg-gradient-to-br p-5 ${colors[color]} overflow-hidden`}>
      <div className="absolute top-3 right-3 opacity-10">
        <Icon size={52} />
      </div>
      <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${colors[color]} mb-3`}>
        <Icon size={20} />
      </div>
      <div className="text-slate-400 text-xs font-medium mb-1">{label}</div>
      <div className="text-white text-2xl font-bold font-display">{value ?? '—'}</div>
      {sub && <div className="text-slate-500 text-xs mt-1">{sub}</div>}
    </div>
  )
}

function RecentRow({ item }) {
  const statusColor = {
    confirmed: 'text-emerald-400 bg-emerald-500/10',
    pending:   'text-yellow-400 bg-yellow-500/10',
    rejected:  'text-red-400 bg-red-500/10',
  }
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.05] last:border-0">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/[0.04]">
          <ArrowDownCircle size={15} className="text-blue-400" />
        </div>
        <div>
          <div className="text-white text-sm font-medium">{item.ref}</div>
          <div className="text-slate-500 text-xs">{item.date}</div>
        </div>
      </div>
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[item.status] || 'text-slate-400 bg-white/[0.05]'}`}>
        {item.status}
      </span>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      const res = await api.get('/dashboard/stats')
      setStats(res.data)
    } catch {
      // gunakan data kosong jika gagal
      setStats({ total_items: 0, critical_items: 0, total_suppliers: 0, pending_requests: 0, stock_value: 0, recent_transactions: [] })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  const fmt = (n) => Number(n || 0).toLocaleString('id-ID')
  const fmtCurrency = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

  return (
    <div className="p-6 lg:p-8 space-y-8 min-h-full">

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-display font-bold text-white">
          Selamat datang, <span className="text-gold-400">{user?.name}</span> 👋
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package}       label="Total Item"          value={fmt(stats?.total_items)}        color="blue"   />
        <StatCard icon={AlertTriangle} label="Item Kritis"         value={fmt(stats?.critical_items)}     color="red"    />
        <StatCard icon={Warehouse}     label="Total Supplier"      value={fmt(stats?.total_suppliers)}    color="purple" />
        <StatCard icon={ClipboardList} label="SPB Pending"         value={fmt(stats?.pending_requests)}   color="gold"   />
      </div>

      {/* Stock Value + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Nilai Stok */}
        <div className="lg:col-span-1 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={18} className="text-gold-400" />
              <span className="text-white font-semibold text-sm">Nilai Stok Gudang</span>
            </div>
            <div className="text-3xl font-display font-bold text-white break-all">
              {loading ? '—' : fmtCurrency(stats?.stock_value)}
            </div>
            <div className="text-slate-500 text-xs mt-1">Total estimasi nilai inventaris</div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-emerald-400 text-xs">
            <TrendingUp size={14} />
            <span>Real-time dari stok aktif</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
          <h3 className="text-white font-semibold text-sm mb-4">Aksi Cepat</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Catat Barang Masuk',  icon: ArrowDownCircle,  to: '/inbound',   color: 'text-blue-400 bg-blue-500/10' },
              { label: 'Catat Barang Keluar', icon: ArrowUpCircle,    to: '/outbound',  color: 'text-orange-400 bg-orange-500/10' },
              { label: 'Buat SPB',            icon: ClipboardList,    to: '/requests',  color: 'text-gold-400 bg-gold-500/10' },
              { label: 'Cek Inventaris',      icon: Package,          to: '/inventory', color: 'text-emerald-400 bg-emerald-500/10' },
              { label: 'Stock Opname',        icon: RefreshCcw,       to: '/opname',    color: 'text-purple-400 bg-purple-500/10' },
              { label: 'Item Kritis',         icon: AlertTriangle,    to: '/inventory?filter=kritis', color: 'text-red-400 bg-red-500/10' },
            ].map((a) => (
              <Link key={a.to} to={a.to}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.04] transition-all duration-200 group">
                <div className={`p-2 rounded-lg ${a.color}`}>
                  <a.icon size={15} />
                </div>
                <span className="text-slate-400 group-hover:text-white text-xs font-medium transition-colors leading-tight">
                  {a.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">Transaksi Terbaru</h3>
          <Link to="/inbound" className="text-gold-400 text-xs hover:underline">Lihat semua →</Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-12 rounded-lg bg-white/[0.04] animate-pulse" />)}
          </div>
        ) : stats?.recent_transactions?.length > 0 ? (
          stats.recent_transactions.map((t, i) => <RecentRow key={i} item={t} />)
        ) : (
          <div className="text-center py-8 text-slate-500 text-sm">
            Belum ada transaksi — catat barang masuk pertama Anda!
          </div>
        )}
      </div>

    </div>
  )
}
