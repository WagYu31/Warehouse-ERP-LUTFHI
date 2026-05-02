import { useState, useEffect } from 'react'
import { Truck } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { PageShell, PageHeader, SearchBar, DataTable, Modal, FormField, Input, Textarea } from '@/components/ui'

const COLS = [
  { key: 'code',    label: 'Kode', render: v => <span className="text-gold-400 font-mono text-sm">{v}</span> },
  { key: 'name',    label: 'Nama Supplier', render: v => <span className="text-white font-medium">{v}</span> },
  { key: 'phone',   label: 'Telepon', render: v => v || '—' },
  { key: 'email',   label: 'Email', render: v => <span className="text-slate-400 text-sm">{v||'—'}</span> },
  { key: 'city',    label: 'Kota', render: v => v || '—' },
  { key: 'payment_terms', label: 'Termin', render: v => v ? <span className="text-slate-300 text-sm">{v} hari</span> : '—' },
  { key: 'is_pkp',  label: 'PKP', render: v => v
    ? <span className="text-emerald-400 text-xs px-2 py-0.5 bg-emerald-500/10 rounded-full">PKP</span>
    : <span className="text-slate-500 text-xs">Non-PKP</span>
  },
]

export default function SupplierPage() {
  const { user } = useAuthStore()
  const canEdit = ['admin', 'finance_procurement'].includes(user?.role)
  const isAdmin = user?.role === 'admin'
  const [data, setData] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ code:'', name:'', contact:'', phone:'', email:'', address:'', city:'', payment_terms:30 })

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/suppliers?search=${search}`)
      const d = Array.isArray(res) ? res : (res.data || [])
      setData(d)
    } catch { toast.error('Gagal memuat supplier') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [search])

  const openAdd = () => { setEditing(null); setForm({ code:'', name:'', contact:'', phone:'', email:'', address:'', city:'', payment_terms:30 }); setModal(true) }
  const openEdit = (row) => { setEditing(row); setForm({ code:row.code, name:row.name, contact:row.contact||'', phone:row.phone||'', email:row.email||'', address:row.address||'', city:row.city||'', payment_terms:row.payment_terms||30 }); setModal(true) }
  const save = async () => {
    if (!form.name) { toast.error('Nama wajib diisi'); return }
    try {
      if (editing) { await api.put(`/suppliers/${editing.id}`, form); toast.success('Supplier diperbarui') }
      else { await api.post('/suppliers', form); toast.success('Supplier ditambahkan') }
      setModal(false); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal') }
  }
  const del = async (row) => {
    await api.delete(`/suppliers/${row.id}`); toast.success('Dihapus'); load()
  }

  return (
    <PageShell>
      <PageHeader icon={Truck} title="Manajemen Supplier" subtitle="Data pemasok dan vendor" onRefresh={load} onAdd={canEdit ? openAdd : undefined} addLabel="Tambah Supplier" />
      <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Cari nama supplier..." /></div>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} onEdit={canEdit ? openEdit : undefined} onDelete={isAdmin ? del : undefined} emptyMessage="Belum ada supplier" />
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Supplier' : 'Tambah Supplier'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Kode"><Input value={form.code} onChange={e => setForm({...form, code:e.target.value})} placeholder="SUP-001" /></FormField>
            <FormField label="Nama Supplier" required><Input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="PT. Supplier" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Kontak PIC"><Input value={form.contact} onChange={e => setForm({...form, contact:e.target.value})} placeholder="Nama PIC" /></FormField>
            <FormField label="Telepon"><Input value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} placeholder="0812-xxxx" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email"><Input type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} /></FormField>
            <FormField label="Kota"><Input value={form.city} onChange={e => setForm({...form, city:e.target.value})} /></FormField>
          </div>
          <FormField label="Alamat"><Textarea value={form.address} onChange={e => setForm({...form, address:e.target.value})} /></FormField>
          <FormField label="Termin Pembayaran (hari)"><Input type="number" value={form.payment_terms} onChange={e => setForm({...form, payment_terms:+e.target.value})} /></FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={save} className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">Simpan</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
