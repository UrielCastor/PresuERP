import React, { useState, useEffect, useMemo } from 'react';
import { swalConfirm } from '../../utils/swal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { DataGrid } from '../../components/ui/DataGrid';
import { SystemService, Plan, PlanPrice } from '../services/system.service';
import {
  Plus,
  Save,
  Layers,
  AlertTriangle,
  Copy,
  Trash2,
  Edit,
  Power,
  CheckCircle2,
  XCircle,
  Sparkles,
  Zap,
  Shield,
  Crown,
  Building2,
  Users,
  Package,
  Warehouse,
  Wallet,
  Settings,
  HelpCircle,
  Eye,
  DollarSign,
  Grid,
  List,
  Check,
  X,
  Tag,
  Calendar,
  Lock,
  Globe,
  Star,
  CheckSquare,
  Square,
  Award,
} from 'lucide-react';

// ─── Interfaces for Enterprise Plan Builder ─────────────────────────────

export interface PlanLimitsState {
  maxUsers: number | null;
  maxProducts: number | null;
  maxCustomers: number | null;
  maxSuppliers: number | null;
  maxWarehouses: number | null;
  maxCashRegisters: number | null;
  maxBranches: number | null;
  maxPriceLists: number | null;
  maxRoles: number | null;
  maxPosTerminals: number | null;
  maxSellers: number | null;
  maxMonthlyPurchases: number | null;
  maxMonthlySales: number | null;
  maxStorageGb: number | null;
}

export interface PlanFeatureDetails {
  description: string;
  color: string;
  badge: string;
  icon: string;
  sortOrder: number;
  isRecommended: boolean;
  isPublic: boolean;
  trialDays: number;
  annualDiscount: number;
  currency: string;
  taxesIncluded: boolean;
  limits: PlanLimitsState;
  modules: string[];
  premiumFeatures: string[];
}

const DEFAULT_LIMITS: PlanLimitsState = {
  maxUsers: 10,
  maxProducts: 500,
  maxCustomers: 1000,
  maxSuppliers: 100,
  maxWarehouses: 2,
  maxCashRegisters: 2,
  maxBranches: 1,
  maxPriceLists: 3,
  maxRoles: 5,
  maxPosTerminals: 3,
  maxSellers: 10,
  maxMonthlyPurchases: null,
  maxMonthlySales: null,
  maxStorageGb: 10,
};

const DEFAULT_DETAILS: PlanFeatureDetails = {
  description: 'Plan empresarial para PyMEs comerciales en expansión',
  color: '#4f46e5',
  badge: 'POPULAR',
  icon: 'Zap',
  sortOrder: 1,
  isRecommended: false,
  isPublic: true,
  trialDays: 14,
  annualDiscount: 20,
  currency: 'ARS',
  taxesIncluded: true,
  limits: DEFAULT_LIMITS,
  modules: [
    'dashboard',
    'pos',
    'cash',
    'customers',
    'products',
    'inventory',
    'purchases',
    'logistics',
    'reports',
    'settings',
  ],
  premiumFeatures: [
    'loyalty_program',
    'current_account',
    'multi_warehouse',
    'exports',
    'backups',
  ],
};

// All ERP Modules Checklist
const ERP_MODULES_LIST = [
  { id: 'dashboard', label: 'Dashboard Principal', desc: 'Métricas de ventas e indicadores en vivo' },
  { id: 'pos', label: 'Ventas (POS Terminal)', desc: 'Facturación rápida en punto de venta' },
  { id: 'cash', label: 'Caja y Tesorería', desc: 'Apertura, cierres Z y movimientos' },
  { id: 'customers', label: 'Gestión de Clientes', desc: 'Base de clientes y cuentas corrientes' },
  { id: 'products', label: 'Productos y Precios', desc: 'Catálogo, márgenes y listas de precio' },
  { id: 'inventory', label: 'Inventario y Stock', desc: 'Control de existencias e historial' },
  { id: 'purchases', label: 'Compras a Proveedores', desc: 'Órdenes de compra e ingreso de stock' },
  { id: 'logistics', label: 'Logística y Traspasos', desc: 'Pedidos y transferencias entre depósitos' },
  { id: 'reports', label: 'Reportes Estadísticos', desc: 'Análisis comercial y financiero' },
  { id: 'audit', label: 'Bitácora de Auditoría', desc: 'Logs de seguridad y cambios' },
  { id: 'company', label: 'Perfil de Empresa', desc: 'Configuración fiscal y logo' },
  { id: 'settings', label: 'Configuración General', desc: 'Ajustes del sistema y preferencias' },
  { id: 'users', label: 'Usuarios del Sistema', desc: 'Gestión de accesos y credenciales' },
  { id: 'roles', label: 'Roles y Capacidades', desc: 'Permisos granulares por acción' },
  { id: 'api', label: 'API de Integración', desc: 'Conexión REST/Webhooks externa' },
  { id: 'mercadopago', label: 'Pasarela MercadoPago', desc: 'Cobros QR y links de pago' },
  { id: 'billing', label: 'Facturación AFIP / ARCA', desc: 'Comprobantes electrónicos directos' },
  { id: 'loyalty', label: 'Programa de Puntos', desc: 'Fidelización de clientes por compras' },
  { id: 'promotions', label: 'Promociones y Ofertas', desc: 'Descuentos automáticos por fecha/volumen' },
  { id: 'crm', label: 'CRM & Cta Cte', desc: 'Seguimiento de saldos y créditos' },
];

// Premium Advanced Features Checklist
const PREMIUM_FEATURES_LIST = [
  { id: 'loyalty_program', label: 'Programa de Puntos y Canjes' },
  { id: 'current_account', label: 'Cuenta Corriente & Saldos' },
  { id: 'multi_warehouse', label: 'Múltiples Depósitos / Almacenes' },
  { id: 'multi_cash', label: 'Múltiples Cajas Simultáneas' },
  { id: 'offline_mode', label: 'Modo Operativo Offline' },
  { id: 'api_integrations', label: 'Integraciones API REST' },
  { id: 'webhooks', label: 'Webhooks Event-Driven' },
  { id: 'exports', label: 'Exportación Masiva Excel/CSV' },
  { id: 'imports', label: 'Importación Masiva de Datos' },
  { id: 'backups', label: 'Backups Diarios Automáticos' },
  { id: 'audit_logs', label: 'Logs Auditables Enterprise' },
  { id: 'notifications', label: 'Notificaciones WhatsApp & Email' },
  { id: 'multi_company', label: 'Gestión Multiempresa' },
  { id: 'white_label', label: 'Marca Blanca / Personalización' },
  { id: 'custom_domain', label: 'Dominio Personalizado' },
];

type ModalTab = 'GENERAL' | 'BILLING' | 'LIMITS' | 'MODULES' | 'PREMIUM' | 'BRANDING' | 'SUMMARY';

export const SystemPlans: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'CARDS' | 'GRID'>('CARDS');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('GENERAL');
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  // Form Fields State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [active, setActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [monthlyPrice, setMonthlyPrice] = useState<string>('');
  const [yearlyPrice, setYearlyPrice] = useState<string>('');

  // Structured Features Details State
  const [details, setDetails] = useState<PlanFeatureDetails>(DEFAULT_DETAILS);

  // Saving / Duplicating / Deleting Loading State
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notification Toast State
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await SystemService.getPlans();
      setPlans(data || []);
    } catch (error) {
      console.error('Error cargando planes SaaS:', error);
      setNotification({ type: 'error', message: 'Error al cargar la lista de planes.' });
    } finally {
      setLoading(false);
    }
  };

  // Helper to parse features JSON safely
  const parsePlanDetails = (featuresStr?: string): PlanFeatureDetails => {
    if (!featuresStr) return DEFAULT_DETAILS;
    try {
      const parsed = JSON.parse(featuresStr);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return {
          ...DEFAULT_DETAILS,
          ...parsed,
          limits: { ...DEFAULT_LIMITS, ...(parsed.limits || {}) },
          modules: parsed.modules || DEFAULT_DETAILS.modules,
          premiumFeatures: parsed.premiumFeatures || DEFAULT_DETAILS.premiumFeatures,
        };
      }
    } catch (e) {
      // If features was stored as string array or plain text
    }
    return DEFAULT_DETAILS;
  };

  const handleOpenNewModal = () => {
    setEditingPlanId(null);
    setName('');
    setCode('');
    setActive(true);
    setIsDefault(false);
    setMonthlyPrice('');
    setYearlyPrice('');
    setDetails(DEFAULT_DETAILS);
    setActiveTab('GENERAL');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (plan: Plan) => {
    setEditingPlanId(plan.id || null);
    setName(plan.name || '');
    setCode(plan.code || '');
    setActive(plan.active !== undefined ? plan.active : true);
    setIsDefault(!!plan.isDefault);

    const mPrice = plan.prices?.find((p) => p.billingCycle === 'MONTHLY')?.price;
    const yPrice = plan.prices?.find((p) => p.billingCycle === 'YEARLY')?.price;
    setMonthlyPrice(mPrice !== undefined ? String(mPrice) : '');
    setYearlyPrice(yPrice !== undefined ? String(yPrice) : '');

    const parsedDetails = parsePlanDetails(plan.features);
    // Sync maxUsers & maxProducts from model columns if available
    parsedDetails.limits.maxUsers = plan.maxUsers === 0 ? null : plan.maxUsers;
    parsedDetails.limits.maxProducts = plan.maxProducts === 0 ? null : plan.maxProducts;

    setDetails(parsedDetails);
    setActiveTab('GENERAL');
    setIsModalOpen(true);
  };

  const handleDuplicatePlan = async (planId: string) => {
    try {
      setIsSubmitting(true);
      const duplicated = await SystemService.duplicatePlan(planId);
      setNotification({
        type: 'success',
        message: `Plan duplicado exitosamente como "${duplicated.name}".`,
      });
      await fetchPlans();
    } catch (error: any) {
      console.error(error);
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Error al duplicar el plan.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlan = async (plan: Plan) => {
    if (plan.businessesCount && plan.businessesCount > 0) {
      setNotification({
        type: 'error',
        message: `Este plan está siendo utilizado por ${plan.businessesCount} empresa${plan.businessesCount > 1 ? 's' : ''}. Debe migrarlas antes de eliminarlo.`,
      });
      return;
    }

    const confirmed = await swalConfirm(
      '¿Eliminar Plan SaaS?',
      `¿Confirma que desea eliminar definitivamente el plan "${plan.name}"? Esta acción no se puede deshacer.`,
      'Sí, eliminar plan',
      'Cancelar'
    );
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      await SystemService.deletePlan(plan.id!);
      setNotification({ type: 'success', message: `Plan "${plan.name}" eliminado correctamente.` });
      await fetchPlans();
    } catch (error: any) {
      console.error(error);
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Error al eliminar el plan.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (plan: Plan) => {
    try {
      await SystemService.changePlanStatus(plan.id!, !plan.active);
      fetchPlans();
    } catch (error) {
      console.error(error);
      setNotification({ type: 'error', message: 'Error cambiando el estado del plan.' });
    }
  };

  const handleSavePlan = async (e?: React.FormEvent, createAnother: boolean = false) => {
    if (e) e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setNotification({ type: 'error', message: 'Por favor complete el nombre y código del plan.' });
      return;
    }

    setIsSubmitting(true);
    setNotification(null);

    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        maxUsers: details.limits.maxUsers === null ? 0 : Number(details.limits.maxUsers),
        maxProducts: details.limits.maxProducts === null ? 0 : Number(details.limits.maxProducts),
        active,
        isDefault,
        monthlyPrice: monthlyPrice ? Number(monthlyPrice) : 0,
        yearlyPrice: yearlyPrice ? Number(yearlyPrice) : 0,
        features: JSON.stringify(details),
      };

      if (editingPlanId) {
        await SystemService.updatePlan(editingPlanId, payload);
        setNotification({ type: 'success', message: `Plan "${name}" actualizado correctamente.` });
      } else {
        await SystemService.createPlan(payload);
        setNotification({ type: 'success', message: `Plan "${name}" creado exitosamente.` });
      }

      await fetchPlans();

      if (createAnother) {
        handleOpenNewModal();
      } else {
        setIsModalOpen(false);
      }
    } catch (error: any) {
      console.error(error);
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Error guardando la configuración del plan.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper limit toggle handler
  const handleLimitToggle = (key: keyof PlanLimitsState, defaultVal: number = 10) => {
    setDetails((prev) => {
      const currentVal = prev.limits[key];
      const nextVal = currentVal === null ? defaultVal : null;
      return {
        ...prev,
        limits: {
          ...prev.limits,
          [key]: nextVal,
        },
      };
    });
  };

  const handleLimitValueChange = (key: keyof PlanLimitsState, val: string) => {
    const num = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
    setDetails((prev) => ({
      ...prev,
      limits: {
        ...prev.limits,
        [key]: num,
      },
    }));
  };

  const handleModuleToggle = (modId: string) => {
    setDetails((prev) => {
      const hasMod = prev.modules.includes(modId);
      const nextMods = hasMod ? prev.modules.filter((m) => m !== modId) : [...prev.modules, modId];
      return { ...prev, modules: nextMods };
    });
  };

  const handlePremiumToggle = (featId: string) => {
    setDetails((prev) => {
      const hasFeat = prev.premiumFeatures.includes(featId);
      const nextFeats = hasFeat ? prev.premiumFeatures.filter((f) => f !== featId) : [...prev.premiumFeatures, featId];
      return { ...prev, premiumFeatures: nextFeats };
    });
  };

  // Table Columns Setup
  const gridColumns = [
    {
      header: 'Plan Comercial',
      cell: (row: Plan) => {
        const d = parsePlanDetails(row.features);
        return (
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black shadow-xs flex-shrink-0"
              style={{ backgroundColor: d.color || '#4f46e5' }}
            >
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{row.name}</span>
                {d.badge && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                    {d.badge}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 font-mono">{row.code}</span>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Precios (Mensual / Anual)',
      cell: (row: Plan) => {
        const mPrice = row.prices?.find((p) => p.billingCycle === 'MONTHLY')?.price;
        const yPrice = row.prices?.find((p) => p.billingCycle === 'YEARLY')?.price;
        return (
          <div className="space-y-0.5 text-xs font-bold font-mono">
            <div className="text-slate-900 dark:text-white">
              Mensual: <span className="text-emerald-600">${mPrice ? Number(mPrice).toLocaleString() : 'N/A'}</span>
            </div>
            <div className="text-slate-500">
              Anual: <span className="text-indigo-600">${yPrice ? Number(yPrice).toLocaleString() : 'N/A'}</span>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Empresas Subscriptas',
      cell: (row: Plan) => (
        <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {row.businessesCount || 0} empresas
        </span>
      ),
    },
    {
      header: 'Límites Clave',
      cell: (row: Plan) => {
        const d = parsePlanDetails(row.features);
        return (
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 space-y-0.5">
            <div>Users: <strong className="text-slate-900 dark:text-white">{d.limits.maxUsers === null ? 'Ilimitado' : d.limits.maxUsers}</strong></div>
            <div>Productos: <strong className="text-slate-900 dark:text-white">{d.limits.maxProducts === null ? 'Ilimitado' : d.limits.maxProducts}</strong></div>
            <div>Depósitos: <strong className="text-slate-900 dark:text-white">{d.limits.maxWarehouses === null ? 'Ilimitado' : d.limits.maxWarehouses}</strong></div>
          </div>
        );
      },
    },
    {
      header: 'Estado',
      cell: (row: Plan) => (
        <span
          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
            row.active
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {row.active ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      header: 'Acciones',
      cell: (row: Plan) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleOpenEditModal(row)}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors"
            title="Editar Plan"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDuplicatePlan(row.id!)}
            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 rounded-lg text-xs font-bold transition-colors"
            title="Duplicar Plan"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggleStatus(row)}
            className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
              row.active
                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300'
            }`}
            title={row.active ? 'Desactivar Plan' : 'Activar Plan'}
          >
            <Power className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeletePlan(row)}
            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-300 rounded-lg text-xs font-bold transition-colors"
            title="Eliminar Plan"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-16 font-sans animate-in fade-in duration-300">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Sparkles className="h-6 w-6 text-indigo-600" />
            Constructor Visual de Planes y Suscripciones SaaS
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Diseñe comercialmente los paquetes, precios, límites y módulos habilitados para sus empresas cliente.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('CARDS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                viewMode === 'CARDS'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Grid className="h-3.5 w-3.5" /> Tarjetas
            </button>
            <button
              onClick={() => setViewMode('GRID')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                viewMode === 'GRID'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <List className="h-3.5 w-3.5" /> Tabla
            </button>
          </div>

          <button
            onClick={handleOpenNewModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" /> Nuevo Plan SaaS
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between gap-3 font-semibold ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* CARDS VIEW MODE */}
      {viewMode === 'CARDS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const d = parsePlanDetails(plan.features);
            const mPrice = plan.prices?.find((p) => p.billingCycle === 'MONTHLY')?.price;
            const yPrice = plan.prices?.find((p) => p.billingCycle === 'YEARLY')?.price;

            return (
              <div
                key={plan.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col justify-between transition-all hover:shadow-md relative"
              >
                {/* Top Color Accent Line */}
                <div className="h-3.5 w-full" style={{ backgroundColor: d.color || '#4f46e5' }} />

                <div className="p-6 space-y-5 flex-1">
                  {/* Badge & Status Header */}
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10px] font-black px-3 py-1 rounded-full text-white uppercase tracking-wider shadow-2xs"
                      style={{ backgroundColor: d.color || '#4f46e5' }}
                    >
                      {d.badge || 'PLAN SAAS'}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold text-slate-400">
                        {plan.businessesCount || 0} empresas
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md ${
                          plan.active
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {plan.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>

                  {/* Plan Name & Code */}
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {d.description}
                    </p>
                  </div>

                  {/* Price Banner */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        ${mPrice ? Number(mPrice).toLocaleString() : '0'}
                      </span>
                      <span className="text-xs font-bold text-slate-400">/ mes</span>
                    </div>
                    {yPrice && (
                      <div className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400">
                        ${Number(yPrice).toLocaleString()} / año (Ahorro del {d.annualDiscount || 20}%)
                      </div>
                    )}
                  </div>

                  {/* Limits Checklist */}
                  <div className="space-y-2 text-xs font-semibold">
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      Límites del Plan
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Users: <strong>{d.limits.maxUsers === null ? 'Ilimitado' : d.limits.maxUsers}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Productos: <strong>{d.limits.maxProducts === null ? 'Ilimitado' : d.limits.maxProducts}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Warehouse className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Depósitos: <strong>{d.limits.maxWarehouses === null ? 'Ilimitado' : d.limits.maxWarehouses}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Cajas: <strong>{d.limits.maxCashRegisters === null ? 'Ilimitado' : d.limits.maxCashRegisters}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Included ERP Modules Preview */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      Módulos Habilitados ({d.modules.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {d.modules.slice(0, 7).map((m) => (
                        <span key={m} className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md">
                          ✔ {m}
                        </span>
                      ))}
                      {d.modules.length > 7 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded-md">
                          +{d.modules.length - 7} más
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditModal(plan)}
                      className="px-3.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-extrabold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
                    >
                      <Edit className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => handleDuplicatePlan(plan.id!)}
                      className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5" /> Duplicar
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleStatus(plan)}
                      className={`p-2 rounded-xl text-xs font-bold transition-all ${
                        plan.active
                          ? 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                      title={plan.active ? 'Desactivar Plan' : 'Activar Plan'}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePlan(plan)}
                      className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-300 rounded-xl transition-all"
                      title="Eliminar Plan"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* GRID VIEW MODE */}
      {viewMode === 'GRID' && (
        <Card>
          <CardContent className="p-0">
            <DataGrid
              columns={gridColumns}
              data={plans}
              isLoading={loading}
              keyExtractor={(item) => item.id!}
            />
          </CardContent>
        </Card>
      )}

      {/* ─── MODAL XL: VISUAL PLAN BUILDER ────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] font-sans animate-in zoom-in-95 duration-200">
            {/* Modal Top Accent Header */}
            <div
              className="p-5 text-white flex items-center justify-between shadow-xs transition-colors"
              style={{ backgroundColor: details.color || '#4f46e5' }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight">
                    {editingPlanId ? `Editar Plan: ${name || 'Sin Nombre'}` : 'Constructor Visual de Nuevo Plan SaaS'}
                  </h2>
                  <p className="text-xs text-white/80 mt-0.5">
                    Defina precios, límites dinámicos y matriz de funciones para el tenant.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Tabs Navigation Bar */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('GENERAL')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  activeTab === 'GENERAL'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                📌 Información General
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('BILLING')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  activeTab === 'BILLING'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                💳 Facturación & Precios
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('LIMITS')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  activeTab === 'LIMITS'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                📊 Límites Dinámicos
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('MODULES')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  activeTab === 'MODULES'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                🧩 Módulos ERP ({details.modules.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('PREMIUM')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  activeTab === 'PREMIUM'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                ⭐ Funciones Premium ({details.premiumFeatures.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('BRANDING')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  activeTab === 'BRANDING'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                🎨 Personalización
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('SUMMARY')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  activeTab === 'SUMMARY'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                👁️ Vista Previa Tarjeta
              </button>
            </div>

            {/* Modal Body Scroll Container */}
            <form onSubmit={handleSavePlan} className="p-6 overflow-y-auto space-y-6 flex-1 max-h-[60vh]">
              {/* TAB 1: INFORMACIÓN GENERAL */}
              {activeTab === 'GENERAL' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Nombre Comercial del Plan *
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="Ej. PREMIUM, ENTERPRISE, STARTER"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Código Único Interno *
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="Ej. PLAN_PREMIUM_2026"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Descripción del Plan
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ej. Solución completa para empresas comerciales con múltiples sucursales, facturación fiscal y POS."
                      value={details.description}
                      onChange={(e) => setDetails({ ...details, description: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <label className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => setActive(e.target.checked)}
                        className="h-4 w-4 text-indigo-600 rounded"
                      />
                      <div>
                        <span className="font-bold text-xs text-slate-900 dark:text-white block">Plan Activo</span>
                        <span className="text-[11px] text-slate-400">Habilitado para nuevas contrataciones</span>
                      </div>
                    </label>

                    <label className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={details.isRecommended}
                        onChange={(e) => setDetails({ ...details, isRecommended: e.target.checked })}
                        className="h-4 w-4 text-indigo-600 rounded"
                      />
                      <div>
                        <span className="font-bold text-xs text-slate-900 dark:text-white block">Plan Recomendado</span>
                        <span className="text-[11px] text-slate-400">Resaltado como Más Vendido</span>
                      </div>
                    </label>

                    <label className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={details.isPublic}
                        onChange={(e) => setDetails({ ...details, isPublic: e.target.checked })}
                        className="h-4 w-4 text-indigo-600 rounded"
                      />
                      <div>
                        <span className="font-bold text-xs text-slate-900 dark:text-white block">Visible al Público</span>
                        <span className="text-[11px] text-slate-400">Mostrar en landing page</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: FACTURACIÓN & PRECIOS */}
              {activeTab === 'BILLING' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Precio Mensual ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={monthlyPrice}
                        onChange={(e) => setMonthlyPrice(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-black font-mono text-emerald-600"
                      />
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Precio Anual ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={yearlyPrice}
                        onChange={(e) => setYearlyPrice(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-black font-mono text-indigo-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Prueba Gratis (Días)
                      </label>
                      <input
                        type="number"
                        value={details.trialDays}
                        onChange={(e) => setDetails({ ...details, trialDays: Number(e.target.value) || 0 })}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Descuento Pago Anual (%)
                      </label>
                      <input
                        type="number"
                        value={details.annualDiscount}
                        onChange={(e) => setDetails({ ...details, annualDiscount: Number(e.target.value) || 0 })}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Moneda de Facturación
                      </label>
                      <select
                        value={details.currency}
                        onChange={(e) => setDetails({ ...details, currency: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold"
                      >
                        <option value="ARS">ARS ($)</option>
                        <option value="USD">USD (US$)</option>
                        <option value="EUR">EUR (€)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: LÍMITES DINÁMICOS */}
              {activeTab === 'LIMITS' && (
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Active la casilla de verificación para aplicar un tope numérico. Si la casilla permanece desmarcada, el límite será <strong>ILIMITADO</strong> (Guardado como NULL).
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { key: 'maxUsers', label: 'Usuarios del Sistema', defaultVal: 10 },
                      { key: 'maxProducts', label: 'Productos en Catálogo', defaultVal: 500 },
                      { key: 'maxCustomers', label: 'Clientes Registrados', defaultVal: 1000 },
                      { key: 'maxSuppliers', label: 'Proveedores Registrados', defaultVal: 100 },
                      { key: 'maxWarehouses', label: 'Depósitos / Almacenes', defaultVal: 3 },
                      { key: 'maxCashRegisters', label: 'Cajas de Cobro', defaultVal: 3 },
                      { key: 'maxBranches', label: 'Sucursales de la Empresa', defaultVal: 2 },
                      { key: 'maxPriceLists', label: 'Listas de Precios', defaultVal: 5 },
                      { key: 'maxRoles', label: 'Roles Personalizados', defaultVal: 10 },
                      { key: 'maxPosTerminals', label: 'Terminales POS', defaultVal: 5 },
                      { key: 'maxSellers', label: 'Vendedores Asignados', defaultVal: 20 },
                      { key: 'maxMonthlyPurchases', label: 'Compras Mensuales', defaultVal: 9999 },
                      { key: 'maxMonthlySales', label: 'Ventas Mensuales', defaultVal: 99999 },
                      { key: 'maxStorageGb', label: 'Almacenamiento (GB)', defaultVal: 10 },
                    ].map((item) => {
                      const limitKey = item.key as keyof PlanLimitsState;
                      const isLimited = details.limits[limitKey] !== null;

                      return (
                        <div
                          key={item.key}
                          className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                            isLimited
                              ? 'bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-800 shadow-2xs'
                              : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={isLimited}
                              onChange={() => handleLimitToggle(limitKey, item.defaultVal)}
                              className="h-4 w-4 text-indigo-600 rounded border-slate-300"
                            />
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                              {item.label}
                            </span>
                          </label>

                          <div className="w-28 flex-shrink-0">
                            {isLimited ? (
                              <input
                                type="number"
                                min="0"
                                value={details.limits[limitKey] ?? ''}
                                onChange={(e) => handleLimitValueChange(limitKey, e.target.value)}
                                className="w-full p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-black text-center focus:ring-2 focus:ring-indigo-500"
                              />
                            ) : (
                              <span className="block text-center text-xs font-black text-emerald-600 dark:text-emerald-400 py-1.5 px-2 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg">
                                ILIMITADO
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 4: MÓDULOS ERP */}
              {activeTab === 'MODULES' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Matriz de Módulos ERP Habilitados
                      </h3>
                      <p className="text-xs text-slate-400">
                        Si un módulo está desactivado, desaparece completamente de la barra de navegación del ERP.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setDetails({
                          ...details,
                          modules: ERP_MODULES_LIST.map((m) => m.id),
                        })
                      }
                      className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-lg"
                    >
                      Habilitar Todos los Módulos
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {ERP_MODULES_LIST.map((mod) => {
                      const isEnabled = details.modules.includes(mod.id);
                      return (
                        <label
                          key={mod.id}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                            isEnabled
                              ? 'bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-800 shadow-2xs'
                              : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleModuleToggle(mod.id)}
                            className="mt-0.5 h-4 w-4 text-indigo-600 rounded"
                          />
                          <div>
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                              {mod.label}
                            </span>
                            <span className="text-[11px] text-slate-400 leading-tight block">
                              {mod.desc}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: FUNCIONES PREMIUM */}
              {activeTab === 'PREMIUM' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-500" /> Funciones Premium e Integraciones Avanzadas
                    </h3>
                    <p className="text-xs text-slate-400">
                      Seleccione las capacidades Enterprise incluidas en este plan comercial.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {PREMIUM_FEATURES_LIST.map((feat) => {
                      const isEnabled = details.premiumFeatures.includes(feat.id);
                      return (
                        <label
                          key={feat.id}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                            isEnabled
                              ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800 font-bold text-indigo-900 dark:text-indigo-300'
                              : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handlePremiumToggle(feat.id)}
                            className="h-4 w-4 text-indigo-600 rounded"
                          />
                          <span className="text-xs font-extrabold">{feat.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 6: PERSONALIZACIÓN & BRANDING */}
              {activeTab === 'BRANDING' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Etiqueta / Badge Promocional
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. MÁS VENDIDO, NUEVO, EMPRESARIAL"
                        value={details.badge}
                        onChange={(e) => setDetails({ ...details, badge: e.target.value.toUpperCase() })}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Color Principal del Plan
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={details.color}
                          onChange={(e) => setDetails({ ...details, color: e.target.value })}
                          className="h-10 w-14 rounded-xl cursor-pointer bg-transparent border-0"
                        />
                        <input
                          type="text"
                          value={details.color}
                          onChange={(e) => setDetails({ ...details, color: e.target.value })}
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Paleta de Colores Predefinidos
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {['#4f46e5', '#059669', '#d97706', '#dc2626', '#9333ea', '#2563eb', '#0891b2', '#0f172a'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setDetails({ ...details, color: c })}
                          className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 shadow-md transition-transform hover:scale-110"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: RESUMEN Y VISTA PREVIA TARJETA SAAS */}
              {activeTab === 'SUMMARY' && (
                <div className="space-y-4">
                  <div className="text-center space-y-1">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Vista Previa de Tarjeta Comercial SaaS
                    </h3>
                    <p className="text-xs text-slate-400">
                      Así visualizarán sus clientes este plan en la plataforma de suscripción.
                    </p>
                  </div>

                  <div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                    <div className="h-3 w-full" style={{ backgroundColor: details.color }} />
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[10px] font-black px-3 py-1 rounded-full text-white uppercase tracking-wider"
                          style={{ backgroundColor: details.color }}
                        >
                          {details.badge || 'PLAN SAAS'}
                        </span>
                        <span className="text-xs font-extrabold text-emerald-600">
                          {details.trialDays} días gratis
                        </span>
                      </div>

                      <div>
                        <h4 className="text-2xl font-black text-slate-900 dark:text-white">{name || 'Nombre del Plan'}</h4>
                        <p className="text-xs text-slate-500 mt-1">{details.description}</p>
                      </div>

                      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="text-3xl font-black text-slate-900 dark:text-white">
                          ${monthlyPrice ? Number(monthlyPrice).toLocaleString() : '0'}
                          <span className="text-xs text-slate-400 font-bold"> / mes</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <div>✔ Users: <strong>{details.limits.maxUsers === null ? 'Ilimitado' : details.limits.maxUsers}</strong></div>
                        <div>✔ Productos: <strong>{details.limits.maxProducts === null ? 'Ilimitado' : details.limits.maxProducts}</strong></div>
                        <div>✔ Depósitos: <strong>{details.limits.maxWarehouses === null ? 'Ilimitado' : details.limits.maxWarehouses}</strong></div>
                        <div>✔ Cajas: <strong>{details.limits.maxCashRegisters === null ? 'Ilimitado' : details.limits.maxCashRegisters}</strong></div>
                        <div>✔ Módulos incluidos: <strong>{details.modules.length} módulos habilitados</strong></div>
                      </div>

                      <button
                        type="button"
                        className="w-full py-3 text-white font-extrabold text-xs rounded-xl shadow-md"
                        style={{ backgroundColor: details.color }}
                      >
                        Contratar Plan Ahora
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Modal Bottom Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-100"
                >
                  Cancelar
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => handleSavePlan(e, true)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold text-xs rounded-xl hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800"
                >
                  Guardar y Crear Otro
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSavePlan(e, false)}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isSubmitting ? 'Guardando...' : 'Guardar Plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
