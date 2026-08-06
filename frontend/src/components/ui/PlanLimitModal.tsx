import React, { useState, useEffect } from 'react';
import { Sparkles, AlertTriangle, ArrowRight, X, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface PlanLimitDetails {
  code: string;
  limitType: string;
  currentCount: number;
  maxLimit: number;
  planName: string;
  message: string;
}

export const PlanLimitModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [details, setDetails] = useState<PlanLimitDetails | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleLimitReached = (e: any) => {
      if (e.detail) {
        setDetails(e.detail);
        setIsOpen(true);
      }
    };

    window.addEventListener('planLimitReached', handleLimitReached);
    return () => window.removeEventListener('planLimitReached', handleLimitReached);
  }, []);

  if (!isOpen || !details) return null;

  const handleViewPlans = () => {
    setIsOpen(false);
    navigate('/system/plans');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 max-w-lg w-full rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden space-y-6 p-6">
        {/* Header Icon */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
            <Sparkles className="h-7 w-7" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-full inline-block">
            Tope de Plan Alcanzado
          </span>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Límite de {details.planName} Alcanzado
          </h2>
        </div>

        {/* Commercial Message */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-center space-y-2">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
            {details.message || `Has alcanzado el límite de tu plan ${details.planName}. Actualiza tu suscripción para continuar expandiendo tu ERP.`}
          </p>
          <div className="text-[11px] font-mono text-slate-400">
            Consumo actual: <strong className="text-slate-900 dark:text-white">{details.currentCount} / {details.maxLimit}</strong>
          </div>
        </div>

        {/* Commercial Action Buttons */}
        <div className="space-y-2 pt-2">
          <button
            onClick={handleViewPlans}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <span>Actualizar Plan de Suscripción</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            onClick={() => setIsOpen(false)}
            className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors"
          >
            Entendido, Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
