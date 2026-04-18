import { useState, useEffect } from 'react'
import { ClipboardCheck, Package, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell, PageHeader, DataTable, Modal, FormField, Input, Select, StatusBadge } from '@/components/ui'

const STATUS_COLORS = {
  draft:     'warning',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'danger',
}

const COLS = [
  { key: 'ref_number', label: 'No. Opname', render: v => <span className="text-gold-400 font-mono text-sm">{v}</span> },
  { key: 'warehouse_name',  label: 'Gudang', render: v => v || '—' },
  { key: 'opname_date',label: 'Tanggal', render: v => v ? new Date(v).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '—' },
  { key: 'created_by_name', label: 'Petugas', render: v => v || '—' },
  { key: 'status', label: 'Status', render: v => <StatusBadge value={v} /> },
]

export default function OpnamePage() {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [warehouses, setWarehouses] = useState([])
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState({ warehouse_id: '', opname_date: new Date().toISOString().slice(0,10), notes: '' })

  const load = async () => {
    setLoading(true)
    try {
      const [opRes, wRes] = await Promise.all([
        api.get('/opname').catch(() => ({ data: [] })),
        api.get('/warehouses'),
      ])
      const ops = Array.isArray(opRes) ? opRes : (opRes.data || [])
      const ws  = Array.isArray(wRes)  ? wRes  : (wRes.data  || [])
      setData(ops)
      setWarehouses(ws)
    } catch { toast.error('Gagal memuat data opname') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.warehouse_id) { toast.error('Pilih gudang'); return }
    try {
      await api.post('/opname', form)
      toast.success('Opname berhasil dibuat')
      setModal(false)
      load()
    } catch (e) { toast.error(e?.response?.data?.message || 'Gagal membuat opname') }
  }

  // Summary cards dari data
  const summary = {
    total:      data.length,
    completed:  data.filter(d => d.status === 'completed').length,
    inProgress: data.filter(d => d.status === 'in_progress' || d.status === 'draft').length,
    discrepancy: data.filter(d => (d.discrepancy_count || 0) > 0).length,
  }

  return (
    <PageShell>
      <PageHeader
        icon={ClipboardCheck}
        title="Stock Opname"
        subtitle="Rekonsiliasi stok fisik vs sistem"
        onRefresh={load}
        onAdd={() => setModal(true)}
        addLabel="Buat Opname"
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Opname', value: summary.total, icon: ClipboardCheck, color: 'text-gold-400' },
          { label: 'Selesai', value: summary.completed, icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'Berlangsung', value: summary.inProgress, icon: Clock, color: 'text-blue-400' },
          { label: 'Ada Selisih', value: summary.discrepancy, icon: AlertCircle, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={16} className={s.color} />
              <span className="text-slate-400 text-xs">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        {data.length === 0 && !loading ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mb-4">
              <ClipboardCheck size={28} className="text-gold-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">Belum Ada Opname</h3>
            <p className="text-slate-500 text-sm mb-4">Buat opname pertama untuk merekonsiliasi stok gudang.</p>
            <button onClick={() => setModal(true)} className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">
              + Buat Opname
            </button>
          </div>
        ) : (
          <DataTable columns={COLS} data={data} loading={loading} emptyMessage="Tidak ada data opname" />
        )}
      </div>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Buat Stock Opname Baru">
        <div className="space-y-4">
          <FormField label="Gudang" required>
            <Select value={form.warehouse_id} onChange={e => setForm({ ...form, warehouse_id: e.target.value })}>
              <option value="">-- Pilih Gudang --</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Tanggal Opname" required>
            <Input type="date" value={form.opname_date} onChange={e => setForm({ ...form, opname_date: e.target.value })} />
          </FormField>
          <FormField label="Catatan">
            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Catatan tambahan (opsional)" />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={handleCreate} className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">Buat Opname</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
