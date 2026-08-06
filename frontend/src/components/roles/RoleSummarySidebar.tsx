import React from 'react';
import {
  PieChart,
  Activity,
  AlertTriangle,
  Monitor,
  Scale,
  Sparkles,
} from 'lucide-react';
import { analyzeRoleCapabilities } from '../../utils/roleAnalyzer';

interface RoleSummarySidebarProps {
  selectedRole: any;
  assignedCapIds: Set<string>;
  totalCapabilitiesCount?: number;
  activeTab: 'MATRIX' | 'SIMULATOR' | 'COMPARISON' | 'DIAGNOSTICS';
  setActiveTab: (tab: 'MATRIX' | 'SIMULATOR' | 'COMPARISON' | 'DIAGNOSTICS') => void;
}

export const RoleSummarySidebar: React.FC<RoleSummarySidebarProps> = ({
  selectedRole,
  assignedCapIds,
  totalCapabilitiesCount = 183,
  activeTab,
  setActiveTab,
}) => {
  const analysis = analyzeRoleCapabilities(assignedCapIds, totalCapabilitiesCount);
  const isProtectedRole = selectedRole?.name === 'Administrator' || selectedRole?.name === 'SuperAdmin';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-4 h-[calc(100vh-210px)] overflow-y-auto pr-1 font-sans">
      {/* Role Title Header */}
      <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <PieChart className="h-4 w-4 text-primary-600" />
          Resumen Ejecutivo
        </h3>
        {selectedRole ? (
          <div className="mt-2 space-y-1">
            <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span className="truncate">{selectedRole.name}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
                  isProtectedRole
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                }`}
              >
                {isProtectedRole ? 'Protegido' : 'Editable'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-2">
              {selectedRole.description || 'Sin descripción asignada.'}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400 mt-1 italic">No hay rol seleccionado</p>
        )}
      </div>

      {selectedRole && (
        <>
          {/* Health Score & Risk Badge */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Score de Salud:</span>
              <span className="text-xs font-black text-primary-600 dark:text-primary-400">
                {analysis.healthScore} / 100
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Nivel de Riesgo:</span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${analysis.riskColor}`}>
                {analysis.riskLabel}
              </span>
            </div>
          </div>

          {/* Metric Counter Progress */}
          <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-600 dark:text-slate-400">Total Capacidades:</span>
              <span className="text-primary-600 dark:text-primary-400">
                {assignedCapIds.size} / {totalCapabilitiesCount}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-primary-600 h-full transition-all duration-300"
                style={{
                  width: `${totalCapabilitiesCount > 0 ? (assignedCapIds.size / totalCapabilitiesCount) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-slate-400 text-right">
              {((assignedCapIds.size / (totalCapabilitiesCount || 1)) * 100).toFixed(1)}% habilitado
            </p>
          </div>

          {/* Quick Action Navigation Tabs */}
          <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
            <button
              onClick={() => setActiveTab('MATRIX')}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-between transition-colors ${
                activeTab === 'MATRIX'
                  ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <span>🛡️ Matriz de Capacidades</span>
            </button>

            <button
              onClick={() => setActiveTab('SIMULATOR')}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-between transition-colors ${
                activeTab === 'SIMULATOR'
                  ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className="flex items-center gap-1.5"><Monitor className="h-3.5 w-3.5 text-indigo-500" /> Simular Rol</span>
            </button>

            <button
              onClick={() => setActiveTab('COMPARISON')}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-between transition-colors ${
                activeTab === 'COMPARISON'
                  ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className="flex items-center gap-1.5"><Scale className="h-3.5 w-3.5 text-indigo-500" /> Comparar Roles</span>
            </button>

            <button
              onClick={() => setActiveTab('DIAGNOSTICS')}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-between transition-colors ${
                activeTab === 'DIAGNOSTICS'
                  ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-rose-500" /> Diagnóstico & Salud</span>
              {analysis.conflicts.length > 0 && (
                <span className="text-[10px] font-black px-1.5 py-0.2 bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 rounded">
                  {analysis.conflicts.length}
                </span>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
