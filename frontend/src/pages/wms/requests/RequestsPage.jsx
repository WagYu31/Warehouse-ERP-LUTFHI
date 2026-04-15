import { useState, useEffect } from 'react'
import { ClipboardList, Plus, Check, X } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell, PageHeader, SearchBar, DataTable, StatusBadge, Modal, FormField, Input, Select, Textarea } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'

const COLS = [
  { key: 'spb_number',  label: 'No. SPB', render: v => <span className="text-blue-400 font-mono text-sm">{v}</span> },
  { key: 'needed_date', label: 'Tgl. Butuh' },
  { key: 'purpose',     label: 'Keperluan', render: v => <span className="text-slate-300 truncate max-w-xs block">{v}</span> },
  { key: 'priority',    label: 'Prioritas', render: v => <StatusBadge value={v === 'urgent' ? 'high' : v === 'normal' ? 'normal_p' : 'low'} /> },
  { key: 'requester',   label: 'Pemohon' },
  { key: 'status',      label: 'Status', render: v => <StatusBadge value={v} /> },
]

export default function RequestsPage() {
  const { user } = useAuthStore()
  const [data, setData]       = useState([])
  const [items, setItems]     = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [search, setSearch]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState({ needed_date:'', purpose:'', priority:'normal', warehouse_id:'', notes:'' })
  const [lines, setLines]     = useState([{ item_id:'', qty:1 }])
  const canApprove = ['admin','manager'].includes(user?.role)

  const load = async () => {
    setLoading(true)
    try {
      const [r, i, w] = await Promise.all([api.get(`/requests?status=${statusFilter}`), api.get('/items'), api.get('/warehouses')])
      let d = r.data || []
      if (search) d = d.filter(x => x.spb_number?.toLowerCase().includes(search.toLowerCase()) || x.purpose?.toLowerCase().includes(search.toLowerCase()))
      setData(d); setItems(i.data||[]); setWarehouses(w.data||[])
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search, statusFilter])

  const addLine = () => setLines([...lines, { item_id:'', qty:1 }])
  const rmLine  = (i) => setLines(lines.filter((_,idx) => idx !== i))
  const setLine = (i, k, v) => setLines(lines.map((l, idx) => idx===i ? {...l, [k]: v} : l))

  const submit = async () => {
    if (!form.needed_date || !form.purpose) { toast.error('Isi tanggal dan keperluan'); return }
    try {
      await api.post('/requests', { ...form, items: lines.filter(l => l.item_id).map(l => ({ item_id:l.item_id, qty:+l.qty })) })
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

  const colsWithAction = canApprove ? [
    ...COLS,
    { key: 'id', label: 'Aksi', render: (v, row) => row.status === 'pending' ? (
      <div className="flex gap-1">
        <button onClick={() => approve(row)} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all">
          <Check size={13} />
        </button>
        <button onClick={() => reject(row)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
          <X size={13} />
        </button>
      </div>
    ) : null }
  ] : COLS

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
        <DataTable columns={colsWithAction} data={data} loading={loading} emptyMessage="Belum ada SPB" />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Buat SPB Baru" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tanggal Dibutuhkan" required>
              <Input type="date" value={form.needed_date} onChange={e => setForm({...form, needed_date:e.target.value})} />
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
                    <Input type="number" min="1" value={ln.qty} onChange={e => setLine(idx,'qty',e.target.value)} placeholder="Qty" />
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
