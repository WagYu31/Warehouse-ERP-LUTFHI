/**
 * Reusable halaman CRUD Premium
 * Props: title, subtitle, icon, columns, fetchFn, createFn, deleteFn, filterFields, formFields
 */
import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, Download, Upload, RefreshCcw, Trash2, Edit, Eye, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Badge Status ─────────────────────────────────────────────
export function StatusBadge({ value, status, colorMap }) {
  const v = status ?? value  // support both props
  const defaultMap = {
    normal:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    kritis:    'text-red-400 bg-red-500/10 border-red-500/20',
    kosong:    'text-orange-400 bg-orange-500/10 border-orange-500/20',
    confirmed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    pending:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    approved:  'text-blue-400 bg-blue-500/10 border-blue-500/20',
    rejected:  'text-red-400 bg-red-500/10 border-red-500/20',
    draft:     'text-slate-400 bg-slate-500/10 border-slate-500/20',
    sent:      'text-blue-400 bg-blue-500/10 border-blue-500/20',
    complete:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    cancelled: 'text-red-400 bg-red-500/10 border-red-500/20',
    partial:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
    received:  'text-purple-400 bg-purple-500/10 border-purple-500/20',
    dispatched:'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    delivered: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    active:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    inactive:  'text-slate-400 bg-slate-500/10 border-slate-500/20',
    paid:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    unpaid:    'text-red-400 bg-red-500/10 border-red-500/20',
    overdue:   'text-orange-400 bg-orange-500/10 border-orange-500/20',
    info:      'text-blue-400 bg-blue-500/10 border-blue-500/20',
    success:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    warning:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    danger:    'text-red-400 bg-red-500/10 border-red-500/20',
    high:      'text-red-400 bg-red-500/10 border-red-500/20',
    low:       'text-slate-400 bg-slate-500/10 border-slate-500/20',
    in_progress: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    completed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  }

  // If colorMap provided, resolve color name → CSS class
  let cls
  if (colorMap && colorMap[v]) {
    const colorKey = colorMap[v]
    cls = defaultMap[colorKey] || defaultMap[v] || 'text-slate-400 bg-slate-500/10 border-slate-500/20'
  } else {
    cls = defaultMap[v] || 'text-slate-400 bg-slate-500/10 border-slate-500/20'
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {v}
    </span>
  )
}

// ─── Page Header ──────────────────────────────────────────────
export function PageHeader({ icon: Icon, title, subtitle, onRefresh, onAdd, onExport, addLabel = 'Tambah' }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2.5 rounded-xl bg-gold-500/15 border border-gold-500/25">
            <Icon size={20} className="text-gold-400" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-display font-bold text-white">{title}</h1>
          {subtitle && <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onExport && (
          <button onClick={onExport}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white hover:border-white/[0.15] transition-all text-sm">
            <Download size={15} /> Export
          </button>
        )}
        {onRefresh && (
          <button onClick={onRefresh}
            className="p-2 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white transition-all">
            <RefreshCcw size={15} />
          </button>
        )}
        {onAdd && (
          <button onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold text-sm transition-all shadow-glow-gold">
            <Plus size={15} /> {addLabel}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Search Bar ───────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = 'Cari...' }) {
  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 text-sm
                   focus:outline-none focus:border-gold-500/50 focus:bg-white/[0.06] transition-all"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
          <X size={13} />
        </button>
      )}
    </div>
  )
}

// ─── Data Table ───────────────────────────────────────────────
export function DataTable({ columns, data, loading, onView, onEdit, onDelete, emptyMessage = 'Tidak ada data' }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />
        ))}
      </div>
    )
  }
  if (!data?.length) {
    return (
      <div className="text-center py-16 text-slate-500">
        <div className="text-4xl mb-3">📭</div>
        <div className="text-sm">{emptyMessage}</div>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full min-w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {columns.map(col => (
              <th key={col.key} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3 px-2 whitespace-nowrap">
                {col.label}
              </th>
            ))}
            {(onView || onEdit || onDelete) && <th className="pb-3 px-2" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {data.map((row, i) => (
            <tr key={row.id || i} className="hover:bg-white/[0.02] transition-colors group">
              {columns.map(col => (
                <td key={col.key} className="py-3.5 px-2 text-sm">
                  {col.render ? col.render(row[col.key], row) : (
                    <span className="text-slate-300">{row[col.key] ?? '—'}</span>
                  )}
                </td>
              ))}
              {(onView || onEdit || onDelete) && (
                <td className="py-3.5 px-2">
                  <div className="flex items-center gap-1 justify-end">
                    {onView && (
                      <button onClick={() => onView(row)}
                        className="p-1.5 rounded-lg text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all" title="Lihat Detail">
                        <Eye size={14} />
                      </button>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onEdit && (
                        <button onClick={() => onEdit(row)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                          <Edit size={14} />
                        </button>
                      )}
                      {onDelete && (
                        <button onClick={() => onDelete(row)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} bg-[#111827] border border-white/[0.08] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08]">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ─── Form Field ───────────────────────────────────────────────
export function FormField({ label, required, children, error }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}

export function Input({ ...props }) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 text-sm
                 focus:outline-none focus:border-gold-500/50 focus:bg-white/[0.06] transition-all"
    />
  )
}

export function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className="w-full px-3 py-2.5 rounded-xl bg-[#1a2235] border border-white/[0.08] text-white text-sm
                 focus:outline-none focus:border-gold-500/50 transition-all"
    >
      {children}
    </select>
  )
}

export function Textarea({ ...props }) {
  return (
    <textarea
      {...props}
      rows={3}
      className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600 text-sm
                 focus:outline-none focus:border-gold-500/50 transition-all resize-none"
    />
  )
}

// ─── Pagination ───────────────────────────────────────────────
export function Pagination({ page, total, perPage = 20, onChange }) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-slate-500 text-xs">{total} data, halaman {page} dari {totalPages}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg text-slate-400 disabled:opacity-30 hover:text-white hover:bg-white/[0.06] disabled:hover:bg-transparent transition-all"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg text-slate-400 disabled:opacity-30 hover:text-white hover:bg-white/[0.06] disabled:hover:bg-transparent transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ─── Page Shell (generic CRUD container) ──────────────────────
export function PageShell({ children, className = '' }) {
  return (
    <div className={`p-6 lg:p-8 min-h-full ${className}`}>
      {children}
    </div>
  )
}
