import { useState, useEffect } from 'react'
import { ArrowLeftRight, Eye, FileText, CheckCircle, XCircle, Clock, Building2, User, Package } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { useWarehouseStore } from '@/store/warehouseStore'
import { PageShell, PageHeader, DataTable, StatusBadge, Modal, FormField, Select, Input, Textarea } from '@/components/ui'

const COLS = [
  { key: 'ref_number',    label: 'No. Transfer', render: v => <span className="text-blue-400 font-mono text-sm">{v}</span> },
  { key: 'transfer_date', label: 'Tanggal', render: v => v ? new Date(v).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '—' },
  { key: 'from_warehouse',label: 'Dari Gudang', render: v => <span className="text-orange-400">{v || '—'}</span> },
  { key: 'to_warehouse',  label: 'Ke Gudang', render: v => <span className="text-emerald-400">{v || '—'}</span> },
  { key: 'created_by_name', label: 'Dibuat Oleh' },
  { key: 'status',        label: 'Status', render: v => <StatusBadge value={v} /> },
]

function DR({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-white/[0.05] last:border-0">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={`text-sm font-medium text-right max-w-[60%] ${highlight ? 'text-gold-400' : 'text-white'}`}>{value ?? '—'}</span>
    </div>
  )
}

export default function StockTransferPage() {
  const { user } = useAuthStore()
  const { selectedWarehouseId, getSelectedName } = useWarehouseStore()
  const isAdmin = user?.role === 'admin'
  const canCreate = ['admin', 'staff'].includes(user?.role)
  const [data, setData]           = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [items, setItems]         = useState([])
  const [itemStocks, setItemStocks] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [rejectModal, setRejectModal] = useState(false)
  const [selected, setSelected]   = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [form, setForm]           = useState({ from_warehouse_id: '', to_warehouse_id: '', transfer_date: new Date().toISOString().slice(0,10), notes: '' })
  const [lines, setLines]         = useState([{ item_id: '', qty: 1 }])

  const myWarehouses = user?.warehouses || []
  const fromWarehouseOptions = isAdmin ? warehouses : warehouses.filter(w => myWarehouses.some(mw => mw.id === w.id))

  const load = async () => {
    setLoading(true)
    try {
      const whParam = selectedWarehouseId ? `?warehouse_id=${selectedWarehouseId}` : ''
      const [trf, w, i] = await Promise.all([
        api.get(`/stock-transfers${whParam}`),
        api.get('/warehouses'),
        api.get('/items'),
      ])
      setData(Array.isArray(trf) ? trf : (trf.data || []))
      setWarehouses(Array.isArray(w) ? w : (w.data || []))
      setItems(Array.isArray(i) ? i : (i.data || []))
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [selectedWarehouseId])

  useEffect(() => {
    if (!isAdmin && fromWarehouseOptions.length === 1 && !form.from_warehouse_id) {
      setForm(f => ({ ...f, from_warehouse_id: fromWarehouseOptions[0].id }))
    }
  }, [fromWarehouseOptions, isAdmin])

  const addLine = () => setLines([...lines, { item_id: '', qty: 1 }])
  const rmLine  = i => setLines(lines.filter((_, idx) => idx !== i))
  const setLine = (i, k, v) => setLines(lines.map((l, idx) => idx === i ? {...l, [k]: v} : l))

  const submit = async () => {
    if (!form.from_warehouse_id || !form.to_warehouse_id) {
      toast.error('Pilih gudang asal dan tujuan'); return
    }
    if (form.from_warehouse_id === form.to_warehouse_id) {
      toast.error('Gudang asal dan tujuan tidak boleh sama'); return
    }
    const validLines = lines.filter(l => l.item_id && l.qty > 0)
    if (!validLines.length) {
      toast.error('Minimal 1 item dengan qty valid'); return
    }
    try {
      await api.post('/stock-transfers', { ...form, items: validLines })
      toast.success('Request transfer dibuat! Menunggu approval Admin.')
      setModal(false); load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal membuat transfer')
    }
  }

  const openView = async (row) => {
    try {
      const detail = await api.get(`/stock-transfers/${row.id}`)
      setSelected(detail.data || detail)
    } catch {
      setSelected(row)
    }
    setDetailModal(true)
  }

  const handleApprove = async () => {
    if (!selected) return
    try {
      await api.put(`/stock-transfers/${selected.id}/approve`, {})
      toast.success('Transfer disetujui! Stok sudah berpindah.')
      setDetailModal(false); load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal approve')
    }
  }

  const handleReject = async () => {
    try {
      await api.put(`/stock-transfers/${selected.id}/reject`, { reason: rejectReason })
      toast.success('Transfer ditolak')
      setRejectModal(false); setDetailModal(false); setRejectReason(''); load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal reject')
    }
  }

  // Count pending transfers for badge
  const pendingCount = data.filter(d => d.status === 'pending').length

  return (
    <PageShell>
      <PageHeader icon={ArrowLeftRight} title="Transfer Stok" subtitle={`Pindah stok antar gudang — ${getSelectedName()}`}
        onRefresh={load} onAdd={canCreate ? () => setModal(true) : undefined} addLabel="Buat Transfer" />

      {/* Pending alert for Admin */}
      {isAdmin && pendingCount > 0 && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <Clock size={14} className="text-yellow-400" />
          <span className="text-yellow-400 text-sm font-medium">
            {pendingCount} transfer menunggu approval Anda
          </span>
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} onView={openView} emptyMessage="Belum ada transfer stok" />
      </div>

      {/* ── Detail Modal ── */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
            <Eye size={14} className="text-blue-400" />
          </div>
          <div>
            <div className="text-white font-bold">{selected?.ref_number}</div>
            <div className="text-slate-500 text-xs">Detail Transfer Stok</div>
          </div>
        </div>
      }>
        {selected && (
          <div className="space-y-4">
            {/* Status Banner */}
            {selected.status === 'pending' && (
              <div className="flex items-center gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-2.5">
                <Clock size={14} className="text-yellow-400" />
                <span className="text-yellow-400 text-sm font-medium">⏳ Menunggu approval Administrator</span>
              </div>
            )}
            {selected.status === 'rejected' && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <XCircle size={14} className="text-red-400" />
                  <span className="text-red-400 text-sm font-medium">Transfer ditolak</span>
                </div>
                {selected.reject_reason && (
                  <p className="text-red-400/70 text-xs mt-1 ml-6">Alasan: {selected.reject_reason}</p>
                )}
              </div>
            )}
            {selected.status === 'completed' && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5">
                <CheckCircle size={14} className="text-emerald-400" />
                <span className="text-emerald-400 text-sm font-medium">✅ Transfer disetujui — Stok sudah berpindah</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Info Transfer */}
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className="text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Info Transfer</span>
                </div>
                <DR label="No. Transfer" value={selected.ref_number} highlight />
                <DR label="Tanggal" value={selected.transfer_date ? new Date(selected.transfer_date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) : '—'} />
                <DR label="Status" value={<StatusBadge value={selected.status} />} />
              </div>

              {/* Gudang & Pelaku */}
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={14} className="text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Detail</span>
                </div>
                <DR label="Dari Gudang" value={<span className="text-orange-400">{selected.from_warehouse || '—'}</span>} />
                <DR label="Ke Gudang" value={<span className="text-emerald-400">{selected.to_warehouse || '—'}</span>} />
                <DR label="Dibuat Oleh" value={selected.created_by_name || '—'} />
                {selected.approved_by_name && <DR label={selected.status === 'rejected' ? 'Ditolak Oleh' : 'Disetujui Oleh'} value={selected.approved_by_name} />}
              </div>
            </div>

            {/* Transfer Items */}
            {selected.items && selected.items.length > 0 && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Package size={14} className="text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Item yang Ditransfer</span>
                </div>
                <div className="space-y-1">
                  {selected.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1.5 border-b border-white/[0.04] last:border-0">
                      <div>
                        <span className="text-sm text-white">{item.item_name || '—'}</span>
                        <span className="text-xs text-slate-500 ml-2">{item.sku}</span>
                      </div>
                      <span className="text-sm font-semibold text-gold-400">{item.qty} pcs</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.notes && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="text-xs text-slate-500 mb-1">Catatan</p>
                <p className="text-sm text-slate-300">{selected.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              {isAdmin && selected.status === 'pending' && (
                <>
                  <button
                    onClick={() => { setRejectReason(''); setRejectModal(true) }}
                    className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-medium text-sm transition-all flex items-center gap-2"
                  >
                    <XCircle size={14} /> Tolak
                  </button>
                  <button
                    onClick={handleApprove}
                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-all flex items-center gap-2"
                  >
                    <CheckCircle size={14} /> Setujui Transfer
                  </button>
                </>
              )}
              {(!isAdmin || selected.status !== 'pending') && (
                <button onClick={() => setDetailModal(false)} className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm">Tutup</button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Reject Modal ── */}
      <Modal open={rejectModal} onClose={() => setRejectModal(false)} title="Tolak Transfer">
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5">
            <XCircle size={14} className="text-red-400" />
            <span className="text-red-400 text-sm font-medium">Transfer {selected?.ref_number} akan ditolak</span>
          </div>
          <FormField label="Alasan Penolakan" required>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Jelaskan alasan penolakan..." />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setRejectModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={handleReject} disabled={!rejectReason.trim()} className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-semibold text-sm disabled:opacity-50">Konfirmasi Tolak</button>
          </div>
        </div>
      </Modal>

      {/* ── Create Modal ── */}
      <Modal open={modal} onClose={() => setModal(false)} title="Buat Request Transfer Stok" size="lg">
        <div className="space-y-4">
          {/* Info banner */}
          <div className="flex items-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-2.5">
            <Clock size={14} className="text-blue-400" />
            <span className="text-blue-400 text-sm">Transfer akan menunggu approval Administrator sebelum stok berpindah</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Dari Gudang" required>
              {!isAdmin && fromWarehouseOptions.length === 1 ? (
                <div className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm">
                  {fromWarehouseOptions[0].name} — {fromWarehouseOptions[0].city || ''}
                </div>
              ) : (
                <Select value={form.from_warehouse_id} onChange={e => { setForm({...form, from_warehouse_id: e.target.value}); setLines([{item_id:'',qty:1}]) }}>
                  <option value="">Pilih gudang asal</option>
                  {fromWarehouseOptions.map(w => <option key={w.id} value={w.id}>{w.name} — {w.city}</option>)}
                </Select>
              )}
            </FormField>
            <FormField label="Ke Gudang" required>
              <Select value={form.to_warehouse_id} onChange={e => setForm({...form, to_warehouse_id: e.target.value})}>
                <option value="">Pilih gudang tujuan</option>
                {warehouses.filter(w => w.id !== form.from_warehouse_id).map(w =>
                  <option key={w.id} value={w.id}>{w.name} — {w.city}</option>
                )}
              </Select>
            </FormField>
          </div>

          <div className="border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Item yang Dipindah
                {!form.from_warehouse_id && <span className="text-yellow-500 ml-2">— Pilih gudang asal dulu</span>}
              </span>
              <button onClick={addLine} className="text-blue-400 text-xs font-medium hover:text-blue-300">+ Tambah Item</button>
            </div>
            <div className="space-y-2">
              {lines.map((ln, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-7">
                    <Select value={ln.item_id} onChange={e => setLine(idx, 'item_id', e.target.value)}>
                      <option value="">Pilih item</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Input type="number" min="1"
                      value={ln.qty} onChange={e => setLine(idx, 'qty', +e.target.value)} placeholder="Jumlah" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {lines.length > 1 && <button onClick={() => rmLine(idx)} className="text-red-400 hover:text-red-300">✕</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <FormField label="Catatan">
            <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-blue-500/50"
              placeholder="Alasan transfer..." />
          </FormField>

          <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={submit} className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm">Request Transfer</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
