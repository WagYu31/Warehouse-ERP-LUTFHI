import { useState, useEffect } from 'react'
import { ArrowUpCircle, Plus } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell, PageHeader, SearchBar, DataTable, StatusBadge, Modal, FormField, Input, Select, Textarea } from '@/components/ui'

const COLS = [
  { key: 'ref_number',     label: 'No. OUT', render: v => <span className="text-orange-400 font-mono text-sm">{v}</span> },
  { key: 'outbound_date',  label: 'Tanggal', render: v => v ? new Date(v).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '—' },
  { key: 'warehouse_name', label: 'Gudang' },
  { key: 'issued_by_name', label: 'Diproses Oleh' },
  { key: 'item_count',     label: 'Jumlah Item' },
  { key: 'status',         label: 'Status', render: v => <StatusBadge value={v} /> },
]

export default function OutboundPage() {
  const [data, setData]       = useState([])
  const [items, setItems]     = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState({ warehouse_id:'', outbound_date: new Date().toISOString().slice(0,10), destination:'', notes:'' })
  const [lines, setLines]     = useState([{ item_id:'', qty_issued:1 }])

  const load = async () => {
    setLoading(true)
    try {
      const [out, i, w] = await Promise.all([api.get('/outbound'), api.get('/items'), api.get('/warehouses')])
      let d = out.data || []
      if (search) d = d.filter(r => r.ref_number?.toLowerCase().includes(search.toLowerCase()))
      setData(d); setItems(i.data||[]); setWarehouses(w.data||[])
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search])

  const addLine = () => setLines([...lines, { item_id:'', qty_issued:1 }])
  const rmLine  = (i) => setLines(lines.filter((_,idx) => idx !== i))
  const setLine = (i, k, v) => setLines(lines.map((l, idx) => idx===i ? {...l, [k]: v} : l))

  const submit = async () => {
    if (!form.warehouse_id) { toast.error('Pilih gudang'); return }
    try {
      await api.post('/outbound', { ...form, items: lines.filter(l => l.item_id).map(l => ({ item_id:l.item_id, qty_issued:+l.qty_issued })) })
      toast.success('Barang keluar dicatat!'); setModal(false); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan') }
  }

  return (
    <PageShell>
      <PageHeader icon={ArrowUpCircle} title="Barang Keluar" subtitle="Pengeluaran stok dari gudang" onRefresh={load} onAdd={() => setModal(true)} addLabel="Catat Keluar" />
      <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Cari nomor dokumen..." /></div>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} emptyMessage="Belum ada pengeluaran barang" />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Catat Barang Keluar" size="lg">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Gudang Asal" required>
              <Select value={form.warehouse_id} onChange={e => setForm({...form, warehouse_id:e.target.value})}>
                <option value="">Pilih gudang</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Tanggal Keluar" required>
              <Input type="date" value={form.outbound_date} onChange={e => setForm({...form, outbound_date:e.target.value})} />
            </FormField>
          </div>
          <FormField label="Tujuan / Destinasi">
            <Input value={form.destination} onChange={e => setForm({...form, destination:e.target.value})} placeholder="Departemen IT, Cabang Jakarta, dll." />
          </FormField>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Detail Item</label>
              <button onClick={addLine} className="flex items-center gap-1 text-gold-400 text-xs font-medium"><Plus size={13} /> Tambah</button>
            </div>
            <div className="space-y-2">
              {lines.map((ln, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-8">
                    <Select value={ln.item_id} onChange={e => setLine(idx,'item_id',e.target.value)}>
                      <option value="">Pilih item</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name} (stok: {i.current_stock})</option>)}
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input type="number" min="1" value={ln.qty_issued} onChange={e => setLine(idx,'qty_issued',e.target.value)} placeholder="Qty" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {lines.length > 1 && <button onClick={() => rmLine(idx)} className="text-red-400">✕</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <FormField label="Catatan">
            <Textarea value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} placeholder="Tujuan pengeluaran..." />
          </FormField>

          <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={submit} className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm">Konfirmasi Keluar</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
