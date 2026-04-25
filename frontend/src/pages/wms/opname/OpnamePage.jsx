import { useState, useEffect } from 'react'
import { ClipboardCheck, CheckCircle, AlertCircle, Clock, Eye, FileText, Building2 } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { PageShell, PageHeader, DataTable, Modal, FormField, Input, Select, StatusBadge } from '@/components/ui'

function DR({ label, value }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-white/[0.05] last:border-0">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className="text-sm font-medium text-white text-right max-w-[60%]">{value ?? '—'}</span>
    </div>
  )
}

const COLS = [
  { key: 'ref_number',      label: 'No. Opname', render: v => <span className="text-gold-400 font-mono text-sm">{v}</span> },
  { key: 'warehouse_name', label: 'Gudang',      render: v => v || '—' },
  { key: 'opname_date',    label: 'Tanggal',     render: v => v ? new Date(v).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '—' },
  { key: 'created_by_name',label: 'Petugas',     render: v => v || '—' },
  { key: 'status',         label: 'Status',      render: v => <StatusBadge value={v} /> },
]

export default function OpnamePage() {
  const { user } = useAuthStore()
  const canCreate = ['admin', 'staff'].includes(user?.role)

  const [data, setData]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [warehouses, setWarehouses] = useState([])
  const [modal, setModal]         = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [countModal, setCountModal]   = useState(false)
  const [selected, setSelected]   = useState(null)
  const [opnameDetail, setOpnameDetail] = useState(null)
  const [counts, setCounts]       = useState({})
  const [form, setForm]           = useState({ warehouse_id: '', opname_date: new Date().toISOString().slice(0,10), notes: '' })

  const load = async () => {
    setLoading(true)
    try {
      const [opRes, wRes] = await Promise.all([
        api.get('/opname').catch(() => ({ data: [] })),
        api.get('/warehouses'),
      ])
      setData(Array.isArray(opRes) ? opRes : (opRes.data || []))
      setWarehouses(Array.isArray(wRes) ? wRes : (wRes.data || []))
    } catch { toast.error('Gagal memuat data opname') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.warehouse_id) { toast.error('Pilih gudang'); return }
    try {
      await api.post('/opname', form)
      toast.success('Opname berhasil dibuat')
      setModal(false); load()
    } catch (e) { toast.error(e?.response?.data?.message || 'Gagal membuat opname') }
  }

  const openView = (row) => { setSelected(row); setDetailModal(true) }

  const openCount = async () => {
    try {
      const res = await api.get(`/opname/${selected.id}`)
      // API interceptor returns response.data; backend wraps in { data: {...} }
      const detail = res?.data || res
      if (!detail || (!detail.items?.length && !detail.id)) {
        toast.error('Gagal memuat detail opname'); return
      }
      if (!detail.items?.length) {
        toast.error('Opname ini tidak memiliki item. Tidak bisa diselesaikan.')
        return
      }
      setOpnameDetail(detail)
      const initial = {}
      ;(detail.items || []).forEach(item => {
        initial[item.item_id] = item.physical_count >= 0 ? item.physical_count : item.system_stock
      })
      setCounts(initial)
      setDetailModal(false)
      setCountModal(true)
    } catch { toast.error('Gagal memuat detail opname') }
  }

  const submitCount = async () => {
    if (!opnameDetail) return
    const items = (opnameDetail.items || []).map(item => ({
      item_id: item.item_id,
      physical_count: parseInt(counts[item.item_id] ?? item.system_stock, 10),
    }))
    try {
      const res = await api.post(`/opname/${opnameDetail.id}/submit`, { items })
      toast.success(`Opname selesai! ${res.discrepancy_count ?? 0} item ada selisih`)
      setCountModal(false); load()
    } catch (e) { toast.error(e?.response?.data?.message || 'Gagal submit opname') }
  }

  const summary = {
    total:       data.length,
    completed:   data.filter(d => d.status === 'completed').length,
    inProgress:  data.filter(d => d.status === 'in_progress' || d.status === 'draft').length,
    discrepancy: data.filter(d => (d.discrepancy_count || 0) > 0).length,
  }

  return (
    <PageShell>
      <PageHeader
        icon={ClipboardCheck} title="Stock Opname" subtitle="Rekonsiliasi stok fisik vs sistem"
        onRefresh={load} onAdd={canCreate ? () => setModal(true) : undefined} addLabel="Buat Opname"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Opname', value: summary.total,       icon: ClipboardCheck, color: 'text-gold-400' },
          { label: 'Selesai',      value: summary.completed,   icon: CheckCircle,    color: 'text-emerald-400' },
          { label: 'Berlangsung',  value: summary.inProgress,  icon: Clock,          color: 'text-blue-400' },
          { label: 'Ada Selisih',  value: summary.discrepancy, icon: AlertCircle,    color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2"><s.icon size={16} className={s.color} /><span className="text-slate-400 text-xs">{s.label}</span></div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} onView={openView} emptyMessage="Belum ada data opname" />
      </div>

      {/* Detail Modal */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold-500/15 border border-gold-500/20 flex items-center justify-center"><Eye size={14} className="text-gold-400" /></div>
          <div><div className="text-white font-bold">{selected?.ref_number}</div><div className="text-slate-500 text-xs">Stock Opname</div></div>
        </div>
      }>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3"><FileText size={14} className="text-gold-400" /><span className="text-xs font-semibold text-gold-400 uppercase tracking-wider">Info Opname</span></div>
                <DR label="No. Opname" value={selected.ref_number} />
                <DR label="Tanggal" value={selected.opname_date ? new Date(selected.opname_date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) : '—'} />
                <DR label="Status" value={<StatusBadge value={selected.status} />} />
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3"><Building2 size={14} className="text-gold-400" /><span className="text-xs font-semibold text-gold-400 uppercase tracking-wider">Detail</span></div>
                <DR label="Gudang" value={selected.warehouse_name || '—'} />
                <DR label="Petugas" value={selected.created_by_name || '—'} />
                <DR label="Ada Selisih" value={selected.discrepancy_count > 0 ? `⚠️ ${selected.discrepancy_count} item` : '✅ Tidak ada'} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              {canCreate && selected.status === 'in_progress' && (
                <button onClick={openCount} className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm">
                  📋 Hitung &amp; Selesaikan
                </button>
              )}
              <button onClick={() => setDetailModal(false)} className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">Tutup</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Count Input Modal */}
      <Modal open={countModal} onClose={() => setCountModal(false)} title="📋 Input Jumlah Fisik" size="lg">
        {opnameDetail && (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">Masukkan jumlah fisik setiap item hasil penghitungan di gudang. Field berwarna kuning = ada selisih.</p>
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              <div className="grid grid-cols-12 gap-2 px-2 pb-2 border-b border-white/[0.06]">
                <span className="col-span-5 text-xs text-slate-500 uppercase tracking-wider">Nama Item</span>
                <span className="col-span-3 text-xs text-slate-500 uppercase tracking-wider text-center">Sistem</span>
                <span className="col-span-4 text-xs text-slate-500 uppercase tracking-wider text-center">Fisik</span>
              </div>
              {(opnameDetail.items || []).map(item => {
                const fisik = parseInt(counts[item.item_id] ?? item.system_stock, 10)
                const selisih = fisik - item.system_stock
                return (
                  <div key={item.item_id} className="grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded-lg hover:bg-white/[0.02]">
                    <div className="col-span-5">
                      <p className="text-sm text-white font-medium truncate">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.sku}</p>
                    </div>
                    <div className="col-span-3 text-center">
                      <span className="text-blue-400 font-semibold">{item.system_stock}</span>
                      {selisih !== 0 && <p className={`text-xs ${selisih > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{selisih > 0 ? '+' : ''}{selisih}</p>}
                    </div>
                    <div className="col-span-4">
                      <input
                        type="number" min="0"
                        value={counts[item.item_id] ?? item.system_stock}
                        onChange={e => setCounts(prev => ({ ...prev, [item.item_id]: e.target.value }))}
                        className={`w-full text-center rounded-lg border px-2 py-1.5 text-sm bg-white/[0.05] text-white outline-none focus:ring-1 ${
                          selisih !== 0 ? 'border-amber-500/50 focus:ring-amber-500/30 text-amber-300' : 'border-white/[0.08] focus:ring-gold-500/30'
                        }`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
              <button onClick={() => setCountModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
              <button onClick={submitCount} className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm">✅ Selesaikan Opname</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Modal */}
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
