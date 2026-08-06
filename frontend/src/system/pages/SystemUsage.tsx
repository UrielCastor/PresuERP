import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { SystemService, Plan } from '../services/system.service';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Users,
  Package,
  Warehouse,
  HardDrive,
  Search,
  ArrowUpRight,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Scale,
  X,
  ArrowRight,
} from 'lucide-react';

interface BusinessUsageItem {
  id: string;
  name: string;
  taxId: string;
  subscriptionPlan: string;
  usersCount: number;
  productsCount: number;
  warehousesCount: number;
  customersCount: number;
  suppliersCount: number;
  limits: {
    maxUsers: number | null;
    maxProducts: number | null;
    maxWarehouses: number | null;
    maxCustomers: number | null;
  };
  usagePercent: number; // Highest usage percentage across resources
  status: 'NORMAL' | 'NEAR_LIMIT' | 'BLOCKED';
}

export const SystemUsage: React.FC = () => {
  const [businesses, setBusinesses] = useState<BusinessUsageItem[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NORMAL' | 'NEAR_LIMIT' | 'BLOCKED'>('ALL');

  // Change Plan Modal State
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessUsageItem | null>(null);
  const [targetPlanName, setTargetPlanName] = useState<string>('');
  const [changeReason, setChangeReason] = useState<string>('');
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadUsageData();
  }, []);

  const loadUsageData = async () => {
    try {
      setLoading(true);
      const [bizList, planList] = await Promise.all([
        SystemService.getBusinesses(false),
        SystemService.getPlans(),
      ]);
      setPlans(planList || []);

      const parsedPlansMap = new Map<string, any>();
      (planList || []).forEach((p) => {
        let parsedLimits = {
          maxUsers: p.maxUsers === 0 ? null : p.maxUsers,
          maxProducts: p.maxProducts === 0 ? null : p.maxProducts,
          maxWarehouses: null,
          maxCustomers: null,
        };
        if (p.features) {
          try {
            const f = JSON.parse(p.features);
            if (f && f.limits) parsedLimits = { ...parsedLimits, ...f.limits };
          } catch (e) {}
        }
        parsedPlansMap.set(p.name, parsedLimits);
      });

      const items: BusinessUsageItem[] = (bizList || []).map((b: any) => {
        const pLimits = parsedPlansMap.get(b.subscriptionPlan) || {
          maxUsers: null,
          maxProducts: null,
          maxWarehouses: null,
          maxCustomers: null,
        };

        const uCount = b._count?.users || b.usersCount || 0;
        const pCount = b._count?.products || b.productsCount || 0;
        const wCount = b._count?.warehouses || b.warehousesCount || 0;
        const cCount = b._count?.customers || b.customersCount || 0;
        const sCount = b._count?.suppliers || 0;

        const uPerc = pLimits.maxUsers ? (uCount / pLimits.maxUsers) * 100 : 0;
        const pPerc = pLimits.maxProducts ? (pCount / pLimits.maxProducts) * 100 : 0;
        const wPerc = pLimits.maxWarehouses ? (wCount / pLimits.maxWarehouses) * 100 : 0;

        const maxPerc = Math.max(uPerc, pPerc, wPerc);
        let status: BusinessUsageItem['status'] = 'NORMAL';
        if (maxPerc >= 100) status = 'BLOCKED';
        else if (maxPerc >= 80) status = 'NEAR_LIMIT';

        return {
          id: b.id,
          name: b.name,
          taxId: b.taxId || 'Sin CUIT',
          subscriptionPlan: b.subscriptionPlan || 'STANDARD',
          usersCount: uCount,
          productsCount: pCount,
          warehousesCount: wCount,
          customersCount: cCount,
          suppliersCount: sCount,
          limits: pLimits,
          usagePercent: Math.round(maxPerc),
          status,
        };
      });

      setBusinesses(items);
    } catch (err) {
      console.error('Error cargando métricas de consumo:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    let list = businesses;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.subscriptionPlan.toLowerCase().includes(q) ||
          b.taxId.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'ALL') {
      list = list.filter((b) => b.status === statusFilter);
    }
    return list;
  }, [businesses, searchQuery, statusFilter]);

  const kpis = useMemo(() => {
    const total = businesses.length;
    const nearLimit = businesses.filter((b) => b.status === 'NEAR_LIMIT').length;
    const blocked = businesses.filter((b) => b.status === 'BLOCKED').length;
    const normal = businesses.filter((b) => b.status === 'NORMAL').length;
    return { total, nearLimit, blocked, normal };
  }, [businesses]);

  const handleOpenChangePlan = (biz: BusinessUsageItem) => {
    setSelectedBusiness(biz);
    setTargetPlanName(biz.subscriptionPlan);
    setChangeReason('Upgrade comercial desde Dashboard de Consumo');
  };

  const handleConfirmChangePlan = async () => {
    if (!selectedBusiness || !targetPlanName) return;
    setIsChangingPlan(true);
    setNotification(null);

    try {
      await SystemService.changeBusinessPlan(selectedBusiness.id, targetPlanName);
      setNotification({
        type: 'success',
        message: `Suscripción de "${selectedBusiness.name}" actualizada al plan ${targetPlanName}.`,
      });
      setSelectedBusiness(null);
      await loadUsageData();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Error al cambiar la suscripción de la empresa.',
      });
    } finally {
      setIsChangingPlan(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-16 font-sans animate-in fade-in duration-300">
      <PageHeader
        title="Consumo y Uso de Empresas (SaaS)"
        subtitle="Monitoreo en tiempo real de capacidad, límites de plan y estado operativo"
        action={
          <button
            onClick={loadUsageData}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Actualizar Datos
          </button>
        }
      />

      {/* KPI Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-xs font-bold text-slate-400 block">Total Empresas Activas</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{kpis.total} empresas</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-xs font-bold text-emerald-600 block">🟢 Operación Normal</span>
          <div className="text-2xl font-black text-emerald-600">{kpis.normal} empresas</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-xs font-bold text-amber-600 block">🟡 Cerca del Límite (80-99%)</span>
          <div className="text-2xl font-black text-amber-600">{kpis.nearLimit} empresas</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-xs font-bold text-rose-600 block">🔴 Límite Alcanzado / Bloqueado</span>
          <div className="text-2xl font-black text-rose-600">{kpis.blocked} empresas</div>
        </div>
      </div>

      {/* Filter and Control Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Todas ({businesses.length})
          </button>

          <button
            onClick={() => setStatusFilter('NORMAL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              statusFilter === 'NORMAL'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            🟢 Normales ({kpis.normal})
          </button>

          <button
            onClick={() => setStatusFilter('NEAR_LIMIT')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              statusFilter === 'NEAR_LIMIT'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            🟡 Cerca del Límite ({kpis.nearLimit})
          </button>

          <button
            onClick={() => setStatusFilter('BLOCKED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              statusFilter === 'BLOCKED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            🔴 En Límite / Bloqueadas ({kpis.blocked})
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por empresa o plan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main Businesses Usage Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs animate-pulse">Cargando métricas de consumo...</div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
          No se encontraron empresas coincidentes con los filtros seleccionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredItems.map((b) => {
            return (
              <div
                key={b.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-5 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Business Header & Status Badge */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-indigo-600" />
                        {b.name}
                      </h3>
                      <span className="text-[11px] font-mono text-slate-400">CUIT: {b.taxId}</span>
                    </div>

                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        b.status === 'NORMAL'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : b.status === 'NEAR_LIMIT'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      {b.status === 'NORMAL' ? '🟢 Normal' : b.status === 'NEAR_LIMIT' ? '🟡 Cerca del Límite' : '🔴 En Límite'}
                    </span>
                  </div>

                  {/* Plan Badge */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500">Plan de Suscripción:</span>
                    <span className="font-black text-indigo-600 dark:text-indigo-400 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 rounded-md uppercase">
                      {b.subscriptionPlan}
                    </span>
                  </div>

                  {/* Resource Meters */}
                  <div className="space-y-3 pt-1">
                    {/* Meter 1: Users */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-indigo-500" /> Usuarios
                        </span>
                        <span className="text-slate-900 dark:text-white font-mono">
                          {b.usersCount} / {b.limits.maxUsers === null ? '∞' : b.limits.maxUsers}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            b.limits.maxUsers && b.usersCount >= b.limits.maxUsers
                              ? 'bg-rose-500'
                              : b.limits.maxUsers && b.usersCount / b.limits.maxUsers >= 0.8
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{
                            width: `${
                              b.limits.maxUsers ? Math.min(100, (b.usersCount / b.limits.maxUsers) * 100) : 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Meter 2: Products */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-indigo-500" /> Productos
                        </span>
                        <span className="text-slate-900 dark:text-white font-mono">
                          {b.productsCount} / {b.limits.maxProducts === null ? '∞' : b.limits.maxProducts}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            b.limits.maxProducts && b.productsCount >= b.limits.maxProducts
                              ? 'bg-rose-500'
                              : b.limits.maxProducts && b.productsCount / b.limits.maxProducts >= 0.8
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{
                            width: `${
                              b.limits.maxProducts ? Math.min(100, (b.productsCount / b.limits.maxProducts) * 100) : 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Meter 3: Warehouses */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <Warehouse className="h-3.5 w-3.5 text-indigo-500" /> Depósitos
                        </span>
                        <span className="text-slate-900 dark:text-white font-mono">
                          {b.warehousesCount} / {b.limits.maxWarehouses === null ? '∞' : b.limits.maxWarehouses}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full transition-all"
                          style={{
                            width: `${
                              b.limits.maxWarehouses
                                ? Math.min(100, (b.warehousesCount / b.limits.maxWarehouses) * 100)
                                : 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Upgrade / Action Button */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => handleOpenChangePlan(b)}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Scale className="h-4 w-4" /> Cambiar Plan / Upgrade
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL: SIDE-BY-SIDE PLAN CHANGE & UPGRADE ────────────────────────── */}
      {selectedBusiness && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 max-w-xl w-full rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Cambio de Plan para {selectedBusiness.name}
                </h3>
              </div>
              <button onClick={() => setSelectedBusiness(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Comparison Cards Side-by-Side */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase block">Plan Actual</span>
                <div className="text-lg font-black text-slate-900 dark:text-white">{selectedBusiness.subscriptionPlan}</div>
                <div className="text-xs font-semibold text-slate-500">
                  Users: {selectedBusiness.limits.maxUsers || 'Ilimitado'}
                </div>
              </div>

              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-2">
                <span className="text-[10px] font-black text-indigo-600 uppercase block">Nuevo Plan</span>
                <select
                  value={targetPlanName}
                  onChange={(e) => setTargetPlanName(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-black text-slate-900 dark:text-white"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Motivo Comercial de la Modificación
              </label>
              <textarea
                rows={2}
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedBusiness(null)}
                className="px-4 py-2 bg-slate-100 rounded-xl text-slate-700 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmChangePlan}
                disabled={isChangingPlan}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {isChangingPlan ? 'Guardando...' : 'Confirmar Cambio de Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
