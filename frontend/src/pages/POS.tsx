import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ShoppingCart,
  Trash2,
  Check,
  CreditCard,
  Banknote,
  Percent,
  Plus,
  X,
  User,
  Store,
  Lock,
  History,
  Star,
  Receipt,
  TrendingUp,
  Tag,
  ChevronDown,
  Building,
  UserCheck,
  Wallet,
  Sparkles,
  ArrowRight,
  UserPlus,
  RefreshCw,
  QrCode,
  AlertCircle,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { productApi } from '../services/product.service';
import { saleApi } from '../services/sale.service';
import { warehouseApi } from '../services/warehouse.service';
import { posApi } from '../services/pos.service';
import { cashApi } from '../services/cash.service';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
  paymentAdjustmentRuleService,
  calculatePaymentAdjustment,
} from '../services/paymentAdjustmentRule.service';
import { getCustomers, Customer } from '../services/customer.service';
import { CustomerFormModal } from './customers/CustomerFormModal';

const CATEGORIES = ['Todos', 'Favoritos', 'Más Vendidos', 'Recientes'];
const POS_DRAFT_KEY = 'presuerp_pos_draft_v1';
const POS_PREFERENCES_KEY = 'presuerp_pos_prefs_v1';

export const POS: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENTAGE'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<number | string>('');
  const [restoredBanner, setRestoredBanner] = useState<string | null>(null);

  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    'CASH' | 'CARD' | 'TRANSFER' | 'MERCADO_PAGO' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'CREDIT_ACCOUNT'
  >('CASH');

  // Customer Selection State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);

  // 1. Cargar preferencias y borrador guardado en localStorage al iniciar
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(POS_DRAFT_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.cart && Array.isArray(parsed.cart) && parsed.cart.length > 0) {
          setCart(parsed.cart);
          if (parsed.discountType) setDiscountType(parsed.discountType);
          if (parsed.discountValue !== undefined) setDiscountValue(parsed.discountValue);
          if (parsed.paymentMethod) setPaymentMethod(parsed.paymentMethod);
          if (parsed.selectedWarehouseId) setSelectedWarehouseId(parsed.selectedWarehouseId);
          if (parsed.selectedCustomer) setSelectedCustomer(parsed.selectedCustomer);
          setRestoredBanner('Se restauró automáticamente una venta que estaba en curso.');
        }
      }

      const savedPrefs = localStorage.getItem(POS_PREFERENCES_KEY);
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        if (prefs.activeCategory) setActiveCategory(prefs.activeCategory);
        if (prefs.selectedWarehouseId) setSelectedWarehouseId(prefs.selectedWarehouseId);
      }
    } catch (err) {
      console.error('Error al cargar borrador/preferencias del POS:', err);
    }
  }, []);

  // 2. Persistir automáticamente la venta en curso ante cualquier cambio
  useEffect(() => {
    try {
      if (cart.length > 0) {
        const draft = {
          cart,
          discountType,
          discountValue,
          paymentMethod,
          selectedWarehouseId,
          selectedCustomer,
          timestamp: Date.now(),
        };
        localStorage.setItem(POS_DRAFT_KEY, JSON.stringify(draft));
      } else {
        localStorage.removeItem(POS_DRAFT_KEY);
      }
    } catch (err) {
      console.error('Error al guardar borrador del POS:', err);
    }
  }, [cart, discountType, discountValue, paymentMethod, selectedWarehouseId, selectedCustomer]);

  // 3. Persistir preferencias del usuario
  useEffect(() => {
    try {
      const prefs = {
        activeCategory,
        selectedWarehouseId,
        paymentMethod,
      };
      localStorage.setItem(POS_PREFERENCES_KEY, JSON.stringify(prefs));
    } catch (err) {
      console.error('Error al guardar preferencias del POS:', err);
    }
  }, [activeCategory, selectedWarehouseId, paymentMethod]);

  const { data: customersRes } = useQuery({
    queryKey: ['posCustomersList'],
    queryFn: () => getCustomers({ active: true, limit: 100 }),
  });
  const customersList: Customer[] = customersRes?.data || [];

  const filteredPOSCustomers = useMemo(() => {
    const term = customerSearchTerm.toLowerCase().trim();
    if (!term) return customersList;
    return customersList.filter(
      (c: Customer) =>
        c.name.toLowerCase().includes(term) ||
        c.document?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
    );
  }, [customersList, customerSearchTerm]);

  // Fetch payment adjustment rules
  const { data: adjustmentRules = [] } = useQuery({
    queryKey: ['paymentAdjustmentRules'],
    queryFn: () => paymentAdjustmentRuleService.getAll(),
  });

  const [showActiveDiscounts, setShowActiveDiscounts] = useState(false);

  const activeAdjustmentRules = useMemo(() => {
    const rawList = Array.isArray(adjustmentRules)
      ? adjustmentRules
      : (adjustmentRules as any)?.data && Array.isArray((adjustmentRules as any).data)
      ? (adjustmentRules as any).data
      : [];

    return rawList.filter((r: any) => r.active === true || r.active === 'true');
  }, [adjustmentRules]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showActiveDiscounts && !target.closest('.discounts-popover-container')) {
        setShowActiveDiscounts(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActiveDiscounts]);

  const formatPaymentMethodName = (method: string) => {
    switch (method) {
      case 'MERCADOPAGO':
      case 'MERCADO_PAGO':
        return 'Mercado Pago';
      case 'CASH':
        return 'Efectivo';
      case 'TRANSFER':
        return 'Transferencia';
      case 'DEBIT_CARD':
        return 'Tarjeta Débito';
      case 'CREDIT_CARD':
      case 'CARD':
        return 'Tarjeta Crédito';
      default:
        return method;
    }
  };

  // Mercado Pago States
  const [mpSaleId, setMpSaleId] = useState<string | null>(null);
  const [mpAmount, setMpAmount] = useState<number>(0);
  const [mpCheckoutUrl, setMpCheckoutUrl] = useState<string>('');
  const [mpQrCodeBase64, setMpQrCodeBase64] = useState<string>('');
  const [mpStatusState, setMpStatusState] = useState<'PENDING' | 'APPROVED' | 'FAILED'>('PENDING');
  const [isMPModalOpen, setIsMPModalOpen] = useState(false);

  // Data Fetching
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['productsListAll'],
    queryFn: () => productApi.list(),
  });
  const products = productsData || [];

  const { data: activeSession } = useQuery({
    queryKey: ['cash', 'active'],
    queryFn: cashApi.getActiveSession,
  });

  // Estado y Apertura de Caja en POS
  const [isOpenCashModalOpen, setIsOpenCashModalOpen] = useState(false);
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState<string>('');
  const [openingBalanceInput, setOpeningBalanceInput] = useState<string>('0');
  const [openingNotesInput, setOpeningNotesInput] = useState<string>('');

  const { data: cashRegisters = [] } = useQuery({
    queryKey: ['cash', 'registers'],
    queryFn: cashApi.getRegisters,
  });

  useEffect(() => {
    if (cashRegisters.length > 0 && !selectedCashRegisterId) {
      setSelectedCashRegisterId(cashRegisters[0].id);
    }
  }, [cashRegisters, selectedCashRegisterId]);

  const openCashSessionMutation = useMutation({
    mutationFn: cashApi.openSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      queryClient.invalidateQueries({ queryKey: ['posDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsOpenCashModalOpen(false);
      setOpeningBalanceInput('0');
      setOpeningNotesInput('');
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Error al abrir caja'),
  });

  const { data: integrationsRes } = useQuery({
    queryKey: ['businessIntegrations'],
    queryFn: () => api.get('/business/integrations').then((res) => res.data.data),
  });

  const isMPActive = useMemo(() => {
    if (!integrationsRes) return false;
    const mp = integrationsRes.find((item: any) => item.provider === 'MERCADO_PAGO');
    return mp && mp.status === 'ACTIVE';
  }, [integrationsRes]);

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehousesListAll'],
    queryFn: warehouseApi.list,
  });

  const { data: dashboardRes } = useQuery({
    queryKey: ['posDashboard'],
    queryFn: posApi.getDashboard,
  });

  const dashboard = dashboardRes?.data || {
    salesToday: 0,
    revenueToday: 0,
    averageTicket: 0,
    pendingSales: 0,
  };

  useEffect(() => {
    if (warehouses.length > 0 && !selectedWarehouseId) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouseId]);

  const getProductStock = (p: any, warehouseId: string) => {
    if (p.stocks && Array.isArray(p.stocks) && warehouseId) {
      const st = p.stocks.find((s: any) => s.warehouseId === warehouseId);
      if (st !== undefined) return Number(st.quantity);
    }
    return Number(p.totalStock || 0);
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return products.filter((p: any) => p.status === 'ACTIVE');
    return products.filter(
      (p: any) =>
        p.status === 'ACTIVE' &&
        (p.name.toLowerCase().includes(term) ||
          p.barcode?.toLowerCase().includes(term) ||
          p.sku?.toLowerCase().includes(term))
    );
  }, [products, searchTerm]);

  // Cart operations
  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) =>
    setCart((prev) => prev.filter((item) => item.product.id !== productId));

  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) return removeFromCart(productId);
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: qty } : item))
    );
  };

  const clearCart = () => {
    setCart([]);
    setDiscountValue('');
    localStorage.removeItem(POS_DRAFT_KEY);
  };

  // Totals
  const subtotal = cart.reduce(
    (acc, item) => acc + Number(item.product.salePrice) * item.quantity,
    0
  );

  const numDiscountValue = Number(discountValue) || 0;

  const calculatedDiscountAmount = useMemo(() => {
    if (!subtotal || numDiscountValue <= 0) return 0;
    if (discountType === 'PERCENTAGE') {
      return Math.round(((subtotal * numDiscountValue) / 100) * 100) / 100;
    }
    return Math.min(subtotal, numDiscountValue);
  }, [subtotal, discountType, numDiscountValue]);

  const discountAmount = Math.min(subtotal, Math.max(0, calculatedDiscountAmount));
  const cartTotal = Math.max(0, subtotal - discountAmount);

  const paymentAdjustmentDetails = useMemo(() => {
    return calculatePaymentAdjustment(cartTotal, paymentMethod, adjustmentRules as any);
  }, [paymentMethod, adjustmentRules, cartTotal]);

  // Polling effect for Mercado Pago status detection
  useEffect(() => {
    let intervalId: any;

    if (isMPModalOpen && mpSaleId && mpStatusState === 'PENDING') {
      intervalId = setInterval(async () => {
        try {
          const res = await api.get(
            `/business/integrations/mercado-pago/payment-status/${mpSaleId}`
          );
          const status = res.data?.status;
          if (status === 'PAID') {
            setMpStatusState('APPROVED');
            clearInterval(intervalId);
            clearCart();
            setSelectedCustomer(null);
            localStorage.removeItem(POS_DRAFT_KEY);
            queryClient.invalidateQueries({ queryKey: ['posDashboard'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['cash'] });
          } else if (status === 'FAILED') {
            setMpStatusState('FAILED');
            clearInterval(intervalId);
          }
        } catch (err) {
          console.error('Error polling payment status:', err);
        }
      }, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isMPModalOpen, mpSaleId, mpStatusState, queryClient]);

  // Mutations
  const createSaleMutation = useMutation({
    mutationFn: saleApi.create,
    onSuccess: async (data: any) => {
      if (paymentMethod === 'MERCADO_PAGO') {
        try {
          const saleId = data.id;
          const finalAmount = Number(data.totalAmount || mpAmount);
          setMpSaleId(saleId);
          setMpAmount(finalAmount);
          setMpStatusState('PENDING');
          setMpQrCodeBase64('');
          setIsCheckoutOpen(false);
          setIsMPModalOpen(true);

          const qrRes = await api.post('/business/integrations/mercado-pago/create-qr', {
            saleId,
            amount: finalAmount,
          });

          if (qrRes.data && qrRes.data.data && qrRes.data.data.qrCodeBase64) {
            setMpQrCodeBase64(qrRes.data.data.qrCodeBase64);
            if (qrRes.data.data.qrCode) {
              setMpCheckoutUrl(qrRes.data.data.qrCode);
            }
          } else {
            setMpStatusState('FAILED');
          }
        } catch (err: any) {
          alert(err.response?.data?.message || 'Error al generar QR de Mercado Pago');
          setMpStatusState('FAILED');
        }
        return;
      }

      alert(`¡Venta registrada exitosamente! Comprobante: ${data.documentNumber}`);
      clearCart();
      setSelectedCustomer(null);
      setIsCheckoutOpen(false);
      localStorage.removeItem(POS_DRAFT_KEY);
      queryClient.invalidateQueries({ queryKey: ['posDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['cash'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error al procesar la venta');
    },
  });

  const confirmSale = () => {
    if (cart.length === 0 || !selectedWarehouseId) return;

    if (!activeSession) {
      alert('Debes tener una sesión de caja abierta para registrar una venta.');
      return;
    }

    const finalTotalAmount = paymentAdjustmentDetails.finalTotal;

    if (paymentMethod === 'CREDIT_ACCOUNT') {
      if (!selectedCustomer) {
        alert('Debes seleccionar un cliente para realizar una venta a Cuenta Corriente.');
        return;
      }
      if (!selectedCustomer.allowCreditAccount) {
        alert(`El cliente "${selectedCustomer.name}" no tiene habilitada la Cuenta Corriente.`);
        return;
      }
      const currentDebt = Number(selectedCustomer.currentDebt || 0);
      const creditLimit = Number(selectedCustomer.creditLimit || 0);
      if (currentDebt + finalTotalAmount > creditLimit) {
        const available = Math.max(0, creditLimit - currentDebt);
        alert(
          `El total de la venta ($${finalTotalAmount.toLocaleString(
            'es-AR'
          )}) supera el crédito disponible ($${available.toLocaleString('es-AR')}).`
        );
        return;
      }
    }

    const items = cart.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      unitPrice: Number(item.product.salePrice),
      totalAmount: Number(item.product.salePrice) * item.quantity,
    }));

    const finalSaleDiscountAmount =
      paymentAdjustmentDetails.type === 'DISCOUNT'
        ? discountAmount + Math.abs(paymentAdjustmentDetails.adjustmentAmount)
        : discountAmount;

    const surchargeAmount =
      paymentAdjustmentDetails.type === 'SURCHARGE'
        ? Math.abs(paymentAdjustmentDetails.adjustmentAmount)
        : 0;

    const targetCashSessionId = activeSession?.id || undefined;
    const initialStatus = paymentMethod === 'MERCADO_PAGO' ? 'PENDING' : 'COMPLETED';

    console.log('[CASH POS SESSION]', {
      cashSessionId: targetCashSessionId,
      totalAmount: finalTotalAmount,
      paymentMethod
    });

    createSaleMutation.mutate({
      warehouseId: selectedWarehouseId,
      customerId: selectedCustomer ? selectedCustomer.id : undefined,
      paymentMethod,
      cashSessionId: targetCashSessionId,
      status: initialStatus,
      subtotal,
      discountType: 'FIXED',
      discountValue: finalSaleDiscountAmount,
      discountAmount: finalSaleDiscountAmount,
      surchargeType: surchargeAmount > 0 ? 'FIXED' : 'NONE',
      surchargeValue: surchargeAmount,
      surchargeAmount,
      totalAmount: finalTotalAmount,
      items,
      payments: [{
        amount: finalTotalAmount,
        details: paymentMethod,
      }],
    });
  };

  const formatCurrency = (val: number | string) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(val));

  const totalCartQty = cart.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <div className="space-y-3">
      
      {/* BANNER DISCRETO DE AUTO-RESTAURACION DE VENTA EN CURSO */}
      {restoredBanner && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm animate-fadeIn">
          <span className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-indigo-500" />
            {restoredBanner}
          </span>
          <button
            type="button"
            onClick={() => setRestoredBanner(null)}
            className="text-indigo-500 hover:text-indigo-800 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. HEADER COMPACTO POS (-25% ALTURA DE ESCRITORIO) */}
      <div className="bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                POS Mostrador
              </h1>
              {activeSession ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  ABIERTA
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  CERRADA
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Chips de Selección Rápida */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector / Indicador de Caja Activa */}
          {activeSession ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-xs font-bold text-emerald-700 dark:text-emerald-300 shadow-sm">
              <Wallet className="w-3.5 h-3.5 text-emerald-500" />
              <span className="truncate max-w-[130px]">
                {activeSession.cashRegister?.name || 'Caja Principal'}
              </span>
              <span className="text-[10px] opacity-75 font-mono">({activeSession.cashRegister?.code || '00001'})</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpenCashModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-xs font-bold text-amber-800 dark:text-amber-300 transition-all shadow-sm"
            >
              <Wallet className="w-3.5 h-3.5 text-amber-500" />
              <span>Sin Caja — [Abrir]</span>
            </button>
          )}

          {/* Selector de Cliente */}
          <button
            type="button"
            onClick={() => setIsCustomerModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all shadow-sm"
          >
            <User className="w-3.5 h-3.5 text-primary-500" />
            <span className="truncate max-w-[120px]">
              {selectedCustomer ? selectedCustomer.name : 'Consumidor Final'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* Selector de Depósito */}
          <div className="w-36">
            <Select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="py-1 text-xs font-bold"
            >
              {warehouses.map((w: any) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Botón Reglas Regalo Popover */}
          <div className="relative discounts-popover-container">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowActiveDiscounts(!showActiveDiscounts)}
              className="flex items-center gap-1.5 font-bold py-1 text-xs"
            >
              <Tag className="w-3.5 h-3.5 text-indigo-500" />
              <span>Reglas</span>
            </Button>

            {showActiveDiscounts && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 p-3 space-y-2 text-xs">
                <span className="font-extrabold text-slate-800 dark:text-white uppercase tracking-wider block border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  Reglas de Descuento
                </span>
                {activeAdjustmentRules.length === 0 ? (
                  <p className="text-slate-400 italic">No hay reglas activas.</p>
                ) : (
                  activeAdjustmentRules.map((rule: any) => (
                    <div
                      key={rule.id}
                      className="flex justify-between items-center p-1.5 rounded bg-slate-50 dark:bg-slate-800"
                    >
                      <span className="font-semibold text-slate-700 dark:text-slate-200 text-[11px]">
                        {formatPaymentMethodName(rule.paymentMethod)}:
                      </span>
                      <span
                        className={`font-mono font-bold text-[11px] ${
                          rule.adjustmentType === 'DISCOUNT' ? 'text-emerald-500' : 'text-amber-500'
                        }`}
                      >
                        {rule.adjustmentType === 'DISCOUNT' ? '-' : '+'}
                        {rule.value}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Volver a Ventas */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/sales')}
            className="font-bold text-xs py-1"
          >
            ← Ventas
          </Button>
        </div>
      </div>

      {/* 2. HERO KPIS COMPACTOS DE ESCRITORIO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-emerald-500">
          <CardContent className="p-2.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Ventas Hoy
            </span>
            <div className="text-base lg:text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {dashboard.salesToday} ops.
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-indigo-500">
          <CardContent className="p-2.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Facturación Turno
            </span>
            <div className="text-base lg:text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
              {formatCurrency(dashboard.revenueToday)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-blue-500">
          <CardContent className="p-2.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Ticket Promedio
            </span>
            <div className="text-base lg:text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {formatCurrency(dashboard.averageTicket)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-amber-500">
          <CardContent className="p-2.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Items en Orden
            </span>
            <div className="text-base lg:text-lg font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
              {totalCartQty} u.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. LAYOUT PRINCIPAL POS COMPACTO Y ALTA DENSIDAD VISUAL */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        
        {/* COLUMNA IZQUIERDA: CATÁLOGO DE PRODUCTOS ALTA DENSIDAD (COL-SPAN 2) */}
        <div className="xl:col-span-2 space-y-3">
          
          {/* BUSCADOR COMPACTO & CHIPS DE CATEGORÍA */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-3 space-y-2.5">
            <div className="relative w-full">
              <Input
                placeholder="Buscar por nombre, SKU o código de barras (Ctrl+K)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={Search}
                className="text-xs py-1.5 rounded-xl border-slate-300 dark:border-slate-700 shadow-sm"
              />
            </div>

            {/* Chips de Categorías Compactos */}
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                    activeCategory === cat
                      ? 'bg-primary-600 text-white shadow-sm scale-[1.01]'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </Card>

          {/* GRILLA DE TARJETAS DE PRODUCTO DENSAS (MAS VISIBLES SIN SCROLL) */}
          {loadingProducts ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
              {Array.from({ length: 12 }).map((_, idx) => (
                <Skeleton key={idx} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              title="No se encontraron productos"
              description="Prueba cambiando los términos de búsqueda o selecciona otra categoría."
              icon={Search}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
              {filteredProducts.map((product: any) => {
                const stockNum = getProductStock(product, selectedWarehouseId);
                const isOutOfStock = stockNum <= 0;

                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStock && addToCart(product)}
                    className={`group rounded-xl p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-150 flex flex-col justify-between cursor-pointer ${
                      isOutOfStock
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:shadow hover:-translate-y-0.5 active:scale-[0.98] hover:border-primary-500/50'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-mono text-[9px] text-slate-400 font-bold">
                          {product.sku || 'SKU N/D'}
                        </span>
                        {isOutOfStock ? (
                          <span className="text-[9px] font-bold text-rose-500">SIN STOCK</span>
                        ) : stockNum <= 5 ? (
                          <span className="text-[9px] font-bold text-amber-500">STK {stockNum}</span>
                        ) : (
                          <span className="text-[9px] font-bold text-emerald-500">STK {stockNum}</span>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-900 dark:text-white text-xs line-clamp-2 leading-snug group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {product.name}
                      </h4>
                    </div>

                    <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                      <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
                        {formatCurrency(product.salePrice)}
                      </span>
                      <div className="p-1 rounded-md bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: PANEL LATERAL DE CARRITO COMPACTO (COL-SPAN 1) */}
        <div className="space-y-3">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md rounded-2xl overflow-hidden flex flex-col min-h-[500px]">
            
            {/* Header del Carrito */}
            <CardHeader className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-primary-500" /> Carrito de Venta
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="info" size="sm">{totalCartQty} u.</Badge>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                    title="Vaciar carrito"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </CardHeader>

            {/* Cuerpo del Carrito: Items Compactos */}
            <CardContent className="p-3 flex-1 max-h-[300px] xl:max-h-[400px] overflow-y-auto space-y-2">
              {cart.length === 0 ? (
                <EmptyState
                  title="Carrito Vacío"
                  description="Haz clic en un producto para agregarlo."
                  icon={ShoppingCart}
                />
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 text-xs"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-900 dark:text-white line-clamp-1">
                        {item.product.name}
                      </span>
                      <span className="font-mono font-black text-slate-900 dark:text-white ml-2 shrink-0">
                        {formatCurrency(Number(item.product.salePrice) * item.quantity)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <div className="inline-flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shadow-sm">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-5 h-5 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        >
                          -
                        </button>
                        <span className="w-7 text-center font-mono font-bold text-xs select-none">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-5 h-5 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        >
                          +
                        </button>
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatCurrency(item.product.salePrice)} c/u
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>

            {/* Pie del Carrito: Descuento & Botón Cobrar Hero */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 space-y-2.5">
              
              {/* Componente Estandarizado de Descuento */}
              <div className="flex items-center justify-between text-xs pt-0.5 pb-1.5 border-b border-slate-200 dark:border-slate-800">
                <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-primary-500" /> Descuento
                </span>
                
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setDiscountType('PERCENTAGE')}
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                        discountType === 'PERCENTAGE'
                          ? 'bg-primary-600 text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('FIXED')}
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                        discountType === 'FIXED'
                          ? 'bg-primary-600 text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      $
                    </button>
                  </div>

                  <input
                    type="number"
                    min="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder="0"
                    disabled={cart.length === 0}
                    className="w-14 text-right px-1.5 py-0.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Subtotal y Total */}
              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Descuento:</span>
                    <span className="font-mono">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span>TOTAL COBRAR:</span>
                  <span className="font-mono text-primary-600 dark:text-primary-400">
                    {formatCurrency(cartTotal)}
                  </span>
                </div>
              </div>

              {/* HERO BOTÓN COBRAR COMPACTO */}
              <Button
                variant={activeSession ? 'success' : 'outline'}
                size="md"
                className="w-full font-black text-sm py-2.5 shadow-md tracking-wide uppercase"
                disabled={cart.length === 0}
                onClick={() => {
                  if (!activeSession) {
                    setIsOpenCashModalOpen(true);
                  } else {
                    setIsCheckoutOpen(true);
                  }
                }}
              >
                {!activeSession ? (
                  <span className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
                    <Lock className="w-4 h-4" /> ABRIR CAJA PARA COBRAR
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <CreditCard className="w-4 h-4" /> COBRAR {formatCurrency(cartTotal)}
                  </span>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* 4. MODAL DE PAGO / CHECKOUT */}
      <Modal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        title="Cobro de Venta POS"
        size="md"
      >
        <div className="space-y-4 pt-1">
          <div className="space-y-2">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Selecciona el Medio de Pago
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'CASH', label: 'Efectivo', icon: Banknote },
                { id: 'MERCADO_PAGO', label: 'Mercado Pago (QR)', icon: QrCode },
                { id: 'TRANSFER', label: 'Transferencia', icon: Wallet },
                { id: 'DEBIT_CARD', label: 'Débito', icon: CreditCard },
                { id: 'CREDIT_CARD', label: 'Crédito', icon: CreditCard },
                { id: 'CREDIT_ACCOUNT', label: 'Cuenta Corriente', icon: UserCheck },
              ].map((m) => {
                const IconComp = m.icon;
                const isSelected = paymentMethod === m.id;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all text-xs font-bold ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 ring-2 ring-primary-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <IconComp className="w-4 h-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Monto Base Carrito:</span>
              <span className="font-mono font-bold">{formatCurrency(cartTotal)}</span>
            </div>

            {paymentAdjustmentDetails.type !== 'NONE' && (
              <div
                className={`flex justify-between font-bold ${
                  paymentAdjustmentDetails.type === 'DISCOUNT' ? 'text-emerald-500' : 'text-amber-500'
                }`}
              >
                <span>
                  {paymentAdjustmentDetails.type === 'DISCOUNT' ? 'Descuento Regla:' : 'Recargo Regla:'}
                </span>
                <span className="font-mono">
                  {paymentAdjustmentDetails.type === 'DISCOUNT' ? '-' : '+'}
                  {formatCurrency(Math.abs(paymentAdjustmentDetails.adjustmentAmount))}
                </span>
              </div>
            )}

            <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 flex justify-between font-black text-slate-900 dark:text-white text-sm">
              <span>TOTAL FINAL A COBRAR:</span>
              <span className="font-mono text-primary-600 dark:text-primary-400">
                {formatCurrency(paymentAdjustmentDetails.finalTotal)}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsCheckoutOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="success"
              className="font-bold shadow-md"
              onClick={confirmSale}
              isLoading={createSaleMutation.isPending}
            >
              Confirmar y Cobrar
            </Button>
          </div>
        </div>
      </Modal>

      {/* 5. MODAL DE SELECCIÓN / CREACIÓN DE CLIENTE */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="Seleccionar Cliente para Venta POS"
        size="md"
      >
        <div className="space-y-3 pt-1">
          <div className="flex gap-2">
            <Input
              placeholder="Buscar cliente por nombre, DNI o CUIT..."
              value={customerSearchTerm}
              onChange={(e) => setCustomerSearchTerm(e.target.value)}
              leftIcon={Search}
            />
            <Button
              variant="primary"
              onClick={() => {
                setIsCustomerModalOpen(false);
                setIsNewCustomerModalOpen(true);
              }}
              className="shrink-0"
            >
              <UserPlus className="w-4 h-4 mr-1" /> Nuevo
            </Button>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div
              onClick={() => {
                setSelectedCustomer(null);
                setIsCustomerModalOpen(false);
              }}
              className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between transition-colors"
            >
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-100 block text-xs">
                  CONSUMIDOR FINAL
                </span>
                <span className="text-[10px] text-slate-400">Venta genérica sin datos de cliente</span>
              </div>
              {!selectedCustomer && <Check className="w-4 h-4 text-emerald-500" />}
            </div>

            {filteredPOSCustomers.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  setSelectedCustomer(c);
                  setIsCustomerModalOpen(false);
                }}
                className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between transition-colors"
              >
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-100 block text-xs">
                    {c.name}
                  </span>
                  <span className="text-[10px] text-slate-400">CUIT/DNI: {c.document || '-'}</span>
                </div>
                {selectedCustomer?.id === c.id && <Check className="w-4 h-4 text-emerald-500" />}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Modal de Nuevo Cliente */}
      {isNewCustomerModalOpen && (
        <CustomerFormModal
          isOpen={isNewCustomerModalOpen}
          onClose={() => setIsNewCustomerModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['posCustomersList'] });
            setIsNewCustomerModalOpen(false);
          }}
        />
      )}

      {/* 6. MODAL DE MERCADO PAGO QR */}
      <Modal
        isOpen={isMPModalOpen}
        onClose={() => setIsMPModalOpen(false)}
        title="Cobro con Mercado Pago QR"
        size="sm"
      >
        <div className="space-y-3 pt-1 text-center">
          {mpStatusState === 'PENDING' && (
            <div className="space-y-3">
              {mpQrCodeBase64 ? (
                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm inline-block">
                  <img src={mpQrCodeBase64} alt="QR Mercado Pago" className="w-48 h-48 object-contain" />
                </div>
              ) : (
                <div className="py-10">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto" />
                  <p className="text-xs text-slate-400 mt-2">Generando código QR dinámico...</p>
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pide al cliente que escanee el código desde su app de Mercado Pago.
              </p>
            </div>
          )}

          {mpStatusState === 'APPROVED' && (
            <div className="space-y-3 py-3">
              <div className="h-14 w-14 bg-emerald-100 dark:bg-emerald-950 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-emerald-600">¡Pago Aprobado!</h3>
              <Button variant="primary" className="w-full" onClick={() => setIsMPModalOpen(false)}>
                Finalizar
              </Button>
            </div>
          )}

          {mpStatusState === 'FAILED' && (
            <div className="space-y-3 py-3">
              <div className="h-14 w-14 bg-rose-100 dark:bg-rose-950 rounded-full flex items-center justify-center mx-auto text-rose-600">
                <X className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-rose-600">Pago Cancelado o Fallido</h3>
              <Button variant="outline" className="w-full" onClick={() => setIsMPModalOpen(false)}>
                Cerrar
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* 7. MODAL DE APERTURA DE CAJA POS */}
      {isOpenCashModalOpen && (
        <Modal
          isOpen={isOpenCashModalOpen}
          onClose={() => setIsOpenCashModalOpen(false)}
          title="Apertura de Caja POS"
          size="md"
        >
          <div className="space-y-4 pt-1">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Para registrar ventas en efectivo o medios digitales en el POS, debes tener una sesión de caja abierta.
              </span>
            </div>

            {/* Selector de Caja / Terminal */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Seleccionar Caja / Terminal
              </label>
              {cashRegisters.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No hay cajas configuradas en la empresa.</p>
              ) : (
                <Select
                  value={selectedCashRegisterId}
                  onChange={(e) => setSelectedCashRegisterId(e.target.value)}
                  className="w-full text-xs font-bold"
                >
                  {cashRegisters.map((reg: any) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.name} ({reg.code}) {reg.isOpen ? '• Ya Abierta' : ''}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {/* Monto Inicial de Apertura */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Monto Inicial en Efectivo ($)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={openingBalanceInput}
                onChange={(e) => setOpeningBalanceInput(e.target.value)}
                placeholder="0.00"
                className="font-mono text-sm font-bold"
              />
            </div>

            {/* Notas opcionales */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Notas / Observaciones de Turno (opcional)
              </label>
              <Input
                value={openingNotesInput}
                onChange={(e) => setOpeningNotesInput(e.target.value)}
                placeholder="Ej: Turno Mañana / Caja Principal"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setIsOpenCashModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                disabled={!selectedCashRegisterId || openCashSessionMutation.isPending}
                onClick={() => {
                  openCashSessionMutation.mutate({
                    cashRegisterId: selectedCashRegisterId,
                    openingBalance: Number(openingBalanceInput) || 0,
                    notes: openingNotesInput,
                  });
                }}
              >
                {openCashSessionMutation.isPending ? 'Abriendo Caja...' : 'Abrir Caja y Continuar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
