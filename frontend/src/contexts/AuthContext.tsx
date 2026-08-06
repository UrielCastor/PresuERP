import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { getInitialWarehouseId } from '../utils/warehouse';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string | null;
  businessId: string | null;
  permissions: string[];
  isStaff: boolean;
  defaultWarehouseId?: string | null;
  defaultWarehouse?: { id: string; name: string } | null;
  userWarehouses?: Array<{ warehouseId: string; warehouse?: { id: string; name: string } }>;
  /** Warehouse list injected from JWT payload (login + refresh) */
  warehouses?: Array<{ id: string; name: string }>;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasCapability: (capabilityId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Initial load check from localStorage to speed up initial render
    const savedToken = localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('accessToken', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));

    const initialWarehouseId = getInitialWarehouseId(newUser);

    console.log('[AUTH USER] user completo después del login:', {
      id: newUser.id,
      email: newUser.email,
      isStaff: newUser.isStaff,
      defaultWarehouseId: newUser.defaultWarehouseId,
      defaultWarehouse: newUser.defaultWarehouse,
      userWarehouses: newUser.userWarehouses,
      getInitialWarehouseId_result: initialWarehouseId,
    });
  };

  const logout = async () => {
    try {
      // Call backend to revoke refresh token in database and clear cookies
      await api.post('/auth/logout', {}, { withCredentials: true });
    } catch (e) {
      console.warn('Backend logout warning:', e);
    } finally {
      // Clear auth state, storage, and React Query cache unconditionally
      setToken(null);
      setUser(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      sessionStorage.clear();
      try {
        queryClient.clear();
      } catch (e) {
        // Fallback if queryClient is not available
      }
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // isStaff (SuperAdmin) can do anything across the whole system
    if (user.isStaff) return true;
    
    // system:* permissions are STRICTLY reserved for Staff
    if (permission.startsWith('system:')) return false;

    // Tenant Administrator bypasses permission checks (except for system:*)
    if (user.role === 'Administrator') return true;

    // If explicitly in user permissions, grant
    if (user.permissions.includes(permission)) return true;

    // Fallback for logistics operations: if user has stock read/update access and permission is not denied, grant logistics read/create/update/send/prepare/receive
    if (
      (permission.startsWith('transfer_requests:') || permission.startsWith('transfers:')) &&
      (user.permissions.includes('stocks:read') || user.permissions.includes('stocks:update'))
    ) {
      return true;
    }

    return false;
  };

  const hasCapability = (capabilityId: string): boolean => {
    if (!user) return false;
    if (user.isStaff || user.role === 'Administrator') return true;
    
    // Map capability ID to technical permission check
    const capabilityPermissionMap: Record<string, string> = {
      'cash.view': 'cash:view',
      'cash.open': 'cash:open',
      'cash.close': 'cash:close',
      'cash.movement': 'cash:movement',
      'cash.audit': 'cash:audit',
      'sales.create': 'sales:write',
      'sales.history': 'sales:read',
      'sales.discount': 'sales:write',
      'sales.cancel': 'sales:cancel',
      'customers.view': 'customers:read',
      'customers.create': 'customers:write',
      'customers.update': 'customers:write',
      'customers.delete': 'customers:write',
      'products.view': 'products:read',
      'products.create': 'products:create',
      'products.update': 'products:update',
      'products.delete': 'products:delete',
      'stocks.view': 'stocks:read',
      'stocks.adjust': 'stocks:update',
      'stocks.costs': 'stocks:update',
      'kardex.view': 'kardex:read',
      'kardex.export': 'kardex:export',
      'purchases.view': 'purchases:read',
      'purchases.create': 'purchases:create',
      'purchases.update': 'purchases:update',
      'purchases.approve': 'purchases:approve',
      'purchases.cancel': 'purchases:cancel',
      'logistics.request.view': 'transfer_requests:read',
      'logistics.request.create': 'transfer_requests:create',
      'logistics.request.update': 'transfer_requests:update',
      'logistics.request.send': 'transfer_requests:send',
      'logistics.request.approve': 'transfer_requests:approve',
      'logistics.request.reject': 'transfer_requests:reject',
      'logistics.request.cancel': 'transfer_requests:update',
      'logistics.transfer.view': 'transfers:read',
      'logistics.transfer.create': 'transfers:create',
      'logistics.transfer.prepare': 'transfers:prepare',
      'logistics.transfer.dispatch': 'transfers:dispatch',
      'logistics.transfer.receive': 'transfers:receive',
      'users.view': 'users:read',
      'users.create': 'users:write',
      'users.update': 'users:write',
      'users.delete': 'users:delete',
      'roles.manage': 'users:write',
      'settings.view': 'settings:read',
      'settings.update': 'settings:write',
      'settings.pos.update': 'settings:pos:write',
      'reports.view': 'reports:read',
      'reports.export': 'reports:read',
      'audit.view': 'AUDIT_VIEW',
    };

    const mappedPermission = capabilityPermissionMap[capabilityId] || capabilityId;
    return hasPermission(mappedPermission);
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    login,
    logout,
    hasPermission,
    hasCapability,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
