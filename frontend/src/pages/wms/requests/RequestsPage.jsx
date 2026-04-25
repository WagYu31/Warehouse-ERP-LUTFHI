import { useState, useEffect } from 'react'
import { ClipboardList, Plus, Check, X, Eye, FileText, User } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell, PageHeader, SearchBar, DataTable, StatusBadge, Modal, FormField, Input, Select, Textarea } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'

const COLS = [
  { key: 'ref_number',          label: 'No. SPB', render: v => <span className="text-blue-400 font-mono text-sm">{v}</span> },
  { key: 'required_date',       label: 'Tgl. Butuh', render: v => v ? new Date(v).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '—' },
  { key: 'purpose',             label: 'Keperluan', render: v => <span className="text-slate-300 truncate max-w-xs block">{v || '—'}</span> },
  { key: 'priority',            label: 'Prioritas', render: v => <StatusBadge value={v === 'urgent' ? 'high' : v === 'normal' ? 'normal_p' : 'low'} /> },
  { key: 'requested_by_name',   label: 'Pemohon' },
  { key: 'item_count',          label: 'Jumlah Item' },
  { key: 'status',              label: 'Status', render: v => <StatusBadge value={v} /> },
]

function DR({ label, value }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-white/[0.05] last:border-0">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className="text-sm font-medium text-white text-right max-w-[60%]">{value ?? '—'}</span>
    </div>
  )
}

export default function RequestsPage() {
  const { user } = useAuthStore()
  const [data, setData]       = useState([])
  const [items, setItems]     = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [search, setSearch]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm]       = useState({ required_date:'', purpose:'', priority:'normal', department_id:'', notes:'' })
  const [lines, setLines]     = useState([{ item_id:'', qty_requested:1 }])
  const canApprove = user?.role === 'admin'

  const load = async () => {
    setLoading(true)
    try {
      const [r, i, w] = await Promise.all([api.get(`/requests?status=${statusFilter}`), api.get('/items'), api.get('/warehouses')])
      let d = r.data || []
      if (search) d = d.filter(x => x.ref_number?.toLowerCase().includes(search.toLowerCase()) || x.purpose?.toLowerCase().includes(search.toLowerCase()))
      setData(d); setItems(i.data||[]); setWarehouses(w.data||[])
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search, statusFilter])

  const addLine = () => setLines([...lines, { item_id:'', qty_requested:1 }])
  const rmLine  = (i) => setLines(lines.filter((_,idx) => idx !== i))
  const setLine = (i, k, v) => setLines(lines.map((l, idx) => idx===i ? {...l, [k]: v} : l))

  const submit = async () => {
    if (!form.required_date || !form.purpose) { toast.error('Isi tanggal dan keperluan'); return }
    try {
      await api.post('/requests', { ...form, items: lines.filter(l => l.item_id).map(l => ({ item_id:l.item_id, qty_requested:+l.qty_requested })) })
      toast.success('SPB berhasil dibuat!'); setModal(false); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan') }
  }

  const approve = async (row) => {
    await api.put(`/requests/${row.id}/approve`)
    toast.success('SPB disetujui'); load()
  }
  const reject = async (row) => {
    const notes = prompt('Alasan penolakan:')
    if (notes === null) return
    await api.put(`/requests/${row.id}/reject`, { notes })
    toast.success('SPB ditolak'); load()
  }

  const openView = (row) => { setSelected(row); setDetailModal(true) }

  const PRIORITY_LABEL = { urgent: '🔴 Urgent', normal: '🟡 Normal', low: '🟢 Rendah' }

  return (
    <PageShell>
      <PageHeader icon={ClipboardList} title="Surat Permintaan Barang (SPB)" subtitle="Kelola permintaan dan persetujuan barang" onRefresh={load} onAdd={() => setModal(true)} addLabel="Buat SPB" />

      <div className="flex gap-3 mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Cari No. SPB atau keperluan..." />
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 160, flex: 'none' }}>
          <option value="">Semua Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Ditolak</option>
        </Select>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} onView={openView} emptyMessage="Belum ada SPB" />
      </div>

      {/* Detail Modal */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
            <Eye size={14} className="text-blue-400" />
          </div>
          <div>
            <div className="text-white font-bold">{selected?.ref_number}</div>
            <div className="text-slate-500 text-xs">Surat Permintaan Barang</div>
          </div>
        </div>
      }>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className="text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Info SPB</span>
                </div>
                <DR label="No. SPB" value={selected.ref_number} />
                <DR label="Tgl. Dibutuhkan" value={selected.required_date ? new Date(selected.required_date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) : '—'} />
                <DR label="Prioritas" value={PRIORITY_LABEL[selected.priority] || selected.priority} />
                <DR label="Jumlah Item" value={selected.item_count || '—'} />
                <DR label="Status" value={<StatusBadge value={selected.status} />} />
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User size={14} className="text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Pemohon</span>
                </div>
                <DR label="Diajukan Oleh" value={selected.requested_by_name || '—'} />
                <DR label="Departemen" value={selected.department_name || '—'} />
                <DR label="Keperluan" value={selected.purpose || '—'} />
              </div>
            </div>
            {selected.notes && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="text-xs text-slate-500 mb-1">Catatan</p>
                <p className="text-sm text-slate-300">{selected.notes}</p>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              {canApprove && selected.status === 'pending' && (
                <>
                  <button onClick={() => { approve(selected); setDetailModal(false) }} className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 font-medium text-sm">✅ Approve</button>
                  <button onClick={() => { reject(selected); setDetailModal(false) }} className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-medium text-sm">❌ Tolak</button>
                </>
              )}
              <button onClick={() => setDetailModal(false)} className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm">Tutup</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal} onClose={() => setModal(false)} title="Buat SPB Baru" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tanggal Dibutuhkan" required>
              <Input type="date" value={form.required_date} onChange={e => setForm({...form, required_date:e.target.value})} />
            </FormField>
            <FormField label="Prioritas">
              <Select value={form.priority} onChange={e => setForm({...form, priority:e.target.value})}>
                <option value="low">Rendah</option>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Gudang Tujuan">
            <Select value={form.warehouse_id} onChange={e => setForm({...form, warehouse_id:e.target.value})}>
              <option value="">Pilih gudang (opsional)</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Keperluan / Tujuan" required>
            <Textarea value={form.purpose} onChange={e => setForm({...form, purpose:e.target.value})} placeholder="Untuk keperluan apa?" />
          </FormField>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Item yang Diminta</label>
              <button onClick={addLine} className="flex items-center gap-1 text-gold-400 text-xs font-medium"><Plus size={13} /> Tambah</button>
            </div>
            <div className="space-y-2">
              {lines.map((ln, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-9">
                    <Select value={ln.item_id} onChange={e => setLine(idx,'item_id',e.target.value)}>
                      <option value="">Pilih item</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min="1" value={ln.qty_requested} onChange={e => setLine(idx,'qty_requested',e.target.value)} placeholder="Qty" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {lines.length > 1 && <button onClick={() => rmLine(idx)} className="text-red-400">✕</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={submit} className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">Kirim SPB</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
