import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { swalSuccess, swalConfirm, handleApiError } from '../utils/swal';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Store,
  Eye,
  X,
  Ban,
  Download,
  RefreshCw,
  Printer,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Clock,
  FileText,
  Calendar,
  History,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Building2,
  Award
} from 'lucide-react';
import { format, subDays, startOfWeek, startOfMonth } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { saleApi, Sale } from '../services/sale.service';
import { warehouseApi } from '../services/warehouse.service';
import { getCustomers } from '../services/customer.service';
import { getInitialWarehouseId } from '../utils/warehouse';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

type PeriodPreset = 'HOY' | 'AYER' | 'SEMANA' | 'MES' | 'CUSTOM';

export const Sales: React.FC = () => {
  const { hasPermission, hasCapability, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const getTodayStr = () => format(new Date(), 'yyyy-MM-dd');

  // Estado del Período Operativo (Default = HOY)
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('HOY');
  const [startDateFilter, setStartDateFilter] = useState<string>(getTodayStr());
  const [endDateFilter, setEndDateFilter] = useState<string>(getTodayStr());

  // Filtros Secundarios
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState<string>(() => {
    const isCompanyAdmin = user?.role === 'Administrator' || user?.isStaff;
    if (isCompanyAdmin) {
      return user?.defaultWarehouseId || user?.defaultWarehouse?.id || '';
    }
    return getInitialWarehouseId(user) || '';
  });
  const [page, setPage] = useState(1);

  // Modales
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const canRead = hasCapability('sales.view') || hasPermission('sales:read');
  const canCreate = hasCapability('sales.create') || hasPermission('sales:write');
  const canCancel = hasCapability('sales.cancel') || hasPermission('sales:cancel');
  const canDiscount = hasCapability('sales.discount') || canCreate;
  const canChangePrice = hasCapability('sales.change_price') || canCreate;
  const canReprint = hasCapability('sales.reprint') || canRead;
  const canOpenDrawer = hasCapability('sales.open_drawer') || hasCapability('cash.open');

  // Manejador del Selector de Período
  const handlePeriodChange = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    const now = new Date();
    setPage(1);

    switch (preset) {
      case 'HOY':
        setStartDateFilter(format(now, 'yyyy-MM-dd'));
        setEndDateFilter(format(now, 'yyyy-MM-dd'));
        break;
      case 'AYER': {
        const yesterday = subDays(now, 1);
        setStartDateFilter(format(yesterday, 'yyyy-MM-dd'));
        setEndDateFilter(format(yesterday, 'yyyy-MM-dd'));
        break;
      }
      case 'SEMANA': {
        const weekStart = subDays(now, 6);
        setStartDateFilter(format(weekStart, 'yyyy-MM-dd'));
        setEndDateFilter(format(now, 'yyyy-MM-dd'));
        break;
      }
      case 'MES': {
        const monthStart = subDays(now, 29);
        setStartDateFilter(format(monthStart, 'yyyy-MM-dd'));
        setEndDateFilter(format(now, 'yyyy-MM-dd'));
        break;
      }
      case 'CUSTOM':
        break;
    }
  };

  // Query principal paginada (Para el Modal de Historial Completo y Úlimas Operaciones)
  const { data: salesData, isLoading: loadingSales, isRefetching } = useQuery({
    queryKey: [
      'sales',
      searchTerm,
      statusFilter,
      customerFilter,
      warehouseFilter,
      startDateFilter,
      endDateFilter,
      page,
    ],
    queryFn: () =>
      saleApi.list({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        customerId: customerFilter || undefined,
        warehouseId: warehouseFilter || undefined,
        startDate: startDateFilter || undefined,
        endDate: endDateFilter || undefined,
        page,
        limit: isHistoryModalOpen ? 15 : 6, // 6 en pantalla principal, 15 en modal historial
      }),
    enabled: canRead,
  });

  // Query KPI (Totales del período seleccionado)
  const { data: kpiSalesData } = useQuery({
    queryKey: [
      'sales',
      'kpi',
      searchTerm,
      customerFilter,
      warehouseFilter,
      startDateFilter,
      endDateFilter,
    ],
    queryFn: () =>
      saleApi.list({
        search: searchTerm || undefined,
        customerId: customerFilter || undefined,
        warehouseId: warehouseFilter || undefined,
        startDate: startDateFilter || undefined,
        endDate: endDateFilter || undefined,
        limit: 2000,
      }),
    enabled: canRead,
  });

  // Clientes y Depósitos
  const { data: customersRes } = useQuery({
    queryKey: ['salesCustomersList'],
    queryFn: () => getCustomers({ active: true, limit: 200 }),
  });
  const customers = customersRes?.data || [];

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehousesListAll'],
    queryFn: warehouseApi.list,
  });

  const isCompanyAdmin = user?.role === 'Administrator' || user?.isStaff;

  useEffect(() => {
    if (warehouses.length > 0 && !isCompanyAdmin) {
      if (warehouses.length === 1) {
        if (warehouseFilter !== warehouses[0].id) {
          setWarehouseFilter(warehouses[0].id);
        }
      } else {
        if (!warehouseFilter || !warehouses.some((w: any) => w.id === warehouseFilter)) {
          setWarehouseFilter(warehouses[0].id);
        }
      }
    }
  }, [warehouses, isCompanyAdmin, warehouseFilter]);

  // Anulación Mutation
  const cancelMutation = useMutation({
    mutationFn: saleApi.cancel,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      if (selectedSale) setSelectedSale(res.data);
      swalSuccess('Venta Anulada', 'La transacción fue anulada. Se ha restituido el stock y reajustado los fondos.');
    },
    onError: (err: any) => handleApiError(err, 'Error al Anular Venta'),
  });

  const kpiSales = (kpiSalesData?.data || []) as Sale[];

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setCustomerFilter('');
    setWarehouseFilter('');
    handlePeriodChange('HOY');
  };

  const activeFiltersCount = [
    searchTerm,
    statusFilter,
    customerFilter,
    warehouseFilter,
    periodPreset !== 'HOY',
  ].filter(Boolean).length;

  const handleOpenDetail = async (s: Sale) => {
    try {
      const full = await saleApi.getById(s.id);
      setSelectedSale(full);
      setIsDetailOpen(true);
    } catch (error) {
      handleApiError(error, 'Error al Obtener Detalle');
    }
  };

  const formatCurrency = (val: number | string) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(val));

  if (!canRead) {
    return (
      <div className="p-8 text-center text-slate-500 font-medium">
        No tienes permisos para ver el módulo de Ventas y Facturación.
      </div>
    );
  }

  // Cálculos de KPIs en tiempo real del Período Seleccionado
  const totalAmountFacturado = kpiSales.reduce((acc, s) => acc + Number(s.totalAmount), 0);
  const completedSales = kpiSales.filter((s) => s.status === 'COMPLETED');
  const totalCompleted = completedSales.reduce((acc, s) => acc + Number(s.totalAmount), 0);
  const averageTicket = completedSales.length > 0 ? totalCompleted / completedSales.length : 0;
  const pendingOrCancelled = kpiSales.filter((s) => s.status === 'DRAFT' || s.status === 'CANCELLED');
  const totalPendingOrCancelled = pendingOrCancelled.reduce((acc, s) => acc + Number(s.totalAmount), 0);

  const getPeriodLabelText = () => {
    switch (periodPreset) {
      case 'HOY':
        return 'Hoy';
      case 'AYER':
        return 'Ayer';
      case 'SEMANA':
        return 'Esta Semana';
      case 'MES':
        return 'Este Mes';
      case 'CUSTOM':
        return 'Personalizado';
    }
  };

  const totalPages = salesData?.pagination?.totalPages || 1;

  return (
    <div className="space-y-4">
      {/* 1. HEADER COMPACTO CON SELECTOR DE PERÍODO Y ACCIONES */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Panel Diario de Ventas
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <Calendar className="w-3.5 h-3.5" />
              Período: {getPeriodLabelText()}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Resumen diario de facturación, métricas del período y operaciones recientes.
          </p>
        </div>

        {/* SELECTOR DE PERÍODO + ACCIONES PRINCIPALES */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Pills de Selección de Período */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            {(['HOY', 'AYER', 'SEMANA', 'MES', 'CUSTOM'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  periodPreset === p
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {p === 'HOY'
                  ? 'Hoy'
                  : p === 'AYER'
                  ? 'Ayer'
                  : p === 'SEMANA'
                  ? 'Semana'
                  : p === 'MES'
                  ? 'Mes'
                  : 'Manual'}
              </button>
            ))}
          </div>

          {/* Selector de Sucursal */}
          {!(warehouses.length === 1 && !isCompanyAdmin) && (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-primary-500" />
                Sucursal:
              </span>
              <select
                value={warehouseFilter}
                onChange={(e) => {
                  setWarehouseFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-2.5"
              >
                {isCompanyAdmin && (
                  <option value="">🏢 Todas las sucursales</option>
                )}
                {warehouses.map((w: any) => (
                  <option key={w.id} value={w.id}>
                    🏭 {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsHistoryModalOpen(true)}
            className="font-bold flex items-center gap-1.5 text-xs py-1"
          >
            <History className="w-3.5 h-3.5 text-primary-500" />
            <span>Ver Historial Completo</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['sales'] })}
            className="font-bold flex items-center gap-1 text-xs py-1"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>

          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/pos')}
              className="font-bold flex items-center gap-1.5 shadow-sm text-xs py-1"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Abrir POS</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. TARJETAS KPIS DE RESUMEN DEL PERÍODO SELECCIONADO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Facturación */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-blue-500">
          <CardContent className="p-3.5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Facturación ({getPeriodLabelText()})
              </span>
              <DollarSign className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-lg lg:text-xl font-black text-slate-900 dark:text-white font-mono">
              {formatCurrency(totalAmountFacturado)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {kpiSales.length} comprobantes registrados
            </span>
          </CardContent>
        </Card>

        {/* KPI 2: Ventas Completadas */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-emerald-500">
          <CardContent className="p-3.5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Ventas Efectivas
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-lg lg:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {formatCurrency(totalCompleted)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {completedSales.length} operaciones cobradas
            </span>
          </CardContent>
        </Card>

        {/* KPI 3: Ticket Promedio */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-indigo-500">
          <CardContent className="p-3.5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Ticket Promedio
              </span>
              <TrendingUp className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-lg lg:text-xl font-black text-slate-900 dark:text-white font-mono">
              {formatCurrency(averageTicket)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Promedio por transacción cobrada
            </span>
          </CardContent>
        </Card>

        {/* KPI 4: Borradores / Anulaciones */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-amber-500">
          <CardContent className="p-3.5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Borradores / Anulados
              </span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-lg lg:text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {formatCurrency(totalPendingOrCancelled)}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {pendingOrCancelled.length} regs. pendientes/revertidos
            </span>
          </CardContent>
        </Card>
      </div>

      {/* 3. RESUMEN DE ÚLTIMAS OPERACIONES (SÓLO 5-6 REGISTROS EN PANTALLA PRINCIPAL) */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary-500" /> Últimas Operaciones ({getPeriodLabelText()})
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Visualización de los comprobantes más recientes emitidos en el período.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-950 uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Comprobante</th>
                <th className="px-4 py-2.5">Fecha</th>
                <th className="px-4 py-2.5">Sucursal</th>
                <th className="px-4 py-2.5">Cliente</th>
                <th className="px-4 py-2.5 text-right">Monto Total</th>
                <th className="px-4 py-2.5 text-center">Estado</th>
                <th className="px-4 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loadingSales ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="h-11">
                    <td className="px-4 py-2">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="px-4 py-2">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-4 py-2">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-4 py-2">
                      <Skeleton className="h-4 w-36" />
                    </td>
                    <td className="px-4 py-2">
                      <Skeleton className="h-4 w-20 ml-auto" />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Skeleton className="h-5 w-20 mx-auto rounded-full" />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Skeleton className="h-7 w-14 ml-auto rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : salesData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8">
                    <EmptyState
                      title={`No hay operaciones registradas ${getPeriodLabelText().toLowerCase()}`}
                      description="Haz clic en 'Abrir POS' para iniciar una nueva venta."
                      icon={FileText}
                    />
                  </td>
                </tr>
              ) : (
                salesData?.data?.slice(0, 6).map((sale: Sale) => (
                  <tr
                    key={sale.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors h-11 border-b border-slate-100 dark:border-slate-800/60"
                  >
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                      <span
                        onClick={() => handleOpenDetail(sale)}
                        className="cursor-pointer hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        {sale.documentType?.code}-
                        {sale.documentNumber.toString().padStart(8, '0')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(sale.createdAt).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-slate-550 font-semibold text-xs whitespace-nowrap">
                      {(sale as any).warehouse?.name || 'S/S'}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                      {sale.customer?.name || (
                        <span className="text-slate-400 italic font-normal">Consumidor Final</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                      {formatCurrency(sale.totalAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {sale.status === 'COMPLETED' && <Badge variant="success" size="sm">COMPLETADA</Badge>}
                      {sale.status === 'CANCELLED' && <Badge variant="error" size="sm">ANULADA</Badge>}
                      {sale.status === 'REFUNDED' && <Badge variant="info" size="sm">REEMBOLSADA</Badge>}
                      {sale.status === 'DRAFT' && <Badge variant="warning" size="sm">BORRADOR</Badge>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(sale)}
                          className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Ver Detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Imprimir"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Card */}
        <div className="p-3 bg-slate-50/50 dark:bg-slate-950/30 border-t border-slate-100 dark:border-slate-800 flex items-center text-xs">
          <span className="text-slate-500 font-medium">
            Mostrando las {Math.min(6, salesData?.data?.length || 0)} operaciones más recientes
          </span>
        </div>
      </Card>

      {/* 4. MODAL DE HISTORIAL COMPLETO DE COMPROBANTES CON BÚSQUEDA Y FILTROS */}
      {isHistoryModalOpen && (
        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => {
            setIsHistoryModalOpen(false);
            setOpenActionMenuId(null);
          }}
          title={
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">
                Historial Completo de Comprobantes
              </span>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {salesData?.pagination?.total || 0} comprobantes
              </span>
            </div>
          }
          size="7xl"
          headerClassName="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
          bodyClassName="p-3 sm:p-4 flex flex-col flex-1 min-h-0 overflow-hidden bg-slate-50/50 dark:bg-slate-950/50"
        >
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            {/* Barra de Búsqueda y Filtros en Grilla Responsive */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs space-y-2.5 flex-shrink-0">
              {/* Selector de Rangos Rápidos (Botones Segmentados) */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1 overflow-x-auto">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1.5 flex-shrink-0">
                    Período:
                  </span>
                  {[
                    { id: 'HOY', label: 'Hoy' },
                    { id: 'AYER', label: 'Ayer' },
                    { id: 'SEMANA', label: 'Semana' },
                    { id: 'MES', label: 'Mes' },
                    { id: 'CUSTOM', label: 'Manual' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePeriodChange(preset.id as PeriodPreset)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex-shrink-0 ${
                        periodPreset === preset.id
                          ? 'bg-primary-600 text-white shadow-xs dark:bg-primary-500'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                <div>
                  <Input
                    placeholder="Buscar N° comp, cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    leftIcon={Search}
                    className="py-1 text-xs"
                  />
                </div>

                <div>
                  <Select
                    value={customerFilter}
                    onChange={(e) => setCustomerFilter(e.target.value)}
                    className="py-1 text-xs"
                  >
                    <option value="">Cliente (Todos)</option>
                    {customers.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Select
                    value={warehouseFilter}
                    onChange={(e) => setWarehouseFilter(e.target.value)}
                    className="py-1 text-xs"
                  >
                    <option value="">Depósito (Todos)</option>
                    {warehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="py-1 text-xs"
                  >
                    <option value="">Estado (Todos)</option>
                    <option value="COMPLETED">COMPLETADA</option>
                    <option value="DRAFT">BORRADOR</option>
                    <option value="CANCELLED">ANULADA</option>
                    <option value="REFUNDED">REEMBOLSADA</option>
                  </Select>
                </div>

                <div>
                  <Input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => {
                      setStartDateFilter(e.target.value);
                      setPeriodPreset('CUSTOM');
                    }}
                    className="py-1 text-xs"
                  />
                </div>

                <div>
                  <Input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => {
                      setEndDateFilter(e.target.value);
                      setPeriodPreset('CUSTOM');
                    }}
                    className="py-1 text-xs"
                  />
                </div>
              </div>

              {/* Contenedor de Chips de Filtros Activos */}
              {activeFiltersCount > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 overflow-hidden">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-full overflow-hidden">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1 flex-shrink-0">
                      Filtros:
                    </span>

                    {searchTerm && (
                      <div
                        className="inline-flex items-center gap-1 max-w-[180px] sm:max-w-[220px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-medium px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700"
                        title={`Búsqueda: "${searchTerm}"`}
                      >
                        <span className="truncate">Buscar: "{searchTerm}"</span>
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {customerFilter && (
                      <div
                        className="inline-flex items-center gap-1 max-w-[180px] sm:max-w-[220px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-medium px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700"
                        title={`Cliente: ${customers.find((c: any) => c.id === customerFilter)?.name || customerFilter}`}
                      >
                        <span className="truncate">
                          Cliente: {customers.find((c: any) => c.id === customerFilter)?.name || customerFilter}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCustomerFilter('')}
                          className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {warehouseFilter && (
                      <div
                        className="inline-flex items-center gap-1 max-w-[180px] sm:max-w-[220px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-medium px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700"
                        title={`Depósito: ${warehouses.find((w: any) => w.id === warehouseFilter)?.name || warehouseFilter}`}
                      >
                        <span className="truncate">
                          Depósito: {warehouses.find((w: any) => w.id === warehouseFilter)?.name || warehouseFilter}
                        </span>
                        <button
                          type="button"
                          onClick={() => setWarehouseFilter('')}
                          className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {statusFilter && (
                      <div
                        className="inline-flex items-center gap-1 max-w-[180px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-medium px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700"
                        title={`Estado: ${statusFilter}`}
                      >
                        <span className="truncate">
                          Estado: {statusFilter === 'COMPLETED' ? 'COMPLETADA' : statusFilter === 'DRAFT' ? 'BORRADOR' : statusFilter === 'CANCELLED' ? 'ANULADA' : 'REEMBOLSADA'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setStatusFilter('')}
                          className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {(startDateFilter || endDateFilter) && (
                      <div
                        className="inline-flex items-center gap-1 max-w-[220px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-medium px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700"
                        title={`Fechas: ${startDateFilter} a ${endDateFilter}`}
                      >
                        <span className="truncate">
                          Fechas: {startDateFilter} a {endDateFilter}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setStartDateFilter('');
                            setEndDateFilter('');
                            setPeriodPreset('CUSTOM');
                          }}
                          className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1 flex-shrink-0 ml-auto"
                  >
                    <X className="w-3 h-3" /> Limpiar ({activeFiltersCount})
                  </button>
                </div>
              )}
            </div>

            {/* Contenedor de Tabla con Scroll Interno Estricto */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex-1 flex flex-col min-h-0 overflow-hidden shadow-xs mt-3 relative">
              {openActionMenuId !== null && (
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setOpenActionMenuId(null)}
                />
              )}

              <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
                <table className="w-full text-left text-xs border-collapse table-fixed">
                  <thead className="bg-slate-50 dark:bg-slate-950 uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 w-[14%]">Comprobante</th>
                      <th className="px-3 py-2.5 w-[12%]">Fecha</th>
                      <th className="px-3 py-2.5 w-[16%]">Sucursal</th>
                      <th className="px-3 py-2.5 w-[27%]">Cliente</th>
                      <th className="px-3 py-2.5 w-[14%] text-right">Monto Total</th>
                      <th className="px-3 py-2.5 w-[11%] text-center">Estado</th>
                      <th className="px-3 py-2.5 w-[6%] text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {loadingSales ? (
                      Array.from({ length: 8 }).map((_, idx) => (
                        <tr key={idx} className="h-11">
                          <td className="px-3 py-2"><Skeleton className="h-4 w-24" /></td>
                          <td className="px-3 py-2"><Skeleton className="h-4 w-20" /></td>
                          <td className="px-3 py-2"><Skeleton className="h-4 w-20" /></td>
                          <td className="px-3 py-2"><Skeleton className="h-4 w-36" /></td>
                          <td className="px-3 py-2 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          <td className="px-3 py-2 text-center"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></td>
                          <td className="px-3 py-2 text-center"><Skeleton className="h-6 w-6 mx-auto rounded-md" /></td>
                        </tr>
                      ))
                    ) : salesData?.data?.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8">
                          <EmptyState
                            title="No se encontraron comprobantes"
                            description="Prueba cambiando los filtros o el rango de fechas."
                            icon={FileText}
                          />
                        </td>
                      </tr>
                    ) : (
                      salesData?.data?.map((sale: Sale) => (
                        <tr
                          key={sale.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors h-11 border-b border-slate-100 dark:border-slate-800/60"
                        >
                          <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-white truncate">
                            <span
                              onClick={() => handleOpenDetail(sale)}
                              className="cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 truncate block"
                              title={`${sale.documentType?.code}-${sale.documentNumber.toString().padStart(8, '0')}`}
                            >
                              {sale.documentType?.code}-{sale.documentNumber.toString().padStart(8, '0')}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                            {format(new Date(sale.createdAt), 'dd/MM HH:mm')}
                          </td>
                          <td className="px-3 py-2 text-slate-550 font-semibold text-xs whitespace-nowrap truncate animate-fade-in" title={(sale as any).warehouse?.name || 'S/S'}>
                            {(sale as any).warehouse?.name || 'S/S'}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200 truncate" title={sale.customer?.name || 'Consumidor Final'}>
                            {sale.customer?.name ? (
                              <span className="truncate block">{sale.customer.name}</span>
                            ) : (
                              <span className="text-slate-400 italic font-normal">Consumidor Final</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-white text-xs whitespace-nowrap">
                            {formatCurrency(sale.totalAmount)}
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            {sale.status === 'COMPLETED' && <Badge variant="success" size="sm">COMPLETADA</Badge>}
                            {sale.status === 'CANCELLED' && <Badge variant="error" size="sm">ANULADA</Badge>}
                            {sale.status === 'REFUNDED' && <Badge variant="info" size="sm">REEMBOLSADA</Badge>}
                            {sale.status === 'DRAFT' && <Badge variant="warning" size="sm">BORRADOR</Badge>}
                          </td>
                          <td className="px-3 py-2 text-center relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionMenuId(openActionMenuId === sale.id ? null : sale.id);
                              }}
                              className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                              title="Acciones"
                            >
                              <MoreVertical className="w-4 h-4 mx-auto" />
                            </button>

                            {openActionMenuId === sale.id && (
                              <div className="absolute right-2 top-full mt-1 z-30 w-44 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 py-1 text-left text-xs">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    handleOpenDetail(sale);
                                  }}
                                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-500" /> Ver Detalle
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    window.print();
                                  }}
                                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors"
                                >
                                  <Printer className="w-3.5 h-3.5 text-slate-500" /> Imprimir
                                </button>

                                {canCancel && sale.status === 'COMPLETED' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setOpenActionMenuId(null);
                                      const confirmed = await swalConfirm(
                                        '¿Anular Venta?',
                                        `¿Anular venta ${sale.documentNumber}? Se reingresará el stock y los fondos correspondientes.`,
                                        'Sí, anular venta',
                                        'Cancelar'
                                      );
                                      if (confirmed) {
                                        cancelMutation.mutate(sale.id);
                                      }
                                    }}
                                    className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-medium transition-colors border-t border-slate-100 dark:border-slate-800/80 mt-1 pt-1.5"
                                  >
                                    <Ban className="w-3.5 h-3.5" /> Anular Transacción
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Simplified Pagination Footer */}
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs flex-shrink-0">
                <span className="text-slate-500 font-medium">
                  Mostrando{' '}
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {salesData?.pagination?.total ? (page - 1) * 15 + 1 : 0}
                  </span>{' '}
                  -{' '}
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {Math.min(page * 15, salesData?.pagination?.total || 0)}
                  </span>{' '}
                  de{' '}
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {salesData?.pagination?.total || 0}
                  </span>{' '}
                  comprobantes
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px] font-mono mr-1">
                    Pág. {page} / {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-7 px-2.5 py-0 text-xs font-medium flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-7 px-2.5 py-0 text-xs font-medium flex items-center gap-1"
                  >
                    Siguiente <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 5. MODAL DE DETALLE DE COMPROBANTE E IMPRESIÓN / ANULACIÓN */}
      {isDetailOpen && selectedSale && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={`Detalle Comprobante ${selectedSale.documentType?.code}-${selectedSale.documentNumber
            .toString()
            .padStart(8, '0')}`}
          size="lg"
        >
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  Fecha: {new Date(selectedSale.createdAt).toLocaleString('es-AR')}
                </span>
                <p className="text-slate-400 text-[11px]">
                  Vendedor: {selectedSale.createdBy?.name || 'Sistema'}
                </p>
              </div>
              <div>
                {selectedSale.status === 'COMPLETED' && <Badge variant="success">COMPLETADA</Badge>}
                {selectedSale.status === 'CANCELLED' && <Badge variant="error">ANULADA</Badge>}
                {selectedSale.status === 'REFUNDED' && <Badge variant="info">REEMBOLSADA</Badge>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                <span className="font-bold text-slate-400 block text-[10px] uppercase">Cliente</span>
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {selectedSale.customer?.name || 'CONSUMIDOR FINAL'}
                </p>
                <p className="text-slate-400 text-[11px]">CUIT/DNI: {selectedSale.customer?.taxId || '-'}</p>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                <span className="font-bold text-slate-400 block text-[10px] uppercase">Depósito y Condición</span>
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {(selectedSale as any).warehouse?.name || 'Principal'}
                </p>
                <p className="text-slate-400 text-[11px]">
                  {(selectedSale as any).paymentCondition || 'Contado'}
                </p>
              </div>
            </div>

            {/* Artículos */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5">Producto</th>
                    <th className="p-2.5 text-right">Cant</th>
                    <th className="p-2.5 text-right">Unitario</th>
                    <th className="p-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedSale.items?.map((it) => (
                    <tr key={it.id}>
                      <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-100">
                        {it.product?.name}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold">{it.quantity}</td>
                      <td className="p-2.5 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        {formatCurrency(it.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div className="flex justify-end text-xs">
              <div className="w-64 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatCurrency(selectedSale.subtotal)}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Descuento:</span>
                  <span className="font-mono">-{formatCurrency(selectedSale.discountAmount)}</span>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-1 flex justify-between font-black text-slate-900 dark:text-white text-sm">
                  <span>TOTAL:</span>
                  <span className="font-mono text-primary-600 dark:text-primary-400">
                    {formatCurrency(selectedSale.totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Resumen de Fidelización del Comprobante */}
            {selectedSale.customer && ((selectedSale.pointsRedeemed && selectedSale.pointsRedeemed > 0) || (selectedSale.pointsEarned && selectedSale.pointsEarned > 0)) && (
              <div className="flex justify-end text-xs mt-3">
                <div className="w-64 p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40 rounded-xl space-y-1">
                  <div className="flex items-center gap-1 font-bold text-amber-800 dark:text-amber-300 pb-1 border-b border-amber-200/40 text-[11px] uppercase">
                    <Award className="w-3.5 h-3.5 text-amber-500" /> Resumen de Puntos
                  </div>
                  {selectedSale.pointsRedeemed && selectedSale.pointsRedeemed > 0 ? (
                    <div className="flex justify-between font-medium text-rose-600">
                      <span>Puntos Utilizados:</span>
                      <span className="font-mono font-bold">-{selectedSale.pointsRedeemed} pts</span>
                    </div>
                  ) : null}
                  {selectedSale.pointsEarned && selectedSale.pointsEarned > 0 ? (
                    <div className="flex justify-between font-medium text-emerald-600 dark:text-emerald-400">
                      <span>Puntos Obtenidos:</span>
                      <span className="font-mono font-bold">+{selectedSale.pointsEarned} pts</span>
                    </div>
                  ) : null}
                  <div className="border-t border-amber-200/40 pt-1 flex justify-between font-black text-slate-700 dark:text-slate-200 text-[11px]">
                    <span>Saldo Final Cliente:</span>
                    <span className="font-mono">{selectedSale.customer.pointsBalance ?? 0} pts</span>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Modal */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
              <div>
                {canCancel && selectedSale.status === 'COMPLETED' && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={async () => {
                      const confirmed = await swalConfirm(
                        `¿Anular venta ${selectedSale.documentNumber}?`,
                        'Se reingresará el stock y se ajustarán los fondos correspondientes.',
                        'Sí, anular transacción',
                        'Cancelar'
                      );
                      if (confirmed) {
                        cancelMutation.mutate(selectedSale.id);
                      }
                    }}
                    isLoading={cancelMutation.isPending}
                    className="font-bold"
                  >
                    <Ban className="w-3.5 h-3.5 mr-1" /> Anular Transacción
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="font-bold"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" /> Imprimir
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setIsDetailOpen(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
