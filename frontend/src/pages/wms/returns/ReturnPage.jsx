import { useState, useEffect } from 'react'
import { RotateCcw, ArrowLeftRight, Eye, FileText, Building2 } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell, PageHeader, DataTable, StatusBadge, Modal, FormField, Input, Select } from '@/components/ui'

const STATUS_MAP = { pending: 'warning', approved: 'success', rejected: 'danger', completed: 'info' }
const TYPE_LABEL = { inbound: '↪ Retur Masuk', outbound: '↩ Retur Keluar', to_supplier: '↩ Ke Supplier', from_customer: '↪ Dari Customer' }

const COLS = [
  { key: 'ref_number', label: 'No. Retur', render: v => <span className="text-orange-400 font-mono text-sm">{v}</span> },
  { key: 'return_date', label: 'Tanggal', render: v => v ? new Date(v).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '—' },
  { key: 'type', label: 'Tipe', render: v => (
    <span className={`text-xs font-semibold ${v === 'to_supplier' ? 'text-yellow-400' : 'text-cyan-400'}`}>
      {TYPE_LABEL[v] || v}
    </span>
  )},
  { key: 'supplier_name', label: 'Supplier', render: v => v || '—' },
  { key: 'warehouse_name', label: 'Gudang' },
  { key: 'reason', label: 'Alasan', render: v => <span className="text-slate-400 text-xs">{v?.slice(0,40)}{v?.length>40?'...':''}</span> },
  { key: 'status', label: 'Status', render: v => <StatusBadge value={v} /> },
]

export default function ReturnPage() {
  const [data, setData]     = useState([])
  const [items, setItems]   = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm]     = useState({ return_type: 'to_supplier', supplier_id: '', reason: '', notes: '', return_date: '' })
  const [lines, setLines]   = useState([{ item_id: '', qty: 1, warehouse_id: '', unit_price: 0 }])

  const load = async () => {
    setLoading(true)
    try {
      const [ret, i, s, w] = await Promise.all([
        api.get('/returns'), api.get('/items'), api.get('/suppliers'), api.get('/warehouses'),
      ])
      setData((ret.data || ret) || [])
      setItems((i.data || i) || [])
      setSuppliers((s.data || s) || [])
      setWarehouses((w.data || w) || [])
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const addLine = () => setLines([...lines, { item_id: '', qty: 1, warehouse_id: '', unit_price: 0 }])
  const rmLine = i => setLines(lines.filter((_, idx) => idx !== i))
  const setLine = (i, k, v) => setLines(lines.map((l, idx) => idx === i ? {...l, [k]: v} : l))

  const submit = async () => {
    if (!form.reason.trim()) { toast.error('Alasan retur wajib diisi'); return }
    const valid = lines.filter(l => l.item_id && l.qty > 0)
    if (!valid.length) { toast.error('Minimal 1 item'); return }
    try {
      const res = await api.post('/returns', { ...form, items: valid })
      toast.success(`Retur ${res.return_number} dibuat!`); setModal(false); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal') }
  }

  const approve = async (id) => {
    if (!confirm('Approve retur ini? Stok akan disesuaikan.')) return
    await api.put(`/returns/${id}/approve`)
    toast.success('Retur diapprove, stok disesuaikan'); load()
  }

  const openView = (row) => { setSelected(row); setDetailModal(true) }

  const COLS_WITH_ACTION = [
    ...COLS,
    { key: 'id', label: 'Aksi', render: (id, row) => row.status === 'pending' ? (
      <button onClick={() => approve(id)}
        className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium">
        ✓ Approve
      </button>
    ) : null },
  ]

  return (
    <PageShell>
      <PageHeader icon={RotateCcw} title="Retur Barang" subtitle="Kembalikan barang ke supplier atau dari customer"
        onRefresh={load} onAdd={() => setModal(true)} addLabel="Buat Retur" />

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} onView={openView} emptyMessage="Belum ada retur barang" />
      </div>

      {/* Detail Modal */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/20 flex items-center justify-center">
            <Eye size={14} className="text-orange-400" />
          </div>
          <div>
            <div className="text-white font-bold">{selected?.ref_number}</div>
            <div className="text-slate-500 text-xs">Retur Barang</div>
          </div>
        </div>
      }>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className="text-orange-400" />
                  <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Info Retur</span>
                </div>
                <div className="flex justify-between items-start py-2 border-b border-white/[0.05]"><span className="text-slate-500 text-xs">No. Retur</span><span className="text-sm font-medium text-orange-400 font-mono">{selected.ref_number}</span></div>
                <div className="flex justify-between items-start py-2 border-b border-white/[0.05]"><span className="text-slate-500 text-xs">Tanggal</span><span className="text-sm font-medium text-white">{selected.return_date ? new Date(selected.return_date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) : '—'}</span></div>
                <div className="flex justify-between items-start py-2 border-b border-white/[0.05]"><span className="text-slate-500 text-xs">Tipe</span><span className="text-sm font-medium text-cyan-400">{TYPE_LABEL[selected.type] || selected.type}</span></div>
                <div className="flex justify-between items-start py-2"><span className="text-slate-500 text-xs">Status</span><StatusBadge value={selected.status} /></div>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={14} className="text-orange-400" />
                  <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Detail</span>
                </div>
                <div className="flex justify-between items-start py-2 border-b border-white/[0.05]"><span className="text-slate-500 text-xs">Supplier</span><span className="text-sm font-medium text-white">{selected.supplier_name || '—'}</span></div>
                <div className="flex justify-between items-start py-2 border-b border-white/[0.05]"><span className="text-slate-500 text-xs">Gudang</span><span className="text-sm font-medium text-white">{selected.warehouse_name || '—'}</span></div>
                <div className="flex justify-between items-start py-2"><span className="text-slate-500 text-xs">Alasan</span><span className="text-sm text-slate-300 text-right max-w-[60%]">{selected.reason || '—'}</span></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              {selected.status === 'pending' && (
                <button onClick={() => { approve(selected.id); setDetailModal(false) }} className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 font-medium text-sm">✅ Approve</button>
              )}
              <button onClick={() => setDetailModal(false)} className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm">Tutup</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal} onClose={() => setModal(false)} title="Buat Retur Barang" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tipe Retur" required>
              <Select value={form.return_type} onChange={e => setForm({...form, return_type: e.target.value})}>
                <option value="to_supplier">↩ Ke Supplier</option>
                <option value="from_customer">↪ Dari Customer</option>
              </Select>
            </FormField>
            {form.return_type === 'to_supplier' && (
              <FormField label="Supplier">
                <Select value={form.supplier_id} onChange={e => setForm({...form, supplier_id: e.target.value})}>
                  <option value="">Pilih supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </FormField>
            )}
          </div>

          <FormField label="Alasan Retur" required>
            <textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}
              rows={2} placeholder="Barang cacat, salah kirim, kelebihan order..."
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-orange-500/50" />
          </FormField>

          <div className="border border-white/[0.06] rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase">Item yang Diretur</span>
              <button onClick={addLine} className="text-orange-400 text-xs hover:text-orange-300">+ Tambah Item</button>
            </div>
            {lines.map((ln, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center mb-2">
                <div className="col-span-4">
                  <Select value={ln.item_id} onChange={e => setLine(idx, 'item_id', e.target.value)}>
                    <option value="">Pilih item</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </Select>
                </div>
                <div className="col-span-3">
                  <Select value={ln.warehouse_id} onChange={e => setLine(idx, 'warehouse_id', e.target.value)}>
                    <option value="">Gudang</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input type="number" min="1" value={ln.qty} onChange={e => setLine(idx, 'qty', +e.target.value)} placeholder="Qty" />
                </div>
                <div className="col-span-2">
                  <Input type="number" min="0" value={ln.unit_price} onChange={e => setLine(idx, 'unit_price', +e.target.value)} placeholder="Harga" />
                </div>
                <div className="col-span-1 flex justify-center">
                  {lines.length > 1 && <button onClick={() => rmLine(idx)} className="text-red-400">✕</button>}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={submit} className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm">Buat Retur</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
