import { useState, useEffect } from 'react'
import { Truck, MapPin, CheckCircle, Plus, Printer } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell, PageHeader, DataTable, StatusBadge, Modal, FormField, Input, Select } from '@/components/ui'

const STATUS_MAP = { pending: 'warning', dispatched: 'info', delivered: 'success', cancelled: 'danger' }

const COLS = [
  { key: 'ref_number', label: 'No. Surat Jalan', render: v => <span className="text-blue-400 font-mono text-sm">{v}</span> },
  { key: 'delivery_date', label: 'Tanggal', render: v => v ? new Date(v).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '—' },
  { key: 'destination', label: 'Tujuan', render: v => <span className="text-slate-300 truncate max-w-xs block">{v || '—'}</span> },
  { key: 'warehouse_name', label: 'Gudang' },
  { key: 'created_by_name', label: 'Dibuat Oleh' },
  { key: 'status', label: 'Status', render: v => <StatusBadge value={v} /> },
]

export default function DeliveryOrderPage() {
  const [data, setData]       = useState([])
  const [outbounds, setOutbounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [detail, setDetail]   = useState(null)
  const [form, setForm]       = useState({
    outbound_id: '', recipient_name: '', recipient_address: '',
    recipient_phone: '', delivery_date: '', driver: '', vehicle: '', notes: ''
  })

  const load = async () => {
    setLoading(true)
    try {
      const [dos, out] = await Promise.all([
        api.get('/delivery-orders'),
        api.get('/outbound'),
      ])
      setData((dos.data || dos) || [])
      setOutbounds((out.data || out) || [])
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const submit = async () => {
    if (!form.recipient_name.trim()) { toast.error('Nama penerima wajib diisi'); return }
    try {
      const res = await api.post('/delivery-orders', form)
      toast.success(`Surat Jalan ${res.do_number} berhasil dibuat!`)
      setModal(false); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal') }
  }

  const openDetail = async (row) => {
    try {
      const res = await api.get(`/delivery-orders/${row.id}`)
      setDetail(res.data || res)
      setDetailModal(true)
    } catch { toast.error('Gagal memuat detail') }
  }

  const confirmDelivery = async (id) => {
    const receivedBy = prompt('Nama penerima barang:')
    if (!receivedBy) return
    await api.put(`/delivery-orders/${id}/confirm`, { received_by: receivedBy })
    toast.success('Pengiriman dikonfirmasi selesai!')
    setDetailModal(false); load()
  }

  const printDO = () => {
    if (!detail) return
    const win = window.open('', '_blank')
    win.document.write(generatePrintHTML(detail))
    win.document.close()
    win.print()
  }

  const COLS_WITH_ACTION = [
    ...COLS,
    { key: 'id', label: 'Aksi', render: (id, row) => (
      <button onClick={() => openDetail(row)}
        className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs font-medium">
        Detail & Print
      </button>
    )},
  ]

  return (
    <PageShell>
      <PageHeader icon={Truck} title="Surat Jalan" subtitle="Delivery Order — dokumen pengiriman barang"
        onRefresh={load} onAdd={() => setModal(true)} addLabel="Buat Surat Jalan" />

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS_WITH_ACTION} data={data} loading={loading} emptyMessage="Belum ada surat jalan" />
      </div>

      {/* Buat DO Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Buat Surat Jalan" size="lg">
        <div className="space-y-4">
          <FormField label="Dari Outbound (opsional)">
            <Select value={form.outbound_id} onChange={e => setForm({...form, outbound_id: e.target.value})}>
              <option value="">Tanpa outbound (standalone)</option>
              {outbounds.map(o => <option key={o.id} value={o.id}>{o.ref_number} — {o.transaction_date}</option>)}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nama Penerima" required>
              <Input value={form.recipient_name} onChange={e => setForm({...form, recipient_name: e.target.value})} placeholder="Nama penerima / perusahaan" />
            </FormField>
            <FormField label="No. Telepon Penerima">
              <Input value={form.recipient_phone} onChange={e => setForm({...form, recipient_phone: e.target.value})} placeholder="+62 8xx..." />
            </FormField>
          </div>
          <FormField label="Alamat Pengiriman">
            <textarea value={form.recipient_address} onChange={e => setForm({...form, recipient_address: e.target.value})}
              rows={2} placeholder="Alamat lengkap tujuan pengiriman"
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-blue-500/50" />
          </FormField>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Tanggal Pengiriman">
              <Input type="date" value={form.delivery_date} onChange={e => setForm({...form, delivery_date: e.target.value})} />
            </FormField>
            <FormField label="Nama Driver">
              <Input value={form.driver} onChange={e => setForm({...form, driver: e.target.value})} placeholder="Budi Santoso" />
            </FormField>
            <FormField label="Kendaraan">
              <Input value={form.vehicle} onChange={e => setForm({...form, vehicle: e.target.value})} placeholder="B 1234 XYZ" />
            </FormField>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={submit} className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm">Buat Surat Jalan</button>
          </div>
        </div>
      </Modal>

      {/* Detail + Print Modal */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title="Detail Surat Jalan" size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { l: 'No. Surat Jalan', v: detail.do_number, cls: 'text-blue-400 font-mono' },
                { l: 'Status', v: <StatusBadge status={detail.status} colorMap={STATUS_MAP} /> },
                { l: 'Tanggal Kirim', v: detail.delivery_date },
                { l: 'Driver', v: detail.driver || '—' },
                { l: 'Kendaraan', v: detail.vehicle || '—' },
                { l: 'Dibuat Oleh', v: detail.created_by },
              ].map(f => (
                <div key={f.l} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-slate-500 text-xs mb-1">{f.l}</p>
                  <div className={`text-sm font-medium ${f.cls || 'text-white'}`}>{f.v}</div>
                </div>
              ))}
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-slate-500 text-xs mb-1">Penerima</p>
              <p className="text-white font-semibold">{detail.recipient_name}</p>
              <p className="text-slate-400 text-sm">{detail.recipient_address}</p>
              <p className="text-slate-400 text-sm">{detail.recipient_phone}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <div className="bg-white/[0.03] px-4 py-2 text-xs font-semibold text-slate-400 uppercase">Daftar Barang</div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-2 text-left text-slate-500">Nama</th>
                  <th className="px-4 py-2 text-left text-slate-500">SKU</th>
                  <th className="px-4 py-2 text-right text-slate-500">Qty</th>
                </tr></thead>
                <tbody>
                  {(detail.items || []).map(i => (
                    <tr key={i.id} className="border-b border-white/[0.04]">
                      <td className="px-4 py-2 text-white">{i.name}</td>
                      <td className="px-4 py-2 text-slate-400 font-mono text-xs">{i.sku}</td>
                      <td className="px-4 py-2 text-right text-white font-semibold">{i.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3 pt-2 border-t border-white/[0.06]">
              <button onClick={printDO}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] text-white hover:bg-white/[0.1] text-sm font-medium">
                <Printer size={15} /> Print Surat Jalan
              </button>
              {detail.status === 'pending' && (
                <button onClick={() => confirmDelivery(detail.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold">
                  <CheckCircle size={15} /> Konfirmasi Diterima
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </PageShell>
  )
}

function generatePrintHTML(do_) {
  const itemRows = (do_.items || []).map(i =>
    `<tr><td>${i.name}</td><td style="text-align:center">${i.sku}</td><td style="text-align:center">${i.qty}</td><td></td></tr>`
  ).join('')

  return `<!DOCTYPE html><html><head>
    <meta charset="utf-8"><title>Surat Jalan ${do_.do_number}</title>
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
        <h4>No. Surat Jalan</h4><p>${do_.do_number}</p>
        <h4 style="margin-top:6px">Tanggal Pengiriman</h4><p>${do_.delivery_date}</p>
        <h4 style="margin-top:6px">Driver</h4><p>${do_.driver || '—'}</p>
        <h4 style="margin-top:6px">Kendaraan</h4><p>${do_.vehicle || '—'}</p>
      </div>
      <div class="info-box">
        <h4>Tujuan Pengiriman</h4>
        <p>${do_.recipient_name}</p>
        <p style="font-weight:normal;margin-top:4px">${do_.recipient_address || ''}</p>
        <p style="font-weight:normal">${do_.recipient_phone || ''}</p>
      </div>
    </div>
    <table>
      <thead><tr><th>Nama Barang</th><th style="text-align:center">SKU</th><th style="text-align:center">Qty</th><th>Kondisi</th></tr></thead>
      <tbody>${itemRows || '<tr><td colspan="4" style="text-align:center;color:#999">Tidak ada item</td></tr>'}</tbody>
    </table>
    <div class="sign-row">
      <div><div class="sign-box">Pengirim<br>${do_.created_by || ''}</div></div>
      <div><div class="sign-box">Driver<br>${do_.driver || '___________'}</div></div>
      <div><div class="sign-box">Penerima<br>${do_.recipient_name}</div></div>
    </div>
    <p style="margin-top:30px;font-size:10px;color:#666;text-align:center">Dokumen ini dicetak oleh sistem WMS LUTFHI pada ${new Date().toLocaleString('id-ID')}</p>
  </body></html>`
}
