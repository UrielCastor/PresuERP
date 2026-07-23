import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Store,
  Plus,
  Eye,
  X,
  CreditCard,
  Ban,
  FileText,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { saleApi, Sale } from '../services/sale.service';
import { warehouseApi } from '../services/warehouse.service';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';

export const Sales: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const canRead = hasPermission('sales:read');
  const canCreate = hasPermission('sales:create');
  const canCancel = hasPermission('sales:cancel');

  const { data: salesData, isLoading: loadingSales } = useQuery({
    queryKey: ['sales', searchTerm, statusFilter, customerFilter, warehouseFilter, startDateFilter, endDateFilter, page],
    queryFn: () => saleApi.list({
      search: searchTerm || undefined,
      status: statusFilter || undefined,
      customerId: customerFilter || undefined,
      warehouseId: warehouseFilter || undefined,
      startDate: startDateFilter || undefined,
      endDate: endDateFilter || undefined,
      page,
      limit: 10,
    }),
    enabled: canRead,
  });

  const { data: kpiSalesData } = useQuery({
    queryKey: ['sales', 'kpi', searchTerm, customerFilter, warehouseFilter, startDateFilter, endDateFilter],
    queryFn: () => saleApi.list({
      search: searchTerm || undefined,
      customerId: customerFilter || undefined,
      warehouseId: warehouseFilter || undefined,
      startDate: startDateFilter || undefined,
      endDate: endDateFilter || undefined,
      limit: 2000,
    }),
    enabled: canRead,
  });

  const customers: any[] = [];
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehousesListAll'], queryFn: warehouseApi.list });

  const cancelMutation = useMutation({
    mutationFn: saleApi.cancel,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      if (selectedSale) setSelectedSale(res.data);
      alert('Venta anulada con éxito.');
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Error al anular'),
  });

  const kpiSales = (kpiSalesData?.data || []) as Sale[];

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setCustomerFilter('');
    setWarehouseFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setPage(1);
  };

  const activeFiltersCount = [searchTerm, statusFilter, customerFilter, warehouseFilter, startDateFilter, endDateFilter].filter(Boolean).length;

  const handleOpenDetail = async (s: Sale) => {
    try {
      const full = await saleApi.getById(s.id);
      setSelectedSale(full);
      setIsDetailOpen(true);
    } catch (error) {
      alert('Error fetching detail');
    }
  };

  if (!canRead) {
    return <div className="p-8 text-center text-gray-500">No tienes permisos para ver esta sección.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventas y Facturación"
        subtitle="Gestión administrativa de ventas unificadas"
        action={
          canCreate ? (
            <Button onClick={() => navigate('/pos')} className="flex items-center gap-2 bg-indigo-650 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 dark:shadow-none transition-all">
              <Store className="w-5 h-5" />
              <span>Abrir Terminal POS</span>
            </Button>
          ) : undefined
        }
      />

      {/* FILTER BAR UNIFICADA */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 gap-3 flex flex-wrap items-center">
         <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar comprobante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
        
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="min-w-[150px] px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Cliente (Todos)</option>
          {customers.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          className="min-w-[150px] px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Depósito (Todos)</option>
          {warehouses.map((w: any) => (
             <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
          />
          <span className="text-gray-400">-</span>
          <input
            type="date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
          />
        </div>

        {activeFiltersCount > 0 && (
          <button
            onClick={resetFilters}
            className="text-xs font-semibold text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors uppercase tracking-wider px-2 py-1"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* KPI CARDS (DASHBOARD) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(['ALL', 'COMPLETED', 'DRAFT', 'REFUNDED', 'CANCELLED'] as const).map(statusKey => {
           const matching = statusKey === 'ALL' 
             ? kpiSales 
             : kpiSales.filter((s: Sale) => s.status === statusKey);
           
           const count = matching.length;
           const amount = matching.reduce((acc, s) => acc + Number(s.totalAmount), 0);

           const label = {
             ALL: 'Total Facturado',
             COMPLETED: 'Ventas Completadas',
             DRAFT: 'Borradores',
             REFUNDED: 'Reembolsos',
             CANCELLED: 'Anulaciones',
           }[statusKey];

           const isSelected = statusKey === 'ALL' ? statusFilter === '' : statusFilter === statusKey;

           const colorTheme = {
              ALL: 'from-blue-50 to-blue-100/50 dark:from-blue-900/40 dark:to-blue-800/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
              COMPLETED: 'from-emerald-50 to-emerald-100/50 dark:from-emerald-900/40 dark:to-emerald-800/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
              DRAFT: 'from-amber-50 to-amber-100/50 dark:from-amber-900/40 dark:to-amber-800/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
              REFUNDED: 'from-purple-50 to-purple-100/50 dark:from-purple-900/40 dark:to-purple-800/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50',
              CANCELLED: 'from-red-50 to-red-100/50 dark:from-red-900/40 dark:to-red-800/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50',
           }[statusKey];

           return (
             <div 
               key={statusKey} 
               onClick={() => setStatusFilter(statusKey === 'ALL' ? '' : statusKey)}
               className={`cursor-pointer rounded-2xl border bg-gradient-to-br p-4 transition-all duration-200
                 ${colorTheme}
                 ${isSelected ? 'ring-2 ring-indigo-500 shadow-md scale-[1.02]' : 'hover:shadow-sm opacity-80 hover:opacity-100'}
               `}
             >
               <div className="text-xs font-semibold uppercase tracking-wider mb-2 opacity-80">{label}</div>
               <div className="text-2xl font-bold font-mono">
                 {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount)}
               </div>
               <div className="text-sm mt-1 opacity-75">{count} Operaciones</div>
             </div>
           );
        })}
      </div>

      {/* SINGLE MAIN GRID */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-300 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4 rounded-tl-xl whitespace-nowrap">Comprobante</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4 text-right">Total</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loadingSales ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-4" />
                    Cargando ventas...
                  </td>
                </tr>
              ) : salesData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="bg-gray-50 dark:bg-gray-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    No se encontraron transacciones
                  </td>
                </tr>
              ) : (
                salesData?.data?.map((sale: Sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:text-indigo-600" onClick={() => handleOpenDetail(sale)}>
                          {sale.documentType?.code}-{sale.documentNumber.toString().padStart(8, '0')}
                        </span>
                        <span className="text-xs text-gray-500 mt-1">Por {sale.createdBy?.name || 'Vendedor'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400 font-mono">
                      {new Date(sale.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-700 dark:text-gray-300">
                      {sale.customer?.name || <span className="text-gray-400 italic">Consumidor Final</span>}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-gray-900 dark:text-white">
                       {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(sale.totalAmount))}
                    </td>
                    <td className="px-6 py-4 text-center">
                       {sale.status === 'COMPLETED' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">COMPLETADA</span>}
                       {sale.status === 'CANCELLED' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">ANULADA</span>}
                       {sale.status === 'REFUNDED' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">REEMBOLSADA</span>}
                       {sale.status === 'DRAFT' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">BORRADOR</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => handleOpenDetail(sale)} className="p-2 text-gray-400 hover:text-indigo-600 bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm transition-all" title="Ver Detalle">
                           <Eye className="w-4 h-4" />
                         </button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Paginación simple oculta para brevedad */}
      </div>

      {/* DETAIL MODAL */}
      {isDetailOpen && selectedSale && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsDetailOpen(false)} />
           <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col border border-gray-200 dark:border-gray-800">
             
             <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur z-10">
               <div>
                 <div className="flex items-center gap-3">
                   <h2 className="text-2xl font-bold flex items-center gap-2">
                     <FileText className="text-indigo-500 w-6 h-6" />
                     {selectedSale.documentType?.code}-{selectedSale.documentNumber.toString().padStart(8, '0')}
                   </h2>
                   {selectedSale.status === 'COMPLETED' && <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-md text-xs font-bold ring-1 ring-emerald-200">Emitido</span>}
                   {selectedSale.status === 'CANCELLED' && <span className="px-2 py-1 bg-red-100 text-red-800 rounded-md text-xs font-bold ring-1 ring-red-200">Anulada</span>}
                 </div>
                 <p className="text-gray-500 text-sm mt-1">Registrado el {new Date(selectedSale.createdAt).toLocaleString()} por {selectedSale.createdBy?.name}</p>
               </div>
               <button onClick={() => setIsDetailOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                 <X className="w-6 h-6" />
               </button>
             </div>

             <div className="p-6 flex-1 bg-gray-50 dark:bg-gray-800/50">
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* ... client info ... */}
                  <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Datos del Cliente</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Nombre:</span> <span className="font-semibold">{selectedSale.customer?.name || 'CONSUMIDOR FINAL'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Identificación:</span> <span className="font-mono">{selectedSale.customer?.taxId || '-'}</span></div>
                    </div>
                  </div>
                  {/* ... other meta ... */}
               </div>

               <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden mb-6">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Artículo</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-right">Cant</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-right">Precio U.</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {selectedSale.items?.map(it => (
                        <tr key={it.id}>
                          <td className="px-4 py-3"><div className="font-medium">{it.product?.name}</div><div className="text-xs text-gray-500 font-mono">{it.product?.sku}</div></td>
                          <td className="px-4 py-3 text-right">{it.quantity}</td>
                          <td className="px-4 py-3 text-right font-mono">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(it.unitPrice)}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(it.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>

               {/* TOTALES */}
               <div className="flex justify-end mb-8">
                 <div className="w-full max-w-sm bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm text-sm space-y-3">
                    <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Subtotal</span> <span className="font-mono">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(selectedSale.subtotal)}</span></div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Descuento</span> <span className="font-mono text-red-500">-{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(selectedSale.discountAmount)}</span></div>
                    <div className="flex justify-between text-gray-800 dark:text-gray-200 font-bold text-lg pt-3 border-t border-gray-100 dark:border-gray-700">
                      <span>TOTAL</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(selectedSale.totalAmount)}</span>
                    </div>
                 </div>
               </div>

             </div>

             {/* ACTIONS BOTTOM BAR */}
             <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center rounded-b-2xl">
               <div>
                  {canCancel && selectedSale.status === 'COMPLETED' && (
                    <button 
                       onClick={() => {
                         if(confirm(`¿Estás seguro que deseas Anular la venta ${selectedSale.documentNumber}? Se reingresará el stock en el depósito origen y se quitará el dinero de caja si fue recaudado.`)){
                            cancelMutation.mutate(selectedSale.id);
                         }
                       }}
                       className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors border border-red-200 dark:border-red-800"
                    >
                      <Ban className="w-4 h-4" /> Anular Transacción
                    </button>
                  )}
               </div>
               <div className="flex gap-2">
                 <Button variant="secondary" onClick={() => window.print()} className="flex items-center gap-2"><CreditCard className="w-4 h-4"/> Imprimir Recibo</Button>
               </div>
             </div>

           </div>
         </div>
      )}
    </div>
  );
};
