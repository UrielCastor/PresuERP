import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import api from '@/services/api';
import { 
  Activity, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  UserCheck,
  Building,
  CreditCard,
  Settings,
  AlertOctagon,
  Eye,
  X,
  FileText
} from 'lucide-react';

export const SystemAudit: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [limit] = useState(25);

  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const [filters, setFilters] = useState({
     search: '',
     actionType: '',
     entityName: '',
     startDate: '',
     endDate: ''
  });

  useEffect(() => {
     fetchStats();
  }, []);

  useEffect(() => {
     fetchLogs();
  }, [page, filters]);

  const fetchStats = async () => {
     try {
       const { data } = await api.get('/system/audit/stats');
       setStats(data.data);
     } catch (e) {
       console.error("Stats fetching err", e);
     }
  };

  const fetchLogs = async () => {
     try {
       setLoading(true);
       const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          ...filters
       });
       
       const { data } = await api.get(`/system/audit?${params.toString()}`);
       setLogs(data.data.data);
       setTotalPages(data.data.totalPages);
       setTotalRecords(data.data.total);
     } catch (e) {
       console.error("Logs fetching err", e);
     } finally {
       setLoading(false);
     }
  };

  const handleFilterChange = (field: string, value: string) => {
     setFilters(prev => ({ ...prev, [field]: value }));
     setPage(1); // reset pagination when filtering
  };

  const getActionIcon = (action: string) => {
     if (action.includes('LOGIN')) return <UserCheck className="w-4 h-4 text-sky-500" />;
     if (action.includes('PAYMENT') || action.includes('SUBSCRIPTION')) return <CreditCard className="w-4 h-4 text-emerald-500" />;
     if (action.includes('BUSINESS') || action.includes('PLAN')) return <Building className="w-4 h-4 text-indigo-500" />;
     if (action.includes('ERROR')) return <AlertOctagon className="w-4 h-4 text-red-500" />;
     return <Settings className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1400px]">
      <PageHeader 
        title="Auditoría Global"
        subtitle="Registro inmutable de actividades en el Ecosistema ERP"
      />

      {/* KPI Stats */}
      {stats && (
         <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <StatCard title="Eventos (Histórico)" value={stats.total.toLocaleString()} icon={FileText} colorVariant="primary" />
            <StatCard title="Eventos (Hoy)" value={stats.todayTotal.toLocaleString()} icon={Activity} colorVariant="info" />
            <StatCard title="Autenticaciones" value={stats.logins.toLocaleString()} icon={UserCheck} colorVariant="success" />
            <StatCard title="Acciones Staff/Admin" value={stats.staffActions.toLocaleString()} icon={Settings} colorVariant="warning" />
            <StatCard title="Errores Críticos" value={stats.errors.toLocaleString()} icon={AlertOctagon} colorVariant="danger" />
         </div>
      )}

      {/* Main Panel */}
      <Card>
         <CardContent className="p-0">
            {/* Filters Bar */}
            <div className="p-4 border-b bg-slate-50 flex flex-col md:flex-row gap-3">
               <div className="flex-1 relative">
                 <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                 <input 
                   type="text" 
                   className="pl-9 pr-4 py-2 w-full border rounded-lg focus:ring-2 outline-none" 
                   placeholder="Buscar texto en auditoría..." 
                   value={filters.search}
                   onChange={e => handleFilterChange('search', e.target.value)}
                 />
               </div>
               <div className="flex w-full md:w-auto gap-2">
                 <select 
                   value={filters.entityName}
                   onChange={e => handleFilterChange('entityName', e.target.value)}
                   className="p-2 border rounded-lg text-sm bg-white"
                 >
                    <option value="">Todas las Entidades</option>
                    <option value="USER">User (Usuarios)</option>
                    <option value="BUSINESS">Business (Empresas)</option>
                    <option value="INVOICE">Invoice (Billing)</option>
                    <option value="SUBSCRIPTION">Subscription</option>
                 </select>
                 
                 <select 
                   value={filters.actionType}
                   onChange={e => handleFilterChange('actionType', e.target.value)}
                   className="p-2 border rounded-lg text-sm bg-white"
                 >
                    <option value="">Cualquier Acción</option>
                    <option value="LOGIN_SUCCESS">Login Exitoso</option>
                    <option value="PAYMENT_APPROVED">Cobro Aprobado</option>
                    <option value="PLAN_CHANGED">Cambio de Plan</option>
                    <option value="CREATE">Creación DB</option>
                    <option value="UPDATE">Modificación DB</option>
                 </select>

                 <input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} className="p-2 border rounded-lg text-sm bg-white" />
                 <input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} className="p-2 border rounded-lg text-sm bg-white" />
               </div>
            </div>

            {/* Logs Table */}
            <div className="overflow-x-auto min-h-[400px]">
               <table className="w-full text-left text-sm text-slate-600">
                 <thead className="bg-slate-50 text-slate-500 font-bold border-b text-xs sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Empresa (Tenant)</th>
                      <th className="px-4 py-3">Usuario Ejecutor</th>
                      <th className="px-4 py-3">Acción Registrada</th>
                      <th className="px-4 py-3">Entidad Target</th>
                      <th className="px-4 py-3">IP / Origen</th>
                      <th className="px-4 py-3 text-center">Trazabilidad</th>
                    </tr>
                 </thead>
                 <tbody>
                    {loading ? (
                      <tr><td colSpan={7} className="text-center p-8 text-slate-400">Recopilando registros...</td></tr>
                    ) : logs.length === 0 ? (
                      <tr><td colSpan={7} className="text-center p-8 text-slate-400">No se localizaron registros bajo los filtros actuales.</td></tr>
                    ) : (
                      logs.map((log: any) => (
                         <tr key={log.id} className="border-b hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700">
                               <div className="flex flex-col">
                                  <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                                  <span className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleTimeString()}</span>
                               </div>
                            </td>
                            <td className="px-4 py-3">
                               <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                     {log.business?.name?.charAt(0) || '-'}
                                  </div>
                                  <span className="font-semibold text-slate-700">{log.business?.name || 'SYSTEM_GLOBAL'}</span>
                               </div>
                            </td>
                            <td className="px-4 py-3">{log.user?.name || log.user?.email || 'N/A (Automático)'}</td>
                            <td className="px-4 py-3">
                               <div className="flex items-center gap-2">
                                  {getActionIcon(log.actionType)}
                                  <span className="font-semibold">{log.actionType}</span>
                               </div>
                            </td>
                            <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-700 font-medium">{log.entityName}</span></td>
                            <td className="px-4 py-3 font-mono text-xs">{log.ipAddress || 'Interno (Cron/SDK)'}</td>
                            <td className="px-4 py-3 text-center">
                               <button 
                                 onClick={() => setSelectedLog(log)}
                                 className="px-3 py-1 bg-white border border-slate-200 rounded-md text-indigo-600 hover:bg-indigo-50 font-medium text-xs flex items-center gap-1 mx-auto"
                               >
                                 <Eye className="w-3 h-3" /> Inspeccionar
                               </button>
                            </td>
                         </tr>
                      ))
                    )}
                 </tbody>
               </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t flex items-center justify-between bg-slate-50 rounded-b-lg">
               <span className="text-sm font-medium text-slate-500">Mostrando página {page} de {totalPages} ({totalRecords} eventos)</span>
               <div className="flex items-center gap-2">
                  <button 
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="p-1 rounded-md border text-slate-600 disabled:opacity-50 hover:bg-white"
                  >
                     <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    disabled={page === totalPages || totalPages === 0}
                    onClick={() => setPage(p => p + 1)}
                    className="p-1 rounded-md border text-slate-600 disabled:opacity-50 hover:bg-white"
                  >
                     <ChevronRight className="w-4 h-4" />
                  </button>
               </div>
            </div>
         </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedLog && (
         <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
               <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="text-lg font-black flex items-center gap-2">
                     <Activity className="w-5 h-5 text-indigo-600" /> Trazabilidad de Auditoría
                  </h3>
                  <button onClick={() => setSelectedLog(null)} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
               </div>
               
               <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-6">
                  {/* Event Meta */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded-lg border">
                      <div><span className="block text-xs uppercase font-bold text-slate-400">Timestamp</span><span className="font-semibold text-sm">{new Date(selectedLog.createdAt).toLocaleString()}</span></div>
                      <div><span className="block text-xs uppercase font-bold text-slate-400">Usuario Origen</span><span className="font-semibold text-sm">{selectedLog.user?.email || 'SYSTEM API_CALL'}</span></div>
                      <div><span className="block text-xs uppercase font-bold text-slate-400">Tenant (Empresa)</span><span className="font-semibold text-sm">{selectedLog.business?.name || 'GLOBAL SAAS'}</span></div>
                      <div><span className="block text-xs uppercase font-bold text-slate-400">IP Autor</span><span className="font-mono text-sm">{selectedLog.ipAddress || 'Desconocida'}</span></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="bg-slate-900 rounded-lg border p-4 shadow-inner">
                        <span className="block text-xs uppercase font-black text-slate-400 mb-2 tracking-widest border-b border-slate-700 pb-2">Payload Previo (Anterior)</span>
                        <pre className="text-emerald-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-64 mt-2">
                           {selectedLog.previousValues ? JSON.stringify(JSON.parse(selectedLog.previousValues), null, 2) : 'No se registraron cambios retrospectivos. (N/A)'}
                        </pre>
                     </div>
                     <div className="bg-slate-900 rounded-lg border p-4 shadow-inner">
                        <span className="block text-xs uppercase font-black text-slate-400 mb-2 tracking-widest border-b border-slate-700 pb-2">Payload Inyectado (Nuevo/Change)</span>
                        <pre className="text-sky-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-64 mt-2">
                           {selectedLog.newValues ? JSON.stringify(JSON.parse(selectedLog.newValues), null, 2) : 'No se inyectaron mutadores JSON. (N/A)'}
                        </pre>
                     </div>
                  </div>
                  <div className="mt-4 p-4 border-l-4 border-yellow-400 bg-yellow-50 text-yellow-800 text-xs font-medium rounded-r">
                     Ciertas claves de integración y tokens confidenciales han sido dinámicamente redactados [****] de este JSON mediante el servicio de mascarado por estrictas políticas de confidencialidad de datos.
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
