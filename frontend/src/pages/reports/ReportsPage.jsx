import { useState, useEffect } from 'react'
import { BarChart2, TrendingDown, Package, DollarSign, ArrowDownUp, Download } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell } from '@/components/ui'

const fmt = n => 'Rp ' + Number(n||0).toLocaleString('id-ID')

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
        ${active ? 'bg-gold-500/15 text-gold-400 border border-gold-500/25' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'}`}>
      <Icon size={15} /> {label}
    </button>
  )
}

/* ── Kartu Stok ── */
function KartuStokTab() {
  const [items, setItems] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [itemId, setItemId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,10)
  })
  const [to, setTo] = useState(new Date().toISOString().slice(0,10))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const doSearch = async (iid) => {
    const targetId = iid || itemId
    if (!targetId) return
    setLoading(true)
    try {
      const res = await api.get(`/reports/kartu-stok?item_id=${targetId}&warehouse_id=${warehouseId}&from=${from}&to=${to}`)
      const raw = res.data || res
      const mutations = []
      ;(raw.inbound || []).forEach(r => mutations.push({ date: r.date, ref: r.ref_number, type: 'MASUK', in: r.qty || r.qty_received || 0, out: 0, warehouse: r.party || '—' }))
      ;(raw.outbound || []).forEach(r => mutations.push({ date: r.date, ref: r.ref_number, type: 'KELUAR', in: 0, out: r.qty || r.qty_issued || 0, warehouse: r.party || '—' }))
      mutations.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      let balance = 0
      mutations.forEach(m => { balance += m.in - m.out; m.balance = balance })
      setData({ opening_stock: raw.current_stock || 0, data: mutations, item: raw.item })
    } catch { toast.error('Gagal memuat kartu stok') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    Promise.all([api.get('/items'), api.get('/warehouses')]).then(([i,w]) => {
      const itemList = (i.data||i)||[]
      setItems(itemList); setWarehouses((w.data||w)||[])
      // Auto-select first item and load data
      if (itemList.length > 0) {
        setItemId(itemList[0].id)
        doSearch(itemList[0].id)
      }
    })
  }, [])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3 p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Item *</label>
          <select value={itemId} onChange={e => setItemId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none">
            <option value="">Pilih item</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Gudang</label>
          <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none">
            <option value="">Semua gudang</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Dari</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none" />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-slate-400 block mb-1">Sampai</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none" />
          </div>
          <button onClick={() => doSearch()} disabled={loading}
            className="px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">
            {loading ? '...' : 'Cari'}
          </button>
        </div>
      </div>

      {data && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex justify-between items-center">
            <span className="text-white font-semibold">Kartu Stok</span>
            <span className="text-slate-400 text-sm">Stok Awal: <span className="text-white font-semibold">{data.opening_stock}</span></span>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06]">
              {['Tanggal','Referensi','Tipe','Masuk','Keluar','Saldo','Gudang'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.data.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Tidak ada mutasi</td></tr>
              ) : data.data.map((m, i) => (
                <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-2 text-slate-300">{m.date}</td>
                  <td className="px-4 py-2 text-slate-400 font-mono text-xs">{m.ref}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-semibold ${m.type==='MASUK'?'text-emerald-400':'text-red-400'}`}>{m.type}</span>
                  </td>
                  <td className="px-4 py-2 text-emerald-400 font-semibold">{m.in > 0 ? m.in : '—'}</td>
                  <td className="px-4 py-2 text-red-400 font-semibold">{m.out > 0 ? m.out : '—'}</td>
                  <td className="px-4 py-2 text-white font-bold">{m.balance}</td>
                  <td className="px-4 py-2 text-slate-400">{m.warehouse}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Aging Invoice ── */
function AgingInvoiceTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setData(await api.get('/reports/aging-invoice')) }
    catch { toast.error('Gagal') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const BUCKETS = [
    { key: 'current', label: 'Belum Jatuh Tempo', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { key: '1_30', label: '1–30 Hari', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
    { key: '31_60', label: '31–60 Hari', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    { key: '61_90', label: '61–90 Hari', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
    { key: 'over_90', label: '> 90 Hari', color: 'text-red-600 bg-red-900/20 border-red-800/30' },
  ]

  return (
    <div className="space-y-4">
      {!data || loading ? (
        <div className="flex justify-center py-12 text-slate-500">Memuat...</div>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-3">
            {BUCKETS.map(b => (
              <div key={b.key} className={`p-4 rounded-2xl border ${b.color}`}>
                <p className="text-xs font-semibold mb-1">{b.label}</p>
                <p className="text-lg font-bold">{fmt(data.summary?.[b.key] || 0)}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/[0.06]">
                {['No. Invoice','Supplier','Total','Sisa','Jatuh Tempo','Hari Lewat','Bucket'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(data.data||[]).map((inv, i) => (
                  <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-2 text-emerald-400 font-mono text-xs">{inv.invoice_number}</td>
                    <td className="px-4 py-2 text-slate-300">{inv.supplier}</td>
                    <td className="px-4 py-2 text-white">{fmt(inv.total)}</td>
                    <td className="px-4 py-2 text-orange-400 font-semibold">{fmt(inv.remaining)}</td>
                    <td className="px-4 py-2 text-slate-400">{inv.due_date}</td>
                    <td className="px-4 py-2">
                      <span className={inv.days_overdue > 0 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                        {inv.days_overdue > 0 ? `+${inv.days_overdue}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-semibold">{BUCKETS.find(b=>b.key===inv.bucket)?.label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Valuasi Stok ── */
function StockValuationTab() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/reports/stock-valuation').then(setData).catch(() => toast.error('Gagal'))
  }, [])

  const exportCSV = async () => {
    const token = localStorage.getItem('wms-token') || ''
    const res = await fetch('/api/items/export/csv', { headers: { Authorization: `Bearer ${token}` } })
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'inventaris.csv'
    a.click()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="p-4 rounded-2xl border border-gold-500/20 bg-gold-500/10">
          <p className="text-xs text-gold-400 font-semibold mb-1">Total Nilai Stok</p>
          <p className="text-2xl font-bold text-gold-400">{fmt(data?.data?.grand_total || data?.grand_total || 0)}</p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] text-white hover:bg-white/[0.1] text-sm">
          <Download size={14} /> Export CSV
        </button>
      </div>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06]">
            {['Item','SKU','Kategori','Harga','Stok','Nilai Total'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {(data?.data?.items || data?.items || []).map((item, i) => (
              <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-2 text-white font-medium">{item.name}</td>
                <td className="px-4 py-2 text-slate-400 font-mono text-xs">{item.sku}</td>
                <td className="px-4 py-2 text-slate-400">{item.category}</td>
                <td className="px-4 py-2 text-slate-300">{fmt(item.price || item.unit_price)}</td>
                <td className="px-4 py-2">
                  <span className={(item.total_stock || item.stock || 0) <= 0 ? 'text-red-400 font-bold' : 'text-white font-semibold'}>{item.total_stock || item.stock || 0}</span>
                </td>
                <td className="px-4 py-2 text-gold-400 font-bold">{fmt(item.total_value || item.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Budget Realisasi ── */
function BudgetRealizationTab() {
  const [data, setData] = useState([])
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    api.get(`/reports/budget-realization?year=${year}`)
      .then(r => setData(r.data || []))
      .catch(() => toast.error('Gagal'))
  }, [year])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-slate-400 text-sm">Tahun:</label>
        <select value={year} onChange={e => setYear(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none">
          {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06]">
            {['Budget','Periode','Anggaran','Realisasi','Sisa','% Terpakai'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Tidak ada budget untuk tahun {year}</td></tr>
            ) : data.map((b, i) => (
              <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-2 text-white font-medium">{b.department_name || b.name}</td>
                <td className="px-4 py-2 text-slate-400">{b.budget_year || b.period}</td>
                <td className="px-4 py-2 text-blue-400">{fmt(b.total_budget || b.budget)}</td>
                <td className="px-4 py-2 text-orange-400 font-semibold">{fmt(b.used_budget || b.spent)}</td>
                <td className="px-4 py-2 text-emerald-400">{fmt(b.remaining)}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-white/[0.08] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${(b.utilization_pct||b.pct_used||0)>90?'bg-red-500':(b.utilization_pct||b.pct_used||0)>70?'bg-orange-500':'bg-emerald-500'}`}
                        style={{width: `${Math.min(b.utilization_pct || b.pct_used || 0, 100)}%`}} />
                    </div>
                    <span className={`text-xs font-bold ${(b.utilization_pct||b.pct_used||0)>90?'text-red-400':(b.utilization_pct||b.pct_used||0)>70?'text-orange-400':'text-emerald-400'}`}>
                      {b.utilization_pct || b.pct_used || 0}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [tab, setTab] = useState('kartu-stok')
  const TABS = [
    { key: 'kartu-stok',    label: 'Kartu Stok',       icon: ArrowDownUp },
    { key: 'aging-invoice', label: 'Aging Invoice',     icon: TrendingDown },
    { key: 'stock-value',   label: 'Valuasi Stok',      icon: Package },
    { key: 'budget-real',   label: 'Budget Realisasi',  icon: DollarSign },
  ]

  return (
    <PageShell>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <BarChart2 size={20} className="text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-display font-bold text-white">Laporan Advanced</h1>
          <p className="text-slate-500 text-sm">Kartu stok, aging invoice, valuasi, dan realisasi budget</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {TABS.map(t => <TabButton key={t.key} active={tab===t.key} onClick={() => setTab(t.key)} icon={t.icon} label={t.label} />)}
      </div>

      {tab === 'kartu-stok'    && <KartuStokTab />}
      {tab === 'aging-invoice' && <AgingInvoiceTab />}
      {tab === 'stock-value'   && <StockValuationTab />}
      {tab === 'budget-real'   && <BudgetRealizationTab />}
    </PageShell>
  )
}
