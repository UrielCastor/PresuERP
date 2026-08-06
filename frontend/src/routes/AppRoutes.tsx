import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Login } from '../pages/Login';
import { Dashboard } from '../pages/Dashboard';
import { Profile } from '../pages/Profile';
import { Settings } from '../pages/Settings';
import { Users } from '../pages/Users';
import { Products } from '../pages/Products';
import { PriceListsPage } from '../pages/PriceListsPage';
import { Categories } from '../pages/Categories';
import { Suppliers } from '../pages/Suppliers';
import { Warehouses } from '../pages/Warehouses';
import { Stocks } from '../pages/Stocks';
import { Kardex } from '../pages/Kardex';
import { Purchases } from '../pages/Purchases';
import { Sales } from '../pages/Sales';
import { Customers } from '../pages/customers/Customers';
import { POS } from '../pages/POS';
import { Cash } from '../pages/Cash';
import { Reports } from '../pages/Reports';
import { CompanyProfile } from '../pages/CompanyProfile';
import { RoleCapabilitiesPage } from '../pages/settings/RoleCapabilitiesPage';
import { Audit } from '../pages/Audit';
import { NotFound } from '../pages/NotFound';

import { LogisticsDashboard } from '../pages/logistics/LogisticsDashboard';
import { LogisticsOrders } from '../pages/logistics/LogisticsOrders';
import { CreateTransferRequest } from '../pages/logistics/CreateTransferRequest';
import { PendingApprovals } from '../pages/logistics/PendingApprovals';
import { LogisticsAvailability } from '../pages/logistics/LogisticsAvailability';
import { LogisticsTransfers } from '../pages/logistics/LogisticsTransfers';
import { LogisticsReceipts } from '../pages/logistics/LogisticsReceipts';
import { LogisticsHistory } from '../pages/logistics/LogisticsHistory';
import { UserPermissionsAuditPage } from '../pages/settings/UserPermissionsAuditPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  capability?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission, permissions, capability }) => {
  const { isAuthenticated, isLoading, hasPermission, hasCapability } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const hasAccess = 
    (!capability || hasCapability(capability)) &&
    (!permission || hasPermission(permission)) &&
    (!permissions || permissions.some(p => hasPermission(p)));

  if (!hasAccess) {
    return (
      <DashboardLayout>
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-9xl font-black text-slate-200 dark:text-slate-800 tracking-widest animate-pulse">
            403
          </h1>
          <div className="bg-red-500 text-white px-2.5 py-0.5 text-sm font-semibold rounded rotate-12 absolute shadow-sm">
            Acceso Restringido
          </div>
          <h2 className="text-2xl font-bold mt-4 text-slate-800 dark:text-slate-100">
            Acceso Denegado
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md">
            Tu usuario no cuenta con los permisos ni la capacidad requerida para ver o editar estos parámetros.
          </p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="mt-8 px-6 py-2.5 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Volver al Dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return <DashboardLayout>{children}</DashboardLayout>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

import { SystemRoute } from '../system/SystemRoute';
import { SystemLayout } from '../system/layout/SystemLayout';
import { SystemDashboard } from '../system/pages/SystemDashboard';
import { SystemBusinesses } from '../system/pages/SystemBusinesses';
import { SystemUsers } from '../system/pages/SystemUsers';
import { SystemPlans } from '../system/pages/SystemPlans';
import { SystemSubscriptions } from '../system/pages/SystemSubscriptions';
import { SystemSettings } from '../system/pages/SystemSettings';
import { SystemAudit } from '../system/pages/SystemAudit';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />


      {/* SaaS System Area */}
      <Route path="/system" element={<SystemRoute />}>
         <Route element={<SystemLayout />}>
            <Route path="dashboard" element={<SystemDashboard />} />
            <Route path="businesses" element={<SystemBusinesses />} />
            <Route path="users" element={<SystemUsers />} />
            <Route path="plans" element={<SystemPlans />} />
            <Route path="subscriptions" element={<SystemSubscriptions />} />
            <Route path="audit" element={<SystemAudit />} />
            <Route path="settings" element={<SystemSettings />} />
            <Route path="" element={<Navigate to="/system/dashboard" replace />} />
         </Route>
      </Route>

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute permission="settings:read">
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute permission="users:read">
            <Users />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute permission="products:read">
            <Products />
          </ProtectedRoute>
        }
      />
      <Route
        path="/price-lists"
        element={
          <ProtectedRoute permission="products:read">
            <PriceListsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/categories"
        element={
          <ProtectedRoute permission="categories:read">
            <Categories />
          </ProtectedRoute>
        }
      />
      <Route
        path="/suppliers"
        element={
          <ProtectedRoute permission="suppliers:read">
            <Suppliers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/warehouses"
        element={
          <ProtectedRoute permission="warehouses:read">
            <Warehouses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stocks"
        element={
          <ProtectedRoute permission="stocks:read">
            <Stocks />
          </ProtectedRoute>
        }
      />
      {/* Logistics routes */}
      <Route
        path="/logistics"
        element={
          <ProtectedRoute permissions={['transfer_requests:read', 'transfers:read', 'logistics:read', 'stocks:read']}>
            <LogisticsDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/logistics/orders"
        element={
          <ProtectedRoute permissions={['transfer_requests:read', 'transferRequests:read', 'logistics:read', 'stocks:read']}>
            <LogisticsOrders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/logistics/orders/create"
        element={
          <ProtectedRoute permissions={['transfer_requests:create', 'transfer_requests:write', 'logistics:write', 'stocks:read']}>
            <CreateTransferRequest />
          </ProtectedRoute>
        }
      />
      <Route
        path="/logistics/orders/pending"
        element={
          <ProtectedRoute permissions={['transfer_requests:approve', 'transfer_requests:reject', 'transfer_requests:write', 'logistics:write']}>
            <PendingApprovals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/logistics/availability"
        element={
          <ProtectedRoute permissions={['transfer_requests:read', 'transferRequests:read', 'logistics:read', 'stocks:read']}>
            <LogisticsAvailability />
          </ProtectedRoute>
        }
      />
      <Route
        path="/logistics/transfers"
        element={
          <ProtectedRoute permissions={['transfers:read', 'warehouseTransfers:read', 'logistics:read', 'stocks:read']}>
            <LogisticsTransfers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/logistics/receipts"
        element={
          <ProtectedRoute permissions={['transfers:receive', 'transfers:read', 'logistics:read', 'stocks:read']}>
            <LogisticsReceipts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/logistics/history"
        element={
          <ProtectedRoute permissions={['transfer_requests:read', 'transfers:read', 'logistics:read', 'stocks:read']}>
            <LogisticsHistory />
          </ProtectedRoute>
        }
      />      <Route
        path="/kardex"
        element={
          <ProtectedRoute permission="kardex:read">
            <Navigate to="/reports?tab=kardex" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchases"
        element={
          <ProtectedRoute permission="purchases:read">
            <Purchases />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales"
        element={
          <ProtectedRoute permission="sales:read">
            <Sales />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers"
        element={
          <ProtectedRoute permission="customers:read">
            <Customers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pos"
        element={
          <ProtectedRoute permission="sales:write">
            <POS />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cash"
        element={
          <ProtectedRoute permission="cash:view">
            <Cash />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute permission="reports:read">
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <ProtectedRoute permission="AUDIT_VIEW">
            <Audit />
          </ProtectedRoute>
        }
      />



      <Route
        path="/settings/company"
        element={
          <ProtectedRoute permission="settings:read">
            <CompanyProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/pos"
        element={
          <ProtectedRoute permission="settings:pos:read">
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/roles-capabilities"
        element={
          <ProtectedRoute permission="users:write">
            <RoleCapabilitiesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/user-permissions-audit"
        element={
          <ProtectedRoute capability="audit.view">
            <UserPermissionsAuditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/system"
        element={
          <ProtectedRoute permission="settings:read">
            <Navigate to="/settings" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/subscription"
        element={
          <ProtectedRoute permission="settings:read">
            <Navigate to="/settings" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/company"
        element={
          <ProtectedRoute permission="settings:read">
            <Navigate to="/settings/company" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/roles"
        element={
          <ProtectedRoute permission="users:read">
            <Navigate to="/users" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/permissions"
        element={
          <ProtectedRoute permission="users:read">
            <Navigate to="/users" replace />
          </ProtectedRoute>
        }
      />

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <NotFound />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};
