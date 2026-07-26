import React, { useState } from 'react';
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
  Truck
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

export const Stocks: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  // Queries
  const { data: stocks = [], isLoading: isStocksLoading } = useQuery({
    queryKey: ['stocks'],
    queryFn: stockApi.list,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryApi.list,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: supplierApi.list,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: warehouseApi.list,
  });

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  
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
      <PageHeader
        title="Control de Stock por Depósito"
        subtitle="Valores de stock centralizados e integrados. Conserve la trazabilidad e historial por sucursal."
      />

      {/* Filters bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Term */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por producto, SKU, código de barras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-350 dark:border-slate-800 rounded-lg bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
          </div>

          {/* Depot filter */}
          <div className="flex items-center gap-2">
            <Warehouse className="h-4.5 w-4.5 text-slate-400" />
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-350 dark:border-slate-800 rounded-lg bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="ALL">Todos los Depósitos</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.isMain ? '(Principal)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2">
            <Layers className="h-4.5 w-4.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-350 dark:border-slate-800 rounded-lg bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="ALL">Todas las Categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          {/* Supplier filter */}
          <div className="flex items-center gap-2">
            <Truck className="h-4.5 w-4.5 text-slate-400" />
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-350 dark:border-slate-800 rounded-lg bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="ALL">Todos los Proveedores</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4.5 w-4.5 text-slate-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-350 dark:border-slate-800 rounded-lg bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="ALL">Todos los Estados (Stock)</option>
              <option value="OK">Stock OK (Correcto)</option>
              <option value="LOW_STOCK">Stock Bajo</option>
              <option value="NO_STOCK">Sin Stock (Existencia en cero)</option>
              <option value="OVER_STOCK">Sobre Stock</option>
            </select>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            {(searchTerm.trim() || selectedWarehouse !== 'ALL' || selectedCategory !== 'ALL' || selectedSupplier !== 'ALL' || selectedStatus !== 'ALL') ? (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedWarehouse('ALL');
                  setSelectedCategory('ALL');
                  setSelectedSupplier('ALL');
                  setSelectedStatus('ALL');
                }}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 px-2 py-1 transition-colors"
              >
                Limpiar filtros
              </button>
            ) : <span />}
            <span>Mostrando {filteredStocks.length} combinaciones de stock</span>
          </div>
        </div>
      </div>

      {/* Grid List */}
      {isStocksLoading ? (
        <div className="min-h-[200px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl border border-slate-205 dark:border-slate-800 shadow-sm">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      ) : filteredStocks.length === 0 ? (
        <div className="min-h-[250px] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-202 dark:border-slate-800 shadow-sm text-center">
          <Boxes className="h-12 w-12 text-slate-400 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white font-medium">Búsqueda sin existencias</h3>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-400 max-w-xs">
            No se encontraron registros de stock que coincidan con los filtros seleccionados.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden shadow-md">
          <div className="overflow-x-auto font-sans">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Producto / SKU</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Depósito</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Disponible</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Reservado</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Min / Max</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Estado</th>
                  {canUpdate && (
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ajuste</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {filteredStocks.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-920/40 transition-colors">
                    {/* Product cell */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 rounded-lg flex items-center justify-center">
                          <Package className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {s.product?.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                            <span>SKU: {s.product?.sku || 'S/S'}</span>
                            {s.product?.barcode && <span>• Barcode: {s.product.barcode}</span>}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Depot cell */}
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-805 dark:text-slate-300 inline-flex items-center gap-1">
                        <Warehouse className="h-3.5 w-3.5 text-slate-450" />
                        {s.warehouse?.name}
                      </span>
                    </td>

                    {/* Quantity cell */}
                    <td className="px-6 py-4 text-right whitespace-nowrap font-mono font-semibold text-slate-905 dark:text-slate-100">
                      {Number(s.quantity).toLocaleString(undefined, { minimumFractionDigits: 3 })}
                    </td>

                    {/* ReservedQuantity cell */}
                    <td className="px-6 py-4 text-right whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                      {Number(s.reservedQuantity).toLocaleString(undefined, { minimumFractionDigits: 3 })}
                    </td>

                    {/* Min/Max values */}
                    <td className="px-6 py-4 text-right whitespace-nowrap font-mono text-xs text-slate-500 dark:text-slate-400">
                      <span>Mín: {Number(s.minimumStock).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      <span className="mx-1.5 opacity-40">|</span>
                      <span>Máx: {Number(s.maximumStock).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </td>

                    {/* Stock status badge */}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getStockBadge(Number(s.quantity), Number(s.minimumStock), Number(s.maximumStock))}
                    </td>

                    {/* Actions cell */}
                    {canUpdate && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => handleOpenAdjustModal(s)}
                          className="px-2.5 py-1.5 bg-slate-50 hover:bg-primary-50 dark:bg-slate-800 dark:hover:bg-primary-950/40 text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg border border-slate-202 dark:border-slate-700/60 hover:border-primary-201 dark:hover:border-primary-900/30 transition-all font-medium inline-flex items-center gap-1.5 shadow-sm"
                          title="Ajustar existencias e historial"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Ajustar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
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
    </div>
  );
};
