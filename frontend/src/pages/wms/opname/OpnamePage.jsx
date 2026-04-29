import { useState, useEffect } from 'react'
import { ClipboardCheck, CheckCircle, AlertCircle, Clock, Eye, FileText, Building2, ShieldCheck, XCircle, User } from 'lucide-react'
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
  { key: 'created_by_name',label: 'Dibuat Oleh', render: v => v || '—' },
  { key: 'counted_by_name',label: 'Dihitung Oleh', render: v => v || <span className="text-slate-600 italic">Belum</span> },
  { key: 'status',         label: 'Status',      render: v => <StatusBadge value={v} /> },
]

export default function OpnamePage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const isStaff = user?.role === 'staff'

  const [data, setData]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [warehouses, setWarehouses] = useState([])
  const [modal, setModal]         = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [countModal, setCountModal]   = useState(false)
  const [reviewModal, setReviewModal] = useState(false)
  const [rejectModal, setRejectModal] = useState(false)
  const [selected, setSelected]   = useState(null)
  const [opnameDetail, setOpnameDetail] = useState(null)
  const [counts, setCounts]       = useState({})
  const [rejectReason, setRejectReason] = useState('')
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

  // Tahap 1: Admin buat opname
  const handleCreate = async () => {
    if (!form.warehouse_id) { toast.error('Pilih gudang'); return }
    try {
      await api.post('/opname', form)
      toast.success('Opname berhasil dibuat, Staff bisa mulai menghitung')
      setModal(false); load()
    } catch (e) { toast.error(e?.response?.data?.message || 'Gagal membuat opname') }
  }

  const openView = (row) => { setSelected(row); setDetailModal(true) }

  // Load detail untuk counting atau review
  const loadDetail = async (forMode) => {
    try {
      const res = await api.get(`/opname/${selected.id}`)
      const detail = res?.data || res
      if (!detail || (!detail.items?.length && !detail.id)) {
        toast.error('Gagal memuat detail opname'); return
      }
      if (!detail.items?.length) {
        toast.error('Opname ini tidak memiliki item.')
        return
      }
      setOpnameDetail(detail)
      if (forMode === 'count') {
        const initial = {}
        ;(detail.items || []).forEach(item => {
          initial[item.item_id] = item.physical_count >= 0 ? item.physical_count : item.system_stock
        })
        setCounts(initial)
        setDetailModal(false)
        setCountModal(true)
      } else if (forMode === 'review') {
        setDetailModal(false)
        setReviewModal(true)
      }
    } catch { toast.error('Gagal memuat detail opname') }
  }

  // Tahap 2: Staff submit hitungan
  const submitCount = async () => {
    if (!opnameDetail) return
    const items = (opnameDetail.items || []).map(item => ({
      item_id: item.item_id,
      physical_count: parseInt(counts[item.item_id] ?? item.system_stock, 10),
      system_stock: item.system_stock,
    }))
    try {
      const res = await api.post(`/opname/${opnameDetail.id}/submit`, { items })
      toast.success(`Hitungan terkirim! ${res.discrepancy_count ?? 0} item ada selisih. Menunggu approval Admin.`)
      setCountModal(false); load()
    } catch (e) { toast.error(e?.response?.data?.message || 'Gagal submit hitungan') }
  }

  // Tahap 3a: Admin approve
  const handleApprove = async () => {
    if (!opnameDetail) return
    try {
      await api.put(`/opname/${opnameDetail.id}/approve`, { adjust_stock: true })
      toast.success('Opname disetujui! Stok sudah disesuaikan.')
      setReviewModal(false); load()
    } catch (e) { toast.error(e?.response?.data?.message || 'Gagal approve opname') }
  }

  // Tahap 3b: Admin reject
  const handleReject = async () => {
    if (!opnameDetail) return
    try {
      await api.put(`/opname/${opnameDetail.id}/reject`, { reason: rejectReason || 'Perlu hitung ulang' })
      toast.success('Opname ditolak. Staff akan menghitung ulang.')
      setRejectModal(false); setReviewModal(false); setRejectReason(''); load()
    } catch (e) { toast.error(e?.response?.data?.message || 'Gagal reject opname') }
  }

  const summary = {
    total:         data.length,
    completed:     data.filter(d => d.status === 'completed').length,
    inProgress:    data.filter(d => d.status === 'in_progress').length,
    pendingReview: data.filter(d => d.status === 'pending_review').length,
  }

  return (
    <PageShell>
      <PageHeader
        icon={ClipboardCheck} title="Stock Opname" subtitle="Rekonsiliasi stok fisik vs sistem"
        onRefresh={load} onAdd={isAdmin ? () => setModal(true) : undefined} addLabel="Buat Opname"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Opname',     value: summary.total,         icon: ClipboardCheck, color: 'text-gold-400' },
          { label: 'Selesai',          value: summary.completed,     icon: CheckCircle,    color: 'text-emerald-400' },
          { label: 'Menunggu Hitung',  value: summary.inProgress,    icon: Clock,          color: 'text-blue-400' },
          { label: 'Menunggu Review',  value: summary.pendingReview, icon: AlertCircle,    color: 'text-amber-400' },
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
                <div className="flex items-center gap-2 mb-3"><User size={14} className="text-gold-400" /><span className="text-xs font-semibold text-gold-400 uppercase tracking-wider">Petugas</span></div>
                <DR label="Gudang" value={selected.warehouse_name || '—'} />
                <DR label="Dibuat Oleh" value={selected.created_by_name || '—'} />
                <DR label="Dihitung Oleh" value={selected.counted_by_name || <span className="text-slate-500 italic">Belum dihitung</span>} />
                <DR label="Disetujui Oleh" value={selected.approved_by_name || <span className="text-slate-500 italic">Belum disetujui</span>} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              {/* Staff: tombol hitung (hanya jika status in_progress) */}
              {isStaff && selected.status === 'in_progress' && (
                <button onClick={() => loadDetail('count')} className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm">
                  📋 Input Hitungan Fisik
                </button>
              )}
              {/* Admin: tombol review (hanya jika status pending_review) */}
              {isAdmin && selected.status === 'pending_review' && (
                <button onClick={() => loadDetail('review')} className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm">
                  🔍 Review & Approve
                </button>
              )}
              <button onClick={() => setDetailModal(false)} className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">Tutup</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Count Input Modal — Staff Only */}
      <Modal open={countModal} onClose={() => setCountModal(false)} title="📋 Input Jumlah Fisik (Staff)" size="lg">
        {opnameDetail && (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
              <p className="text-blue-300 text-sm">Masukkan jumlah fisik setiap item hasil penghitungan di gudang. Setelah submit, data akan dikirim ke <strong>Admin</strong> untuk di-review.</p>
            </div>
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
                      <p className="text-sm text-white font-medium truncate">{item.item_name || item.name}</p>
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
              <button onClick={submitCount} className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm">📤 Kirim ke Admin</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Review Modal — Admin Only */}
      <Modal open={reviewModal} onClose={() => setReviewModal(false)} title="🔍 Review Hasil Opname (Admin)" size="lg">
        {opnameDetail && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-amber-300 text-sm">
                Dihitung oleh: <strong>{opnameDetail.counted_by_name || '—'}</strong> pada {opnameDetail.counted_at ? new Date(opnameDetail.counted_at).toLocaleString('id-ID') : '—'}.
                Periksa hasil hitungan, lalu <strong>Setujui</strong> (stok akan disesuaikan) atau <strong>Tolak</strong> (Staff hitung ulang).
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              <div className="grid grid-cols-12 gap-2 px-2 pb-2 border-b border-white/[0.06]">
                <span className="col-span-4 text-xs text-slate-500 uppercase tracking-wider">Nama Item</span>
                <span className="col-span-2 text-xs text-slate-500 uppercase tracking-wider text-center">Sistem</span>
                <span className="col-span-2 text-xs text-slate-500 uppercase tracking-wider text-center">Fisik</span>
                <span className="col-span-2 text-xs text-slate-500 uppercase tracking-wider text-center">Selisih</span>
                <span className="col-span-2 text-xs text-slate-500 uppercase tracking-wider text-center">Status</span>
              </div>
              {(opnameDetail.items || []).map(item => {
                const disc = (item.physical_count ?? 0) - (item.system_stock ?? 0)
                return (
                  <div key={item.item_id} className={`grid grid-cols-12 gap-2 items-center px-2 py-2 rounded-lg ${disc !== 0 ? 'bg-amber-500/5 border border-amber-500/10' : 'hover:bg-white/[0.02]'}`}>
                    <div className="col-span-4">
                      <p className="text-sm text-white font-medium truncate">{item.item_name || item.name}</p>
                      <p className="text-xs text-slate-500">{item.sku}</p>
                    </div>
                    <div className="col-span-2 text-center text-blue-400 font-semibold">{item.system_stock}</div>
                    <div className="col-span-2 text-center text-white font-semibold">{item.physical_count ?? '—'}</div>
                    <div className={`col-span-2 text-center font-bold ${disc > 0 ? 'text-emerald-400' : disc < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {disc > 0 ? '+' : ''}{disc}
                    </div>
                    <div className="col-span-2 text-center">
                      {disc === 0
                        ? <span className="text-xs text-emerald-400">✅ Cocok</span>
                        : <span className="text-xs text-amber-400">⚠️ Selisih</span>
                      }
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-white/[0.06]">
              <div className="text-xs text-slate-500">
                Total selisih: <strong className="text-amber-400">{opnameDetail.discrepancy_count ?? (opnameDetail.items || []).filter(i => (i.physical_count ?? 0) !== (i.system_stock ?? 0)).length} item</strong>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setRejectReason(''); setRejectModal(true) }}
                  className="px-4 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-semibold flex items-center gap-1.5">
                  <XCircle size={14} /> Tolak
                </button>
                <button onClick={handleApprove}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm flex items-center gap-1.5">
                  <ShieldCheck size={14} /> Setujui & Adjust Stok
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Reason Modal */}
      <Modal open={rejectModal} onClose={() => setRejectModal(false)} title="Alasan Penolakan">
        <div className="space-y-4">
          <FormField label="Alasan" required>
            <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Jelaskan alasan penolakan..." />
          </FormField>
          <div className="flex justify-end gap-3">
            <button onClick={() => setRejectModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={handleReject} className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-semibold text-sm">Tolak Opname</button>
          </div>
        </div>
      </Modal>

      {/* Create Modal — Admin Only */}
      <Modal open={modal} onClose={() => setModal(false)} title="Buat Stock Opname Baru">
        <div className="space-y-4">
          <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-3">
            <p className="text-gold-300 text-sm">Setelah opname dibuat, <strong>Warehouse Staff</strong> akan melakukan penghitungan fisik di gudang.</p>
          </div>
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
