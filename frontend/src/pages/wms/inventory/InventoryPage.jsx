import { useState, useEffect } from 'react'
import { Package, AlertTriangle } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import {
  PageShell, PageHeader, SearchBar, DataTable, StatusBadge,
  Modal, FormField, Input, Select, Textarea
} from '@/components/ui'

const COLS = [
  { key: 'sku',           label: 'SKU' },
  { key: 'name',          label: 'Nama Item' },
  { key: 'category',      label: 'Kategori' },
  { key: 'unit',          label: 'Satuan' },
  { key: 'current_stock', label: 'Stok', render: (v, r) => (
    <div>
      <span className="text-white font-semibold">{v ?? 0}</span>
      <span className="text-slate-600 text-xs ml-1">/ min {r.min_stock}</span>
    </div>
  )},
  { key: 'price', label: 'Harga', render: v => (
    <span className="text-slate-300">Rp {Number(v||0).toLocaleString('id-ID')}</span>
  )},
  { key: 'status', label: 'Status', render: v => <StatusBadge value={v} /> },
]

export default function InventoryPage() {
  const [data, setData]         = useState([])
  const [cats, setCats]         = useState([])
  const [units, setUnits]       = useState([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState({ sku:'', name:'', category_id:'', unit_id:'', min_stock:0, price:0, description:'' })

  const load = async () => {
    setLoading(true)
    try {
      const [items, c, u] = await Promise.all([
        api.get(`/items?search=${search}`),
        api.get('/categories'),
        api.get('/units'),
      ])
      setData(items.data || [])
      setCats(c.data || [])
      setUnits(u.data || [])
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search])

  const openAdd = () => { setEditing(null); setForm({ sku:'', name:'', category_id:'', unit_id:'', min_stock:0, price:0, description:'' }); setModal(true) }
  const openEdit = (row) => { setEditing(row); setForm({ sku: row.sku, name: row.name, category_id:'', unit_id:'', min_stock: row.min_stock, price: row.price, description:'' }); setModal(true) }

  const save = async () => {
    try {
      if (editing) {
        await api.put(`/items/${editing.id}`, form)
        toast.success('Item diperbarui')
      } else {
        await api.post('/items', form)
        toast.success('Item ditambahkan')
      }
      setModal(false); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan') }
  }

  const del = async (row) => {
    if (!confirm(`Hapus item "${row.name}"?`)) return
    await api.delete(`/items/${row.id}`)
    toast.success('Item dihapus'); load()
  }

  const exportCSV = () => {
    const rows = data.map(r => `${r.sku},${r.name},${r.category},${r.unit},${r.current_stock},${r.min_stock},${r.price},${r.status}`)
    const csv  = ['SKU,Nama,Kategori,Satuan,Stok,Min Stok,Harga,Status', ...rows].join('\n')
    const a    = document.createElement('a')
    a.href     = 'data:text/csv,' + encodeURIComponent(csv)
    a.download = `inventaris-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  return (
    <PageShell>
      <PageHeader
        icon={Package} title="Inventaris Stok"
        subtitle={`${data.length} item aktif`}
        onRefresh={load} onAdd={openAdd} onExport={exportCSV}
      />

      {/* Filter kritis */}
      <div className="flex items-center gap-3 mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Cari SKU atau nama item..." />
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium whitespace-nowrap">
          <AlertTriangle size={12} />
          {data.filter(d => d.status === 'kritis').length} kritis
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} onEdit={openEdit} onDelete={del}
          emptyMessage="Belum ada item. Tambahkan item pertama Anda!" />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Item' : 'Tambah Item Baru'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="SKU" required>
              <Input value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} placeholder="BRG-001" />
            </FormField>
            <FormField label="Nama Item" required>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nama item..." />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Kategori">
              <Select value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}>
                <option value="">Pilih kategori</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Satuan">
              <Select value={form.unit_id} onChange={e => setForm({...form, unit_id: e.target.value})}>
                <option value="">Pilih satuan</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Stok Minimum">
              <Input type="number" value={form.min_stock} onChange={e => setForm({...form, min_stock: +e.target.value})} />
            </FormField>
            <FormField label="Harga (Rp)">
              <Input type="number" value={form.price} onChange={e => setForm({...form, price: +e.target.value})} />
            </FormField>
          </div>
          <FormField label="Deskripsi">
            <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Deskripsi item..." />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white text-sm">Batal</button>
            <button onClick={save} className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">Simpan</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
