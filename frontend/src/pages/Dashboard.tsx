import React, { useState, useEffect, useMemo } from 'react';
import { swalWarning } from '../utils/swal';
import { useQuery } from '@tanstack/react-query';
import { warehouseApi } from '../services/warehouse.service';
import { Badge } from '../components/ui/Badge';
import {
  Package,
  Users,
  Activity,
  Store,
  Wallet,
  TrendingUp,
  Receipt,
  ArrowRight,
  Building2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useDashboard } from '../hooks/useDashboard';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

import { getInitialWarehouseId } from '../utils/warehouse';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const defaultWhId = getInitialWarehouseId(user) || undefined;

  const isCompanyAdmin = user?.isStaff || user?.role === 'Administrator';

  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(() => {
    if (isCompanyAdmin) {
      return defaultWhId || 'ALL';
    }
    if (defaultWhId) return defaultWhId;
    if (user?.userWarehouses && user.userWarehouses.length > 0) {
      return user.userWarehouses[0].warehouseId || user.userWarehouses[0].warehouse?.id || 'ALL';
    }
    return 'ALL';
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: warehouseApi.list,
  });

  const displayWarehouses = useMemo(() => {
    if (user?.isStaff) return warehouses;
    if (user?.userWarehouses && user.userWarehouses.length > 0) {
      const authorizedIds = new Set(
        user.userWarehouses.map((uw) => uw.warehouseId || uw.warehouse?.id).filter(Boolean)
      );
      if (user.defaultWarehouseId) authorizedIds.add(user.defaultWarehouseId);
      if (user.defaultWarehouse?.id) authorizedIds.add(user.defaultWarehouse.id);

      const filtered = warehouses.filter((w: any) => authorizedIds.has(w.id));
      return filtered.length > 0 ? filtered : warehouses;
    }
    return warehouses;
  }, [warehouses, user]);

  useEffect(() => {
    if (!isCompanyAdmin) {
      if (defaultWhId && selectedWarehouse !== defaultWhId) {
        setSelectedWarehouse(defaultWhId);
      } else if (!defaultWhId && displayWarehouses.length > 0 && selectedWarehouse === 'ALL') {
        setSelectedWarehouse(displayWarehouses[0].id);
      }
    } else {
      if (!selectedWarehouse) {
        setSelectedWarehouse(defaultWhId || 'ALL');
      }
    }
  }, [defaultWhId, isCompanyAdmin, displayWarehouses, selectedWarehouse]);

  console.log('[DASHBOARD] estado del depósito:', {
    selectedWarehouse,
    defaultWhId,
    'user.isStaff': user?.isStaff,
    'user.defaultWarehouseId': user?.defaultWarehouseId,
    'user.defaultWarehouse': user?.defaultWarehouse,
    'user.userWarehouses': user?.userWarehouses,
  });

  const { data: dashboard, isLoading } = useDashboard(selectedWarehouse);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const data = dashboard || {
    salesToday: { amount: 0, percentageChange: 'Nuevo' },
    newCustomers: { count: 0, period: 'week' },
    stock: { totalProducts: 0, withoutStock: 0 },
    cash: { active: false, balance: 0, name: 'Sin caja abierta' },
    recentSales: [],
    recentActivity: []
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

  return (
    <div className="space-y-6">
      {/* 1. ENCABEZADO ESTILO POS */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl leading-none">📊</span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Dashboard Centralizado
            </h1>
            {data.cash?.active ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                CAJA ABIERTA
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                CAJA CERRADA
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Centro de control operativo: ventas en vivo, caja, productos y clientes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            <Building2 className="w-4 h-4 text-primary-500 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Depósito Actual</span>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                disabled={warehouses.length === 0}
                className="bg-transparent text-xs font-extrabold text-slate-900 dark:text-white focus:outline-none cursor-pointer disabled:opacity-50"
              >
                {warehouses.length === 0 ? (
                  <option value="">Sin depósitos autorizados</option>
                ) : (
                  <>
                    {isCompanyAdmin && <option value="ALL">🏢 Todos los locales</option>}
                    {displayWarehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>
                        🏭 {w.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => navigate('/cash')}
            leftIcon={<Wallet className="w-4 h-4 text-emerald-500" />}
            className="text-xs font-bold rounded-xl"
          >
            Ir a Caja
          </Button>

          <Button
            variant="primary"
            onClick={() => {
              if (data.cash?.active) {
                navigate('/pos');
              } else {
                swalWarning('Caja Requerida', 'No tienes una caja abierta. Debes abrir una sesión de caja antes de registrar ventas.');
                navigate('/cash');
              }
            }}
            leftIcon={<Store className="w-4 h-4" />}
            className="text-xs font-bold shadow-md rounded-xl"
          >
            Nueva Venta POS
          </Button>
        </div>
      </div>

      {/* 2. CARDS PRINCIPALES ESTILO POS (4 COLUMNAS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
        {/* KPI 1: Venta del Día */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-2xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-3 relative group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Venta del Día
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
              {formatCurrency(data.salesToday.amount)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
              {data.salesToday.percentageChange === 'Nuevo'
                ? 'Sin referencia anterior'
                : `${data.salesToday.percentageChange}% vs jornada previa`}
            </p>
          </div>
        </div>

        {/* KPI 2: Fondo de Caja */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-2xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-3 relative group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Fondo de Caja
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
              {data.cash.active ? formatCurrency(data.cash.balance) : '$0.00'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium truncate">
              {data.cash.name}
            </p>
          </div>
        </div>

        {/* KPI 3: Productos Registrados */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-2xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-3 relative group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Productos Registrados
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
              {data.stock.totalProducts}
            </div>
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1.5 truncate">
              {data.stock.withoutStock} productos sin stock
            </p>
          </div>
        </div>

        {/* KPI 4: Nuevos Clientes */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-2xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-3 relative group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Nuevos Clientes
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
              {data.newCustomers.count}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
              Registrados esta semana
            </p>
          </div>
        </div>
      </div>

      {/* 3. ÚLTIMAS VENTAS PROCESADAS (ESTILO TABLA ERP / POS AMPLIA) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧾</span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Últimas Ventas Procesadas
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/sales')}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            className="text-xs font-bold rounded-xl"
          >
            Ver Todas las Ventas
          </Button>
        </div>

        {data.recentSales.length === 0 ? (
          <EmptyState
            title="Sin ventas recientes"
            description="Las ventas cobradas desde el POS o Facturación aparecerán en este panel."
            icon={Receipt}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse table-fixed min-w-[700px] lg:min-w-0">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 w-40">Método de Pago</th>
                  <th className="px-4 py-3 w-44">Fecha / Hora</th>
                  <th className="px-4 py-3 text-right w-36">Importe</th>
                  <th className="px-4 py-3 text-center w-32">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-medium">
                {data.recentSales.map((sale: any, index: number) => (
                  <tr
                    key={index}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => navigate('/sales')}
                  >
                    {/* Cliente */}
                    <td className="px-4 py-3.5 overflow-hidden">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {sale.customer}
                      </div>
                    </td>

                    {/* Método de Pago */}
                    <td className="px-4 py-3.5 overflow-hidden">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 truncate">
                        💳 {sale.paymentMethod}
                      </span>
                    </td>

                    {/* Fecha / Hora */}
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {format(new Date(sale.createdAt), 'dd MMM yyyy, HH:mm', { locale: es })}
                    </td>

                    {/* Importe */}
                    <td className="px-4 py-3.5 text-right font-mono font-black text-sm text-slate-900 dark:text-white whitespace-nowrap">
                      {formatCurrency(sale.amount)}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <Badge status={sale.status === 'COMPLETED' || sale.status === 'CONFIRMED' ? 'paid' : 'draft'}>
                        {sale.status === 'COMPLETED' || sale.status === 'CONFIRMED' ? 'COMPLETADO' : sale.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
