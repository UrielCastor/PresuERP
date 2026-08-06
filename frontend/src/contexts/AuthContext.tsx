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
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
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

    // If user has role Cajero / Cashier, explicitly deny logistics approval, preparation, and dispatch
    const isCashier = user.role?.toLowerCase() === 'cajero' || user.role?.toLowerCase() === 'cashier';
    if (isCashier && (
      permission === 'transfer_requests:approve' ||
      permission === 'transfer_requests:reject' ||
      permission === 'transfers:prepare' ||
      permission === 'transfers:dispatch'
    )) {
      return false;
    }

    return user.permissions.includes(permission);
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    login,
    logout,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
