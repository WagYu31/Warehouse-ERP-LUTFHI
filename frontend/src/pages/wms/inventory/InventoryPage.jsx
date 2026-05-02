import { useState, useEffect } from 'react'
import { Package, AlertTriangle, Eye, Tag, Layers, BarChart2, Settings2, Clock } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { useWarehouseStore } from '@/store/warehouseStore'
import {
  PageShell, PageHeader, SearchBar, DataTable, StatusBadge,
  Modal, FormField, Input, Select, Textarea
} from '@/components/ui'

const COLS = [
  { key: 'sku',           label: 'SKU' },
  { key: 'name',          label: 'Nama Item' },
  { key: 'category_name', label: 'Kategori' },
  { key: 'unit_name',     label: 'Satuan', render: (v, r) => (
    <span>{v ?? '—'}{r.unit_abbreviation ? ` (${r.unit_abbreviation})` : ''}</span>
  )},
  { key: 'current_stock', label: 'Stok', render: (v, r) => (
    <div>
      <span className={`font-semibold ${Number(v??0) <= Number(r.min_stock) ? 'text-red-400' : 'text-white'}`}>{v ?? 0}</span>
      <span className="text-slate-600 text-xs ml-1">/ min {r.min_stock}</span>
    </div>
  )},
  { key: 'price', label: 'Harga', render: v => (
    <span className="text-slate-300">Rp {Number(v||0).toLocaleString('id-ID')}</span>
  )},
  { key: 'is_active', label: 'Status', render: v => <StatusBadge value={v == '1' || v === true ? 'active' : 'inactive'} /> },
]

function DetailRow({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-white/[0.05] last:border-0">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={`text-sm font-medium text-right max-w-[60%] ${highlight ? 'text-gold-400' : 'text-white'}`}>{value ?? '—'}</span>
    </div>
  )
}

function DetailSection({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-gold-400" />
        <span className="text-xs font-semibold text-gold-400 uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  )
}

export default function InventoryPage() {
  const { user } = useAuthStore()
  const { selectedWarehouseId, getSelectedName } = useWarehouseStore()
  const isAdmin = user?.role === 'admin'
  const [data, setData]         = useState([])
  const [cats, setCats]         = useState([])
  const [units, setUnits]       = useState([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState({ sku:'', name:'', category_id:'', unit_id:'', min_stock:0, price:0, description:'' })

  const load = async () => {
    setLoading(true)
    try {
      const whParam = selectedWarehouseId ? `&warehouse_id=${selectedWarehouseId}` : ''
      const [items, c, u] = await Promise.all([
        api.get(`/items?search=${search}${whParam}`),
        api.get('/categories'),
        api.get('/units'),
      ])
      setData(items.data || [])
      setCats(c.data || [])
      setUnits(u.data || [])
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search, selectedWarehouseId])

  const openAdd  = () => { setEditing(null); setForm({ sku:'', name:'', category_id:'', unit_id:'', min_stock:0, price:0, description:'' }); setModal(true) }
  const openEdit = (row) => { setEditing(row); setForm({ sku: row.sku, name: row.name, category_id:'', unit_id:'', min_stock: row.min_stock, price: row.price, description:'' }); setModal(true) }
  const openView = (row) => { setSelected(row); setDetailModal(true) }

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

  const isCritical = selected && Number(selected.current_stock ?? 0) <= Number(selected.min_stock ?? 0) && Number(selected.min_stock ?? 0) > 0

  return (
    <PageShell>
      <PageHeader
        icon={Package} title="Inventaris Stok"
        subtitle={`${data.length} item aktif — ${getSelectedName()}`}
        onRefresh={load} onAdd={isAdmin ? openAdd : undefined} onExport={exportCSV}
      />

      {/* Filter kritis */}
      <div className="flex items-center gap-3 mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Cari SKU atau nama item..." />
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium whitespace-nowrap">
          <AlertTriangle size={12} />
          {data.filter(d => Number(d.current_stock??0) <= Number(d.min_stock??0) && Number(d.min_stock??0) > 0).length} kritis
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading}
          onView={openView}
          onEdit={isAdmin ? openEdit : undefined}
          onDelete={isAdmin ? del : undefined}
          emptyMessage="Belum ada item. Tambahkan item pertama Anda!" />
      </div>

      {/* ── Detail Modal ── */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)}
        title={
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold-500/15 border border-gold-500/20 flex items-center justify-center">
              <Eye size={14} className="text-gold-400" />
            </div>
            <div>
              <div className="text-white font-bold">{selected?.name}</div>
              <div className="text-slate-500 text-xs font-mono">{selected?.sku}</div>
            </div>
          </div>
        }>
        {selected && (
          <div className="space-y-4">
            {/* Status Banner */}
            {isCritical && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5">
                <AlertTriangle size={14} className="text-red-400" />
                <span className="text-red-400 text-sm font-medium">⚠️ Stok di bawah minimum — Perlu restock segera!</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Info Umum */}
              <DetailSection icon={Tag} title="Informasi Item">
                <DetailRow label="SKU" value={selected.sku} highlight />
                <DetailRow label="Nama Item" value={selected.name} />
                <DetailRow label="Kategori" value={selected.category_name ?? selected.category} />
                <DetailRow label="Satuan" value={selected.unit_name ? `${selected.unit_name}${selected.unit_abbreviation ? ` (${selected.unit_abbreviation})` : ''}` : '—'} />
                <DetailRow label="Deskripsi" value={selected.description || 'Tidak ada deskripsi'} />
              </DetailSection>

              {/* Info Stok & Harga */}
              <DetailSection icon={BarChart2} title="Stok & Harga">
                <DetailRow
                  label="Stok Saat Ini"
                  value={<span className={isCritical ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>{selected.current_stock ?? 0}</span>}
                />
                <DetailRow label="Stok Minimum" value={selected.min_stock ?? 0} />
                <DetailRow label="Stok Maksimum" value={selected.max_stock ?? '—'} />
                <DetailRow label="Harga Satuan" value={`Rp ${Number(selected.price || 0).toLocaleString('id-ID')}`} highlight />
                <DetailRow label="Estimasi Nilai Stok" value={`Rp ${(Number(selected.current_stock || 0) * Number(selected.price || 0)).toLocaleString('id-ID')}`} />
              </DetailSection>

              {/* Tracking */}
              <DetailSection icon={Settings2} title="Pengaturan Tracking">
                <DetailRow label="Batch Tracking" value={selected.batch_tracking == 1 || selected.batch_tracking === true ? '✅ Aktif' : '❌ Tidak Aktif'} />
                <DetailRow label="Expired Tracking" value={selected.expired_tracking == 1 || selected.expired_tracking === true ? '✅ Aktif' : '❌ Tidak Aktif'} />
                <DetailRow label="Alert Sebelum Expired" value={selected.alert_days_before ? `${selected.alert_days_before} hari` : '—'} />
                <DetailRow label="Metode Keluar" value={selected.outbound_method?.toUpperCase() ?? 'FIFO'} />
              </DetailSection>

              {/* Lainnya */}
              <DetailSection icon={Clock} title="Info Sistem">
                <DetailRow label="Status" value={<StatusBadge value={selected.is_active == '1' || selected.is_active === true || selected.is_active === 1 ? 'active' : 'inactive'} />} />
                <DetailRow label="Barcode" value={selected.barcode || '—'} />
                <DetailRow label="QR Code" value={selected.qr_code || '—'} />
                <DetailRow label="Dibuat" value={selected.created_at ? new Date(selected.created_at).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '—'} />
                <DetailRow label="Diperbarui" value={selected.updated_at ? new Date(selected.updated_at).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '—'} />
              </DetailSection>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              {isAdmin && (
                <button
                  onClick={() => { setDetailModal(false); openEdit(selected) }}
                  className="px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 font-medium text-sm transition-all"
                >
                  ✏️ Edit Item
                </button>
              )}
              <button
                onClick={() => setDetailModal(false)}
                className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add/Edit Modal ── */}
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
