import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const SystemRoute: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
           <div className="w-8 h-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
           <p className="text-slate-500 font-medium">Validando seguridad SaaS...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.isStaff) {
    // Or render a 403 Forbidden page directly
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
         <h1 className="text-6xl font-black text-slate-800 mb-4">403</h1>
         <h2 className="text-2xl font-bold text-slate-600 mb-4">Acceso Denegado</h2>
         <p className="text-slate-500 max-w-md mx-auto mb-8">
            Esta zona está restringida al sistema central (SaaS Admin). No posees los privilegios de propietario.
         </p>
         <button onClick={() => window.location.href = '/dashboard'} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition">
            Volver a mi ERP
         </button>
      </div>
    );
  }

  return <Outlet />;
};
