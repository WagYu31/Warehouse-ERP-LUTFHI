import { useState, useEffect } from 'react'
import { ArrowLeftRight, Warehouse } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell, PageHeader, DataTable, StatusBadge, Modal, FormField, Select, Input } from '@/components/ui'

const COLS = [
  { key: 'ref_number',    label: 'No. Transfer', render: v => <span className="text-blue-400 font-mono text-sm">{v}</span> },
  { key: 'transfer_date', label: 'Tanggal', render: v => v || '—' },
  { key: 'from_warehouse',label: 'Dari Gudang', render: v => <span className="text-orange-400">{v}</span> },
  { key: 'to_warehouse',  label: 'Ke Gudang', render: v => <span className="text-emerald-400">{v}</span> },
  { key: 'requested_by',  label: 'Oleh' },
  { key: 'status',        label: 'Status', render: v => <StatusBadge value={v} /> },
]

export default function StockTransferPage() {
  const [data, setData]           = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [items, setItems]         = useState([])
  const [itemStocks, setItemStocks] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState({ from_warehouse_id: '', to_warehouse_id: '', notes: '' })
  const [lines, setLines]         = useState([{ item_id: '', qty: 1 }])

  const load = async () => {
    setLoading(true)
    try {
      const [trf, w, i] = await Promise.all([
        api.get('/stock-transfers'),
        api.get('/warehouses'),
        api.get('/item-stocks'),
      ])
      setData(Array.isArray(trf) ? trf : (trf.data || []))
      setWarehouses(Array.isArray(w) ? w : (w.data || []))
      setItemStocks(Array.isArray(i) ? i : (i.data || []))
      const itemRes = await api.get('/items')
      setItems(Array.isArray(itemRes) ? itemRes : (itemRes.data || []))
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const addLine = () => setLines([...lines, { item_id: '', qty: 1 }])
  const rmLine  = i => setLines(lines.filter((_, idx) => idx !== i))
  const setLine = (i, k, v) => setLines(lines.map((l, idx) => idx === i ? {...l, [k]: v} : l))

  // Items yang ada di gudang asal
  const availableItems = form.from_warehouse_id
    ? itemStocks.filter(s => s.warehouse_id === form.from_warehouse_id && s.current_stock > 0)
    : []

  const submit = async () => {
    if (!form.from_warehouse_id || !form.to_warehouse_id) {
      toast.error('Pilih gudang asal dan tujuan')
      return
    }
    const validLines = lines.filter(l => l.item_id && l.qty > 0)
    if (!validLines.length) {
      toast.error('Minimal 1 item dengan qty valid')
      return
    }
    try {
      await api.post('/stock-transfers', { ...form, items: validLines })
      toast.success('Transfer stok berhasil!'); setModal(false); load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal transfer')
    }
  }

  return (
    <PageShell>
      <PageHeader icon={ArrowLeftRight} title="Transfer Stok" subtitle="Pindah stok antar gudang"
        onRefresh={load} onAdd={() => setModal(true)} addLabel="Buat Transfer" />

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} emptyMessage="Belum ada transfer stok" />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Buat Transfer Stok" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Dari Gudang" required>
              <Select value={form.from_warehouse_id} onChange={e => { setForm({...form, from_warehouse_id: e.target.value}); setLines([{item_id:'',qty:1}]) }}>
                <option value="">Pilih gudang asal</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} — {w.city}</option>)}
              </Select>
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
              {lines.map((ln, idx) => {
                const available = form.from_warehouse_id
                  ? itemStocks.find(s => s.item_id === ln.item_id && s.warehouse_id === form.from_warehouse_id)?.current_stock || 0
                  : 0
                return (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-7">
                      <Select value={ln.item_id} onChange={e => setLine(idx, 'item_id', e.target.value)}>
                        <option value="">Pilih item</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                      </Select>
                      {ln.item_id && <p className="text-xs text-slate-500 mt-0.5">Stok tersedia: <span className="text-emerald-400">{available}</span></p>}
                    </div>
                    <div className="col-span-4">
                      <Input type="number" min="1" max={available || undefined}
                        value={ln.qty} onChange={e => setLine(idx, 'qty', +e.target.value)} placeholder="Jumlah" />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {lines.length > 1 && <button onClick={() => rmLine(idx)} className="text-red-400 hover:text-red-300">✕</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <FormField label="Catatan">
            <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-blue-500/50"
              placeholder="Alasan transfer..." />
          </FormField>

          <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={submit} className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm">Transfer Sekarang</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
