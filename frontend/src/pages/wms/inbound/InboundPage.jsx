import { useState, useEffect } from 'react'
import { ArrowDownCircle, Plus, Eye, Package, Building2, Calendar, FileText } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { PageShell, PageHeader, SearchBar, DataTable, StatusBadge, Modal, FormField, Input, Select, Textarea } from '@/components/ui'

const COLS = [
  { key: 'ref_number', label: 'No. GRN', render: v => <span className="text-gold-400 font-mono text-sm">{v}</span> },
  { key: 'received_date', label: 'Tanggal', render: v => v ? new Date(v).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '—' },
  { key: 'supplier_name', label: 'Supplier', render: v => <span className="text-slate-300">{v || '—'}</span> },
  { key: 'warehouse_name', label: 'Gudang', render: v => v || '—' },
  { key: 'status', label: 'Status', render: v => <StatusBadge value={v} /> },
]

function DR({ label, value }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-white/[0.05] last:border-0">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className="text-sm font-medium text-white text-right max-w-[60%]">{value ?? '—'}</span>
    </div>
  )
}

export default function InboundPage() {
  const { user } = useAuthStore()
  const canCreate = ['admin', 'staff'].includes(user?.role)
  const [data, setData]       = useState([])
  const [items, setItems]     = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm]       = useState({ supplier_id:'', warehouse_id:'', received_date:'', notes:'', items:[] })
  const [lines, setLines]     = useState([{ item_id:'', qty:1, unit_price:0 }])

  const load = async () => {
    setLoading(true)
    try {
      const [inbound, i, s, w] = await Promise.all([
        api.get('/inbound'), api.get('/items'), api.get('/suppliers'), api.get('/warehouses')
      ])
      let d = inbound.data || []
      if (search) d = d.filter(r => r.ref_number?.toLowerCase().includes(search.toLowerCase()) || r.supplier?.toLowerCase().includes(search.toLowerCase()))
      setData(d); setItems(i.data||[]); setSuppliers(s.data||[]); setWarehouses(w.data||[])
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search])

  const addLine = () => setLines([...lines, { item_id:'', qty:1, unit_price:0 }])
  const rmLine  = (i) => setLines(lines.filter((_,idx) => idx !== i))
  const setLine = (i, k, v) => setLines(lines.map((l, idx) => idx===i ? {...l, [k]: v} : l))

  const submit = async () => {
    if (!form.warehouse_id) { toast.error('Pilih gudang'); return }
    if (!lines.some(l => l.item_id)) { toast.error('Tambahkan minimal 1 item'); return }
    try {
      await api.post('/inbound', { ...form, items: lines.filter(l => l.item_id).map(l => ({ item_id: l.item_id, qty: +l.qty, unit_price: +l.unit_price })) })
      toast.success('Barang masuk dicatat!'); setModal(false); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan') }
  }

  const openView = (row) => { setSelected(row); setDetailModal(true) }

  const confirmGRN = async () => {
    if (!selected) return
    try {
      await api.put(`/inbound/${selected.id}/confirm`, {})
      toast.success(`GRN ${selected.ref_number} dikonfirmasi!`)
      setDetailModal(false)
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal konfirmasi') }
  }

  return (
    <PageShell>
      <PageHeader icon={ArrowDownCircle} title="Barang Masuk (GRN)" subtitle="Goods Receipt Note" onRefresh={load} onAdd={canCreate ? () => setModal(true) : undefined} addLabel="Catat Masuk" />
      <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Cari nomor GRN atau supplier..." /></div>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} onView={openView} emptyMessage="Belum ada penerimaan barang" />
      </div>

      {/* Detail Modal */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold-500/15 border border-gold-500/20 flex items-center justify-center">
            <Eye size={14} className="text-gold-400" />
          </div>
          <div>
            <div className="text-white font-bold">{selected?.ref_number}</div>
            <div className="text-slate-500 text-xs">Goods Receipt Note</div>
          </div>
        </div>
      }>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className="text-gold-400" />
                  <span className="text-xs font-semibold text-gold-400 uppercase tracking-wider">Info Dokumen</span>
                </div>
                <DR label="No. GRN" value={selected.ref_number} />
                <DR label="Tanggal Terima" value={selected.received_date ? new Date(selected.received_date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) : '—'} />
                <DR label="Status" value={<StatusBadge value={selected.status} />} />
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={14} className="text-gold-400" />
                  <span className="text-xs font-semibold text-gold-400 uppercase tracking-wider">Supplier & Gudang</span>
                </div>
                <DR label="Supplier" value={selected.supplier_name || '—'} />
                <DR label="Gudang Tujuan" value={selected.warehouse_name || '—'} />
                <DR label="Dicatat Oleh" value={selected.created_by_name || '—'} />
              </div>
            </div>
            {selected.notes && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="text-xs text-slate-500 mb-1">Catatan</p>
                <p className="text-sm text-slate-300">{selected.notes}</p>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              {canCreate && selected?.status === 'pending' && (
                <button
                  onClick={confirmGRN}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm flex items-center gap-2"
                >
                  ✅ Konfirmasi Penerimaan
                </button>
              )}
              <button onClick={() => setDetailModal(false)} className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">Tutup</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal} onClose={() => setModal(false)} title="Catat Barang Masuk" size="xl">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Supplier">
              <Select value={form.supplier_id} onChange={e => setForm({...form, supplier_id:e.target.value})}>
                <option value="">Pilih supplier (opsional)</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Gudang Tujuan" required>
              <Select value={form.warehouse_id} onChange={e => setForm({...form, warehouse_id:e.target.value})}>
                <option value="">Pilih gudang</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="Tanggal Terima">
            <Input type="date" value={form.received_date} onChange={e => setForm({...form, received_date:e.target.value})} />
          </FormField>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Detail Item</label>
              <button onClick={addLine} className="flex items-center gap-1 text-gold-400 hover:text-gold-300 text-xs font-medium">
                <Plus size={13} /> Tambah Item
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((ln, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Select value={ln.item_id} onChange={e => setLine(idx,'item_id',e.target.value)}>
                      <option value="">Pilih item</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min="1" value={ln.qty} onChange={e => setLine(idx,'qty',e.target.value)} placeholder="Qty" />
                  </div>
                  <div className="col-span-4">
                    <Input type="number" value={ln.unit_price} onChange={e => setLine(idx,'unit_price',e.target.value)} placeholder="Harga satuan" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {lines.length > 1 && (
                      <button onClick={() => rmLine(idx)} className="text-red-400 hover:text-red-300">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <FormField label="Catatan">
            <Textarea value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} placeholder="Catatan penerimaan..." />
          </FormField>

          <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={submit} className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">Konfirmasi Masuk</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
