import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import {
  DollarSign,
  Package,
  Users,
  Activity,
  ArrowUpRight,
  Store,
  Wallet,
  TrendingUp,
  Receipt,
  History,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useDashboard } from '../hooks/useDashboard';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { data: dashboard, isLoading } = useDashboard();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard Centralizado" subtitle="Resumen ejecutivo del estado financiero y operacional" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
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
      {/* 1. Header con Estatus de Caja y Acciones Directas (Estándar Módulo Caja) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Dashboard Centralizado
            </h1>
            {data.cash?.active ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 animate-pulse">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                CAJA ABIERTA
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                CAJA CERRADA
              </span>
            )}
          </div>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitoreo en vivo de ventas, ingresos, inventario y log de actividad del sistema.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/cash')}
            className="font-bold flex items-center gap-1.5"
          >
            <Wallet className="w-4 h-4 text-emerald-500" /> Ir a Caja
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (data.cash?.active) {
                navigate('/pos');
              } else {
                alert('No tienes una caja abierta. Debes abrir una sesión de caja antes de registrar ventas.');
                navigate('/cash');
              }
            }}
            className="font-bold flex items-center gap-1.5 shadow-md"
          >
            <Store className="w-4 h-4" /> Nueva Venta POS
          </Button>
        </div>
      </div>

      {/* 2. Hero KPI Cards (4 Tarjetas al estilo del Módulo Caja) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Ventas del Día */}
        <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-l-4 border-l-emerald-500 dark:bg-slate-900 shadow-sm">
          <CardContent className="p-4 md:p-5">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Venta del Día
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {formatCurrency(data.salesToday.amount)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
              {data.salesToday.percentageChange === 'Nuevo'
                ? 'Sin referencia anterior'
                : `${data.salesToday.percentageChange}% vs jornada previa`}
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Caja Chic Activa */}
        <Card className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-l-amber-500 dark:bg-slate-900 shadow-sm">
          <CardContent className="p-4 md:p-5">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Fondo de Caja
              </span>
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {data.cash.active ? formatCurrency(data.cash.balance) : '$0.00'}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
              {data.cash.name}
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Productos en Stock */}
        <Card className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border-l-4 border-l-indigo-500 dark:bg-slate-900 shadow-sm">
          <CardContent className="p-4 md:p-5">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                Productos Registrados
              </span>
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {data.stock.totalProducts}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium text-rose-500 font-semibold">
              {data.stock.withoutStock} productos sin stock
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Clientes Nuevos */}
        <Card className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-l-4 border-l-blue-500 dark:bg-slate-900 shadow-sm">
          <CardContent className="p-4 md:p-5">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Nuevos Clientes
              </span>
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {data.newCustomers.count}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Registrados esta semana
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Secciones de Detalle y Actividad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ÚLTIMAS VENTAS (COL-SPAN 2) */}
        <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-500" /> Últimas Ventas Procesadas
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/sales')}>
              Ver Todas →
            </Button>
          </CardHeader>
          <CardContent className="p-4">
            {data.recentSales.length === 0 ? (
              <EmptyState
                title="Sin ventas recientes"
                description="Las ventas cobradas desde el POS o Facturación aparecerán en este panel."
                icon={Receipt}
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.recentSales.map((sale: any, index: number) => (
                  <div key={index} className="flex items-center justify-between py-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {sale.customer}
                      </span>
                      <span className="text-xs text-slate-500 font-mono mt-0.5">
                        {sale.paymentMethod} • {format(new Date(sale.createdAt), 'dd MMM, HH:mm', { locale: es })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                        {formatCurrency(sale.amount)}
                      </span>
                      <Badge status={sale.status === 'COMPLETED' || sale.status === 'CONFIRMED' ? 'paid' : 'draft'}>
                        {sale.status === 'COMPLETED' || sale.status === 'CONFIRMED' ? 'COMPLETADO' : sale.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* LOG DE ACTIVIDAD DEL SISTEMA (COL-SPAN 1) */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-500" /> Log de Auditoría Reciente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {data.recentActivity.length === 0 ? (
              <EmptyState
                title="Sin actividad registrada"
                description="El historial de operaciones del sistema se registrará aquí."
                icon={History}
              />
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {data.recentActivity.map((log: any, index: number) => (
                  <div key={index} className="p-3 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold uppercase text-slate-800 dark:text-slate-200 font-mono">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {format(new Date(log.date), 'HH:mm - dd MMM', { locale: es })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Entidad: <span className="font-semibold">{log.entity}</span> • Usuario: <span className="font-semibold">{log.user}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};
