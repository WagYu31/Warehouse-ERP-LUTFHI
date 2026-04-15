import { useState, useEffect } from 'react'
import { FileText, CreditCard, History } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell, PageHeader, SearchBar, DataTable, StatusBadge, Modal, FormField, Input, Select } from '@/components/ui'

const fmt = n => 'Rp ' + Number(n||0).toLocaleString('id-ID')
const STATUS_COLOR = { paid: 'success', unpaid: 'warning', overdue: 'danger', partial: 'info' }

const COLS = [
  { key: 'invoice_number', label: 'No. Invoice', render: v => <span className="text-emerald-400 font-mono text-sm">{v}</span> },
  { key: 'due_date',  label: 'Jatuh Tempo', render: v => v || '—' },
  { key: 'total',     label: 'Total', render: v => <span className="text-white font-semibold">{fmt(v)}</span> },
  { key: 'status',    label: 'Status', render: v => <StatusBadge status={v} colorMap={STATUS_COLOR} /> },
]

export default function InvoicePage() {
  const [data, setData]     = useState([])
  const [pos, setPOs]       = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(false)
  const [payModal, setPayModal] = useState(false)
  const [histModal, setHistModal] = useState(false)
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
      toast.success(`Pembayaran ${fmt(+payForm.amount)} berhasil dicatat! Status: ${res.new_status}`)
      setPayModal(false)
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

  // Extended columns dengan action buttons
  const COLS_WITH_ACTION = [
    ...COLS,
    { key: 'id', label: 'Aksi', render: (id, row) => (
      <div className="flex gap-1">
        {row.status !== 'paid' && (
          <button onClick={() => openPayModal(row)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium">
            <CreditCard size={11} /> Bayar
          </button>
        )}
        <button onClick={() => openHistory(row)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.06] text-slate-400 hover:text-white text-xs">
          <History size={11} /> Riwayat
        </button>
      </div>
    )},
  ]

  return (
    <PageShell>
      <PageHeader icon={FileText} title="Invoice" subtitle="Kelola tagihan dari supplier" onRefresh={load} onAdd={() => setModal(true)} addLabel="Buat Invoice" />
      <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Cari no. invoice..." /></div>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <DataTable columns={COLS_WITH_ACTION} data={data} loading={loading} emptyMessage="Belum ada invoice" />
      </div>

      {/* Buat Invoice Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Buat Invoice Baru">
        <div className="space-y-4">
          <FormField label="No. Invoice" required><Input value={form.invoice_number} onChange={e => setForm({...form, invoice_number:e.target.value})} placeholder="INV-2026-001" /></FormField>
          <FormField label="Purchase Order"><Select value={form.po_id} onChange={e => setForm({...form, po_id:e.target.value})}>
            <option value="">Pilih PO (opsional)</option>
            {pos.map(p => <option key={p.id} value={p.id}>{p.po_number}</option>)}
          </Select></FormField>
          <FormField label="Supplier"><Select value={form.supplier_id} onChange={e => setForm({...form, supplier_id:e.target.value})}>
            <option value="">Pilih supplier</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tgl. Invoice"><Input type="date" value={form.invoice_date} onChange={e => setForm({...form, invoice_date:e.target.value})} /></FormField>
            <FormField label="Jatuh Tempo"><Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date:e.target.value})} /></FormField>
          </div>
          <FormField label="Total (Rp)"><Input type="number" value={form.total_amount} onChange={e => setForm({...form, total_amount:+e.target.value})} /></FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-400 text-sm">Batal</button>
            <button onClick={submit} className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm">Simpan</button>
          </div>
        </div>
      </Modal>

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
                <span className="text-white font-semibold">{fmt(selectedInv.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Status</span>
                <StatusBadge status={selectedInv.status} colorMap={STATUS_COLOR} />
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
      <Modal open={histModal} onClose={() => setHistModal(false)} title="Riwayat Pembayaran">
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
                    <span>{p.payment_method}</span>
                    <span>oleh {p.paid_by || '—'}</span>
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
