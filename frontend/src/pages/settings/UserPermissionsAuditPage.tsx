import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, ShieldAlert, Users, Search, CheckCircle2, XCircle,
  Building, Mail, RefreshCw, Key, Filter, Check, AlertTriangle, ChevronRight
} from 'lucide-react';
import api from '../../services/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';

interface UserItem {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role?: { name: string };
}

interface ModuleAllowedActions {
  module: string;
  actions: string[];
}

interface BlockedAction {
  module: string;
  action: string;
  capabilityId: string;
  reason: string;
}

interface UserSecuritySummary {
  user: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    isStaff: boolean;
  };
  role: {
    id: string | null;
    name: string;
    isSystem?: boolean;
  };
  warehouses: {
    defaultWarehouse: { id: string; name: string } | null;
    authorizedWarehouses: Array<{ id: string; name: string }>;
    scopeDescription: string;
  };
  isSuperAdmin: boolean;
  isAdministrator: boolean;
  allowedCount: number;
  blockedCount: number;
  allowedGrouped: ModuleAllowedActions[];
  blocked: BlockedAction[];
}

export const UserPermissionsAuditPage: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [filterModule, setFilterModule] = useState<string>('ALL');

  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(false);
  const [summary, setSummary] = useState<UserSecuritySummary | null>(null);
  const [notification, setNotification] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Fetch list of users in company
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const res = await api.get('/users?limit=100');
        const userList = res.data?.data?.items || res.data?.items || res.data || [];
        setUsers(userList);
        if (userList.length > 0) {
          setSelectedUserId(userList[0].id);
        }
      } catch (err: any) {
        console.error('Error al cargar lista de usuarios:', err);
        setNotification({
          type: 'error',
          message: 'Error al obtener usuarios de la empresa.',
        });
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  // Fetch security summary when selectedUserId changes
  useEffect(() => {
    if (!selectedUserId) return;

    const fetchSummary = async () => {
      setIsLoadingSummary(true);
      setNotification(null);
      try {
        const res = await api.get(`/users/${selectedUserId}/security-summary`);
        setSummary(res.data?.data || null);
      } catch (err: any) {
        console.error('Error cargando resumen de seguridad:', err);
        setNotification({
          type: 'error',
          message: err.response?.data?.message || 'Error al obtener auditoría del usuario.',
        });
        setSummary(null);
      } finally {
        setIsLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [selectedUserId]);

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      (u.role?.name && u.role.name.toLowerCase().includes(userSearchQuery.toLowerCase()))
  );

  // Collect all module names for filter dropdown
  const moduleNames = Array.from(
    new Set([
      ...(summary?.allowedGrouped.map((g) => g.module) || []),
      ...(summary?.blocked.map((b) => b.module) || []),
    ])
  ).sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoría de Permisos Efectivos"
        subtitle="Herramienta de diagnóstico de seguridad para auditar y consultar exactamente las capacidades permitidas y bloqueadas por usuario."
      />

      {notification && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold border flex items-center justify-between shadow-sm animate-fade-in ${
            notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
          }`}
        >
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-xs underline ml-4 font-bold">
            Cerrar
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: User Selector */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-primary-600" />
              Seleccionar Usuario
            </h3>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {users.length} Usuarios
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o rol..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 font-semibold"
            />
          </div>

          {isLoadingUsers ? (
            <div className="p-8 text-center text-xs text-slate-400">Cargando usuarios...</div>
          ) : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredUsers.map((u) => {
                const isSelected = u.id === selectedUserId;
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between border ${
                      isSelected
                        ? 'bg-primary-50 border-primary-300 dark:bg-primary-950/40 dark:border-primary-800 text-primary-900 dark:text-primary-100 shadow-xs'
                        : 'bg-slate-50/50 dark:bg-slate-850/50 border-slate-150 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <p className="text-xs font-bold truncate">{u.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                        {u.role?.name || 'Administrador'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: User Security Summary & Capability Inspector */}
        <div className="lg:col-span-8 space-y-6">
          {isLoadingSummary ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <RefreshCw className="h-8 w-8 text-primary-500 animate-spin mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Resolviendo matriz efectiva de seguridad...
              </p>
            </div>
          ) : summary ? (
            <>
              {/* User Header Summary Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 flex items-center justify-center font-black text-lg shadow-inner">
                      {summary.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        {summary.user.name}
                        {summary.isAdministrator && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                            ⭐ Superusuario
                          </span>
                        )}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Mail className="h-3.5 w-3.5" />
                        {summary.user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase">Rol Asignado</p>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200">{summary.role.name}</p>
                    </div>
                  </div>
                </div>

                {/* Warehouse Scope Alert */}
                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl flex items-center gap-3 text-xs text-blue-900 dark:text-blue-200 font-semibold">
                  <Building className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <span className="font-extrabold">Alcance de Depósito: </span>
                    <span>{summary.warehouses.scopeDescription}</span>
                    {summary.warehouses.defaultWarehouse && (
                      <span className="block text-[11px] text-blue-700 dark:text-blue-300">
                        Depósito Principal: <strong>{summary.warehouses.defaultWarehouse.name}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Counter Badges */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
                        Acciones Permitidas
                      </span>
                    </div>
                    <span className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono">
                      {summary.allowedCount}
                    </span>
                  </div>

                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-rose-600" />
                      <span className="text-xs font-extrabold text-rose-900 dark:text-rose-200">
                        Acciones Bloqueadas
                      </span>
                    </div>
                    <span className="text-lg font-black text-rose-700 dark:text-rose-400 font-mono">
                      {summary.blockedCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Module Filter */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Filter className="h-4 w-4" /> Filtrar por Módulo:
                </span>
                <select
                  value={filterModule}
                  onChange={(e) => setFilterModule(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="ALL">Todos los Módulos</option>
                  {moduleNames.map((mod) => (
                    <option key={mod} value={mod}>
                      {mod}
                    </option>
                  ))}
                </select>
              </div>

              {/* Two Columns Grid: Allowed vs Blocked */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ALLOWED COLUMN */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-emerald-200 dark:border-emerald-900 pb-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-300">
                      🟢 Puede Hacer ({summary.allowedCount})
                    </h3>
                  </div>

                  {summary.allowedGrouped
                    .filter((g) => filterModule === 'ALL' || g.module === filterModule)
                    .map((group) => (
                      <div
                        key={group.module}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-2"
                      >
                        <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
                          {group.module}
                        </span>
                        <div className="space-y-1 mt-1">
                          {group.actions.map((act) => (
                            <div
                              key={act}
                              className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 py-1 px-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200"
                            >
                              <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                              <span>{act}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>

                {/* BLOCKED COLUMN */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-rose-200 dark:border-rose-900 pb-2">
                    <XCircle className="h-5 w-5 text-rose-600" />
                    <h3 className="text-sm font-extrabold text-rose-900 dark:text-rose-300">
                      🔴 No Puede Hacer ({summary.blockedCount})
                    </h3>
                  </div>

                  {summary.isAdministrator ? (
                    <div className="p-6 text-center bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-900 dark:text-purple-200 space-y-2">
                      <ShieldCheck className="h-8 w-8 text-purple-600 mx-auto" />
                      <p className="font-bold">Superusuario Protegido</p>
                      <p className="text-[11px] text-purple-700 dark:text-purple-300">
                        El rol Administrator posee bypass total y no tiene acciones bloqueadas en el ERP.
                      </p>
                    </div>
                  ) : (
                    summary.blocked
                      .filter((b) => filterModule === 'ALL' || b.module === filterModule)
                      .map((b) => (
                        <div
                          key={b.capabilityId}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-slate-400">{b.module}</span>
                            <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              {b.capabilityId}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <XCircle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                            {b.action}
                          </p>
                          <p className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/30 p-1.5 rounded-lg border border-rose-100 dark:border-rose-900/50 mt-1">
                            Motivo: {b.reason}
                          </p>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-500">
              Seleccione un usuario a la izquierda para inspeccionar su matriz efectiva de seguridad.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
