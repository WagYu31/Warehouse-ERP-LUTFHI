import { useState, useEffect, useMemo } from 'react'
import { BarChart3, TrendingUp, ShoppingCart, Package, DollarSign, FileText, AlertCircle, Download, Printer, Calendar, Clock } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell, PageHeader } from '@/components/ui'

const fmt     = n => new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 }).format(n||0)
const fmtShort = n => n >= 1e9 ? `Rp ${(n/1e9).toFixed(1)} M` : n >= 1e6 ? `Rp ${(n/1e6).toFixed(1)} Jt` : fmt(n)
const today   = new Date()

function daysDiff(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return Math.floor((today - d) / (1000 * 60 * 60 * 24))
}

function inPeriod(dateStr, period) {
  if (!dateStr || period === 'all') return true
  const d = new Date(dateStr)
  const y = today.getFullYear(), m = today.getMonth()
  if (period === 'month')   return d.getFullYear()===y && d.getMonth()===m
  if (period === 'quarter') { const q=Math.floor(m/3); return d.getFullYear()===y && Math.floor(d.getMonth()/3)===q }
  if (period === 'year')    return d.getFullYear()===y
  return true
}

// ── CSV Export util ───────────────────────────────────────────
function downloadCSV(filename, headers, rows) {
  const escape = v => `"${String(v??'').replace(/"/g,'""')}"`
  const content = [headers.map(escape).join(','), ...rows.map(r=>r.map(escape).join(','))].join('\n')
  const blob = new Blob(['\uFEFF'+content], { type:'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href=url; a.download=filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Print util ────────────────────────────────────────────────
function printReport(title, html) {
  const win = window.open('','_blank','width=900,height=700')
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;padding:20px;color:#000}
      h1{font-size:16px;margin-bottom:4px} .sub{color:#666;font-size:10px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th{background:#1E3A5F;color:#fff;padding:6px 8px;font-size:10px;text-align:left}
      td{border:1px solid #ccc;padding:5px 8px;font-size:11px}
      tr:nth-child(even) td{background:#f9f9f9}
      .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
      .kpi-box{border:1px solid #ccc;border-radius:6px;padding:10px}
      .kpi-box h4{font-size:9px;color:#777;margin:0 0 4px}
      .kpi-box p{font-size:14px;font-weight:bold;margin:0}
      .red{color:#c53030} .green{color:#276749} .amber{color:#8B6914}
      @media print{@page{margin:15mm;size:A4}}
    </style></head><body>${html}</body></html>`)
  win.document.close()
  setTimeout(()=>win.print(), 400)
}

export default function ERPReportPage() {
  const [raw,    setRaw]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [period,  setPeriod]  = useState('all')       // all | month | quarter | year

  const load = async () => {
    setLoading(true)
    try {
      const [poRes, invRes, budRes] = await Promise.all([
        api.get('/erp/purchase-orders').catch(() => ({ data: [] })),
        api.get('/erp/invoices').catch(()        => ({ data: [] })),
        api.get('/erp/budgets').catch(()         => ({ data: [] })),
      ])
      setRaw({
        pos:     Array.isArray(poRes)  ? poRes  : (poRes.data  || []),
        invs:    Array.isArray(invRes) ? invRes : (invRes.data  || []),
        budgets: Array.isArray(budRes) ? budRes : (budRes.data  || []),
      })
    } catch { toast.error('Gagal memuat laporan') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // ── Filtered & computed data ──────────────────────────────
  const data = useMemo(() => {
    if (!raw) return null
    const pos  = raw.pos.filter(p  => inPeriod(p.order_date   || p.created_at, period))
    const invs = raw.invs.filter(i => inPeriod(i.invoice_date || i.created_at, period))
    const budgets = raw.budgets  // budget tidak difilter periode

    const totalPOValue = pos.reduce((a,p)  => a + (+p.total_amount||+p.total||0), 0)
    const totalPaid    = invs.filter(i=>i.status==='paid').reduce((a,i) => a+(+i.total_amount||+i.total||0), 0)
    const totalUnpaid  = invs.filter(i=>i.status!=='paid').reduce((a,i) => a+((+i.total_amount||+i.total||0)-(+i.amount_paid||0)), 0)
    const totalBudget  = budgets.reduce((a,b) => a+(+b.total_budget||+b.total||0), 0)
    const totalSpent   = budgets.reduce((a,b) => a+(+b.used_budget||+b.spent||0), 0)

    // Aging invoice
    const aging = { current:[], d30:[], d60:[], d90:[] }
    invs.filter(i=>i.status!=='paid').forEach(i => {
      const days = daysDiff(i.due_date)
      if (days === null) return
      if (days <= 0)        aging.current.push({...i, daysLate:days})
      else if (days <= 30)  aging.d30.push({...i, daysLate:days})
      else if (days <= 60)  aging.d60.push({...i, daysLate:days})
      else                  aging.d90.push({...i, daysLate:days})
    })

    // Top supplier by PO value
    const supplierMap = {}
    pos.forEach(p => {
      const key = p.supplier_name || 'Unknown'
      supplierMap[key] = (supplierMap[key]||0) + (+p.total_amount||+p.total||0)
    })
    const topSuppliers = Object.entries(supplierMap).sort((a,b)=>b[1]-a[1]).slice(0,5)

    // Payment collection rate
    const totalInvValue = invs.reduce((a,i)=>(a+(+i.total_amount||+i.total||0)),0)
    const collectionRate = totalInvValue > 0 ? Math.round(totalPaid/totalInvValue*100) : 0

    // Upcoming payments (due in next 7 & 30 days)
    const now = new Date()
    const in7  = new Date(now); in7.setDate(in7.getDate()+7)
    const in30 = new Date(now); in30.setDate(in30.getDate()+30)
    const upcoming7  = invs.filter(i=>i.status!=='paid' && i.due_date && new Date(i.due_date)>=now && new Date(i.due_date)<=in7)
    const upcoming30 = invs.filter(i=>i.status!=='paid' && i.due_date && new Date(i.due_date)>in7 && new Date(i.due_date)<=in30)

    return {
      pos, invs, budgets,
      totalPOValue, totalPaid, totalUnpaid,
      totalBudget, totalSpent,
      remainingBudget: totalBudget - totalSpent,
      budgetPct: totalBudget > 0 ? Math.round(totalSpent/totalBudget*100) : 0,
      collectionRate, totalInvValue,
      upcoming7, upcoming30,
      poByStatus: {
        draft:    pos.filter(p=>p.status==='draft').length,
        sent:     pos.filter(p=>p.status==='sent').length,
        complete: pos.filter(p=>p.status==='complete').length,
        cancelled:pos.filter(p=>p.status==='cancelled').length,
      },
      invoiceByStatus: {
        paid:   invs.filter(i=>i.status==='paid').length,
        unpaid: invs.filter(i=>i.status==='unpaid').length,
        overdue:invs.filter(i=>i.status==='overdue').length,
      },
      topBudgets: [...budgets].sort((a,b)=>(+b.used_budget||+b.spent||0)-(+a.used_budget||+a.spent||0)).slice(0,5),
      aging,
      topSuppliers,
      totalAgingAmount: aging.d30.reduce((a,i)=>a+(+i.total_amount||0)-(+i.amount_paid||0),0)
                      + aging.d60.reduce((a,i)=>a+(+i.total_amount||0)-(+i.amount_paid||0),0)
                      + aging.d90.reduce((a,i)=>a+(+i.total_amount||0)-(+i.amount_paid||0),0),
    }
  }, [raw, period])

  // ── Export Handlers ──────────────────────────────────────
  const exportBudgetCSV = () => {
    if (!data) return
    const rows = data.budgets.map(b => [
      b.department_name||b.name||'—', b.budget_year||b.period||'—',
      +b.total_budget||+b.total||0, +b.used_budget||+b.spent||0,
      (+b.total_budget||+b.total||0)-(+b.used_budget||+b.spent||0),
      `${data.budgetPct}%`, b.notes||'—',
    ])
    downloadCSV(`Budget_Report_${new Date().toISOString().slice(0,10)}.csv`,
      ['Departemen','Periode','Total Anggaran','Terpakai','Sisa','% Terpakai','Catatan'], rows)
    toast.success('Export Budget CSV berhasil!')
  }

  const exportInvoiceCSV = () => {
    if (!data) return
    const rows = data.invs.map(i => [
      i.invoice_number, i.supplier_name||'—',
      i.invoice_date||'—', i.due_date||'—', i.status,
      +i.total_amount||0, +i.amount_paid||0,
      (+i.total_amount||0)-(+i.amount_paid||0),
    ])
    downloadCSV(`Invoice_Report_${new Date().toISOString().slice(0,10)}.csv`,
      ['No Invoice','Supplier','Tgl Invoice','Jatuh Tempo','Status','Total','Dibayar','Sisa'], rows)
    toast.success('Export CSV berhasil!')
  }

  const exportPOCSV = () => {
    if (!data) return
    const rows = data.pos.map(p => [
      p.po_number, p.supplier_name||'—', p.order_date||'—', p.status,
      +p.total_amount||+p.total||0, p.notes||'—',
    ])
    downloadCSV(`PO_Report_${new Date().toISOString().slice(0,10)}.csv`,
      ['No PO','Supplier','Tanggal','Status','Total','Catatan'], rows)
    toast.success('Export CSV berhasil!')
  }

  const exportAgingCSV = () => {
    if (!data) return
    const all = [...data.aging.current, ...data.aging.d30, ...data.aging.d60, ...data.aging.d90]
    const rows = all.map(i => {
      const d = i.daysLate
      const cat = d<=0?'Belum Jatuh Tempo':d<=30?'1-30 Hari':d<=60?'31-60 Hari':'60+ Hari'
      return [i.invoice_number, i.supplier_name||'—', i.due_date||'—', d>0?d+'hari':'belum JT',
        cat, (+i.total_amount||0)-(+i.amount_paid||0)]
    })
    downloadCSV(`Aging_Invoice_${new Date().toISOString().slice(0,10)}.csv`,
      ['No Invoice','Supplier','Jatuh Tempo','Hari Terlambat','Kategori','Sisa Tagihan'], rows)
    toast.success('Export Aging CSV berhasil!')
  }

  const handlePrint = () => {
    if (!data) return
    const agingRows = [...data.aging.d30,...data.aging.d60,...data.aging.d90]
    printReport('Laporan ERP — WMS LUTFHI', `
      <h1>LAPORAN ERP — WMS LUTFHI</h1>
      <div class="sub">Dicetak pada ${new Date().toLocaleString('id-ID')} | Periode: ${period==='all'?'Semua':period==='month'?'Bulan Ini':period==='quarter'?'Kuartal Ini':'Tahun Ini'}</div>
      <div class="kpi-grid">
        <div class="kpi-box"><h4>Total Nilai PO</h4><p>${fmtShort(data.totalPOValue)}</p></div>
        <div class="kpi-box"><h4>Total Dibayar</h4><p class="green">${fmtShort(data.totalPaid)}</p></div>
        <div class="kpi-box"><h4>Belum Bayar</h4><p class="red">${fmtShort(data.totalUnpaid)}</p></div>
        <div class="kpi-box"><h4>Sisa Anggaran</h4><p class="amber">${fmtShort(data.remainingBudget)}</p></div>
      </div>
      <h3 style="margin:12px 0 4px">Aging Invoice (Belum Lunas)</h3>
      <table><thead><tr><th>No Invoice</th><th>Supplier</th><th>Jatuh Tempo</th><th>Hari Terlambat</th><th>Sisa Tagihan</th></tr></thead>
      <tbody>${agingRows.map(i=>`<tr><td>${i.invoice_number}</td><td>${i.supplier_name||'—'}</td><td>${i.due_date||'—'}</td><td class="red">${i.daysLate} hari</td><td class="red">${fmt((+i.total_amount||0)-(+i.amount_paid||0))}</td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center">Tidak ada aging invoice</td></tr>'}</tbody></table>
      <h3 style="margin:16px 0 4px">Purchase Orders</h3>
      <table><thead><tr><th>No PO</th><th>Supplier</th><th>Tanggal</th><th>Status</th><th>Total</th></tr></thead>
      <tbody>${data.pos.slice(0,20).map(p=>`<tr><td>${p.po_number}</td><td>${p.supplier_name||'—'}</td><td>${p.order_date||'—'}</td><td>${p.status}</td><td>${fmt(+p.total_amount||+p.total||0)}</td></tr>`).join('')}</tbody></table>
    `)
  }

  if (loading) return (
    <PageShell>
      <div className="flex items-center justify-center py-32">
        <div className="w-10 h-10 rounded-full border-2 border-gold-400 border-t-transparent animate-spin" />
      </div>
    </PageShell>
  )

  const PERIODS = [
    { id:'all',     label:'Semua' },
    { id:'month',   label:'Bulan Ini' },
    { id:'quarter', label:'Kuartal Ini' },
    { id:'year',    label:'Tahun Ini' },
  ]

  return (
    <PageShell>
      {/* Header + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><BarChart3 size={22} className="text-gold-400" /> Laporan ERP</h1>
          <p className="text-slate-400 text-sm mt-0.5">Ringkasan keuangan & pengadaan untuk Finance Manager</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Period filter */}
          <div className="flex rounded-xl overflow-hidden border border-white/[0.08]">
            {PERIODS.map(p => (
              <button key={p.id} onClick={()=>setPeriod(p.id)}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${period===p.id ? 'bg-gold-500 text-black' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'}`}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Export buttons */}
          <button onClick={exportInvoiceCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium">
            <Download size={13} /> Invoice CSV
          </button>
          <button onClick={exportPOCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 text-xs font-medium">
            <Download size={13} /> PO CSV
          </button>
          <button onClick={exportAgingCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-medium">
            <Download size={13} /> Aging CSV
          </button>
          <button onClick={exportBudgetCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-xs font-medium">
            <Download size={13} /> Budget CSV
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 text-xs font-medium">
            <Printer size={13} /> Print PDF
          </button>
          <button onClick={load} className="p-1.5 rounded-xl bg-white/[0.04] text-slate-400 hover:text-white border border-white/[0.06]">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label:'Total Nilai PO',       value:fmtShort(data?.totalPOValue),    icon:ShoppingCart, color:'text-blue-400',    bg:'bg-blue-500/10 border-blue-500/20' },
          { label:'Total Dibayar',        value:fmtShort(data?.totalPaid),       icon:DollarSign,   color:'text-emerald-400', bg:'bg-emerald-500/10 border-emerald-500/20' },
          { label:'Belum Dibayar',        value:fmtShort(data?.totalUnpaid),     icon:AlertCircle,  color:'text-red-400',     bg:'bg-red-500/10 border-red-500/20' },
          { label:'Sisa Anggaran',        value:fmtShort(data?.remainingBudget), icon:TrendingUp,   color:'text-gold-400',    bg:'bg-gold-500/10 border-gold-500/20' },
          { label:'Collection Rate',      value:`${data?.collectionRate ?? 0}%`, icon:FileText,     color: data?.collectionRate>=80?'text-emerald-400':data?.collectionRate>=50?'text-amber-400':'text-red-400', bg: data?.collectionRate>=80?'bg-emerald-500/10 border-emerald-500/20':data?.collectionRate>=50?'bg-amber-500/10 border-amber-500/20':'bg-red-500/10 border-red-500/20' },
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

      {/* ── UPCOMING PAYMENTS ─────────────────────────── */}
      {((data?.upcoming7?.length||0) + (data?.upcoming30?.length||0)) > 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 mb-6">
          <h3 className="text-amber-400 font-semibold flex items-center gap-2 mb-4">
            <Calendar size={16} /> ⚠️ Tagihan Jatuh Tempo Segera
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 7 days */}
            <div>
              <p className="text-xs text-red-400 font-semibold mb-2">🔴 Dalam 7 Hari ({data.upcoming7.length} invoice)</p>
              {data.upcoming7.length === 0
                ? <p className="text-slate-500 text-xs">Tidak ada</p>
                : data.upcoming7.map(i => (
                  <div key={i.id} className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
                    <div>
                      <p className="text-white text-xs font-mono">{i.invoice_number}</p>
                      <p className="text-slate-500 text-xs">{i.supplier_name||'—'} · JT: {i.due_date}</p>
                    </div>
                    <span className="text-red-400 font-bold text-sm">{fmtShort((+i.total_amount||0)-(+i.amount_paid||0))}</span>
                  </div>
                ))}
            </div>
            {/* 30 days */}
            <div>
              <p className="text-xs text-amber-400 font-semibold mb-2">🟡 8–30 Hari ({data.upcoming30.length} invoice)</p>
              {data.upcoming30.length === 0
                ? <p className="text-slate-500 text-xs">Tidak ada</p>
                : data.upcoming30.map(i => (
                  <div key={i.id} className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
                    <div>
                      <p className="text-white text-xs font-mono">{i.invoice_number}</p>
                      <p className="text-slate-500 text-xs">{i.supplier_name||'—'} · JT: {i.due_date}</p>
                    </div>
                    <span className="text-amber-400 font-bold text-sm">{fmtShort((+i.total_amount||0)-(+i.amount_paid||0))}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── AGING INVOICE ─────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Clock size={16} className="text-red-400" /> Aging Invoice (Tagihan Belum Lunas)
          </h3>
          {data?.totalAgingAmount > 0 && (
            <span className="text-red-400 text-sm font-bold">Total risiko: {fmtShort(data.totalAgingAmount)}</span>
          )}
        </div>

        {/* Aging summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { label:'Belum Jatuh Tempo', items:data?.aging?.current||[], color:'text-emerald-400', bg:'bg-emerald-500/[0.08] border-emerald-500/20' },
            { label:'1–30 Hari',          items:data?.aging?.d30||[],     color:'text-amber-400',  bg:'bg-amber-500/[0.08] border-amber-500/20' },
            { label:'31–60 Hari',         items:data?.aging?.d60||[],     color:'text-orange-400', bg:'bg-orange-500/[0.08] border-orange-500/20' },
            { label:'60+ Hari',           items:data?.aging?.d90||[],     color:'text-red-400',    bg:'bg-red-500/[0.08] border-red-500/20' },
          ].map(a => (
            <div key={a.label} className={`rounded-xl border p-4 text-center ${a.bg}`}>
              <p className={`text-2xl font-bold ${a.color}`}>{a.items.length}</p>
              <p className="text-slate-400 text-xs mt-1">{a.label}</p>
              <p className={`text-sm font-semibold ${a.color} mt-1`}>
                {fmtShort(a.items.reduce((s,i)=>s+(+i.total_amount||0)-(+i.amount_paid||0),0))}
              </p>
            </div>
          ))}
        </div>

        {/* Aging table */}
        {(data?.aging?.d30?.length||0)+(data?.aging?.d60?.length||0)+(data?.aging?.d90?.length||0) > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  {['No Invoice','Supplier','Jatuh Tempo','Keterlambatan','Sisa Tagihan'].map(h=>(
                    <th key={h} className="text-left py-2 px-3 text-slate-500 text-xs font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...( data.aging.d30), ...(data.aging.d60), ...(data.aging.d90)]
                  .sort((a,b)=>b.daysLate-a.daysLate)
                  .map(i => (
                  <tr key={i.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-emerald-400 font-mono text-xs">{i.invoice_number}</td>
                    <td className="py-2 px-3 text-slate-300">{i.supplier_name||'—'}</td>
                    <td className="py-2 px-3 text-slate-400 text-xs">{i.due_date||'—'}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        i.daysLate>60 ? 'bg-red-500/20 text-red-400' :
                        i.daysLate>30 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-amber-500/20 text-amber-400'}`}>
                        {i.daysLate} hari
                      </span>
                    </td>
                    <td className="py-2 px-3 text-red-400 font-semibold">{fmt((+i.total_amount||0)-(+i.amount_paid||0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-slate-500 text-sm py-4">✅ Tidak ada aging invoice</p>
        )}
      </div>

      {/* ── Status PO + Invoice ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <ShoppingCart size={16} className="text-gold-400" /> Status Purchase Order
          </h3>
          {Object.entries(data?.poByStatus||{}).map(([k,v]) => {
            const total = data?.pos?.length || 1
            const pct   = Math.round(v/total*100)
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

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <FileText size={16} className="text-gold-400" /> Status Invoice
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label:'Lunas',      count:data?.invoiceByStatus?.paid||0,   color:'text-emerald-400', bg:'bg-emerald-500/10' },
              { label:'Belum Bayar',count:data?.invoiceByStatus?.unpaid||0, color:'text-amber-400',   bg:'bg-amber-500/10' },
              { label:'Jatuh Tempo',count:data?.invoiceByStatus?.overdue||0,color:'text-red-400',     bg:'bg-red-500/10' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-3 text-center ${s.bg}`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                <p className="text-slate-400 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/[0.06] space-y-2">
            <div className="flex justify-between text-sm">
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

      {/* ── Daftar Invoice ────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-white/[0.06] flex justify-between items-center">
          <h3 className="text-white font-semibold flex items-center gap-2"><FileText size={15} className="text-gold-400" /> Daftar Invoice</h3>
          <span className="text-slate-400 text-xs">{data?.invs?.length||0} invoice dalam periode ini</span>
        </div>
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0"><tr className="border-b border-white/[0.06] bg-[#0a0f1e]">
              {['No Invoice','Supplier','Tgl Invoice','Jatuh Tempo','Status','Total','Dibayar','Sisa'].map(h=>(
                <th key={h} className="px-4 py-2 text-left text-xs text-slate-400 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(data?.invs||[]).length===0
                ? <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Tidak ada invoice dalam periode ini</td></tr>
                : (data?.invs||[]).map(i=>(
                  <tr key={i.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-2 text-emerald-400 font-mono text-xs whitespace-nowrap">{i.invoice_number}</td>
                    <td className="px-4 py-2 text-slate-300 max-w-[140px] truncate">{i.supplier_name||'—'}</td>
                    <td className="px-4 py-2 text-slate-400 text-xs whitespace-nowrap">{i.invoice_date||'—'}</td>
                    <td className="px-4 py-2 text-slate-400 text-xs whitespace-nowrap">{i.due_date||'—'}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        i.status==='paid'?'bg-emerald-500/20 text-emerald-400':
                        i.status==='overdue'?'bg-red-500/20 text-red-400':
                        i.status==='partial'?'bg-blue-500/20 text-blue-400':
                        'bg-amber-500/20 text-amber-400'}`}>{i.status}</span>
                    </td>
                    <td className="px-4 py-2 text-white whitespace-nowrap">{fmtShort(+i.total_amount||+i.total||0)}</td>
                    <td className="px-4 py-2 text-emerald-400 whitespace-nowrap">{fmtShort(+i.amount_paid||0)}</td>
                    <td className="px-4 py-2 font-semibold whitespace-nowrap" style={{color:((+i.total_amount||+i.total||0)-(+i.amount_paid||0))>0?'#f87171':'#34d399'}}>
                      {fmtShort((+i.total_amount||+i.total||0)-(+i.amount_paid||0))}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Top Supplier + Realisasi Anggaran ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Supplier */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Package size={16} className="text-gold-400" /> Top Supplier by Spend
          </h3>
          {data?.topSuppliers?.length > 0 ? (
            <div className="space-y-3">
              {data.topSuppliers.map(([name, val], idx) => {
                const maxVal = data.topSuppliers[0]?.[1] || 1
                return (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300 truncate max-w-[55%]">{idx+1}. {name}</span>
                      <span className="text-gold-400 font-semibold">{fmtShort(val)}</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2">
                      <div className="h-2 rounded-full bg-gradient-to-r from-gold-500 to-amber-400"
                        style={{width:`${Math.round(val/maxVal*100)}%`}} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-slate-500 text-sm text-center py-8">Belum ada data PO</p>
          )}
        </div>

        {/* Realisasi Anggaran */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <TrendingUp size={16} className="text-gold-400" /> Realisasi Anggaran
            </h3>
            <span className={`text-sm font-bold ${data?.budgetPct>80?'text-red-400':data?.budgetPct>60?'text-amber-400':'text-emerald-400'}`}>
              {data?.budgetPct}%
            </span>
          </div>
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-300">Total: {fmtShort(data?.totalBudget)}</span>
              <span className="text-slate-300">Terpakai: {fmtShort(data?.totalSpent)}</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
              <div className={`h-3 rounded-full transition-all ${data?.budgetPct>80?'bg-red-500':data?.budgetPct>60?'bg-amber-500':'bg-emerald-500'}`}
                style={{width:`${Math.min(data?.budgetPct||0,100)}%`}} />
            </div>
          </div>
          <div className="space-y-2">
            {data?.topBudgets?.map(b => {
              const total = +b.total_budget||+b.total||0
              const spent = +b.used_budget||+b.spent||0
              const pct = total > 0 ? Math.min(Math.round(spent/total*100),100) : 0
              return (
                <div key={b.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 truncate max-w-[60%]">{b.department_name||b.name}</span>
                    <span className={pct>80?'text-red-400':'text-slate-400'}>{fmtShort(spent)} / {fmtShort(total)}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${pct>80?'bg-red-500':pct>60?'bg-amber-500':'bg-emerald-500'}`} style={{width:`${pct}%`}} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
