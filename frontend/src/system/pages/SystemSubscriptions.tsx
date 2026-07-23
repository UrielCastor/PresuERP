import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { DataGrid } from '../../components/ui/DataGrid';
import api from '@/services/api';
import { RefreshCcw, Search, ExternalLink, Calendar, Filter } from 'lucide-react';

export const SystemSubscriptions: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [businessStatusFilter, setBusinessStatusFilter] = useState('active'); // 'active' | 'deleted' | 'all'
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState(''); // '' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PENDING' | 'TRIAL'

  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (businessStatusFilter) params.businessStatus = businessStatusFilter;
      if (subscriptionStatusFilter) params.subscriptionStatus = subscriptionStatusFilter;
      if (searchTerm) params.search = searchTerm;

      const { data } = await api.get('/system/subscriptions', { params });
      setSubscriptions(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSubscriptions();
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setBusinessStatusFilter('active');
    setSubscriptionStatusFilter('');
    setTimeout(() => fetchSubscriptions(), 50);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '---';
    return new Date(dateString).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const cancelSubscription = async (id: string, businessName: string) => {
     if (confirm(`¿Está seguro de CANCELAR la suscripción de ${businessName}?`)) {
        try {
           await api.patch(`/system/subscriptions/${id}/cancel`);
           fetchSubscriptions();
        } catch (e) {
           alert('Error al cancelar la suscripción');
        }
     }
  };

  const renewSubscription = async (id: string, businessName: string) => {
     if (confirm(`¿Renovar manualmente la suscripción de ${businessName}? Se sumará 1 ciclo al cierre.`)) {
        try {
           await api.patch(`/system/subscriptions/${id}/renew`);
           fetchSubscriptions();
           if (selectedSub) setIsDetailModalOpen(false);
        } catch (e) {
           alert('Error al renovar la suscripción');
        }
     }
  };

  const chargeSubscription = async (sub: any) => {
     try {
       const { data } = await api.post('/system/payments/create-preference', {
          businessId: sub.businessId,
          planId: sub.planId,
          billingCycle: sub.billingCycle || 'MONTHLY',
          subscriptionId: sub.id
       });

       if (data.data && data.data.checkoutUrl) {
          window.open(data.data.checkoutUrl, '_blank');
          fetchSubscriptions();
          setIsDetailModalOpen(false);
       } else {
          alert('No se pudo generar la preferencia de pago.');
       }
     } catch (e) {
       alert('Error generando link de pago. Verifique las configuraciones del sistema.');
     }
  };

  const getStatusBadge = (status: string) => {
      switch (status) {
        case 'ACTIVE': return <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">ACTIVA</span>;
        case 'PENDING': return <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700">PENDIENTE</span>;
        case 'EXPIRED': return <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700">VENCIDA</span>;
        case 'CANCELLED': return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">CANCELADA</span>;
        case 'TRIAL': return <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-700">PRUEBA</span>;
        default: return <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
      }
  };

  const getBusinessStatusBadge = (business: any) => {
    if (business.deletedAt) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">⚫ Eliminada</span>;
    }
    if (!business.isActive) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-600">🟠 Suspendida</span>;
    }
    return null;
  };

  const columns = [
    { 
      header: 'Tenant (Empresa)', 
      cell: (row: any) => (
         <div className="flex flex-col">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              {row.business.name}
              {getBusinessStatusBadge(row.business)}
            </span>
            <span className="text-xs text-slate-500 font-mono">CUIT: {row.business.taxId}</span>
         </div>
      )
    },
    { 
      header: 'Plan / Ciclo', 
      cell: (row: any) => (
         <div className="flex flex-col items-start gap-1">
            <span className="font-semibold text-slate-700">{row.plan.name}</span>
            <span className="text-xs text-indigo-600 font-medium px-1.5 py-0.5 bg-indigo-50 rounded uppercase">{row.billingCycle}</span>
         </div>
      )
    },
    { 
       header: 'Estado', 
       cell: (row: any) => getStatusBadge(row.status)
    },
    { 
       header: 'Periodo', 
       cell: (row: any) => (
          <div className="flex flex-col text-sm text-slate-600">
             <span><span className="font-medium text-slate-500">I:</span> {formatDate(row.startDate)}</span>
             <span><span className="font-medium text-slate-500">R:</span> {formatDate(row.renewalDate)}</span>
          </div>
       )
    },
    { 
       header: 'Pago', 
       cell: (row: any) => (
          <span className="text-sm font-medium text-slate-700">{row.paymentProvider || 'No configurado'}</span>
       )
    },
    { 
      header: 'Acciones', 
      cell: (row: any) => (
         <button onClick={() => { setSelectedSub(row); setIsDetailModalOpen(true); }} className="px-3 py-1 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200 font-medium">Ver detalles</button>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Contratos y Suscripciones SaaS"
        subtitle="Administra los ciclos de facturación, renovaciones operativas y proveedores"
      />

      <Card>
        <CardContent className="p-4 border-b bg-slate-50/50">
          <form onSubmit={handleApplyFilters} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Buscar Empresa / CUIT</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Nombre o CUIT..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estado Empresa</label>
                <select
                  value={businessStatusFilter}
                  onChange={(e) => setBusinessStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                >
                  <option value="active">🟢 Empresas Activas</option>
                  <option value="deleted">⚫ Empresas Eliminadas</option>
                  <option value="all">Todas las empresas</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estado Contrato</label>
                <select
                  value={subscriptionStatusFilter}
                  onChange={(e) => setSubscriptionStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                >
                  <option value="">Todos los estados</option>
                  <option value="ACTIVE">🟢 Activo</option>
                  <option value="TRIAL">🔵 Prueba</option>
                  <option value="PENDING">🟡 Pendiente</option>
                  <option value="EXPIRED">🟠 Vencido</option>
                  <option value="CANCELLED">🔴 Cancelado</option>
                </select>
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Filter className="w-4 h-4" /> Filtrar
                </button>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
                >
                  Limpiar
                </button>
                <button 
                  type="button"
                  onClick={fetchSubscriptions} 
                  className="py-2 px-3 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                  title="Recargar"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        </CardContent>
        <CardContent className="p-0">
           <DataGrid
             columns={columns}
             data={subscriptions}
             isLoading={loading}
             keyExtractor={(item) => item.id}
           />
        </CardContent>
      </Card>

      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Detalles de la Suscripción">
         {selectedSub && (
            <div className="space-y-6">
               <div className="flex flex-col items-center p-4 bg-slate-50 border rounded-lg">
                  <div className="text-xl font-black text-slate-800 mb-1 flex items-center gap-2">
                    {selectedSub.business.name}
                    {getBusinessStatusBadge(selectedSub.business)}
                  </div>
                  <div className="font-mono text-slate-500 text-sm mb-3">CONTRATO ID: {selectedSub.id}</div>
                  {getStatusBadge(selectedSub.status)}
               </div>

               {selectedSub.business.deletedAt && (
                 <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                   <span className="font-bold text-slate-600 text-xs uppercase">⚫ Empresa Eliminada</span>
                   <p className="text-slate-500 mt-1 text-xs">
                     Fecha de eliminación: {formatDate(selectedSub.business.deletedAt)}. 
                     Este contrato se conserva únicamente con fines de auditoría histórica.
                   </p>
                 </div>
               )}

               <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                  <div className="bg-white border rounded-lg p-3">
                     <span className="block text-xs uppercase text-slate-400 mb-1">Plan Contratado</span>
                     <span className="font-semibold text-slate-800 text-base">{selectedSub.plan.name}</span>
                     {(() => {
                        const priceObj = selectedSub.plan.prices?.find((p: any) => p.billingCycle === selectedSub.billingCycle);
                        const priceVal = priceObj ? priceObj.price : 0;
                        return (
                           <span className="block mt-1">Precio: ${Number(priceVal).toLocaleString()}</span>
                        );
                     })()}
                  </div>
                  <div className="bg-white border rounded-lg p-3">
                     <span className="block text-xs uppercase text-slate-400 mb-1">Ciclo de Facturación</span>
                     <div className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded inline-block uppercase">
                        {selectedSub.billingCycle}
                     </div>
                  </div>
               </div>

               <h4 className="text-sm font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                 <Calendar className="w-4 h-4" /> Línea de Tiempo Histórica
               </h4>

               <div className="grid grid-cols-3 gap-4 text-sm text-slate-600">
                  <div>
                    <span className="block text-xs uppercase text-slate-400">Inicio (Suscripción)</span>
                    <span className="font-medium text-slate-700">{formatDate(selectedSub.startDate)}</span>
                  </div>
                  <div>
                    <span className="block text-xs uppercase text-slate-400">Próxima Renovación</span>
                    <span className="font-medium text-slate-700">{formatDate(selectedSub.renewalDate)}</span>
                  </div>
                  <div>
                    <span className="block text-xs uppercase text-slate-400">Cierre / Fin</span>
                    <span className="font-medium text-slate-700">{formatDate(selectedSub.endDate)}</span>
                  </div>
               </div>

               <h4 className="text-sm font-bold text-slate-800 border-b pb-2 mt-4 flex items-center gap-2">
                 <ExternalLink className="w-4 h-4" /> Pasarela de Pagos
               </h4>
               <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                  <div>
                    <span className="block text-xs uppercase text-slate-400">Proveedor</span>
                    <span className="font-medium text-slate-700">{selectedSub.paymentProvider || 'Asignación Manual / N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-xs uppercase text-slate-400">Ref / Token Externo</span>
                    <span className="font-mono text-xs">{selectedSub.externalReference || '---'}</span>
                  </div>
               </div>

               <div className="pt-4 flex flex-col md:flex-row gap-2 border-t justify-end bg-slate-50 -mx-4 -mb-4 p-4 rounded-b-lg">
                  {!selectedSub.business.deletedAt && ['ACTIVE', 'PENDING', 'TRIAL'].includes(selectedSub.status) && (
                     <button onClick={() => cancelSubscription(selectedSub.id, selectedSub.business.name)} className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium">
                       Cancelar Contrato
                     </button>
                  )}
                  {!selectedSub.business.deletedAt && ['ACTIVE', 'TRIAL'].includes(selectedSub.status) && (
                     <button onClick={() => chargeSubscription(selectedSub)} className="px-4 py-2 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-sm font-medium mx-auto md:ml-auto md:mr-2">
                       Cobrar (M. Pago)
                     </button>
                  )}
                  {!selectedSub.business.deletedAt && ['ACTIVE', 'TRIAL', 'EXPIRED'].includes(selectedSub.status) && (
                     <button onClick={() => renewSubscription(selectedSub.id, selectedSub.business.name)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">
                       Renovar Manualmente
                     </button>
                  )}
                  {selectedSub.business.deletedAt && (
                    <span className="text-xs text-slate-400 italic py-2">
                      Las acciones operativas están deshabilitadas para empresas eliminadas.
                    </span>
                  )}
               </div>
            </div>
         )}
      </Modal>
    </div>
  );
};
