import React from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Zap,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Info,
} from 'lucide-react';
import { useRoleAnalysis } from '../../hooks/useRoleAnalysis';

interface RoleDiagnosticsProps {
  roleName: string;
  assignedCapIds: Set<string>;
  setAssignedCapIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  totalCapabilitiesCount?: number;
}

export const RoleDiagnostics: React.FC<RoleDiagnosticsProps> = ({
  roleName,
  assignedCapIds,
  setAssignedCapIds,
  totalCapabilitiesCount = 183,
}) => {
  const {
    analysis,
    handleApplyAllDependencies,
    handleAddSingleCapability,
    handleResolveAllConflicts,
  } = useRoleAnalysis(assignedCapIds, setAssignedCapIds, totalCapabilitiesCount);

  const {
    assignedCount,
    healthScore,
    healthStatus,
    riskLevel,
    riskLabel,
    riskColor,
    dependenciesMissing,
    conflicts,
    criticalActionsCount,
    recommendations,
  } = analysis;

  const scoreBadgeColor =
    healthScore >= 90
      ? 'bg-emerald-500 text-white'
      : healthScore >= 75
      ? 'bg-blue-500 text-white'
      : healthScore >= 60
      ? 'bg-amber-500 text-white'
      : 'bg-rose-600 text-white';

  return (
    <div className="space-y-6">
      {/* Executive Health Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary-400" />
            <h2 className="text-xl font-black tracking-tight">Diagnóstico Inteligente de Salud de Seguridad</h2>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Análisis automático de consistencia lógica, mapa de dependencias y auditoría de permisos para el rol{' '}
            <strong className="text-white">{roleName}</strong>.
          </p>
        </div>

        {/* Health Score Gauge */}
        <div className="flex items-center gap-4 bg-slate-800/80 p-4 rounded-xl border border-slate-700">
          <div className="text-center">
            <div className="text-3xl font-black tracking-tight text-white">{healthScore} / 100</div>
            <span className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full mt-1 ${scoreBadgeColor}`}>
              {healthStatus}
            </span>
          </div>

          <div className="h-10 w-px bg-slate-700" />

          <div>
            <span className="text-[11px] font-bold text-slate-400 block">Nivel de Riesgo Auditado</span>
            <span className={`inline-block text-xs font-black px-2.5 py-1 rounded-lg mt-0.5 ${riskColor}`}>
              {riskLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-bold text-slate-400 block">Capacidades Asignadas</span>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {assignedCount} <span className="text-xs text-slate-400 font-normal">/ {totalCapabilitiesCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-bold text-slate-400 block">Acciones Críticas</span>
          <div className="text-xl font-black text-amber-600 mt-1">{criticalActionsCount} activas</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-bold text-slate-400 block">Dependencias Faltantes</span>
          <div className="text-xl font-black text-rose-600 mt-1">{dependenciesMissing.length} violaciones</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-bold text-slate-400 block">Conflictos Lógicos</span>
          <div className="text-xl font-black text-indigo-600 mt-1">{conflicts.length} detectados</div>
        </div>
      </div>

      {/* Section 1: Conflict Resolution Bar */}
      {conflicts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                Se detectaron {conflicts.length} inconsistencias o permisos sin módulo base
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                El usuario posee acciones avanzadas habilitadas pero carece del permiso de acceso básico a los módulos.
              </p>
            </div>
          </div>

          <button
            onClick={handleResolveAllConflicts}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition-all flex-shrink-0"
          >
            <Sparkles className="h-4 w-4" /> Resolver Automáticamente (1-Clic)
          </button>
        </div>
      )}

      {/* Section 2: Detailed Dependencies List */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-rose-600" /> Mapa de Dependencias Directas
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Acciones que requieren un permiso previo para funcionar correctamente en el ERP.
            </p>
          </div>

          {dependenciesMissing.length > 0 && (
            <button
              onClick={handleApplyAllDependencies}
              className="px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-xl border border-indigo-200 transition-colors"
            >
              Aplicar Todas las Dependencias
            </button>
          )}
        </div>

        {dependenciesMissing.length === 0 ? (
          <div className="p-8 text-center text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl font-bold flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> ¡Todas las dependencias de capacidades están correctamente satisfechas!
          </div>
        ) : (
          <div className="space-y-3">
            {dependenciesMissing.map((dep) => (
              <div
                key={dep.capabilityId}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white">
                    <span>{dep.capabilityName}</span>
                    <span className="font-mono text-[10px] text-slate-400">({dep.capabilityId})</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span>Requiere permiso previo:</span>
                    <strong className="text-indigo-600 dark:text-indigo-400">{dep.missingPrerequisiteName}</strong>
                    <span className="font-mono text-[10px]">({dep.missingPrerequisiteId})</span>
                  </p>
                </div>

                <button
                  onClick={() => handleAddSingleCapability(dep.missingPrerequisiteId)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-colors self-start sm:self-auto"
                >
                  <span>Habilitar {dep.missingPrerequisiteName}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Enterprise Security Recommendations */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" /> Sugerencias de Optimización Enterprise
          </h3>
        </div>

        <div className="space-y-3">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-start gap-3 text-xs"
            >
              <Info className="h-4 w-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-slate-700 dark:text-slate-300 font-medium">{rec.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
