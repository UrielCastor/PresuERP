import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, ShoppingCart, Trash2, Check, CreditCard, Banknote, Percent, Plus, X,
  User, Store, Lock, History, Star, Grid as GridIcon, Receipt, TrendingUp, Search as SearchIcon, Tag,
  ChevronDown, Building, UserCheck, Wallet
} from 'lucide-react';
import { productApi } from '../services/product.service';
import { saleApi } from '../services/sale.service';
import { warehouseApi } from '../services/warehouse.service';
import { posApi } from '../services/pos.service';
import { cashApi } from '../services/cash.service';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { paymentAdjustmentRuleService, calculatePaymentAdjustment } from '../services/paymentAdjustmentRule.service';
import { getCustomers, Customer } from '../services/customer.service';
import { CustomerFormModal } from './customers/CustomerFormModal';

const CATEGORIES = ['Todos', 'Favoritos', 'Más Vendidos', 'Recientes'];

export const POS: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENTAGE'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<number>(0);
  
  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'MERCADO_PAGO' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'CREDIT_ACCOUNT'>('CASH');
  const [showMobileCart, setShowMobileCart] = useState(false);

  // Customer Selection State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);

  const { data: customersRes } = useQuery({
    queryKey: ['posCustomersList'],
    queryFn: () => getCustomers({ active: true, limit: 100 }),
  });
  const customersList: Customer[] = customersRes?.data || [];

  const filteredPOSCustomers = useMemo(() => {
    const term = customerSearchTerm.toLowerCase().trim();
    if (!term) return customersList;
    return customersList.filter((c: Customer) =>
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

    const activeRules = rawList.filter((r: any) => r.active === true || r.active === 'true');
    console.log('Active discount rules:', activeRules);
    return activeRules;
  }, [adjustmentRules]);

  useEffect(() => {
    console.log('showActiveDiscounts state changed to:', showActiveDiscounts);
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
  
  const { data: activeSession, isLoading: loadingCashSession } = useQuery({
    queryKey: ['cash', 'active'],
    queryFn: cashApi.getActiveSession
  });

  // Fetch integrations to verify if MP is active
  const { data: integrationsRes } = useQuery({
    queryKey: ['businessIntegrations'],
    queryFn: () => api.get('/business/integrations').then(res => res.data.data),
  });

  const isMPActive = useMemo(() => {
    if (!integrationsRes) return false;
    const mp = integrationsRes.find((item: any) => item.provider === 'MERCADO_PAGO');
    return mp && mp.status === 'ACTIVE';
  }, [integrationsRes]);

  const { data: warehouses = [] } = useQuery({ 
    queryKey: ['warehousesListAll'], 
    queryFn: warehouseApi.list 
  });

  const { data: dashboardRes } = useQuery({ 
    queryKey: ['posDashboard'], 
    queryFn: posApi.getDashboard 
  });
  
  const dashboard = dashboardRes?.data || { salesToday: 0, revenueToday: 0, averageTicket: 0, pendingSales: 0 };
  
  const kpis = [
    { label: 'Ventas Hoy', value: dashboard.salesToday.toString(), color: 'text-emerald-500' },
    { label: 'Facturación', value: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(dashboard.revenueToday), color: 'text-indigo-500' },
    { label: 'Ticket Prom.', value: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(dashboard.averageTicket), color: 'text-blue-500' },
    { label: 'Pendientes', value: dashboard.pendingSales.toString(), color: 'text-amber-500' },
  ];

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
    return products.filter((p: any) => 
      p.status === 'ACTIVE' && 
      (p.name.toLowerCase().includes(term) || 
       p.barcode?.toLowerCase().includes(term) || 
       p.sku?.toLowerCase().includes(term))
    );
  }, [products, searchTerm]);

  // Cart operations
  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(item => item.product.id !== productId));
  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) return removeFromCart(productId);
    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity: qty } : item));
  };
  const clearCart = () => {
    setCart([]);
    setDiscountValue(0);
  };

  // Totals (Solo subtotal y descuento manual para la vista principal del carrito)
  const subtotal = cart.reduce((acc, item) => acc + (Number(item.product.salePrice) * item.quantity), 0);
  
  const calculatedDiscountAmount = useMemo(() => {
    if (!subtotal || discountValue <= 0) return 0;
    if (discountType === 'PERCENTAGE') {
      return Math.round((subtotal * discountValue) / 100 * 100) / 100;
    }
    return Math.min(subtotal, discountValue);
  }, [subtotal, discountType, discountValue]);

  const discountAmount = Math.min(subtotal, Math.max(0, calculatedDiscountAmount));
  const cartTotal = Math.max(0, subtotal - discountAmount);

  // Cálculo dinámico reutilizando el motor de ajustes compartido
  const paymentAdjustmentDetails = useMemo(() => {
    return calculatePaymentAdjustment(cartTotal, paymentMethod, adjustmentRules as any);
  }, [paymentMethod, adjustmentRules, cartTotal]);
  
  // Polling effect for Mercado Pago status detection
  useEffect(() => {
    let intervalId: any;

    if (isMPModalOpen && mpSaleId && mpStatusState === 'PENDING') {
      intervalId = setInterval(async () => {
        try {
          const res = await api.get(`/business/integrations/mercado-pago/payment-status/${mpSaleId}`);
          const status = res.data?.status;
          if (status === 'PAID') {
            setMpStatusState('APPROVED');
            clearInterval(intervalId);
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
            amount: finalAmount
          });

          if (qrRes.data && qrRes.data.data && qrRes.data.data.qrCodeBase64) {
            setMpQrCodeBase64(qrRes.data.data.qrCodeBase64);
            if (qrRes.data.data.qrCode) {
              setMpCheckoutUrl(qrRes.data.data.qrCode);
            }
          } else {
            console.error('No QR code received in response', qrRes.data);
            setMpStatusState('FAILED');
          }
        } catch (err: any) {
          console.error('Error initiating Mercado Pago QR', err);
          alert(err.response?.data?.message || 'Error al generar QR de Mercado Pago');
          setMpStatusState('FAILED');
        }
        return;
      }

      alert(`Venta registrada exitosamente! Comprobante: ${data.documentNumber}`);
      clearCart();
      setSelectedCustomer(null);
      setIsCheckoutOpen(false);
      setShowMobileCart(false);
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
    const isMP = paymentMethod === 'MERCADO_PAGO';

    const finalSaleDiscountAmount = paymentAdjustmentDetails.type === 'DISCOUNT'
      ? discountAmount + Math.abs(paymentAdjustmentDetails.adjustmentAmount)
      : discountAmount;

    const finalSaleSurchargeType = paymentAdjustmentDetails.type === 'SURCHARGE'
      ? (paymentAdjustmentDetails.valueType as any)
      : 'NONE';

    const finalSaleSurchargeValue = paymentAdjustmentDetails.type === 'SURCHARGE'
      ? paymentAdjustmentDetails.rawValue
      : 0;

    const finalSaleSurchargeAmount = paymentAdjustmentDetails.type === 'SURCHARGE'
      ? Math.abs(paymentAdjustmentDetails.adjustmentAmount)
      : 0;

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
        alert(`El total de la venta ($${finalTotalAmount.toLocaleString('es-AR')}) supera el crédito disponible del cliente ($${available.toLocaleString('es-AR')}).`);
        return;
      }
    }

    setMpAmount(finalTotalAmount);

    createSaleMutation.mutate({
      warehouseId: selectedWarehouseId,
      customerId: selectedCustomer?.id || null,
      cashSessionId: activeSession?.id,
      subtotal,
      discountType,
      discountValue,
      discountAmount: finalSaleDiscountAmount,
      surchargeType: finalSaleSurchargeType,
      surchargeValue: finalSaleSurchargeValue,
      surchargeAmount: finalSaleSurchargeAmount,
      totalAmount: finalTotalAmount,
      status: isMP ? 'PENDING' : 'COMPLETED',
      items: cart.map(c => ({
        productId: c.product.id,
        quantity: c.quantity,
        unitPrice: Number(c.product.salePrice),
        discountAmount: 0,
        totalAmount: Number(c.product.salePrice) * c.quantity
      })),
      payments: isMP ? [] : [
        {
          amount: finalTotalAmount,
          details: paymentMethod, // 'CASH', 'CARD', 'TRANSFER'
        }
      ]
    });
  };

  if (!hasPermission('sales:create')) return <div className="p-8 text-center text-gray-500">Permiso denegado</div>;

  if (!loadingCashSession && !activeSession) {
    return (
      <div className="h-full flex flex-col pt-10">
        <EmptyState
           title="No tienes una caja abierta"
           description="Debes abrir una sesión de caja antes de poder registrar ventas u operaciones en este Punto de Venta. Esta es una medida de seguridad del ERP."
           icon={Lock}
           actionLabel="Ir a Caja"
           onAction={() => navigate('/cash')}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#f8f9fa] dark:bg-gray-950 font-sans overflow-hidden">
      
      {/* 1. BARRA SUPERIOR UNIFICADA */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2.5 flex items-center justify-between shadow-sm z-30 shrink-0 relative overflow-visible">
         <div className="flex items-center gap-3 overflow-visible">
            <Button size="sm" variant="outline" className="shrink-0 bg-gray-50 text-gray-700 hidden sm:flex">
               <Plus className="w-4 h-4 mr-1"/> Nueva
            </Button>
            
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>
            
            {/* Selector Dinámico de Cliente */}
            <div className="relative">
               <button
                 type="button"
                 onClick={() => setIsCustomerModalOpen(true)}
                 className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/80 rounded-lg px-3 py-1.5 shrink-0 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 transition-all cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm"
               >
                 <UserCheck className="w-4 h-4 text-indigo-500" />
                 <span className="text-xs text-gray-400 font-normal">Cliente:</span>
                 <span className="max-w-[130px] sm:max-w-[160px] truncate font-semibold text-gray-900 dark:text-gray-100">
                   {selectedCustomer ? selectedCustomer.name : 'Consumidor Final'}
                 </span>
                 <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
               </button>
            </div>
            
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-1.5 shrink-0 border border-transparent focus-within:border-indigo-400">
               <Store className="w-4 h-4 text-gray-400" />
               <select 
                 value={selectedWarehouseId} 
                 onChange={(e) => setSelectedWarehouseId(e.target.value)}
                 className="bg-transparent text-sm font-medium outline-none text-gray-700 dark:text-gray-300 w-32 cursor-pointer"
               >
                  <option value="" disabled>Seleccionar...</option>
                  {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
               </select>
            </div>
            
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-1.5 shrink-0 border border-transparent focus-within:border-indigo-400">
                <Lock className="w-4 h-4 text-gray-400" />
                <select className="bg-transparent text-sm font-medium outline-none text-gray-700 dark:text-gray-300 w-28 cursor-pointer">
                   <option>Caja Principal</option>
                </select>
             </div>

             <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>

             {/* Acceso Visual Informativo: Descuentos y Recargos */}
             <div 
               className="relative shrink-0 discounts-popover-container"
               onMouseEnter={() => {
                 console.log('onMouseEnter - showActiveDiscounts: true');
                 setShowActiveDiscounts(true);
               }}
               onMouseLeave={() => {
                 console.log('onMouseLeave - showActiveDiscounts: false');
                 setShowActiveDiscounts(false);
               }}
             >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('onClick - toggle showActiveDiscounts:', !showActiveDiscounts);
                    setShowActiveDiscounts(prev => !prev);
                  }}
                  className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                   <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                   <span>🏷 Descuentos y Recargos</span>
                   {activeAdjustmentRules.length > 0 && (
                     <span className="bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full font-mono">
                       {activeAdjustmentRules.length}
                     </span>
                   )}
                </button>

                {/* Popover Informativo Flotante */}
                {showActiveDiscounts && (
                  <div className="absolute top-full left-0 mt-2 z-[9999] w-72 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-4 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2.5 mb-2.5">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                          Reglas activas
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium">Informativo</span>
                    </div>

                    {activeAdjustmentRules.length === 0 ? (
                      <div className="py-4 text-center text-xs text-gray-400 dark:text-gray-500 font-medium">
                        No hay descuentos o recargos configurados
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1 hide-scrollbar">
                        {activeAdjustmentRules.map((rule: any) => {
                          const isDiscount = rule.adjustmentType === 'DISCOUNT';
                          const formattedValue = rule.valueType === 'PERCENTAGE' 
                            ? `${rule.value}%` 
                            : `$${Number(rule.value).toLocaleString('es-AR')}`;

                          return (
                            <div 
                              key={rule.id} 
                              className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${isDiscount ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <span className="font-bold text-gray-800 dark:text-gray-200">
                                  {formatPaymentMethodName(rule.paymentMethod)}
                                </span>
                              </div>

                              <div className={`font-mono font-black text-xs px-2.5 py-0.5 rounded-md ${
                                isDiscount 
                                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300' 
                                  : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                              }`}>
                                {isDiscount ? 'Descuento ' : 'Recargo '}
                                {formattedValue}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-3 text-center border-t border-gray-100 dark:border-gray-800/80 pt-2">
                      Se aplican automáticamente al seleccionar el medio de pago en el cobro.
                    </p>
                  </div>
                )}
             </div>
         </div>
      </div>

      {/* 2. KPIs ZONA RÁPIDA (Desktop only) */}
      <div className="hidden lg:flex px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 gap-4 shrink-0">
         {kpis.map((kpi, idx) => (
           <div key={idx} className="bg-white dark:bg-gray-800 px-4 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between min-w-[140px]">
              <span className="text-xs text-gray-500 font-medium">{kpi.label}</span>
              <span className={`text-sm font-bold ${kpi.color}`}>{kpi.value}</span>
           </div>
         ))}
      </div>

      {/* 3. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
         
         {/* CATALOG (Left Column 70%) */}
         <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 lg:m-3 lg:rounded-2xl lg:shadow-sm lg:border border-gray-200 dark:border-gray-800 overflow-hidden">
            
            {/* Search & Categories Bar */}
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 space-y-3 shrink-0 bg-gray-50/50 dark:bg-gray-900/50">
               
               <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                  <input 
                    type="text" 
                    placeholder="Buscar productos o escanear código de barras..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm transition-all"
                    autoFocus
                  />
               </div>

               <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                  {CATEGORIES.map(cat => (
                     <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap
                           ${activeCategory === cat 
                              ? 'bg-indigo-600 text-white shadow-md' 
                              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'}`}
                     >
                        {cat}
                     </button>
                  ))}
               </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50 dark:bg-gray-950/30">
               {loadingProducts ? (
                 <div className="flex flex-col items-center justify-center p-20 text-gray-400 space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                 </div>
               ) : filteredProducts.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <GridIcon className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-medium">No se encontraron productos</p>
                 </div>
               ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 lg:grid-cols-3 gap-3 pb-24 lg:pb-4">
                    {filteredProducts.map((p: any) => {
                      const stockVal = getProductStock(p, selectedWarehouseId);

                      return (
                        <div
                          key={p.id}
                          onClick={() => addToCart(p)}
                          className="group cursor-pointer bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3.5 hover:border-indigo-400 hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col justify-between h-[155px]"
                        >
                          {/* Header & Meta Section */}
                          <div className="space-y-1.5 overflow-hidden">
                            {/* 1. Name & Plus Icon */}
                            <div className="flex justify-between items-start gap-1.5">
                              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-snug line-clamp-2" title={p.name}>
                                {p.name}
                              </h3>
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 p-1 rounded-full shrink-0">
                                <Plus className="w-3.5 h-3.5"/>
                              </span>
                            </div>

                            {/* 2. Barcode (under name, only if exists) */}
                            {p.barcode ? (
                              <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate">
                                Código: <span className="font-semibold text-gray-700 dark:text-gray-300">{p.barcode}</span>
                              </p>
                            ) : (
                              <div className="h-4"></div>
                            )}

                            {/* 3. Stock (under barcode) */}
                            <div>
                              {stockVal <= 0 ? (
                                <span className="inline-block text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-1.5 py-0.5 rounded">
                                  Sin stock
                                </span>
                              ) : stockVal <= 5 ? (
                                <span className="inline-block text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-1.5 py-0.5 rounded">
                                  ⚠️ Stock: {stockVal}
                                </span>
                              ) : (
                                <span className="inline-block text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded">
                                  Stock: {stockVal} un.
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 4. Price (bottom right, highlighted) */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 flex justify-end items-center shrink-0">
                            <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-lg leading-none">
                              {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(p.salePrice))}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
               )}
            </div>
         </div>

         {/* MOBILE CART FLOATER BUTTON */}
         <div className="lg:hidden fixed bottom-4 right-4 z-30">
            <button 
               onClick={() => setShowMobileCart(true)}
               className="bg-indigo-600 text-white rounded-full p-4 shadow-2xl shadow-indigo-600/40 relative active:scale-95 transition-transform"
            >
               <ShoppingCart className="w-6 h-6" />
               {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                     {cart.length}
                  </span>
               )}
            </button>
         </div>

         {/* CART PANE (Right Column 30%) */}
         <div className={`
            fixed inset-0 z-40 bg-white dark:bg-gray-900 lg:relative lg:z-10 lg:w-[380px] xl:w-[420px] 
            flex flex-col lg:m-3 lg:ml-0 lg:rounded-2xl lg:shadow-sm lg:border border-gray-200 dark:border-gray-800
            transition-transform duration-300 ease-in-out
            ${showMobileCart ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
         `}>
            
            {/* Cart Header */}
            <div className="p-4 bg-gray-900 dark:bg-black text-white flex justify-between items-center shrink-0 lg:rounded-t-2xl">
               <div className="flex items-center gap-2">
                 <ShoppingCart className="w-5 h-5 text-indigo-400" />
                 <h2 className="font-bold tracking-wide">CARRITO</h2>
               </div>
               <div className="flex items-center gap-3">
                  <span className="bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">{cart.length}</span>
                  <button onClick={() => setShowMobileCart(false)} className="lg:hidden text-gray-400 hover:text-white"><X className="w-6 h-6"/></button>
               </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/50 dark:bg-gray-800/20 custom-scrollbar">
               {cart.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <Receipt className="w-16 h-16 opacity-10 mb-4" />
                    <p className="text-sm font-medium">Aún no hay productos</p>
                 </div>
               ) : (
                 cart.map(item => (
                   <div key={item.product.id} className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 shadow-sm relative group">
                     <div className="flex justify-between items-start pr-8">
                       <span className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight line-clamp-2">{item.product.name}</span>
                       <span className="font-mono font-bold text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap ml-2">
                          {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(item.product.salePrice) * item.quantity)}
                       </span>
                     </div>
                     <div className="flex justify-between items-center mt-3">
                       <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-0.5 border border-gray-300 dark:border-gray-600">
                         <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors font-bold text-lg leading-none">-</button>
                         <span className="w-10 text-center font-bold text-sm select-none">{item.quantity}</span>
                         <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors font-bold text-lg leading-none">+</button>
                       </div>
                       <span className="text-xs text-gray-400 font-mono font-medium">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(item.product.salePrice)} c/u</span>
                     </div>
                     <button onClick={() => removeFromCart(item.product.id)} className="absolute top-3 right-3 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 bg-white dark:bg-gray-800 p-0.5 rounded-full">
                        <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                 ))
               )}
            </div>

            {/* Cart Footer / Checkout Trigger */}
            <div className="bg-white dark:bg-gray-900 p-4 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-3 shrink-0 shadow-[0_-10px_40px_rgb(0,0,0,0.05)] lg:rounded-b-2xl relative z-20">
               
               <div className="space-y-1">
                 <div className="flex justify-between text-gray-500 dark:text-gray-400 text-sm">
                   <span className="font-medium">Subtotal</span>
                   <span className="font-mono">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(subtotal)}</span>
                 </div>
                 
                 {/* Bloque de Descuento ordenado */}
                 <div className="py-2 my-1 border-t border-b border-gray-100 dark:border-gray-800/80 space-y-2">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-1.5 font-medium text-sm text-gray-700 dark:text-gray-300">
                       <Percent className="w-4 h-4 text-indigo-500" />
                       <span>Descuento</span>
                       <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-100 dark:bg-gray-800 ml-1">
                         <button
                           type="button"
                           onClick={() => setDiscountType('PERCENTAGE')}
                           className={`px-2 py-0.5 text-xs font-black rounded-md transition-all ${
                             discountType === 'PERCENTAGE'
                               ? 'bg-indigo-600 text-white shadow-sm'
                               : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                           }`}
                           title="Descuento Porcentual (%)"
                         >
                           %
                         </button>
                         <button
                           type="button"
                           onClick={() => setDiscountType('FIXED')}
                           className={`px-2 py-0.5 text-xs font-black rounded-md transition-all ${
                             discountType === 'FIXED'
                               ? 'bg-indigo-600 text-white shadow-sm'
                               : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                           }`}
                           title="Descuento Fijo en Dinero ($)"
                         >
                           $
                         </button>
                       </div>
                     </div>

                     <div className="flex items-center gap-1.5">
                       <span className="text-xs font-semibold text-gray-400">Valor:</span>
                       <div className="relative flex items-center">
                         <input 
                           type="number" 
                           min="0"
                           max={discountType === 'PERCENTAGE' ? 100 : subtotal}
                           disabled={cart.length === 0}
                           value={discountValue || ''} 
                           onChange={(e) => {
                             const val = Number(e.target.value);
                             setDiscountValue(val < 0 ? 0 : val);
                           }}
                           className="w-20 text-right pr-6 pl-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg outline-none text-gray-900 dark:text-white font-mono font-bold text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                           placeholder="0"
                         />
                         <span className="absolute right-2 text-xs font-bold text-gray-400 pointer-events-none font-mono">
                           {discountType === 'PERCENTAGE' ? '%' : '$'}
                         </span>
                       </div>
                     </div>
                   </div>

                   {discountAmount > 0 && (
                     <div className="flex justify-between items-center bg-emerald-50/80 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40 text-xs">
                       <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                         Monto aplicado:
                       </span>
                       <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                         -{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(discountAmount)}
                       </span>
                     </div>
                   )}
                 </div>

                  <div className="flex justify-between items-end pt-2 mt-2 border-t border-dashed border-gray-300 dark:border-gray-700">
                    <span className="text-gray-900 dark:text-gray-100 font-black uppercase text-xl tracking-tight">Total</span>
                    <span className="block text-3xl font-black font-mono text-indigo-600 dark:text-indigo-400 leading-none">
                      {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(cartTotal)}
                    </span>
                  </div>
               </div>

               <div className="flex gap-2 mt-2">
                 <Button 
                   size="lg"
                   variant="outline"
                   onClick={clearCart}
                   disabled={cart.length === 0}
                   className="w-16 shrink-0 border-gray-300 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                 >
                   <Trash2 className="w-5 h-5"/>
                 </Button>
                 
                 <Button 
                   size="lg" 
                   onClick={() => setIsCheckoutOpen(true)}
                   disabled={cart.length === 0}
                   className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-14 text-lg font-black shadow-lg shadow-indigo-600/25 disabled:shadow-none uppercase tracking-wide"
                 >
                   Cobrar
                 </Button>
               </div>
            </div>
         </div>
      </div>

      {/* 4. CHECKOUT MODAL */}
      {isCheckoutOpen && (
         <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
             <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                
                {/* Modal Header */}
                <div className="bg-gray-50 dark:bg-gray-800 p-5 px-6 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
                   <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Confirmar Pago</h2>
                   <button onClick={() => setIsCheckoutOpen(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-700 rounded-full p-2 shadow-sm transition-colors">
                      <X className="w-5 h-5" />
                   </button>
                </div>
                
                {/* Modal Body */}
                <div className="p-6 space-y-6">
                   <div className="text-center bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl py-6 border border-indigo-100 dark:border-indigo-500/20 px-4">
                      <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Monto a Cobrar</p>
                      <p className="text-5xl font-black font-mono text-indigo-700 dark:text-indigo-300">
                        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(paymentAdjustmentDetails.finalTotal)}
                      </p>
                      {paymentAdjustmentDetails.type === 'DISCOUNT' && (
                        <div className="mt-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 rounded-full inline-flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                          <span>🟢 {paymentAdjustmentDetails.label}: -{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Math.abs(paymentAdjustmentDetails.adjustmentAmount))}</span>
                        </div>
                      )}
                      {paymentAdjustmentDetails.type === 'SURCHARGE' && (
                        <div className="mt-3 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-3 py-1 rounded-full inline-flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                          <span>🟡 {paymentAdjustmentDetails.label}: +{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(paymentAdjustmentDetails.adjustmentAmount)}</span>
                        </div>
                      )}
                   </div>
                   
                   <div>
                     <p className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wide">Método de Pago</p>
                     <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: 'CASH', icon: Banknote, label: 'Efectivo' },
                          { id: 'TRANSFER', icon: Check, label: 'Transferencia' },
                          { id: 'DEBIT_CARD', icon: CreditCard, label: 'Débito' },
                          { id: 'CREDIT_CARD', icon: CreditCard, label: 'Crédito' },
                          ...(isMPActive ? [{ id: 'MERCADO_PAGO', icon: CreditCard, label: 'Mercado Pago' }] : []),
                          ...(selectedCustomer?.allowCreditAccount ? [{ id: 'CREDIT_ACCOUNT', icon: Wallet, label: 'Cuenta Corriente' }] : []),
                        ].map(method => {
                          const Icon = method.icon;
                          const active = paymentMethod === method.id;
                          return (
                            <button 
                              key={method.id}
                              onClick={() => setPaymentMethod(method.id as any)}
                              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left
                                ${active 
                                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm' 
                                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-indigo-300'
                                }`}
                            >
                              <Icon className={`w-6 h-6 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                              <span className="font-bold text-sm tracking-wide">{method.label}</span>
                            </button>
                          )
                        })}
                     </div>
                     
                     {/* Info Widget Cuenta Corriente */}
                     {paymentMethod === 'CREDIT_ACCOUNT' && selectedCustomer && (
                       <div className="mt-4 p-4 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-2 animate-in fade-in">
                         <div className="flex items-center justify-between font-bold text-xs text-indigo-900 dark:text-indigo-200">
                           <span>Cliente: {selectedCustomer.name}</span>
                           <span className="text-emerald-700 dark:text-emerald-400 font-extrabold text-sm">
                             Disponible: ${Math.max(0, Number(selectedCustomer.creditLimit || 0) - Number(selectedCustomer.currentDebt || 0)).toLocaleString('es-AR')}
                           </span>
                         </div>
                         <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 border-t border-indigo-100 dark:border-indigo-900/50 pt-2">
                           <span>Límite Mensual: ${Number(selectedCustomer.creditLimit || 0).toLocaleString('es-AR')}</span>
                           <span>Deuda Actual: ${Number(selectedCustomer.currentDebt || 0).toLocaleString('es-AR')}</span>
                         </div>
                       </div>
                     )}
                   </div>
                </div>

                {/* Modal Footer */}
                <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
                   <Button 
                     size="lg" 
                     onClick={confirmSale} 
                     isLoading={createSaleMutation.isPending}
                     className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-14 text-xl font-black shadow-lg shadow-emerald-600/30 uppercase tracking-wider"
                   >
                     Confirmar Venta
                   </Button>
                </div>

             </div>
         </div>
      )}

      {/* MERCADO PAGO TRANSACTION MODAL */}
      {isMPModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* Modal Header */}
            <div className="bg-gray-50 dark:bg-gray-800 p-5 px-6 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-[#009ee3] rounded-lg flex items-center justify-center text-white font-extrabold text-xs shadow-sm">
                  MP
                </div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Mercado Pago</h2>
              </div>
              <button 
                onClick={() => {
                  if (mpStatusState !== 'PENDING') {
                    setIsMPModalOpen(false);
                    clearCart();
                  } else {
                    if (confirm('¿Desea cerrar el modal de pago? La venta quedará pendiente en caja.')) {
                      setIsMPModalOpen(false);
                      clearCart();
                    }
                  }
                }} 
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-700 rounded-full p-2 shadow-sm transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 space-y-6 text-center">
              <div className="bg-[#009ee3]/10 dark:bg-[#009ee3]/20 rounded-2xl py-6 border border-[#009ee3]/20">
                <p className="text-sm font-bold text-[#009ee3] uppercase tracking-widest mb-1">Monto a Cobrar</p>
                <p className="text-5xl font-black font-mono text-gray-900 dark:text-white">
                  {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(mpAmount)}
                </p>
              </div>

              {/* Status Message */}
              <div className="py-2">
                {mpStatusState === 'PENDING' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-3 text-amber-500 font-bold">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-500 border-t-transparent"></div>
                      <span>Esperando pago...</span>
                    </div>

                    {mpQrCodeBase64 ? (
                      <div className="flex flex-col items-center gap-4 py-2">
                        <div className="p-3 bg-white border-2 border-gray-250 rounded-2xl shadow-sm inline-block">
                          <img 
                            src={mpQrCodeBase64} 
                            alt="Mercado Pago QR" 
                            className="w-56 h-56 object-contain" 
                          />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 px-4">
                          Escanee el código QR desde la aplicación Mercado Pago o banco para pagar.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
                        <div className="text-sm text-gray-400 animate-pulse">Generando código QR dinámico...</div>
                      </div>
                    )}
                  </div>
                )}

                {mpStatusState === 'APPROVED' && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center gap-3 text-emerald-500 font-black text-xl">
                      <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-950 rounded-full flex items-center justify-center">
                        <Check className="h-10 w-10 text-emerald-600" />
                      </div>
                      <span>Pago confirmado</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      La venta se ha completado y el stock fue descontado con éxito.
                    </p>
                    <Button
                      size="lg"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-bold"
                      onClick={() => {
                        setIsMPModalOpen(false);
                        clearCart();
                      }}
                    >
                      Finalizar Venta
                    </Button>
                  </div>
                )}

                {mpStatusState === 'FAILED' && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center gap-3 text-red-500 font-black text-xl">
                      <div className="h-16 w-16 bg-red-100 dark:bg-red-950 rounded-full flex items-center justify-center">
                        <X className="h-10 w-10 text-red-600" />
                      </div>
                      <span>Pago rechazado</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Hubo una falla al procesar el pago o la solicitud fue cancelada.
                    </p>
                    <div className="flex gap-2">
                       <Button
                         size="sm"
                         variant="outline"
                         className="flex-1"
                         onClick={() => {
                           setIsMPModalOpen(false);
                           setIsCheckoutOpen(true);
                         }}
                       >
                         Intentar de nuevo
                       </Button>
                       <Button
                         size="sm"
                         className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
                         onClick={() => {
                           setIsMPModalOpen(false);
                           clearCart();
                         }}
                       >
                         Cerrar
                       </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
         </div>
       )}

      {/* Modal / Selector de Cliente POS */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">Seleccionar Cliente para la Venta</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                    placeholder="Buscar cliente por nombre, DNI o CUIT..."
                    className="w-full text-sm pl-9 pr-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomerModalOpen(false);
                    setIsNewCustomerModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1 shrink-0 transition-all shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Nuevo Cliente
                </button>
              </div>
            </div>

            <div className="p-2 overflow-y-auto flex-1 space-y-1 divide-y divide-gray-100 dark:divide-gray-800">
              {/* Option: Consumidor Final */}
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setIsCustomerModalOpen(false);
                }}
                className={`w-full p-3 text-left rounded-xl flex items-center justify-between transition-colors ${
                  selectedCustomer === null
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-xs text-gray-600 dark:text-gray-300">
                    CF
                  </div>
                  <div>
                    <div className="font-bold text-sm text-gray-800 dark:text-gray-100">Consumidor Final</div>
                    <div className="text-xs text-gray-400">Cliente ocasional / Venta rápida sin datos</div>
                  </div>
                </div>
                {selectedCustomer === null && <Check className="w-5 h-5 text-indigo-600" />}
              </button>

              {filteredPOSCustomers.map((c) => {
                const isSelected = selectedCustomer?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(c);
                      setIsCustomerModalOpen(false);
                    }}
                    className={`w-full p-3 text-left rounded-xl flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center font-bold text-xs text-indigo-700 dark:text-indigo-300">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                          {c.name}
                          <span className={`px-2 py-0.2 rounded text-[10px] uppercase font-semibold ${c.type === 'COMPANY' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {c.type === 'COMPANY' ? 'Empresa' : 'Persona'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {c.document || c.taxId ? `Doc: ${c.document || c.taxId}` : ''} {c.phone ? `| Tel: ${c.phone}` : ''}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal para alta rápida de cliente desde POS */}
      <CustomerFormModal
        isOpen={isNewCustomerModalOpen}
        onClose={() => setIsNewCustomerModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['posCustomersList'] });
        }}
      />
    </div>
  );
};
