import { useState, useEffect } from 'react'
import { ShoppingCart, Printer } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { PageShell, PageHeader, SearchBar, DataTable, StatusBadge, Modal, FormField, Input, Select, Textarea } from '@/components/ui'
import { printPurchaseOrder } from '@/utils/printUtils'

const STATUS_PO = { draft: 'warning', sent: 'info', partial: 'warning', complete: 'success', cancelled: 'danger' }

const COLS = [
  { key: 'po_number', label: 'No. PO', render: v => <span className="text-purple-400 font-mono text-sm">{v}</span> },
  { key: 'order_date', label: 'Tanggal', render: v => v && v !== '0000-00-00' ? new Date(v).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '—' },
  { key: 'supplier_name', label: 'Supplier', render: v => v || '—' },
  { key: 'total_amount', label: 'Total', render: v => <span className="text-white font-semibold">Rp {Number(v||0).toLocaleString('id-ID')}</span> },
  { key: 'status', label: 'Status', render: v => <StatusBadge value={v} /> },
  { key: 'id', label: 'Print', render: (id, row) => (
    <button onClick={() => printPurchaseOrder(row)}
      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.06] text-slate-400 hover:text-white text-xs">
      <Printer size={11} /> Print
    </button>
  )},
]

export default function PurchaseOrderPage() {
  const { user } = useAuthStore()
  const canCreate = ['admin', 'finance_procurement'].includes(user?.role)
  const [data, setData]       = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [items, setItems]     = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
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

  return (
    <PageShell>
      <PageHeader icon={ShoppingCart} title="Purchase Order" subtitle="Kelola pembelian ke supplier" onRefresh={load} onAdd={canCreate ? () => setModal(true) : undefined} addLabel="Buat PO" />
      <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Cari No. PO atau supplier..." /></div>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} emptyMessage="Belum ada Purchase Order" />
      </div>

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
