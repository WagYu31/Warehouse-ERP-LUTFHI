import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, ShoppingCart, Package, DollarSign, FileText, AlertCircle } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell, PageHeader } from '@/components/ui'

const fmt = n => new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 }).format(n||0)
const fmtShort = n => n >= 1e9 ? `Rp ${(n/1e9).toFixed(1)} M` : n >= 1e6 ? `Rp ${(n/1e6).toFixed(1)} Jt` : fmt(n)

export default function ERPReportPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('monthly')

  const load = async () => {
    setLoading(true)
    try {
      const [poRes, invoiceRes, budgetRes, stockRes] = await Promise.all([
        api.get('/erp/purchase-orders').catch(() => ({ data: [] })),
        api.get('/erp/invoices').catch(() => ({ data: [] })),
        api.get('/erp/budgets').catch(() => ({ data: [] })),
        api.get('/item-stocks').catch(() => ({ data: [] })),
      ])
      const pos     = Array.isArray(poRes)     ? poRes     : (poRes.data     || [])
      const invs    = Array.isArray(invoiceRes) ? invoiceRes : (invoiceRes.data || [])
      const budgets = Array.isArray(budgetRes)  ? budgetRes  : (budgetRes.data  || [])
      const stocks  = Array.isArray(stockRes)   ? stockRes   : (stockRes.data   || [])

      const totalPOValue   = pos.reduce((a, p) => a + (+p.total||0), 0)
      const totalPaid      = invs.filter(i => i.status==='paid').reduce((a,i) => a+((+i.total)||0), 0)
      const totalUnpaid    = invs.filter(i => i.status==='unpaid'||i.status==='overdue').reduce((a,i) => a+((+i.total)||0), 0)
      const totalBudget    = budgets.reduce((a,b) => a + (+b.total||0), 0)
      const totalSpent     = budgets.reduce((a,b) => a + (+b.spent||0), 0)

      setData({
        pos, invs, budgets, stocks,
        totalPOValue, totalPaid, totalUnpaid,
        totalBudget, totalSpent,
        remainingBudget: totalBudget - totalSpent,
        budgetPct: totalBudget > 0 ? Math.round(totalSpent/totalBudget*100) : 0,
        poByStatus: {
          draft:    pos.filter(p=>p.status==='draft').length,
          sent:     pos.filter(p=>p.status==='sent').length,
          complete: pos.filter(p=>p.status==='complete').length,
          cancelled:pos.filter(p=>p.status==='cancelled').length,
        },
        invoiceByStatus: {
          paid:    invs.filter(i=>i.status==='paid').length,
          unpaid:  invs.filter(i=>i.status==='unpaid').length,
          overdue: invs.filter(i=>i.status==='overdue').length,
        },
        topBudgets: [...budgets].sort((a,b)=>b.spent-a.spent).slice(0,5),
      })
    } catch { toast.error('Gagal memuat laporan') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <PageShell>
      <div className="flex items-center justify-center py-32">
        <div className="w-10 h-10 rounded-full border-2 border-gold-400 border-t-transparent animate-spin" />
      </div>
    </PageShell>
  )

  return (
    <PageShell>
      <PageHeader icon={BarChart3} title="Laporan ERP" subtitle="Ringkasan keuangan dan pengadaan" onRefresh={load} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label:'Total Nilai PO', value: fmtShort(data?.totalPOValue), icon:ShoppingCart, color:'text-blue-400', bg:'bg-blue-500/10 border-blue-500/20' },
          { label:'Total Dibayar', value: fmtShort(data?.totalPaid), icon:DollarSign, color:'text-emerald-400', bg:'bg-emerald-500/10 border-emerald-500/20' },
          { label:'Piutang Belum Bayar', value: fmtShort(data?.totalUnpaid), icon:AlertCircle, color:'text-red-400', bg:'bg-red-500/10 border-red-500/20' },
          { label:'Sisa Anggaran', value: fmtShort(data?.remainingBudget), icon:TrendingUp, color:'text-gold-400', bg:'bg-gold-500/10 border-gold-500/20' },
        ].map(c => (
          <div key={c.label} className={`rounded-2xl border p-5 ${c.bg}`}>
            <div className="flex items-center gap-2 mb-3">
              <c.icon size={16} className={c.color} />
              <span className="text-slate-400 text-xs">{c.label}</span>
            </div>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Status PO */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <ShoppingCart size={16} className="text-gold-400" /> Status Purchase Order
          </h3>
          {Object.entries(data?.poByStatus||{}).map(([k, v]) => {
            const total = data?.pos?.length || 1
            const pct = Math.round(v/total*100)
            const colors = { draft:'bg-slate-500', sent:'bg-blue-500', complete:'bg-emerald-500', cancelled:'bg-red-500' }
            return (
              <div key={k} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300 capitalize">{k}</span>
                  <span className="text-white font-semibold">{v} PO ({pct}%)</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2">
                  <div className={`h-2 rounded-full ${colors[k]||'bg-slate-500'}`} style={{width:`${pct}%`}} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Status Invoice */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <FileText size={16} className="text-gold-400" /> Status Invoice
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label:'Lunas', count: data?.invoiceByStatus?.paid||0, color:'text-emerald-400', bg:'bg-emerald-500/10' },
              { label:'Belum Bayar', count: data?.invoiceByStatus?.unpaid||0, color:'text-amber-400', bg:'bg-amber-500/10' },
              { label:'Jatuh Tempo', count: data?.invoiceByStatus?.overdue||0, color:'text-red-400', bg:'bg-red-500/10' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-3 text-center ${s.bg}`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                <p className="text-slate-400 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/[0.06]">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-400">Total Terbayar</span>
              <span className="text-emerald-400 font-semibold">{fmtShort(data?.totalPaid)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Total Belum Bayar</span>
              <span className="text-red-400 font-semibold">{fmtShort(data?.totalUnpaid)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Progress */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <TrendingUp size={16} className="text-gold-400" /> Realisasi Anggaran
          </h3>
          <div className="text-sm">
            <span className="text-slate-400">Total Terpakai: </span>
            <span className="text-gold-400 font-semibold">{data?.budgetPct}%</span>
          </div>
        </div>
        {/* Total Budget Bar */}
        <div className="mb-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-300">Total Anggaran: {fmtShort(data?.totalBudget)}</span>
            <span className="text-slate-300">Terpakai: {fmtShort(data?.totalSpent)}</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all ${data?.budgetPct > 80 ? 'bg-red-500' : data?.budgetPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{width:`${Math.min(data?.budgetPct||0, 100)}%`}}
            />
          </div>
        </div>
        {/* Per budget */}
        <div className="space-y-3">
          {data?.topBudgets?.map(b => {
            const pct = b.total > 0 ? Math.min(Math.round(b.spent/b.total*100), 100) : 0
            return (
              <div key={b.id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 truncate max-w-[60%]">{b.name}</span>
                  <span className={pct > 80 ? 'text-red-400' : 'text-slate-400'}>{fmtShort(b.spent)} / {fmtShort(b.total)}</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${pct>80?'bg-red-500':pct>60?'bg-amber-500':'bg-emerald-500'}`} style={{width:`${pct}%`}} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </PageShell>
  )
}
