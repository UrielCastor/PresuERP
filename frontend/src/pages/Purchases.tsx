import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { swalSuccess, swalWarning, swalInfo, swalConfirm, handleApiError } from '../utils/swal';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Plus, Edit2, Trash2, Search, X, Loader2, ShoppingCart,
  Eye, ThumbsUp, RotateCcw, FileText, AlertTriangle, Info, ClipboardList,
  User, Warehouse, DollarSign, Activity, CreditCard, Clock,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getInitialWarehouseId } from '../utils/warehouse';
import { purchaseApi, Purchase, PurchaseItem, OtherTax } from '../services/purchase.service';
import { supplierApi } from '../services/supplier.service';
import { warehouseApi } from '../services/warehouse.service';
import { productApi } from '../services/product.service';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { HelpTooltip } from '../components/ui/HelpTooltip';

// ─── Zod Schemas ───────────────────────────────────────────────────────────
const purchaseItemSchema = z.object({
  productId: z.string().min(1, 'Selecciona un producto'),
  quantity: z.number({ invalid_type_error: 'Debe ser un número' }).positive('Debe ser mayor a 0'),
  unitCost: z.number({ invalid_type_error: 'Debe ser un número' }).nonnegative('No puede ser negativo'),
  discount: z.number({ invalid_type_error: 'Debe ser un número' }).nonnegative().default(0),
});

const otherTaxSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  percentage: z.number({ invalid_type_error: 'Debe ser un número' }).nonnegative().default(0),
  amount: z.number({ invalid_type_error: 'Debe ser un número' }).nonnegative('No puede ser negativo').default(0),
  description: z.string().optional().nullable().or(z.literal('')),
});

const purchaseFormSchema = z.object({
  supplierId: z.string().min(1, 'El proveedor es requerido'),
  warehouseId: z.string().min(1, 'El depósito es requerido'),
  documentType: z.string().min(1, 'El tipo de comprobante es requerido'),
  documentNumber: z.string().optional().nullable().or(z.literal('')),
  expectedDate: z.string().optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable().or(z.literal('')),
  hasInvoiceTaxes: z.boolean().default(false),
  vatRate: z.number({ invalid_type_error: 'Debe ser un número' }).nonnegative().default(21),
  vatAmount: z.number({ invalid_type_error: 'Debe ser un número' }).nonnegative().default(0),
  otherTaxes: z.array(otherTaxSchema).default([]),
  discount: z.number({ invalid_type_error: 'Debe ser un número' }).nonnegative().default(0),
  invoicedTotal: z.number({ invalid_type_error: 'Debe ser un número' }).nonnegative().optional().nullable(),
  items: z.array(purchaseItemSchema).min(1, 'Debes agregar al menos un producto'),
});

type PurchaseFormData = z.infer<typeof purchaseFormSchema>;

// ─── Component ─────────────────────────────────────────────────────────────
export const Purchases: React.FC = () => {
  const { hasPermission, hasCapability, user } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [page, setPage] = useState(1);

  const [queryTriggered, setQueryTriggered] = useState(false);
  const [isLast10Mode, setIsLast10Mode] = useState(false);

  const hasActiveFilters = !!(
    searchTerm.trim() ||
    statusFilter ||
    paymentFilter ||
    supplierFilter ||
    warehouseFilter ||
    startDateFilter ||
    endDateFilter
  );

  React.useEffect(() => {
    if (hasActiveFilters) {
      setQueryTriggered(true);
      setIsLast10Mode(false);
    }
  }, [hasActiveFilters]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Purchase | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const [showForceDialog, setShowForceDialog] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<PurchaseFormData | null>(null);

  const [selectedProductToAdd, setSelectedProductToAdd] = useState('');
  const [qtyToAdd, setQtyToAdd] = useState<number | string>(1);
  const [costToAdd, setCostToAdd] = useState<number | string>('');
  const [discToAdd, setDiscToAdd] = useState<number | string>('');
  const [searchVal, setSearchVal] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const canRead = hasCapability('purchases.view') || hasPermission('purchases:read');
  const canCreate = hasCapability('purchases.create') || hasPermission('purchases:create');
  const canUpdate = hasCapability('purchases.update') || hasPermission('purchases:update');
  const canApprove = hasCapability('purchases.approve') || hasPermission('purchases:approve');
  const canCancel = hasCapability('purchases.cancel') || hasPermission('purchases:cancel');
  const canDelete = hasCapability('purchases.delete') || canCancel;
  const canEditPrices = hasCapability('purchases.edit_prices') || canUpdate;
  const canEditSupplier = hasCapability('purchases.edit_supplier') || canUpdate;
  const canEditItems = hasCapability('purchases.edit_items') || canUpdate;
  const canEditDiscount = hasCapability('purchases.edit_discount') || canUpdate;

  const {
    register, handleSubmit, control, reset, watch, setValue,
    formState: { errors, isSubmitting }
  } = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      supplierId: '', warehouseId: '', documentType: 'FACTURA',
      documentNumber: '', expectedDate: '', notes: '',
      hasInvoiceTaxes: false, vatRate: 21, vatAmount: 0, otherTaxes: [],
      discount: 0, invoicedTotal: undefined, items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const { fields: otherTaxFields, append: appendTax, remove: removeTax } = useFieldArray({
    control, name: 'otherTaxes',
  });

  const watchedItems = watch('items') || [];
  const watchedHasTaxes = watch('hasInvoiceTaxes');
  const watchedVat = watch('vatAmount') || 0;
  const watchedVatRate = watch('vatRate') || 21;
  const watchedOtherTaxes = watch('otherTaxes') || [];
  const watchedInvoicedTotal = watch('invoicedTotal');
  const watchedDiscount = watch('discount') || 0;

  const subtotal = watchedItems.reduce((acc, item) => {
    return acc + ((Number(item.quantity) || 0) * (Number(item.unitCost) || 0) - (Number(item.discount) || 0));
  }, 0);
  const otherTaxesSum = watchedOtherTaxes.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const vatVal = watchedHasTaxes ? (Number(watchedVat) || 0) : 0;
  const otherTaxesVal = watchedHasTaxes ? otherTaxesSum : 0;
  const discountVal = Number(watchedDiscount) || 0;
  const total = subtotal + vatVal + otherTaxesVal - discountVal;

  const invoicedTotalNum = watchedInvoicedTotal ? Number(watchedInvoicedTotal) : null;
  const hasDifference = invoicedTotalNum !== null && Math.abs(invoicedTotalNum - total) > 0.05;
  const difference = invoicedTotalNum !== null ? invoicedTotalNum - total : 0;

  const prevSubtotalRef = React.useRef(subtotal);
  const prevVatRateRef = React.useRef(watchedVatRate);

  React.useEffect(() => {
    if (watchedHasTaxes && (subtotal !== prevSubtotalRef.current || watchedVatRate !== prevVatRateRef.current)) {
      const calculatedVat = Math.round(subtotal * (Number(watchedVatRate) || 0) / 100 * 100) / 100;
      setValue('vatAmount', calculatedVat);
      prevSubtotalRef.current = subtotal;
      prevVatRateRef.current = watchedVatRate;
    }
  }, [subtotal, watchedVatRate, watchedHasTaxes, setValue]);

  const { data: purchasesData, isLoading: loadingPurchases } = useQuery({
    queryKey: ['purchases', searchTerm, statusFilter, paymentFilter, supplierFilter, warehouseFilter, startDateFilter, endDateFilter, page, isLast10Mode, queryTriggered],
    queryFn: () => purchaseApi.list({
      search: searchTerm || undefined, status: statusFilter || undefined,
      paymentStatus: paymentFilter || undefined, supplierId: supplierFilter || undefined,
      warehouseId: warehouseFilter || undefined, startDate: startDateFilter || undefined,
      endDate: endDateFilter || undefined, page: isLast10Mode ? 1 : page, limit: 10,
      orderByCreatedAtDesc: isLast10Mode ? true : undefined,
    }),
    enabled: queryTriggered,
  });

  const { data: kpiPurchasesData } = useQuery({
    queryKey: ['purchases', 'kpi', searchTerm, paymentFilter, supplierFilter, warehouseFilter, startDateFilter, endDateFilter],
    queryFn: () => purchaseApi.list({
      search: searchTerm || undefined,
      paymentStatus: paymentFilter || undefined, supplierId: supplierFilter || undefined,
      warehouseId: warehouseFilter || undefined, startDate: startDateFilter || undefined,
      endDate: endDateFilter || undefined, limit: 2000,
    }),
  });
  const kpiPurchases = kpiPurchasesData?.data || [];

  const { data: detailPurchase, isLoading: loadingDetailData } = useQuery({
    queryKey: ['purchaseDetail', selectedPurchaseId],
    queryFn: () => purchaseApi.getOne(selectedPurchaseId!),
    enabled: !!selectedPurchaseId,
  });

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliersListAll'], queryFn: supplierApi.list });
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehousesListAll'], queryFn: warehouseApi.list });
  const watchedSupplierId = watch('supplierId');
  const { data: products = [] } = useQuery({
    queryKey: ['productsListAll', watchedSupplierId],
    queryFn: () => productApi.list(watchedSupplierId || undefined),
    enabled: !!watchedSupplierId,
  });

  // --- Buscador Inteligente & Filtro por Proveedor en Compras ---
  const supplierProducts = React.useMemo(() => {
    if (!watchedSupplierId) return [];
    return (products as any[]).filter(p => {
      if (p.suppliers && Array.isArray(p.suppliers) && p.suppliers.length > 0) {
        return p.suppliers.some((s: any) => s.id === watchedSupplierId);
      }
      if (p.productSuppliers && Array.isArray(p.productSuppliers) && p.productSuppliers.length > 0) {
        return p.productSuppliers.some((ps: any) => ps.supplierId === watchedSupplierId);
      }
      return p.supplierId === watchedSupplierId;
    });
  }, [products, watchedSupplierId]);

  const filteredProducts = React.useMemo(() => {
    if (!searchVal.trim()) return supplierProducts;
    const query = searchVal.trim().toLowerCase();
    return supplierProducts.filter(p => {
      return (
        p.name?.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.barcode && p.barcode.toLowerCase().includes(query)) ||
        (p.description && p.description.toLowerCase().includes(query))
      );
    });
  }, [supplierProducts, searchVal]);

  const selectProduct = (prod: any) => {
    const isAdded = watchedItems.some(i => i.productId === prod.id);
    if (isAdded) {
      swalWarning('Producto Ya Agregado', 'Este producto ya se encuentra en el detalle de la compra.');
      return;
    }
    const cost = Number(prod.purchasePrice) || 0;
    append({ productId: prod.id, quantity: 1, unitCost: cost, discount: 0 });
    setSearchVal('');
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setFocusedIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : filteredProducts.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cleanQuery = searchVal.trim().toLowerCase();
      if (!cleanQuery) return;

      // 1. Coincidencia exacta por código de barras, código interno o id
      let targetProduct = supplierProducts.find(
        (p: any) =>
          (p.barcode && p.barcode.trim().toLowerCase() === cleanQuery) ||
          (p.sku && p.sku.trim().toLowerCase() === cleanQuery) ||
          (p.id && p.id.trim().toLowerCase() === cleanQuery)
      );

      // 2. Elemento seleccionado con flechas en la lista
      if (!targetProduct && focusedIndex >= 0 && focusedIndex < filteredProducts.length) {
        targetProduct = filteredProducts[focusedIndex];
      }

      // 3. Coincidencia única en el filtro por nombre
      if (!targetProduct && filteredProducts.length === 1) {
        targetProduct = filteredProducts[0];
      }

      if (targetProduct) {
        selectProduct(targetProduct);
      } else {
        swalWarning('Producto No Encontrado', 'Producto no encontrado para el proveedor seleccionado');
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setFocusedIndex(-1);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      setIsOpen(false);
    }, 250);
  };

  React.useEffect(() => {
    setSearchVal('');
    setSelectedProductToAdd('');
    setQtyToAdd(1);
    setCostToAdd(0);
    setDiscToAdd(0);
    setIsOpen(false);
    setFocusedIndex(-1);
  }, [watchedSupplierId]);

  const createMutation = useMutation({
    mutationFn: purchaseApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchases'] }); handleCloseForm(); swalSuccess('Compra Registrada', 'La orden de compra ha sido creada con éxito.'); },
    onError: (err: any) => setApiError(err.response?.data?.message || 'Error al crear la orden de compra'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => purchaseApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchases'] }); handleCloseForm(); swalSuccess('Compra Actualizada', 'Los cambios en la orden de compra han sido guardados.'); },
    onError: (err: any) => setApiError(err.response?.data?.message || 'Error al actualizar la compra'),
  });
  const submitForApprovalMutation = useMutation({
    mutationFn: purchaseApi.submitForApproval,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseDetail', selectedPurchaseId] });
      swalSuccess('Enviada a Aprobación', 'La orden de compra ha sido enviada a aprobación.');
    },
    onError: (err: any) => handleApiError(err, 'Error al Enviar a Aprobación'),
  });
  const rejectMutation = useMutation({
    mutationFn: purchaseApi.reject,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseDetail', selectedPurchaseId] });
      swalInfo('Devuelta a Borrador', 'La compra ha sido devuelta a estado Borrador.');
    },
    onError: (err: any) => handleApiError(err, 'Error al Rechazar Compra'),
  });
  const approveMutation = useMutation({
    mutationFn: purchaseApi.approve,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseDetail', selectedPurchaseId] });
      swalSuccess('Compra Aprobada', 'La compra fue aprobada. Mercadería pendiente de recepción.');
    },
    onError: (err: any) => handleApiError(err, 'Error al Aprobar Compra'),
  });
  const receiveMutation = useMutation({
    mutationFn: purchaseApi.receive,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseDetail', selectedPurchaseId] });
      swalSuccess('Mercadería Recibida', 'Stock ingresado correctamente al depósito.');
    },
    onError: (err: any) => handleApiError(err, 'Error al Recibir Mercadería'),
  });
  const cancelMutation = useMutation({
    mutationFn: purchaseApi.cancel,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseDetail', selectedPurchaseId] });
      setCancelTarget(null);
      swalSuccess('Compra Cancelada', 'La orden de compra ha sido cancelada.');
    },
    onError: (err: any) => { handleApiError(err, 'Error al Cancelar'); setCancelTarget(null); },
  });

  const handleOpenCreateForm = () => {
    setEditingPurchase(null); setApiError(null);
    reset({
      supplierId: '', warehouseId: getInitialWarehouseId(user, warehouses as any[]) || (warehouses as any[]).find(w => w.isMain)?.id || '',
      documentType: 'FACTURA', documentNumber: '', expectedDate: '', notes: '',
      hasInvoiceTaxes: false, vatRate: 21, vatAmount: 0, otherTaxes: [], 
      discount: 0, invoicedTotal: undefined, items: [],
    });
    setIsFormOpen(true);
  };

  const handleOpenEditForm = async (purchase: Purchase) => {
    setApiError(null);
    setIsLoadingDetail(true);
    try {
      const full = await purchaseApi.getOne(purchase.id);
      if (full.status !== 'DRAFT') {
        swalWarning('Sin Modificaciones', 'La orden de compra ya no admite modificaciones.');
        return;
      }
      setEditingPurchase(full);
      let parsedOtherTaxes: OtherTax[] = [];
      try { parsedOtherTaxes = full.otherTaxes ? JSON.parse(full.otherTaxes) : []; } catch {}
      reset({
        supplierId: full.supplierId, warehouseId: full.warehouseId,
        documentType: full.documentType, documentNumber: full.documentNumber || '',
        expectedDate: full.expectedDate ? new Date(full.expectedDate).toISOString().split('T')[0] : '',
        notes: full.notes || '',
        hasInvoiceTaxes: full.hasInvoiceTaxes ?? false,
        vatRate: Number(full.vatRate) || 21,
        vatAmount: Number(full.vatAmount) || 0,
        otherTaxes: parsedOtherTaxes,
        discount: Number(full.discount) || 0,
        invoicedTotal: full.invoicedTotal ? Number(full.invoicedTotal) : undefined,
        items: full.items.map((i: any) => ({
          productId: i.productId, quantity: Number(i.quantity),
          unitCost: Number(i.unitCost), discount: Number(i.discount),
        })),
      });
      setIsFormOpen(true);
    } catch (err: any) {
      handleApiError(err, 'Error al Cargar Detalle');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleCloseForm = () => { 
    setIsFormOpen(false); 
    setEditingPurchase(null); 
    setApiError(null); 
    setShowForceDialog(false);
    setPendingFormData(null);
    reset(); 
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedPurchaseId(null);
  };

  const sendSubmit = (formData: PurchaseFormData, forceDifference: boolean) => {
    const payload = {
      ...formData,
      documentNumber: formData.documentNumber || null,
      expectedDate: formData.expectedDate || null,
      notes: formData.notes || null,
      invoicedTotal: formData.invoicedTotal || null,
      discount: formData.discount || 0,
      vatRate: formData.vatRate || 21,
      vatAmount: formData.hasInvoiceTaxes ? (formData.vatAmount || 0) : 0,
      otherTaxes: formData.hasInvoiceTaxes ? (formData.otherTaxes || []) : [],
      forceDifference,
    };
    if (editingPurchase) {
      updateMutation.mutate({ id: editingPurchase.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const onSubmit = async (formData: PurchaseFormData) => {
    const subtotalLocal = formData.items.reduce((acc, item) => {
      return acc + ((Number(item.quantity) || 0) * (Number(item.unitCost) || 0) - (Number(item.discount) || 0));
    }, 0);
    const hasTaxes = formData.hasInvoiceTaxes;
    const vatValLocal = hasTaxes ? (Number(formData.vatAmount) || 0) : 0;
    const otherTaxesSumLocal = hasTaxes ? (formData.otherTaxes || []).reduce((acc, t) => acc + (Number(t.amount) || 0), 0) : 0;
    const discGeneralLocal = Number(formData.discount) || 0;
    const totalLocal = subtotalLocal + vatValLocal + otherTaxesSumLocal - discGeneralLocal;

    const invoicedTotalNumLocal = formData.invoicedTotal ? Number(formData.invoicedTotal) : null;
    const hasDiffLocal = invoicedTotalNumLocal !== null && Math.abs(invoicedTotalNumLocal - totalLocal) > 0.05;

    if (hasDiffLocal) {
      setPendingFormData(formData);
      setShowForceDialog(true);
      return;
    }

    sendSubmit(formData, false);
  };

  const handleAddItem = () => {
    if (!selectedProductToAdd) { swalWarning('Producto Requerido', 'Selecciona un producto'); return; }
    const numQty = Number(qtyToAdd) || 1;
    const numCost = Number(costToAdd) || 0;
    const numDisc = Number(discToAdd) || 0;
    if (numQty <= 0) { swalWarning('Cantidad Inválida', 'La cantidad debe ser mayor a 0'); return; }
    if (fields.findIndex(f => f.productId === selectedProductToAdd) > -1) {
      swalWarning('Producto Ya Agregado', 'Este producto ya fue agregado. Modifica su cantidad en la lista.'); return;
    }
    append({ productId: selectedProductToAdd, quantity: numQty, unitCost: numCost, discount: numDisc });
    setSelectedProductToAdd('');
    setQtyToAdd(1);
    setCostToAdd('');
    setDiscToAdd('');
    setSearchVal('');
  };

  const handleProductSelect = (id: string) => {
    setSelectedProductToAdd(id);
    const prod = (products as any[]).find(p => p.id === id);
    if (prod) setCostToAdd(Number(prod.purchasePrice) || 0);
  };

  const fmt = (val: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400',
      PENDIENTE_APROBACION: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
      APPROVED: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400',
      RECEIVED: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400',
      CANCELLED: 'bg-red-100 text-red-000 dark:bg-red-950/40 dark:text-red-400',
    };
    const labels: Record<string, string> = {
      DRAFT: 'Borrador',
      PENDIENTE_APROBACION: 'Pte. Aprobación',
      APPROVED: 'Aprobada',
      RECEIVED: 'Recibida',
      CANCELLED: 'Cancelada'
    };
    return <span className={`px-2.5 py-0.5 inline-flex text-xs font-semibold rounded-full ${styles[status] || 'bg-slate-100 text-slate-800'}`}>{labels[status] || status}</span>;
  };

  const getPaymentBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
      PAID: 'bg-blue-105 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400',
    };
    const labels: Record<string, string> = { PENDING: 'Pendiente', PAID: 'Pagado' };
    return <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${styles[status] || 'bg-slate-100 text-slate-800'}`}>{labels[status] || status}</span>;
  };

  const purchases = purchasesData?.data || [];
  const pagination = purchasesData?.pagination || { total: 0, totalPages: 1 };

  const inputCls = 'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs md:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed disabled:border-slate-200 dark:disabled:border-slate-800 disabled:opacity-75 transition-all shadow-2xs [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 dark:[&::-webkit-calendar-picker-indicator]:invert';
  const labelCls = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1';

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Borrador',
      PENDIENTE_APROBACION: 'Pte. Aprobación',
      APPROVED: 'Aprobada',
      RECEIVED: 'Recibida',
      CANCELLED: 'Cancelada',
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Órdenes de Compra"
        subtitle="Gestión profesional del ciclo de obtención e ingreso de stock en tiempo real."
        action={
          canCreate ? (
            <Button onClick={handleOpenCreateForm} className="flex items-center gap-2 shadow-sm rounded-xl">
              <Plus className="h-4 w-4" /> Nueva Compra
            </Button>
          ) : undefined
        }
      />

      {/* Filters unified bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nro. o documento..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            className="pl-9 w-full rounded-lg border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
          />
        </div>
        
        {/* Proveedor */}
        <select
          value={supplierFilter}
          onChange={e => { setSupplierFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium text-slate-700 dark:text-slate-300 max-w-[200px]"
        >
          <option value="">Todos los Proveedores</option>
          {(suppliers as any[]).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {/* Depósito */}
        <select
          value={warehouseFilter}
          onChange={e => { setWarehouseFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium text-slate-700 dark:text-slate-300 max-w-[200px]"
        >
          <option value="">Todos los Depósitos</option>
          {(warehouses as any[]).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>

        {/* Fecha Inicio */}
        <div className="flex items-center gap-2 bg-slate-50/50 dark:bg-slate-950 rounded-lg px-2.5 py-1 border border-slate-200 dark:border-slate-850">
          <span className="text-xs text-slate-400 font-semibold uppercase">Desde</span>
          <input
            type="date"
            value={startDateFilter}
            onChange={e => { setStartDateFilter(e.target.value); setPage(1); }}
            className="bg-transparent border-none text-xs text-slate-700 dark:text-slate-300 outline-none w-[110px]"
          />
        </div>

        {/* Fecha Fin */}
        <div className="flex items-center gap-2 bg-slate-50/50 dark:bg-slate-950 rounded-lg px-2.5 py-1 border border-slate-200 dark:border-slate-850">
          <span className="text-xs text-slate-400 font-semibold uppercase">Hasta</span>
          <input
            type="date"
            value={endDateFilter}
            onChange={e => { setEndDateFilter(e.target.value); setPage(1); }}
            className="bg-transparent border-none text-xs text-slate-700 dark:text-slate-300 outline-none w-[110px]"
          />
        </div>

        {/* Estado de Pago */}
        <select
          value={paymentFilter}
          onChange={e => { setPaymentFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium text-slate-700 dark:text-slate-300 max-w-[170px]"
        >
          <option value="">Todos los Pagos</option>
          <option value="PENDING">Pendiente</option>
          <option value="PAID">Pagado</option>
        </select>

        {/* Botón para resetear filtros si hay alguno */}
        {(searchTerm || supplierFilter || warehouseFilter || startDateFilter || endDateFilter || paymentFilter || statusFilter) && (
          <button
            onClick={() => {
              setSearchTerm('');
              setSupplierFilter('');
              setWarehouseFilter('');
              setStartDateFilter('');
              setEndDateFilter('');
              setPaymentFilter('');
              setStatusFilter('');
              setPage(1);
              setQueryTriggered(true);
              setIsLast10Mode(false);
            }}
            className="text-xs font-semibold text-red-500 hover:text-red-650 dark:hover:text-red-400 transition-colors uppercase tracking-wider px-2 py-1"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* KPI Cards section */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {(['ALL', 'DRAFT', 'PENDIENTE_APROBACION', 'APPROVED', 'RECEIVED', 'CANCELLED'] as const).map(statusKey => {
          const count = statusKey === 'ALL' 
            ? kpiPurchases.length 
            : kpiPurchases.filter((p: Purchase) => p.status === statusKey).length;
          
          const label = {
            ALL: 'Todas las Órdenes',
            DRAFT: 'Borradores',
            PENDIENTE_APROBACION: 'Pte. Aprobación',
            APPROVED: 'Aprobadas',
            RECEIVED: 'Recibidas',
            CANCELLED: 'Canceladas',
          }[statusKey];

          const isSelected = statusKey === 'ALL' ? statusFilter === '' : statusFilter === statusKey;

          const colorTheme = {
            ALL: isSelected 
              ? 'border-slate-800 bg-slate-900 text-white dark:border-slate-700 dark:bg-slate-800' 
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300',
            DRAFT: isSelected 
              ? 'border-amber-500 bg-amber-500 text-white' 
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-amber-300',
            PENDIENTE_APROBACION: isSelected 
              ? 'border-blue-500 bg-blue-500 text-white' 
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-blue-300',
            APPROVED: isSelected 
              ? 'border-indigo-500 bg-indigo-500 text-white' 
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-indigo-300',
            RECEIVED: isSelected 
              ? 'border-emerald-500 bg-emerald-500 text-white' 
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-emerald-300',
            CANCELLED: isSelected 
              ? 'border-rose-500 bg-rose-500 text-white' 
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-rose-300',
          }[statusKey];

          return (
            <button
              key={statusKey}
              onClick={() => {
                setStatusFilter(statusKey === 'ALL' ? '' : statusKey);
                setPage(1);
                setQueryTriggered(true);
                setIsLast10Mode(false);
              }}
              className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between cursor-pointer ${colorTheme}`}
            >
              <span className="text-xs font-semibold uppercase tracking-wider block opacity-90">{label}</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-xl font-bold font-mono">{count}</span>
                {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Primary table list */}
      {!queryTriggered ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-4 shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary-50 dark:bg-primary-950/50 flex items-center justify-center text-primary-600 dark:text-primary-400">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Módulo de Órdenes de Compra</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              Haga clic en uno de los accesos rápidos para cargar la lista de comprobantes registrados o ver las compras más recientes.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsLast10Mode(true);
                setQueryTriggered(true);
              }}
              className="rounded-xl shadow-sm"
            >
              Últimas compras
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setIsLast10Mode(false);
                setQueryTriggered(true);
              }}
              className="rounded-xl shadow-sm font-medium"
            >
              Ver todo el historial
            </Button>
          </div>
        </div>
      ) : loadingPurchases ? (
        <div className="flex justify-center items-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary-500" /></div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-primary-500" />
              {statusFilter === '' ? 'Todas las Compras' : `Compras: ${getStatusLabel(statusFilter)}`}
            </h3>
            <span className="text-xs text-slate-500 font-medium">Mostrando {purchases.length} compras</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-950/40 text-xs font-semibold text-slate-505 uppercase border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4">Nro Compra</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Proveedor</th>
                  <th className="py-3 px-4">Depósito</th>
                  <th className="py-3 px-4">Total</th>
                  {statusFilter === '' && <th className="py-3 px-4">Estado</th>}
                  <th className="py-3 px-4">Pago</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={statusFilter === '' ? 8 : 7} className="py-12 text-center text-slate-400 dark:text-slate-500 italic">
                      No se encontraron órdenes de compra para este estado o filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  purchases.map((p: Purchase) => (
                    <tr key={p.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-950/10 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900 dark:text-white">{p.purchaseNumber}</td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{new Date(p.purchaseDate).toLocaleDateString('es-AR')}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">{p.supplier?.name}</td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-350">{p.warehouse?.name}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{fmt(Number(p.total))}</td>
                      {statusFilter === '' && <td className="py-3.5 px-4">{getStatusBadge(p.status)}</td>}
                      <td className="py-3.5 px-4">{getPaymentBadge(p.paymentStatus)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex justify-center items-center gap-1.5">
                          <button onClick={() => { setSelectedPurchaseId(p.id); setIsDetailOpen(true); }} title="Ver Detalle" className="p-1 px-2 text-slate-500 hover:text-primary-650 bg-slate-100 dark:bg-slate-800 hover:bg-primary-50 rounded"><Eye className="h-4 w-4" /></button>
                          
                          {p.status === 'DRAFT' && (
                            <>
                              {canUpdate && <button onClick={() => handleOpenEditForm(p)} title="Editar" className="p-1 px-2 text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30 rounded"><Edit2 className="h-4 w-4" /></button>}
                              {canUpdate && (
                                <button
                                  onClick={async () => {
                                    const confirmed = await swalConfirm(
                                      '¿Enviar a Aprobación?',
                                      `¿Enviar a aprobación la compra ${p.purchaseNumber}?`,
                                      'Sí, enviar',
                                      'Cancelar'
                                    );
                                    if (confirmed) {
                                      submitForApprovalMutation.mutate(p.id);
                                    }
                                  }}
                                  title="Enviar a Aprobación"
                                  className="p-1 px-2 text-blue-600 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 rounded"
                                >
                                  <ShoppingCart className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}

                          {p.status === 'PENDIENTE_APROBACION' && canApprove && (
                            <button
                              onClick={async () => {
                                const confirmed = await swalConfirm(
                                  '¿Aprobar Orden?',
                                  `¿Aprobar orden de compra ${p.purchaseNumber}?`,
                                  'Sí, aprobar',
                                  'Cancelar'
                                );
                                if (confirmed) {
                                  approveMutation.mutate(p.id);
                                }
                              }}
                              title="Aprobar Orden"
                              className="p-1 px-2 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 rounded font-semibold text-xs flex items-center gap-1"
                            >
                              <ThumbsUp className="h-3.5 w-3.5" /> Aprobar
                            </button>
                          )}

                          {p.status === 'APPROVED' && canUpdate && (
                            <button
                              onClick={async () => {
                                const confirmed = await swalConfirm(
                                  '¿Recibir Mercadería?',
                                  `¿Confirmar recepción e ingreso de mercadería para la compra ${p.purchaseNumber}?`,
                                  'Sí, recibir',
                                  'Cancelar'
                                );
                                if (confirmed) {
                                  receiveMutation.mutate(p.id);
                                }
                              }}
                              title="Recibir Mercadería"
                              className="p-1 px-2 text-green-650 bg-green-50 dark:bg-green-950/30 rounded font-semibold text-xs flex items-center gap-1"
                            >
                              <Plus className="h-3.5 w-3.5" /> Recibir
                            </button>
                          )}

                          {['DRAFT', 'PENDIENTE_APROBACION', 'APPROVED'].includes(p.status) && canCancel && (
                            <button onClick={() => setCancelTarget(p)} title="Cancelar" className="p-1 px-2 text-red-600 bg-red-50 dark:bg-red-950/30 rounded"><RotateCcw className="h-4 w-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="bg-slate-50 dark:bg-slate-950 px-4 py-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500">Página {page} de {pagination.totalPages} ({pagination.total} compras totales)</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => Math.max(p - 1, 1))}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden my-8 max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary-500" />
                {editingPurchase ? `Editar Compra ${editingPurchase.purchaseNumber}` : 'Nueva Orden de Compra'}
              </h2>
              <button onClick={handleCloseForm} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            {apiError && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-sm flex items-center gap-2 border-b border-red-100 dark:border-red-900/30 flex-shrink-0">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />{apiError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Step 1: Document Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Proveedor *</label>
                  <select
                    value={watchedSupplierId}
                    onChange={async (e) => {
                      const newSupplierId = e.target.value;
                      if (watchedItems.length > 0) {
                        const confirmChange = await swalConfirm(
                          '¿Cambiar Proveedor?',
                          'El cambio de proveedor eliminará los productos incompatibles de la compra. ¿Desea continuar?',
                          'Sí, cambiar proveedor',
                          'Cancelar'
                        );
                        if (confirmChange) {
                          setValue('supplierId', newSupplierId);
                          setValue('items', []);
                        } else {
                          setValue('supplierId', watchedSupplierId);
                        }
                      } else {
                        setValue('supplierId', newSupplierId);
                      }
                    }}
                    className={`${inputCls} ${!watchedSupplierId ? 'text-slate-500 dark:text-slate-400 font-normal' : 'text-slate-900 dark:text-white font-medium'}`}
                  >
                    <option value="" className="text-slate-500 dark:text-slate-400">Selecciona Proveedor</option>
                    {(suppliers as any[]).map(s => <option key={s.id} value={s.id} className="text-slate-900 dark:text-white">{s.name}</option>)}
                  </select>
                  {errors.supplierId && <p className="mt-1 text-xs text-red-600">{errors.supplierId.message}</p>}
                </div>
                <div>
                  <label className={labelCls}>Almacén de Ingreso *</label>
                  <select
                    {...register('warehouseId')}
                    disabled={!!editingPurchase}
                    className={`${inputCls} ${!watch('warehouseId') ? 'text-slate-500 dark:text-slate-400 font-normal' : 'text-slate-900 dark:text-white font-medium'}`}
                  >
                    <option value="" className="text-slate-500 dark:text-slate-400">Selecciona Almacén</option>
                    {(warehouses as any[]).map(w => <option key={w.id} value={w.id} className="text-slate-900 dark:text-white">{w.name}</option>)}
                  </select>
                  {errors.warehouseId && <p className="mt-1 text-xs text-red-600">{errors.warehouseId.message}</p>}
                </div>
                <div>
                  <label className={labelCls}>Tipo Comprobante *</label>
                  <select
                    {...register('documentType')}
                    className={`${inputCls} ${!watch('documentType') ? 'text-slate-500 dark:text-slate-400 font-normal' : 'text-slate-900 dark:text-white font-medium'}`}
                  >
                    <option value="FACTURA" className="text-slate-900 dark:text-white">Factura</option>
                    <option value="BOLETA" className="text-slate-900 dark:text-white">Boleta</option>
                    <option value="GUIA_REMISION" className="text-slate-900 dark:text-white">Guía de Remisión</option>
                    <option value="NOTA_CREDITO" className="text-slate-900 dark:text-white">Nota de Crédito</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Nro Comprobante</label>
                  <input type="text" {...register('documentNumber')} placeholder="Ej: F001-00023412" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Fecha Esperada</label>
                  <input type="date" {...register('expectedDate')} className={`${inputCls} ${!watch('expectedDate') ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`} />
                </div>
                <div>
                  <label className={labelCls}>Notas adicionales</label>
                  <input type="text" {...register('notes')} placeholder="Observaciones..." className={inputCls} />
                </div>
              </div>

              {/* Step 2: Add Items */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300">Agregar Artículo</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                  <div className="sm:col-span-2 relative">
                    <label className={labelCls}>Producto</label>
                    <input
                      type="text"
                      value={searchVal}
                      onChange={(e) => {
                        setSearchVal(e.target.value);
                        setIsOpen(true);
                      }}
                      onFocus={() => watchedSupplierId && setIsOpen(true)}
                      onBlur={handleBlur}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        !watchedSupplierId
                          ? '⚠️ Seleccione primero un proveedor'
                          : 'Buscar producto por nombre, SKU, código...'
                      }
                      disabled={!watchedSupplierId}
                      className={inputCls}
                    />
                    {isOpen && watchedSupplierId && (
                      <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-lg shadow-xl divide-y divide-slate-800">
                        {filteredProducts.length === 0 ? (
                          <div className="p-3 text-xs text-slate-400 text-center italic">
                            No se encontraron productos.
                          </div>
                        ) : (
                          filteredProducts.map((p, idx) => {
                            const isAdded = watchedItems.some(i => i.productId === p.id);
                            const stockTotal = p.stocks?.reduce((acc: number, s: any) => acc + (Number(s.quantity) || 0), 0) || 0;
                            const isFocused = idx === focusedIndex;
                            return (
                              <div
                                key={p.id}
                                onClick={() => !isAdded && selectProduct(p)}
                                className={`p-2 flex flex-col gap-0.5 cursor-pointer text-left transition-colors ${
                                  isAdded
                                    ? 'bg-slate-950/40 text-slate-500 cursor-not-allowed'
                                    : isFocused
                                    ? 'bg-primary-900/50 text-white font-semibold'
                                    : 'hover:bg-slate-850 text-slate-350'
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-semibold text-xs text-slate-100">
                                    {p.name}
                                  </span>
                                  {isAdded && (
                                    <span className="text-[10px] bg-slate-850 text-slate-400 px-1.5 py-0.5 rounded-full font-semibold">
                                      ✓ Agregado
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-x-2 text-[10px] text-slate-400">
                                  <span>Cód. Int: {p.sku || 'N/D'}</span>
                                  <span>Proveedor: {p.supplier?.name || 'N/D'}</span>
                                  <span>Último Precio: {fmt(Number(p.purchasePrice) || 0)}</span>
                                  <span>Stock actual: {stockTotal} u.</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Cantidad</label>
                    <input type="number" min={1} value={qtyToAdd || ''} onChange={e => setQtyToAdd(e.target.value)} placeholder="1" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Costo Unit.</label>
                    <input type="number" step="0.01" min={0} value={costToAdd || ''} onChange={e => setCostToAdd(e.target.value)} placeholder="0.00" className={inputCls} />
                  </div>
                  <div>
                    <Button type="button" onClick={handleAddItem} className="w-full" disabled={!watchedSupplierId}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
                  </div>
                </div>
              </div>

              {/* Step 3: Items List */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300">Artículos ({fields.length})</h3>
                {fields.length === 0 ? (
                  <div className="border border-dashed border-slate-300 dark:border-slate-700 py-8 text-center rounded-xl text-slate-500 text-sm">
                    Agregue productos usando el selector de arriba.
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <th className="py-2.5 px-3">Producto</th>
                          <th className="py-2.5 px-3 text-right">Cant.</th>
                          <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                          <th className="py-2.5 px-3 text-right">Desc.</th>
                          <th className="py-2.5 px-3 text-right">Subtotal</th>
                          <th className="py-2.5 px-3 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                        {fields.map((item, index) => {
                          const product = (products as any[]).find(p => p.id === item.productId);
                          const q = watchedItems[index]?.quantity || 0;
                          const c = watchedItems[index]?.unitCost || 0;
                          const d = watchedItems[index]?.discount || 0;
                          const lineSub = q * c - d;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/20">
                              <td className="py-2.5 px-3">
                                <span className="font-semibold text-slate-900 dark:text-white">{product?.name || 'Cargando...'}</span>
                                {product?.sku && <span className="block text-xs font-mono text-slate-500">Cód. Int: {product.sku}</span>}
                              </td>
                              <td className="py-2.5 px-3 text-right"><input type="number" min={1} {...register(`items.${index}.quantity` as const, { valueAsNumber: true })} className="w-16 text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1 py-0.5 text-sm" /></td>
                              <td className="py-2.5 px-3 text-right"><input type="number" step="0.01" min={0} {...register(`items.${index}.unitCost` as const, { valueAsNumber: true })} className="w-24 text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1 py-0.5 text-sm" /></td>
                              <td className="py-2.5 px-3 text-right"><input type="number" step="0.01" min={0} {...register(`items.${index}.discount` as const, { valueAsNumber: true })} className="w-20 text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1 py-0.5 text-sm" /></td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">{fmt(lineSub)}</td>
                              <td className="py-2.5 px-3 text-center"><button type="button" onClick={() => remove(index)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="h-4 w-4" /></button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {errors.items && <p className="text-xs text-red-600 font-semibold">{errors.items.message}</p>}
              </div>

              {/* Step 4: Tax Section */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {/* Checkbox */}
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-950">
                  <input
                    type="checkbox"
                    id="hasInvoiceTaxes"
                    {...register('hasInvoiceTaxes')}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                  />
                  <label htmlFor="hasInvoiceTaxes" className="text-sm font-semibold text-slate-900 dark:text-white cursor-pointer select-none flex items-center gap-1.5">
                    La factura incluye impuestos
                    <HelpTooltip content="Marque esta opción para agregar IVA u otros tributos (ej: Percepciones, Impuestos Internos) discriminados en la factura de compra." />
                  </label>
                </div>

                {/* Tax Fields (visible only when checked) */}
                {watchedHasTaxes && (
                  <div className="p-4 space-y-4 border-t border-slate-200 dark:border-slate-800">
                    {/* IVA */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={labelCls}>Tipo / Porcentaje IVA (%)</label>
                        <div className="flex gap-2">
                          <select
                            value={watchedVatRate}
                            onChange={(e) => {
                              const r = Number(e.target.value) || 0;
                              setValue('vatRate', r);
                              setValue('vatAmount', Math.round(subtotal * r / 100 * 100) / 100);
                            }}
                            className={inputCls}
                          >
                            <option value="21">IVA 21%</option>
                            <option value="10.5">IVA 10.5%</option>
                            <option value="27">IVA 27%</option>
                            <option value="0">IVA 0%</option>
                            <option value="custom">Personalizado</option>
                          </select>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="%"
                            {...register('vatRate', {
                              valueAsNumber: true,
                              onChange: (e) => {
                                const r = Number(e.target.value) || 0;
                                setValue('vatAmount', Math.round(subtotal * r / 100 * 100) / 100);
                              }
                            })}
                            className={`${inputCls} w-20`}
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelCls}>Monto IVA Importe ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="0.00"
                          {...register('vatAmount', { valueAsNumber: true })}
                          className={inputCls}
                        />
                        {errors.vatAmount && <p className="mt-1 text-xs text-red-600">{errors.vatAmount.message}</p>}
                      </div>
                    </div>

                    {/* Other Taxes */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className={labelCls + ' mb-0'}>Otros Impuestos</label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => appendTax({ name: '', percentage: 0, amount: 0, description: '' })}
                          className="text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />Agregar
                        </Button>
                      </div>
                      {otherTaxFields.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">No hay otros impuestos. Haz clic en "Agregar" para añadir (ej: Percepción IVA, Ingresos Brutos, Sellos).</p>
                      ) : (
                        <div className="space-y-3">
                          {otherTaxFields.map((tf, ti) => (
                            <div key={tf.id} className="flex flex-col sm:flex-row gap-2 items-start border border-slate-100 dark:border-slate-800 p-2 rounded-lg sm:p-0 sm:border-0">
                              <div className="w-full sm:flex-1">
                                <label className="block text-[10px] font-bold text-slate-400 mb-0.5 sm:hidden">Nombre</label>
                                <input
                                  type="text"
                                  placeholder="Nombre del impuesto (ej: Percepción IVA)"
                                  {...register(`otherTaxes.${ti}.name` as const)}
                                  className={inputCls}
                                />
                                {errors.otherTaxes?.[ti]?.name && <p className="mt-0.5 text-xs text-red-600">{errors.otherTaxes[ti]?.name?.message}</p>}
                              </div>
                              <div className="w-full sm:w-20">
                                <label className="block text-[10px] font-bold text-slate-400 mb-0.5 sm:hidden">Porcentaje %</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min={0}
                                  placeholder="%"
                                  {...register(`otherTaxes.${ti}.percentage` as const, {
                                    valueAsNumber: true,
                                    onChange: (e) => {
                                      const pct = Number(e.target.value) || 0;
                                      const amt = Math.round(subtotal * pct / 100 * 100) / 100;
                                      setValue(`otherTaxes.${ti}.amount` as const, amt);
                                    }
                                  })}
                                  className={inputCls}
                                />
                              </div>
                              <div className="w-full sm:w-32">
                                <label className="block text-[10px] font-bold text-slate-400 mb-0.5 sm:hidden">Monto $</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  placeholder="0.00"
                                  {...register(`otherTaxes.${ti}.amount` as const, { valueAsNumber: true })}
                                  className={inputCls}
                                />
                              </div>
                              <div className="w-full sm:flex-1">
                                <label className="block text-[10px] font-bold text-slate-400 mb-0.5 sm:hidden">Descripción (opcional)</label>
                                <input
                                  type="text"
                                  placeholder="Notas del impuesto"
                                  {...register(`otherTaxes.${ti}.description` as const)}
                                  className={inputCls}
                                />
                              </div>
                              <button type="button" onClick={() => removeTax(ti)} className="mt-2 text-red-500 hover:text-red-700 p-1 flex-shrink-0 self-end sm:self-auto">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 5: Totals Panel */}
              <div className="flex flex-col sm:flex-row gap-4 justify-end">
                {/* Discount and Invoice total fields */}
                <div className="flex-1 sm:max-w-xs space-y-4">
                  <div>
                    <label className={labelCls}>Descuento General ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="Ingrese el descuento general de la factura"
                      {...register('discount', { valueAsNumber: true })}
                      className={inputCls}
                    />
                    {errors.discount && <p className="mt-1 text-xs text-red-600">{errors.discount.message}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Total informado por la factura (opcional)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="Ingrese el total de la factura del proveedor"
                      {...register('invoicedTotal', { valueAsNumber: true })}
                      className={inputCls}
                    />
                    <p className="mt-1 text-xs text-slate-400">Se usa solo para comparación — no afecta el cálculo.</p>
                  </div>
                </div>

                {/* Calculated Totals */}
                <div className="w-full sm:w-72 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Subtotal (productos)</span>
                    <span>{fmt(subtotal)}</span>
                  </div>
                  {watchedHasTaxes && (
                    <>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>IVA ({watchedVatRate}%)</span>
                        <span>{fmt(vatVal)}</span>
                      </div>
                      {watchedOtherTaxes.filter(t => t.name).map((t, i) => (
                        <div key={i} className="flex justify-between text-xs text-slate-500">
                          <span>{t.name || `Impuesto ${i + 1}`} ({t.percentage || 0}%)</span>
                          <span>{fmt(Number(t.amount) || 0)}</span>
                        </div>
                      ))}
                    </>
                  )}
                  {discountVal > 0 && (
                    <div className="flex justify-between text-xs text-red-500 font-medium">
                      <span>Descuento General</span>
                      <span>-{fmt(discountVal)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 dark:border-slate-800 my-1 pt-1 flex justify-between text-sm font-bold text-slate-900 dark:text-white">
                    <span>Total Calculado</span>
                    <span>{fmt(total)}</span>
                  </div>
                  {invoicedTotalNum !== null && (
                    <div className="flex justify-between text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-1">
                      <span>Total Factura</span>
                      <span>{fmt(invoicedTotalNum)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Difference Warning */}
              {hasDifference && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Diferencia detectada</p>
                    <p className="text-xs mt-0.5">
                      El total calculado ({fmt(total)}) no coincide con el total informado por la factura ({fmt(invoicedTotalNum!)}).
                      Diferencia: <strong>{fmt(Math.abs(difference))}</strong>
                      {difference > 0 ? ' (factura mayor al calculado)' : ' (calculado mayor a la factura)'}.
                    </p>
                    <p className="text-xs mt-1 opacity-75">Puede guardar de todas formas. Verifique los importes antes de aprobar.</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button type="submit" disabled={isSubmitting || fields.length === 0}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingPurchase ? 'Guardar Cambios' : 'Registrar Compra'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isDetailOpen && selectedPurchaseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden my-8 max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
            {(!detailPurchase || loadingDetailData) ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Cargando detalles de la compra...</p>
                <Button variant="outline" onClick={handleCloseDetail} className="mt-4">Cerrar</Button>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 flex-shrink-0">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary-500" />
                      Compra #{detailPurchase.purchaseNumber}
                    </h2>
                    <span className="text-xs text-slate-500">Emitida el {new Date(detailPurchase.purchaseDate).toLocaleString('es-AR')}</span>
                  </div>
                  <button onClick={handleCloseDetail} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
                </div>

                <div className="overflow-y-auto flex-1 p-6 space-y-6">
                  {/* CABECERA RESUMEN */}
                  {(() => {
                    const getHistoryDetails = (logs?: any[]) => {
                      const approvalLog = logs?.find((l: any) => l.actionType === 'USER_APPROVED_PURCHASE');
                      const receptionLog = logs?.find((l: any) => l.actionType === 'USER_RECEIVED_PURCHASE');
                      
                      return {
                        approvedAt: approvalLog ? new Date(approvalLog.createdAt).toLocaleString('es-AR') : null,
                        approvedBy: approvalLog ? (approvalLog.user?.name || approvalLog.user?.email || 'Aprobador') : null,
                        receivedAt: receptionLog ? new Date(receptionLog.createdAt).toLocaleString('es-AR') : null,
                      };
                    };
                    const { approvedAt, approvedBy, receivedAt } = getHistoryDetails(detailPurchase.activityLogs);

                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-xl bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 text-xs">
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Número de Compra</span>
                          <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{detailPurchase.purchaseNumber}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Estado</span>
                          <div>{getStatusBadge(detailPurchase.status)}</div>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Fecha de Emisión</span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{new Date(detailPurchase.purchaseDate).toLocaleDateString('es-AR')}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Fecha de Creación</span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{new Date(detailPurchase.createdAt).toLocaleString('es-AR')}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Usuario Creador</span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{detailPurchase.user?.name || detailPurchase.user?.email || 'Sistema'}</span>
                        </div>
                        {approvedAt && (
                          <>
                            <div>
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Fecha de Aprobación</span>
                              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{approvedAt}</span>
                            </div>
                            <div>
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Usuario Aprobador</span>
                              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{approvedBy}</span>
                            </div>
                          </>
                        )}
                        {receivedAt && (
                          <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Fecha de Recepción</span>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{receivedAt}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Proveedor Panel */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-850 pb-2">
                        <User className="h-4 w-4 text-primary-500" /> Proveedor
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-slate-400 block font-medium">Nombre:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{detailPurchase.supplier?.name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Razón Social:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{detailPurchase.supplier?.contactName || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">CUIT:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{detailPurchase.supplier?.taxId || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Email:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{detailPurchase.supplier?.email || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Teléfono:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{detailPurchase.supplier?.phone || 'N/A'}</span>
                        </div>
                        {detailPurchase.supplier?.address && (
                          <div>
                            <span className="text-slate-400 block font-medium">Dirección:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{detailPurchase.supplier.address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Documento Panel */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-850 pb-2">
                        <FileText className="h-4 w-4 text-primary-500" /> Documento
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-slate-400 block font-medium">Tipo:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{detailPurchase.documentType}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Número:</span>
                          <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{detailPurchase.documentNumber || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Estado del Documento:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{detailPurchase.status === 'CANCELLED' ? 'Cancelado' : 'Válido'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Depósito Panel */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-850 pb-2">
                        <Warehouse className="h-4 w-4 text-primary-500" /> Depósito
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-slate-400 block font-medium">Nombre:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{detailPurchase.warehouse?.name}</span>
                        </div>
                        {detailPurchase.warehouse?.code && (
                          <div>
                            <span className="text-slate-400 block font-medium">Sucursal / Código:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{detailPurchase.warehouse.code}</span>
                          </div>
                        )}
                        {detailPurchase.warehouse?.managerName && (
                          <div>
                            <span className="text-slate-400 block font-medium">Responsable:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{detailPurchase.warehouse.managerName}</span>
                          </div>
                        )}
                        {detailPurchase.warehouse?.address && (
                          <div>
                            <span className="text-slate-400 block font-medium">Dirección:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{detailPurchase.warehouse.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* TABLA PRODUCTOS */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Artículos del Pedido</h4>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                            <th className="py-2.5 px-3">Producto</th>
                            <th className="py-2.5 px-3">Código</th>
                            <th className="py-2.5 px-3 text-right">Cantidad</th>
                            <th className="py-2.5 px-3 text-center">Unidad</th>
                            <th className="py-2.5 px-3 text-right">Costo Unitario</th>
                            <th className="py-2.5 px-3 text-right">Descuento</th>
                            <th className="py-2.5 px-3 text-center">IVA</th>
                            <th className="py-2.5 px-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                          {detailPurchase.items?.map((item: PurchaseItem) => {
                            const lineSub = Number(item.quantity) * Number(item.unitCost) - Number(item.discount);
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/20">
                                <td className="py-2.5 px-3">
                                  <span className="font-semibold text-slate-900 dark:text-white">{item.product?.name}</span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-500">
                                  {item.product?.sku || item.product?.barcode || 'N/D'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                                  {Number(item.quantity)}
                                </td>
                                <td className="py-2.5 px-3 text-center text-slate-400">
                                  u.
                                </td>
                                <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                                  {fmt(Number(item.unitCost))}
                                </td>
                                <td className="py-2.5 px-3 text-right text-red-500 font-medium">
                                  {Number(item.discount) > 0 ? `-${fmt(Number(item.discount))}` : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-center text-slate-500 font-medium">
                                  {detailPurchase.hasInvoiceTaxes ? `${Number((detailPurchase as any).vatRate) || 21}%` : '0%'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                                  {fmt(lineSub)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {/* Estado del pago panel */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-850 pb-2">
                          <CreditCard className="h-4 w-4 text-primary-500" /> Estado del Pago
                        </h4>
                        <div className="space-y-2.5 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-medium">Estado del Pago:</span>
                            <div>{getPaymentBadge(detailPurchase.paymentStatus)}</div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-medium">Forma de Pago:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {detailPurchase.status === 'RECEIVED' ? 'Cuenta Corriente / Caja Chica' : 'No especificada'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {detailPurchase.notes && (
                        <div className="text-xs text-slate-500 italic mt-4 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-900">
                          <strong>Observaciones:</strong> {detailPurchase.notes}
                        </div>
                      )}
                    </div>

                    {/* Resumen Economico Panel */}
                    <div className="w-full bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
                        <DollarSign className="h-4 w-4 text-primary-500" /> Resumen Económico
                      </h4>
                      <div className="flex justify-between text-slate-500">
                        <span>Subtotal</span>
                        <span className="font-semibold">{fmt(Number(detailPurchase.subtotal))}</span>
                      </div>
                      {detailPurchase.hasInvoiceTaxes && (
                        <>
                          <div className="flex justify-between text-slate-500">
                            <span>IVA ({Number((detailPurchase as any).vatRate) || 21}%)</span>
                            <span className="font-semibold">{fmt(Number(detailPurchase.vatAmount))}</span>
                          </div>
                          {(() => {
                            try {
                              const taxes: OtherTax[] = JSON.parse(detailPurchase.otherTaxes || '[]');
                              return taxes.map((t, i) => (
                                <div key={i} className="flex justify-between text-slate-500">
                                  <span>{t.name} ({t.percentage || 0}%)</span>
                                  <span className="font-semibold">{fmt(Number(t.amount))}</span>
                                </div>
                              ));
                            } catch { return null; }
                          })()}
                        </>
                      )}
                      {Number(detailPurchase.discount) > 0 && (
                        <div className="flex justify-between text-red-500 font-medium">
                          <span>Descuento General</span>
                          <span>-{fmt(Number(detailPurchase.discount))}</span>
                        </div>
                      )}
                      <div className="border-t border-slate-200 dark:border-slate-800 my-1 pt-1.5 flex justify-between font-bold text-slate-900 dark:text-white text-sm">
                        <span>Total</span>
                        <span>{fmt(Number(detailPurchase.total))}</span>
                      </div>
                      {detailPurchase.invoicedTotal && (
                        <div className="flex justify-between border-t border-slate-200 dark:border-slate-850 pt-1 text-slate-500">
                          <span>Total Factura</span>
                          <span className="font-semibold">{fmt(Number(detailPurchase.invoicedTotal))}</span>
                        </div>
                      )}
                      <div className="border-t border-slate-200 dark:border-slate-800 pt-1.5 flex justify-between text-slate-900 dark:text-white font-semibold">
                        <span>Total Pagado</span>
                        <span className="text-green-600 dark:text-green-400 font-bold">
                          {fmt(detailPurchase.paymentStatus === 'PAID' ? Number(detailPurchase.total) : 0)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                        <span>Saldo Pendiente</span>
                        <span className={detailPurchase.paymentStatus === 'PAID' ? 'text-slate-500' : 'text-amber-600 font-bold'}>
                          {fmt(detailPurchase.paymentStatus === 'PAID' ? 0 : Number(detailPurchase.total))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SECCION HISTORIAL - ACTIVITY LOG */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-850 pb-2">
                      <Activity className="h-4 w-4 text-primary-505" /> Historial de Actividad
                    </h4>
                    {(!detailPurchase.activityLogs || detailPurchase.activityLogs.length === 0) ? (
                      <p className="text-xs text-slate-400 italic py-1">No se encontraron registros de actividad para esta compra.</p>
                    ) : (
                      <div className="flow-root mt-2">
                        <ul className="-mb-8">
                          {detailPurchase.activityLogs.map((log: any, logIdx: number) => {
                            const getActionLabel = (action: string) => {
                              const labels: Record<string, string> = {
                                CREATE_PURCHASE: 'Compra creada',
                                CREATE_PURCHASE_FORCE_DIFFERENCE: 'Compra creada (diferencia forzada)',
                                UPDATE_PURCHASE: 'Compra editada',
                                UPDATE_PURCHASE_FORCE_DIFFERENCE: 'Compra editada (diferencia forzada)',
                                SUBMIT_PURCHASE_FOR_APPROVAL: 'Enviada a aprobación',
                                REJECT_PURCHASE: 'Devuelta a borrador (rechazada)',
                                USER_APPROVED_PURCHASE: 'Aprobada',
                                USER_RECEIVED_PURCHASE: 'Recibida',
                                USER_CANCELLED_PURCHASE: 'Cancelada',
                              };
                              return labels[action] || action;
                            };

                            const getActionColor = (action: string) => {
                              if (action.includes('CANCEL')) return 'bg-red-500';
                              if (action.includes('APPROVE') || action.includes('RECEIV')) return 'bg-green-500';
                              if (action.includes('SUBMIT')) return 'bg-blue-500';
                              if (action.includes('UPDATE')) return 'bg-yellow-500';
                              return 'bg-primary-500';
                            };

                            return (
                              <li key={log.id}>
                                <div className="relative pb-6">
                                  {logIdx !== detailPurchase.activityLogs.length - 1 ? (
                                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
                                  ) : null}
                                  <div className="relative flex space-x-3">
                                    <div>
                                      <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-slate-900 text-white ${getActionColor(log.actionType)}`}>
                                        <Clock className="h-4 w-4" />
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                                      <div>
                                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                          {getActionLabel(log.actionType)}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                          Usuario: <span className="font-semibold">{log.user?.name || log.user?.email || 'Sistema'}</span>
                                          {log.ipAddress && ` (IP: ${log.ipAddress})`}
                                        </p>
                                      </div>
                                      <div className="text-right text-[10px] whitespace-nowrap text-slate-500 font-medium">
                                        <time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString('es-AR')}</time>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center flex-shrink-0">
                  <div className="text-xs text-slate-500">Registrado por: {detailPurchase.user?.name || detailPurchase.user?.email || 'Sistema'}</div>
                  <div className="flex gap-2">
                    {/* DRAFT */}
                    {detailPurchase.status === 'DRAFT' && (
                      <>
                        {canUpdate && (
                          <Button
                            onClick={() => {
                              handleCloseDetail();
                              handleOpenEditForm(detailPurchase);
                            }}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white flex items-center gap-1.5 font-semibold animate-transition"
                          >
                            <Edit2 className="h-4 w-4" /> Editar
                          </Button>
                        )}
                        {canUpdate && (
                          <Button
                            onClick={async () => {
                              const confirmed = await swalConfirm(
                                '¿Enviar a Aprobación?',
                                `¿Enviar a aprobación la compra ${detailPurchase.purchaseNumber}?`,
                                'Sí, enviar',
                                'Cancelar'
                              );
                              if (confirmed) {
                                submitForApprovalMutation.mutate(detailPurchase.id);
                                handleCloseDetail();
                              }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5 font-semibold"
                          >
                            <ShoppingCart className="h-4 w-4" /> Enviar a aprobación
                          </Button>
                        )}
                        {canCancel && (
                          <Button
                            onClick={() => {
                              setCancelTarget(detailPurchase);
                              handleCloseDetail();
                            }}
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                          >
                            Cancelar
                          </Button>
                        )}
                      </>
                    )}

                    {/* EN APROBACIÓN */}
                    {detailPurchase.status === 'PENDIENTE_APROBACION' && (
                      <>
                        {canApprove && (
                          <Button
                            onClick={async () => {
                              const confirmed = await swalConfirm(
                                '¿Aprobar Compra?',
                                `¿Aprobar la compra ${detailPurchase.purchaseNumber}?`,
                                'Sí, aprobar',
                                'Cancelar'
                              );
                              if (confirmed) {
                                approveMutation.mutate(detailPurchase.id);
                                handleCloseDetail();
                              }
                            }}
                            className="bg-green-600 hover:bg-green-700 flex items-center gap-1.5 font-semibold"
                          >
                            <ThumbsUp className="h-4 w-4" /> Aprobar
                          </Button>
                        )}
                        {canApprove && (
                          <Button
                            onClick={async () => {
                              const confirmed = await swalConfirm(
                                '¿Rechazar Compra?',
                                `¿Rechazar y devolver a Borrador la compra ${detailPurchase.purchaseNumber}?`,
                                'Sí, rechazar',
                                'Cancelar'
                              );
                              if (confirmed) {
                                rejectMutation.mutate(detailPurchase.id);
                                handleCloseDetail();
                              }
                            }}
                            variant="outline"
                            className="border-amber-300 text-amber-600 hover:bg-amber-50"
                          >
                            Rechazar (Devolver a Borrador)
                          </Button>
                        )}
                        {canCancel && (
                          <Button
                            onClick={() => {
                              setCancelTarget(detailPurchase);
                              handleCloseDetail();
                            }}
                            variant="outline"
                            className="border-red-300 text-red-650 hover:bg-red-50"
                          >
                            Cancelar
                          </Button>
                        )}
                      </>
                    )}

                    {/* APROBADA (APPROVED) */}
                    {detailPurchase.status === 'APPROVED' && (
                      <>
                        {canApprove && (
                          <Button
                            onClick={async () => {
                              const confirmed = await swalConfirm(
                                '¿Confirmar Recepción?',
                                `¿Confirmar recepción de mercadería para la compra ${detailPurchase.purchaseNumber}?`,
                                'Sí, recibir mercadería',
                                'Cancelar'
                              );
                              if (confirmed) {
                                receiveMutation.mutate(detailPurchase.id);
                                handleCloseDetail();
                              }
                            }}
                            className="bg-green-600 hover:bg-green-700 flex items-center gap-1.5 font-semibold"
                          >
                            <Plus className="h-4 w-4" /> Recibir
                          </Button>
                        )}
                        {canCancel && (
                          <Button
                            onClick={() => {
                              setCancelTarget(detailPurchase);
                              handleCloseDetail();
                            }}
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                          >
                            Cancelar
                          </Button>
                        )}
                      </>
                    )}

                    <Button variant="outline" onClick={handleCloseDetail}>Cerrar</Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* CANCEL CONFIRM */}
      {cancelTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="h-8 w-8" />
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Cancelar Compra</h3>
                <span className="text-xs font-mono text-slate-500">{cancelTarget.purchaseNumber}</span>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              ¿Está seguro de cancelar esta compra? Si estaba aprobada, <strong>se generarán movimientos de egreso en el Kardex y stock</strong> para revertir el ingreso.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setCancelTarget(null)}>Volver</Button>
              <Button onClick={() => cancelMutation.mutate(cancelTarget.id)} className="bg-red-600 hover:bg-red-700 text-white">
                Confirmar Reversión
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FORCE DIFFERENCE DIALOG */}
      {showForceDialog && pendingFormData && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Diferencia de Totales</h3>
                <span className="text-xs text-slate-500">Advertencia de control de factura</span>
              </div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
              <p>
                El total facturado ingresado no coincide con el total calculado automáticamente.
              </p>
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Calculado:</span>
                  <span className="font-bold">{fmt(total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ingresado (Factura):</span>
                  <span className="font-bold text-amber-600">{fmt(Number(pendingFormData.invoicedTotal) || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1 mt-1 font-semibold">
                  <span>Diferencia:</span>
                  <span>{fmt(Math.abs((Number(pendingFormData.invoicedTotal) || 0) - total))}</span>
                </div>
              </div>
              <p className="text-xs italic text-slate-400">
                ¿Desea guardar la compra con esta discrepancia técnica de todas formas? Esto se registrará en el historial de logs de auditoría.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setShowForceDialog(false); setPendingFormData(null); }}>Cancelar</Button>
              <Button onClick={() => { if (pendingFormData) { sendSubmit(pendingFormData, true); setShowForceDialog(false); setPendingFormData(null); } }} className="bg-amber-600 hover:bg-amber-700 text-white">
                Guardar de todas formas
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
