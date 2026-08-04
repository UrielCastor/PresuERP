import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Boxes,
  Search,
  SlidersHorizontal,
  Edit,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  Warehouse,
  Package,
  Shield,
  Layers,
  Truck,
  Eye,
  ClipboardList
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { stockApi, Stock } from '../services/stock.service';
import { categoryApi } from '../services/category.service';
import { supplierApi } from '../services/supplier.service';
import { warehouseApi } from '../services/warehouse.service';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { HelpTooltip } from '../components/ui/HelpTooltip';

// Schema for manual stock adjustment
const adjustStockSchema = z.object({
  quantity: z.number({ required_error: 'La nueva cantidad es obligatoria' })
    .min(0, 'La cantidad de existencias no puede ser menor a cero'),
  changeReason: z.string({ required_error: 'El motivo es obligatorio' })
    .min(4, 'El motivo debe tener al menos 4 caracteres'),
  minimumStock: z.number().min(0, 'El stock mínimo no puede ser menor a cero').default(0),
  maximumStock: z.number().min(0, 'El stock máximo no puede ser menor a cero').default(0),
  reservedQuantity: z.number().min(0, 'La cantidad reservada no puede ser menor a cero').default(0),
});

type AdjustStockFormData = z.infer<typeof adjustStockSchema>;

import { getInitialWarehouseId } from '../utils/warehouse';

export const Stocks: React.FC = () => {
  const { hasPermission, user } = useAuth();
  const defaultWhId = getInitialWarehouseId(user) || undefined;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(
    () => (user?.isStaff ? 'ALL' : defaultWhId || 'ALL')
  );

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: warehouseApi.list,
  });

  const displayWarehouses = useMemo(() => {
    if (user?.isStaff) return warehouses;
    if (user?.userWarehouses && user.userWarehouses.length > 0) {
      const authorizedIds = new Set(
        user.userWarehouses.map((uw) => uw.warehouseId || uw.warehouse?.id).filter(Boolean)
      );
      if (user.defaultWarehouseId) authorizedIds.add(user.defaultWarehouseId);
      if (user.defaultWarehouse?.id) authorizedIds.add(user.defaultWarehouse.id);

      const filtered = warehouses.filter((w) => authorizedIds.has(w.id));
      return filtered.length > 0 ? filtered : warehouses;
    }
    return warehouses;
  }, [warehouses, user]);

  useEffect(() => {
    if (!user?.isStaff && defaultWhId && (selectedWarehouse === 'ALL' || !selectedWarehouse)) {
      setSelectedWarehouse(defaultWhId);
    }
  }, [defaultWhId, user]);

  console.log('[STOCKS] estado del depósito:', {
    selectedWarehouse,
    defaultWhId,
    'user.isStaff': user?.isStaff,
    'user.defaultWarehouseId': user?.defaultWarehouseId,
    'user.defaultWarehouse': user?.defaultWarehouse,
    'user.userWarehouses': user?.userWarehouses,
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [viewingProduct, setViewingProduct] = useState<any | null>(null);

  const formatUnitQty = (amount: number | null | undefined, unitOfMeasure?: string) => {
    if (amount === null || amount === undefined || isNaN(Number(amount))) {
      return '—';
    }
    const qty = Number(amount);
    const u = String(unitOfMeasure || 'UNIT').toUpperCase();

    if (u === 'KG' || u === 'KILOGRAM' || u === 'KILOGRAMO') {
      const formatted = qty.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
      return `${formatted} kg`;
    }
    if (u === 'G' || u === 'GRAM' || u === 'GRAMOS') {
      const formatted = qty.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
      return `${formatted} g`;
    }
    if (u === 'LT' || u === 'L' || u === 'LITER' || u === 'LITRO') {
      const formatted = qty.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
      return `${formatted} L`;
    }
    const formatted = qty.toLocaleString('es-AR', { maximumFractionDigits: 0 });
    return `${formatted} u.`;
  };

  // Queries
  const { data: stocks = [], isLoading: isStocksLoading } = useQuery({
    queryKey: ['stocks', selectedWarehouse],
    queryFn: () => stockApi.list(selectedWarehouse),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryApi.list,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: supplierApi.list,
  });

  
  // Modals / Editing
  const [adjustingStock, setAdjustingStock] = useState<Stock | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const canUpdate = hasPermission('stocks:update');

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdjustStockFormData>({
    resolver: zodResolver(adjustStockSchema),
    defaultValues: {
      quantity: 0,
      changeReason: '',
      minimumStock: 0,
      maximumStock: 0,
      reservedQuantity: 0,
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdjustStockFormData }) => stockApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.message || 'Error al ajustar el depósito');
    },
  });

  const handleOpenAdjustModal = (stock: Stock) => {
    setAdjustingStock(stock);
    setApiError(null);
    setValue('quantity', Number(stock.quantity));
    setValue('minimumStock', Number(stock.minimumStock));
    setValue('maximumStock', Number(stock.maximumStock));
    setValue('reservedQuantity', Number(stock.reservedQuantity));
    // Clear reason input
    setValue('changeReason', '');
    reset({
      quantity: Number(stock.quantity),
      minimumStock: Number(stock.minimumStock),
      maximumStock: Number(stock.maximumStock),
      reservedQuantity: Number(stock.reservedQuantity),
      changeReason: '',
    });
  };

  const handleCloseModal = () => {
    setAdjustingStock(null);
    setApiError(null);
    reset();
  };

  const onSubmitAdjust = async (data: AdjustStockFormData) => {
    if (!adjustingStock) return;
    
    // Explicit safety checks
    if (data.quantity < 0) {
      setApiError('La cantidad no puede ser menor a cero');
      return;
    }
    if (!data.changeReason || data.changeReason.trim().length < 4) {
      setApiError('El motivo del ajuste debe tener al menos 4 caracteres');
      return;
    }

    updateMutation.mutate({
      id: adjustingStock.id,
      data: {
        quantity: Number(data.quantity),
        changeReason: data.changeReason.trim(),
        minimumStock: Number(data.minimumStock),
        maximumStock: Number(data.maximumStock),
        reservedQuantity: Number(data.reservedQuantity),
      },
    });
  };

  // Predefined reasons list
  const predefinedReasons = [
    'Inventario inicial',
    'Corrección',
    'Producto encontrado',
    'Error de carga',
    'Ajuste administrativo',
  ];

  // Filtering logic
  const filteredStocks = stocks.filter((s) => {
    // 1. Search term match name / sku / barcode / warehouse
    const matchesSearch =
      s.product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.product?.sku && s.product.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.product?.barcode && s.product.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      s.warehouse?.name.toLowerCase().includes(searchTerm.toLowerCase());

    // 2. Warehouse
    const matchesWarehouse = selectedWarehouse === 'ALL' || s.warehouseId === selectedWarehouse;

    // 3. Category
    const matchesCategory = selectedCategory === 'ALL' || s.product?.categoryId === selectedCategory;

    // 4. Supplier
    const matchesSupplier = selectedSupplier === 'ALL' || s.product?.supplierId === selectedSupplier;

    // 5. Stock Status
    let matchesStatus = true;
    const qty = Number(s.quantity);
    const min = Number(s.minimumStock);
    const max = Number(s.maximumStock);
    if (selectedStatus === 'NO_STOCK') {
      matchesStatus = qty <= 0;
    } else if (selectedStatus === 'LOW_STOCK') {
      matchesStatus = qty <= min && qty > 0;
    } else if (selectedStatus === 'OVER_STOCK') {
      matchesStatus = max > 0 && qty >= max;
    } else if (selectedStatus === 'OK') {
      matchesStatus = qty > min && (max > 0 ? qty < max : true);
    }

    return matchesSearch && matchesWarehouse && matchesCategory && matchesSupplier && matchesStatus;
  });

  const getStockBadge = (qty: number, minStock: number, maxStock: number) => {
    if (qty <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900/30">
          <XCircle className="h-3 w-3" />
          Sin Stock
        </span>
      );
    }
    if (qty <= minStock) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
          <AlertTriangle className="h-3 w-3" />
          Stock Bajo
        </span>
      );
    }
    if (maxStock > 0 && qty >= maxStock) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">
          <Layers className="h-3 w-3" />
          Sobre Stock
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-900/30">
        <CheckCircle className="h-3 w-3" />
        Stock OK
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. ENCABEZADO ESTILO POS */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">📦</span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Control de Stock por Depósito
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Visualiza el stock disponible, reservado y los niveles mínimos y máximos de cada producto por depósito.
          </p>
        </div>
      </div>

      {/* 2. BARRA DE HERRAMIENTAS Y FILTROS ESTILO CHIPS / DROPDOWNS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {/* Fila Buscador + Contador */}
        <div className="flex flex-col md:flex-row gap-3.5 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por producto, Código Interno o código de barras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3">
            {(searchTerm.trim() || selectedWarehouse !== 'ALL' || selectedCategory !== 'ALL' || selectedSupplier !== 'ALL' || selectedStatus !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedWarehouse(user?.isStaff ? 'ALL' : (defaultWhId || 'ALL'));
                  setSelectedCategory('ALL');
                  setSelectedSupplier('ALL');
                  setSelectedStatus('ALL');
                }}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 px-2 py-1 transition-colors"
              >
                Limpiar filtros
              </button>
            )}
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Mostrando {filteredStocks.length} combinaciones
            </div>
          </div>
        </div>

        {/* Fila Selects Filtros Modernos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
          {/* Depósito */}
          <div className="relative">
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              disabled={warehouses.length === 0}
              className="w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer disabled:opacity-50"
            >
              {warehouses.length === 0 ? (
                <option value="">Sin depósitos autorizados</option>
              ) : (
                <>
                  {user?.isStaff && <option value="ALL">🏢 Todos los Depósitos</option>}
                  {displayWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.isMain ? '(Principal)' : ''}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Categoría */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
            >
              <option value="ALL">📂 Todas las Categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Proveedor */}
          <div className="relative">
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
            >
              <option value="ALL">🏭 Todos los Proveedores</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
            >
              <option value="ALL">🏷️ Todos los Estados</option>
              <option value="OK">🟢 Stock OK</option>
              <option value="LOW_STOCK">🟠 Stock Bajo</option>
              <option value="NO_STOCK">🔴 Sin Stock</option>
              <option value="OVER_STOCK">🔵 Sobre Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. TABLA MODERNA ESTILO POS */}
      {isStocksLoading ? (
        <div className="min-h-[250px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      ) : filteredStocks.length === 0 ? (
        <div className="min-h-[280px] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
          <Boxes className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No existen movimientos de stock para mostrar</h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            Prueba variando los parámetros de búsqueda o los filtros seleccionados.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse table-fixed min-w-[1250px] lg:min-w-0">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="px-3.5 py-3.5">Producto</th>
                  <th className="px-3 py-3.5 w-28">Código Interno</th>
                  <th className="px-3 py-3.5 w-32">Código de Barras</th>
                  <th className="px-3 py-3.5 w-32">Categoría</th>
                  <th className="px-3 py-3.5 w-32">Proveedor</th>
                  <th className="px-3 py-3.5 w-24">Unidad</th>
                  <th className="px-3 py-3.5 w-24 text-center">Venta sin Stock</th>
                  <th className="px-3 py-3.5 w-32">Depósito</th>
                  <th className="px-2.5 py-3.5 text-right w-24">Disponible</th>
                  <th className="px-2 py-3.5 text-right w-20">Mínimo</th>
                  <th className="px-2 py-3.5 text-right w-20">Máximo</th>
                  <th className="px-2.5 py-3.5 text-center w-28">Nivel de Stock</th>
                  <th className="px-2.5 py-3.5 text-center w-28">Estado</th>
                  <th className="px-3 py-3.5 text-center w-36">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-medium">
                {filteredStocks.map((s) => {
                  const qty = Number(s.quantity);
                  const minStock = Number(s.minimumStock);
                  const maxStock = Number(s.maximumStock);
                  const supplierNames = (() => {
                    const prod = s.product as any;
                    if (prod?.suppliers && prod.suppliers.length > 0) {
                      const names = prod.suppliers
                        .map((sup: any) => typeof sup === 'string' ? sup : (sup.name || sup.supplier?.name))
                        .filter(Boolean);
                      if (names.length > 0) return names.join(', ');
                    }
                    if (prod?.productSuppliers && prod.productSuppliers.length > 0) {
                      const names = prod.productSuppliers
                        .map((ps: any) => ps.supplier?.name || ps.name)
                        .filter(Boolean);
                      if (names.length > 0) return names.join(', ');
                    }
                    if (prod?.supplier?.name) {
                      return prod.supplier.name;
                    }
                    return '—';
                  })();

                  // Calculation for visual progress bar
                  let progressPct = 0;
                  let barColor = 'bg-emerald-500';
                  if (qty <= 0) {
                    progressPct = 0;
                    barColor = 'bg-rose-500';
                  } else if (qty <= minStock) {
                    progressPct = minStock > 0 ? Math.min(100, Math.max(10, (qty / minStock) * 50)) : 25;
                    barColor = 'bg-amber-500';
                  } else if (maxStock > 0 && qty >= maxStock) {
                    progressPct = 100;
                    barColor = 'bg-blue-500';
                  } else if (maxStock > 0) {
                    progressPct = Math.min(100, Math.max(15, (qty / maxStock) * 100));
                    barColor = 'bg-emerald-500';
                  } else {
                    progressPct = 75;
                    barColor = 'bg-emerald-500';
                  }

                  const targetLabel = maxStock > 0
                    ? `${formatUnitQty(qty, s.product?.unitOfMeasure)} / ${formatUnitQty(maxStock, s.product?.unitOfMeasure)}`
                    : (minStock > 0 ? `${formatUnitQty(qty, s.product?.unitOfMeasure)} / ${formatUnitQty(minStock, s.product?.unitOfMeasure)}` : `${formatUnitQty(qty, s.product?.unitOfMeasure)}`);

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Producto */}
                      <td className="px-3.5 py-3 overflow-hidden">
                        <div className="font-bold text-slate-900 dark:text-white leading-snug truncate">
                          {s.product?.name || 'Producto sin nombre'}
                        </div>
                      </td>

                      {/* Código Interno */}
                      <td className="px-3 py-3 overflow-hidden">
                        <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 truncate block">
                          {s.product?.sku || <span className="italic text-slate-400 font-normal opacity-60">—</span>}
                        </span>
                      </td>

                      {/* Código de Barras */}
                      <td className="px-3 py-3 overflow-hidden">
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate block">
                          {s.product?.barcode || <span className="italic text-slate-400 font-normal opacity-60">—</span>}
                        </span>
                      </td>

                      {/* Categoría */}
                      <td className="px-3 py-3 overflow-hidden">
                        <span className="inline-flex items-center gap-1 text-slate-800 dark:text-slate-200 font-semibold truncate w-full text-xs">
                          <span className="text-xs">🥃</span>
                          <span className="truncate">{s.product?.category?.name || 'Sin Categoría'}</span>
                        </span>
                      </td>

                      {/* Proveedor */}
                      <td className="px-3 py-3 overflow-hidden">
                        <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 text-xs truncate w-full">
                          <span className="text-xs">🏭</span>
                          <span className="truncate">{supplierNames}</span>
                        </span>
                      </td>

                      {/* Unidad de Venta */}
                      <td className="px-3 py-3 overflow-hidden">
                        {(() => {
                          const u = String(s.product?.unitOfMeasure || 'UNIT').toUpperCase();
                          if (u === 'KG' || u === 'KILOGRAM' || u === 'KILOGRAMO') {
                            return (
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                <span>⚖️</span>
                                <span>Kg</span>
                              </span>
                            );
                          }
                          if (u === 'G' || u === 'GRAM' || u === 'GRAMOS') {
                            return (
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                <span>⚖️</span>
                                <span>Gramo</span>
                              </span>
                            );
                          }
                          if (u === 'LT' || u === 'L' || u === 'LITER' || u === 'LITRO') {
                            return (
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                <span>🧴</span>
                                <span>Litro</span>
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                              <span>📦</span>
                              <span>Unidad</span>
                            </span>
                          );
                        })()}
                      </td>

                      {/* Venta sin Stock */}
                      <td className="px-3 py-3 text-center overflow-hidden">
                        <span className="text-sm select-none" title={s.product?.allowSaleWithoutStock ? 'Venta sin stock permitida' : 'Venta sin stock bloqueada'}>
                          {s.product?.allowSaleWithoutStock ? '🟢' : '🔴'}
                        </span>
                      </td>

                      {/* Depósito */}
                      <td className="px-3 py-3 overflow-hidden">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 truncate w-full text-xs">
                          <span className="shrink-0">🏬</span>
                          <span className="truncate">{s.warehouse?.name || '—'}</span>
                        </span>
                      </td>

                      {/* Disponible */}
                      <td className="px-2.5 py-3 text-right font-mono font-black text-xs text-slate-900 dark:text-white truncate">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md ${
                            qty <= 0
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                          }`}
                        >
                          {formatUnitQty(qty, s.product?.unitOfMeasure)}
                        </span>
                      </td>

                      {/* Mínimo */}
                      <td className="px-2 py-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400 truncate">
                        {minStock > 0 ? formatUnitQty(minStock, s.product?.unitOfMeasure) : <span className="italic opacity-60">—</span>}
                      </td>

                      {/* Máximo */}
                      <td className="px-2 py-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400 truncate">
                        {maxStock > 0 ? formatUnitQty(maxStock, s.product?.unitOfMeasure) : <span className="italic opacity-60">—</span>}
                      </td>

                      {/* Nivel de Stock */}
                      <td className="px-2.5 py-3 text-center overflow-hidden">
                        <div className="w-full max-w-[100px] mx-auto">
                          <div className="w-full bg-slate-200/80 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${barColor} transition-all duration-300 rounded-full`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 mt-1 block text-center truncate">
                            {targetLabel}
                          </span>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-2.5 py-3 text-center overflow-hidden">
                        {getStockBadge(qty, minStock, maxStock)}
                      </td>

                      {/* Acciones Directas */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => handleOpenAdjustModal(s)}
                            title="Ajustar Stock"
                            className="px-2.5 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 border border-amber-200/80 dark:border-amber-800/50 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                          >
                            <Boxes className="w-3.5 h-3.5" />
                            <span>Ajustar Stock</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {adjustingStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-205 dark:border-slate-800 shadow-2xl p-6 overflow-y-auto max-h-[95vh]">
            {/* Close button */}
            <button
              onClick={handleCloseModal}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white pr-6 flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary-500" />
              Ajuste Manual de Existencias
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Modifica directamente las existencias de este depósito. Esta operación registrará la auditoría obligatoria.
            </p>

            {/* Read-Only Details */}
            <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-2.5">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-xs text-slate-450 uppercase block font-semibold tracking-wide">Producto</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{adjustingStock.product?.name}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-450 uppercase block font-semibold tracking-wide">Depósito</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{adjustingStock.warehouse?.name}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm pt-2.5 border-t border-slate-200 dark:border-slate-700/50">
                <div>
                  <span className="text-xs text-slate-450 uppercase block font-semibold tracking-wide">Cantidad Actual</span>
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                    {Number(adjustingStock.quantity).toLocaleString(undefined, { minimumFractionDigits: 3 })}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-450 uppercase block font-semibold tracking-wide">Reservada</span>
                  <span className="font-mono text-base text-slate-550 dark:text-slate-400">
                    {Number(adjustingStock.reservedQuantity).toLocaleString(undefined, { minimumFractionDigits: 3 })}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmitAdjust)} className="mt-5 space-y-4">
              {apiError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg text-sm text-red-650 dark:text-red-400 font-medium">
                  {apiError}
                </div>
              )}

              {/* Adjust Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Nueva Cantidad *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    {...register('quantity', { valueAsNumber: true })}
                    className={`w-full px-3.5 py-2.5 bg-transparent border rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono ${
                      errors.quantity ? 'border-red-500' : 'border-slate-350 dark:border-slate-800'
                    }`}
                  />
                  {errors.quantity && (
                    <p className="mt-1 text-xs text-red-500 font-medium">{errors.quantity.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Cantidad Reservada
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    {...register('reservedQuantity', { valueAsNumber: true })}
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                  />
                </div>
              </div>

              {/* Stock Alerts limits (minimumStock / maximumStock) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    Stock Mínimo Alerta
                    <HelpTooltip content="Nivel de stock bajo el cual el sistema generará alertas de reabastecimiento." />
                  </label>
                  <input
                    type="number"
                    {...register('minimumStock', { valueAsNumber: true })}
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    Stock Máximo Alerta
                    <HelpTooltip content="Límite superior recomendado para evitar excesos de inventario." />
                  </label>
                  <input
                    type="number"
                    {...register('maximumStock', { valueAsNumber: true })}
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                  />
                </div>
              </div>

              {/* Preset Reason Selector + Text */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Seleccione Motivo de Ajuste *
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value !== 'OTHER') {
                      setValue('changeReason', e.target.value);
                    } else {
                      setValue('changeReason', '');
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
                >
                  <option value="">-- Elija un motivo predefinido o edite abajo --</option>
                  {predefinedReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                  <option value="OTHER">Otro motivo personalizado...</option>
                </select>

                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Detalle del Motivo / Notas escritas *
                </label>
                <input
                  type="text"
                  {...register('changeReason')}
                  placeholder="Ej: Corrección por rotura de stock durante carga manual"
                  className={`w-full px-3.5 py-2.5 bg-transparent border rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                    errors.changeReason ? 'border-red-500 focus:ring-red-500' : 'border-slate-350 dark:border-slate-800'
                  }`}
                />
                {errors.changeReason && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{errors.changeReason.message}</p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" variant="outline" onClick={handleCloseModal} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Aplicando...
                    </div>
                  ) : (
                    'Aplicar Ajuste'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {viewingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <button
              onClick={() => setViewingProduct(null)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 pr-6">
              <span>📦</span> {viewingProduct.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Ficha comercial del producto
            </p>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block">Código Interno (SKU)</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{viewingProduct.sku || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Código de Barras</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{viewingProduct.barcode || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Categoría</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingProduct.category?.name || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Proveedor</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {viewingProduct.suppliers && viewingProduct.suppliers.length > 0
                      ? viewingProduct.suppliers.map((s: any) => s.name).join(', ')
                      : (viewingProduct.supplier?.name || '—')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Unidad de Venta</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingProduct.unitOfMeasure || 'UNIT'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Venta sin Stock</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {viewingProduct.allowSaleWithoutStock ? '✅ Permitida' : '🔒 Bloqueada'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => setViewingProduct(null)} variant="secondary" className="text-xs">
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
