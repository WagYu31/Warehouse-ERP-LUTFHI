import { useState, useEffect } from 'react'
import { ShoppingCart, Printer, Eye, FileText, CheckCircle, XCircle, Clock, Package, Truck } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { PageShell, PageHeader, SearchBar, DataTable, StatusBadge, Modal, FormField, Input, Select, Textarea } from '@/components/ui'
import { printPurchaseOrder } from '@/utils/printUtils'

function DR({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-white/[0.05] last:border-0">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={`text-sm font-medium text-right max-w-[60%] ${highlight ? 'text-gold-400' : 'text-white'}`}>{value ?? '—'}</span>
    </div>
  )
}

const COLS = [
  { key: 'po_number', label: 'No. PO', render: v => <span className="text-purple-400 font-mono text-sm">{v}</span> },
  { key: 'order_date', label: 'Tanggal', render: v => v && v !== '0000-00-00' ? new Date(v).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '—' },
  { key: 'supplier_name', label: 'Supplier', render: v => v || '—' },
  { key: 'item_count', label: 'Item', render: v => <span className="text-slate-300">{v || 0} item</span> },
  { key: 'total_amount', label: 'Total', render: v => <span className="text-white font-semibold">Rp {Number(v||0).toLocaleString('id-ID')}</span> },
  { key: 'status', label: 'Status', render: v => <StatusBadge value={v} /> },
]

export default function PurchaseOrderPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const canCreate = ['admin', 'finance_procurement'].includes(user?.role)
  const [data, setData]       = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [items, setItems]     = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [departments, setDepartments] = useState([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [rejectModal, setRejectModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [form, setForm]       = useState({ supplier_id:'', warehouse_id:'', department_id:'', tax_rate:11, notes:'' })
  const [lines, setLines]     = useState([{ item_id:'', qty:1, unit_price:0 }])

  const load = async () => {
    setLoading(true)
    try {
      const [po, s, i, w, dept] = await Promise.all([api.get('/erp/purchase-orders'), api.get('/suppliers'), api.get('/items'), api.get('/warehouses'), api.get('/departments')])
      let d = po.data || []
      if (search) d = d.filter(r => r.po_number?.toLowerCase().includes(search.toLowerCase()) || r.supplier_name?.toLowerCase().includes(search.toLowerCase()))
      setData(d); setSuppliers(s.data||[]); setItems(i.data||[]); setWarehouses(w.data||[]); setDepartments(dept.data||[])
    } catch { toast.error('Gagal memuat PO') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search])

  const addLine = () => setLines([...lines, { item_id:'', qty:1, unit_price:0 }])
  const rmLine  = (i) => setLines(lines.filter((_,idx) => idx !== i))
  const setLine = (i, k, v) => setLines(lines.map((l, idx) => idx===i ? {...l, [k]: v} : l))

  const subtotal = lines.reduce((s, l) => s + (+l.qty * +l.unit_price), 0)
  const tax      = subtotal * (form.tax_rate || 11) / 100
  const total    = subtotal + tax

  const submit = async () => {
    if (!form.supplier_id) { toast.error('Pilih supplier dulu!'); return }
    if (!form.warehouse_id) { toast.error('Pilih gudang tujuan dulu!'); return }
    const validLines = lines.filter(l => l.item_id && +l.qty > 0)
    if (!validLines.length) { toast.error('Minimal 1 item dengan qty valid'); return }
    try {
      await api.post('/erp/purchase-orders', { ...form, items: validLines.map(l => ({ item_id:l.item_id, qty:+l.qty, unit_price:+l.unit_price })) })
      toast.success('Purchase Order dibuat! Menunggu approval Admin.')
      setModal(false); setForm({ supplier_id:'', warehouse_id:'', department_id:'', tax_rate:11, notes:'' }); setLines([{ item_id:'', qty:1, unit_price:0 }]); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal menyimpan') }
  }

  const openView = async (row) => {
    setDetailModal(true)
    setSelected(row)
    setDetailLoading(true)
    try {
      const res = await api.get(`/erp/purchase-orders/${row.id}`)
      const full = res.data || res
      if (full.items) {
        full.items = full.items.map(i => ({
          ...i, name: i.item_name || i.name, qty: i.qty_ordered || i.qty,
        }))
      }
      setSelected(full)
    } catch { toast.error('Gagal memuat detail PO') }
    finally { setDetailLoading(false) }
  }

  const handleApprove = async () => {
    if (!selected) return
    try {
      const res = await api.put(`/erp/purchase-orders/${selected.id}/approve`, {})
      const data = res.data || res
      toast.success(data.invoice_number
        ? `PO disetujui! Invoice ${data.invoice_number} otomatis dibuat.`
        : 'PO disetujui! Invoice otomatis dibuat.'
      )
      setSelected({ ...selected, status: 'approved' }); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal approve') }
  }

  const handleReject = async () => {
    try {
      await api.put(`/erp/purchase-orders/${selected.id}/reject`, { reason: rejectReason })
      toast.success('PO ditolak')
      setRejectModal(false); setDetailModal(false); setRejectReason(''); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal reject') }
  }

  const handleReceive = async () => {
    if (!selected) return
    if (!confirm('Konfirmasi barang dari supplier sudah diterima?\nInbound akan dibuat otomatis.')) return
    try {
      const res = await api.post(`/erp/purchase-orders/${selected.id}/receive`, {})
      const data = res.data || res
      toast.success(`Barang diterima! Inbound ${data.inbound_ref || ''} dibuat. Konfirmasi inbound untuk update stok.`)
      setSelected({ ...selected, status: 'received' }); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal terima barang') }
  }

  const pendingCount = data.filter(d => d.status === 'draft').length

  return (
    <PageShell>
      <PageHeader icon={ShoppingCart} title="Purchase Order" subtitle="Kelola pembelian ke supplier"
        onRefresh={load} onAdd={canCreate ? () => setModal(true) : undefined} addLabel="Buat PO" />

      <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Cari No. PO atau supplier..." /></div>

      {isAdmin && pendingCount > 0 && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <Clock size={14} className="text-yellow-400" />
          <span className="text-yellow-400 text-sm font-medium">{pendingCount} PO menunggu approval Anda</span>
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} onView={openView} emptyMessage="Belum ada Purchase Order" />
      </div>

      {/* Detail Modal */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
            <Eye size={14} className="text-purple-400" />
          </div>
          <div>
            <div className="text-white font-bold">{selected?.po_number}</div>
            <div className="text-slate-500 text-xs">Purchase Order</div>
          </div>
        </div>
      } size="lg">
        {detailLoading ? (
          <div className="py-10 text-center text-slate-400 text-sm animate-pulse">Memuat detail PO...</div>
        ) : selected && (
          <div className="space-y-4">
            {/* Status Banners */}
            {selected.status === 'draft' && (
              <div className="flex items-center gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-2.5">
                <Clock size={14} className="text-yellow-400" />
                <span className="text-yellow-400 text-sm font-medium">⏳ Menunggu approval Administrator</span>
              </div>
            )}
            {selected.status === 'approved' && (
              <div className="flex items-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-2.5">
                <CheckCircle size={14} className="text-blue-400" />
                <span className="text-blue-400 text-sm font-medium">✅ PO Disetujui — Menunggu barang dari supplier</span>
              </div>
            )}
            {selected.status === 'received' && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5">
                <Package size={14} className="text-emerald-400" />
                <span className="text-emerald-400 text-sm font-medium">📦 Barang diterima — Konfirmasi Inbound untuk update stok</span>
              </div>
            )}
            {selected.status === 'cancelled' && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <XCircle size={14} className="text-red-400" />
                  <span className="text-red-400 text-sm font-medium">PO Ditolak / Dibatalkan</span>
                </div>
                {selected.reject_reason && (
                  <p className="text-red-400/70 text-xs mt-1 ml-6">Alasan: {selected.reject_reason}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className="text-purple-400" />
                  <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Info PO</span>
                </div>
                <DR label="No. PO" value={<span className="text-purple-400 font-mono">{selected.po_number}</span>} />
                <DR label="Tanggal" value={selected.order_date && selected.order_date !== '0000-00-00' ? new Date(selected.order_date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) : '—'} />
                <DR label="Status" value={<StatusBadge value={selected.status} />} />
                <DR label="Total" value={<span className="text-gold-400 font-bold">Rp {Number(selected.total_amount||0).toLocaleString('id-ID')}</span>} highlight />
              </div>

              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Truck size={14} className="text-purple-400" />
                  <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Detail</span>
                </div>
                <DR label="Supplier" value={selected.supplier_name || '—'} />
                <DR label="Gudang Tujuan" value={selected.warehouse_name || '—'} />
                <DR label="Dibuat Oleh" value={selected.created_by_name || '—'} />
                {selected.expected_date && <DR label="Estimasi Tiba" value={new Date(selected.expected_date).toLocaleDateString('id-ID')} />}
              </div>
            </div>

            {/* Items Table */}
            {selected.items && selected.items.length > 0 && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Package size={14} className="text-purple-400" />
                  <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Item PO</span>
                </div>
                <div className="space-y-1">
                  {selected.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1.5 border-b border-white/[0.04] last:border-0">
                      <div>
                        <span className="text-sm text-white">{item.name || item.item_name || '—'}</span>
                        <span className="text-xs text-slate-500 ml-2">{item.sku}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gold-400">{item.qty || item.qty_ordered} {item.unit || 'pcs'}</span>
                        <span className="text-xs text-slate-500 ml-2">@ Rp {Number(item.unit_price||0).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.notes && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="text-xs text-slate-500 mb-1">Catatan</p>
                <p className="text-sm text-slate-300">{selected.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between gap-3 pt-2">
              <button onClick={() => printPurchaseOrder(selected)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] text-white hover:bg-white/[0.1] text-sm font-medium">
                <Printer size={14} /> Print PO
              </button>
              <div className="flex gap-3">
                {/* Admin: Approve / Reject draft PO */}
                {isAdmin && selected.status === 'draft' && (
                  <>
                    <button onClick={() => { setRejectReason(''); setRejectModal(true) }}
                      className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-medium text-sm transition-all flex items-center gap-2">
                      <XCircle size={14} /> Tolak
                    </button>
                    <button onClick={handleApprove}
                      className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-all flex items-center gap-2">
                      <CheckCircle size={14} /> Approve PO
                    </button>
                  </>
                )}
                {/* Approved: Terima Barang */}
                {selected.status === 'approved' && canCreate && (
                  <button onClick={handleReceive}
                    className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm transition-all flex items-center gap-2">
                    <Package size={14} /> Terima Barang
                  </button>
                )}
                {/* Close button for other statuses */}
                {(!isAdmin || selected.status !== 'draft') && selected.status !== 'approved' && (
                  <button onClick={() => setDetailModal(false)} className="px-5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-semibold text-sm">Tutup</button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal open={rejectModal} onClose={() => setRejectModal(false)} title="Tolak Purchase Order">
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5">
            <XCircle size={14} className="text-red-400" />
            <span className="text-red-400 text-sm font-medium">PO {selected?.po_number} akan ditolak</span>
          </div>
          <FormField label="Alasan Penolakan" required>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Jelaskan alasan penolakan..." />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setRejectModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={handleReject} disabled={!rejectReason.trim()} className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-semibold text-sm disabled:opacity-50">Konfirmasi Tolak</button>
          </div>
        </div>
      </Modal>

      {/* Buat PO Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Buat Purchase Order" size="xl">
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-2.5">
            <Clock size={14} className="text-blue-400" />
            <span className="text-blue-400 text-sm">PO akan menunggu approval Administrator sebelum diproses ke supplier</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Supplier" required>
              <Select value={form.supplier_id} onChange={e => setForm({...form, supplier_id:e.target.value})}>
                <option value="">Pilih supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Gudang Tujuan" required>
              <Select value={form.warehouse_id} onChange={e => setForm({...form, warehouse_id:e.target.value})}>
                <option value="">Pilih gudang</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            </FormField>
          </div>

          <FormField label="Departemen (untuk kontrol budget)">
            <Select value={form.department_id} onChange={e => setForm({...form, department_id:e.target.value})}>
              <option value="">— Tanpa departemen —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </FormField>

          <div className="border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Item PO</span>
              <button onClick={addLine} className="text-gold-400 text-xs font-medium">+ Tambah Item</button>
            </div>
            <div className="space-y-2 mb-3">
              {lines.map((ln, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5"><Select value={ln.item_id} onChange={e => setLine(idx,'item_id',e.target.value)}>
                    <option value="">Pilih item</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </Select></div>
                  <div className="col-span-2"><Input type="number" min="1" value={ln.qty} onChange={e => setLine(idx,'qty',e.target.value)} placeholder="Qty" /></div>
                  <div className="col-span-4"><Input type="number" value={ln.unit_price} onChange={e => setLine(idx,'unit_price',e.target.value)} placeholder="Harga satuan" /></div>
                  <div className="col-span-1 flex justify-center">{lines.length > 1 && <button onClick={() => rmLine(idx)} className="text-red-400">✕</button>}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-white/[0.06] pt-3 text-sm space-y-1">
              <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>Rp {subtotal.toLocaleString('id-ID')}</span></div>
              <div className="flex justify-between text-slate-400"><span>PPN {form.tax_rate}%</span><span>Rp {Math.round(tax).toLocaleString('id-ID')}</span></div>
              <div className="flex justify-between text-white font-bold text-base"><span>Total</span><span>Rp {Math.round(total).toLocaleString('id-ID')}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tarif PPN (%)"><Input type="number" value={form.tax_rate} onChange={e => setForm({...form, tax_rate:+e.target.value})} /></FormField>
          </div>
          <FormField label="Catatan"><Textarea value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} /></FormField>

          <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={submit} className="px-5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-semibold text-sm">Buat PO</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
