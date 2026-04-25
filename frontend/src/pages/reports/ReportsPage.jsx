import { useState, useEffect, useMemo, useRef } from 'react'
import { BarChart2, TrendingDown, Package, DollarSign, ArrowDownUp, Download, Printer, RefreshCw, AlertTriangle, Box, Tag, ChevronDown } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell } from '@/components/ui'

// ── Formatters ────────────────────────────────────────────────
const fmt      = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const fmtShort = n => n >= 1e9 ? `Rp ${(n / 1e9).toFixed(1)} M` : n >= 1e6 ? `Rp ${(n / 1e6).toFixed(1)} Jt` : fmt(n)

// ── Shared: CSV download ──────────────────────────────────────
function downloadCSV(filename, headers, rows) {
  const esc    = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv    = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
  const blob   = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url    = URL.createObjectURL(blob)
  const a      = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click(); URL.revokeObjectURL(url)
}

// ── Shared: Print popup ───────────────────────────────────────
function openPrint(title, innerHTML) {
  const w = window.open('', '_blank', 'width=960,height=720')
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:24px;margin:0}
    h1{font-size:17px;margin:0 0 4px}
    .sub{color:#555;font-size:10px;margin-bottom:18px}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th{background:#1a3557;color:#fff;padding:6px 8px;font-size:10px;text-align:left}
    td{border:1px solid #ddd;padding:5px 8px;font-size:11px}
    tr:nth-child(even) td{background:#f7f7f7}
    .kpi{display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap}
    .kpi-box{border:1px solid #ccc;border-radius:6px;padding:10px 14px;min-width:130px}
    .kpi-box .lbl{font-size:9px;color:#888;margin-bottom:3px}
    .kpi-box .val{font-size:14px;font-weight:bold}
    .red{color:#c0392b} .green{color:#27ae60} .amber{color:#e67e22} .blue{color:#2980b9}
    tfoot td{font-weight:bold;background:#f0f0f0}
    @media print{@page{size:A4;margin:15mm}}
  </style></head><body>${innerHTML}</body></html>`)
  w.document.close()
  setTimeout(() => w.print(), 500)
}

// ── Export Dropdown ───────────────────────────────────────────
function ExportDropdown({ items, label = 'Ekspor' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/20 text-xs font-medium transition-all"
      >
        <Download size={12} />
        {label}
        <ChevronDown size={11} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[180px] rounded-xl border border-white/[0.1] bg-[#0d1220] shadow-xl shadow-black/40 overflow-hidden"
          style={{ backdropFilter: 'blur(12px)' }}>
          {items.map((item, i) => {
            const Icon = item.icon
            return (
              <button key={i}
                onClick={() => { item.onClick(); setOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs hover:bg-white/[0.06] transition-colors text-left ${item.color || 'text-slate-300'}`}
              >
                <Icon size={12} />
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab button ────────────────────────────────────────────────
function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
        ${active ? 'bg-gold-500/15 text-gold-400 border border-gold-500/25' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'}`}>
      <Icon size={15} /> {label}
    </button>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB 1 — KARTU STOK
// ══════════════════════════════════════════════════════════════
function KartuStokTab() {
  const [items,      setItems]      = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [allStock,   setAllStock]   = useState([])
  const [itemId,     setItemId]     = useState('')
  const [warehouseId,setWarehouseId]= useState('')
  const [categoryF,  setCategoryF]  = useState('')
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,10) })
  const [to,   setTo]   = useState(new Date().toISOString().slice(0,10))
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([api.get('/items'), api.get('/warehouses'), api.get('/reports/stock-valuation')])
      .then(([i, w, sv]) => {
        setItems((i.data || i) || [])
        setWarehouses((w.data || w) || [])
        const valData = sv.data || sv
        setAllStock(valData.items || valData.data?.items || [])
      })
      .catch(() => toast.error('Gagal memuat data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const doSearch = async () => {
    if (!itemId) { toast('Pilih item terlebih dahulu'); return }
    setLoading(true)
    try {
      const res  = await api.get(`/reports/kartu-stok?item_id=${itemId}&warehouse_id=${warehouseId}&from=${from}&to=${to}`)
      const raw  = res.data || res
      const mutations = []
      ;(raw.inbound  || []).forEach(r => mutations.push({ date: r.date, ref: r.ref_number, type: 'MASUK',  in: r.qty || r.qty_received || 0, out: 0, warehouse: r.party || '—' }))
      ;(raw.outbound || []).forEach(r => mutations.push({ date: r.date, ref: r.ref_number, type: 'KELUAR', in: 0, out: r.qty || r.qty_issued || 0, warehouse: r.party || '—' }))
      mutations.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      let balance = 0
      mutations.forEach(m => { balance += m.in - m.out; m.balance = balance })
      setDetail({ opening_stock: raw.current_stock || 0, data: mutations, item: raw.item })
    } catch { toast.error('Gagal memuat kartu stok') }
    finally { setLoading(false) }
  }

  // Derived
  const categories = useMemo(() => [...new Set(allStock.map(s => s.category).filter(Boolean))], [allStock])
  const filtered   = useMemo(() =>
    allStock.filter(s => !categoryF || s.category === categoryF), [allStock, categoryF])
  const grandTotal = useMemo(() => filtered.reduce((a, s) => a + (s.total_value || 0), 0), [filtered])
  const zeroStock  = useMemo(() => filtered.filter(s => (s.total_stock || 0) <= 0).length, [filtered])

  // Export CSV — summary
  const exportSummaryCSV = () => {
    downloadCSV(`Kartu_Stok_${new Date().toISOString().slice(0,10)}.csv`,
      ['Item', 'SKU', 'Kategori', 'Satuan', 'Harga', 'Stok', 'Nilai Stok'],
      filtered.map(s => [s.name, s.sku, s.category || '—', s.unit || '—', s.price || 0, s.total_stock || 0, s.total_value || 0]))
    toast.success('Export CSV berhasil!')
  }

  // Export CSV — detail mutasi
  const exportDetailCSV = () => {
    if (!detail) return
    downloadCSV(`Mutasi_${detail.item?.name || 'item'}_${from}_${to}.csv`,
      ['Tanggal', 'Referensi', 'Tipe', 'Masuk', 'Keluar', 'Sisa Stok', 'Gudang/Tujuan'],
      detail.data.map(m => [m.date, m.ref, m.type, m.in || '—', m.out || '—', m.balance, m.warehouse]))
    toast.success('Export CSV berhasil!')
  }

  // Print — detail mutasi
  const printDetail = () => {
    if (!detail) return
    const rows = detail.data.map(m =>
      `<tr><td>${m.date}</td><td>${m.ref}</td><td style="color:${m.type==='MASUK'?'#27ae60':'#c0392b'}">${m.type}</td>
       <td class="green">${m.in > 0 ? m.in : '—'}</td><td class="red">${m.out > 0 ? m.out : '—'}</td>
       <td><b>${m.balance}</b></td><td>${m.warehouse}</td></tr>`).join('')
    openPrint(`Kartu Stok — ${detail.item?.name}`,
      `<h1>Kartu Stok — ${detail.item?.name || ''}</h1>
       <div class="sub">Periode: ${from} s/d ${to} | Stok Saat Ini: <b>${detail.opening_stock}</b> | Dicetak: ${new Date().toLocaleString('id-ID')}</div>
       <table><thead><tr><th>Tanggal</th><th>Referensi</th><th>Tipe</th><th>Masuk</th><th>Keluar</th><th>Sisa Stok</th><th>Gudang/Tujuan</th></tr></thead>
       <tbody>${rows || '<tr><td colspan="7" style="text-align:center">Tidak ada mutasi</td></tr>'}</tbody></table>`)
  }

  // Print — summary
  const printSummary = () => {
    const rows = filtered.map(s =>
      `<tr><td>${s.name}</td><td>${s.sku}</td><td>${s.category||'—'}</td><td>${s.unit||'—'}</td>
       <td>${fmt(s.price||0)}</td>
       <td style="color:${(s.total_stock||0)<=0?'#c0392b':'#27ae60'}">${s.total_stock||0}</td>
       <td class="amber"><b>${fmt(s.total_value||0)}</b></td></tr>`).join('')
    openPrint('Ringkasan Stok Inventaris',
      `<h1>Ringkasan Stok Inventaris</h1>
       <div class="sub">Filter Kategori: ${categoryF||'Semua'} | Total Item: ${filtered.length} | Dicetak: ${new Date().toLocaleString('id-ID')}</div>
       <div class="kpi">
         <div class="kpi-box"><div class="lbl">Total Item</div><div class="val blue">${filtered.length}</div></div>
         <div class="kpi-box"><div class="lbl">Stok Kosong</div><div class="val red">${zeroStock}</div></div>
         <div class="kpi-box"><div class="lbl">Total Nilai Stok</div><div class="val amber">${fmt(grandTotal)}</div></div>
       </div>
       <table><thead><tr><th>Item</th><th>SKU</th><th>Kategori</th><th>Satuan</th><th>Harga</th><th>Stok</th><th>Nilai Stok</th></tr></thead>
       <tbody>${rows}</tbody>
       <tfoot><tr><td colspan="6">TOTAL NILAI STOK</td><td>${fmt(grandTotal)}</td></tr></tfoot></table>`)
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Item</label>
            <select value={itemId} onChange={e => setItemId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none">
              <option value="">Semua item</option>
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
            <label className="text-xs text-slate-400 block mb-1">Kategori</label>
            <select value={categoryF} onChange={e => setCategoryF(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none">
              <option value="">Semua kategori</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Dari</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Sampai</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none" />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={doSearch} disabled={loading}
              className="flex-1 px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">
              {loading ? '…' : 'Cari'}
            </button>
            <button onClick={load} className="p-2 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {detail ? (
            <>
              <ExportDropdown
                label="Ekspor Mutasi"
                items={[
                  { label: 'Export CSV Mutasi',   icon: Download, color: 'text-emerald-400', onClick: exportDetailCSV },
                  { label: 'Print Kartu Stok',    icon: Printer,  color: 'text-purple-400',  onClick: printDetail },
                ]}
              />
              <button onClick={() => setDetail(null)} className="px-3 py-1.5 rounded-xl border border-white/[0.08] text-slate-400 text-xs hover:text-white">
                ← Kembali ke Ringkasan
              </button>
            </>
          ) : (
            <ExportDropdown
              items={[
                { label: 'Export CSV Ringkasan', icon: Download, color: 'text-emerald-400', onClick: exportSummaryCSV },
                { label: 'Print Ringkasan',      icon: Printer,  color: 'text-purple-400',  onClick: printSummary },
              ]}
            />
          )}
        </div>
      </div>

      {/* KPI summary cards — tampil di view ringkasan */}
      {!detail && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Item', value: filtered.length, icon: Box, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
            { label: 'Item Stok Nol', value: zeroStock, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
            { label: 'Total Nilai Stok', value: fmtShort(grandTotal), icon: DollarSign, color: 'text-gold-400', bg: 'bg-gold-500/10 border-gold-500/20' },
          ].map(c => (
            <div key={c.label} className={`rounded-2xl border p-4 ${c.bg}`}>
              <div className="flex items-center gap-2 mb-2">
                <c.icon size={15} className={c.color} />
                <span className="text-slate-400 text-xs">{c.label}</span>
              </div>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Detail mutasi */}
      {detail && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex justify-between items-center">
            <span className="text-white font-semibold">Kartu Stok — {detail.item?.name || 'Item'}</span>
            <span className="text-slate-400 text-sm">Stok Saat Ini: <span className="text-white font-semibold">{detail.opening_stock}</span></span>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06]">
              {['Tanggal','Referensi','Tipe','Masuk','Keluar','Sisa Stok','Gudang/Tujuan'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {detail.data.length === 0
                ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Tidak ada mutasi dalam periode ini</td></tr>
                : detail.data.map((m, i) => (
                  <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-2 text-slate-300">{m.date}</td>
                    <td className="px-4 py-2 text-slate-400 font-mono text-xs">{m.ref}</td>
                    <td className="px-4 py-2"><span className={`text-xs font-semibold ${m.type==='MASUK'?'text-emerald-400':'text-red-400'}`}>{m.type}</span></td>
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

      {/* Ringkasan semua item */}
      {!detail && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex justify-between items-center">
            <span className="text-white font-semibold">Ringkasan Stok {categoryF ? `— ${categoryF}` : 'Semua Item'}</span>
            <span className="text-slate-400 text-sm">{filtered.length} item</span>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06]">
              {['Item','SKU','Kategori','Satuan','Harga','Stok','Nilai Stok'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading
                ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Memuat...</td></tr>
                : filtered.length === 0
                  ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Tidak ada data stok</td></tr>
                  : filtered.map((s, i) => (
                    <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer" onClick={() => setItemId(s.id)}>
                      <td className="px-4 py-2 text-white font-medium">{s.name}</td>
                      <td className="px-4 py-2 text-slate-400 font-mono text-xs">{s.sku}</td>
                      <td className="px-4 py-2 text-slate-400">{s.category || '—'}</td>
                      <td className="px-4 py-2 text-slate-400">{s.unit || '—'}</td>
                      <td className="px-4 py-2 text-slate-300">{fmt(s.price || 0)}</td>
                      <td className="px-4 py-2"><span className={`font-semibold ${(s.total_stock||0) <= 0 ? 'text-red-400' : 'text-emerald-400'}`}>{s.total_stock || 0}</span></td>
                      <td className="px-4 py-2 text-gold-400 font-bold">{fmt(s.total_value || 0)}</td>
                    </tr>
                  ))}
            </tbody>
            {/* Grand total row */}
            {!loading && filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gold-500/30 bg-gold-500/5">
                  <td colSpan={6} className="px-4 py-3 text-gold-400 font-bold text-sm">TOTAL NILAI STOK</td>
                  <td className="px-4 py-3 text-gold-400 font-bold text-sm">{fmt(grandTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB 2 — AGING INVOICE
// ══════════════════════════════════════════════════════════════
function AgingInvoiceTab() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [fromD,   setFromD]   = useState('')
  const [toD,     setToD]     = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = [fromD && `from=${fromD}`, toD && `to=${toD}`].filter(Boolean).join('&')
      setData(await api.get('/reports/aging-invoice' + (params ? '?' + params : '')))
    } catch { toast.error('Gagal memuat aging invoice') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const BUCKETS = [
    { key: 'current', label: 'Belum JT',    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { key: '1_30',    label: '1–30 Hari',   color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
    { key: '31_60',   label: '31–60 Hari',  color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    { key: '61_90',   label: '61–90 Hari',  color: 'text-red-400 bg-red-500/10 border-red-500/20' },
    { key: 'over_90', label: '> 90 Hari',   color: 'text-red-600 bg-red-900/20 border-red-800/30' },
  ]

  const exportCSV = () => {
    const rows = (data?.data || []).map(inv => [
      inv.invoice_number, inv.supplier, fmt(inv.total), fmt(inv.remaining),
      inv.due_date, inv.days_overdue > 0 ? `+${inv.days_overdue}` : '—',
      BUCKETS.find(b => b.key === inv.bucket)?.label || '—',
    ])
    downloadCSV(`Aging_Invoice_${new Date().toISOString().slice(0,10)}.csv`,
      ['No Invoice','Supplier','Total','Sisa','Jatuh Tempo','Hari Lewat','Bucket'], rows)
    toast.success('Export CSV berhasil!')
  }

  const printAgingHTML = () => {
    const summaryCards = BUCKETS.map(b =>
      `<div class="kpi-box"><div class="lbl">${b.label}</div><div class="val">${fmt(data?.summary?.[b.key] || 0)}</div></div>`).join('')
    const rows = (data?.data || []).map(inv =>
      `<tr><td>${inv.invoice_number}</td><td>${inv.supplier}</td><td>${fmt(inv.total)}</td>
       <td class="amber"><b>${fmt(inv.remaining)}</b></td><td>${inv.due_date}</td>
       <td class="${inv.days_overdue > 0 ? 'red' : 'green'}">${inv.days_overdue > 0 ? `+${inv.days_overdue} hari` : '—'}</td>
       <td>${BUCKETS.find(b => b.key === inv.bucket)?.label || '—'}</td></tr>`).join('')
    openPrint('Aging Invoice',
      `<h1>Laporan Aging Invoice</h1>
       <div class="sub">Filter: ${fromD||'—'} s/d ${toD||'—'} | Dicetak: ${new Date().toLocaleString('id-ID')}</div>
       <div class="kpi">${summaryCards}</div>
       <table><thead><tr><th>No Invoice</th><th>Supplier</th><th>Total</th><th>Sisa</th><th>Jatuh Tempo</th><th>Hari Lewat</th><th>Status</th></tr></thead>
       <tbody>${rows || '<tr><td colspan="7" style="text-align:center">Tidak ada data</td></tr>'}</tbody></table>`)
  }

  return (
    <div className="space-y-4">
      {/* Filter + actions */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Dari Tanggal</label>
          <input type="date" value={fromD} onChange={e => setFromD(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Sampai</label>
          <input type="date" value={toD} onChange={e => setToD(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none" />
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">
          <RefreshCw size={13} /> Refresh
        </button>
        <div className="ml-auto flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium">
            <Download size={13} /> Export CSV
          </button>
          <button onClick={printAgingHTML} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 text-xs font-medium">
            <Printer size={13} /> Print PDF
          </button>
        </div>
      </div>

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
                {['No. Invoice','Supplier','Total','Sisa','Jatuh Tempo','Hari Lewat','Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(data.data || []).length === 0
                  ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Tidak ada data aging</td></tr>
                  : (data.data || []).map((inv, i) => (
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
                        <span className="text-xs font-semibold">{BUCKETS.find(b => b.key === inv.bucket)?.label}</span>
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

// ══════════════════════════════════════════════════════════════
// TAB 3 — VALUASI STOK
// ══════════════════════════════════════════════════════════════
function StockValuationTab() {
  const [data, setData] = useState(null)

  const load = () => api.get('/reports/stock-valuation').then(setData).catch(() => toast.error('Gagal'))
  useEffect(() => { load() }, [])

  const items     = data?.data?.items || data?.items || []
  const grandTotal = data?.data?.grand_total || data?.grand_total || 0

  const exportCSV = () => {
    const token = localStorage.getItem('wms-token') || ''
    fetch('/api/items/export/csv', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob()).then(blob => {
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'inventaris.csv' })
        a.click(); toast.success('Export CSV berhasil!')
      })
  }

  const printVal = () => {
    const rows = items.map(item =>
      `<tr><td>${item.name}</td><td>${item.sku}</td><td>${item.category}</td>
       <td>${fmt(item.price || item.unit_price)}</td>
       <td style="color:${(item.total_stock||item.stock||0)<=0?'#c0392b':'#27ae60'}">${item.total_stock || item.stock || 0}</td>
       <td class="amber"><b>${fmt(item.total_value || item.value)}</b></td></tr>`).join('')
    openPrint('Valuasi Stok Inventaris',
      `<h1>Laporan Valuasi Stok</h1>
       <div class="sub">Dicetak: ${new Date().toLocaleString('id-ID')}</div>
       <div class="kpi"><div class="kpi-box"><div class="lbl">Total Nilai Stok</div><div class="val amber">${fmt(grandTotal)}</div></div></div>
       <table><thead><tr><th>Item</th><th>SKU</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Nilai Total</th></tr></thead>
       <tbody>${rows}</tbody>
       <tfoot><tr><td colspan="5">GRAND TOTAL</td><td>${fmt(grandTotal)}</td></tr></tfoot></table>`)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="p-4 rounded-2xl border border-gold-500/20 bg-gold-500/10">
          <p className="text-xs text-gold-400 font-semibold mb-1">Total Nilai Stok</p>
          <p className="text-2xl font-bold text-gold-400">{fmt(grandTotal)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white">
            <RefreshCw size={14} />
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-sm">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={printVal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 text-sm">
            <Printer size={14} /> Print PDF
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06]">
            {['Item','SKU','Kategori','Harga','Stok','Nilai Total'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-2 text-white font-medium">{item.name}</td>
                <td className="px-4 py-2 text-slate-400 font-mono text-xs">{item.sku}</td>
                <td className="px-4 py-2 text-slate-400">{item.category}</td>
                <td className="px-4 py-2 text-slate-300">{fmt(item.price || item.unit_price)}</td>
                <td className="px-4 py-2">
                  <span className={(item.total_stock || item.stock || 0) <= 0 ? 'text-red-400 font-bold' : 'text-white font-semibold'}>
                    {item.total_stock || item.stock || 0}
                  </span>
                </td>
                <td className="px-4 py-2 text-gold-400 font-bold">{fmt(item.total_value || item.value)}</td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gold-500/30 bg-gold-500/5">
                <td colSpan={5} className="px-4 py-3 text-gold-400 font-bold text-sm">GRAND TOTAL</td>
                <td className="px-4 py-3 text-gold-400 font-bold text-sm">{fmt(grandTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB 4 — BUDGET REALISASI
// ══════════════════════════════════════════════════════════════
function BudgetRealizationTab() {
  const [data, setData] = useState([])
  const [year, setYear] = useState(new Date().getFullYear())

  const load = () =>
    api.get(`/reports/budget-realization?year=${year}`)
      .then(r => setData(r.data || []))
      .catch(() => toast.error('Gagal'))

  useEffect(() => { load() }, [year])

  const exportCSV = () => {
    downloadCSV(`Budget_Realisasi_${year}.csv`,
      ['Budget/Dept','Periode','Anggaran','Realisasi','Sisa','% Terpakai'],
      data.map(b => [
        b.department_name || b.name, b.budget_year || b.period,
        b.total_budget || b.budget, b.used_budget || b.spent,
        b.remaining, `${b.utilization_pct || b.pct_used || 0}%`,
      ]))
    toast.success('Export CSV berhasil!')
  }

  const printBudget = () => {
    const rows = data.map(b =>
      `<tr><td>${b.department_name || b.name}</td><td>${b.budget_year || b.period}</td>
       <td class="blue">${fmt(b.total_budget || b.budget)}</td>
       <td class="amber"><b>${fmt(b.used_budget || b.spent)}</b></td>
       <td class="green">${fmt(b.remaining)}</td>
       <td class="${(b.utilization_pct||b.pct_used||0)>90?'red':(b.utilization_pct||b.pct_used||0)>70?'amber':'green'}">
         <b>${b.utilization_pct || b.pct_used || 0}%</b></td></tr>`).join('')
    openPrint(`Budget Realisasi ${year}`,
      `<h1>Laporan Budget Realisasi ${year}</h1>
       <div class="sub">Dicetak: ${new Date().toLocaleString('id-ID')}</div>
       <table><thead><tr><th>Departemen</th><th>Periode</th><th>Anggaran</th><th>Realisasi</th><th>Sisa</th><th>% Terpakai</th></tr></thead>
       <tbody>${rows || '<tr><td colspan="6" style="text-align:center">Tidak ada data</td></tr>'}</tbody></table>`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-slate-400 text-sm">Tahun:</label>
          <select value={year} onChange={e => setYear(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={load} className="p-2 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white">
          <RefreshCw size={14} />
        </button>
        <div className="ml-auto flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium">
            <Download size={13} /> Export CSV
          </button>
          <button onClick={printBudget} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 text-xs font-medium">
            <Printer size={13} /> Print PDF
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06]">
            {['Budget','Periode','Anggaran','Realisasi','Sisa','% Terpakai'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data.length === 0
              ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Tidak ada budget untuk tahun {year}</td></tr>
              : data.map((b, i) => (
                <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-2 text-white font-medium">{b.department_name || b.name}</td>
                  <td className="px-4 py-2 text-slate-400">{b.budget_year || b.period}</td>
                  <td className="px-4 py-2 text-blue-400">{fmt(b.total_budget || b.budget)}</td>
                  <td className="px-4 py-2 text-orange-400 font-semibold">{fmt(b.used_budget || b.spent)}</td>
                  <td className="px-4 py-2 text-emerald-400">{fmt(b.remaining)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/[0.08] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${(b.utilization_pct||b.pct_used||0)>90?'bg-red-500':(b.utilization_pct||b.pct_used||0)>70?'bg-orange-500':'bg-emerald-500'}`}
                          style={{ width: `${Math.min(b.utilization_pct || b.pct_used || 0, 100)}%` }} />
                      </div>
                      <span className={`text-xs font-bold w-10 text-right ${(b.utilization_pct||b.pct_used||0)>90?'text-red-400':(b.utilization_pct||b.pct_used||0)>70?'text-orange-400':'text-emerald-400'}`}>
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

// ══════════════════════════════════════════════════════════════
// ROOT COMPONENT
// ══════════════════════════════════════════════════════════════
export default function ReportsPage() {
  const [tab, setTab] = useState('kartu-stok')

  const TABS = [
    { key: 'kartu-stok',    label: 'Kartu Stok',      icon: ArrowDownUp },
    { key: 'aging-invoice', label: 'Aging Invoice',    icon: TrendingDown },
    { key: 'stock-value',   label: 'Valuasi Stok',     icon: Package },
    { key: 'budget-real',   label: 'Budget Realisasi', icon: DollarSign },
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
        {TABS.map(t => <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)} icon={t.icon} label={t.label} />)}
      </div>

      {tab === 'kartu-stok'    && <KartuStokTab />}
      {tab === 'aging-invoice' && <AgingInvoiceTab />}
      {tab === 'stock-value'   && <StockValuationTab />}
      {tab === 'budget-real'   && <BudgetRealizationTab />}
    </PageShell>
  )
}
