import { useState, useEffect } from 'react'
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { useWarehouseStore } from '@/store/warehouseStore'
import {
  LayoutDashboard, Package, ArrowDownCircle, ArrowUpCircle,
  ClipboardList, Search, ShoppingCart, Truck, FileText,
  PiggyBank, RefreshCcw, BarChart3, Building2, Users,
  LogOut, ChevronDown, ChevronRight, Menu, X, Bell, Settings,
  ArrowLeftRight, Database, User, Send, RotateCcw, BarChart2,
  Sun, Moon, HardDrive
} from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import AIChatbot from '@/components/AIChatbot'

const NAV = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: '/dashboard',
    exact: true,
  },
  {
    label: 'Manajemen Gudang',
    icon: Package,
    roles: ['admin', 'staff'],
    children: [
      { label: 'Inventaris Stok',    icon: Search,         to: '/inventory',        roles: ['admin','staff'] },
      { label: 'Barang Masuk (GRN)', icon: ArrowDownCircle,to: '/inbound',          roles: ['admin','staff'] },
      { label: 'Barang Keluar',      icon: ArrowUpCircle,  to: '/outbound',         roles: ['admin','staff'] },
      { label: 'Permintaan (SPB)',   icon: ClipboardList,  to: '/requests',         roles: ['admin','staff'] },
      { label: 'Stock Opname',       icon: RefreshCcw,     to: '/opname',           roles: ['admin','staff'] },
      { label: 'Transfer Stok',      icon: ArrowLeftRight, to: '/stock-transfer',   roles: ['admin','staff'] },
      { label: 'Surat Jalan (DO)',   icon: Send,           to: '/delivery-orders',  roles: ['admin','staff'] },
      { label: 'Retur Barang',       icon: RotateCcw,      to: '/returns',          roles: ['admin','staff'] },
    ],
  },
  {
    label: 'Laporan & ERP',
    icon: BarChart2,
    roles: ['admin', 'finance_procurement', 'manager'],
    children: [
      { label: 'Kartu Stok',       icon: BarChart2,    to: '/reports' },
      { label: 'Laporan ERP',      icon: BarChart3,    to: '/erp/reports' },
      { label: 'Purchase Order',   icon: ShoppingCart, to: '/erp/purchase-orders', roles: ['admin','finance_procurement'] },
      { label: 'Supplier',         icon: Truck,        to: '/erp/suppliers',        roles: ['admin','finance_procurement'] },
      { label: 'Invoice',          icon: FileText,     to: '/erp/invoices',         roles: ['admin','finance_procurement'] },
      { label: 'Budget',           icon: PiggyBank,    to: '/erp/budget',           roles: ['admin','finance_procurement'] },
      { label: 'Reorder Point',    icon: RefreshCcw,   to: '/erp/reorder',          roles: ['admin','finance_procurement'] },
    ],
  },
  {
    label: 'Admin',
    icon: Settings,
    roles: ['admin'],
    children: [
      { label: 'Gudang',       icon: Building2,  to: '/admin/warehouses' },
      { label: 'Pengguna',     icon: Users,      to: '/admin/users' },
      { label: 'Master Data',  icon: Database,   to: '/admin/master-data' },
      { label: 'Backup Data',  icon: HardDrive,  to: '/admin/backup' },
    ],
  },
]

const ROLE_LABEL = {
  admin:               '👑 Administrator',
  staff:               '📦 Warehouse Staff',
  requester:           '📋 Requester',
  finance_procurement: '💼 Finance & Procurement',
  manager:             '👁️ Manager',
}

function SidebarItem({ item, userRole, onClose }) {
  const location = useLocation()
  const [open, setOpen] = useState(() =>
    item.children?.some(c => location.pathname.startsWith(c.to))
  )

  if (item.roles && !item.roles.includes(userRole)) return null

  // Sembunyikan group jika tidak ada child yang visible untuk role ini
  if (item.children) {
    const visibleChildren = item.children.filter(c => !c.roles || c.roles.includes(userRole))
    if (visibleChildren.length === 0) return null
  }

  if (!item.children) {
    return (
      <NavLink
        to={item.to}
        end={item.exact}
        onClick={onClose}
        className={({ isActive }) =>
          `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
           ${isActive
            ? 'bg-gold-500/15 text-gold-400 border border-gold-500/25'
            : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
           }`
        }
      >
        <item.icon size={17} className="flex-shrink-0" />
        <span>{item.label}</span>
      </NavLink>
    )
  }

  const isGroupActive = item.children.some(c => location.pathname.startsWith(c.to))

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
          ${isGroupActive ? 'text-gold-400' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'}`}
      >
        <item.icon size={17} className="flex-shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-white/[0.06] pl-4">
          {item.children.filter(child => !child.roles || child.roles.includes(userRole)).map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150
                 ${isActive
                  ? 'text-gold-400 bg-gold-500/10'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'
                 }`
              }
            >
              <child.icon size={14} />
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function NotificationBell() {
  const [unread, setUnread] = useState(0)
  const [open, setOpen]     = useState(false)
  const [notifs, setNotifs] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/notifications')
        setUnread(res.unread || 0)
        setNotifs(res.data || [])
      } catch {}
    }
    load()
    const t = setInterval(load, 30000) // refresh every 30s
    return () => clearInterval(t)
  }, [])

  const markAll = async () => {
    await api.put('/notifications/all/read')
    setUnread(0)
    setNotifs(notifs.map(n => ({...n, is_read: true})))
  }

  const TYPE_COLOR = { warning: 'text-yellow-400', error: 'text-red-400', info: 'text-blue-400', success: 'text-emerald-400' }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5 animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 rounded-2xl border border-white/[0.08] bg-[#111827] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <span className="text-white font-semibold text-sm">Notifikasi</span>
              {unread > 0 && (
                <button onClick={markAll} className="text-xs text-slate-400 hover:text-gold-400">Tandai semua dibaca</button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">Tidak ada notifikasi</div>
              ) : notifs.map(n => (
                <div key={n.id} className={`px-4 py-3 border-b border-white/[0.04] ${!n.is_read ? 'bg-white/[0.03]' : ''}`}>
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-gold-500 mt-1.5 flex-shrink-0" />}
                    <div>
                      <p className={`text-xs font-semibold ${TYPE_COLOR[n.type] || 'text-slate-300'}`}>{n.title}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{n.message}</p>
                      <p className="text-slate-600 text-[10px] mt-1">{n.created_at}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function WarehouseSelector() {
  const { user } = useAuthStore()
  const { selectedWarehouseId, setSelectedWarehouse, availableWarehouses, setAvailableWarehouses } = useWarehouseStore()
  const isAdmin = user?.role === 'admin'
  const myWarehouses = user?.warehouses || []
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const res = await api.get('/warehouses')
        const all = Array.isArray(res) ? res : (res.data || [])
        if (isAdmin) {
          setAvailableWarehouses(all)
          if (!selectedWarehouseId && all.length > 0) {
            setSelectedWarehouse(all[0].id)
          }
        } else {
          const mine = all.filter(w => myWarehouses.some(mw => mw.id === w.id))
          setAvailableWarehouses(mine)
          if (mine.length > 0) {
            setSelectedWarehouse(mine[0].id)
          }
        }
      } catch {}
    }
    loadWarehouses()
  }, [user])

  const currentWarehouse = availableWarehouses.find(w => w.id === selectedWarehouseId)
  const displayName = currentWarehouse?.name || 'Semua Gudang'
  const displayCity = currentWarehouse?.city || ''

  // Staff dengan 1 gudang: tampilkan label locked
  if (!isAdmin && availableWarehouses.length <= 1) {
    return (
      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-gold-500/10 to-gold-500/5 border border-gold-500/20">
        <div className="w-7 h-7 rounded-lg bg-gold-500/15 flex items-center justify-center">
          <Building2 size={14} className="text-gold-400" />
        </div>
        <div className="min-w-0">
          <p className="text-white text-xs font-semibold leading-tight truncate">{availableWarehouses[0]?.name || '—'}</p>
          {availableWarehouses[0]?.city && <p className="text-gold-500/60 text-[10px] leading-tight">{availableWarehouses[0].city}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all duration-200 group
          ${open
            ? 'bg-gold-500/10 border-gold-500/30 shadow-lg shadow-gold-500/5'
            : 'bg-white/[0.04] border-white/[0.08] hover:border-gold-500/25 hover:bg-white/[0.06]'
          }`}
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${open ? 'bg-gold-500/20' : 'bg-gold-500/10 group-hover:bg-gold-500/15'}`}>
          <Building2 size={14} className="text-gold-400" />
        </div>
        <div className="min-w-0 text-left">
          <p className="text-white text-xs font-semibold leading-tight truncate max-w-[120px]">{displayName}</p>
          {displayCity && <p className="text-slate-500 text-[10px] leading-tight">{displayCity}</p>}
          {!currentWarehouse && isAdmin && <p className="text-gold-500/50 text-[10px] leading-tight">Filter global</p>}
        </div>
        <ChevronDown size={12} className={`text-slate-500 transition-transform duration-200 ml-1 ${open ? 'rotate-180 text-gold-400' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-64 rounded-2xl border border-white/[0.1] bg-[#111827]/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-white/[0.06]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pilih Gudang</p>
            </div>

            {/* Options */}
            <div className="py-1.5 max-h-64 overflow-y-auto custom-scrollbar">
              {isAdmin && (
                <button
                  onClick={() => { setSelectedWarehouse(null); setOpen(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 transition-all text-left
                    ${!selectedWarehouseId
                      ? 'bg-gold-500/10 border-l-2 border-gold-500'
                      : 'hover:bg-white/[0.04] border-l-2 border-transparent'
                    }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${!selectedWarehouseId ? 'bg-gold-500/20' : 'bg-white/[0.06]'}`}>
                    <Package size={14} className={!selectedWarehouseId ? 'text-gold-400' : 'text-slate-500'} />
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${!selectedWarehouseId ? 'text-gold-400' : 'text-slate-300'}`}>Semua Gudang</p>
                    <p className="text-[10px] text-slate-600">Gabungan {availableWarehouses.length} gudang</p>
                  </div>
                  {!selectedWarehouseId && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />}
                </button>
              )}

              {availableWarehouses.map(w => {
                const isActive = selectedWarehouseId === w.id
                return (
                  <button
                    key={w.id}
                    onClick={() => { setSelectedWarehouse(w.id); setOpen(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 transition-all text-left
                      ${isActive
                        ? 'bg-gold-500/10 border-l-2 border-gold-500'
                        : 'hover:bg-white/[0.04] border-l-2 border-transparent'
                      }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-gold-500/20' : 'bg-white/[0.06]'}`}>
                      <Building2 size={14} className={isActive ? 'text-gold-400' : 'text-slate-500'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold truncate ${isActive ? 'text-gold-400' : 'text-slate-300'}`}>{w.name}</p>
                      <p className="text-[10px] text-slate-600 truncate">{w.city || w.code || '—'}</p>
                    </div>
                    {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const { reset: resetWarehouse } = useWarehouseStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Apply saved theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const handleLogout = () => {
    logout()
    resetWarehouse()
    toast.success('Berhasil logout')
    navigate('/login')
  }

  const Sidebar = ({ onClose = () => {} }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-glow-gold flex-shrink-0">
            <img src="/logo.png" alt="WMS" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="font-display font-bold text-white text-base leading-tight">WMS LUTFHI</div>
            <div className="text-gold-500 text-xs font-semibold tracking-widest uppercase">Enterprise</div>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04]">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-semibold truncate">{user?.name}</div>
            <div className="text-slate-500 text-xs truncate">{ROLE_LABEL[user?.role] || user?.role}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 custom-scrollbar">
        {NAV.map((item) => (
          <SidebarItem
            key={item.label}
            item={item}
            userRole={user?.role}
            onClose={onClose}
          />
        ))}
      </div>

      {/* Profile & Logout */}
      <div className="px-4 py-4 border-t border-white/[0.06] space-y-1">
        <NavLink to="/profile" onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
             ${isActive ? 'text-gold-400 bg-gold-500/10' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'}`
          }>
          <User size={17} /> Edit Profil
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium
                     text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut size={17} />
          Keluar
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#0A0F1E] overflow-hidden">

      {/* ── Desktop Sidebar ─────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 bg-[#0D1221] border-r border-white/[0.06]">
        <Sidebar />
      </aside>

      {/* ── Mobile Sidebar Overlay ───────────────────── */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-64 flex flex-col bg-[#0D1221] border-r border-white/[0.06] z-10 animate-slide-right">
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08]"
              >
                <X size={18} />
              </button>
            </div>
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.06] bg-[#0D1221]/80 backdrop-blur-sm flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <Menu size={20} />
          </button>

          {/* Global Warehouse Selector */}
          <WarehouseSelector />

          <div className="flex-1" />

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="theme-toggle-btn relative w-9 h-9 flex items-center justify-center rounded-xl
                       text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
          >
            <Sun  size={17} className="icon-sun" />
            <Moon size={17} className="icon-moon" />
          </button>

          {/* Notification bell */}
          <NotificationBell />

          {/* User avatar — click to profile */}
          <Link to="/profile" className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:border-gold-500/30 transition-all">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">{user?.name?.[0]?.toUpperCase()}</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-white text-xs font-semibold leading-tight">{user?.name}</div>
              <div className="text-slate-500 text-xs capitalize">{user?.role?.replace('_', ' ')}</div>
            </div>
          </Link>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* AI Chatbot — visible on all pages */}
      <AIChatbot />
    </div>
  )
}
