import { useState, useEffect } from 'react'
import { Package, Grid3X3, Ruler, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell, PageHeader } from '@/components/ui'

function MasterList({ title, icon: Icon, color, items, loading, onAdd, onEdit, onDelete }) {
  const [addVal, setAddVal] = useState('')
  const [editId, setEditId] = useState(null)
  const [editVal, setEditVal] = useState('')

  const handleAdd = async () => {
    if (!addVal.trim()) return
    await onAdd(addVal.trim())
    setAddVal('')
  }
  const startEdit = (item) => { setEditId(item.id); setEditVal(item.name) }
  const commitEdit = async () => { await onEdit(editId, editVal); setEditId(null) }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className={`p-2 rounded-xl border ${color.bg}`}>
          <Icon size={18} className={color.text} />
        </div>
        <div>
          <h3 className="text-white font-semibold">{title}</h3>
          <p className="text-slate-500 text-xs">{items.length} data tersimpan</p>
        </div>
      </div>

      {/* Add Form */}
      <div className="flex gap-2 mb-4">
        <input value={addVal} onChange={e => setAddVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-gold-500/50"
          placeholder={`Tambah ${title.toLowerCase()}...`} />
        <button onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">
          <Plus size={14} /> Tambah
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 rounded-xl bg-white/[0.03] animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">Belum ada data</div>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/[0.03] group">
              {editId === item.id ? (
                <>
                  <input value={editVal} onChange={e => setEditVal(e.target.value)}
                    className="flex-1 px-2 py-1 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white text-sm focus:outline-none"
                    onKeyDown={e => { if(e.key==='Enter') commitEdit(); if(e.key==='Escape') setEditId(null) }}
                    autoFocus />
                  <button onClick={commitEdit} className="p-1 text-emerald-400 hover:text-emerald-300"><Check size={14} /></button>
                  <button onClick={() => setEditId(null)} className="p-1 text-slate-500 hover:text-white"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                  <span className="flex-1 text-slate-200 text-sm">{item.name}</span>
                  {item.abbreviation && <span className="text-xs text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded">{item.abbreviation}</span>}
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                    <button onClick={() => startEdit(item)} className="p-1 text-slate-400 hover:text-blue-400"><Pencil size={13} /></button>
                    <button onClick={() => onDelete(item)} className="p-1 text-slate-400 hover:text-red-400"><Trash2 size={13} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
    } catch { toast.error('Gagal memuat master data') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  /* Category actions */
  const addCat = async (name) => {
    try {
      await api.post('/categories', { name })
      toast.success('Kategori ditambahkan')
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal tambah kategori') }
  }
  const editCat = async (id, name) => {
    try {
      await api.put(`/categories/${id}`, { name })
      toast.success('Kategori diperbarui')
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal update kategori') }
  }
  const delCat = async (item) => {
    if (!confirm(`Hapus kategori "${item.name}"?`)) return
    try {
      await api.delete(`/categories/${item.id}`)
      toast.success('Kategori dihapus')
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal hapus') }
  }

  /* Unit actions */
  const addUnit = async (name) => {
    try {
      await api.post('/units', { name })
      toast.success('Satuan ditambahkan')
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal tambah satuan') }
  }
  const editUnit = async (id, name) => {
    try {
      await api.put(`/units/${id}`, { name })
      toast.success('Satuan diperbarui')
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal update satuan') }
  }
  const delUnit = async (item) => {
    if (!confirm(`Hapus satuan "${item.name}"?`)) return
    try {
      await api.delete(`/units/${item.id}`)
      toast.success('Satuan dihapus')
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal hapus') }
  }

  return (
    <PageShell>
      <PageHeader icon={Package} title="Master Data" subtitle="Kelola kategori dan satuan item" onRefresh={load} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MasterList
          title="Kategori Item" icon={Grid3X3}
          color={{ bg: 'bg-purple-500/10 border-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-500' }}
          items={categories} loading={loading}
          onAdd={addCat} onEdit={editCat} onDelete={delCat}
        />
        <MasterList
          title="Satuan (Unit)" icon={Ruler}
          color={{ bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-500' }}
          items={units} loading={loading}
          onAdd={addUnit} onEdit={editUnit} onDelete={delUnit}
        />
      </div>
    </PageShell>
  )
}
