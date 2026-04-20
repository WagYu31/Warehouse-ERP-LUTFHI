import { useState, useEffect } from 'react'
import { RefreshCcw, AlertTriangle, Package, TrendingDown, CheckCircle } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { PageShell, PageHeader, DataTable, Modal, FormField, Input, Select } from '@/components/ui'

const COLS = [
  { key: 'item', label: 'Nama Item', render: (_, r) => (
    <div>
      <div className="text-white font-medium text-sm">{r.item?.name || '—'}</div>
      <div className="text-slate-500 text-xs font-mono">{r.item?.sku}</div>
    </div>
  )},
  { key: 'warehouse', label: 'Gudang', render: (_, r) => r.warehouse?.name || '—' },
  { key: 'current_stock', label: 'Stok Saat Ini', render: v => (
    <span className={`font-bold ${v <= 0 ? 'text-red-400' : 'text-white'}`}>{v ?? 0}</span>
  )},
  { key: 'min_stock', label: 'Min Stok', render: (_, r) => r.item?.min_stock ?? '—' },
  { key: 'reorder_point', label: 'Reorder Point', render: v => v ?? '—' },
  { key: 'reorder_qty', label: 'Qty Reorder', render: v => v ?? '—' },
  { key: 'auto_po', label: 'Auto PO', render: v => v
    ? <span className="text-emerald-400 text-xs px-2 py-0.5 bg-emerald-400/10 rounded-full">Aktif</span>
    : <span className="text-slate-500 text-xs px-2 py-0.5 bg-white/5 rounded-full">Nonaktif</span>
  },
]

export default function ReorderPage() {
  const { user } = useAuthStore()
  const canCreate = ['admin', 'finance_procurement'].includes(user?.role)
  const [configs, setConfigs]   = useState([])
  const [alerts, setAlerts]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [items, setItems]       = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState({ item_id:'', warehouse_id:'', reorder_point:0, reorder_qty:0, auto_po:false })
  const [tab, setTab]           = useState('alert') // 'alert' | 'config'

  const load = async () => {
    setLoading(true)
    try {
      const [cRes, aRes, iRes, wRes] = await Promise.all([
        api.get('/reorder-configs').catch(() => []),
        api.get('/item-stocks/low').catch(() => []),
        api.get('/items'),
        api.get('/warehouses'),
      ])
      setConfigs(Array.isArray(cRes) ? cRes : (cRes.data || []))
      setAlerts(Array.isArray(aRes) ? aRes : (aRes.data || []))
      setItems(Array.isArray(iRes) ? iRes : (iRes.data || []))
      setWarehouses(Array.isArray(wRes) ? wRes : (wRes.data || []))
    } catch { toast.error('Gagal memuat data reorder') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const saveConfig = async () => {
    if (!form.item_id || !form.warehouse_id) { toast.error('Item dan gudang wajib dipilih'); return }
    try {
      await api.post('/reorder-configs', { ...form, reorder_point: +form.reorder_point, reorder_qty: +form.reorder_qty })
      toast.success('Konfigurasi reorder disimpan')
      setModal(false); load()
    } catch (e) { toast.error(e?.response?.data?.message || 'Gagal menyimpan') }
  }

  // ALERT COLS
  const ALERT_COLS = [
    { key: 'item', label: 'Item', render: (_, r) => (
      <div><div className="text-white text-sm font-medium">{r.item?.name || '—'}</div>
      <div className="text-slate-500 text-xs">{r.item?.sku}</div></div>
    )},
    { key: 'warehouse', label: 'Gudang', render: (_, r) => r.warehouse?.name || '—' },
    { key: 'current_stock', label: 'Stok', render: (v, r) => (
      <span className={`font-bold ${v <= (r.item?.min_stock || 0) ? 'text-red-400' : 'text-amber-400'}`}>{v}</span>
    )},
    { key: 'item', label: 'Min Stok', render: (v) => v?.min_stock ?? '—' },
    { key: 'status', label: 'Kondisi', render: (_, r) => {
      const s = r.current_stock
      const m = r.item?.min_stock || 0
      if (s === 0) return <span className="text-red-400 text-xs font-semibold">🚨 Habis</span>
      if (s <= m) return <span className="text-red-400 text-xs font-semibold">⚠️ Kritis</span>
      return <span className="text-amber-400 text-xs">⚡ Menipis</span>
    }},
  ]

  return (
    <PageShell>
      <PageHeader
        icon={RefreshCcw}
        title="Reorder Point"
        subtitle="Monitor stok kritis dan konfigurasi pemesanan otomatis"
        onRefresh={load}
        onAdd={canCreate ? () => setModal(true) : undefined}
        addLabel="Tambah Konfigurasi"
      />

      {/* Tab */}
      <div className="flex gap-2 mb-6">
        {[
          { key:'alert', label:'🚨 Stok Kritis', count: alerts.length },
          { key:'config', label:'⚙️ Konfigurasi Reorder', count: configs.length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab===t.key ? 'bg-gold-500 text-navy-900' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
            {t.label} {t.count > 0 && <span className="ml-1 bg-white/20 text-xs px-1.5 rounded-full">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        {tab === 'alert' ? (
          alerts.length === 0 && !loading ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <CheckCircle size={28} className="text-emerald-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Semua Stok Aman ✓</h3>
              <p className="text-slate-500 text-sm">Tidak ada item dengan stok di bawah minimum saat ini.</p>
            </div>
          ) : <DataTable columns={ALERT_COLS} data={alerts} loading={loading} emptyMessage="Semua stok normal" />
        ) : (
          <DataTable columns={COLS} data={configs} loading={loading} emptyMessage="Belum ada konfigurasi reorder — tambahkan di atas" />
        )}
      </div>

      {/* Modal Config */}
      <Modal open={modal} onClose={() => setModal(false)} title="Konfigurasi Reorder Point">
        <div className="space-y-4">
          <FormField label="Item" required>
            <Select value={form.item_id} onChange={e => setForm({...form, item_id: e.target.value})}>
              <option value="">-- Pilih Item --</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.sku} - {i.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Gudang" required>
            <Select value={form.warehouse_id} onChange={e => setForm({...form, warehouse_id: e.target.value})}>
              <option value="">-- Pilih Gudang --</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Reorder Point (stok minimum)">
              <Input type="number" value={form.reorder_point} onChange={e => setForm({...form, reorder_point: e.target.value})} /></FormField>
            <FormField label="Qty Reorder (qty pesanan)">
              <Input type="number" value={form.reorder_qty} onChange={e => setForm({...form, reorder_qty: e.target.value})} /></FormField>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/[0.08]">
            <input type="checkbox" id="auto_po" checked={form.auto_po} onChange={e => setForm({...form, auto_po: e.target.checked})} className="rounded" />
            <label htmlFor="auto_po" className="text-slate-300 text-sm">Aktifkan Auto Purchase Order saat stok mencapai reorder point</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={saveConfig} className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm">Simpan</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
