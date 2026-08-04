import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/ui/PageHeader';
import { ReportToolbar } from '../components/ui/ReportToolbar';
import { ReportService } from '../services/report.service';
import { warehouseApi } from '../services/warehouse.service';
import { Modal, Button } from '../components/ui';
import { translateAuditEvent } from '../utils/auditTranslator';
import { ShieldCheck, Activity, Eye, List, Search, Warehouse } from 'lucide-react';

export const Audit: React.FC = () => {
  const [dateRange, setDateRange] = useState('this_month');
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
  const [dateTo, setDateTo] = useState(new Date().toISOString());
  const [loading, setLoading] = useState(true);

  const [auditData, setAuditData] = useState<any>(null);
  const [auditViewMode, setAuditViewMode] = useState<'table' | 'timeline'>('table');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditModule, setAuditModule] = useState('ALL');
  const [auditAction, setAuditAction] = useState('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [auditPage, setAuditPage] = useState(1);
  const [selectedAuditItem, setSelectedAuditItem] = useState<any>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: warehouseApi.list,
  });

  const handleDateRangeChange = (range: string) => {
    setDateRange(range);
    const now = new Date();
    let from = new Date();
    let to = new Date();

    switch (range) {
      case 'today':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'this_week': {
        const day = now.getDay() || 7;
        from = new Date(now);
        from.setDate(now.getDate() - day + 1);
        from.setHours(0, 0, 0, 0);
        to = new Date(now);
        to.setHours(23, 59, 59, 999);
        break;
      }
      case 'this_month':
        from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        to = new Date(now);
        to.setHours(23, 59, 59, 999);
        break;
      case 'last_month':
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
        to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case 'this_year':
        from = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        to = new Date(now);
        to.setHours(23, 59, 59, 999);
        break;
      default:
        break;
    }

    setDateFrom(from.toISOString());
    setDateTo(to.toISOString());
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [dateFrom, dateTo, auditSearch, auditModule, auditAction, selectedWarehouse, auditPage]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const auditParams = {
        dateFrom,
        dateTo,
        search: auditSearch.trim() || undefined,
        module: auditModule !== 'ALL' ? auditModule : undefined,
        action: auditAction !== 'ALL' ? auditAction : undefined,
        warehouseId: selectedWarehouse !== 'ALL' ? selectedWarehouse : undefined,
        page: auditPage,
        limit: 15,
      };
      const response = await ReportService.getAudit(auditParams);
      setAuditData(response);
    } catch (e) {
      console.error("Error al cargar registros de auditoría", e);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setAuditSearch('');
    setAuditModule('ALL');
    setAuditAction('ALL');
    setAuditPage(1);
    handleDateRangeChange('this_month');
  };

  const handleExport = () => {
    alert("Exportando registros de auditoría...");
  };

  const renderBadgeForHumanEvent = (humanEvent: any) => {
    const colorClasses: Record<string, string> = {
      emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
      amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800',
      blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      purple: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    };
    const dotColors: Record<string, string> = {
      emerald: '🟢',
      amber: '🟡',
      rose: '🔴',
      blue: '🔵',
      purple: '🟣',
    };
    const color = humanEvent.badgeColor || 'blue';
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${colorClasses[color] || colorClasses.blue}`}>
        <span>{dotColors[color] || '🔵'}</span>
        <span>{humanEvent.title}</span>
      </span>
    );
  };

  const items = auditData?.items || [];
  const pagination = auditData?.pagination || { total: 0, page: 1, limit: 15, totalPages: 1 };

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Auditoría del Sistema"
        subtitle="Historial completo de acciones realizadas dentro del ERP."
      />

      <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
        {/* Toolbar superior con rango de fechas y exportación */}
        <ReportToolbar dateRange={dateRange} onDateRangeChange={handleDateRangeChange} onExport={handleExport} onClearFilters={handleClearFilters} />

        {/* Filtros específicos de auditoría & Modo de vista */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar usuario o acción..."
                value={auditSearch}
                onChange={(e) => {
                  setAuditSearch(e.target.value);
                  setAuditPage(1);
                }}
                className="pl-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs md:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>

            <select
              value={auditModule}
              onChange={(e) => {
                setAuditModule(e.target.value);
                setAuditPage(1);
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 font-medium"
            >
              <option value="ALL">Todos los Módulos</option>
              <option value="Sale">Ventas</option>
              <option value="Purchase">Compras</option>
              <option value="Stock">Stock</option>
              <option value="CashSession">Caja</option>
              <option value="Product">Productos</option>
              <option value="User">Usuarios</option>
            </select>

            <select
              value={selectedWarehouse}
              onChange={(e) => {
                setSelectedWarehouse(e.target.value);
                setAuditPage(1);
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 font-medium"
            >
              <option value="ALL">Todos los Depósitos</option>
              {warehouses.map((w: any) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom ? dateFrom.split('T')[0] : ''}
                onChange={(e) => setDateFrom(e.target.value ? new Date(e.target.value).toISOString() : '')}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 dark:[&::-webkit-calendar-picker-indicator]:invert"
              />
              <span className="text-xs text-slate-400">a</span>
              <input
                type="date"
                value={dateTo ? dateTo.split('T')[0] : ''}
                onChange={(e) => setDateTo(e.target.value ? new Date(e.target.value).toISOString() : '')}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 dark:[&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>

            {(auditSearch || auditModule !== 'ALL' || auditAction !== 'ALL') && (
              <button
                onClick={handleClearFilters}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 px-2 py-1 transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Selector de Modo de Vista (Tabla vs Timeline) */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-100 dark:bg-slate-950 shrink-0">
            <button
              onClick={() => setAuditViewMode('timeline')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
                auditViewMode === 'timeline'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity className="w-4 h-4" /> Línea de Tiempo
            </button>
            <button
              onClick={() => setAuditViewMode('table')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
                auditViewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-4 h-4" /> Tabla Detallada
            </button>
          </div>
        </div>

        {/* Contenido Principal */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            Cargando registros de auditoría del sistema...
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <ShieldCheck className="w-12 h-12 text-slate-400 mx-auto" />
            <p className="text-slate-600 dark:text-slate-400 font-medium">No se encontraron registros de auditoría.</p>
            <p className="text-xs text-slate-400">Prueba variando el término de búsqueda o rango de fechas.</p>
          </div>
        ) : auditViewMode === 'timeline' ? (
          /* VISTA TIMELINE */
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
            <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 space-y-8 pl-6">
              {items.map((log: any) => {
                const human = translateAuditEvent(log);
                return (
                  <div key={log.id} className="relative group">
                    {/* Icon Node */}
                    <div className="absolute -left-[31px] top-1 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-primary-500 flex items-center justify-center text-primary-500 shadow-xs">
                      <Activity className="w-3 h-3" />
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary-300 dark:hover:border-primary-800 transition-all space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                        <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
                          {human.date}
                        </span>
                        {renderBadgeForHumanEvent(human)}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 uppercase font-semibold block mb-0.5">Usuario</span>
                          <strong className="text-slate-900 dark:text-white">{human.user}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 uppercase font-semibold block mb-0.5">Categoría</span>
                          <strong className="text-slate-900 dark:text-white">{human.category}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 uppercase font-semibold block mb-0.5">Monto</span>
                          <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{human.amountFormatted || 'N/A'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 uppercase font-semibold block mb-0.5">Motivo</span>
                          <strong className="text-slate-700 dark:text-slate-300 italic truncate block" title={human.reason}>
                            {human.reason}
                          </strong>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => {
                            setSelectedAuditItem(log);
                            setIsAuditModalOpen(true);
                            setShowRawJson(false);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/50 transition-colors shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" /> Ver detalle
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* VISTA TABLA */
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400 border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-xs uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Fecha</th>
                    <th className="px-4 py-3.5">Evento Traducido</th>
                    <th className="px-4 py-3.5">Usuario</th>
                    <th className="px-4 py-3.5">Monto</th>
                    <th className="px-4 py-3.5">Motivo</th>
                    <th className="px-4 py-3.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {items.map((log: any) => {
                    const human = translateAuditEvent(log);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-900 dark:text-white">
                          {human.date}
                        </td>
                        <td className="px-4 py-3.5">
                          {renderBadgeForHumanEvent(human)}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-white">
                          <div>{human.user}</div>
                          {log.userEmail && <div className="text-[11px] text-slate-400 font-normal">{log.userEmail}</div>}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                          {human.amountFormatted || '-'}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400 italic truncate max-w-[200px]" title={human.reason}>
                          {human.reason}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button
                            onClick={() => {
                              setSelectedAuditItem(log);
                              setIsAuditModalOpen(true);
                              setShowRawJson(false);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/50 rounded-lg transition-colors border border-slate-200 dark:border-slate-800"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver detalle
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {pagination.totalPages > 1 && (
              <div className="bg-slate-50 dark:bg-slate-950 px-4 py-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500">
                  Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros totales)
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page === 1} onClick={() => setAuditPage(p => Math.max(p - 1, 1))}>
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" disabled={pagination.page === pagination.totalPages} onClick={() => setAuditPage(p => p + 1)}>
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL DETALLE DE AUDITORÍA */}
        {isAuditModalOpen && selectedAuditItem && (() => {
          const human = translateAuditEvent(selectedAuditItem);
          return (
            <Modal
              isOpen={isAuditModalOpen}
              onClose={() => {
                setIsAuditModalOpen(false);
                setSelectedAuditItem(null);
                setShowRawJson(false);
              }}
              title={
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary-500" />
                  <span>Auditoría del Sistema — Registro de Evento</span>
                </div>
              }
              size="7xl"
            >
              <div className="space-y-6">
                {/* VISTA HUMANA DE NEGOCIO */}
                <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        {human.title}
                      </h3>
                      <span className="text-xs text-slate-400 font-medium">Categoría: {human.category} • Módulo: {selectedAuditItem.entity || selectedAuditItem.module} ({selectedAuditItem.entityId})</span>
                    </div>
                    <div>{renderBadgeForHumanEvent(human)}</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 uppercase font-bold text-[10px] block mb-0.5">Usuario</span>
                      <strong className="text-slate-900 dark:text-white text-sm block">{human.user}</strong>
                      {selectedAuditItem.userEmail && <span className="text-slate-400 text-[11px] block">{selectedAuditItem.userEmail}</span>}
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase font-bold text-[10px] block mb-0.5">Fecha y Hora</span>
                      <strong className="text-slate-900 dark:text-white text-sm block font-mono">{human.date}</strong>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase font-bold text-[10px] block mb-0.5">Monto asociado</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 text-sm font-mono block">
                        {human.amountFormatted || 'N/A'}
                      </strong>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase font-bold text-[10px] block mb-0.5">Motivo</span>
                      <strong className="text-slate-900 dark:text-white text-sm block italic bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
                        {human.reason}
                      </strong>
                    </div>
                  </div>

                  {/* TABLA DE CAMBIOS EN LENGUAJE HUMANO */}
                  {human.details.length > 0 && (
                    <div className="pt-2">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                        Modificaciones Realizadas
                      </h4>
                      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-500 font-bold uppercase text-[10px]">
                            <tr>
                              <th className="px-3.5 py-2">Campo Modificado</th>
                              <th className="px-3.5 py-2">Valor Anterior (Antes)</th>
                              <th className="px-3.5 py-2">Valor Nuevo (Después)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                            {human.details.map((d, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                <td className="px-3.5 py-2 font-sans font-bold text-slate-800 dark:text-slate-200">{d.field}</td>
                                <td className="px-3.5 py-2 text-rose-600 dark:text-rose-400 line-through">{d.oldVal}</td>
                                <td className="px-3.5 py-2 text-emerald-600 dark:text-emerald-400 font-bold">{d.newVal}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* BOTÓN / DESPLEGABLE DE INFORMACIÓN TÉCNICA */}
                <div className="pt-2">
                  <button
                    onClick={() => setShowRawJson(!showRawJson)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <span>{showRawJson ? '▼ Ocultar información técnica' : '▶ Ver información técnica'}</span>
                  </button>

                  {showRawJson && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 animate-in fade-in duration-300">
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Datos anteriores (JSON)
                        </h4>
                        <div className="bg-slate-950 text-slate-100 p-4 rounded-xl border border-slate-800 font-mono text-xs overflow-auto max-h-[300px]">
                          {selectedAuditItem.oldData ? (
                            <pre>{JSON.stringify(selectedAuditItem.oldData, null, 2)}</pre>
                          ) : (
                            <span className="text-slate-500 italic">Sin datos anteriores</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Datos nuevos (JSON)
                        </h4>
                        <div className="bg-slate-950 text-slate-100 p-4 rounded-xl border border-slate-800 font-mono text-xs overflow-auto max-h-[300px]">
                          {selectedAuditItem.newData ? (
                            <pre>{JSON.stringify(selectedAuditItem.newData, null, 2)}</pre>
                          ) : (
                            <span className="text-slate-500 italic">Sin datos nuevos</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Modal>
          );
        })()}
      </div>
    </div>
  );
};
