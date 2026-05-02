import { useState, useEffect, useMemo } from 'react'
import { Package, Grid3X3, Ruler, Plus, Pencil, Trash2, X, Check, Search, ToggleLeft, ToggleRight, AlertTriangle, FileText, ChevronDown, Eye, EyeOff, Info } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell, PageHeader, Modal, FormField, Input, Select } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'

/* ── Reusable Master Data Card ──────────────────────────────── */
function MasterCard({
  title, icon: Icon, color, items, loading,
  onAdd, onEdit, onToggle, onDelete,
  fields = [], // extra columns beyond name
  showDescription = false,
  showAbbreviation = false,
}) {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('add') // 'add' | 'edit'
  const [form, setForm] = useState({ name: '', description: '', abbreviation: '' })
  const [editId, setEditId] = useState(null)

  // Filtered items
  const filtered = useMemo(() => {
    let list = items
    if (!showInactive) list = list.filter(i => i.is_active == 1 || i.is_active === true || i.is_active === '1')
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.abbreviation?.toLowerCase().includes(q)
      )
    }
    return list
  }, [items, search, showInactive])

  const activeCount = items.filter(i => i.is_active == 1 || i.is_active === true || i.is_active === '1').length
  const inactiveCount = items.length - activeCount

  const openAdd = () => {
    setForm({ name: '', description: '', abbreviation: '' })
    setModalMode('add')
    setEditId(null)
    setModalOpen(true)
  }
  const openEdit = (item) => {
    setForm({ name: item.name || '', description: item.description || '', abbreviation: item.abbreviation || '' })
    setModalMode('edit')
    setEditId(item.id)
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error('Nama wajib diisi')
    try {
      if (modalMode === 'add') {
        await onAdd(form)
        toast.success(`${title} berhasil ditambahkan`)
      } else {
        await onEdit(editId, form)
        toast.success(`${title} berhasil diperbarui`)
      }
      setModalOpen(false)
    } catch (e) {
      toast.error(e.response?.data?.message || `Gagal ${modalMode === 'add' ? 'tambah' : 'update'}`)
    }
  }

  return (
    <>
      <div className="master-card rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${color.bg}`}>
              <Icon size={20} className={color.text} />
            </div>
            <div>
              <h3 className="master-card-title text-white font-semibold text-[15px]">{title}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="master-card-sub text-xs text-slate-500">{activeCount} aktif</span>
                {inactiveCount > 0 && (
                  <span className="text-xs text-amber-500/70">• {inactiveCount} nonaktif</span>
                )}
              </div>
            </div>
          </div>
          {isAdmin && (
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm transition-colors">
              <Plus size={15} /> Tambah
            </button>
          )}
        </div>

        {/* Search & Filter bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04]">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="master-input w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-gold-500/50 placeholder:text-slate-600"
              placeholder={`Cari ${title.toLowerCase()}...`} />
          </div>
          <button onClick={() => setShowInactive(!showInactive)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
              showInactive
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                : 'border-white/[0.08] bg-white/[0.02] text-slate-500 hover:text-slate-300'
            }`}>
            {showInactive ? <Eye size={13} /> : <EyeOff size={13} />}
            {showInactive ? 'Semua' : 'Aktif saja'}
          </button>
        </div>

        {/* Data List */}
        <div className="px-5 py-3 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <Package size={32} className="mx-auto text-slate-700 mb-2" />
              <p className="text-slate-500 text-sm">
                {search ? `Tidak ada hasil untuk "${search}"` : 'Belum ada data'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map(item => {
                const isActive = item.is_active == 1 || item.is_active === true || item.is_active === '1'
                return (
                  <div key={item.id} className={`master-item flex items-center gap-3 px-3.5 py-2.5 rounded-xl group transition-colors ${
                    isActive ? 'hover:bg-white/[0.03]' : 'opacity-50 bg-white/[0.01]'
                  }`}>
                    {/* Status dot */}
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? color.dot : 'bg-slate-600'}`} />

                    {/* Name + description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`master-item-name text-sm font-medium ${isActive ? 'text-slate-200' : 'text-slate-500 line-through'}`}>
                          {item.name}
                        </span>
                        {!isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">NONAKTIF</span>
                        )}
                      </div>
                      {showDescription && item.description && (
                        <p className="master-item-desc text-xs text-slate-500 mt-0.5 truncate">{item.description}</p>
                      )}
                    </div>

                    {/* Abbreviation badge */}
                    {showAbbreviation && item.abbreviation && (
                      <span className="master-badge text-xs text-slate-400 bg-white/[0.05] px-2 py-0.5 rounded-md font-mono">
                        {item.abbreviation}
                      </span>
                    )}

                    {/* Action buttons */}
                    {isAdmin && (
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                        <button onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="Edit">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => onToggle(item)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isActive
                              ? 'text-slate-400 hover:text-amber-400 hover:bg-amber-500/10'
                              : 'text-amber-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                          title={isActive ? 'Nonaktifkan' : 'Aktifkan'}>
                          {isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                        </button>
                        {!isActive && (
                          <button onClick={() => onDelete(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Hapus permanen">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div className="master-footer px-5 py-2.5 border-t border-white/[0.04] bg-white/[0.01]">
          <p className="text-[11px] text-slate-600">
            Menampilkan {filtered.length} dari {items.length} data
            {search && <span> • Pencarian: "{search}"</span>}
          </p>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} title={`${modalMode === 'add' ? 'Tambah' : 'Edit'} ${title}`}
          onClose={() => setModalOpen(false)} size="sm">
          <div className="space-y-4">
            <FormField label="Nama" required>
              <Input value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                placeholder={`Masukkan nama ${title.toLowerCase()}`}
                autoFocus />
            </FormField>

            {showDescription && (
              <FormField label="Deskripsi">
                <Input value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Deskripsi singkat (opsional)" />
              </FormField>
            )}

            {showAbbreviation && (
              <FormField label={`Singkatan ${!form.abbreviation ? `(Auto: ${(form.name || '').substring(0,3) || '...'})` : ''}`}>
                <Input value={form.abbreviation}
                  onChange={e => setForm({...form, abbreviation: e.target.value})}
                  placeholder="Otomatis dari nama jika kosong"
                  maxLength={10} />
              </FormField>
            )}

            {/* Info banner */}
            <div className="master-info flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <Info size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-400/80 leading-relaxed">
                {modalMode === 'add'
                  ? `Data ${title.toLowerCase()} baru akan langsung aktif dan dapat digunakan di seluruh sistem.`
                  : `Perubahan akan langsung berlaku. Data yang sedang digunakan oleh item tidak akan terpengaruh.`
                }
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white text-sm transition-colors">
                Batal
              </button>
              <button onClick={handleSubmit}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm transition-colors">
                <Check size={14} />
                {modalMode === 'add' ? 'Tambah' : 'Simpan'}
              </button>
            </div>
          </div>
        </Modal>
    </>
  )
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function MasterDataPage() {
  const [categories, setCategories] = useState([])
  const [units, setUnits]           = useState([])
  const [loading, setLoading]       = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [cat, unt] = await Promise.all([api.get('/categories'), api.get('/units')])
      setCategories(Array.isArray(cat) ? cat : (cat.data || []))
      setUnits(Array.isArray(unt) ? unt : (unt.data || []))
    } catch (e) { toast.error('Gagal memuat master data') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  /* ── Category CRUD ── */
  const addCat = async (form) => {
    await api.post('/categories', { name: form.name, description: form.description || null })
    load()
  }
  const editCat = async (id, form) => {
    await api.put(`/categories/${id}`, { name: form.name, description: form.description || null })
    load()
  }
  const toggleCat = async (item) => {
    const isActive = item.is_active == 1 || item.is_active === true || item.is_active === '1'
    const action = isActive ? 'menonaktifkan' : 'mengaktifkan'
    try {
      await api.put(`/categories/${item.id}/toggle`)
      toast.success(`Kategori berhasil di${isActive ? 'nonaktifkan' : 'aktifkan'}`)
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal mengubah status') }
  }
  const delCat = async (item) => {
    try {
      await api.delete(`/categories/${item.id}`)
      toast.success('Kategori berhasil dihapus')
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal hapus kategori') }
  }

  /* ── Unit CRUD ── */
  const addUnit = async (form) => {
    await api.post('/units', { name: form.name, abbreviation: form.abbreviation || null })
    load()
  }
  const editUnit = async (id, form) => {
    await api.put(`/units/${id}`, { name: form.name, abbreviation: form.abbreviation || null })
    load()
  }
  const toggleUnit = async (item) => {
    const isActive = item.is_active == 1 || item.is_active === true || item.is_active === '1'
    const action = isActive ? 'menonaktifkan' : 'mengaktifkan'
    try {
      await api.put(`/units/${item.id}/toggle`)
      toast.success(`Satuan berhasil di${isActive ? 'nonaktifkan' : 'aktifkan'}`)
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal mengubah status') }
  }
  const delUnit = async (item) => {
    try {
      await api.delete(`/units/${item.id}`)
      toast.success('Satuan berhasil dihapus')
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal hapus satuan') }
  }

  return (
    <PageShell>
      <PageHeader icon={Package} title="Master Data"
        subtitle="Kelola kategori dan satuan item — data referensi utama untuk seluruh modul" onRefresh={load} />

      {/* Info Banner */}
      <div className="master-banner flex items-start gap-3 px-4 py-3 mb-6 rounded-xl bg-blue-500/5 border border-blue-500/10">
        <Info size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-400/80 leading-relaxed">
          <strong className="text-blue-400">Tips:</strong> Data master digunakan sebagai referensi di seluruh modul (Inventaris, PO, Invoice, dll).
          Untuk data yang tidak lagi digunakan, gunakan tombol <strong>nonaktifkan</strong> alih-alih menghapus agar histori data tetap terjaga.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MasterCard
          title="Kategori Item" icon={Grid3X3}
          color={{ bg: 'bg-purple-500/10 border-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-500' }}
          items={categories} loading={loading}
          onAdd={addCat} onEdit={editCat} onToggle={toggleCat} onDelete={delCat}
          showDescription
        />
        <MasterCard
          title="Satuan (Unit)" icon={Ruler}
          color={{ bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-500' }}
          items={units} loading={loading}
          onAdd={addUnit} onEdit={editUnit} onToggle={toggleUnit} onDelete={delUnit}
          showAbbreviation
        />
      </div>
    </PageShell>
  )
}
