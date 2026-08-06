import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as XLSX from 'xlsx';
import { Plus, Edit2, Trash2, Search, X, Loader2, Package, Tag, Filter, AlertTriangle, Calculator, Boxes, Warehouse, ClipboardList, TrendingUp, Building2, MoreVertical, Copy, Eye, Download, Upload, History } from 'lucide-react';
import { BulkPriceUpdateView } from '../components/products/BulkPriceUpdateView';
import { ProductImportWizardModal } from '../components/products/ProductImportWizardModal';
import { ProductImportHistoryModal } from '../components/products/ProductImportHistoryModal';
import { useAuth } from '../contexts/AuthContext';
import { productApi, Product } from '../services/product.service';
import { categoryApi } from '../services/category.service';
import { supplierApi } from '../services/supplier.service';
import { stockApi } from '../services/stock.service';
import { stockMovementApi } from '../services/stockMovement.service';
import { warehouseApi } from '../services/warehouse.service';
import { purchaseApi } from '../services/purchase.service';
import api from '../services/api';
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
import { useNavigate } from 'react-router-dom';

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
  unitOfMeasure: z.enum(['UNIT', 'KG', 'G', 'L', 'GRAM', 'LITER', 'METER']).default('UNIT'),
  allowSaleWithoutStock: z.boolean().default(false),
  description: z.string().optional().nullable(),
});

const editProductFormSchema = createProductFormSchema.extend({
  changeReason: z.string().min(4, 'El motivo del cambio debe tener al menos 4 caracteres'),
});

type CreateProductFormData = z.infer<typeof createProductFormSchema>;
type EditProductFormData = z.infer<typeof editProductFormSchema>;

export const Products: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission, hasCapability } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'info' | 'stock' | 'kardex'>('info');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isBulkUpdateMode, setIsBulkUpdateMode] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [manualSalePrice, setManualSalePrice] = useState(false);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
  const [isImportHistoryOpen, setIsImportHistoryOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');

  const canCreate = hasCapability('products.create') || hasPermission('products:create');
  const canUpdate = hasCapability('products.update') || hasPermission('products:update');
  const canDelete = hasCapability('products.delete') || hasPermission('products:delete');
  const canImport = hasCapability('products.import') || hasPermission('products:create') || canCreate;

  const handleExportProducts = async () => {
    try {
      const items = await productApi.exportProducts(selectedWarehouse !== 'ALL' ? selectedWarehouse : undefined);

      if (!items || items.length === 0) {
        alert('No hay productos registrados en esta empresa para exportar.');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(items);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Catálogo');
      XLSX.writeFile(wb, `catalogo_productos_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err: any) {
      console.error('Error al exportar productos:', err);
      alert(err.response?.data?.message || 'Error al procesar la exportación del catálogo.');
    }
  };

  // Enterprise Granular Action Capabilities
  const canEditCost = hasCapability('products.edit_cost') || hasCapability('products.cost.update') || canUpdate;
  const canEditMargin = hasCapability('products.edit_margin') || canUpdate;
  const canEditPrice = hasCapability('products.edit_price') || canUpdate;
  const canEditName = hasCapability('products.edit_name') || canUpdate;
  const canEditBarcode = hasCapability('products.edit_barcode') || canUpdate;
  const canEditSupplier = hasCapability('products.edit_supplier') || canUpdate;
  const canEditCategory = hasCapability('products.edit_category') || canUpdate;

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

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: warehouseApi.list,
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
    setSelectedSupplierIds([]);
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
      unitOfMeasure: 'UNIT',
      allowSaleWithoutStock: false,
      description: '',
      changeReason: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    handleOpenModalWithTab(product, 'info');
  };

  const handleOpenModalWithTab = (product: Product, tab: 'info' | 'stock' | 'kardex') => {
    setEditingProduct(product);
    setActiveModalTab(tab);
    setApiError(null);
    setManualSalePrice(true);
    const initSuppliers = product.suppliers && product.suppliers.length > 0
      ? product.suppliers.map((s: any) => s.id)
      : (product.supplierId ? [product.supplierId] : []);
    setSelectedSupplierIds(initSuppliers);
    setValue('name', product.name);
    setValue('sku', product.sku || '');
    setValue('barcode', product.barcode || '');
    setValue('categoryId', product.categoryId);
    setValue('supplierId', product.supplierId || '');
    setValue('status', product.status);
    setValue('purchasePrice', product.purchasePrice || 0);
    setValue('profitMargin', product.profitMargin || 30);
    setValue('salePrice', product.salePrice || 0);
    setValue('unitOfMeasure', product.unitOfMeasure || 'UNIT');
    setValue('allowSaleWithoutStock', Boolean(product.allowSaleWithoutStock));
    setValue('description', product.description || '');
    setValue('changeReason', '');
    setIsModalOpen(true);
  };

  const handleDuplicateProduct = (product: Product) => {
    setEditingProduct(null);
    setActiveModalTab('info');
    setApiError(null);
    setManualSalePrice(true);
    const initSuppliers = product.suppliers && product.suppliers.length > 0
      ? product.suppliers.map((s: any) => s.id)
      : (product.supplierId ? [product.supplierId] : []);
    setSelectedSupplierIds(initSuppliers);
    setValue('name', `${product.name} (Copia)`);
    setValue('sku', product.sku ? `${product.sku}-COPY` : '');
    setValue('barcode', '');
    setValue('categoryId', product.categoryId);
    setValue('supplierId', product.supplierId || '');
    setValue('status', 'ACTIVE');
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
    setSelectedSupplierIds([]);
    reset();
  };

  const onSubmit = async (data: EditProductFormData) => {
    setApiError(null);
    const payload = {
      ...data,
      sku: data.sku || null,
      barcode: data.barcode || null,
      supplierId: selectedSupplierIds[0] || null,
      supplierIds: selectedSupplierIds,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: payload });
    } else {
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

  if (isBulkUpdateMode) {
    return (
      <div className="space-y-6">
        <BulkPriceUpdateView
          onCancel={() => setIsBulkUpdateMode(false)}
          onSuccess={() => setIsBulkUpdateMode(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. CABECERA REFERENCIA POS */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">📦</span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Catálogo de Productos
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Gestiona el inventario de artículos, códigos internos, códigos de barras, proveedores y precios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setIsBulkUpdateMode(true)}
            leftIcon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
            className="text-xs font-semibold rounded-xl"
          >
            Actualización Masiva
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/price-lists')}
            leftIcon={<Tag className="h-4 w-4 text-primary-500" />}
            className="text-xs font-semibold rounded-xl"
          >
            Listas de Precios
          </Button>

          {canImport && (
            <>
              <Button
                variant="outline"
                onClick={() => setIsImportWizardOpen(true)}
                leftIcon={<Upload className="h-4 w-4 text-indigo-500" />}
                className="text-xs font-semibold rounded-xl bg-indigo-50/50 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
              >
                📥 Importar Productos
              </Button>

              <Button
                variant="outline"
                onClick={handleExportProducts}
                leftIcon={<Download className="h-4 w-4 text-slate-500" />}
                className="text-xs font-semibold rounded-xl"
              >
                📤 Exportar Productos
              </Button>

              <Button
                variant="outline"
                onClick={() => setIsImportHistoryOpen(true)}
                leftIcon={<History className="h-4 w-4 text-slate-500" />}
                className="text-xs font-semibold rounded-xl"
                title="Historial de importaciones masivas"
              >
                📜 Historial
              </Button>
            </>
          )}

          {canCreate && (
            <Button
              onClick={handleOpenCreateModal}
              leftIcon={<Plus className="h-4 w-4" />}
              className="text-xs font-bold shadow-md rounded-xl"
            >
              Nuevo Producto
            </Button>
          )}
        </div>
      </div>

      {/* 2. BUSCADOR Y FILTROS ESTILO POS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3.5 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre, Código Interno o código de barras..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs sm:text-sm bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer font-medium"
          >
            <option value="ALL">Todas las Categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs sm:text-sm bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer font-medium"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
            <option value="DRAFT">Borradores</option>
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

          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 pl-1">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'}
          </div>
        </div>
      </div>

      {/* 3. PRODUCTOS EN TABLA MODERNA ESTILO ERP */}
      {loadingProducts ? (
        <div className="min-h-[250px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="min-h-[250px] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse table-fixed min-w-[1100px] lg:min-w-0">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="px-3.5 py-3.5">Producto</th>
                  <th className="px-3 py-3.5 w-28">Código Interno</th>
                  <th className="px-3 py-3.5 w-32">Código de Barras</th>
                  <th className="px-3 py-3.5 w-32">Categoría</th>
                  <th className="px-3 py-3.5 w-32">Proveedor</th>
                  <th className="px-3 py-3.5 w-24">Unidad</th>
                  <th className="px-3 py-3.5 w-32 text-center">Venta sin Stock</th>
                  <th className="px-2.5 py-3.5 text-right w-20">Stock</th>
                  <th className="px-3 py-3.5 text-right w-28">Precio Compra</th>
                  <th className="px-3 py-3.5 text-right w-28">Precio Venta</th>
                  <th className="px-2.5 py-3.5 text-center w-24">Estado</th>
                  <th className="px-3 py-3.5 text-center w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-medium">
                {filteredProducts.map((product) => {
                  const stock = Number(product.totalStock ?? 0);
                  const supplierNames = product.suppliers && product.suppliers.length > 0
                    ? product.suppliers.map((s: any) => s.name).join(', ')
                    : (product.supplier?.name || '—');

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Producto */}
                      <td className="px-3.5 py-3 overflow-hidden">
                        <div className="font-bold text-slate-900 dark:text-white leading-snug truncate">
                          {product.name}
                        </div>
                      </td>

                      {/* Código Interno */}
                      <td className="px-3 py-3 overflow-hidden">
                        <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 truncate block">
                          {product.sku || <span className="italic text-slate-400 font-normal opacity-60">—</span>}
                        </span>
                      </td>

                      {/* Código de Barras */}
                      <td className="px-3 py-3 overflow-hidden">
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate block">
                          {product.barcode || <span className="italic text-slate-400 font-normal opacity-60">—</span>}
                        </span>
                      </td>

                      {/* Categoría */}
                      <td className="px-3 py-3 overflow-hidden">
                        <span className="inline-flex items-center gap-1 text-slate-800 dark:text-slate-200 font-semibold truncate w-full">
                          <span className="text-xs">🥃</span>
                          <span className="truncate">{product.category?.name || 'Sin Categoría'}</span>
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
                          const u = String(product.unitOfMeasure || 'UNIT').toUpperCase();
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
                        {product.allowSaleWithoutStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                            <span>✅</span>
                            <span>Permitida</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            <span>🔒</span>
                            <span>Bloqueada</span>
                          </span>
                        )}
                      </td>

                      {/* Stock */}
                      <td className="px-2.5 py-3 text-right font-mono font-black text-xs text-slate-900 dark:text-white truncate">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md ${
                            stock <= 0
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                          }`}
                        >
                          {stock}
                        </span>
                      </td>

                      {/* Precio Compra */}
                      <td className="px-3 py-3 text-right font-mono text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                        {formatCurrency(product.purchasePrice)}
                      </td>

                      {/* Precio Venta */}
                      <td className="px-3 py-3 text-right font-mono text-xs font-extrabold text-primary-600 dark:text-primary-400 truncate">
                        {formatCurrency(product.salePrice)}
                      </td>

                      {/* Estado */}
                      <td className="px-2.5 py-3 text-center overflow-hidden">
                        {product.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Activo
                          </span>
                        ) : product.status === 'DRAFT' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Borrador
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            Inactivo
                          </span>
                        )}
                      </td>

                      {/* Acciones Directas */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {canUpdate && (
                            <button
                              type="button"
                              onClick={() => handleOpenModalWithTab(product, 'info')}
                              title="Editar producto"
                              className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenModalWithTab(product, 'stock')}
                            title="Ver detalle"
                            className="p-1.5 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(product)}
                              title="Eliminar producto"
                              className="p-1.5 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 flex flex-col h-[85vh] max-h-[85vh] transition-all duration-300">
            {/* Modal Header */}
            <div className="flex-none">
              <button
                onClick={handleCloseModal}
                className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white pr-6">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>

              {editingProduct && (
                <div className="flex border-b border-slate-200 dark:border-slate-800 mt-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveModalTab('info')}
                    className={`flex-1 pb-2 text-center text-xs sm:text-sm font-semibold border-b-2 transition-all ${
                      activeModalTab === 'info'
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-bold'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    Información General
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModalTab('stock')}
                    className={`flex-1 pb-2 text-center text-xs sm:text-sm font-semibold border-b-2 transition-all ${
                      activeModalTab === 'stock'
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-bold'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    Existencias en Depósitos
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModalTab('kardex')}
                    className={`flex-1 pb-2 text-center text-xs sm:text-sm font-semibold border-b-2 transition-all ${
                      activeModalTab === 'kardex'
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-bold'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    Kardex / Movimientos
                  </button>
                </div>
              )}
            </div>

            {/* Modal Body - Scrollable Content */}
            <div className="flex-1 overflow-y-auto pr-1">
              {(!editingProduct || activeModalTab === 'info') ? (
                <form id="product-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3.5 pt-1">
                  {apiError && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg text-xs text-red-600 dark:text-red-400 font-medium">
                      {apiError}
                    </div>
                  )}

                  {/* CARD 1: 📦 INFORMACIÓN GENERAL */}
                  <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-3 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      <span className="text-base leading-none">📦</span>
                      <span>Información General</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Nombre del Producto <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        {...register('name')}
                        placeholder="Ej: Fernet Branca 750ml"
                        className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                          errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700'
                        }`}
                      />
                      {errors.name && <p className="mt-1 text-xs text-red-500 font-medium">{errors.name.message}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Código Interno
                        </label>
                        <input
                          type="text"
                          {...register('sku')}
                          placeholder="Ej: PRD-001 (Opcional)"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Código de Barras
                        </label>
                        <input
                          type="text"
                          {...register('barcode')}
                          placeholder="Ej: 7791234567890 (Opcional)"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Categoría <span className="text-red-500">*</span>
                        </label>
                        <select
                          {...register('categoryId')}
                          className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                            errors.categoryId ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700'
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
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Estado
                        </label>
                        <select
                          {...register('status')}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        >
                          <option value="ACTIVE">Activo</option>
                          <option value="INACTIVE">Inactivo</option>
                          <option value="DRAFT">Borrador</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Unidad de Venta
                        </label>
                        <select
                          {...register('unitOfMeasure')}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        >
                          <option value="UNIT">Unidad (UNIT)</option>
                          <option value="KG">Kilogramo (KG)</option>
                          <option value="G">Gramos (G)</option>
                          <option value="L">Litro (L)</option>
                        </select>
                      </div>

                      <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-primary-400 transition-colors">
                          <input
                            type="checkbox"
                            {...register('allowSaleWithoutStock')}
                            className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 cursor-pointer"
                          />
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 select-none">
                            Permitir venta sin stock para este producto
                          </span>
                        </label>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                          Esta opción ignora la restricción global de venta sin stock y permite vender este producto aun cuando no tenga existencias.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CARD 2: 🏭 PROVEEDORES ASOCIADOS */}
                  <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      <span className="text-base leading-none">🏭</span>
                      <span>Proveedores Asociados</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 min-h-[38px] p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      {selectedSupplierIds.map((sId) => {
                        const supp = suppliers.find((s) => s.id === sId);
                        return (
                          <span
                            key={sId}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 shadow-2xs"
                          >
                            <span>{supp ? supp.name : sId}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedSupplierIds((prev) => prev.filter((id) => id !== sId))}
                              className="hover:text-red-500 text-slate-400 p-0.5 rounded transition-colors ml-0.5"
                              title="Eliminar proveedor"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        );
                      })}

                      <select
                        value=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val && !selectedSupplierIds.includes(val)) {
                            setSelectedSupplierIds((prev) => [...prev, val]);
                          }
                        }}
                        className="px-2.5 py-1 bg-transparent border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-500 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer transition-all"
                      >
                        <option value="">+ Agregar proveedor</option>
                        {suppliers
                          .filter((s) => s.isActive && !selectedSupplierIds.includes(s.id))
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* CARD 3: 💲 PRECIOS */}
                  <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      <span className="text-base leading-none">💲</span>
                      <span>Precios</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Precio Compra <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          disabled={!canEditCost}
                          {...register('purchasePrice')}
                          placeholder="0.00"
                          className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-xs md:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                            errors.purchasePrice ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700'
                          } ${!canEditCost ? 'opacity-60 bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : ''}`}
                        />
                        {errors.purchasePrice && <p className="mt-1 text-xs text-red-500 font-medium">{errors.purchasePrice.message}</p>}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Margen %
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          disabled={!canEditMargin}
                          {...register('profitMargin')}
                          onChange={handleMarginChange}
                          placeholder="30"
                          className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${!canEditMargin ? 'opacity-60 bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : ''}`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Precio Venta <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          disabled={!canEditPrice}
                          {...register('salePrice')}
                          onChange={handleSalePriceChange}
                          placeholder="0.00"
                          className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-xs md:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                            errors.salePrice ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700'
                          } ${!canEditPrice ? 'opacity-60 bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : ''}`}
                        />
                        {errors.salePrice && <p className="mt-1 text-xs text-red-500 font-medium">{errors.salePrice.message}</p>}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Los cambios en uno de estos valores recalculan automáticamente los demás.
                    </p>
                  </div>

                  {/* CARD 4: 📝 DESCRIPCIÓN */}
                  <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-2 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      <span className="text-base leading-none">📝</span>
                      <span>Descripción</span>
                    </div>
                    <textarea
                      placeholder="Detalles sobre el producto, especificaciones..."
                      rows={2}
                      {...register('description')}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
                    />
                  </div>

                  {/* CARD 5: 🛡 AUDITORÍA */}
                  {editingProduct && (
                    <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                        <span className="text-base leading-none">🛡</span>
                        <span>Auditoría</span>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-amber-900 dark:text-amber-400 mb-1">
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
                          className="w-full mb-2 px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/80 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                        >
                          <option value="">Selecciona un motivo (*obligatorio)</option>
                          <option value="Aumento proveedor">Aumento proveedor</option>
                          <option value="Corrección de precio">Corrección de precio</option>
                          <option value="Oferta">Oferta</option>
                          <option value="Cambio de proveedor">Cambio de proveedor</option>
                          <option value="Aumento de costo">Aumento de costo</option>
                          <option value="Ajuste de stock mínimo">Ajuste de stock mínimo</option>
                          <option value="custom">Otro motivo (escribir abajo)</option>
                        </select>
                        <input
                          type="text"
                          {...register('changeReason')}
                          placeholder="Explique brevemente el motivo de la modificación..."
                          className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all ${
                            errors.changeReason ? 'border-red-500 focus:ring-red-500' : 'border-amber-300 dark:border-amber-700/80'
                          }`}
                        />
                        {errors.changeReason && (
                          <p className="mt-1 text-xs text-red-500 font-semibold">{errors.changeReason.message}</p>
                        )}
                      </div>
                    </div>
                  )}
                </form>
              ) : activeModalTab === 'stock' ? (
                <div className="pt-1">
                  {editingProduct && <ProductStockTab productId={editingProduct.id} />}
                </div>
              ) : (
                <div className="pt-1">
                  {editingProduct && <ProductKardexTab productId={editingProduct.id} />}
                </div>
              )}
            </div>

            {/* Modal Footer - Fixed */}
            <div className="flex-none pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              {(!editingProduct || activeModalTab === 'info') ? (
                <>
                  <Button type="button" variant="outline" onClick={handleCloseModal} disabled={isSubmitting} className="text-xs px-4 rounded-lg">
                    Cancelar
                  </Button>
                  <Button type="submit" form="product-form" disabled={isSubmitting} className="text-xs px-6 font-bold shadow-md rounded-lg">
                    {isSubmitting ? (
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Guardando...
                      </div>
                    ) : (
                      editingProduct ? 'Guardar Cambios' : 'Crear Producto'
                    )}
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={handleCloseModal} className="text-xs px-6 font-bold shadow-md rounded-lg">
                  Cerrar
                </Button>
              )}
            </div>
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

      {/* Modales de Importación e Historial Masivo */}
      <ProductImportWizardModal
        isOpen={isImportWizardOpen}
        warehouses={warehouses.map((w: any) => ({ id: w.id, name: w.name }))}
        onClose={() => setIsImportWizardOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }}
      />

      <ProductImportHistoryModal
        isOpen={isImportHistoryOpen}
        onClose={() => setIsImportHistoryOpen(false)}
      />
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
      <div className="py-16 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
        <span className="text-base leading-none">🏬</span>
        <span>Existencias y niveles de stock por depósito</span>
      </div>

      {productStocks.length === 0 ? (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500 italic border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs">
          No hay depósitos registrados con stock de este producto.
        </div>
      ) : (
        <div
          className={`grid gap-4 w-full ${
            productStocks.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
          }`}
        >
          {productStocks.map((s: any) => {
            const qty = Number(s.quantity);
            const min = Number(s.minimumStock);
            const max = Number(s.maximumStock);
            const reserved = Number(s.reservedQuantity);

            let statusBadge = (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Stock Correcto
              </span>
            );
            if (qty <= 0) {
              statusBadge = (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-800/60 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Sin Stock
                </span>
              );
            } else if (qty <= min) {
              statusBadge = (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Stock Bajo
                </span>
              );
            }

            return (
              <div
                key={s.id}
                className="w-full bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-4.5 space-y-3.5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                {/* Header: Warehouse Name */}
                <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-2.5">
                  <span className="text-lg leading-none">🏬</span>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                    {s.warehouse?.name}
                  </h3>
                </div>

                {/* 3 Indicators in 1 Row */}
                <div className="grid grid-cols-3 gap-3 text-center bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
                  <div>
                    <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Stock Actual
                    </span>
                    <span className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 dark:text-white">
                      {qty.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Stock Mínimo
                    </span>
                    <span className="text-base sm:text-lg font-bold font-mono text-slate-700 dark:text-slate-300">
                      {min.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Stock Máximo
                    </span>
                    <span className="text-base sm:text-lg font-bold font-mono text-slate-700 dark:text-slate-300">
                      {max.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Reserved stock info if present */}
                {reserved > 0 && (
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 font-medium">
                    <span>Reservado para ventas:</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{reserved} ud</span>
                  </div>
                )}

                {/* Centered Status Badge at Footer of Card */}
                <div className="flex justify-center pt-1">
                  {statusBadge}
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
        limit: 100,
      }),
  });

  const movements = movementsData?.data || [];

  if (isLoading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-primary-500 animate-spin" />
      </div>
    );
  }

  const getMovementTypeBadge = (type: string) => {
    switch (type) {
      case 'ENTRY':
      case 'PURCHASE':
      case 'TRANSFER_IN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
            Ingreso
          </span>
        );
      case 'EXIT':
      case 'SALE':
      case 'TRANSFER_OUT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800/50">
            Egreso
          </span>
        );
      case 'ADJUSTMENT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
            Ajuste
          </span>
        );
      case 'INVENTORY':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50">
            Recuento
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
            Transferencia
          </span>
        );
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Aligned Filters Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50/70 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
        <div>
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
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
            className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
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
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar motivo..."
            value={searchReason}
            onChange={(e) => setSearchReason(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
          />
        </div>
      </div>

      {movements.length === 0 ? (
        <div className="text-center py-10 text-slate-400 dark:text-slate-500 italic border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs">
          No hay movimientos históricos registrados que coincidan.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-2xs">
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full border-collapse text-left text-xs font-sans">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 z-10">
                <tr>
                  <th className="px-3.5 py-2.5 text-slate-500 font-semibold uppercase tracking-wider">Fecha</th>
                  <th className="px-3.5 py-2.5 text-slate-500 font-semibold uppercase tracking-wider">Depósito</th>
                  <th className="px-3.5 py-2.5 text-slate-500 font-semibold uppercase tracking-wider text-center">Tipo</th>
                  <th className="px-3.5 py-2.5 text-slate-500 font-semibold uppercase tracking-wider text-right font-mono">Cant.</th>
                  <th className="px-3.5 py-2.5 text-slate-500 font-semibold uppercase tracking-wider text-right font-mono">Stock Act.</th>
                  <th className="px-3.5 py-2.5 text-slate-500 font-semibold uppercase tracking-wider">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {movements.map((m: any) => {
                  const qty = Number(m.quantity);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleDateString(undefined, { dateStyle: 'short' })}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[120px]" title={m.warehouse?.name}>
                        {m.warehouse?.name}
                      </td>
                      <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                        {getMovementTypeBadge(m.movementType)}
                      </td>
                      <td className={`px-3.5 py-2.5 text-right font-mono font-bold whitespace-nowrap ${
                        qty > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {qty > 0 ? '+' : ''}
                        {qty.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {Number(m.stockAfter).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400 max-w-[150px] truncate" title={m.reason || m.notes || 'Ajuste'}>
                        {m.reason || m.notes || 'Ajuste manual'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

