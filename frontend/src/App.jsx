import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import LoginPage from '@/pages/auth/LoginPage'
import AppLayout from '@/layouts/AppLayout'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import InventoryPage from '@/pages/wms/inventory/InventoryPage'
import InboundPage from '@/pages/wms/inbound/InboundPage'
import OutboundPage from '@/pages/wms/outbound/OutboundPage'
import RequestsPage from '@/pages/wms/requests/RequestsPage'
import OpnamePage from '@/pages/wms/opname/OpnamePage'
import StockTransferPage from '@/pages/wms/transfer/StockTransferPage'
import DeliveryOrderPage from '@/pages/wms/delivery/DeliveryOrderPage'
import ReturnPage from '@/pages/wms/returns/ReturnPage'
import PurchaseOrderPage from '@/pages/erp/purchase-orders/PurchaseOrderPage'
import SupplierPage from '@/pages/erp/suppliers/SupplierPage'
import InvoicePage from '@/pages/erp/finance/InvoicePage'
import BudgetPage from '@/pages/erp/budget/BudgetPage'
import ReorderPage from '@/pages/erp/procurement/ReorderPage'
import ERPReportPage from '@/pages/erp/reports/ERPReportPage'
import WarehousePage from '@/pages/admin/WarehousePage'
import UsersPage from '@/pages/admin/UsersPage'
import MasterDataPage from '@/pages/admin/MasterDataPage'
import ProfilePage from '@/pages/profile/ProfilePage'
import ReportsPage from '@/pages/reports/ReportsPage'
import BackupPage from '@/pages/admin/BackupPage'

function PrivateRoute({ children, allowedRoles }) {
  const { user, token } = useAuthStore()
  if (!token || !user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const { token } = useAuthStore()

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />

        {/* WMS */}
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="inbound" element={<InboundPage />} />
        <Route path="outbound" element={<OutboundPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="opname" element={<OpnamePage />} />
        <Route path="stock-opname" element={<OpnamePage />} />
        <Route path="stock-transfer" element={<PrivateRoute allowedRoles={['admin','staff']}><StockTransferPage /></PrivateRoute>} />
        <Route path="delivery-orders" element={<PrivateRoute allowedRoles={['admin','staff']}><DeliveryOrderPage /></PrivateRoute>} />
        <Route path="returns" element={<PrivateRoute allowedRoles={['admin','staff','finance_procurement']}><ReturnPage /></PrivateRoute>} />

        {/* Reports */}
        <Route path="reports" element={<PrivateRoute allowedRoles={['admin','finance_procurement','manager']}><ReportsPage /></PrivateRoute>} />

        {/* ERP */}
        <Route path="erp/purchase-orders" element={<PrivateRoute allowedRoles={['admin','finance_procurement']}><PurchaseOrderPage /></PrivateRoute>} />
        <Route path="erp/suppliers" element={<PrivateRoute allowedRoles={['admin','finance_procurement']}><SupplierPage /></PrivateRoute>} />
        <Route path="erp/invoices" element={<PrivateRoute allowedRoles={['admin','finance_procurement']}><InvoicePage /></PrivateRoute>} />
        <Route path="erp/budget" element={<PrivateRoute allowedRoles={['admin','finance_procurement']}><BudgetPage /></PrivateRoute>} />
        <Route path="erp/reorder" element={<PrivateRoute allowedRoles={['admin','finance_procurement']}><ReorderPage /></PrivateRoute>} />
        <Route path="erp/reports" element={<PrivateRoute allowedRoles={['admin','finance_procurement','manager']}><ERPReportPage /></PrivateRoute>} />

        {/* Admin */}
        <Route path="admin/warehouses" element={<PrivateRoute allowedRoles={['admin']}><WarehousePage /></PrivateRoute>} />
        <Route path="admin/users" element={<PrivateRoute allowedRoles={['admin']}><UsersPage /></PrivateRoute>} />
        <Route path="admin/master-data" element={<PrivateRoute allowedRoles={['admin']}><MasterDataPage /></PrivateRoute>} />
        <Route path="admin/backup" element={<PrivateRoute allowedRoles={['admin']}><BackupPage /></PrivateRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
