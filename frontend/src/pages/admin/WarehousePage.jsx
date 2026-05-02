import { useState, useEffect } from 'react'
import { Building2, MapPin } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell, PageHeader, SearchBar, DataTable, Modal, FormField, Input, Textarea, Select } from '@/components/ui'

const COLS = [
  { key: 'code',     label: 'Kode', render: v => <span className="text-gold-400 font-mono text-sm">{v}</span> },
  { key: 'name',     label: 'Nama Gudang', render: v => <span className="text-white font-medium">{v}</span> },
  { key: 'city',     label: 'Kota', render: v => v || '—' },
  { key: 'address',  label: 'Alamat', render: v => (
    <div className="flex items-center gap-1.5 text-slate-400 text-xs">
      <MapPin size={12} className="flex-shrink-0" /> {v || '—'}
    </div>
  )},
  { key: 'pic_name', label: 'PIC', render: v => v || '—' },
  { key: 'pic_phone',label: 'Telp PIC', render: v => v ? <span className="text-slate-400 text-xs">{v}</span> : '—' },
]

export default function WarehousePage() {
  const [data, setData]       = useState([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm]       = useState({ code:'', name:'', address:'', city:'', pic_name:'', pic_phone:'' })

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/warehouses')
      let d = Array.isArray(res) ? res : (res.data || [])
      if (search) d = d.filter(w => w.name?.toLowerCase().includes(search.toLowerCase()) || w.code?.toLowerCase().includes(search.toLowerCase()))
      setData(d)
    } catch { toast.error('Gagal memuat gudang') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search])

  const openAdd = () => { setEditing(null); setForm({ code:'', name:'', address:'', city:'', pic_name:'', pic_phone:'' }); setModal(true) }
  const openEdit = (row) => { setEditing(row); setForm({ code: row.code, name: row.name, address: row.address||'', city: row.city||'', pic_name: row.pic_name||'', pic_phone: row.pic_phone||'' }); setModal(true) }

  const save = async () => {
    if (!form.code || !form.name) { toast.error('Kode dan nama wajib diisi'); return }
    try {
      if (editing) { await api.put(`/warehouses/${editing.id}`, form); toast.success('Gudang diperbarui') }
      else { await api.post('/warehouses', form); toast.success('Gudang ditambahkan') }
      setModal(false); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan') }
  }

  const del = async (row) => {
    await api.delete(`/warehouses/${row.id}`); toast.success('Gudang dihapus'); load()
  }

  return (
    <PageShell>
      <PageHeader icon={Building2} title="Manajemen Gudang" subtitle="Kelola lokasi dan kapasitas gudang" onRefresh={load} onAdd={openAdd} addLabel="Tambah Gudang" />
      <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Cari nama atau kode gudang..." /></div>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} onEdit={openEdit} onDelete={del} emptyMessage="Belum ada gudang" />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Gudang' : 'Tambah Gudang Baru'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Kode Gudang" required><Input value={form.code} onChange={e => setForm({...form, code:e.target.value})} placeholder="GDG-001" /></FormField>
            <FormField label="Nama Gudang" required><Input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="Gudang Utama" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Kota"><Input value={form.city} onChange={e => setForm({...form, city:e.target.value})} placeholder="Jakarta" /></FormField>
            <FormField label="Telepon PIC"><Input value={form.pic_phone} onChange={e => setForm({...form, pic_phone:e.target.value})} placeholder="021-xxxxxxx" /></FormField>
          </div>
          <FormField label="Alamat Lengkap">
            <Textarea value={form.address} onChange={e => setForm({...form, address:e.target.value})} placeholder="Alamat lengkap gudang" />
          </FormField>
          <FormField label="Nama PIC / Penanggung Jawab"><Input value={form.pic_name} onChange={e => setForm({...form, pic_name:e.target.value})} placeholder="Nama PIC" /></FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={save} className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">Simpan</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
