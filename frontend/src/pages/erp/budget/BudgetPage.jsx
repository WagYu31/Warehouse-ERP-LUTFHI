import { useState, useEffect } from 'react'
import { PiggyBank } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell, PageHeader, DataTable, Modal, FormField, Input, Select } from '@/components/ui'

const COLS = [
  { key: 'name',         label: 'Nama Anggaran', render: v => <span className="text-white font-medium">{v}</span> },
  { key: 'total',        label: 'Total', render: v => <span className="text-white font-semibold">Rp {Number(v||0).toLocaleString('id-ID')}</span> },
  { key: 'spent',        label: 'Terpakai', render: v => <span className="text-orange-400">Rp {Number(v||0).toLocaleString('id-ID')}</span> },
  { key: 'period_start', label: 'Mulai', render: v => v || '—' },
  { key: 'period_end',   label: 'Selesai', render: v => v || '—' },
  { key: 'id', label: 'Sisa', render: (v,r) => {
    const sisa = (r.total||0) - (r.spent||0)
    const pct  = r.total > 0 ? ((r.spent||0)/r.total*100) : 0
    return (
      <div>
        <div className={`text-sm font-semibold ${pct > 80 ? 'text-red-400' : 'text-emerald-400'}`}>Rp {sisa.toLocaleString('id-ID')}</div>
        <div className="w-24 h-1.5 rounded-full bg-white/[0.06] mt-1 overflow-hidden">
          <div className={`h-full rounded-full ${pct>80?'bg-red-500':pct>60?'bg-yellow-500':'bg-emerald-500'}`} style={{width:`${Math.min(pct,100)}%`}} />
        </div>
      </div>
    )
  }},
]

export default function BudgetPage() {
  const [data, setData]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState({ name:'', total_amount:0, period_start:'', period_end:'', period_type:'monthly' })

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/erp/budgets')
      setData(Array.isArray(res) ? res : (res.data || []))
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const submit = async () => {
    try {
      await api.post('/erp/budgets', form); toast.success('Budget dibuat'); setModal(false); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal') }
  }

  return (
    <PageShell>
      <PageHeader icon={PiggyBank} title="Budget & Anggaran" subtitle="Pantau dan kelola anggaran pengadaan" onRefresh={load} onAdd={() => setModal(true)} addLabel="Buat Budget" />
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} emptyMessage="Belum ada anggaran" />
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Buat Budget Baru">
        <div className="space-y-4">
          <FormField label="Nama Anggaran" required><Input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="Anggaran Q1 2026" /></FormField>
          <FormField label="Total Anggaran (Rp)"><Input type="number" value={form.total_amount} onChange={e => setForm({...form, total_amount:+e.target.value})} /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Mulai"><Input type="date" value={form.period_start} onChange={e => setForm({...form, period_start:e.target.value})} /></FormField>
            <FormField label="Selesai"><Input type="date" value={form.period_end} onChange={e => setForm({...form, period_end:e.target.value})} /></FormField>
          </div>
          <FormField label="Tipe Periode"><Select value={form.period_type} onChange={e => setForm({...form, period_type:e.target.value})}>
            <option value="monthly">Bulanan</option>
            <option value="quarterly">Triwulan</option>
            <option value="yearly">Tahunan</option>
          </Select></FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={submit} className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">Simpan</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
