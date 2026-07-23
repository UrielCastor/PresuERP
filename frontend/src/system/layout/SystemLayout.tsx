import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Server, Building, Users, Layers, CreditCard, Activity, Settings, ArrowLeft } from 'lucide-react';

const systemMenu = [
  { name: 'Dashboard SaaS', path: '/system/dashboard', icon: Server },
  { name: 'Empresas', path: '/system/businesses', icon: Building },
  { name: 'Usuarios', path: '/system/users', icon: Users },
  { name: 'Suscripciones', path: '/system/subscriptions', icon: CreditCard },
  { name: 'Planes', path: '/system/plans', icon: Layers },
  { name: 'Auditoría', path: '/system/audit', icon: Activity },
  { name: 'Configuración', path: '/system/settings', icon: Settings },
];

export const SystemLayout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 font-sans">
      {/* SaaS Sidebar */}
      <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
           <div>
             <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 flex items-center gap-2">
                <Server className="w-6 h-6 text-indigo-400" />
                PRESU_CORE
             </h1>
             <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">SaaS Administration</p>
           </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {systemMenu.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-200' : 'text-slate-500'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
           <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
              Salir al ERP
           </Link>
        </div>
      </aside>

      {/* Main SaaS Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white dark:bg-slate-900 h-16 border-b border-slate-200 dark:border-slate-800 flex items-center px-8 shadow-sm">
           <div className="flex-1"></div>
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm border border-indigo-200">
                 OP
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">System Operator</span>
           </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
