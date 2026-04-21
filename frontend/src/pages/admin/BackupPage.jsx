import { useState, useEffect } from 'react'
import { Database, Download, HardDrive, RefreshCw, Shield, Clock, FileText } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { PageShell, PageHeader } from '@/components/ui'

export default function BackupPage() {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const token = useAuthStore((s) => s.token)

  const loadInfo = async () => {
    setLoading(true)
    try {
      const res = await api.get('/backup/info')
      setInfo(res?.data || res)
    } catch (e) {
      toast.error('Gagal memuat info backup')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadInfo() }, [])

  const downloadBackup = async () => {
    setDownloading(true)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || '/api'}/backup/csv`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) throw new Error('Download gagal')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `WMS_LUTFHI_Backup_${new Date().toISOString().slice(0,10)}.zip`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Backup berhasil diunduh!')
    } catch (e) {
      toast.error('Gagal mengunduh backup: ' + e.message)
    } finally {
      setDownloading(false)
    }
  }

  const tables = info?.tables || {}
  const totalRecords = info?.total_records || 0

  const tableIcons = {
    items: '📦', inbound_transactions: '⬇️', outbound_transactions: '⬆️',
    purchase_orders: '🛒', invoices: '📄', suppliers: '🏢',
    warehouses: '🏭', stock_opname: '🔄', stock_transfers: '↔️',
    delivery_orders: '🚚', returns: '🔙', requests: '📋',
    budgets: '💰', users: '👤', categories: '🏷️', units: '📐', departments: '🏛️',
  }

  const tableLabels = {
    items: 'Item / Inventaris', inbound_transactions: 'Barang Masuk',
    outbound_transactions: 'Barang Keluar', purchase_orders: 'Purchase Order',
    invoices: 'Invoice', suppliers: 'Supplier', warehouses: 'Gudang',
    stock_opname: 'Stock Opname', stock_transfers: 'Transfer Stok',
    delivery_orders: 'Surat Jalan', returns: 'Retur', requests: 'Permintaan (SPB)',
    budgets: 'Budget', users: 'Pengguna', categories: 'Kategori',
    units: 'Satuan', departments: 'Departemen',
  }

  return (
    <PageShell>
      <PageHeader icon={Database} title="Backup Data" subtitle="Unduh semua data sistem WMS" onRefresh={loadInfo} />

      {/* Main Action Card */}
      <div className="rounded-2xl border border-gold-500/20 bg-gradient-to-br from-gold-500/[0.08] to-transparent p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gold-500/15 border border-gold-500/20 flex items-center justify-center shrink-0">
            <HardDrive size={26} className="text-gold-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg mb-1">Export Semua Data (CSV)</h3>
            <p className="text-slate-400 text-sm mb-4">
              Download file ZIP berisi semua tabel database dalam format CSV. 
              File bisa dibuka di Excel, Google Sheets, atau diimport ke sistem lain.
            </p>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <FileText size={14} className="text-slate-500" />
                <span className="text-slate-300">{Object.keys(tables).length} tabel</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Database size={14} className="text-slate-500" />
                <span className="text-slate-300">{totalRecords.toLocaleString()} record</span>
              </div>
              {info?.server_time && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={14} className="text-slate-500" />
                  <span className="text-slate-300">{info.server_time}</span>
                </div>
              )}
            </div>
            <button
              onClick={downloadBackup}
              disabled={downloading || loading}
              className="px-6 py-3 rounded-xl bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-bold text-sm flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-gold-500/20"
            >
              {downloading ? (
                <><RefreshCw size={16} className="animate-spin" /> Mengunduh...</>
              ) : (
                <><Download size={16} /> Download Backup (ZIP)</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/15 p-4 mb-6">
        <Shield size={18} className="text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-red-300 font-semibold text-sm">Peringatan Keamanan</p>
          <p className="text-red-400/70 text-xs mt-1">File backup berisi data sensitif. Simpan di tempat aman dan jangan bagikan ke pihak tidak berwenang. Password pengguna TIDAK termasuk dalam backup.</p>
        </div>
      </div>

      {/* Table Breakdown */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <h3 className="text-white font-semibold mb-4">Detail Tabel yang Di-backup</h3>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={20} className="animate-spin text-gold-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(tables).map(([table, count]) => (
              <div key={table} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 hover:border-gold-500/20 transition-colors">
                <span className="text-xl">{tableIcons[table] || '📁'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{tableLabels[table] || table}</p>
                  <p className="text-slate-500 text-xs">{table}.csv</p>
                </div>
                <span className="text-gold-400 font-bold text-sm">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}
