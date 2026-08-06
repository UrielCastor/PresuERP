import React, { useState, useEffect } from 'react';
import { SystemService, Plan } from '../services/system.service';
import {
  Check,
  X,
  Zap,
  Crown,
  Shield,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Award,
} from 'lucide-react';

export const PublicPlanComparison: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await SystemService.getPlans();
      setPlans(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const parseLimits = (plan: Plan) => {
    let limits = {
      maxUsers: plan.maxUsers === 0 ? 'Ilimitados' : plan.maxUsers,
      maxProducts: plan.maxProducts === 0 ? 'Ilimitados' : plan.maxProducts,
      maxWarehouses: 'Ilimitados',
      maxCashRegisters: 'Ilimitadas',
      pos: true,
      api: false,
      loyalty: false,
      reports: true,
    };
    if (plan.features) {
      try {
        const parsed = JSON.parse(plan.features);
        if (parsed.limits) {
          limits.maxWarehouses = parsed.limits.maxWarehouses === null ? 'Ilimitados' : parsed.limits.maxWarehouses;
          limits.maxCashRegisters = parsed.limits.maxCashRegisters === null ? 'Ilimitadas' : parsed.limits.maxCashRegisters;
        }
        if (parsed.modules) {
          limits.pos = parsed.modules.includes('pos');
          limits.api = parsed.modules.includes('api');
          limits.loyalty = parsed.modules.includes('loyalty');
          limits.reports = parsed.modules.includes('reports');
        }
      } catch (e) {}
    }
    return limits;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white p-6 md:p-12 font-sans animate-in fade-in duration-300">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs rounded-full uppercase tracking-wider">
            Comparativa de Planes PresuERP
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Elige el Plan Perfecto para tu Empresa
          </h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400">
            Compare características, límites y funcionalidades entre nuestros planes comerciales.
          </p>

          {/* Monthly / Yearly Switch */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <span className={`text-xs font-extrabold ${billingCycle === 'MONTHLY' ? 'text-indigo-600' : 'text-slate-400'}`}>
              Mensual
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'MONTHLY' ? 'YEARLY' : 'MONTHLY')}
              className="w-14 h-7 bg-indigo-600 rounded-full p-1 transition-colors relative"
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                  billingCycle === 'YEARLY' ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-xs font-extrabold flex items-center gap-1.5 ${billingCycle === 'YEARLY' ? 'text-indigo-600' : 'text-slate-400'}`}>
              Anual <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] rounded-full">Ahorra 20%</span>
            </span>
          </div>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((p) => {
            const limits = parseLimits(p);
            const mPrice = p.prices?.find((pr) => pr.billingCycle === 'MONTHLY')?.price || 0;
            const yPrice = p.prices?.find((pr) => pr.billingCycle === 'YEARLY')?.price || 0;
            const displayPrice = billingCycle === 'MONTHLY' ? mPrice : yPrice;

            return (
              <div
                key={p.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col justify-between p-6 space-y-6 relative hover:border-indigo-500 transition-all"
              >
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase">{p.name}</h3>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">
                        ${Number(displayPrice).toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        /{billingCycle === 'MONTHLY' ? 'mes' : 'año'}
                      </span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Usuarios Incluidos:</span>
                      <strong className="text-slate-900 dark:text-white">{limits.maxUsers}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Productos en Catálogo:</span>
                      <strong className="text-slate-900 dark:text-white">{limits.maxProducts}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Depósitos:</span>
                      <strong className="text-slate-900 dark:text-white">{limits.maxWarehouses}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Cajas de Cobro:</span>
                      <strong className="text-slate-900 dark:text-white">{limits.maxCashRegisters}</strong>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-500">Punto de Venta (POS):</span>
                      {limits.pos ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-slate-300" />}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Integración API / Webhooks:</span>
                      {limits.api ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-slate-300" />}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Programa de Puntos:</span>
                      {limits.loyalty ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-slate-300" />}
                    </div>
                  </div>
                </div>

                <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all">
                  <span>Seleccionar {p.name}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
