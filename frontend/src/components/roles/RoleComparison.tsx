import React, { useState, useMemo } from 'react';
import {
  Scale,
  Download,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  ArrowRight,
  Shield,
  Layers,
} from 'lucide-react';
import { GroupedCapabilityModuleDto } from '../../services/capability.service';
import { compareRoles, exportComparisonToCSV, CapabilityDiffItem } from '../../utils/roleComparator';

interface RoleComparisonProps {
  roles: any[];
  groupedModules: GroupedCapabilityModuleDto[];
  roleCapabilitiesMap: Record<string, string[]>;
}

type FilterMode = 'ALL' | 'DIFF_ONLY' | 'ONLY_A' | 'ONLY_B' | 'SHARED';

export const RoleComparison: React.FC<RoleComparisonProps> = ({
  roles,
  groupedModules,
  roleCapabilitiesMap,
}) => {
  const editableRoles = roles.filter((r) => r.name !== 'Administrator' && r.name !== 'SuperAdmin');
  
  const [roleAId, setRoleAId] = useState<string>(editableRoles[0]?.id || roles[0]?.id || '');
  const [roleBId, setRoleBId] = useState<string>(editableRoles[1]?.id || roles[1]?.id || '');
  const [filterMode, setFilterMode] = useState<FilterMode>('DIFF_ONLY');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const selectedRoleA = roles.find((r) => r.id === roleAId);
  const selectedRoleB = roles.find((r) => r.id === roleBId);

  const comparisonSummary = useMemo(() => {
    if (!selectedRoleA || !selectedRoleB) return null;
    const capsA = roleCapabilitiesMap[roleAId] || [];
    const capsB = roleCapabilitiesMap[roleBId] || [];

    return compareRoles(
      { id: selectedRoleA.id, name: selectedRoleA.name, description: selectedRoleA.description, capabilityIds: capsA },
      { id: selectedRoleB.id, name: selectedRoleB.name, description: selectedRoleB.description, capabilityIds: capsB },
      groupedModules
    );
  }, [selectedRoleA, selectedRoleB, roleAId, roleBId, roleCapabilitiesMap, groupedModules]);

  const filteredItems = useMemo(() => {
    if (!comparisonSummary) return [];
    let list = comparisonSummary.items;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.module.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
      );
    }

    switch (filterMode) {
      case 'DIFF_ONLY':
        return list.filter((i) => i.status === 'ONLY_A' || i.status === 'ONLY_B');
      case 'ONLY_A':
        return list.filter((i) => i.status === 'ONLY_A');
      case 'ONLY_B':
        return list.filter((i) => i.status === 'ONLY_B');
      case 'SHARED':
        return list.filter((i) => i.status === 'BOTH');
      default:
        return list;
    }
  }, [comparisonSummary, filterMode, searchTerm]);

  if (!comparisonSummary) {
    return <div className="p-8 text-center text-slate-400">Cargando datos para comparación...</div>;
  }

  const { roleA, roleB, sharedCount, onlyACount, onlyBCount, differencesCount } = comparisonSummary;

  return (
    <div className="space-y-6">
      {/* Header Selectors */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Scale className="h-5 w-5 text-indigo-600" /> Comparador Lado a Lado de Roles
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Analice diferencias de permisos, acciones críticas y nivel de riesgo entre dos roles.
            </p>
          </div>

          <button
            onClick={() => exportComparisonToCSV(comparisonSummary)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all"
          >
            <Download className="h-4 w-4" /> Exportar Matriz (CSV)
          </button>
        </div>

        {/* Dual Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <label className="text-xs font-black text-indigo-600 uppercase tracking-wider block">
              Seleccionar Rol A (Base):
            </label>
            <select
              value={roleAId}
              onChange={(e) => setRoleAId(e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({roleCapabilitiesMap[r.id]?.length || 0} permisos)
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <label className="text-xs font-black text-indigo-600 uppercase tracking-wider block">
              Seleccionar Rol B (A comparar):
            </label>
            <select
              value={roleBId}
              onChange={(e) => setRoleBId(e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({roleCapabilitiesMap[r.id]?.length || 0} permisos)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Executive Summary Diff Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card A */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-900 dark:text-white">{roleA.name}</h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${roleA.analysis.riskColor}`}>
              {roleA.analysis.riskLabel}
            </span>
          </div>
          <div className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between"><span>Capacidades:</span><span className="font-bold text-slate-900 dark:text-white">{roleA.analysis.assignedCount}</span></div>
            <div className="flex justify-between"><span>Acciones Críticas:</span><span className="font-bold text-amber-600">{roleA.analysis.criticalActionsCount}</span></div>
            <div className="flex justify-between"><span>Health Score:</span><span className="font-bold text-primary-600">{roleA.analysis.healthScore} / 100</span></div>
          </div>
        </div>

        {/* Diff KPI */}
        <div className="bg-indigo-900 text-white p-5 rounded-2xl border border-indigo-800 shadow-md flex flex-col justify-between space-y-2">
          <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Resumen de Diferencias</span>
          <div className="text-2xl font-black">{differencesCount} permisos distintos</div>
          <p className="text-[11px] text-indigo-200">
            {onlyACount} exclusivos de {roleA.name} | {onlyBCount} exclusivos de {roleB.name} | {sharedCount} compartidos.
          </p>
        </div>

        {/* Card B */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-900 dark:text-white">{roleB.name}</h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${roleB.analysis.riskColor}`}>
              {roleB.analysis.riskLabel}
            </span>
          </div>
          <div className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between"><span>Capacidades:</span><span className="font-bold text-slate-900 dark:text-white">{roleB.analysis.assignedCount}</span></div>
            <div className="flex justify-between"><span>Acciones Críticas:</span><span className="font-bold text-amber-600">{roleB.analysis.criticalActionsCount}</span></div>
            <div className="flex justify-between"><span>Health Score:</span><span className="font-bold text-primary-600">{roleB.analysis.healthScore} / 100</span></div>
          </div>
        </div>
      </div>

      {/* Control Bar & Filter Tabs */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterMode('DIFF_ONLY')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              filterMode === 'DIFF_ONLY'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Diferencias ({differencesCount})
          </button>
          <button
            onClick={() => setFilterMode('ONLY_A')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              filterMode === 'ONLY_A'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Solo en {roleA.name} ({onlyACount})
          </button>
          <button
            onClick={() => setFilterMode('ONLY_B')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              filterMode === 'ONLY_B'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Solo en {roleB.name} ({onlyBCount})
          </button>
          <button
            onClick={() => setFilterMode('SHARED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              filterMode === 'SHARED'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Compartidos ({sharedCount})
          </button>
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              filterMode === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Todos ({comparisonSummary.totalCapabilitiesCount})
          </button>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filtrar por nombre o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 font-extrabold text-slate-500 uppercase tracking-wider sticky top-0">
                <th className="p-3 pl-4">Módulo</th>
                <th className="p-3">Capacidad / Acción</th>
                <th className="p-3 text-center w-32">{roleA.name}</th>
                <th className="p-3 text-center w-32">{roleB.name}</th>
                <th className="p-3 text-right pr-4 w-44">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 pl-4 font-bold text-slate-900 dark:text-white">{item.module}</td>
                  <td className="p-3 space-y-0.5">
                    <div className="font-extrabold text-slate-900 dark:text-slate-100">{item.name}</div>
                    <div className="text-[10px] font-mono text-slate-400">{item.id}</div>
                  </td>
                  <td className="p-3 text-center">
                    {item.hasRoleA ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-400 mx-auto opacity-60" />
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {item.hasRoleB ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-400 mx-auto opacity-60" />
                    )}
                  </td>
                  <td className="p-3 text-right pr-4">
                    {item.status === 'BOTH' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        ✔ Ambos poseen
                      </span>
                    )}
                    {item.status === 'ONLY_A' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        Solo en {roleA.name}
                      </span>
                    )}
                    {item.status === 'ONLY_B' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Solo en {roleB.name}
                      </span>
                    )}
                    {item.status === 'NEITHER' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-400 dark:bg-slate-800">
                        Ninguno
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
