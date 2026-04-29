import { useState, useEffect } from 'react'
import { FileText, CreditCard, History, Printer, Eye, Zap } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { PageShell, PageHeader, SearchBar, DataTable, StatusBadge, Modal, FormField, Input, Select } from '@/components/ui'
import { printInvoice } from '@/utils/printUtils'

const MIDTRANS_CLIENT_KEY = import.meta.env.VITE_MIDTRANS_CLIENT_KEY || ''
const MIDTRANS_SNAP_URL   = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true'
  ? 'https://app.midtrans.com/snap/snap.js'
  : 'https://app.sandbox.midtrans.com/snap/snap.js'

function loadSnapScript() {
  return new Promise((resolve, reject) => {
    if (window.snap) { resolve(); return }
    const existing = document.getElementById('midtrans-snap')
    if (existing) { existing.onload = resolve; return }
    const script = document.createElement('script')
    script.id  = 'midtrans-snap'
    script.src = MIDTRANS_SNAP_URL
    script.setAttribute('data-client-key', MIDTRANS_CLIENT_KEY)
    script.onload  = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

const fmt = n => 'Rp ' + Number(n||0).toLocaleString('id-ID')

const COLS = [
  { key: 'invoice_number', label: 'No. Invoice', render: v => <span className="text-emerald-400 font-mono text-sm">{v}</span> },
  { key: 'supplier_name', label: 'Supplier', render: v => v || '—' },
  { key: 'due_date',  label: 'Jatuh Tempo', render: v => v ? new Date(v).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '—' },
  { key: 'total_amount', label: 'Total', render: v => <span className="text-white font-semibold">{fmt(v)}</span> },
  { key: 'amount_paid', label: 'Dibayar', render: v => <span className="text-emerald-400">{fmt(v)}</span> },
  { key: 'status', label: 'Status', render: v => <StatusBadge value={v} /> },
]

function DR({ label, value }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-white/[0.05] last:border-0">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className="text-sm font-medium text-white text-right max-w-[60%]">{value ?? '—'}</span>
    </div>
  )
}

export default function InvoicePage() {
  const { user } = useAuthStore()
  const canCreate = ['admin', 'finance_procurement'].includes(user?.role)
  const canPay    = ['admin', 'finance_procurement'].includes(user?.role)
  const [data, setData]     = useState([])
  const [pos, setPOs]       = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(false)
  const [payModal, setPayModal] = useState(false)
  const [histModal, setHistModal] = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [selectedInv, setSelectedInv] = useState(null)
  const [payHistory, setPayHistory] = useState([])
  const [form, setForm]     = useState({ invoice_number:'', po_id:'', supplier_id:'', invoice_date:'', due_date:'', total_amount:0 })
  const [payForm, setPayForm] = useState({ amount:'', payment_date:'', payment_method:'transfer', notes:'' })

  const load = async () => {
    setLoading(true)
    try {
      const [inv, po, s] = await Promise.all([
        api.get('/erp/invoices'),
        api.get('/erp/purchase-orders'),
        api.get('/suppliers'),
      ])
      const invData = Array.isArray(inv) ? inv : (inv.data || [])
      let d = invData
      if (search) d = d.filter(r => r.invoice_number?.toLowerCase().includes(search.toLowerCase()))
      setData(d)
      setPOs(Array.isArray(po) ? po : (po.data || []))
      setSuppliers(Array.isArray(s) ? s : (s.data || []))
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [search])

  const submit = async () => {
    try {
      await api.post('/erp/invoices', form)
      toast.success('Invoice dibuat'); setModal(false); load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal') }
  }

  const openPayModal = (inv) => {
    setSelectedInv(inv)
    setPayForm({ amount: '', payment_date: new Date().toISOString().slice(0,10), payment_method: 'transfer', notes: '' })
    setPayModal(true)
  }

  const submitPayment = async () => {
    if (!payForm.amount || +payForm.amount <= 0) { toast.error('Masukkan jumlah bayar'); return }
    try {
      const res = await api.post(`/erp/invoices/${selectedInv.id}/payment`, {
        amount: +payForm.amount,
        payment_date: payForm.payment_date,
        payment_method: payForm.payment_method,
        notes: payForm.notes,
      })
      toast.success(`Pembayaran ${fmt(+payForm.amount)} berhasil! Status: ${res.new_status || res.status}`)
      setPayModal(false); setDetailModal(false)
      load()
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal catat pembayaran') }
  }

  const openHistory = async (inv) => {
    setSelectedInv(inv)
    try {
      const res = await api.get(`/erp/invoices/${inv.id}/payments`)
      setPayHistory(res.data || [])
      setHistModal(true)
    } catch { toast.error('Gagal memuat riwayat') }
  }

  const openView = (row) => { setSelectedInv(row); setDetailModal(true) }

  const payWithMidtrans = async (inv) => {
    if (!inv) return
    try {
      toast.loading('Mempersiapkan pembayaran...', { id: 'snap' })
      await loadSnapScript()
      const res = await api.post(`/erp/invoices/${inv.id}/snap-token`, {})
      toast.dismiss('snap')
      const { token } = res
      window.snap.pay(token, {
        onSuccess: (result) => {
          toast.success('✅ Pembayaran berhasil! Invoice akan diperbarui otomatis.')
          setDetailModal(false)
          setTimeout(() => load(), 2000)
        },
        onPending: (result) => {
          toast('⏳ Pembayaran pending, tunggu konfirmasi.')
          setTimeout(() => load(), 2000)
        },
        onError: (result) => {
          toast.error('❌ Pembayaran gagal: ' + (result.status_message || 'Unknown error'))
        },
        onClose: () => {
          toast('Popup pembayaran ditutup.')
        }
      })
    } catch (e) {
      toast.dismiss('snap')
      toast.error(e?.response?.data?.message || 'Gagal memulai pembayaran')
    }
  }

  const sisa = selectedInv ? (+(selectedInv.total_amount||0) - +(selectedInv.amount_paid||0)) : 0

  return (
    <PageShell>
      <PageHeader icon={FileText} title="Invoice" subtitle="Kelola tagihan dari supplier — otomatis dibuat saat PO di-approve" onRefresh={load} />
      <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Cari no. invoice..." /></div>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS} data={data} loading={loading} onView={openView} emptyMessage="Belum ada invoice" />
      </div>

      {/* Detail Modal */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
            <Eye size={14} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-white font-bold">{selectedInv?.invoice_number}</div>
            <div className="text-slate-500 text-xs">Invoice / Tagihan</div>
          </div>
        </div>
      }>
        {selectedInv && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">Info Invoice</p>
                <DR label="No. Invoice" value={<span className="text-emerald-400 font-mono">{selectedInv.invoice_number}</span>} />
                <DR label="Supplier" value={selectedInv.supplier_name || '—'} />
                <DR label="Jatuh Tempo" value={selectedInv.due_date ? new Date(selectedInv.due_date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) : '—'} />
                <DR label="Status" value={<StatusBadge value={selectedInv.status} />} />
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">Pembayaran</p>
                <DR label="Total Tagihan" value={<span className="text-white font-bold">{fmt(selectedInv.total_amount)}</span>} />
                <DR label="Dibayar" value={<span className="text-emerald-400 font-bold">{fmt(selectedInv.amount_paid)}</span>} />
                <DR label="Sisa" value={<span className={`font-bold ${sisa > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(sisa)}</span>} />
              </div>
            </div>

            {/* Progress bar pembayaran */}
            {(selectedInv.total_amount > 0) && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span>Progress Pembayaran</span>
                  <span>{Math.round((selectedInv.amount_paid / selectedInv.total_amount) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (selectedInv.amount_paid / selectedInv.total_amount) * 100)}%` }} />
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
              {canPay && selectedInv.status !== 'paid' && (
                <>
                  <button onClick={() => payWithMidtrans(selectedInv)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/25 text-orange-400 hover:bg-orange-500/20 text-sm font-semibold">
                    <Zap size={14} /> Bayar via Midtrans
                  </button>
                  <button onClick={() => openPayModal(selectedInv)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-sm font-medium">
                    <CreditCard size={14} /> Catat Manual
                  </button>
                </>
              )}
              <button onClick={() => openHistory(selectedInv)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] text-sm font-medium">
                <History size={14} /> Riwayat
              </button>
              <button onClick={() => printInvoice(selectedInv)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 text-sm font-medium">
                <Printer size={14} /> Print
              </button>
              <button onClick={() => setDetailModal(false)}
                className="ml-auto px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm">
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Info: Invoice otomatis dibuat */}

      {/* Catat Pembayaran Modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Catat Pembayaran Invoice">
        {selectedInv && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">Invoice</span>
                <span className="text-emerald-400 font-mono">{selectedInv.invoice_number}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">Total</span>
                <span className="text-white font-semibold">{fmt(selectedInv.total_amount)}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">Sudah Dibayar</span>
                <span className="text-emerald-400">{fmt(selectedInv.amount_paid)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Sisa Tagihan</span>
                <span className="text-red-400 font-bold">{fmt(sisa)}</span>
              </div>
            </div>

            <FormField label="Jumlah Bayar (Rp)" required>
              <Input type="number" placeholder="0" value={payForm.amount}
                onChange={e => setPayForm({...payForm, amount: e.target.value})} />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tanggal Bayar">
                <Input type="date" value={payForm.payment_date} onChange={e => setPayForm({...payForm, payment_date: e.target.value})} />
              </FormField>
              <FormField label="Metode">
                <Select value={payForm.payment_method} onChange={e => setPayForm({...payForm, payment_method: e.target.value})}>
                  <option value="transfer">Transfer Bank</option>
                  <option value="cash">Tunai</option>
                  <option value="giro">Giro</option>
                  <option value="check">Cek</option>
                </Select>
              </FormField>
            </div>

            <FormField label="Catatan">
              <input value={payForm.notes} onChange={e => setPayForm({...payForm, notes: e.target.value})}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-emerald-500/50"
                placeholder="Referensi transfer, nomor rekening, dll..." />
            </FormField>

            <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
              <button onClick={() => setPayModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
              <button onClick={submitPayment} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm">
                <CreditCard size={14} /> Catat Pembayaran
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Riwayat Pembayaran Modal */}
      <Modal open={histModal} onClose={() => setHistModal(false)} title={`Riwayat Pembayaran — ${selectedInv?.invoice_number || ''}`}>
        <div>
          {payHistory.length === 0 ? (
            <div className="py-8 text-center text-slate-500">Belum ada pembayaran</div>
          ) : (
            <div className="space-y-3">
              {payHistory.map(p => (
                <div key={p.id} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <div className="flex justify-between font-semibold mb-1">
                    <span className="text-emerald-400">{fmt(p.amount)}</span>
                    <span className="text-slate-400 text-xs">{p.payment_date}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span className="capitalize">{p.payment_method}</span>
                    <span>oleh {p.recorded_by_name || p.paid_by || '—'}</span>
                  </div>
                  {p.notes && <p className="text-xs text-slate-500 mt-1 italic">{p.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </PageShell>
  )
}
