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
import { Businesses } from '../pages/Businesses';
import { CompanyProfile } from '../pages/CompanyProfile';
import { Audit } from '../pages/Audit';
import { FiscalSettings } from '../pages/FiscalSettings';
import { NotFound } from '../pages/NotFound';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission }) => {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();

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

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />;
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

      {/* Auditoría del Sistema para Administradores */}
      <Route
        path="/system/audit"
        element={
          <ProtectedRoute permission="AUDIT_VIEW">
            <Audit />
          </ProtectedRoute>
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
          <ProtectedRoute permission="sales:read">
            <Customers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pos"
        element={
          <ProtectedRoute permission="sales:create">
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
        path="/settings/company"
        element={
          <ProtectedRoute>
            <CompanyProfile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings/fiscal"
        element={
          <ProtectedRoute permission="FISCAL_VIEW">
            <FiscalSettings />
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
