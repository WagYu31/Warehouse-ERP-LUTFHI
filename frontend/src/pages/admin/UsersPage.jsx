import { useState, useEffect } from 'react'
import { Users } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell, PageHeader, SearchBar, DataTable, StatusBadge, Modal, FormField, Input, Select } from '@/components/ui'

const COLS = [
  { key: 'name',  label: 'Nama', render: (v, r) => (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center flex-shrink-0">
        <span className="text-white font-bold text-xs">{v?.[0]?.toUpperCase()}</span>
      </div>
      <span className="text-white font-medium text-sm">{v}</span>
    </div>
  )},
  { key: 'email',          label: 'Email', render: v => <span className="text-slate-400 text-sm">{v}</span> },
  { key: 'role',           label: 'Role', render: v => <StatusBadge value={v} /> },
  { key: 'warehouse_name', label: 'Gudang', render: v => <span className="text-slate-300 text-sm">{v || '—'}</span> },
  { key: 'is_active',      label: 'Status', render: v => <StatusBadge value={v ? 'active' : 'inactive'} /> },
]

const ROLES = ['admin','staff','finance_procurement','manager','requester']

export default function UsersPage() {
  const [data, setData]             = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(false)
  const [editing, setEditing]       = useState(null)
  const [form, setForm]             = useState({ name:'', email:'', password:'', role:'staff', warehouse_id:'' })

  const load = async () => {
    setLoading(true)
    try {
      const [res, wRes] = await Promise.all([api.get('/users'), api.get('/warehouses')])
      let d = res.data || []
      if (search) d = d.filter(u => u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))
      setData(d)
      setWarehouses(wRes.data || wRes || [])
    } catch { toast.error('Gagal memuat pengguna') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search])

  const openAdd  = () => { setEditing(null); setForm({ name:'', email:'', password:'', role:'staff', warehouse_id:'' }); setModal(true) }
  const openEdit = (row) => { setEditing(row); setForm({ name: row.name, email: row.email, password:'', role: row.role, warehouse_id: row.warehouse_id || '' }); setModal(true) }

  const save = async () => {
    if (!form.name || !form.email || (!editing && !form.password)) { toast.error('Lengkapi semua field wajib'); return }
    try {
      if (editing) { await api.put(`/users/${editing.id}`, form); toast.success('Pengguna diperbarui') }
      else { await api.post('/users', form); toast.success('Pengguna ditambahkan') }
      setModal(false); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan') }
  }

  const del = async (row) => {
    if (!confirm(`Hapus pengguna "${row.name}"?`)) return
    await api.delete(`/users/${row.id}`); toast.success('Pengguna dihapus'); load()
  }

  return (
    <PageShell>
      <PageHeader icon={Users} title="Manajemen Pengguna" subtitle="Kelola akses dan hak pengguna sistem" onRefresh={load} onAdd={openAdd} addLabel="Tambah Pengguna" />
      <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Cari nama atau email..." /></div>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} onEdit={openEdit} onDelete={del} emptyMessage="Belum ada pengguna" />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}>
        <div className="space-y-4">
          <FormField label="Nama Lengkap" required><Input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="Nama pengguna" /></FormField>
          <FormField label="Email" required><Input type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} placeholder="email@domain.com" /></FormField>
          <FormField label={editing ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password'} required={!editing}>
            <Input type="password" value={form.password} onChange={e => setForm({...form, password:e.target.value})} placeholder="Min. 8 karakter" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Role">
              <Select value={form.role} onChange={e => setForm({...form, role:e.target.value, warehouse_id: e.target.value !== 'staff' ? '' : form.warehouse_id})}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </FormField>
            {form.role === 'staff' && (
              <FormField label="Gudang">
                <Select value={form.warehouse_id} onChange={e => setForm({...form, warehouse_id:e.target.value})}>
                  <option value="">— Semua Gudang —</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
              </FormField>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={save} className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">Simpan</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
