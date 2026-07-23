import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import {
  DollarSign,
  Package,
  Users,
  Activity,
  ArrowUpRight
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useDashboard } from '../hooks/useDashboard';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { data: dashboard, isLoading } = useDashboard();
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando Dashboard...</div>;
  }

  const data = dashboard || {
    salesToday: { amount: 0, percentageChange: 'Nuevo' },
    newCustomers: { count: 0, period: 'week' },
    stock: { totalProducts: 0, withoutStock: 0 },
    cash: { active: false, balance: 0, name: 'Sin caja abierta' },
    recentSales: [],
    recentActivity: []
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

  return (
    <div>
      <PageHeader
        title="Dashboard Centralizado"
        subtitle="Monitorea el estado financiero, stock y operaciones de tu negocio."
        action={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<ArrowUpRight className="h-4 w-4" />}
            onClick={() => {
              if (data.cash?.active) {
                navigate('/pos');
              } else {
                alert('No tienes una caja abierta. Debes abrir una sesión de caja antes de registrar ventas.');
                navigate('/cash');
              }
            }}
          >
            Nueva Venta
          </Button>
        }
      />

      {/* Grid of stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Venta del Día"
          value={formatCurrency(data.salesToday.amount)}
          description={data.salesToday.percentageChange === 'Nuevo' ? 'Sin referencia ayer' : `en comparación a ayer`}
          icon={DollarSign}
          trend={data.salesToday.percentageChange !== 'Nuevo' ? { 
            value: `${Math.abs(Number(data.salesToday.percentageChange))}%`, 
            isPositive: Number(data.salesToday.percentageChange) >= 0 
          } : undefined}
        />
        <StatCard
          title="Clientes Nuevos"
          value={data.newCustomers.count.toString()}
          description={`registrados esta semana`}
          icon={Users}
        />
        <StatCard
          title="Productos en Stock"
          value={data.stock.totalProducts.toString()}
          description={`${data.stock.withoutStock} productos sin stock`}
          icon={Package}
        />
        <StatCard
          title="Caja Chica Activa"
          value={data.cash.active ? formatCurrency(data.cash.balance) : '$0'}
          description={data.cash.name}
          icon={Activity}
        />
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recientes */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Últimas Ventas</CardTitle>
              <p className="text-xs text-slate-400 mt-1">Transacciones procesadas en tiempo real.</p>
            </div>
          </CardHeader>
          <CardContent className="mt-4">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recentSales.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm font-medium">No hay ventas registradas aún</div>
              ) : data.recentSales.map((sale: any, index: number) => (
                <div key={index} className="flex items-center justify-between py-3.5">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{sale.customer}</span>
                    <span className="text-xs text-slate-400">{sale.paymentMethod} • {format(new Date(sale.createdAt), 'dd MMM HH:mm', { locale: es })}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(sale.amount)}</span>
                    <Badge variant={sale.status === 'COMPLETED' || sale.status === 'CONFIRMED' ? 'success' : 'default'}>
                      {sale.status === 'COMPLETED' || sale.status === 'CONFIRMED' ? 'Completado' : sale.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notificaciones / Auditoria */}
        <Card>
          <CardHeader>
            <CardTitle>Actividad del Sistema</CardTitle>
            <p className="text-xs text-slate-400 mt-1">Registro de log de auditoría reciente.</p>
          </CardHeader>
          <CardContent className="mt-4">
            <div className="space-y-4">
              {data.recentActivity.length === 0 ? (
                 <div className="py-8 text-center text-slate-500 text-sm font-medium">Sin actividad registrada</div>
              ) : data.recentActivity.map((log: any, index: number) => (
                <div key={index} className="flex items-start gap-3 text-xs leading-relaxed">
                  <div className="h-2 w-2 rounded-full bg-primary-500 mt-1.5 flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">{log.action.replace(/_/g, ' ')} / {log.entity}</span>
                    <span className="text-slate-450 mt-0.5">Por {log.user}</span>
                    <span className="text-[10px] text-slate-400 mt-1">{format(new Date(log.date), "dd MMM, HH:mm", { locale: es })}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
