import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Edit2, Trash2, Search, X, Loader2, Package, Tag, Filter, AlertTriangle, Calculator, Boxes, Warehouse, ClipboardList } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { productApi, Product } from '../services/product.service';
import { categoryApi } from '../services/category.service';
import { supplierApi } from '../services/supplier.service';
import { stockApi } from '../services/stock.service';
import { stockMovementApi } from '../services/stockMovement.service';
import { warehouseApi } from '../services/warehouse.service';
import { purchaseApi } from '../services/purchase.service';
import { Button } from '../components/ui/Button';
import { DataGrid, Column } from '../components/ui/DataGrid';
import { SearchInput } from '../components/ui/SearchInput';
import { FiltersBar } from '../components/ui/FiltersBar';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Badge } from '../components/ui/Badge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Tabs } from '../components/ui/Tabs';
import { PageHeader } from '../components/ui/PageHeader';

const createProductFormSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  sku: z.string().optional().nullable().or(z.literal('')),
  barcode: z.string().optional().nullable().or(z.literal('')),
  categoryId: z.string().uuid('Debes seleccionar una categoría'),
  supplierId: z.string().optional().nullable().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).default('ACTIVE'),
  purchasePrice: z.coerce.number().min(0, 'El precio de compra no puede ser menor a 0'),
  profitMargin: z.coerce.number().min(0, 'El margen no puede ser negativo').default(30),
  salePrice: z.coerce.number().min(0, 'El precio de venta no puede ser menor a 0'),
  description: z.string().optional().nullable(),
});

const editProductFormSchema = createProductFormSchema.extend({
  changeReason: z.string().min(4, 'El motivo del cambio debe tener al menos 4 caracteres'),
});

type CreateProductFormData = z.infer<typeof createProductFormSchema>;
type EditProductFormData = z.infer<typeof editProductFormSchema>;

export const Products: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'info' | 'stock' | 'kardex' | 'purchases'>('info');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [manualSalePrice, setManualSalePrice] = useState(false);

  const canCreate = hasPermission('products:create');
  const canUpdate = hasPermission('products:update');
  const canDelete = hasPermission('products:delete');

  const currentSchema = editingProduct ? editProductFormSchema : createProductFormSchema;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EditProductFormData>({
    resolver: zodResolver(currentSchema as any),
    defaultValues: {
      name: '',
      sku: '',
      barcode: '',
      categoryId: '',
      supplierId: '',
      status: 'ACTIVE',
      purchasePrice: 0,
      profitMargin: 30,
      salePrice: 0,
      description: '',
      changeReason: '',
    },
  });

  const purchasePrice = useWatch({ control, name: 'purchasePrice' });
  const profitMargin = useWatch({ control, name: 'profitMargin' });

  // Auto-calculate sale price when purchasePrice or profitMargin changes
  useEffect(() => {
    if (!manualSalePrice) {
      const purchase = Number(purchasePrice) || 0;
      const margin = Number(profitMargin) || 0;
      const calculated = Math.round(purchase * (1 + margin / 100) * 100) / 100;
      setValue('salePrice', calculated);
    }
  }, [purchasePrice, profitMargin, manualSalePrice, setValue]);

  // Queries
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => productApi.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryApi.list,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: supplierApi.list,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: productApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.message || 'Error al crear el producto');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.message || 'Error al actualizar el producto');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: productApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'No se pudo eliminar el producto');
      setDeleteTarget(null);
    },
  });

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setActiveModalTab('info');
    setApiError(null);
    setManualSalePrice(false);
    reset({
      name: '',
      sku: '',
      barcode: '',
      categoryId: '',
      supplierId: '',
      status: 'ACTIVE',
      purchasePrice: 0,
      profitMargin: 30,
      salePrice: 0,
      description: '',
      changeReason: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setActiveModalTab('info');
    setApiError(null);
    setManualSalePrice(true); // Don't auto-calculate for edits, preserve existing price
    setValue('name', product.name);
    setValue('sku', product.sku || '');
    setValue('barcode', product.barcode || '');
    setValue('categoryId', product.categoryId);
    setValue('supplierId', product.supplierId || '');
    setValue('status', product.status);
    setValue('purchasePrice', product.purchasePrice || 0);
    setValue('profitMargin', product.profitMargin || 30);
    setValue('salePrice', product.salePrice || 0);
    setValue('description', product.description || '');
    setValue('changeReason', '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setApiError(null);
    setManualSalePrice(false);
    reset();
  };

  const onSubmit = async (data: EditProductFormData) => {
    setApiError(null);
    const payload = {
      ...data,
      sku: data.sku || null,
      barcode: data.barcode || null,
      supplierId: data.supplierId || null,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: payload });
    } else {
      // Remove changeReason for create
      const { changeReason, ...createPayload } = payload;
      createMutation.mutate(createPayload);
    }
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  };

  // When user manually changes sale price, mark it
  const handleSalePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualSalePrice(true);
    setValue('salePrice', Number(e.target.value) || 0);
  };

  // When user changes margin, recalculate
  const handleMarginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualSalePrice(false);
    setValue('profitMargin', Number(e.target.value) || 0);
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const matchesCategory = categoryFilter === 'ALL' || p.categoryId === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const formatCurrency = (value?: number | null) => {
    if (value === undefined || value === null) return '$0.00';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Catálogo de Productos"
        subtitle="Gestiona el inventario de artículos comercializados, SKU, códigos de barra y políticas de precio."
        action={
          canCreate ? (
            <Button onClick={handleOpenCreateModal} leftIcon={<Plus className="h-4 w-4" />}>
              Nuevo Producto
            </Button>
          ) : undefined
        }
      />

      {/* Filters Area */}
      <div className="bg-white dark:bg-slate-905 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU, código barra..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-355 dark:border-slate-800 rounded-lg bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-sm bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg py-1.5 px-3 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="ALL">Todas las Categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm bg-transparent border border-slate-355 dark:border-slate-800 rounded-lg py-1.5 px-3 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
            <option value="DRAFT">Borrador</option>
          </select>

          {(searchTerm.trim() || categoryFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 px-2 py-1 transition-colors"
            >
              Limpiar filtros
            </button>
          )}

          <div className="text-xs text-slate-500 dark:text-slate-400 pl-2">
            Total: {filteredProducts.length} productos
          </div>
        </div>
      </div>

      {/* Main product list table */}
      {loadingProducts ? (
        <div className="min-h-[250px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="min-h-[250px] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
          <Package className="h-12 w-12 text-slate-400 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">No hay productos registrados</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            {searchTerm || categoryFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Prueba variando los parámetros de filtros aplicados.'
              : 'Comienza creando y catalogando tus primeros productos.'}
          </p>
          {canCreate && !searchTerm && categoryFilter === 'ALL' && statusFilter === 'ALL' && (
            <Button onClick={handleOpenCreateModal} className="mt-4 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Producto
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Producto</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Código de barras</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Categoría</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Proveedor</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">P. Compra</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">P. Venta</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado</th>
                  {(canUpdate || canDelete) && (
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-920/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-500">
                          <Package className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">{product.name}</div>
                          {product.description && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">{product.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                      {product.sku || <span className="text-slate-400 italic">Sin SKU</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                      {product.barcode || <span className="text-slate-400 italic">Sin Cód. Barra</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                      {product.category?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                      {product.supplier?.name || <span className="text-slate-400 italic">-</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-705 dark:text-slate-350">
                      {formatCurrency(product.purchasePrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-955 dark:text-white">
                      {formatCurrency(product.salePrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`font-semibold ${(product.totalStock || 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                        {product.totalStock !== undefined ? product.totalStock : 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          product.status === 'ACTIVE'
                            ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                            : product.status === 'INACTIVE'
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                            : 'bg-slate-100 text-slate-705 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {product.status === 'ACTIVE' ? 'Activo' : product.status === 'INACTIVE' ? 'Inactivo' : 'Borrador'}
                      </span>
                    </td>
                    {(canUpdate || canDelete) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end gap-2">
                          {canUpdate && (
                            <button
                              onClick={() => handleOpenEditModal(product)}
                              className="p-1.5 text-slate-400 hover:text-primary-600 dark:text-slate-500 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteTarget(product)}
                              className="p-1.5 text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className={`relative w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-205 dark:border-slate-800 shadow-2xl p-6 overflow-y-auto max-h-[90vh] transition-all duration-350 ${
            activeModalTab === 'info' ? 'max-w-lg' : 'max-w-3xl'
          }`}>
            <button
              onClick={handleCloseModal}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white pr-6">
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            {editingProduct && (
              <div className="flex border-b border-slate-200 dark:border-slate-800 my-4">
                <button
                  type="button"
                  onClick={() => setActiveModalTab('info')}
                  className={`flex-1 pb-2 text-center text-sm font-semibold border-b shadow-none transition-all ${
                    activeModalTab === 'info'
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-705 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Información General
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('stock')}
                  className={`flex-1 pb-2 text-center text-sm font-semibold border-b shadow-none transition-all ${
                    activeModalTab === 'stock'
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-705 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Existencias en Depósitos
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('kardex')}
                  className={`flex-1 pb-2 text-center text-sm font-semibold border-b shadow-none transition-all ${
                    activeModalTab === 'kardex'
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-705 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Kardex / Movimientos
                </button>
                {hasPermission('purchases:read') && (
                  <button
                    type="button"
                    onClick={() => setActiveModalTab('purchases')}
                    className={`flex-1 pb-2 text-center text-sm font-semibold border-b shadow-none transition-all ${
                      activeModalTab === 'purchases'
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-bold'
                        : 'border-transparent text-slate-500 hover:text-slate-705 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    Historial Compras
                  </button>
                )}
              </div>
            )}

            {(!editingProduct || activeModalTab === 'info') ? (
              <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
                {apiError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg text-sm text-red-655 dark:text-red-450 font-medium">
                  {apiError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Nombre del Producto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('name')}
                  placeholder="Ej: Remera Negra XL"
                  className={`w-full px-3.5 py-2.5 bg-transparent border rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                    errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-350 dark:border-slate-800'
                  }`}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500 font-medium">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    SKU
                  </label>
                  <input
                    type="text"
                    {...register('sku')}
                    placeholder="Ej: CL-REM-001 (Opcional)"
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Código de Barras
                  </label>
                  <input
                    type="text"
                    {...register('barcode')}
                    placeholder="Ej: 7791234567890 (Opcional)"
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Categoría <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('categoryId')}
                    className={`w-full px-3.5 py-2.5 bg-transparent border rounded-lg text-sm text-slate-705 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                      errors.categoryId ? 'border-red-500 focus:ring-red-500' : 'border-slate-350 dark:border-slate-800'
                    }`}
                  >
                    <option value="">Selecciona una categoría</option>
                    {categories.filter(c => c.status !== 'INACTIVE').map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {errors.categoryId && <p className="mt-1 text-xs text-red-500 font-medium">{errors.categoryId.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Proveedor
                  </label>
                  <select
                    {...register('supplierId')}
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-705 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  >
                    <option value="">Ningún proveedor</option>
                    {suppliers.filter(s => s.isActive).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price Calculation Section */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <Calculator className="h-4 w-4 text-primary-500" />
                  Cálculo de Precios
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      P. Compra <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('purchasePrice')}
                      placeholder="0.00"
                      className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                        errors.purchasePrice ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {errors.purchasePrice && <p className="mt-1 text-xs text-red-500 font-medium">{errors.purchasePrice.message}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Margen %
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('profitMargin')}
                      onChange={handleMarginChange}
                      placeholder="30"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      P. Venta <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('salePrice')}
                      onChange={handleSalePriceChange}
                      placeholder="0.00"
                      className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                        errors.salePrice ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {errors.salePrice && <p className="mt-1 text-xs text-red-500 font-medium">{errors.salePrice.message}</p>}
                  </div>
                </div>
                {!manualSalePrice && (
                  <p className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1">
                    <Calculator className="h-3 w-3" />
                    Precio de venta calculado automáticamente con margen del {profitMargin || 30}%
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Estado del Producto
                </label>
                <select
                  {...register('status')}
                  className="w-full px-3.5 py-2.5 bg-transparent border border-slate-355 dark:border-slate-800 rounded-lg text-sm text-slate-705 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                  <option value="DRAFT">Borrador</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Descripción / Especificaciones
                </label>
                <textarea
                  placeholder="Detalles sobre talles, colores, origen..."
                  rows={2}
                  {...register('description')}
                  className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              {/* Change Reason (only for edit) */}
              {editingProduct && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg p-4">
                  <label className="block text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-2">
                    Motivo del Cambio <span className="text-red-500">*</span>
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setValue('changeReason', e.target.value);
                      } else {
                        setValue('changeReason', '');
                      }
                    }}
                    className="w-full mb-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  >
                    <option value="">Selecciona un motivo (*obligatorio)</option>
                    <option value="Aumento proveedor">Aumento proveedor</option>
                    <option value="Corrección de precio">Corrección de precio</option>
                    <option value="Oferta">Oferta</option>
                    <option value="Cambio de proveedor">Cambio de proveedor</option>
                    <option value="Aumento de costo">Aumento de costo</option>
                    <option value="Ajuste de stock mínimo">Ajuste de stock mínimo</option>
                    <option value="custom">Otro motivo (escribir)</option>
                  </select>
                  <input
                    type="text"
                    {...register('changeReason')}
                    placeholder="Describe el motivo del cambio..."
                    className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all ${
                      errors.changeReason ? 'border-red-500 focus:ring-red-500' : 'border-amber-300 dark:border-amber-700'
                    }`}
                  />
                  {errors.changeReason && (
                    <p className="mt-1 text-xs text-red-500 font-medium">{errors.changeReason.message}</p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={handleCloseModal} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando...
                    </div>
                  ) : (
                    'Guardar Producto'
                  )}
                </Button>
              </div>
            </form>
            ) : activeModalTab === 'stock' ? (
              <div className="mt-4">
                {editingProduct && <ProductStockTab productId={editingProduct.id} />}
                <div className="flex justify-end gap-3 pt-3 mt-6 border-t border-slate-100 dark:border-slate-800">
                  <Button type="button" onClick={handleCloseModal}>
                    Cerrar
                  </Button>
                </div>
              </div>
            ) : activeModalTab === 'kardex' ? (
              <div className="mt-4">
                {editingProduct && <ProductKardexTab productId={editingProduct.id} />}
                <div className="flex justify-end gap-3 pt-3 mt-6 border-t border-slate-150 dark:border-slate-800">
                  <Button type="button" onClick={handleCloseModal}>
                    Cerrar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                {editingProduct && <ProductPurchasesTab productId={editingProduct.id} />}
                <div className="flex justify-end gap-3 pt-3 mt-6 border-t border-slate-150 dark:border-slate-800">
                  <Button type="button" onClick={handleCloseModal}>
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center">
            <div className="mx-auto h-12 w-12 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">¿Está seguro de eliminar este producto?</h3>
            <div className="mt-3 space-y-2 text-left bg-slate-50 dark:bg-slate-800/40 rounded-lg p-3">
              <div className="text-sm">
                <span className="text-slate-500">Producto: </span>
                <span className="font-semibold text-slate-900 dark:text-white">{deleteTarget.name}</span>
              </div>
              {deleteTarget.sku && (
                <div className="text-sm">
                  <span className="text-slate-500">SKU: </span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{deleteTarget.sku}</span>
                </div>
              )}
            </div>
            <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg">
              <p className="text-xs text-amber-800 dark:text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                La eliminación puede afectar registros históricos. Si el producto posee movimientos, será desactivado.
              </p>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={confirmDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Eliminando...' : 'Sí, Eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ProductStockTab: React.FC<{ productId: string }> = ({ productId }) => {
  const { data: productStocks = [], isLoading } = useQuery({
    queryKey: ['product-stocks', productId],
    queryFn: () => stockApi.listByProduct(productId),
  });

  if (isLoading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
        Existencias de este artículo en cada depósito:
      </div>
      {productStocks.length === 0 ? (
        <div className="text-center py-6 text-slate-500 dark:text-slate-450 italic border border-dashed border-slate-205 dark:border-slate-800 rounded-lg">
          No hay depósitos registrados con stock de este producto.
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800 shadow-sm">
          {productStocks.map((s: any) => {
            const qty = Number(s.quantity);
            const min = Number(s.minimumStock);
            let statusBadge = (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 border border-green-200 dark:border-green-800/30">
                OK
              </span>
            );
            if (qty <= 0) {
              statusBadge = (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border border-red-200 dark:border-red-800/30">
                  Sin Stock
                </span>
              );
            } else if (qty <= min) {
              statusBadge = (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
                  Bajo
                </span>
              );
            }
            return (
              <div key={s.id} className="p-3 bg-slate-50/20 dark:bg-slate-900/10 flex items-center justify-between text-sm hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                <div className="space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                    <Warehouse className="h-4 w-4 text-slate-400" />
                    {s.warehouse?.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Mín: {Number(s.minimumStock)} | Máx: {Number(s.maximumStock)}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="font-mono font-bold text-slate-900 dark:text-white">
                    {qty.toLocaleString(undefined, { minimumFractionDigits: 3 })}
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    {Number(s.reservedQuantity) > 0 && (
                      <span className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        Res: {Number(s.reservedQuantity)}
                      </span>
                    )}
                    {statusBadge}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ProductKardexTab: React.FC<{ productId: string }> = ({ productId }) => {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchReason, setSearchReason] = useState<string>('');

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: warehouseApi.list,
  });

  const { data: movementsData, isLoading } = useQuery({
    queryKey: ['product-kardex', productId, selectedWarehouse, selectedType, searchReason],
    queryFn: () =>
      stockMovementApi.list({
        productId,
        warehouseId: selectedWarehouse !== 'ALL' ? selectedWarehouse : undefined,
        movementType: selectedType !== 'ALL' ? selectedType : undefined,
        search: searchReason || undefined,
        limit: 100, // retrieve up to 100 entries for product detail view
      }),
  });

  const movements = movementsData?.data || [];

  if (isLoading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-primary-500 animate-spin" />
      </div>
    );
  }

  const getMovementTypeBadge = (type: string) => {
    switch (type) {
      case 'ENTRY':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400">ING</span>;
      case 'EXIT':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400">EGR</span>;
      case 'ADJUSTMENT':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">AJU</span>;
      case 'INVENTORY':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 font-bold">REC</span>;
      default:
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">TRA</span>;
    }
  };

  return (
    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
      {/* Search and Filters inline */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/60 shadow-sm">
        <div>
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-slate-350 dark:border-slate-800 rounded bg-transparent text-xs text-slate-705 dark:text-slate-300 focus:outline-none"
          >
            <option value="ALL">Todos los Depósitos</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-slate-350 dark:border-slate-800 rounded bg-transparent text-xs text-slate-705 dark:text-slate-300 focus:outline-none"
          >
            <option value="ALL">Todos los Tipos</option>
            <option value="ENTRY">Ingresos</option>
            <option value="EXIT">Egresos</option>
            <option value="ADJUSTMENT">Ajustes</option>
            <option value="INVENTORY">Recuentos</option>
            <option value="TRANSFER_IN">Traslados (+)</option>
            <option value="TRANSFER_OUT">Traslados (-)</option>
          </select>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por motivo..."
            value={searchReason}
            onChange={(e) => setSearchReason(e.target.value)}
            className="w-full pl-7 pr-2.5 py-1.5 border border-slate-350 dark:border-slate-800 rounded bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-450 focus:outline-none"
          />
        </div>
      </div>

      {movements.length === 0 ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400 italic border border-dashed border-slate-205 dark:border-slate-850 rounded-lg text-xs">
          No hay movimientos históricos registrados que coincidan.
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full border-collapse text-left text-xs bg-white dark:bg-slate-900 font-sans">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <th className="px-3 py-2 text-slate-500 font-semibold uppercase">Fecha</th>
                <th className="px-3 py-2 text-slate-500 font-semibold uppercase">Depósito</th>
                <th className="px-3 py-2 text-slate-500 font-semibold uppercase text-center">Tipo</th>
                <th className="px-3 py-2 text-slate-500 font-semibold uppercase text-right">Cant.</th>
                <th className="px-3 py-2 text-slate-500 font-semibold uppercase text-right font-mono">Stock Act.</th>
                <th className="px-3 py-2 text-slate-500 font-semibold uppercase">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-slate-800 font-medium">
              {movements.map((m: any) => {
                const qty = Number(m.quantity);
                return (
                  <tr key={m.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10">
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleDateString(undefined, { dateStyle: 'short' })}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 truncate max-w-[100px]" title={m.warehouse?.name}>
                      {m.warehouse?.name}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {getMovementTypeBadge(m.movementType)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-bold whitespace-nowrap ${
                      qty > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600'
                    }`}>
                      {qty > 0 ? '+' : ''}
                      {qty.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white whitespace-nowrap">
                      {Number(m.stockAfter).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[140px] truncate" title={m.reason || m.notes || 'Ajuste'}>
                      {m.reason || m.notes || 'Ajuste manual'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const ProductPurchasesTab: React.FC<{ productId: string }> = ({ productId }) => {
  const { data: purchaseHistory, isLoading } = useQuery({
    queryKey: ['product-purchases-history', productId],
    queryFn: () => purchaseApi.getProductPurchaseHistory(productId),
  });

  if (isLoading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-primary-500 animate-spin" />
      </div>
    );
  }

  const history = purchaseHistory || {
    purchases: [],
    statistics: { averageCost: 0, lastPurchasePrice: 0, lastPurchaseDate: null, totalQuantityPurchased: 0 }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(val);
  };

  return (
    <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-1">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-primary-50 dark:bg-primary-950/40 rounded-lg text-primary-600">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase">Costo Promedio</span>
            <span className="text-base font-extrabold text-slate-900 dark:text-white">
              {formatCurrency(history.statistics.averageCost)}
            </span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-green-50 dark:bg-green-950/40 rounded-lg text-green-600">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase">Último Costo</span>
            <span className="text-base font-extrabold text-slate-900 dark:text-white">
              {formatCurrency(history.statistics.lastPurchasePrice)}
            </span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-yellow-50 dark:bg-yellow-950/40 rounded-lg text-yellow-600">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase">Total Comprado</span>
            <span className="text-base font-extrabold text-slate-900 dark:text-white">
              {Number(history.statistics.totalQuantityPurchased).toLocaleString()} ud
            </span>
          </div>
        </div>
      </div>

      {/* Detail list of purchase history */}
      {history.purchases.length === 0 ? (
        <div className="text-center py-8 text-slate-400 italic border border-dashed border-slate-205 dark:border-slate-850 rounded-xl text-xs">
          No hay órdenes de compra registradas aprobadas asociadas a este producto.
        </div>
      ) : (
        <div className="border border-slate-205 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-xs bg-white dark:bg-slate-900">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Nro Compra</th>
                <th className="py-2.5 px-3">Proveedor</th>
                <th className="py-2.5 px-3 text-right">Cant.</th>
                <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                <th className="py-2.5 px-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {history.purchases.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-850/10">
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                    {new Date(p.purchaseDate).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-primary-600 dark:text-primary-400 whitespace-nowrap">
                    {p.purchaseNumber}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white truncate max-w-[150px]">
                    {p.supplierName}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                    {Number(p.quantity)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                    {formatCurrency(Number(p.unitCost))}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {formatCurrency(Number(p.subtotal))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

