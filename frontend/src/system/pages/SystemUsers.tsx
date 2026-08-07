import React, { useState, useEffect } from 'react';
import { swalSuccess, swalConfirm, swalPrompt, swalInfo, handleApiError } from '../../utils/swal';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { DataGrid } from '../../components/ui/DataGrid';
import { SystemService } from '../services/system.service';
import { Search, Info, Shield, Check, X, Eye, Calendar, UserCheck, UserX, ExternalLink, Lock, AlertTriangle } from 'lucide-react';

export const SystemUsers: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchName, setSearchName] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Details Modal State
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailsData, setDetailsData] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Log Modal State
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const bizList = await SystemService.getBusinesses();
      setBusinesses(bizList);
      await fetchUsers();
    } catch (error) {
      console.error('Error fetching system dashboard initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (searchName) filters.search = searchName;
      if (selectedBusinessId) filters.businessId = selectedBusinessId;
      if (selectedRole) filters.roleId = selectedRole;
      if (selectedStatus) filters.status = selectedStatus;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const userList = await SystemService.getUsers(filters);
      
      // Secondary filter in memory for email since backend OR condition matches both
      let processedList = userList;
      if (searchEmail) {
        processedList = userList.filter((u: any) =>
          u.email.toLowerCase().includes(searchEmail.toLowerCase())
        );
      }
      setUsers(processedList);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleClearFilters = () => {
    setSearchName('');
    setSearchEmail('');
    setSelectedBusinessId('');
    setSelectedRole('');
    setSelectedStatus('');
    setStartDate('');
    setEndDate('');
    // Trigger reset list
    setTimeout(() => {
      SystemService.getUsers().then(setUsers);
    }, 50);
  };

  const viewUser = async (id: string) => {
    try {
      setSelectedUserId(id);
      setIsDetailsOpen(true);
      setLoadingDetails(true);
      setDetailsData(null);
      const data = await SystemService.getUserDetails(id);
      setDetailsData(data);
    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const toggleStatus = async (id: string, currentActive: boolean, isDeleted?: boolean) => {
    const actionLabel = isDeleted ? 'RESTAURAR' : (currentActive ? 'SUSPENDER' : 'ACTIVAR');
    const confirmed = await swalConfirm(
      `¿${actionLabel} Usuario?`,
      `¿Está seguro de que desea ${actionLabel} a este usuario del sistema SaaS?`,
      `Sí, ${actionLabel.toLowerCase()}`,
      'Cancelar'
    );
    if (confirmed) {
      try {
        await SystemService.updateUserStatus(id, !currentActive);
        
        if (isDetailsOpen && selectedUserId === id) {
          const data = await SystemService.getUserDetails(id);
          setDetailsData(data);
        }
        
        await fetchUsers();
        swalSuccess('Estado Actualizado', `Usuario ${actionLabel.toLowerCase()}do correctamente.`);
      } catch (error: any) {
        handleApiError(error, 'Error de Estado');
      }
    }
  };

  const resetPasswordFuture = () => {
    swalInfo('Próximamente', 'Esta acción estará disponible en la próxima versión integrando un servidor SMTP para el envío de correos.');
  };

  const handleDeleteUser = async (id: string, name: string) => {
    const confirmDelete = await swalConfirm(
      '¿Eliminar Usuario?',
      `¿Está seguro de que desea eliminar definitivamente al usuario "${name}"? Esta acción no se puede deshacer.`,
      'Sí, eliminar usuario',
      'Cancelar'
    );
    if (confirmDelete) {
      const reasonVal = await swalPrompt('Motivo de Eliminación', 'Ingrese el motivo de la eliminación (opcional):');
      if (reasonVal === null) return;

      try {
        await SystemService.deleteUser(id, reasonVal.trim() || undefined);
        swalSuccess('Usuario Eliminado', 'El usuario del sistema fue eliminado exitosamente.');
        setIsDetailsOpen(false);
        fetchUsers();
      } catch (error: any) {
        handleApiError(error, 'Error al Eliminar Usuario');
      }
    }
  };

  const formatJsonPayload = (val: string | null) => {
    if (!val) return 'Sin datos';
    try {
      if (val.startsWith('{') || val.startsWith('[')) {
        return JSON.stringify(JSON.parse(val), null, 2);
      }
      return val;
    } catch {
      return val;
    }
  };

  const getStatusBadge = (active: boolean, deletedAt?: string | null) => {
    if (deletedAt) {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 inline-flex items-center gap-1">
          ⚫ Eliminado
        </span>
      );
    }
    return active ? (
      <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700 inline-flex items-center gap-1">
        🟢 Activo
      </span>
    ) : (
      <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700 inline-flex items-center gap-1">
        🟠 Suspendido
      </span>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Sin registros';
    const d = new Date(dateString);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Sin registros';
    const d = new Date(dateString);
    const date = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    return `${date} - ${time}`;
  };

  const parseLastNameAndFirstName = (fullName: string) => {
    const parts = fullName.trim().split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || 'N/A';
    return { firstName, lastName };
  };

  const columns = [
    {
      header: 'Nombre / Email',
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            {row.isStaff && <span title="Saga Global Staff"><Shield className="w-3.5 h-3.5 text-indigo-500" /></span>}
            {row.name}
          </span>
          <span className="text-xs text-slate-500">{row.email}</span>
        </div>
      )
    },
    {
      header: 'Empresa',
      cell: (row: any) => {
        if (row.deletedAt) {
          return <span className="text-red-500 font-semibold italic text-xs">Empresa eliminada</span>;
        }
        if (!row.business) return <span className="text-slate-400 italic">Sin empresa (Staff)</span>;
        if (row.business.deletedAt) {
          return <span className="text-red-500 font-semibold italic text-xs">Empresa eliminada</span>;
        }
        return (
          <span className="font-medium text-slate-700">
            {row.business.name}
          </span>
        );
      }
    },
    {
      header: 'Rol ERP',
      cell: (row: any) => {
        if (row.isStaff) return <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-xs font-bold">Global Operator</span>;
        return (
          <span className="px-2 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 rounded text-xs font-medium">
            {row.role?.name || 'Administrador'}
          </span>
        );
      }
    },
    {
      header: 'Estado',
      cell: (row: any) => getStatusBadge(row.isActive, row.deletedAt)
    },
    {
      header: 'Registro',
      cell: (row: any) => formatDate(row.createdAt)
    },
    {
      header: 'Acciones',
      cell: (row: any) => (
        <div className="flex gap-2">
          <button
            onClick={() => viewUser(row.id)}
            className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded text-sm hover:bg-indigo-100 font-medium inline-flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" /> Ver
          </button>
          
          {row.deletedAt ? (
            <button
              onClick={() => toggleStatus(row.id, false, true)}
              className="px-3 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded text-sm font-medium"
            >
              Restaurar
            </button>
          ) : (
            <button
              onClick={() => toggleStatus(row.id, row.isActive)}
              className={`px-3 py-1 rounded text-sm font-medium ${
                row.isActive 
                  ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' 
                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
              }`}
            >
              {row.isActive ? 'Suspender' : 'Activar'}
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Gestión Global de Usuarios"
        subtitle="Administración centralizada y auditoría de todos los usuarios registrados en el ecosistema"
      />

      {/* Filters Card */}
      <Card>
        <CardContent className="p-4 border-b bg-slate-50/50">
          <form onSubmit={handleApplyFilters} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Buscar usuario</label>
                <input
                  type="text"
                  placeholder="Nombre o email..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Buscar email</label>
                <input
                  type="text"
                  placeholder="ejemplo@empresa.com..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Empresa</label>
                <select
                  value={selectedBusinessId}
                  onChange={(e) => setSelectedBusinessId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                >
                  <option value="">Todas las empresas</option>
                  <option value="unassigned">Sin Empresa (Staff)</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rol ERP</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                >
                  <option value="">Todos los roles</option>
                  <option value="staff">Staff Global</option>
                  <option value="Administrator">Administrador</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Cajero">Cajero</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estado</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                >
                  <option value="">Activos y Suspendidos</option>
                  <option value="active">🟢 Activos</option>
                  <option value="suspended">🟠 Suspendidos</option>
                  <option value="deleted">⚫ Eliminados</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha Registro Desde</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha Registro Hasta</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                />
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Search className="w-4 h-4" /> Buscar
                </button>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
                >
                  Limpiar
                </button>
              </div>
            </div>
          </form>
        </CardContent>
        <CardContent className="p-0">
          <DataGrid
            columns={columns}
            data={users}
            isLoading={loading}
            keyExtractor={(item) => (item as any).id}
          />
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Modal 
        isOpen={isDetailsOpen} 
        onClose={() => setIsDetailsOpen(false)} 
        title="Ficha Detallada de Usuario"
      >
        {loadingDetails ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
            <div className="text-slate-500 font-medium">Obteniendo perfil del usuario...</div>
          </div>
        ) : detailsData ? (
          <div className="space-y-4">
            
            {/* Header info compact block */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 bg-slate-50 p-2.5 border rounded-lg text-xs">
              <div className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xs border border-indigo-200 uppercase">
                {detailsData.user.name.charAt(0)}
              </div>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                {detailsData.user.name}
                {detailsData.user.isStaff && <span title="Global Operator Staff"><Shield className="w-3 h-3 text-indigo-600" /></span>}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 font-mono">{detailsData.user.email}</span>
              <span className="text-slate-300">|</span>
              {getStatusBadge(detailsData.user.isActive, detailsData.user.deletedAt)}
              <span className="text-slate-300">|</span>
              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-[3px] text-[10px] font-semibold">
                {detailsData.user.isStaff ? 'Global Operator' : (detailsData.user.role?.name || 'Administrador')}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-700 font-semibold">
                {detailsData.user.deletedAt 
                  ? 'Empresa eliminada' 
                  : detailsData.user.business?.deletedAt 
                    ? 'Empresa eliminada' 
                    : (detailsData.user.business?.name || 'Sin empresa (Staff)')}
              </span>
              {detailsData.user.business && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-[3px] text-[10px] font-bold font-mono">
                    {detailsData.user.business.subscriptionPlan || 'FREE'}
                  </span>
                </>
              )}
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              <div className="bg-slate-50 border border-slate-100 rounded-md p-1.5 text-center">
                <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Registrado</span>
                <span className="text-[11px] font-semibold text-slate-700 font-mono">
                  {formatDate(detailsData.user.createdAt)}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-md p-1.5 text-center">
                <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Último Acceso</span>
                <span className="text-[11px] font-semibold text-slate-700 font-mono">
                  {formatDateTime(detailsData.lastLogin)}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-md p-1.5 text-center">
                <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Logins</span>
                <span className="text-[11px] font-bold text-indigo-700 font-mono">
                  {detailsData.loginCount} ingresos
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-md p-1.5 text-center">
                <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Actividad Reciente</span>
                <span className="text-[11px] font-semibold text-slate-700 font-mono">
                  {detailsData.recentActivity?.length || 0} logs
                </span>
              </div>
            </div>

            {/* Desktop Two-Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              
              {/* Left Column: Personal and Organization details */}
              <div className="space-y-3">
                {/* Personal Info */}
                <div className="bg-white border border-slate-200 rounded-md p-2.5 shadow-xs">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b pb-1 mb-2">
                    Información Personal
                  </h4>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
                    <div>
                      <span className="block text-[8px] uppercase text-slate-400">Nombre</span>
                      <span className="font-semibold text-slate-800">
                        {parseLastNameAndFirstName(detailsData.user.name).firstName}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[8px] uppercase text-slate-400">Apellido</span>
                      <span className="font-semibold text-slate-800">
                        {parseLastNameAndFirstName(detailsData.user.name).lastName}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[8px] uppercase text-slate-400">Rol ERP</span>
                      <span className="font-semibold text-slate-800">
                        {detailsData.user.isStaff ? 'System Staff' : (detailsData.user.role?.name || 'Administrador')}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[8px] uppercase text-slate-400">Estado</span>
                      <span className="font-semibold">
                        {detailsData.user.deletedAt 
                          ? '⚫ Eliminado' 
                          : detailsData.user.isActive 
                            ? '🟢 Activo' 
                            : '🟠 Suspendido'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Organization Details */}
                <div className="bg-white border border-slate-200 rounded-md p-2.5 shadow-xs">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b pb-1 mb-2">
                    Suscripción & Organización
                  </h4>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
                    <div>
                      <span className="block text-[8px] uppercase text-slate-400">Empresa</span>
                      <span className="font-semibold text-slate-800 truncate block" title={detailsData.user.business?.name}>
                        {detailsData.user.deletedAt 
                          ? 'Empresa eliminada' 
                          : detailsData.user.business?.deletedAt 
                            ? 'Empresa eliminada' 
                            : (detailsData.user.business?.name || 'Sin empresa (Staff)')}
                      </span>
                    </div>
                    {detailsData.user.business && (
                      <div>
                        <span className="block text-[8px] uppercase text-slate-400">Plan Asignado</span>
                        <span className="font-bold text-indigo-700 font-mono">
                          {detailsData.user.business.subscriptionPlan || 'FREE'}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="block text-[8px] uppercase text-slate-400">Vencimiento Plan</span>
                      <span className="font-semibold text-slate-800">
                        {detailsData.user.business?.subscriptionEndsAt 
                          ? formatDate(detailsData.user.business.subscriptionEndsAt) 
                          : 'Ilimitado / Sin vencimiento'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Recent Activity Logs (JSON-free list) */}
              <div id="recent-activity-container" className="bg-white border border-slate-200 rounded-md p-2.5 shadow-xs flex flex-col transition-all duration-300 scroll-mt-24">
                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b pb-1 mb-2">
                  Actividad Reciente
                </h4>
                {detailsData.recentActivity && detailsData.recentActivity.length > 0 ? (
                  <div className="space-y-1.5 overflow-y-auto max-h-48 pr-0.5 flex-1">
                    {detailsData.recentActivity.map((log: any) => (
                      <div key={log.id} className="text-[10px] border-b pb-1.5 border-slate-100 last:border-0 last:pb-0 flex items-start gap-1 py-0.5">
                        <span className="text-xs select-none mt-0.5">
                          {log.actionType.includes('CREATE') || log.actionType.includes('ADD') ? '📝' : 
                           log.actionType.includes('UPDATE') || log.actionType.includes('EDIT') ? '🔧' : 
                           log.actionType.includes('DELETE') || log.actionType.includes('REMOVE') ? '🗑️' : 
                           log.actionType.includes('LOGIN') ? '🔑' : '📋'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-slate-400 text-[8px] font-mono">
                            <span className="font-bold text-slate-600">{log.actionType}</span>
                            <span>{formatDateTime(log.createdAt)}</span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5 gap-1">
                            <span className="text-slate-600 truncate block font-medium" title={`${log.entityName} ID: ${log.entityId}`}>
                              {log.entityName}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLog(log);
                                setIsLogModalOpen(true);
                              }}
                              className="text-[9px] text-indigo-600 hover:text-indigo-800 hover:underline font-bold shrink-0"
                            >
                              Ver detalle
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 italic text-[11px] flex-1 flex items-center justify-center">
                    Sin logs de actividad recientes.
                  </div>
                )}
              </div>

            </div>

            {/* Actions panel */}
            <div className="pt-3 flex flex-wrap gap-2 border-t justify-between items-center text-xs">
              {/* Danger Actions Left */}
              {!detailsData.user.deletedAt && (
                <button
                  type="button"
                  onClick={() => handleDeleteUser(detailsData.user.id, detailsData.user.name)}
                  className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-md font-semibold flex items-center gap-1 shadow-2xs transition-colors"
                >
                  <UserX className="w-3.5 h-3.5" /> Eliminar Definitivamente
                </button>
              )}

              {/* Standard Actions Right */}
              <div className="flex gap-1.5">
                {detailsData.user.deletedAt ? (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleStatus(detailsData.user.id, false, true)}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-md font-semibold flex items-center gap-1 shadow-2xs transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Restaurar usuario
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const activityLogContainer = document.getElementById('recent-activity-container');
                        if (activityLogContainer) {
                          activityLogContainer.scrollIntoView({ behavior: 'smooth' });
                          activityLogContainer.classList.add('ring-2', 'ring-indigo-500');
                          setTimeout(() => {
                            activityLogContainer.classList.remove('ring-2', 'ring-indigo-500');
                          }, 2000);
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-semibold flex items-center gap-1 shadow-2xs transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver historial
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleStatus(detailsData.user.id, detailsData.user.isActive)}
                      className={`px-3 py-1.5 rounded-md font-semibold flex items-center justify-center gap-1 shadow-2xs transition-colors ${
                        detailsData.user.isActive
                          ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      {detailsData.user.isActive ? (
                        <>
                          <UserX className="w-3.5 h-3.5" /> Suspender
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" /> Activar
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={resetPasswordFuture}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-md font-semibold flex items-center gap-1 shadow-2xs transition-colors"
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-400" /> Clave
                    </button>
                  </>
                )}

                {detailsData.user.business && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailsOpen(false);
                      navigate(`/system/businesses?search=${encodeURIComponent(detailsData.user.business.name)}`);
                    }}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md font-semibold flex items-center gap-1 shadow-2xs transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Empresa
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsOpen(false);
                    navigate(`/system/audit?userId=${detailsData.user.id}`);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-md font-semibold transition-colors"
                >
                  Auditoría
                </button>

                <button
                  type="button"
                  onClick={() => setIsDetailsOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-md font-semibold hover:bg-slate-50 text-slate-600 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500 font-medium">Error al cargar ficha de usuario.</div>
        )}
      </Modal>

      {/* Log Payload Modal */}
      <Modal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title="Detalle del Log de Actividad"
      >
        {selectedLog && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border">
              <div>
                <span className="block text-[9px] uppercase text-slate-400 font-bold">Tipo de Acción</span>
                <span className="font-bold text-slate-700">{selectedLog.actionType}</span>
              </div>
              <div>
                <span className="block text-[9px] uppercase text-slate-400 font-bold">Fecha / Hora</span>
                <span className="font-semibold text-slate-700">{formatDateTime(selectedLog.createdAt)}</span>
              </div>
              <div className="mt-1">
                <span className="block text-[9px] uppercase text-slate-400 font-bold">Entidad Afectada</span>
                <span className="font-semibold text-slate-700">{selectedLog.entityName} (ID: {selectedLog.entityId})</span>
              </div>
              {selectedLog.ipAddress && (
                <div className="mt-1">
                  <span className="block text-[9px] uppercase text-slate-400 font-bold">Dirección IP</span>
                  <span className="font-mono text-slate-700">{selectedLog.ipAddress}</span>
                </div>
              )}
            </div>

            {selectedLog.previousValues && (
              <div>
                <span className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Valores Anteriores</span>
                <pre className="p-2 bg-slate-850 text-slate-200 rounded font-mono text-[9px] whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {formatJsonPayload(selectedLog.previousValues)}
                </pre>
              </div>
            )}

            {selectedLog.newValues && (
              <div>
                <span className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Valores Nuevos / Cambios</span>
                <pre className="p-2 bg-slate-850 text-teal-300 rounded font-mono text-[9px] whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {formatJsonPayload(selectedLog.newValues)}
                </pre>
              </div>
            )}

            <div className="flex justify-end border-t pt-3">
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
