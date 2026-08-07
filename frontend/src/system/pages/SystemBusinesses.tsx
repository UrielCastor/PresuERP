import React, { useState, useEffect } from 'react';
import { swalSuccess, swalConfirm, handleApiError } from '../../utils/swal';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { DataGrid } from '../../components/ui/DataGrid';
import { SystemService, Plan } from '../services/system.service';
import { BusinessService } from '../../services/business.service';
import { Search, Info, MoreVertical, Trash2, Shield, RotateCcw, AlertOctagon } from 'lucide-react';

export const SystemBusinesses: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [showDeleted, setShowDeleted] = useState(false);
  
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const [overviewData, setOverviewData] = useState<any>(null);
  const [isOverviewModalOpen, setIsOverviewModalOpen] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);

  // Deletion Flow State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [businessToDelete, setBusinessToDelete] = useState<any>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [validationData, setValidationData] = useState<any>(null);
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [showDeleted]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bizMs, pMs] = await Promise.all([
        SystemService.getBusinesses(showDeleted),
        SystemService.getPlans()
      ]);
      setBusinesses(bizMs);
      setPlans(pMs);
    } catch (error) {
       console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const suspendBusiness = async (id: string, name: string) => {
    const confirmed = await swalConfirm(
      '¿Suspender Empresa?',
      `¿Está seguro de suspender a ${name}? Sus usuarios quedarán sin acceso.`,
      'Sí, suspender',
      'Cancelar'
    );
    if (confirmed) {
      await BusinessService.suspend(id);
      swalSuccess('Empresa Suspendida', `La empresa ${name} ha sido suspendida.`);
      fetchData();
    }
  };

  const activateBusiness = async (id: string, name: string) => {
    const confirmed = await swalConfirm(
      '¿Activar Empresa?',
      `¿Activar la empresa ${name}?`,
      'Sí, activar',
      'Cancelar'
    );
    if (confirmed) {
      await BusinessService.activate(id);
      swalSuccess('Empresa Activada', `La empresa ${name} ha sido activada.`);
      fetchData();
    }
  };

  const openDeleteModal = async (business: any) => {
    setIsOverviewModalOpen(false);
    setBusinessToDelete(business);
    setIsDeleteModalOpen(true);
    setDeleteConfirmText('');
    setValidationData(null);
    setLoadingValidation(true);
    try {
      const data = await BusinessService.validateDelete(business.id);
      setValidationData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingValidation(false);
    }
  };

  const confirmDeleteBusiness = async () => {
    if (deleteConfirmText !== 'ELIMINAR' || !businessToDelete) return;
    try {
      setDeleting(true);
      await BusinessService.delete(businessToDelete.id);
      setIsDeleteModalOpen(false);
      swalSuccess('Empresa Eliminada', 'Se realizó el soft delete de la empresa.');
      fetchData();
    } catch (e) {
      handleApiError(e, 'Error al Eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const restoreBusiness = async (id: string, name: string) => {
    const confirmed = await swalConfirm(
      '¿Restaurar Empresa?',
      `¿Está seguro de RESTAURAR la empresa ${name}? Esto reactivará el acceso para todos sus usuarios.`,
      'Sí, restaurar',
      'Cancelar'
    );
    if (confirmed) {
      try {
        await BusinessService.restore(id);
        swalSuccess('Empresa Restaurada', `La empresa ${name} fue restaurada exitosamente.`);
        fetchData();
      } catch (e) {
        handleApiError(e, 'Error al Restaurar');
      }
    }
  };

  const changePlan = async () => {
    if (!selectedBusiness || !selectedPlanId) return;
    try {
        const planName = plans.find(p => p.id === selectedPlanId)?.name;
        if (!planName) return;
        await SystemService.changeBusinessPlan(selectedBusiness.id, planName);
        setIsPlanModalOpen(false);
        swalSuccess('Plan Cambiado', `El plan de la empresa fue actualizado a "${planName}".`);
        fetchData();
    } catch (e) {
        handleApiError(e, 'Error al Cambiar Plan');
    }
  };

  const viewOverview = async (business: any) => {
    try {
       setOverviewData(null);
       setSelectedBusiness(business);
       setIsOverviewModalOpen(true);
       setIsActionsMenuOpen(false); // Reset menu
       const data = await SystemService.getBusinessOverview(business.id);
       setOverviewData(data);
    } catch (e) {
       console.error(e);
    }
  };

  const filteredBusinesses = businesses.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.taxId.includes(searchTerm)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">🟢 Activa</span>;
      case 'SUSPENDED': return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">🔴 Suspendida</span>;
      case 'CANCELLED': return <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-250 text-slate-800 border bg-slate-100">⚫ Cancelada</span>;
      default: return <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700">🟡 En prueba</span>;
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  
  const formatDateTime = (dateString: string) => {
    const d = new Date(dateString);
    const date = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    return `${date} - ${time}`;
  };

  const columns = [
    { 
      header: 'Empresa Tenant', 
      cell: (row: any) => (
         <div className="flex flex-col">
            <span className="font-bold text-slate-800">{row.name}</span>
            <span className="text-xs text-slate-500 font-mono">CUIT: {row.taxId}</span>
         </div>
      )
    },
    { 
      header: 'Plan / Status', 
      cell: (row: any) => (
         <div className="flex flex-col gap-1 items-start">
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">{row.subscriptionPlan || 'Professional'}</span>
            {getStatusBadge(row.deletedAt ? 'CANCELLED' : (row.isActive ? 'ACTIVE' : 'SUSPENDED'))}
         </div>
      )
    },
    { header: 'Registro', cell: (row: any) => formatDate(row.createdAt) },
    { 
      header: 'Acciones (Core)', 
      cell: (row: any) => (
        <div className="flex gap-2">
           <button onClick={() => viewOverview(row)} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded text-sm hover:bg-indigo-100 font-medium">Detalles (SaaS)</button>
           <button onClick={() => { setSelectedBusiness(row); setSelectedPlanId(plans.find(p => p.name === row.subscriptionPlan)?.id || ''); setIsPlanModalOpen(true); }} className="px-3 py-1 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200 font-medium font-semibold">Plan</button>
           
           {row.deletedAt ? (
             <button onClick={() => restoreBusiness(row.id, row.name)} className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded text-sm hover:bg-emerald-100 font-medium font-bold flex items-center gap-1">
               <RotateCcw className="w-3 h-3" /> Restaurar
             </button>
           ) : (
             row.isActive ? (
               <button onClick={() => suspendBusiness(row.id, row.name)} className="px-3 py-1 bg-red-50 text-red-600 rounded text-sm hover:bg-red-100 font-medium">Suspender</button>
             ) : (
               <button onClick={() => activateBusiness(row.id, row.name)} className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded text-sm hover:bg-emerald-100 font-medium">Activar</button>
             )
           )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Auditoría de Empresas (Tenants)"
        subtitle="Listado global de organizaciones vinculadas al sistema SaaS"
      />

      <Card>
        <CardContent className="p-4 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div className="relative max-w-sm flex-1">
               <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Buscar Tenant..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
               />
             </div>
             
             {/* Filter showDeleted */}
             <div className="flex items-center gap-2">
                 <label className="text-sm font-semibold text-slate-600 flex items-center gap-2 select-none cursor-pointer">
                     <input 
                       type="checkbox" 
                       checked={showDeleted}
                       onChange={(e) => setShowDeleted(e.target.checked)}
                       className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-slate-300" 
                     />
                     Mostrar empresas eliminadas (Soft Delete)
                 </label>
             </div>
          </div>
        </CardContent>
        <CardContent className="p-0">
           <DataGrid
             columns={columns}
             data={filteredBusinesses}
             isLoading={loading}
             keyExtractor={(item) => (item as any).id}
           />
        </CardContent>
      </Card>

      <Modal isOpen={isPlanModalOpen} onClose={() => setIsPlanModalOpen(false)} title="Modificar Plan de Tenant">
         <div className="space-y-4">
            <p className="text-sm text-slate-600">Empresa: <strong>{selectedBusiness?.name}</strong></p>
            <div>
               <label className="block text-sm font-medium mb-2">Nuevo Plan a Asignar</label>
               <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500">
                  <option value="">Seleccionar plan...</option>
                  {plans.map(p => {
                     const monthlyPrice = p.prices?.find((pr: any) => pr.billingCycle === 'MONTHLY')?.price || 0;
                     return (
                        <option key={p.id} value={p.id}>{p.name} - ${Number(monthlyPrice).toLocaleString()}</option>
                     );
                  })}
               </select>
            </div>
            <div className="pt-4 flex justify-end gap-2 border-t">
               <button onClick={() => setIsPlanModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-lg">Cancelar</button>
               <button onClick={changePlan} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium">Aplicar Cambio</button>
            </div>
         </div>
      </Modal>
      <Modal isOpen={isOverviewModalOpen} onClose={() => setIsOverviewModalOpen(false)} title="Detalle de Empresa (SaaS Admin)">
         {overviewData ? (
            <div className="space-y-4 text-slate-800">
              {/* Cabecera compacta */}
              <div className="border-b pb-2 flex flex-col md:flex-row md:items-center justify-between gap-2">
                 <div>
                    <div className="flex items-center gap-2 flex-wrap">
                       <h2 className="text-base font-bold text-slate-900 leading-tight">{overviewData.business.name}</h2>
                       {getStatusBadge(overviewData.business.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1 font-medium">
                       <span className="uppercase text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-black text-[9px]">
                          {overviewData.subscription?.planName || 'FREE'} PLAN
                       </span>
                       <span>CUIT {overviewData.business.taxId}</span>
                       <span>Alta: {formatDate(overviewData.business.createdAt)}</span>
                    </div>
                 </div>
              </div>

              {/* Tarjetas KPI compactas */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                 {/* Card 1: Usuarios */}
                 <div className="bg-slate-50 border rounded-lg p-2 shadow-sm flex flex-col justify-between h-[60px]">
                    <div className="flex justify-between items-center text-[9px] uppercase font-bold text-slate-400">
                       <span>Usuarios</span>
                       <span className="font-mono text-slate-650">{overviewData.usage.users} / {overviewData.plan.usersLimit === 0 ? '∞' : overviewData.plan.usersLimit}</span>
                    </div>
                    <div className="w-full bg-slate-200/80 rounded-full h-1 overflow-hidden">
                       <div 
                          className="bg-indigo-600 h-1 rounded-full animate-pulse" 
                          style={{ width: overviewData.plan.usersLimit === 0 ? '10%' : `${Math.min((overviewData.usage.users / overviewData.plan.usersLimit) * 100, 100)}%` }}
                       ></div>
                    </div>
                 </div>

                 {/* Card 2: Productos */}
                 <div className="bg-slate-50 border rounded-lg p-2 shadow-sm flex flex-col justify-between h-[60px]">
                    <div className="flex justify-between items-center text-[9px] uppercase font-bold text-slate-400">
                       <span>Productos</span>
                       <span className="font-mono text-slate-650">{overviewData.usage.products} / {overviewData.plan.productsLimit === 0 ? '∞' : overviewData.plan.productsLimit}</span>
                    </div>
                    <div className="w-full bg-slate-200/80 rounded-full h-1 overflow-hidden">
                       <div 
                          className="bg-indigo-600 h-1 rounded-full" 
                          style={{ width: overviewData.plan.productsLimit === 0 ? '1%' : `${Math.min((overviewData.usage.products / overviewData.plan.productsLimit) * 100, 100)}%` }}
                       ></div>
                    </div>
                 </div>

                 {/* Card 3: Renovación */}
                 <div className="bg-slate-50 border rounded-lg p-2 shadow-sm flex flex-col justify-between h-[60px]">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block pb-1">Renovación</span>
                    <div className="text-xs font-bold text-slate-700 truncate pr-1">
                       {overviewData.subscription?.endsAt ? formatDate(overviewData.subscription.endsAt) : 'Sin renovación'}
                    </div>
                 </div>

                 {/* Card 4: Estado */}
                 <div className="bg-slate-50 border rounded-lg p-2 shadow-sm flex flex-col justify-between h-[60px]">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Estado</span>
                    <div className="flex items-center text-xs font-medium">
                       {overviewData.business.status === 'ACTIVE' ? '🟢 Activa' : overviewData.business.status === 'SUSPENDED' ? '🔴 Suspendida' : '⚫ Cancelada'}
                    </div>
                 </div>
              </div>

              {/* Grid 2 Columnas cuerpo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] leading-relaxed">
                 
                 {/* Tarjeta Suscripción */}
                 <div className="bg-white border rounded-lg p-2 shadow-sm space-y-1.5">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b pb-1">Suscripción</h3>
                    <div className="space-y-0.5">
                       <div className="flex justify-between text-slate-550"><span>Plan:</span><span className="font-semibold text-slate-800">{overviewData.subscription?.planName}</span></div>
                       <div className="flex justify-between text-slate-550"><span>Estado:</span><span className="font-bold text-slate-800">{overviewData.subscription?.status === 'ACTIVE' ? 'Activo' : 'Suspendida/Cancelada'}</span></div>
                       <div className="flex justify-between text-slate-550"><span>Ciclo:</span><span className="font-medium text-slate-800">Mensual</span></div>
                       <div className="flex justify-between text-slate-550"><span>Método Pago:</span><span className="font-medium text-slate-700">{overviewData.subscription?.paymentMethod || 'No disponible'}</span></div>
                       <div className="flex justify-between text-slate-550"><span>Próxima Renovación:</span><span className="font-semibold text-slate-850">{overviewData.subscription?.endsAt ? formatDate(overviewData.subscription.endsAt) : 'No disponible'}</span></div>
                    </div>
                 </div>

                 {/* Tarjeta Equipo */}
                 <div className="bg-white border rounded-lg p-2 shadow-sm flex flex-col justify-between">
                    <div>
                       <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b pb-1 mb-1.5">Equipo</h3>
                       {(() => {
                          const usersList = overviewData.usersList || [];
                          const admins = usersList.filter((u: any) => u.isActive && (u.roleName.toLowerCase() === 'administrator' || u.roleName.toLowerCase() === 'administrador'));
                          const mainAdmin = admins[0] || usersList[0];
                          const otherUsersCount = usersList.length > 0 ? (usersList.length - 1) : 0;
                          
                          return (
                             <>
                                {mainAdmin ? (
                                   <div className="flex items-center gap-1.5 text-[11px]">
                                      <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                         {mainAdmin.name.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                         <span className="block font-bold text-slate-800 truncate text-[11px]">{mainAdmin.name}</span>
                                         <span className="block text-[8px] text-slate-450 truncate font-mono">{mainAdmin.email}</span>
                                      </div>
                                      <span className="px-1 py-0.2 bg-indigo-100 text-indigo-700 text-[8px] rounded font-bold uppercase flex-shrink-0">{mainAdmin.roleName}</span>
                                   </div>
                                ) : (
                                   <span className="text-xs text-slate-450 italic">Sin usuarios registrados</span>
                                )}

                                {otherUsersCount > 0 && (
                                   <div className="mt-1.5 pt-1.5 border-t text-[11px]">
                                      <details className="group">
                                         <summary className="cursor-pointer text-indigo-650 hover:text-indigo-805 font-bold list-none select-none flex items-center justify-between text-[10px]">
                                            <span className="text-slate-500 font-bold font-mono bg-slate-50 px-1 py-0.2 rounded border text-[9px]">+{otherUsersCount} usuarios</span>
                                            <div className="flex items-center gap-0.5">
                                               <span>Ver equipo</span>
                                               <span className="transition-transform group-open:rotate-180 text-[8px]">▼</span>
                                            </div>
                                         </summary>
                                         <div className="mt-1 space-y-1 max-h-24 overflow-y-auto pr-0.5 border bg-slate-50/50 p-1.5 rounded text-[10px]">
                                            {usersList.map((user: any) => (
                                               <div key={user.id} className="flex justify-between items-center pb-0.5 border-b border-slate-100 last:border-0 last:pb-0">
                                                  <div>
                                                     <span className="font-semibold text-slate-700 block text-[10px]">{user.name}</span>
                                                     <span className="text-[8px] text-slate-450 font-mono block">{user.email}</span>
                                                  </div>
                                                  <div className="text-right flex-shrink-0 flex items-center gap-1.5">
                                                     <span className="px-1 py-0.2 bg-white border text-[7px] rounded text-slate-600 font-black">{user.roleName}</span>
                                                     <span className={user.isActive ? 'text-emerald-600 text-[9px] font-bold' : 'text-slate-400 text-[9px]'}>{user.isActive ? 'Activo' : 'Suspendido'}</span>
                                                  </div>
                                               </div>
                                            ))}
                                         </div>
                                      </details>
                                   </div>
                                )}
                             </>
                          );
                       })()}
                    </div>
                 </div>

                 {/* Tarjeta Actividad */}
                 <div className="bg-white border rounded-lg p-2 shadow-sm space-y-1">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b pb-1">Actividad</h3>
                    <div className="space-y-0.5">
                       <div className="flex justify-between text-slate-550"><span>Último login:</span><span className="font-semibold text-slate-800">{overviewData.activity.lastLogin ? formatDateTime(overviewData.activity.lastLogin) : 'Sin registros'}</span></div>
                       <div className="flex justify-between text-slate-550"><span>Última actividad:</span><span className="font-semibold text-slate-800">{overviewData.activity.lastActivity ? formatDateTime(overviewData.activity.lastActivity) : 'Sin registros'}</span></div>
                       <div className="flex justify-between text-slate-550"><span>Última IP:</span><span className="font-semibold font-mono text-slate-700">No registrada</span></div>
                    </div>
                 </div>

                 {/* Tarjeta Información Fiscal */}
                 <div className="bg-white border rounded-lg p-2 shadow-sm space-y-1">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b pb-1">Información Fiscal</h3>
                    <div className="space-y-0.5">
                       <div className="flex justify-between text-slate-550"><span>CUIT:</span><span className="font-bold text-slate-800 font-mono">{overviewData.business.taxId}</span></div>
                       <div className="flex justify-between text-slate-550"><span>Razón Social:</span><span className="font-semibold text-slate-800 truncate max-w-[130px]">{overviewData.business.name}</span></div>
                       <div className="flex justify-between text-slate-550"><span>Fecha de alta:</span><span className="font-medium text-slate-700">{formatDate(overviewData.business.createdAt)}</span></div>
                       <div className="flex justify-between text-slate-550"><span>Estado:</span>{getStatusBadge(overviewData.business.status)}</div>
                    </div>
                 </div>

              </div>

              {/* Detalle Acordeones info secundaria */}
              <div className="space-y-1">
                 <details className="group border rounded-lg bg-slate-50/50 overflow-hidden text-[11px]">
                    <summary className="cursor-pointer p-1.5 text-[10px] font-black text-slate-600 bg-slate-100/70 hover:bg-slate-150 select-none flex items-center justify-between">
                       <span>▼ Historial de pagos</span>
                       <span className="transition-transform group-open:rotate-180 text-[7px] text-slate-400">Ver</span>
                    </summary>
                    <div className="p-2 space-y-1 bg-white border-t text-[10px] text-slate-650">
                       <div className="flex justify-between">
                          <span>Facturas de Suscripción generadas:</span>
                          <span className="font-bold font-mono">{overviewData.usage.invoices}</span>
                       </div>
                       <div className="flex justify-between">
                          <span>Suscripciones históricas:</span>
                          <span className="font-bold font-mono">{overviewData.usage.subscriptions}</span>
                       </div>
                    </div>
                 </details>

                 <details className="group border rounded-lg bg-slate-50/50 overflow-hidden text-[11px]">
                    <summary className="cursor-pointer p-1.5 text-[10px] font-black text-slate-600 bg-slate-100/70 hover:bg-slate-150 select-none flex items-center justify-between">
                       <span>▼ Actividad completa</span>
                       <span className="transition-transform group-open:rotate-180 text-[7px] text-slate-400">Ver</span>
                    </summary>
                    <div className="p-2 space-y-1 bg-white border-t text-[10px] text-slate-650">
                       <div className="flex justify-between">
                          <span>Último acceso al sistema:</span>
                          <span>{overviewData.activity.lastLogin ? formatDateTime(overviewData.activity.lastLogin) : 'N/A'}</span>
                       </div>
                       <div className="flex justify-between">
                          <span>Última modificación registrada:</span>
                          <span>{overviewData.activity.lastActivity ? formatDateTime(overviewData.activity.lastActivity) : 'N/A'}</span>
                       </div>
                    </div>
                 </details>

                 <details className="group border rounded-lg bg-slate-50/50 overflow-hidden text-[11px]">
                    <summary className="cursor-pointer p-1.5 text-[10px] font-black text-slate-600 bg-slate-100/70 hover:bg-slate-150 select-none flex items-center justify-between">
                       <span>▼ Auditoría</span>
                       <span className="transition-transform group-open:rotate-180 text-[7px] text-slate-400">Ver</span>
                    </summary>
                    <div className="p-2 space-y-1 bg-white border-t text-[10px] text-slate-650">
                       <div className="flex justify-between">
                          <span>Código Interno Tenant:</span>
                          <span className="font-mono">{overviewData.business.id}</span>
                       </div>
                       <div className="flex justify-between">
                          <span>Fecha Registro SaaS:</span>
                          <span>{formatDateTime(overviewData.business.createdAt)}</span>
                       </div>
                    </div>
                 </details>

                 <details className="group border rounded-lg bg-slate-50/50 overflow-hidden text-[11px]">
                    <summary className="cursor-pointer p-1.5 text-[10px] font-black text-slate-600 bg-slate-100/70 hover:bg-slate-150 select-none flex items-center justify-between">
                       <span>▼ Logs</span>
                       <span className="transition-transform group-open:rotate-180 text-[7px] text-slate-400">Ver</span>
                    </summary>
                    <div className="p-2 space-y-1 bg-white border-t text-[10px] text-slate-650 font-mono">
                       <div className="flex justify-between">
                          <span>Movimientos Inventario Kardex:</span>
                          <span className="font-bold">{overviewData.usage.stockMovements} logs</span>
                       </div>
                       <div className="flex justify-between">
                          <span>Índices de Stocks por Almacenes:</span>
                          <span className="font-bold">{overviewData.usage.stocks} logs</span>
                       </div>
                    </div>
                 </details>
              </div>

              {/* Botones de acción */}
              <div className="pt-2 flex flex-col md:flex-row gap-2 border-t justify-end relative">
                 <button onClick={() => { setIsOverviewModalOpen(false); setSelectedBusiness(overviewData.business); setSelectedPlanId(plans.find(p => p.name === overviewData.plan.name)?.id || ''); setIsPlanModalOpen(true); }} className="px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold w-full md:w-auto">
                   Cambiar plan
                 </button>
                 
                 {overviewData.business.status === 'CANCELLED' ? (
                   <button onClick={() => { setIsOverviewModalOpen(false); restoreBusiness(overviewData.business.id, overviewData.business.name); }} className="px-3 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-bold w-full md:w-auto flex items-center justify-center gap-1.5">
                     <RotateCcw className="w-3.5 h-3.5" /> Restaurar empresa
                   </button>
                 ) : (
                   <button onClick={() => { setIsOverviewModalOpen(false); if (overviewData.business.status === 'ACTIVE') suspendBusiness(overviewData.business.id, overviewData.business.name); else activateBusiness(overviewData.business.id, overviewData.business.name); }} className={`px-3 py-1 rounded-lg text-xs font-bold w-full md:w-auto ${overviewData.business.status === 'ACTIVE' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                      {overviewData.business.status === 'ACTIVE' ? 'Suspender empresa' : 'Reactivar empresa'}
                   </button>
                 )}
                 
                 <button className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold w-full md:w-auto">Ver auditoría</button>

                 {/* Botón de acciones ocultas / Extra */}
                 {overviewData.business.status !== 'CANCELLED' && (
                    <div className="relative inline-block w-full md:w-auto mt-2 md:mt-0">
                       <button onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)} className="w-full md:w-auto px-2 py-1.5 bg-slate-50 border text-slate-650 hover:bg-slate-100 rounded-lg text-xs font-medium flex items-center justify-center">
                          <MoreVertical className="w-3.5 h-3.5" />
                       </button>
                       {isActionsMenuOpen && (
                          <div className="absolute bottom-full right-0 mb-2 w-48 bg-white border shadow-lg rounded-lg overflow-hidden z-25 animate-in slide-in-from-bottom-2 border-slate-200">
                             <button onClick={() => { setIsActionsMenuOpen(false); openDeleteModal(overviewData.business); }} className="w-full text-left px-4 py-2.5 text-xs text-red-600 font-bold hover:bg-red-50 flex items-center gap-1.5">
                               <Trash2 className="w-3.5 h-3.5" /> Eliminar empresa (Soft)
                             </button>
                          </div>
                       )}
                    </div>
                 )}
              </div>
            </div>
         ) : (
           <div className="flex flex-col items-center justify-center py-10">
             <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600 mb-3"></div>
             <div className="text-slate-500 font-medium text-xs">Obteniendo metadatos SaaS...</div>
           </div>
         )}
       </Modal>

      {/* Deletion Confirm / Warning Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Eliminación de Empresa (Soft Delete)">
         {loadingValidation ? (
           <div className="flex flex-col items-center justify-center py-12">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
             <div className="text-slate-500 font-medium">Validando historial de la empresa...</div>
           </div>
         ) : businessToDelete ? (
            <div className="space-y-4">
               <div className="bg-red-50 text-red-700 p-4 border border-red-100 rounded-lg flex items-start gap-3">
                  <AlertOctagon className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 animate-pulse" />
                  <div>
                     <h4 className="font-bold text-sm">Advertencia Crítica</h4>
                     <p className="text-xs mt-1">Está a punto de realizar una eliminación lógica de la empresa <strong>{businessToDelete.name}</strong>. Esto impedirá el acceso a todos los usuarios y suspenderá los servicios asociados.</p>
                  </div>
               </div>

               {validationData && validationData.hasHistory ? (
                  <div className="bg-slate-50 border rounded-lg p-3 text-xs space-y-2">
                     <p className="font-bold text-slate-650 uppercase tracking-widest text-[10px] text-slate-700">Registros Históricos Encontrados:</p>
                     <div className="grid grid-cols-2 gap-2 text-slate-600">
                        <div className="flex justify-between border-b pb-1">
                           <span>Usuarios asociados:</span>
                           <span className="font-bold font-mono">{validationData.details.users}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                           <span>Productos en catálogo:</span>
                           <span className="font-bold font-mono">{validationData.details.products}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                           <span>Ventas registradas:</span>
                           <span className="font-bold font-mono">{validationData.details.sales}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                           <span>Compras registradas:</span>
                           <span className="font-bold font-mono">{validationData.details.purchases}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                           <span>Transferencias:</span>
                           <span className="font-bold font-mono">{validationData.details.warehouseTransfers}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                           <span>Sesiones de Caja:</span>
                           <span className="font-bold font-mono">{validationData.details.cashSessions}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                           <span>Proveedores:</span>
                           <span className="font-bold font-mono">{validationData.details.suppliers}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                           <span>Clientes totales:</span>
                           <span className="font-bold font-mono">{validationData.details.clients}</span>
                        </div>
                     </div>
                     <p className="text-red-500 font-semibold mt-2 text-[11px]">⚠️ Esta empresa contiene {validationData.totalRecords} registros activos en base de datos. Se conservarán históricamente debido al soft-delete pero no se podrá operar con ellos.</p>
                  </div>
               ) : (
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-3 rounded-lg text-xs">
                     <p>🟢 Esta empresa no tiene transacciones ni configuraciones activas. Se puede suspender lógicamente sin impacto de datos históricos.</p>
                  </div>
               )}

               <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Para confirmar, escriba exactamente <span className="text-red-650 font-bold text-red-600">ELIMINAR</span>:</label>
                  <input 
                     type="text" 
                     placeholder="Escribir ELIMINAR..."
                     value={deleteConfirmText}
                     onChange={(e) => setDeleteConfirmText(e.target.value)}
                     className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                  />
               </div>

               <div className="pt-4 flex justify-end gap-2 border-t">
                  <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-lg text-sm font-semibold hover:bg-slate-200">Cancelar</button>
                  <button 
                     onClick={confirmDeleteBusiness}
                     disabled={deleteConfirmText !== 'ELIMINAR' || deleting} 
                     className="px-4 py-2 bg-red-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
                  >
                     {deleting ? 'Eliminando...' : 'Confirmar Eliminación'}
                  </button>
               </div>
            </div>
         ) : null}
      </Modal>
    </div>
  );
};
