import React, { useState } from 'react';
import {
  Monitor,
  Eye,
  Lock,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Package,
  Wallet,
  ShoppingCart,
  Settings,
  AlertTriangle,
  Building2,
  Printer,
  ShieldAlert,
} from 'lucide-react';
import { useRoleSimulation } from '../../hooks/useRoleSimulation';

interface RoleSimulatorProps {
  roleName: string;
  assignedCapIds: Set<string>;
  warehouses?: any[];
}

export const RoleSimulator: React.FC<RoleSimulatorProps> = ({
  roleName,
  assignedCapIds,
  warehouses = [],
}) => {
  const { simulatedModules } = useRoleSimulation(assignedCapIds);
  const [selectedModuleKey, setSelectedModuleKey] = useState<string>('sales');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(warehouses[0]?.id || '');

  const activeSimModule = simulatedModules.find((m) => m.moduleKey === selectedModuleKey) || simulatedModules[1];
  const visibleModulesCount = simulatedModules.filter((m) => m.isVisible).length;

  return (
    <div className="space-y-6">
      {/* Simulation Banner Header */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-black tracking-tight">Simulador de Entorno Operativo ERP</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-md">
              Modo Sandbox Real
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Visualice exactamente la experiencia de usuario, botones activos y restricciones de menú para el rol <strong className="text-white">{roleName}</strong>.
          </p>
        </div>

        {/* Scope / Warehouse Selector */}
        {warehouses.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-xl border border-slate-700">
            <Building2 className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-300">Depósito Simulado:</span>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="bg-slate-900 text-xs text-white font-bold border border-slate-700 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.isDefault ? '(Principal)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 block">Rol Evaluado</span>
          <span className="text-sm font-black text-slate-900 dark:text-white truncate block">{roleName}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 block">Capacidades Otorgadas</span>
          <span className="text-sm font-black text-primary-600 dark:text-primary-400">{assignedCapIds.size} activas</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 block">Módulos Visibles</span>
          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{visibleModulesCount} de {simulatedModules.length}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 block">Alcance Depósitos</span>
          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{warehouses.length > 0 ? `${warehouses.length} depósitos` : 'Todos los depósitos'}</span>
        </div>
      </div>

      {/* Simulation Module Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {simulatedModules.map((m) => {
          const isSelected = m.moduleKey === selectedModuleKey;
          return (
            <button
              key={m.moduleKey}
              onClick={() => setSelectedModuleKey(m.moduleKey)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                isSelected
                  ? 'bg-primary-600 text-white shadow-md'
                  : m.isVisible
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
              }`}
            >
              <span>{m.moduleName}</span>
              {m.isVisible ? (
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              ) : (
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200 rounded">Oculto</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Module Simulation Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>Simulación de Módulo: {activeSimModule.moduleName}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Estado de visualización en menú lateral: {' '}
              {activeSimModule.isVisible ? (
                <strong className="text-emerald-600 dark:text-emerald-400 font-bold">✔ ACCESO HABILITADO (Capacidad: {activeSimModule.requiredViewCap})</strong>
              ) : (
                <strong className="text-rose-600 dark:text-rose-400 font-bold">✖ MÓDULO BLOQUEADO (Falta permiso: {activeSimModule.requiredViewCap})</strong>
              )}
            </p>
          </div>
        </div>

        {/* Screen Action Simulator Grid */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Acciones y Formulario del Módulo
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeSimModule.actions.map((act) => (
              <div
                key={act.id}
                className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                  act.isAllowed
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {act.isAllowed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <Lock className="h-4 w-4 text-rose-600 flex-shrink-0" />
                    )}
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                      {act.name}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Capacidad requerida: <span className="font-bold text-slate-700 dark:text-slate-300">{act.requiredCapability}</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span
                    className={`inline-block text-[10px] font-black px-2.5 py-1 rounded-md ${
                      act.isAllowed
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    {act.isAllowed ? '✔ OTORGADA' : '✖ NO OTORGADA'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
