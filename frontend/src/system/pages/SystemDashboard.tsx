import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { SystemService, SystemMetrics } from '../services/system.service';
import { Building2, Users, CreditCard, Clock, CheckCircle, Package, ShoppingCart, Activity, AlertTriangle, TrendingUp, TrendingDown, Target, Building, FileText } from 'lucide-react';

export const SystemDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const data = await SystemService.getDashboardMetrics();
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching system metrics', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Cargando métricas globales SaaS...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
         title="Dashboard Global (SaaS)"
         subtitle="Métricas consolidadas de rendimiento operativo y orgánico de todos los tenants"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <StatCard
            title="SaaS Revenue (MRR Est)"
            value={`$${Number(metrics?.revenue.mrr || 0).toLocaleString()}`}
            description="Ingresos mensuales combinados."
            icon={CreditCard}
            colorVariant="primary"
         />
         <StatCard
            title="SaaS Revenue (ARR Est)"
            value={`$${Number(metrics?.revenue.arr || 0).toLocaleString()}`}
            description="Proyección anualizada (MRRx12)."
            icon={TrendingUp}
            colorVariant="primary"
         />
         <div className="grid grid-cols-2 gap-2">
            <StatCard
               title="Cobrado (Mes)"
               value={`$${Number(metrics?.revenue.monthlyCollected || 0).toLocaleString()}`}
               description="Facturas PAID"
               icon={Target}
               colorVariant="success"
            />
            <StatCard
               title="Churn (Anulaciones)"
               value={metrics?.churn?.percent?.toString() + '%' || '0%'}
               description={`${metrics?.churn?.count} clientes`}
               icon={TrendingDown}
               colorVariant="danger"
            />
         </div>
         <div className="grid grid-cols-3 gap-2 col-span-1 md:col-span-2 lg:col-span-1">
             <StatCard
                title="Fact. Pendientes"
                value={metrics?.invoices?.pending?.toString() || '0'}
                description="PENDING"
                icon={FileText}
                colorVariant="warning"
             />
             <StatCard
                title="Fact. Pagadas"
                value={metrics?.invoices?.paid?.toString() || '0'}
                description="PAID"
                icon={CheckCircle}
                colorVariant="success"
             />
             <StatCard
                title="Fact. Vencidas"
                value={metrics?.invoices?.overdue?.toString() || '0'}
                description="OVERDUE"
                icon={AlertTriangle}
                colorVariant="danger"
             />
         </div>
         <StatCard
            title="Tenants Activos"
            value={metrics?.tenants.active.toString() || '0'}
            description="Empresas que actualmente pueden utilizar la plataforma."
            icon={Building2}
            trend={{ value: metrics?.tenants.total || 0, label: 'Total Tenants', isPositive: true }}
            colorVariant="info"
         />
         <div className="grid grid-cols-2 gap-2">
            <StatCard
               title="Usuarios Reg."
               value={metrics?.users.total.toString() || '0'}
               description="Registrados"
               icon={Users}
               colorVariant="primary"
            />
            <StatCard
               title="Usuarios Act."
               value={metrics?.users.active?.toString() || '0'}
               description="Activos"
               icon={CheckCircle}
               colorVariant="success"
            />
         </div>
         <div className="grid grid-cols-3 gap-2">
            <StatCard
               title="Contratos Activos"
               value={metrics?.subs.active.toString() || '0'}
               description="En vigor"
               icon={CheckCircle}
               colorVariant="success"
            />
            <StatCard
               title="Pendientes"
               value={metrics?.subs.pending.toString() || '0'}
               description="A Cobrar"
               icon={Clock}
               colorVariant="warning"
            />
            <StatCard
               title="Vencidas"
               value={metrics?.subs.expired.toString() || '0'}
               description="Inactivas"
               icon={CreditCard}
               colorVariant="danger"
            />
         </div>
         <StatCard
            title="Tenants Suspendidos"
            value={metrics?.tenants.suspended.toString() || '0'}
            description="Empresas bloqueadas temporalmente por administración SaaS."
            icon={AlertTriangle}
            colorVariant="danger"
         />
      </div>

      <h3 className="text-lg font-bold text-slate-800 dark:text-white mt-8 mb-4 border-b pb-2">Uso Consolidado Global</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <StatCard
            title="Volumen Comercial Global"
            value={`$${Number(metrics?.sales.totalAmount || 0).toLocaleString()}`}
            description="Total facturado por todos los negocios dentro de la plataforma."
            icon={ShoppingCart}
            colorVariant="success"
         />
         <StatCard
            title="Catálogo Global"
            value={metrics?.products.total.toString() || '0'}
            description="Cantidad total de productos administrados dentro del ecosistema."
            icon={Package}
            colorVariant="primary"
         />
         <StatCard
            title="Clientes Registrados"
            value={metrics?.clients.total.toString() || '0'}
            description="Cantidad total de clientes atendidos por las empresas del ERP."
            icon={Activity}
            colorVariant="warning"
         />
      </div>
    </div>
  );
};
