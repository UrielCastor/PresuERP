import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { swalSuccess, swalWarning, swalConfirm, handleApiError } from '../utils/swal';
import { getInitialWarehouseId } from '../utils/warehouse';
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
  RotateCcw,
  Gift,
  Award,
  Zap,
  HelpCircle,
  PauseCircle,
  Clock
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
import { POSItemCard } from '../components/ui/POSItemCard';

import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
  paymentAdjustmentRuleService,
  calculatePaymentAdjustment,
} from '../services/paymentAdjustmentRule.service';
import { getCustomers, Customer } from '../services/customer.service';
import { CustomerFormModal } from './customers/CustomerFormModal';
import { priceListService, PriceList } from '../services/priceList.service';
import { productPriceTierService, ProductPriceTier } from '../services/productPriceTier.service';
import { promotionService, Promotion } from '../services/promotion.service';
import { resolveProductPrice, getEffectiveProductPrice, resolveProductPriceDetails } from '../utils/priceUtils';
import { SettingsService } from '../services/settings.service';

const CATEGORIES = ['Todos', 'Favoritos', 'Más Vendidos', 'Recientes'];
const POS_DRAFT_KEY = 'presuerp_pos_draft_v1';
const POS_PREFERENCES_KEY = 'presuerp_pos_prefs_v1';

export const POS: React.FC = () => {
  const { hasPermission, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => getInitialWarehouseId(user) || '');
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENTAGE'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<number | string>('');
  const [restoredBanner, setRestoredBanner] = useState<string | null>(null);
  const [tierNotice, setTierNotice] = useState<{ message: string; visible: boolean } | null>(null);
  const [isRoundingSessionEnabled, setIsRoundingSessionEnabled] = useState<boolean>(true);
  const [loadedWarehouseId, setLoadedWarehouseId] = useState<string>('');

  // Estados para Ventas Suspendidas y Cobro en Efectivo (Vuelto)
  const [isSuspendedModalOpen, setIsSuspendedModalOpen] = useState<boolean>(false);
  const [cashReceivedInput, setCashReceivedInput] = useState<string>('');

  const { data: suspendedSalesList = [], refetch: refetchSuspendedSales } = useQuery({
    queryKey: ['suspendedSales', selectedWarehouseId],
    queryFn: () => saleApi.getSuspended(selectedWarehouseId || undefined),
  });

  // Inline Quantity Editing State in Cart
  const [editingQtyProductId, setEditingQtyProductId] = useState<string | null>(null);
  const [editingQtyInput, setEditingQtyInput] = useState<string>('');

const isKgProduct = (p: any) => {
  const u = String(p?.unitOfMeasure || '').toUpperCase();
  return u === 'KG' || u === 'KILOGRAM' || u === 'KILOGRAMO';
};

  const startQtyEdit = (productId: string, currentQty: number, productObj?: any) => {
    setEditingQtyProductId(productId);
    const isKg = productObj ? isKgProduct(productObj) : false;
    setEditingQtyInput(isKg ? Number(currentQty).toFixed(3) : String(currentQty));
  };

  const cancelQtyEdit = () => {
    setEditingQtyProductId(null);
  };

  const confirmQtyEdit = (productId: string, productObj?: any) => {
    const isKg = productObj ? isKgProduct(productObj) : false;
    const parsed = parseFloat(editingQtyInput);
    if (!isNaN(parsed) && parsed > 0) {
      const finalQty = isKg ? Math.round(parsed * 1000) / 1000 : Math.round(parsed);
      if (finalQty > 0) {
        updateQuantity(productId, finalQty);
      }
    }
    setEditingQtyProductId(null);
  };

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

  // Loyalty Program POS States
  const [loyaltyBalance, setLoyaltyBalance] = useState<{
    pointsBalance: number;
    pointValue: number;
    enabled: boolean;
    excludeFromLoyalty: boolean;
    maxRedemptionPercentage: number;
  } | null>(null);

  const [pointsToRedeemInput, setPointsToRedeemInput] = useState<string>('');
  const [appliedPointsRedeemed, setAppliedPointsRedeemed] = useState<number>(0);
  const [pointsDiscountAmount, setPointsDiscountAmount] = useState<number>(0);
  const [pointsPreviewError, setPointsPreviewError] = useState<string | null>(null);
  const [earnedPointsPreview, setEarnedPointsPreview] = useState<number>(0);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [loyaltyToast, setLoyaltyToast] = useState<{
    show: boolean;
    pointsRedeemed: number;
    pointsDiscountAmount: number;
    pointsEarned: number;
    newBalance: number;
  } | null>(null);

  useEffect(() => {
    let t: any;
    if (loyaltyToast?.show) {
      t = setTimeout(() => setLoyaltyToast(null), 6000);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [loyaltyToast]);

  // Loyalty handlers and effects are defined below after cartTotal is calculated.

  // Price List Selection State
  const [selectedPriceListId, setSelectedPriceListId] = useState<string>('');
  const [pendingPriceListId, setPendingPriceListId] = useState<string | null>(null);
  const [isPriceListModalOpen, setIsPriceListModalOpen] = useState<boolean>(false);

  const { data: priceLists = [] } = useQuery({
    queryKey: ['priceLists'],
    queryFn: priceListService.getAll,
  });

  const activePriceList = useMemo(
    () => priceLists.find((pl: PriceList) => pl.id === selectedPriceListId),
    [priceLists, selectedPriceListId]
  );

  // FUNCIÓN CENTRAL ÚNICA: Sincronización Total de Precios en POS
  const syncPriceListChange = useCallback((priceListId: string) => {
    setSelectedPriceListId(priceListId);

    // Recalcular inmediatamente el 100% de los items en el carrito preservando la tarifa base del producto
    setCart((prevCart) => {
      if (prevCart.length === 0) return prevCart;
      return prevCart.map((item) => {
        const baseProduct = {
          ...item.product,
          basePrice: item.product.basePrice !== undefined ? item.product.basePrice : Number(item.product.salePrice || 0),
        };
        const updatedPrice = getEffectiveProductPrice(baseProduct, priceListId, item.quantity);
        return {
          ...item,
          product: {
            ...baseProduct,
            salePrice: updatedPrice,
          },
        };
      });
    });
  }, []);

  // 1. Fallback si la lista de precios seleccionada ya no existe o es nula
  useEffect(() => {
    if (priceLists.length > 0) {
      const exists = priceLists.some((pl: PriceList) => pl.id === selectedPriceListId);
      if (!exists || !selectedPriceListId) {
        const defaultList = priceLists.find((pl: PriceList) => pl.isDefault === true) || priceLists[0];
        if (defaultList && defaultList.id !== selectedPriceListId) {
          syncPriceListChange(defaultList.id);
        }
      }
    }
  }, [priceLists, selectedPriceListId, syncPriceListChange]);

  // 2. Recálculo reactivo automático de ítems del carrito ante cualquier cambio en selectedPriceListId o priceLists
  useEffect(() => {
    if (!selectedPriceListId) return;
    setCart((prevCart) => {
      if (prevCart.length === 0) return prevCart;
      return prevCart.map((item) => {
        const baseProduct = {
          ...item.product,
          basePrice: item.product.basePrice !== undefined ? item.product.basePrice : Number(item.product.salePrice || 0),
        };
        const updatedPrice = getEffectiveProductPrice(baseProduct, selectedPriceListId, item.quantity);
        return {
          ...item,
          product: {
            ...baseProduct,
            salePrice: updatedPrice,
          },
        };
      });
    });
  }, [selectedPriceListId, priceLists]);

  // 3. Sincronización al cambiar el Cliente seleccionado
  useEffect(() => {
    if (priceLists.length === 0) return;
    const defaultList = priceLists.find((pl: PriceList) => pl.isDefault === true) || priceLists[0];

    if (selectedCustomer && selectedCustomer.defaultPriceListId && selectedCustomer.autoApplyPriceList !== false) {
      const targetList = priceLists.find((pl: PriceList) => pl.id === selectedCustomer.defaultPriceListId);
      if (targetList) {
        syncPriceListChange(targetList.id);
        return;
      }
    }

    // Caso 2: Cliente sin lista asignada o Consumidor Final -> Restaurar Lista Minorista (Base)
    if (defaultList) {
      syncPriceListChange(defaultList.id);
    }
  }, [selectedCustomer, priceLists, syncPriceListChange]);

  const handlePriceListChange = (newListId: string) => {
    if (newListId === selectedPriceListId) return;

    if (cart.length === 0) {
      syncPriceListChange(newListId);
    } else {
      setPendingPriceListId(newListId);
      setIsPriceListModalOpen(true);
    }
  };

  const confirmPriceListChange = () => {
    if (pendingPriceListId) {
      syncPriceListChange(pendingPriceListId);
    }
    setPendingPriceListId(null);
    setIsPriceListModalOpen(false);
  };

  const cancelPriceListChange = () => {
    setPendingPriceListId(null);
    setIsPriceListModalOpen(false);
  };

  // 1. Cargar preferencias al iniciar
  useEffect(() => {
    try {
      const savedPrefs = localStorage.getItem(POS_PREFERENCES_KEY);
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        if (prefs.activeCategory) setActiveCategory(prefs.activeCategory);
        if (prefs.selectedWarehouseId) setSelectedWarehouseId(prefs.selectedWarehouseId);
      }
    } catch (err) {
      console.error('Error al cargar preferencias del POS:', err);
    }
  }, []);

  // Cargar borrador dinámicamente al cambiar de sucursal
  useEffect(() => {
    if (!selectedWarehouseId) return;
    try {
      const draftKey = `presuerp_pos_draft_v1_${user?.businessId || 'default'}_${selectedWarehouseId}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.cart && Array.isArray(parsed.cart)) {
          setCart(parsed.cart);
          setDiscountType(parsed.discountType || 'PERCENTAGE');
          setDiscountValue(parsed.discountValue !== undefined ? parsed.discountValue : '');
          setPaymentMethod(parsed.paymentMethod || 'CASH');
          setSelectedCustomer(parsed.selectedCustomer || null);
          setRestoredBanner('Se restauró automáticamente una venta que estaba en curso.');
          setLoadedWarehouseId(selectedWarehouseId);
          return;
        }
      }
      setCart([]);
      setDiscountType('PERCENTAGE');
      setDiscountValue('');
      setPaymentMethod('CASH');
      setSelectedCustomer(null);
      setRestoredBanner(null);
      setLoadedWarehouseId(selectedWarehouseId);
    } catch (err) {
      console.error('Error al cargar borrador del POS:', err);
    }
  }, [selectedWarehouseId, user?.businessId]);

  // 2. Persistir automáticamente la venta en curso ante cualquier cambio
  useEffect(() => {
    if (!selectedWarehouseId || loadedWarehouseId !== selectedWarehouseId) return;
    try {
      const draftKey = `presuerp_pos_draft_v1_${user?.businessId || 'default'}_${selectedWarehouseId}`;
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
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } else {
        localStorage.removeItem(draftKey);
      }
    } catch (err) {
      console.error('Error al guardar borrador del POS:', err);
    }
  }, [cart, discountType, discountValue, paymentMethod, selectedWarehouseId, selectedCustomer, loadedWarehouseId, user?.businessId]);

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
  const [showActivePromotions, setShowActivePromotions] = useState(false);
  const [showHelpPopover, setShowHelpPopover] = useState(false);

  const { data: promotionsList = [] } = useQuery({
    queryKey: ['promotionsList'],
    queryFn: () => promotionService.getAll(),
  });

  const activePromotions = useMemo(() => {
    const list = Array.isArray(promotionsList) ? promotionsList : [];
    return list.filter((p: Promotion) => p.isActive === true);
  }, [promotionsList]);

  const { data: priceTiersList = [] } = useQuery({
    queryKey: ['productPriceTiersList'],
    queryFn: () => productPriceTierService.getAll(),
  });

  const activePriceTiers = useMemo(() => {
    const list = Array.isArray(priceTiersList) ? priceTiersList : [];
    return list.filter((pt: ProductPriceTier) => pt.isActive === true);
  }, [priceTiersList]);

  const totalOffersCount = activePriceTiers.length + activePromotions.length;

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
      if (showActivePromotions && !target.closest('.promotions-popover-container')) {
        setShowActivePromotions(false);
      }
      if (showHelpPopover && !target.closest('.help-popover-container')) {
        setShowHelpPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActiveDiscounts, showActivePromotions, showHelpPopover]);

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

  const { data: activeSession } = useQuery({
    queryKey: ['cash', 'active', selectedWarehouseId],
    queryFn: () => cashApi.getActiveSession(selectedWarehouseId ? { warehouseId: selectedWarehouseId } : undefined),
  });

  const sessionWarehouseId = activeSession?.warehouseId || activeSession?.warehouse?.id || activeSession?.cashRegister?.warehouseId;

  useEffect(() => {
    if (sessionWarehouseId && sessionWarehouseId !== selectedWarehouseId) {
      setSelectedWarehouseId(sessionWarehouseId);
    }
  }, [sessionWarehouseId, selectedWarehouseId]);

  // Data Fetching: Filtrar por el deposito de la CashSession activa
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['productsListAll', selectedWarehouseId],
    queryFn: () => productApi.list(selectedWarehouseId ? { warehouseId: selectedWarehouseId } : undefined),
  });
  const products = productsData || [];

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
    onError: (err: any) => handleApiError(err, 'Error al Abrir Caja'),
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
    queryKey: ['posDashboard', selectedWarehouseId, activeSession?.id],
    queryFn: () => posApi.getDashboard({ warehouseId: selectedWarehouseId, cashSessionId: activeSession?.id }),
  });

  const dashboard = dashboardRes?.data || {
    salesToday: 0,
    revenueToday: 0,
    averageTicket: 0,
    pendingSales: 0,
  };

  useEffect(() => {
    if (warehouses.length > 0 && !selectedWarehouseId) {
      const initialWhId = getInitialWarehouseId(user, warehouses);
      if (initialWhId) {
        setSelectedWarehouseId(initialWhId);
      }
    }
  }, [warehouses, selectedWarehouseId, user]);

  const getProductStock = (p: any, warehouseId: string) => {
    if (p.stocks && Array.isArray(p.stocks) && warehouseId) {
      const st = p.stocks.find((s: any) => s.warehouseId === warehouseId);
      return st !== undefined ? Number(st.quantity) : 0;
    }
    return Number(p.totalStock || 0);
  };

  const filteredProducts = useMemo(() => {
    let result = products.filter((p: any) => p.status === 'ACTIVE');

    const term = searchTerm.toLowerCase().trim();
    if (term) {
      result = result.filter(
        (p: any) =>
          p.name.toLowerCase().includes(term) ||
          p.barcode?.toLowerCase().includes(term) ||
          p.sku?.toLowerCase().includes(term)
      );
    }

    if (activeCategory === 'Favoritos') {
      result = result.filter((p: any) => p.isFavorite);
    } else if (activeCategory === 'Más Vendidos') {
      result = [...result].sort((a: any, b: any) => (b.salesCount || 0) - (a.salesCount || 0));
    } else if (activeCategory === 'Recientes') {
      result = [...result].sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }

    return result;
  }, [products, searchTerm, activeCategory]);

  // Cart operations
  const addToCart = useCallback((product: any) => {
    const baseProduct = {
      ...product,
      basePrice: product.basePrice !== undefined ? product.basePrice : Number(product.salePrice || 0),
    };
    const effectivePrice = resolveProductPrice(baseProduct, selectedPriceListId, 1);
    const productWithPrice = { ...baseProduct, salePrice: effectivePrice };

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + 1;
        const oldPrice = Number(existing.product.salePrice);
        const details = resolveProductPriceDetails(existing.product, selectedPriceListId, newQty);
        const updatedPrice = details.unitPrice;

        if (oldPrice !== updatedPrice) {
          const noticeMsg = details.promoNotice || `Precio por cantidad aplicado: ${newQty} unidades ($${oldPrice.toLocaleString('es-AR')} ➔ $${updatedPrice.toLocaleString('es-AR')})`;
          setTierNotice({
            message: noticeMsg,
            visible: true,
          });
          setTimeout(() => setTierNotice(null), 3500);
        }

        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: newQty, product: { ...existing.product, salePrice: updatedPrice } }
            : item
        );
      }
      return [...prev, { product: productWithPrice, quantity: 1 }];
    });
  }, [selectedPriceListId]);

  // POS Search Focus & Keydown Management
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const performPOSSearch = useCallback((query: string) => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;
    const lowerQuery = cleanQuery.toLowerCase();
    const activeProducts = products.filter((p: any) => p.status === 'ACTIVE');

    // 1. Coincidencia exacta: 1) Código de barras, 2) SKU, 3) ID
    let exactMatch = activeProducts.find(
      (p: any) => p.barcode && p.barcode.trim().toLowerCase() === lowerQuery
    );

    if (!exactMatch) {
      exactMatch = activeProducts.find(
        (p: any) => p.sku && p.sku.trim().toLowerCase() === lowerQuery
      );
    }

    if (!exactMatch) {
      exactMatch = activeProducts.find(
        (p: any) => p.id && p.id.trim().toLowerCase() === lowerQuery
      );
    }

    const isGlobalAllowWithoutStock = Boolean((posSettingsRes as any)?.allowNegativeStock || (posSettingsRes as any)?.allowSaleWithoutStock);
    const canSellWithoutStock = (p: any) => isGlobalAllowWithoutStock || Boolean(p.allowSaleWithoutStock);

    if (exactMatch) {
      const stockNum = getProductStock(exactMatch, selectedWarehouseId);
      if (stockNum <= 0 && !canSellWithoutStock(exactMatch)) {
        setSearchError('Producto sin stock disponible');
        setTimeout(() => setSearchError(null), 3000);
      } else {
        addToCart(exactMatch);
        setSearchTerm('');
        setSearchError(null);
      }
      setTimeout(() => searchInputRef.current?.focus(), 50);
      return;
    }

    // 2. Coincidencia por nombre o datos parciales
    const nameMatches = activeProducts.filter(
      (p: any) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        (p.barcode && p.barcode.toLowerCase().includes(lowerQuery)) ||
        (p.sku && p.sku.toLowerCase().includes(lowerQuery))
    );

    if (nameMatches.length === 1) {
      const singleProduct = nameMatches[0];
      const stockNum = getProductStock(singleProduct, selectedWarehouseId);
      if (stockNum <= 0 && !canSellWithoutStock(singleProduct)) {
        setSearchError('Producto sin stock disponible');
        setTimeout(() => setSearchError(null), 3000);
      } else {
        addToCart(singleProduct);
        setSearchTerm('');
        setSearchError(null);
      }
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (nameMatches.length > 1) {
      setSearchError(null);
    } else {
      setSearchError('Producto no encontrado');
      setTimeout(() => setSearchError(null), 3000);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [products, selectedWarehouseId, addToCart]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performPOSSearch(searchTerm);
    }
  };

  const removeFromCart = (productId: string) =>
    setCart((prev) => prev.filter((item) => item.product.id !== productId));

  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) return removeFromCart(productId);
    const itemInCart = cart.find((i) => i.product.id === productId);
    const isKg = itemInCart ? isKgProduct(itemInCart.product) : false;
    const cleanQty = isKg ? Math.round(qty * 1000) / 1000 : Math.round(qty);
    if (cleanQty <= 0) return removeFromCart(productId);

    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const baseProduct = {
            ...item.product,
            basePrice: item.product.basePrice !== undefined ? item.product.basePrice : Number(item.product.salePrice || 0),
          };
          const oldPrice = Number(item.product.salePrice);
          const details = resolveProductPriceDetails(baseProduct, selectedPriceListId, cleanQty);
          const updatedPrice = details.unitPrice;

          if (oldPrice !== updatedPrice && cleanQty >= 1) {
            const noticeMsg = details.promoNotice || `Precio por cantidad aplicado: ${cleanQty} unidades ($${oldPrice.toLocaleString('es-AR')} ➔ $${updatedPrice.toLocaleString('es-AR')})`;
            setTierNotice({
              message: noticeMsg,
              visible: true,
            });
            setTimeout(() => setTierNotice(null), 3500);
          }

          return { ...item, quantity: cleanQty, product: { ...baseProduct, salePrice: updatedPrice } };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCart([]);
    setDiscountValue('');
    localStorage.removeItem(POS_DRAFT_KEY);
    setPointsToRedeemInput('');
    setAppliedPointsRedeemed(0);
    setPointsDiscountAmount(0);
    setPointsPreviewError(null);
    setEarnedPointsPreview(0);
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

  // Fetch points balance on customer selection
  useEffect(() => {
    if (selectedCustomer) {
      api.get(`/points/customers/${selectedCustomer.id}/balance`)
        .then(res => {
          if (res.data?.success) {
            setLoyaltyBalance({
              pointsBalance: Number(res.data.data.pointsBalance),
              pointValue: Number(res.data.data.pointValue),
              enabled: Boolean(res.data.data.enabled),
              excludeFromLoyalty: Boolean(res.data.data.excludeFromLoyalty),
              maxRedemptionPercentage: Number(res.data.data.maxRedemptionPercentage || 50),
            });
          }
        })
        .catch(() => {
          setLoyaltyBalance(null);
        });
    } else {
      setLoyaltyBalance(null);
    }
  }, [selectedCustomer]);

  // Preview points to earn dynamically
  useEffect(() => {
    if (selectedCustomer && loyaltyBalance?.enabled && !loyaltyBalance?.excludeFromLoyalty) {
      const finalPaid = Math.max(0, cartTotal - pointsDiscountAmount);
      api.post('/sales/points/earn-preview', {
        customerId: selectedCustomer.id,
        totalAmount: finalPaid
      })
      .then(res => {
        if (res.data?.success) {
          setEarnedPointsPreview(Number(res.data.data.pointsEarned));
        }
      })
      .catch(() => {
        setEarnedPointsPreview(0);
      });
    } else {
      setEarnedPointsPreview(0);
    }
  }, [selectedCustomer, cartTotal, pointsDiscountAmount, loyaltyBalance]);

  const handleApplyPointsRedeem = async () => {
    if (!selectedCustomer) return;
    const pts = parseInt(pointsToRedeemInput);
    if (isNaN(pts) || pts <= 0) {
      setPointsPreviewError('Ingrese una cantidad válida de puntos.');
      return;
    }

    try {
      setIsPreviewLoading(true);
      setPointsPreviewError(null);
      
      const res = await api.post('/sales/points/preview', {
        customerId: selectedCustomer.id,
        pointsToRedeem: pts,
        saleTotalBeforePoints: cartTotal,
      });

      if (res.data?.success) {
        const preview = res.data.data;
        if (preview.applicable) {
          setAppliedPointsRedeemed(pts);
          setPointsDiscountAmount(preview.finalDiscount);
        } else {
          setPointsPreviewError(preview.reason || 'No se puede aplicar el canje.');
          setAppliedPointsRedeemed(0);
          setPointsDiscountAmount(0);
        }
      }
    } catch (err: any) {
      setPointsPreviewError(err.response?.data?.message || 'Error al validar canje de puntos.');
      setAppliedPointsRedeemed(0);
      setPointsDiscountAmount(0);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleRemovePointsRedeem = () => {
    setAppliedPointsRedeemed(0);
    setPointsDiscountAmount(0);
    setPointsToRedeemInput('');
    setPointsPreviewError(null);
  };

  // Reset redemption input and status whenever customer changes manually
  useEffect(() => {
    setPointsToRedeemInput('');
    setAppliedPointsRedeemed(0);
    setPointsDiscountAmount(0);
    setPointsPreviewError(null);
  }, [selectedCustomer]);

  // Recalcular automáticamente la simulación de canje si el total del carrito cambia
  useEffect(() => {
    if (appliedPointsRedeemed > 0 && selectedCustomer) {
      setIsPreviewLoading(true);
      api.post('/sales/points/preview', {
        customerId: selectedCustomer.id,
        pointsToRedeem: appliedPointsRedeemed,
        saleTotalBeforePoints: cartTotal,
      })
      .then(res => {
        if (res.data?.success) {
          const preview = res.data.data;
          if (preview.applicable) {
            setPointsDiscountAmount(preview.finalDiscount);
            setPointsPreviewError(null);
          } else {
            // Si ya no cumple con las reglas, se remueve el descuento y se le notifica
            setAppliedPointsRedeemed(0);
            setPointsDiscountAmount(0);
            setPointsPreviewError(preview.reason || 'El canje ya no es aplicable para el nuevo total de la venta.');
          }
        }
      })
      .catch(() => {
        setAppliedPointsRedeemed(0);
        setPointsDiscountAmount(0);
      })
      .finally(() => {
        setIsPreviewLoading(false);
      });
    }
  }, [cartTotal]);

  const paymentAdjustmentDetails = useMemo(() => {
    return calculatePaymentAdjustment(cartTotal, paymentMethod, adjustmentRules as any);
  }, [paymentMethod, adjustmentRules, cartTotal]);

  const { data: posSettingsRes } = useQuery({
    queryKey: ['posSettingsData'],
    queryFn: async () => {
      const res = await SettingsService.getSettings();
      return res?.posSettings;
    },
  });

  const isGlobalRoundingConfigured = Boolean(
    posSettingsRes?.autoRounding || (posSettingsRes as any)?.autoPriceRounding
  );

  const autoRoundingMode = posSettingsRes?.autoRoundingMode || 'CASH_ONLY';

  const isAutoRoundingActive = useMemo(() => {
    if (!isGlobalRoundingConfigured || !isRoundingSessionEnabled) return false;

    if (autoRoundingMode === 'CASH_ONLY') {
      return paymentMethod === 'CASH';
    }
    return true;
  }, [isGlobalRoundingConfigured, isRoundingSessionEnabled, paymentMethod, autoRoundingMode]);

  const unroundedFinalTotal = paymentAdjustmentDetails.finalTotal;

  const roundedFinalTotal = useMemo(() => {
    if (!isAutoRoundingActive || unroundedFinalTotal <= 0) return unroundedFinalTotal;
    return Math.round(unroundedFinalTotal / 100) * 100;
  }, [isAutoRoundingActive, unroundedFinalTotal]);

  const roundingAdjustmentAmount = roundedFinalTotal - unroundedFinalTotal;

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
          handleApiError(err, 'Error Mercado Pago');
          setMpStatusState('FAILED');
        }
        return;
      }

      const targetCustomer = selectedCustomer;
      if (targetCustomer && (data.pointsEarned > 0 || data.pointsRedeemed > 0)) {
        api.get(`/points/customers/${targetCustomer.id}/balance`)
          .then(res => {
            if (res.data?.success) {
              setLoyaltyToast({
                show: true,
                pointsRedeemed: data.pointsRedeemed || 0,
                pointsDiscountAmount: Number(data.pointsDiscountAmount || 0),
                pointsEarned: data.pointsEarned || 0,
                newBalance: Number(res.data.data.pointsBalance),
              });
            }
          })
          .catch(err => console.error('Error fetching new points balance for toast:', err));
      }

      swalSuccess('Venta Registrada', `¡Venta registrada exitosamente!\nComprobante: ${data.documentNumber}`);
      clearCart();
      setSelectedCustomer(null);
      setIsCheckoutOpen(false);
      const draftKey = `presuerp_pos_draft_v1_${user?.businessId || 'default'}_${selectedWarehouseId}`;
      localStorage.removeItem(draftKey);
      queryClient.invalidateQueries({ queryKey: ['posDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['cash'] });
    },
    onError: (err: any) => {
      handleApiError(err, 'Error al Procesar Venta');
    },
  });

  const confirmSale = () => {
    if (cart.length === 0 || !selectedWarehouseId) return;

    if (!activeSession) {
      swalWarning('Caja Requerida', 'Debes tener una sesión de caja abierta para registrar una venta.');
      return;
    }

    const finalTotalAmount = Math.max(0, roundedFinalTotal - pointsDiscountAmount);

    if (paymentMethod === 'CASH') {
      const received = parseFloat(cashReceivedInput) || 0;
      if (received < finalTotalAmount - 0.01) {
        swalWarning(
          'Pago Insuficiente',
          `El efectivo recibido ($ ${received.toLocaleString('es-AR', { minimumFractionDigits: 2 })}) es menor al total a cobrar ($ ${finalTotalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}).`
        );
        return;
      }
    }

    if (paymentMethod === 'CREDIT_ACCOUNT') {
      if (!selectedCustomer) {
        swalWarning('Cliente Requerido', 'Debes seleccionar un cliente para realizar una venta a Cuenta Corriente.');
        return;
      }
      if (!selectedCustomer.allowCreditAccount) {
        swalWarning('Cuenta Corriente Deshabilitada', `El cliente "${selectedCustomer.name}" no tiene habilitada la Cuenta Corriente.`);
        return;
      }
      const currentDebt = Number(selectedCustomer.currentDebt || 0);
      const creditLimit = Number(selectedCustomer.creditLimit || 0);
      if (currentDebt + finalTotalAmount > creditLimit) {
        const available = Math.max(0, creditLimit - currentDebt);
        swalWarning(
          'Límite de Crédito Excedido',
          `El total de la venta ($${finalTotalAmount.toLocaleString('es-AR')}) supera el crédito disponible ($${available.toLocaleString('es-AR')}).`
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

    console.log('[DEBUG SALE PAYLOAD FRONTEND]', {
      subtotal,
      total: cartTotal,
      paymentAmount: paymentAdjustmentDetails.finalTotal,
      roundedTotal: roundedFinalTotal,
      discountAmount,
      surchargeAmount: paymentAdjustmentDetails.adjustmentAmount,
      paymentAdjustments: paymentAdjustmentDetails,
      promotions: tierNotice,
      finalSaleDiscountAmount,
      surchargeAmountVal: surchargeAmount,
      finalTotalAmountSent: finalTotalAmount,
    });

    createSaleMutation.mutate({
      priceListId: selectedPriceListId || undefined,
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
      pointsRedeemed: appliedPointsRedeemed,
    });
  };

  const handleSuspendSale = async () => {
    if (cart.length === 0 || !selectedWarehouseId) return;

    const confirmed = await swalConfirm(
      '¿Suspender Venta?',
      'La venta se guardará como una operación pendiente y podrás recuperarla en cualquier momento desde el POS.',
      'Sí, suspender',
      'Cancelar',
      'info'
    );
    if (!confirmed) return;

    try {
      const finalTotalAmount = Math.max(0, roundedFinalTotal - pointsDiscountAmount);
      const items = cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.product.salePrice,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: item.quantity * item.product.salePrice,
      }));

      const saleData = {
        warehouseId: selectedWarehouseId,
        customerId: selectedCustomer?.id || null,
        priceListId: selectedPriceListId || null,
        cashSessionId: activeSession?.id || null,
        subtotal,
        discountType,
        discountValue: Number(discountValue) || 0,
        discountAmount,
        totalAmount: finalTotalAmount,
        status: 'PENDING',
        notes: 'Venta Suspendida en POS',
        items,
      };

      const res = await saleApi.create(saleData);
      await swalSuccess(
        'Venta Suspendida',
        `La venta fue guardada correctamente como Venta Pendiente #${res.documentNumber || res.id}.`
      );
      clearCart();
      refetchSuspendedSales();
    } catch (err: any) {
      handleApiError(err, 'Error al suspender venta');
    }
  };

  const handleRecoverSuspended = async (id: string) => {
    try {
      const sale = await saleApi.recoverSuspended(id);
      if (sale && sale.items) {
        const restoredItems = sale.items.map((item: any) => ({
          product: item.product,
          quantity: Number(item.quantity),
        }));
        setCart(restoredItems);
        if (sale.customer) {
          setSelectedCustomer(sale.customer);
        }
        if (sale.discountType) setDiscountType(sale.discountType);
        if (sale.discountValue) setDiscountValue(sale.discountValue);

        setIsSuspendedModalOpen(false);
        await swalSuccess(
          'Venta Recuperada',
          `Los ${restoredItems.length} productos de la Venta Pendiente #${sale.documentNumber} fueron cargados al carrito.`
        );
        refetchSuspendedSales();
      }
    } catch (err: any) {
      handleApiError(err, 'Error al recuperar venta');
    }
  };

  const handleDeleteSuspended = async (id: string, docNumber: number) => {
    const confirmed = await swalConfirm(
      '¿Eliminar venta pendiente?',
      `La Venta Pendiente #${docNumber} se eliminará y no podrá recuperarse.`,
      'Eliminar',
      'Cancelar',
      'warning'
    );
    if (!confirmed) return;

    try {
      await saleApi.deleteSuspended(id);
      await swalSuccess('Venta Eliminada', 'La venta pendiente fue eliminada correctamente.');
      refetchSuspendedSales();
    } catch (err: any) {
      handleApiError(err, 'Error al eliminar venta pendiente');
    }
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

      {/* BANNER DISCRETO DE PRECIO ACTUALIZADO POR CANTIDAD */}
      {tierNotice && tierNotice.visible && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm animate-fadeIn">
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-500" />
            {tierNotice.message}
          </span>
          <button
            type="button"
            onClick={() => setTierNotice(null)}
            className="text-emerald-500 hover:text-emerald-800 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. HEADER COMPACTO POS EN UNA SOLA FILA HORIZONTAL CON POPOVERS UNCLIPPED */}
      <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap lg:flex-nowrap items-center justify-between gap-1.5 relative z-20">
        
        {/* LADO IZQUIERDO: TÍTULO POS Y CONTEXTO OPERATIVO */}
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none py-0.5 max-w-full text-xs">
          {/* POS Título Compacto */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-900 shrink-0">
            <Store className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs font-black uppercase tracking-wider">
              POS
            </span>
          </div>

          {/* Caja Activa Badge */}
          {activeSession ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              {activeSession.cashRegister?.name || 'Caja Principal'} (ABIERTA)
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpenCashModalOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 shrink-0"
            >
              <Wallet className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              Sin Caja — [Abrir]
            </button>
          )}

          {/* Cliente Chip */}
          <button
            type="button"
            onClick={() => setIsCustomerModalOpen(true)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all shrink-0"
          >
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {selectedCustomer ? selectedCustomer.name : 'Consumidor Final'}
            </span>
            {selectedCustomer?.defaultPriceList && (
              <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                {selectedCustomer.defaultPriceList.name}
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {/* Lista de Precios Select */}
          <div className="w-auto min-w-[115px] shrink-0">
            <Select
              value={selectedPriceListId}
              onChange={(e) => handlePriceListChange(e.target.value)}
              className="py-0.5 px-2 text-xs font-bold bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-lg"
              title="Lista de Precios"
            >
              {priceLists.length === 0 ? (
                <option value="">Lista Minorista</option>
              ) : (
                priceLists.map((pl: PriceList) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name.replace(/\s*\((Base|Default)\)/gi, '').trim()}
                  </option>
                ))
              )}
            </Select>
          </div>

          {/* Depósito Badge (Inmutable según CashSession) */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-extrabold text-slate-800 dark:text-slate-200 shrink-0"
            title="Depósito asociado a la caja abierta"
          >
            <Building className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>
              {activeSession?.warehouse?.name ||
                activeSession?.cashRegister?.warehouse?.name ||
                warehouses.find((w: any) => w.id === selectedWarehouseId)?.name ||
                'Depósito'}
            </span>
          </div>
        </div>

        {/* LADO DERECHO: ACCIONES COMERCIALES Y NAVEGACIÓN */}
        <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0 relative z-30">
          {/* Tarjeta Redondeo POS */}
          {isGlobalRoundingConfigured && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRoundingSessionEnabled(!isRoundingSessionEnabled)}
              className={`flex items-center gap-1 font-bold py-0.5 px-2 text-xs rounded-lg transition-all ${
                isRoundingSessionEnabled
                  ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 hover:bg-emerald-100'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100'
              }`}
              title={
                isRoundingSessionEnabled
                  ? 'Redondeo activado para esta venta (haz clic para desactivar)'
                  : 'Redondeo desactivado para esta venta (haz clic para activar)'
              }
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Redondeo</span>
              <span
                className={`ml-0.5 px-1.5 py-0.2 text-[10px] font-black rounded-full ${
                  isRoundingSessionEnabled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {isRoundingSessionEnabled ? 'Activado' : 'Desactivado'}
              </span>
            </Button>
          )}

          {/* Botón: Ventas Suspendidas */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSuspendedModalOpen(true)}
            className="flex items-center gap-1 font-bold py-0.5 px-2 text-xs border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 hover:bg-amber-100 rounded-lg"
            title="Ver ventas suspendidas"
          >
            <PauseCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Ventas suspendidas</span>
            {suspendedSalesList && suspendedSalesList.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-black rounded-full bg-amber-600 text-white font-mono">
                {suspendedSalesList.length}
              </span>
            )}
          </Button>

          {/* Botón 1: Descuentos y Recargos */}
          <div className="relative discounts-popover-container">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowActiveDiscounts(!showActiveDiscounts)}
              className="flex items-center gap-1 font-bold py-0.5 px-2 text-xs border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-300 hover:bg-indigo-100 rounded-lg"
            >
              <Percent className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Descuentos y Recargos</span>
              {activeAdjustmentRules.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-black rounded-full bg-indigo-600 text-white">
                  {activeAdjustmentRules.length}
                </span>
              )}
            </Button>

            {showActiveDiscounts && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-3.5 space-y-3 text-xs whitespace-normal overflow-x-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-indigo-500" />
                    Descuentos y Recargos
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {activeAdjustmentRules.length} activas
                  </span>
                </div>

                {activeAdjustmentRules.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 italic font-medium">
                    No hay reglas de descuento o recargo activas
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto overflow-x-hidden pr-1 whitespace-normal">
                    {activeAdjustmentRules.map((rule: any) => (
                      <POSItemCard
                        key={rule.id}
                        variant="indigo"
                        dotColor={rule.adjustmentType === 'DISCOUNT' ? 'emerald' : 'amber'}
                        title={formatPaymentMethodName(rule.paymentMethod)}
                        badge={
                          <span
                            className={`font-mono font-black text-[10px] px-1.5 py-0.5 rounded ${
                              rule.adjustmentType === 'DISCOUNT'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {rule.adjustmentType === 'DISCOUNT' ? 'Descuento -' : 'Recargo +'}
                            {rule.value}%
                          </span>
                        }
                        description={`Aplica automáticamente a ventas cobradas con ${formatPaymentMethodName(rule.paymentMethod)}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botón 2: Ofertas y Combos */}
          <div className="relative promotions-popover-container">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowActivePromotions(!showActivePromotions)}
              className="flex items-center gap-1 font-bold py-0.5 px-2 text-xs border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 hover:bg-amber-100 rounded-lg"
            >
              <Gift className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Ofertas y Combos</span>
              {totalOffersCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-black rounded-full bg-amber-500 text-white">
                  {totalOffersCount}
                </span>
              )}
            </Button>

            {showActivePromotions && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-3.5 space-y-3 text-xs whitespace-normal overflow-x-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-amber-500" />
                    Ofertas Comerciales
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    {totalOffersCount} activas
                  </span>
                </div>

                {totalOffersCount === 0 ? (
                  <div className="py-6 text-center text-slate-400 italic font-medium">
                    No hay ofertas comerciales activas
                  </div>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto overflow-x-hidden pr-1 whitespace-normal">
                    {/* SECCIÓN 1: Precios por Cantidad */}
                    {activePriceTiers.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3 text-indigo-500" />
                            Precios por Cantidad
                          </span>
                          <span className="text-[9px] font-bold opacity-75">({activePriceTiers.length})</span>
                        </div>
                        <div className="space-y-1.5">
                          {activePriceTiers.map((tier: ProductPriceTier) => (
                            <POSItemCard
                              key={tier.id}
                              variant="emerald"
                              dotColor="emerald"
                              title={tier.product?.name || 'Producto'}
                              code={tier.product?.sku || (tier.product as any)?.barcode}
                              badge={<span className="text-emerald-600 dark:text-emerald-400">🟢 Activo</span>}
                              description={
                                <div className="flex items-center justify-between text-[11px] pt-0.5">
                                  <span className="text-slate-500 font-medium">
                                    Compra mínima: <strong>{Number(tier.minQuantity)} unidades</strong>
                                  </span>
                                  <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                                    ${Number(tier.price).toLocaleString('es-AR')} c/u
                                  </span>
                                </div>
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SECCIÓN 2: Promociones y Combos */}
                    {activePromotions.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-500" />
                            Promociones y Combos
                          </span>
                          <span className="text-[9px] font-bold opacity-75">({activePromotions.length})</span>
                        </div>
                        <div className="space-y-1.5">
                          {activePromotions.map((promo: Promotion) => (
                            <POSItemCard
                              key={promo.id}
                              variant="amber"
                              dotColor="emerald"
                              title={promo.name}
                              badge={<span className="text-emerald-600 dark:text-emerald-400">🟢 Activo</span>}
                              description={
                                <div>
                                  {promo.type === 'TWO_FOR_ONE' && <span>Lleva {promo.minQuantity} unidades y paga 1</span>}
                                  {promo.type === 'SECOND_UNIT_DISCOUNT' && <span>Segunda unidad {promo.discountPercentage}% OFF</span>}
                                  {promo.type === 'SPECIAL_PACK' && <span>Pack de {promo.minQuantity} unidades por ${Number(promo.specialPrice).toLocaleString('es-AR')}</span>}
                                  {promo.product?.name && (
                                    <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                      Producto: {promo.product.name}
                                    </div>
                                  )}
                                </div>
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botón 3: Ayuda POS */}
          <div className="relative help-popover-container">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHelpPopover(!showHelpPopover)}
              className="flex items-center gap-1 font-bold py-0.5 px-2 text-xs border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 rounded-lg"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Ayuda</span>
            </Button>

            {showHelpPopover && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-3.5 space-y-3 text-xs whitespace-normal overflow-x-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-primary-500" />
                    Ayuda y Teclas Rápidas
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    POS System
                  </span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto overflow-x-hidden pr-1 whitespace-normal">
                  <POSItemCard
                    variant="slate"
                    dotColor="indigo"
                    title="Lector Láser de Código"
                    badge={<kbd className="font-mono bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[9px] font-bold">F2 / SCAN</kbd>}
                    description="Escribe o escanea directamente un código de barras para añadir productos al instante."
                  />
                  <POSItemCard
                    variant="slate"
                    dotColor="emerald"
                    title="Listas de Precios por Cliente"
                    badge={<span className="text-emerald-600 dark:text-emerald-400 font-extrabold">Auto</span>}
                    description="Al seleccionar un cliente, el POS aplica automáticamente su lista de precios predeterminada."
                  />
                  <POSItemCard
                    variant="slate"
                    dotColor="amber"
                    title="Descuentos y Medios de Pago"
                    badge={<span className="text-amber-600 dark:text-amber-400 font-extrabold">Reglas</span>}
                    description="El recargo o descuento configurado por medio de pago se calcula sobre el total final."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Volver a Ventas */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/sales')}
            className="font-bold text-xs py-0.5 px-2 text-slate-500 hover:text-slate-900 dark:hover:text-white"
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
            <div className="relative w-full flex items-center">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none z-10" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar por nombre, Código Interno o código de barras"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full h-11 pl-11 pr-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 shadow-sm transition-all font-medium"
              />
              {searchError && (
                <div className="absolute left-0 top-full mt-1 z-30 px-3 py-1 bg-rose-600 text-white font-bold text-xs rounded-lg shadow-lg flex items-center gap-1.5 animate-fadeIn">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{searchError}</span>
                </div>
              )}
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

          {/* BANNER INDICADOR VISUAL DE LISTA DE PRECIOS ACTIVA */}
          {activePriceList && (
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition-all shadow-sm ${
              !activePriceList.isDefault
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                : 'bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            }`}>
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  Lista activa: <strong className="font-extrabold text-slate-900 dark:text-white">{activePriceList.name}</strong>
                </span>
              </div>
              {!activePriceList.isDefault ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-200/80 text-amber-950 dark:bg-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-600 dark:bg-amber-400 animate-pulse" />
                  PRECIOS ESPECIALES APLICADOS
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Tarifa General Base
                </span>
              )}
            </div>
          )}

          {/* GRILLA DE TARJETAS DE PRODUCTO DENSAS Y MODERNIZADAS (ALTURA UNIFORME H-40) */}
          {loadingProducts ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, idx) => (
                <Skeleton key={idx} className="h-40 rounded-2xl" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              title="No se encontraron productos"
              description="Prueba cambiando los términos de búsqueda o selecciona otra categoría."
              icon={Search}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {filteredProducts.map((product: any) => {
                const isGlobalAllowWithoutStock = Boolean(
                  (posSettingsRes as any)?.allowNegativeStock || (posSettingsRes as any)?.allowSaleWithoutStock
                );
                const canSellThisProduct = isGlobalAllowWithoutStock || Boolean(product?.allowSaleWithoutStock);

                const stockNum = getProductStock(product, selectedWarehouseId);
                const isOutOfStock = stockNum <= 0 && !canSellThisProduct;
                const isLowStock = stockNum > 0 && stockNum <= 5;
                const effectivePrice = getEffectiveProductPrice(product, selectedPriceListId, 1);
                const basePrice = Number(product.salePrice || 0);
                const isSpecialPrice = effectivePrice !== basePrice;

                // Prioridad de código: código de barras -> SKU -> ID interno
                const displayCode = product.barcode || product.sku || product.id || 'N/A';

                return (
                  <div
                    key={product.id}
                    onClick={() => {
                      if (!isOutOfStock) {
                        addToCart(product);
                        setTimeout(() => searchInputRef.current?.focus(), 50);
                      }
                    }}
                    className={`group relative h-40 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 ease-in-out flex flex-col justify-between select-none ${
                      isOutOfStock
                        ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50'
                        : 'cursor-pointer border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md hover:shadow-primary-500/10 hover:-translate-y-1 hover:border-primary-500/80 dark:hover:border-primary-500/80 active:scale-[0.98]'
                    }`}
                  >
                    {/* ENCABEZADO DE 2 FILAS: FILA 1 (STOCK A LA DERECHA) + FILA 2 (CÓDIGO EN FILA COMPLETA) */}
                    <div className="space-y-1 w-full min-w-0">
                      {/* FILA 1: BADGE DE STOCK ALINEADO A LA DERECHA */}
                      <div className="flex justify-end w-full">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 whitespace-nowrap ${
                            isOutOfStock
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                              : stockNum <= 0 && canSellThisProduct
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : isLowStock
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isOutOfStock
                                ? 'bg-rose-500'
                                : stockNum <= 0 && canSellThisProduct
                                ? 'bg-amber-500'
                                : isLowStock
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                          {stockNum <= 0
                            ? (canSellThisProduct ? `Stock: ${stockNum}` : 'Sin stock')
                            : `Stock: ${stockNum}`}
                        </span>
                      </div>

                      {/* FILA 2: CÓDIGO DE BARRAS / SKU EN FILA COMPLETA */}
                      <div className="w-full min-w-0">
                        <span className="block font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate w-full" title={displayCode}>
                          {displayCode}
                        </span>
                      </div>
                    </div>

                    {/* CUERPO CENTRAL: NOMBRE DEL PRODUCTO (ELEMENTO PRINCIPAL) */}
                    <div className="my-auto">
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-[13px] line-clamp-2 leading-snug tracking-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {product.name}
                      </h4>
                    </div>

                    {/* PIE DE TARJETA: PRECIO DESTACADO (SIN BOTÓN PLUS REDUNDANTE) */}
                    <div className="flex items-end justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex flex-col w-full">
                        {isSpecialPrice && (
                          <span className="text-[10px] font-mono text-slate-400 line-through leading-tight">
                            {formatCurrency(basePrice)}
                          </span>
                        )}
                        <span
                          className={`font-mono text-base sm:text-lg font-black tracking-tight leading-none ${
                            isSpecialPrice
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-primary-600 dark:text-primary-400'
                          }`}
                        >
                          {formatCurrency(effectivePrice)}
                        </span>
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
                    onClick={handleSuspendSale}
                    className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-colors"
                    title="Suspender venta actual"
                  >
                    <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Suspender</span>
                  </button>
                )}
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
                cart.map((item) => {
                  const isKg = isKgProduct(item.product);
                  const step = isKg ? 0.100 : 1;

                  return (
                    <div
                      key={item.product.id}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-slate-900 dark:text-white line-clamp-1">
                          {item.product.name}
                        </span>
                        <span className="font-mono font-black text-slate-900 dark:text-white shrink-0">
                          {formatCurrency(Number(item.product.salePrice) * item.quantity)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-0.5">
                        {editingQtyProductId === item.product.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, isKg ? Math.round((item.quantity - step) * 1000) / 1000 : item.quantity - 1)}
                              className="w-5 h-5 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                              title={isKg ? "Reducir 0.100 kg" : "Reducir 1 unidad"}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={isKg ? "0.001" : "1"}
                              step={isKg ? "0.001" : "1"}
                              autoFocus
                              value={editingQtyInput}
                              onChange={(e) => setEditingQtyInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  confirmQtyEdit(item.product.id, item.product);
                                } else if (e.key === 'Escape') {
                                  cancelQtyEdit();
                                }
                              }}
                              onBlur={() => confirmQtyEdit(item.product.id, item.product)}
                              className="w-16 text-center font-mono font-bold text-xs bg-white dark:bg-slate-900 border-2 border-primary-500 rounded px-1 py-0.5 text-slate-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                            />
                            {isKg && <span className="text-[10px] font-extrabold text-slate-500">kg</span>}
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => confirmQtyEdit(item.product.id, item.product)}
                              className="px-2 py-0.5 text-[10px] font-black rounded bg-primary-600 hover:bg-primary-700 text-white shadow transition-colors shrink-0"
                            >
                              Aceptar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div className="inline-flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shadow-sm">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product.id, isKg ? Math.round((item.quantity - step) * 1000) / 1000 : item.quantity - 1)}
                                className="w-5 h-5 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                title={isKg ? "Reducir 0.100 kg" : "Reducir 1 unidad"}
                              >
                                -
                              </button>
                              <button
                                type="button"
                                onClick={() => startQtyEdit(item.product.id, item.quantity, item.product)}
                                className="px-2 h-5 flex items-center justify-center font-mono font-bold text-xs text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors gap-0.5"
                                title="Haz clic para ingresar cantidad deseada"
                              >
                                <span>{isKg ? item.quantity.toFixed(3) : item.quantity}</span>
                                {isKg && <span className="text-[10px] font-bold text-slate-500">kg</span>}
                              </button>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product.id, isKg ? Math.round((item.quantity + step) * 1000) / 1000 : item.quantity + 1)}
                                className="w-5 h-5 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                title={isKg ? "Aumentar 0.100 kg" : "Aumentar 1 unidad"}
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFromCart(item.product.id)}
                              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors shrink-0"
                              title="Eliminar del carrito"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatCurrency(item.product.salePrice)} {isKg ? '/kg' : 'c/u'}
                        </span>
                      </div>
                    </div>
                  );
                })
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

              {/* Tarjeta de Fidelización Ampliada en Carrito */}
              {selectedCustomer && loyaltyBalance && loyaltyBalance.enabled && !loyaltyBalance.excludeFromLoyalty && (
                <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl space-y-2 text-xs shadow-sm animate-fadeIn">
                  <div className="flex items-center justify-between font-bold border-b border-amber-200/30 dark:border-amber-800/20 pb-1.5">
                    <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-black">
                      ⭐ Programa de Fidelización
                    </span>
                  </div>

                  <div className="space-y-1.5 font-medium text-slate-700 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Puntos disponibles:</span>
                      <span className="font-mono font-bold text-slate-950 dark:text-slate-100">{loyaltyBalance.pointsBalance} pts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Equivalencia monetaria:</span>
                      <span className="font-mono font-bold text-slate-950 dark:text-slate-100">{formatCurrency(loyaltyBalance.pointsBalance * loyaltyBalance.pointValue)}</span>
                    </div>
                    
                    {earnedPointsPreview > 0 && (
                      <div className="flex justify-between pt-1 border-t border-amber-200/30 dark:border-amber-800/20 text-emerald-700 dark:text-emerald-400 font-bold">
                        <span>Puntos estimados a obtener:</span>
                        <span className="font-mono font-black">+{earnedPointsPreview} pts</span>
                      </div>
                    )}
                    {earnedPointsPreview > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-555 text-[11px] pl-2">
                        <span>Valor estimado de puntos:</span>
                        <span className="font-mono">+{formatCurrency(earnedPointsPreview * loyaltyBalance.pointValue)}</span>
                      </div>
                    )}

                    {/* Detalles extendidos del canje aplicado */}
                    {appliedPointsRedeemed > 0 && (
                      <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800/40 space-y-1.5 text-[11px] bg-amber-50/80 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-100 dark:border-amber-900/30">
                        <div className="font-extrabold text-amber-950 dark:text-amber-300">Canje Aplicado:</div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Puntos utilizados:</span>
                          <span className="font-mono font-bold text-rose-600">-{appliedPointsRedeemed} pts</span>
                        </div>
                        <div className="flex justify-between font-bold text-rose-600">
                          <span>Descuento aplicado:</span>
                          <span className="font-mono">-{formatCurrency(pointsDiscountAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Saldo estimado tras venta:</span>
                          <span className="font-mono font-bold">{Math.max(0, loyaltyBalance.pointsBalance - appliedPointsRedeemed)} pts</span>
                        </div>
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                          <span>Puntos que volverá a obtener:</span>
                          <span className="font-mono font-bold">+{earnedPointsPreview} pts</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-amber-200/50 dark:border-amber-800/30 font-black text-slate-900 dark:text-white">
                          <span>Saldo final estimado:</span>
                          <span className="font-mono">{Math.max(0, loyaltyBalance.pointsBalance - appliedPointsRedeemed) + earnedPointsPreview} pts</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                {isAutoRoundingActive && roundingAdjustmentAmount !== 0 && (
                  <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-semibold">
                    <span>Redondeo automático:</span>
                    <span className="font-mono">
                      {roundingAdjustmentAmount > 0 ? '+' : ''}
                      {formatCurrency(roundingAdjustmentAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span>TOTAL COBRAR:</span>
                  <span className="font-mono text-primary-600 dark:text-primary-400">
                    {formatCurrency(roundedFinalTotal)}
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
                    <CreditCard className="w-4 h-4" /> COBRAR {formatCurrency(roundedFinalTotal)}
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

          {/* MÓDULO DE CANJE DE PUNTOS */}
          {selectedCustomer && loyaltyBalance && loyaltyBalance.enabled && !loyaltyBalance.excludeFromLoyalty && (
            <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-800/30 rounded-xl space-y-3 animate-fadeIn">
              <div className="flex items-center gap-1.5 font-extrabold text-amber-800 dark:text-amber-300 text-xs">
                <Award className="w-4 h-4 text-amber-500" />
                <span>PROGRAMA DE FIDELIZACIÓN</span>
              </div>
              
              {loyaltyBalance.pointsBalance > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      placeholder={`Max ${Math.min(loyaltyBalance.pointsBalance, Math.floor((cartTotal * (loyaltyBalance.maxRedemptionPercentage || 50) / 100) / loyaltyBalance.pointValue))} pts`}
                      value={pointsToRedeemInput}
                      onChange={(e) => {
                        setPointsToRedeemInput(e.target.value);
                        setPointsPreviewError(null);
                      }}
                      className="w-full text-xs font-mono font-bold py-1.5 px-2.5 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-1 focus:ring-amber-500 bg-white dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleApplyPointsRedeem}
                    disabled={isPreviewLoading || !pointsToRedeemInput}
                  >
                    {isPreviewLoading ? 'Cotizando...' : 'Aplicar'}
                  </Button>
                  {appliedPointsRedeemed > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-rose-600 hover:text-rose-700"
                      onClick={handleRemovePointsRedeem}
                    >
                      Quitar
                    </Button>
                  )}
                </div>
              )}

              {pointsPreviewError && (
                <div className="text-[11px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-800">
                  {pointsPreviewError}
                </div>
              )}

              <div className="mt-2.5 pt-2.5 border-t border-amber-200/50 dark:border-amber-800/30 space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Puntos disponibles:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{loyaltyBalance.pointsBalance} pts</span>
                </div>
                
                {appliedPointsRedeemed > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold">
                    <span>Canje aplicado:</span>
                    <span className="font-mono">-{appliedPointsRedeemed} pts (-{formatCurrency(pointsDiscountAmount)})</span>
                  </div>
                )}
                
                {earnedPointsPreview > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>Ganará con esta compra:</span>
                    <span className="font-mono">+{earnedPointsPreview} pts</span>
                  </div>
                )}
                
                <div className="flex justify-between pt-1.5 border-t border-amber-200/30 dark:border-amber-800/20 font-black text-slate-900 dark:text-white">
                  <span>Saldo estimado luego de la venta:</span>
                  <span className="font-mono">{Math.max(0, loyaltyBalance.pointsBalance - appliedPointsRedeemed)} pts</span>
                </div>
              </div>
            </div>
          )}

          {/* MÓDULO DE EFECTIVO RECIBIDO Y VUELTO */}
          {paymentMethod === 'CASH' && (
            <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl space-y-3 animate-fadeIn">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-emerald-600" /> EFECTIVO RECIBIDO
                </label>
                <button
                  type="button"
                  onClick={() => setCashReceivedInput(String(Math.max(0, roundedFinalTotal - pointsDiscountAmount)))}
                  className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Importe exacto
                </button>
              </div>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={cashReceivedInput}
                  onChange={(e) => setCashReceivedInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-lg font-mono font-black border-2 border-emerald-300 dark:border-emerald-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              {/* Botones rápidos de billetes */}
              <div className="grid grid-cols-4 gap-1.5">
                {[1000, 2000, 5000, 10000, 20000, 50000, 100000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      const current = parseFloat(cashReceivedInput) || 0;
                      setCashReceivedInput(String(current + amt));
                    }}
                    className="py-1 px-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
                  >
                    +${amt >= 1000 ? `${amt / 1000}k` : amt}
                  </button>
                ))}
              </div>

              {/* VUELTO O FALTA COBRAR */}
              {(() => {
                const finalToPay = Math.max(0, roundedFinalTotal - pointsDiscountAmount);
                const received = parseFloat(cashReceivedInput) || 0;
                const diff = received - finalToPay;

                if (received <= 0) return null;

                if (diff < -0.01) {
                  return (
                    <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between text-rose-800 dark:text-rose-200">
                      <span className="text-xs font-black uppercase">Falta Cobrar:</span>
                      <span className="text-base font-black font-mono">
                        $ {Math.abs(diff).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                } else {
                  return (
                    <div className="p-3 bg-emerald-600 text-white rounded-xl flex items-center justify-between shadow-sm">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider block opacity-90">
                          Vuelto a Entregar
                        </span>
                        <span className="text-xl font-black font-mono">
                          $ {diff.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <Check className="w-7 h-7 text-emerald-200 stroke-[3]" />
                    </div>
                  );
                }
              })()}
            </div>
          )}

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

            {isAutoRoundingActive && roundingAdjustmentAmount !== 0 && (
              <div className="flex justify-between font-bold text-indigo-600 dark:text-indigo-400">
                <span>Redondeo automático:</span>
                <span className="font-mono">
                  {roundingAdjustmentAmount > 0 ? '+' : ''}
                  {formatCurrency(roundingAdjustmentAmount)}
                </span>
              </div>
            )}

            {appliedPointsRedeemed > 0 && pointsDiscountAmount > 0 && (
              <div className="flex justify-between font-bold text-rose-600">
                <span>Descuento por Puntos:</span>
                <span className="font-mono">-{formatCurrency(pointsDiscountAmount)}</span>
              </div>
            )}

            <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 flex justify-between font-black text-slate-900 dark:text-white text-sm">
              <span>TOTAL FINAL A COBRAR:</span>
              <span className="font-mono text-primary-600 dark:text-primary-400">
                {formatCurrency(Math.max(0, roundedFinalTotal - pointsDiscountAmount))}
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

      {/* 4.5. MODAL DE VENTAS SUSPENDIDAS */}
      <Modal
        isOpen={isSuspendedModalOpen}
        onClose={() => setIsSuspendedModalOpen(false)}
        title="Ventas Suspendidas / Pendientes"
        size="lg"
      >
        <div className="space-y-4 pt-1">
          {suspendedSalesList.length === 0 ? (
            <EmptyState
              title="No hay ventas suspendidas"
              description="No existen operaciones guardadas temporalmente para este negocio."
              icon={PauseCircle}
            />
          ) : (
            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
              {suspendedSalesList.map((sale: any) => (
                <div
                  key={sale.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-400 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 dark:text-white text-base">
                        Venta pendiente #{sale.documentNumber || sale.id.substring(0, 8)}
                      </span>
                      <Badge variant="warning" size="sm">PENDIENTE</Badge>
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {sale.customer?.name || 'Consumidor Final'}
                      </span>
                      <span className="flex items-center gap-1">
                        <ShoppingCart className="w-3.5 h-3.5 text-slate-400" />
                        {sale.items?.length || 0} productos
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(sale.createdAt).toLocaleDateString('es-AR')})
                      </span>
                      <span className="text-slate-400">
                        Cajero: {sale.createdBy?.name || 'Usuario'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
                      <span className="text-lg font-black text-amber-600 font-mono">
                        {formatCurrency(sale.totalAmount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteSuspended(sale.id, sale.documentNumber)}
                        className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950 font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Eliminar
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleRecoverSuspended(sale.id)}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Recuperar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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

          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            <POSItemCard
              variant="slate"
              dotColor="slate"
              selected={!selectedCustomer}
              onClick={() => {
                setSelectedCustomer(null);
                setIsCustomerModalOpen(false);
              }}
              title="CONSUMIDOR FINAL"
              badge={!selectedCustomer ? <Check className="w-4 h-4 text-emerald-500" /> : undefined}
              description="Venta genérica sin datos de cliente registrados."
            />

            {filteredPOSCustomers.map((c) => (
              <POSItemCard
                key={c.id}
                variant="emerald"
                dotColor="emerald"
                selected={selectedCustomer?.id === c.id}
                onClick={() => {
                  setSelectedCustomer(c);
                  setIsCustomerModalOpen(false);
                }}
                title={c.name}
                badge={
                  c.defaultPriceList?.name ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200">
                      <Tag className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                      {c.defaultPriceList.name}
                    </span>
                  ) : selectedCustomer?.id === c.id ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : undefined
                }
                code={c.document || '-'}
              />
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
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Seleccionar Caja / Terminal
              </label>
              {cashRegisters.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No hay cajas configuradas en la empresa.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {cashRegisters.map((reg: any) => (
                    <POSItemCard
                      key={reg.id}
                      variant={reg.isOpen ? 'amber' : 'emerald'}
                      dotColor={reg.isOpen ? 'amber' : 'emerald'}
                      selected={selectedCashRegisterId === reg.id}
                      onClick={() => setSelectedCashRegisterId(reg.id)}
                      title={`${reg.name} (${reg.code})`}
                      badge={
                        reg.isOpen ? (
                          <span className="text-amber-600 dark:text-amber-400 font-extrabold">⚠️ Ya Abierta</span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">🟢 Disponible</span>
                        )
                      }
                      description={reg.isOpen ? 'Esta caja posee un turno activo. Puedes ingresar para operar.' : 'Caja disponible para iniciar turno.'}
                    />
                  ))}
                </div>
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
                    warehouseId: selectedWarehouseId,
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

      {/* Modal de Confirmación de Cambio de Lista de Precios */}
      <Modal
        isOpen={isPriceListModalOpen}
        onClose={cancelPriceListChange}
        title="Recalcular Carrito por Cambio de Lista"
      >
        <div className="space-y-4 py-2">
          <POSItemCard
            variant="amber"
            dotColor="amber"
            title="Actualización de Precios del Carrito"
            badge={<span className="text-amber-600 dark:text-amber-400 font-extrabold">⚠️ Requerido</span>}
            description="Los precios unitarios de los productos actualmente agregados al carrito serán recalculados automáticamente aplicando las tarifas de la nueva lista seleccionada."
          />

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={cancelPriceListChange}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={confirmPriceListChange}>
              Actualizar Precios
            </Button>
          </div>
        </div>
      </Modal>

      {loyaltyToast && loyaltyToast.show && (
        <div className="fixed bottom-4 right-4 z-[9999] w-80 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-2xl shadow-2xl border border-slate-800 dark:border-slate-200 p-4.5 space-y-3 animate-slideIn">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-black text-xs text-amber-400">
              <Award className="w-5 h-5 text-amber-500 fill-amber-500" /> PROGRAMA DE FIDELIZACIÓN
            </span>
            <button
              onClick={() => setLoyaltyToast(null)}
              className="text-slate-400 hover:text-white dark:text-slate-500 dark:hover:text-slate-900 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-2 text-xs font-semibold">
            {loyaltyToast.pointsRedeemed > 0 && (
              <div className="flex justify-between border-b border-slate-800 dark:border-slate-100 pb-1.5">
                <span className="text-slate-400 dark:text-slate-500">Canjeaste:</span>
                <span className="font-mono font-black text-rose-450 dark:text-rose-600">
                  {loyaltyToast.pointsRedeemed} pts (-{formatCurrency(loyaltyToast.pointsDiscountAmount)})
                </span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-slate-400 dark:text-slate-500">Ganaste:</span>
              <span className="font-mono font-black text-emerald-400 dark:text-emerald-600">
                +{loyaltyToast.pointsEarned} pts
              </span>
            </div>
            
            <div className="flex justify-between pt-1.5 border-t border-slate-800 dark:border-slate-100 font-black text-sm">
              <span>Nuevo saldo:</span>
              <span className="font-mono text-amber-400 dark:text-amber-600">
                {loyaltyToast.newBalance} pts
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
