import { useState, useEffect } from 'react'
import { ShoppingCart, Printer, Eye, FileText, ChevronDown } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { PageShell, PageHeader, SearchBar, DataTable, StatusBadge, Modal, FormField, Input, Select, Textarea } from '@/components/ui'
import { printPurchaseOrder } from '@/utils/printUtils'

const STATUS_PO = { draft: 'warning', sent: 'info', partial: 'warning', complete: 'success', cancelled: 'danger' }

// Alur status PO: draft → sent → complete / cancelled
const STATUS_TRANSITIONS = {
  draft:     ['sent', 'cancelled'],
  sent:      ['complete', 'cancelled'],
  partial:   ['complete', 'cancelled'],
  complete:  [],
  cancelled: [],
}
const STATUS_LABEL = { draft:'Draft', sent:'Terkirim ke Supplier', partial:'Parsial', complete:'Selesai', cancelled:'Dibatalkan' }
const STATUS_COLOR = {
  draft:     'bg-yellow-500/10 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20',
  sent:      'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20',
  partial:   'bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20',
  complete:  'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20',
  cancelled: 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20',
}

function DR({ label, value }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-white/[0.05] last:border-0">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className="text-sm font-medium text-white text-right max-w-[60%]">{value ?? '—'}</span>
    </div>
  )
}

const COLS = [
  { key: 'po_number', label: 'No. PO', render: v => <span className="text-purple-400 font-mono text-sm">{v}</span> },
  { key: 'order_date', label: 'Tanggal', render: v => v && v !== '0000-00-00' ? new Date(v).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '—' },
  { key: 'supplier_name', label: 'Supplier', render: v => v || '—' },
  { key: 'total_amount', label: 'Total', render: v => <span className="text-white font-semibold">Rp {Number(v||0).toLocaleString('id-ID')}</span> },
  { key: 'status', label: 'Status', render: v => <StatusBadge value={v} /> },
  { key: 'id', label: 'Print', render: (id, row) => (
    <button onClick={async () => {
      try {
        const res = await api.get(`/erp/purchase-orders/${id}`)
        const full = res.data || res
        if (full.items) full.items = full.items.map(i => ({ ...i, name: i.item_name || i.name, qty: i.qty_ordered || i.qty }))
        printPurchaseOrder(full)
      } catch { toast.error('Gagal load detail PO') }
    }}
      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.06] text-slate-400 hover:text-white text-xs">
      <Printer size={11} /> Print
    </button>
  )},
]

export default function PurchaseOrderPage() {
  const { user } = useAuthStore()
  const canCreate = ['admin', 'finance_procurement'].includes(user?.role)
  const canUpdateStatus = ['admin', 'finance_procurement'].includes(user?.role)
  const [data, setData]       = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [items, setItems]     = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [form, setForm]       = useState({ supplier_id:'', warehouse_id:'', tax_rate:11, notes:'' })
  const [lines, setLines]     = useState([{ item_id:'', qty:1, unit_price:0 }])

  const load = async () => {
    setLoading(true)
    try {
      const [po, s, i, w] = await Promise.all([api.get('/erp/purchase-orders'), api.get('/suppliers'), api.get('/items'), api.get('/warehouses')])
      let d = po.data || []
      if (search) d = d.filter(r => r.po_number?.toLowerCase().includes(search.toLowerCase()) || r.supplier_name?.toLowerCase().includes(search.toLowerCase()))
      setData(d); setSuppliers(s.data||[]); setItems(i.data||[]); setWarehouses(w.data||[])
    } catch { toast.error('Gagal memuat PO') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search])

  const addLine = () => setLines([...lines, { item_id:'', qty:1, unit_price:0 }])
  const rmLine  = (i) => setLines(lines.filter((_,idx) => idx !== i))
  const setLine = (i, k, v) => setLines(lines.map((l, idx) => idx===i ? {...l, [k]: v} : l))

  const subtotal = lines.reduce((s, l) => s + (+l.qty * +l.unit_price), 0)
  const tax      = subtotal * (form.tax_rate || 11) / 100
  const total    = subtotal + tax

  const submit = async () => {
    try {
      await api.post('/erp/purchase-orders', { ...form, items: lines.filter(l => l.item_id).map(l => ({ item_id:l.item_id, qty:+l.qty, unit_price:+l.unit_price })) })
      toast.success('Purchase Order dibuat!'); setModal(false); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan') }
  }

  const [detailLoading, setDetailLoading] = useState(false)

  const openView = async (row) => {
    setDetailModal(true)
    setSelected(row) // tampilkan dulu data ringkas
    setDetailLoading(true)
    try {
      const res = await api.get(`/erp/purchase-orders/${row.id}`)
      const full = res.data || res
      // normalize field names untuk printPurchaseOrder
      if (full.items) {
        full.items = full.items.map(i => ({
          ...i,
          name: i.item_name || i.name,
          qty:  i.qty_ordered || i.qty,
        }))
      }
      setSelected(full)
    } catch { toast.error('Gagal memuat detail PO') }
    finally { setDetailLoading(false) }
  }

  const updateStatus = async (newStatus) => {
    if (!selected) return
    setStatusLoading(true)
    try {
      await api.put(`/erp/purchase-orders/${selected.id}/status`, { status: newStatus })
      toast.success(`Status PO diubah ke: ${STATUS_LABEL[newStatus]}`)
      setSelected({ ...selected, status: newStatus })
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal ubah status')
    } finally {
      setStatusLoading(false)
    }
  }

  const nextStatuses = selected ? (STATUS_TRANSITIONS[selected.status] || []) : []

  return (
    <PageShell>
      <PageHeader icon={ShoppingCart} title="Purchase Order" subtitle="Kelola pembelian ke supplier" onRefresh={load} onAdd={canCreate ? () => setModal(true) : undefined} addLabel="Buat PO" />
      <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Cari No. PO atau supplier..." /></div>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} onView={openView} emptyMessage="Belum ada Purchase Order" />
      </div>

      {/* Detail + Status Modal */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
            <Eye size={14} className="text-purple-400" />
          </div>
          <div>
            <div className="text-white font-bold">{selected?.po_number}</div>
            <div className="text-slate-500 text-xs">Purchase Order</div>
          </div>
        </div>
      }>
        {detailLoading ? (
          <div className="py-10 text-center text-slate-400 text-sm animate-pulse">Memuat detail PO...</div>
        ) : selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className="text-purple-400" />
                  <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Info PO</span>
                </div>
                <DR label="No. PO" value={<span className="text-purple-400 font-mono">{selected.po_number}</span>} />
                <DR label="Tanggal" value={selected.order_date && selected.order_date !== '0000-00-00' ? new Date(selected.order_date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) : '—'} />
                <DR label="Supplier" value={selected.supplier_name || '—'} />
                <DR label="Gudang" value={selected.warehouse_name || '—'} />
                <DR label="Total" value={<span className="text-gold-400 font-bold">Rp {Number(selected.total_amount||0).toLocaleString('id-ID')}</span>} />
              </div>

              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ChevronDown size={14} className="text-purple-400" />
                  <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Status & Aksi</span>
                </div>

                {/* Status sekarang */}
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2">Status Sekarang</p>
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-sm font-semibold ${STATUS_COLOR[selected.status] || ''}`}>
                    {STATUS_LABEL[selected.status] || selected.status}
                  </span>
                </div>

                {/* Ubah status */}
                {canUpdateStatus && nextStatuses.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Ubah Status ke:</p>
                    <div className="flex flex-col gap-2">
                      {nextStatuses.map(s => (
                        <button key={s} onClick={() => updateStatus(s)} disabled={statusLoading}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${STATUS_COLOR[s]} disabled:opacity-50`}>
                          <span>{STATUS_LABEL[s]}</span>
                          <ChevronDown size={13} className="opacity-60" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {(!canUpdateStatus || nextStatuses.length === 0) && (
                  <p className="text-xs text-slate-600 italic mt-2">
                    {nextStatuses.length === 0 ? 'Status final — tidak bisa diubah lagi' : 'Tidak ada izin ubah status'}
                  </p>
                )}
              </div>
            </div>

            {selected.notes && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="text-xs text-slate-500 mb-1">Catatan</p>
                <p className="text-sm text-slate-300">{selected.notes}</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <button onClick={() => printPurchaseOrder(selected)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] text-white hover:bg-white/[0.1] text-sm font-medium">
                <Printer size={14} /> Print PO
              </button>
              <button onClick={() => setDetailModal(false)} className="px-5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-semibold text-sm">Tutup</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Buat PO Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Buat Purchase Order" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Supplier">
              <Select value={form.supplier_id} onChange={e => setForm({...form, supplier_id:e.target.value})}>
                <option value="">Pilih supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Gudang Tujuan">
              <Select value={form.warehouse_id} onChange={e => setForm({...form, warehouse_id:e.target.value})}>
                <option value="">Pilih gudang</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            </FormField>
          </div>

          <div className="border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Item PO</span>
              <button onClick={addLine} className="text-gold-400 text-xs font-medium">+ Tambah Item</button>
            </div>
            <div className="space-y-2 mb-3">
              {lines.map((ln, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5"><Select value={ln.item_id} onChange={e => setLine(idx,'item_id',e.target.value)}>
                    <option value="">Pilih item</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </Select></div>
                  <div className="col-span-2"><Input type="number" min="1" value={ln.qty} onChange={e => setLine(idx,'qty',e.target.value)} placeholder="Qty" /></div>
                  <div className="col-span-4"><Input type="number" value={ln.unit_price} onChange={e => setLine(idx,'unit_price',e.target.value)} placeholder="Harga satuan" /></div>
                  <div className="col-span-1 flex justify-center">{lines.length > 1 && <button onClick={() => rmLine(idx)} className="text-red-400">✕</button>}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-white/[0.06] pt-3 text-sm space-y-1">
              <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>Rp {subtotal.toLocaleString('id-ID')}</span></div>
              <div className="flex justify-between text-slate-400"><span>PPN {form.tax_rate}%</span><span>Rp {Math.round(tax).toLocaleString('id-ID')}</span></div>
              <div className="flex justify-between text-white font-bold text-base"><span>Total</span><span>Rp {Math.round(total).toLocaleString('id-ID')}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tarif PPN (%)"><Input type="number" value={form.tax_rate} onChange={e => setForm({...form, tax_rate:+e.target.value})} /></FormField>
          </div>
          <FormField label="Catatan"><Textarea value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} /></FormField>

          <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={submit} className="px-5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-semibold text-sm">Buat PO</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
