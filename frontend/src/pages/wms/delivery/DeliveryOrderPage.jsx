import { useState, useEffect } from 'react'
import { Truck, MapPin, CheckCircle, XCircle, Clock, Plus, Printer, Eye, FileText, Building2, Package } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { useWarehouseStore } from '@/store/warehouseStore'
import { PageShell, PageHeader, DataTable, StatusBadge, Modal, FormField, Input, Select, Textarea } from '@/components/ui'

function DR({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-white/[0.05] last:border-0">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={`text-sm font-medium text-right max-w-[60%] ${highlight ? 'text-gold-400' : 'text-white'}`}>{value ?? '—'}</span>
    </div>
  )
}

const COLS = [
  { key: 'ref_number', label: 'No. Surat Jalan', render: v => <span className="text-blue-400 font-mono text-sm">{v}</span> },
  { key: 'delivery_date', label: 'Tanggal', render: v => v ? new Date(v).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '—' },
  { key: 'destination', label: 'Tujuan', render: v => <span className="text-slate-300 truncate max-w-xs block">{v || '—'}</span> },
  { key: 'warehouse_name', label: 'Gudang' },
  { key: 'created_by_name', label: 'Dibuat Oleh' },
  { key: 'status', label: 'Status', render: v => <StatusBadge value={v} /> },
]

export default function DeliveryOrderPage() {
  const { user } = useAuthStore()
  const { selectedWarehouseId, getSelectedName } = useWarehouseStore()
  const isAdmin = user?.role === 'admin'
  const canCreate = ['admin', 'staff'].includes(user?.role)
  const [data, setData] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [rejectModal, setRejectModal] = useState(false)
  const [detail, setDetail] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [form, setForm] = useState({
    warehouse_id: '', delivery_date: new Date().toISOString().slice(0,10),
    destination: '', notes: ''
  })
  const [lines, setLines] = useState([{ item_id: '', qty: 1 }])

  const myWarehouses = user?.warehouses || []
  const fromWarehouseOptions = isAdmin ? warehouses : warehouses.filter(w => myWarehouses.some(mw => mw.id === w.id))

  const load = async () => {
    setLoading(true)
    try {
      const whParam = selectedWarehouseId ? `?warehouse_id=${selectedWarehouseId}` : ''
      const [dos, w, i] = await Promise.all([
        api.get(`/delivery-orders${whParam}`),
        api.get('/warehouses'),
        api.get('/items'),
      ])
      setData(Array.isArray(dos) ? dos : (dos.data || []))
      setWarehouses(Array.isArray(w) ? w : (w.data || []))
      setItems(Array.isArray(i) ? i : (i.data || []))
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [selectedWarehouseId])

  useEffect(() => {
    if (!isAdmin && fromWarehouseOptions.length === 1 && !form.warehouse_id) {
      setForm(f => ({ ...f, warehouse_id: fromWarehouseOptions[0].id }))
    }
  }, [fromWarehouseOptions, isAdmin])

  const addLine = () => setLines([...lines, { item_id: '', qty: 1 }])
  const rmLine  = i => setLines(lines.filter((_, idx) => idx !== i))
  const setLine = (i, k, v) => setLines(lines.map((l, idx) => idx === i ? {...l, [k]: v} : l))

  const submit = async () => {
    if (!form.warehouse_id) { toast.error('Pilih gudang asal'); return }
    const validLines = lines.filter(l => l.item_id && l.qty > 0)
    if (!validLines.length) { toast.error('Minimal 1 item dengan qty valid'); return }
    try {
      await api.post('/delivery-orders', { ...form, items: validLines })
      toast.success('Surat Jalan dibuat! Menunggu approval Admin.')
      setModal(false); setForm({ warehouse_id: '', delivery_date: new Date().toISOString().slice(0,10), destination: '', notes: '' })
      setLines([{ item_id: '', qty: 1 }]); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal membuat Surat Jalan') }
  }

  const openDetail = async (row) => {
    try {
      const res = await api.get(`/delivery-orders/${row.id}`)
      setDetail(res.data || res)
    } catch { setDetail(row) }
    setDetailModal(true)
  }

  const handleApprove = async () => {
    if (!detail) return
    if (!confirm('Setujui Surat Jalan ini? Stok akan dikurangi dari gudang.')) return
    try {
      await api.put(`/delivery-orders/${detail.id}/approve`, {})
      toast.success('Surat Jalan disetujui! Stok sudah dikurangi.')
      setDetailModal(false); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal approve') }
  }

  const handleReject = async () => {
    try {
      await api.put(`/delivery-orders/${detail.id}/reject`, { reason: rejectReason })
      toast.success('Surat Jalan ditolak')
      setRejectModal(false); setDetailModal(false); setRejectReason(''); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal reject') }
  }

  const handleConfirmDelivered = async () => {
    if (!confirm('Konfirmasi barang sudah diterima?')) return
    try {
      await api.put(`/delivery-orders/${detail.id}/confirm`, {})
      toast.success('Pengiriman dikonfirmasi diterima!')
      setDetailModal(false); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal konfirmasi') }
  }

  const printDO = () => {
    if (!detail) return
    const win = window.open('', '_blank')
    win.document.write(generatePrintHTML(detail))
    win.document.close()
    win.print()
  }

  const pendingCount = data.filter(d => d.status === 'pending').length

  return (
    <PageShell>
      <PageHeader icon={Truck} title="Surat Jalan" subtitle={`Delivery Order — dokumen pengiriman barang · ${getSelectedName()}`}
        onRefresh={load} onAdd={canCreate ? () => setModal(true) : undefined} addLabel="Buat Surat Jalan" />

      {/* Pending alert for Admin */}
      {isAdmin && pendingCount > 0 && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <Clock size={14} className="text-yellow-400" />
          <span className="text-yellow-400 text-sm font-medium">
            {pendingCount} Surat Jalan menunggu approval Anda
          </span>
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} onView={openDetail} emptyMessage="Belum ada surat jalan" />
      </div>

      {/* ── Detail Modal ── */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
            <Eye size={14} className="text-blue-400" />
          </div>
          <div>
            <div className="text-white font-bold">{detail?.ref_number}</div>
            <div className="text-slate-500 text-xs">Detail Surat Jalan</div>
          </div>
        </div>
      } size="lg">
        {detail && (
          <div className="space-y-4">
            {/* Status Banners */}
            {detail.status === 'pending' && (
              <div className="flex items-center gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-2.5">
                <Clock size={14} className="text-yellow-400" />
                <span className="text-yellow-400 text-sm font-medium">⏳ Menunggu approval Administrator</span>
              </div>
            )}
            {detail.status === 'cancelled' && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <XCircle size={14} className="text-red-400" />
                  <span className="text-red-400 text-sm font-medium">Surat Jalan ditolak</span>
                </div>
                {detail.reject_reason && (
                  <p className="text-red-400/70 text-xs mt-1 ml-6">Alasan: {detail.reject_reason}</p>
                )}
              </div>
            )}
            {detail.status === 'dispatched' && (
              <div className="flex items-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-2.5">
                <Truck size={14} className="text-blue-400" />
                <span className="text-blue-400 text-sm font-medium">🚚 Disetujui — Barang dalam pengiriman</span>
              </div>
            )}
            {detail.status === 'delivered' && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5">
                <CheckCircle size={14} className="text-emerald-400" />
                <span className="text-emerald-400 text-sm font-medium">✅ Pengiriman selesai — Barang sudah diterima</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Info Surat Jalan */}
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className="text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Info Surat Jalan</span>
                </div>
                <DR label="No. Surat Jalan" value={detail.ref_number} highlight />
                <DR label="Tanggal" value={detail.delivery_date ? new Date(detail.delivery_date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) : '—'} />
                <DR label="Tujuan" value={detail.destination || '—'} />
                <DR label="Status" value={<StatusBadge value={detail.status} />} />
              </div>

              {/* Gudang & Pelaku */}
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={14} className="text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Detail</span>
                </div>
                <DR label="Gudang Asal" value={detail.warehouse_name || '—'} />
                <DR label="Dibuat Oleh" value={detail.created_by_name || '—'} />
                {detail.approved_by_name && <DR label={detail.status === 'cancelled' ? 'Ditolak Oleh' : 'Disetujui Oleh'} value={detail.approved_by_name} />}
              </div>
            </div>

            {/* Items */}
            {detail.items && detail.items.length > 0 && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Package size={14} className="text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Daftar Barang</span>
                </div>
                <div className="space-y-1">
                  {detail.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1.5 border-b border-white/[0.04] last:border-0">
                      <div>
                        <span className="text-sm text-white">{item.item_name || '—'}</span>
                        <span className="text-xs text-slate-500 ml-2">{item.sku}</span>
                      </div>
                      <span className="text-sm font-semibold text-gold-400">{item.qty} pcs</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.notes && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="text-xs text-slate-500 mb-1">Catatan</p>
                <p className="text-sm text-slate-300">{detail.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between gap-3 pt-2">
              <button onClick={printDO}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] text-white hover:bg-white/[0.1] text-sm font-medium">
                <Printer size={15} /> Print
              </button>
              <div className="flex gap-3">
                {isAdmin && detail.status === 'pending' && (
                  <>
                    <button onClick={() => { setRejectReason(''); setRejectModal(true) }}
                      className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-medium text-sm transition-all flex items-center gap-2">
                      <XCircle size={14} /> Tolak
                    </button>
                    <button onClick={handleApprove}
                      className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-all flex items-center gap-2">
                      <CheckCircle size={14} /> Setujui Pengiriman
                    </button>
                  </>
                )}
                {detail.status === 'dispatched' && (
                  <button onClick={handleConfirmDelivered}
                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-all flex items-center gap-2">
                    <CheckCircle size={14} /> Konfirmasi Diterima
                  </button>
                )}
                {(!isAdmin || (detail.status !== 'pending')) && detail.status !== 'dispatched' && (
                  <button onClick={() => setDetailModal(false)} className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm">Tutup</button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Reject Modal ── */}
      <Modal open={rejectModal} onClose={() => setRejectModal(false)} title="Tolak Surat Jalan">
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5">
            <XCircle size={14} className="text-red-400" />
            <span className="text-red-400 text-sm font-medium">Surat Jalan {detail?.ref_number} akan ditolak</span>
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

      {/* ── Create Modal ── */}
      <Modal open={modal} onClose={() => setModal(false)} title="Buat Surat Jalan" size="lg">
        <div className="space-y-4">
          {/* Info banner */}
          <div className="flex items-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-2.5">
            <Clock size={14} className="text-blue-400" />
            <span className="text-blue-400 text-sm">Surat Jalan akan menunggu approval Administrator sebelum stok berkurang</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Gudang Asal" required>
              {!isAdmin && fromWarehouseOptions.length === 1 ? (
                <div className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm">
                  {fromWarehouseOptions[0].name} — {fromWarehouseOptions[0].city || ''}
                </div>
              ) : (
                <Select value={form.warehouse_id} onChange={e => { setForm({...form, warehouse_id: e.target.value}); setLines([{item_id:'',qty:1}]) }}>
                  <option value="">Pilih gudang asal</option>
                  {fromWarehouseOptions.map(w => <option key={w.id} value={w.id}>{w.name} — {w.city}</option>)}
                </Select>
              )}
            </FormField>
            <FormField label="Tanggal Pengiriman" required>
              <Input type="date" value={form.delivery_date} onChange={e => setForm({...form, delivery_date: e.target.value})} />
            </FormField>
          </div>

          <FormField label="Tujuan Pengiriman">
            <Input value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} placeholder="Alamat / nama tujuan pengiriman" />
          </FormField>

          <div className="border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Barang yang Dikirim
                {!form.warehouse_id && <span className="text-yellow-500 ml-2">— Pilih gudang asal dulu</span>}
              </span>
              <button onClick={addLine} className="text-blue-400 text-xs font-medium hover:text-blue-300">+ Tambah Item</button>
            </div>
            <div className="space-y-2">
              {lines.map((ln, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-7">
                    <Select value={ln.item_id} onChange={e => setLine(idx, 'item_id', e.target.value)}>
                      <option value="">Pilih item</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Input type="number" min="1" value={ln.qty} onChange={e => setLine(idx, 'qty', +e.target.value)} placeholder="Jumlah" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {lines.length > 1 && <button onClick={() => rmLine(idx)} className="text-red-400 hover:text-red-300">✕</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <FormField label="Catatan">
            <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-blue-500/50"
              placeholder="Catatan tambahan..." />
          </FormField>

          <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={submit} className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm">Request Surat Jalan</button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}

function generatePrintHTML(do_) {
  const itemRows = (do_.items || []).map(i =>
    `<tr><td>${i.item_name || i.name}</td><td style="text-align:center">${i.sku}</td><td style="text-align:center">${i.qty}</td><td></td></tr>`
  ).join('')

  return `<!DOCTYPE html><html><head>
    <meta charset="utf-8"><title>Surat Jalan ${do_.ref_number}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px; }
      .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
      .header h1 { font-size: 18px; font-weight: bold; }
      .header h2 { font-size: 14px; color: #333; }
      .doc-title { font-size: 14px; font-weight: bold; text-align: center; margin: 10px 0; border: 1px solid #000; padding: 5px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
      .info-box { border: 1px solid #ccc; padding: 8px; }
      .info-box h4 { font-size: 10px; color: #666; margin-bottom: 4px; text-transform: uppercase; }
      .info-box p { font-size: 12px; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; }
      th { background: #f0f0f0; border: 1px solid #ccc; padding: 6px 8px; font-size: 11px; }
      td { border: 1px solid #ccc; padding: 6px 8px; font-size: 11px; }
      .sign-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 40px; text-align: center; }
      .sign-box { border-top: 1px solid #000; padding-top: 5px; margin-top: 60px; }
      @media print { body { padding: 10px; } }
    </style>
  </head><body>
    <div class="header">
      <h1>PT. LUTFHI ENTERPRISES</h1>
      <h2>Warehouse Management System</h2>
    </div>
    <div class="doc-title">SURAT JALAN / DELIVERY ORDER</div>
    <div class="info-grid">
      <div class="info-box">
        <h4>No. Surat Jalan</h4><p>${do_.ref_number}</p>
        <h4 style="margin-top:6px">Tanggal Pengiriman</h4><p>${do_.delivery_date}</p>
        <h4 style="margin-top:6px">Status</h4><p>${do_.status?.toUpperCase()}</p>
        <h4 style="margin-top:6px">Gudang</h4><p>${do_.warehouse_name || '—'}</p>
      </div>
      <div class="info-box">
        <h4>Tujuan Pengiriman</h4>
        <p>${do_.destination || '—'}</p>
        <h4 style="margin-top:6px">Dibuat Oleh</h4>
        <p>${do_.created_by_name || '—'}</p>
        ${do_.approved_by_name ? `<h4 style="margin-top:6px">Disetujui Oleh</h4><p>${do_.approved_by_name}</p>` : ''}
      </div>
    </div>
    <table>
      <thead><tr><th>Nama Barang</th><th style="text-align:center">SKU</th><th style="text-align:center">Qty</th><th>Kondisi</th></tr></thead>
      <tbody>${itemRows || '<tr><td colspan="4" style="text-align:center;color:#999">Tidak ada item</td></tr>'}</tbody>
    </table>
    <div class="sign-row">
      <div><div class="sign-box">Pengirim<br>${do_.created_by_name || ''}</div></div>
      <div><div class="sign-box">Mengetahui<br>${do_.approved_by_name || '___________'}</div></div>
      <div><div class="sign-box">Penerima<br>___________</div></div>
    </div>
    <p style="margin-top:30px;font-size:10px;color:#666;text-align:center">Dokumen ini dicetak oleh sistem WMS LUTFHI pada ${new Date().toLocaleString('id-ID')}</p>
  </body></html>`
}
