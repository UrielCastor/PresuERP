import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Check,
  Star,
  Search,
  Package,
  ArrowLeft,
  Settings,
  AlertCircle,
  Loader2,
  MoreVertical,
} from 'lucide-react';
import { priceListService, PriceList, PriceListItem } from '../services/priceList.service';
import { productApi } from '../services/product.service';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const PriceListsPage: React.FC = () => {
  const { user } = useAuth();
  const isCashier = user?.role === 'Cajero';
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<PriceList | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Form State for PriceList Modal
  const [listForm, setListForm] = useState({
    name: '',
    description: '',
    isActive: true,
    isDefault: false,
  });

  // Manage Items Drawer/Modal State
  const [selectedListForItems, setSelectedListForItems] = useState<PriceList | null>(null);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [newItemProductId, setNewItemProductId] = useState('');
  const [newItemPrice, setNewItemPrice] = useState<string>('');
  const [newItemMinQty, setNewItemMinQty] = useState<string>('1');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemPrice, setEditingItemPrice] = useState<string>('');
  const [editingItemMinQty, setEditingItemMinQty] = useState<string>('1');

  // Delete Confirm State
  const [deleteConfirmList, setDeleteConfirmList] = useState<PriceList | null>(null);

  // 1. Fetch All Price Lists
  const { data: priceLists = [], isLoading: loadingLists } = useQuery({
    queryKey: ['priceListsAll'],
    queryFn: priceListService.getAll,
  });

  // 2. Fetch Selected Price List Detail with Items
  const { data: listDetail, isLoading: loadingListDetail } = useQuery({
    queryKey: ['priceListDetail', selectedListForItems?.id],
    queryFn: () => priceListService.getById(selectedListForItems!.id),
    enabled: !!selectedListForItems?.id,
  });

  // 3. Fetch All Products for Product Selector
  const { data: products = [] } = useQuery({
    queryKey: ['productsListAll'],
    queryFn: () => productApi.list(),
  });

  // Filtered Price Lists
  const filteredLists = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return priceLists;
    return priceLists.filter(
      (l) =>
        l.name.toLowerCase().includes(term) ||
        (l.description && l.description.toLowerCase().includes(term))
    );
  }, [priceLists, searchTerm]);

  // Filtered Items inside List Detail
  const listItems: PriceListItem[] = listDetail?.items || [];
  const filteredItems = useMemo(() => {
    const term = itemSearchTerm.toLowerCase().trim();
    if (!term) return listItems;
    return listItems.filter(
      (item) =>
        item.product?.name.toLowerCase().includes(term) ||
        item.product?.sku?.toLowerCase().includes(term) ||
        item.product?.barcode?.toLowerCase().includes(term)
    );
  }, [listItems, itemSearchTerm]);

  // Mutations
  const createListMutation = useMutation({
    mutationFn: priceListService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceListsAll'] });
      queryClient.invalidateQueries({ queryKey: ['priceLists'] });
      setIsListModalOpen(false);
      resetListForm();
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Error al crear la lista de precios'),
  });

  const updateListMutation = useMutation({
    mutationFn: (data: { id: string; body: any }) => priceListService.update(data.id, data.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceListsAll'] });
      queryClient.invalidateQueries({ queryKey: ['priceLists'] });
      queryClient.invalidateQueries({ queryKey: ['priceListDetail'] });
      setIsListModalOpen(false);
      resetListForm();
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Error al actualizar la lista de precios'),
  });

  const deleteListMutation = useMutation({
    mutationFn: priceListService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceListsAll'] });
      queryClient.invalidateQueries({ queryKey: ['priceLists'] });
      setDeleteConfirmList(null);
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Error al eliminar la lista de precios'),
  });

  const addItemMutation = useMutation({
    mutationFn: (data: { priceListId: string; body: any }) =>
      priceListService.addItem(data.priceListId, data.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceListDetail', selectedListForItems?.id] });
      queryClient.invalidateQueries({ queryKey: ['productsListAll'] });
      setNewItemProductId('');
      setNewItemPrice('');
      setNewItemMinQty('1');
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Error al agregar el precio especial'),
  });

  const updateItemMutation = useMutation({
    mutationFn: (data: { priceListId: string; itemId: string; body: any }) =>
      priceListService.updateItem(data.priceListId, data.itemId, data.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceListDetail', selectedListForItems?.id] });
      queryClient.invalidateQueries({ queryKey: ['productsListAll'] });
      setEditingItemId(null);
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Error al actualizar el precio'),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (data: { priceListId: string; itemId: string }) =>
      priceListService.deleteItem(data.priceListId, data.itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceListDetail', selectedListForItems?.id] });
      queryClient.invalidateQueries({ queryKey: ['productsListAll'] });
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Error al eliminar el precio especial'),
  });

  // Form Handlers
  const resetListForm = () => {
    setEditingList(null);
    setListForm({
      name: '',
      description: '',
      isActive: true,
      isDefault: false,
    });
  };

  const openCreateModal = () => {
    resetListForm();
    setIsListModalOpen(true);
  };

  const openEditModal = (list: PriceList) => {
    setEditingList(list);
    setListForm({
      name: list.name,
      description: list.description || '',
      isActive: list.isActive,
      isDefault: list.isDefault,
    });
    setIsListModalOpen(true);
  };

  const handleProductSelect = (productId: string) => {
    setNewItemProductId(productId);
    if (!productId) {
      setNewItemPrice('');
      return;
    }
    const selectedProduct = products.find((p: any) => p.id === productId);
    if (selectedProduct && selectedProduct.salePrice !== undefined && selectedProduct.salePrice !== null) {
      setNewItemPrice(String(selectedProduct.salePrice));
    } else {
      setNewItemPrice('');
    }
  };

  const handleSaveList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!listForm.name.trim()) return alert('El nombre de la lista es obligatorio.');

    if (editingList) {
      updateListMutation.mutate({ id: editingList.id, body: listForm });
    } else {
      createListMutation.mutate(listForm);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListForItems) return;
    if (!newItemProductId) return alert('Debes seleccionar un producto.');
    const priceNum = Number(newItemPrice);
    if (isNaN(priceNum) || priceNum <= 0) return alert('El precio debe ser un número mayor a cero.');

    addItemMutation.mutate({
      priceListId: selectedListForItems.id,
      body: {
        productId: newItemProductId,
        price: priceNum,
        minQuantity: Number(newItemMinQty) || 1,
      },
    });
  };

  const handleSaveEditedItem = (item: PriceListItem) => {
    if (!selectedListForItems) return;
    const priceNum = Number(editingItemPrice);
    if (isNaN(priceNum) || priceNum <= 0) return alert('El precio debe ser mayor a cero.');

    updateItemMutation.mutate({
      priceListId: selectedListForItems.id,
      itemId: item.id,
      body: {
        price: priceNum,
        minQuantity: Number(editingItemMinQty) || 1,
      },
    });
  };

  const formatCurrency = (val: number | string) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(val));

  return (
    <div className="space-y-6">
      {/* 1. ENCABEZADO ESTILO POS */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors mr-1"
              title="Volver a Productos"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-2xl leading-none">📋</span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Listas de Precios
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl pl-8 sm:pl-9">
            Administra listas minoristas, mayoristas y tarifas especiales de tu empresa.
          </p>
        </div>

        {!isCashier && (
          <div className="flex items-center gap-3">
            <Button
              onClick={openCreateModal}
              leftIcon={<Plus className="h-4 w-4" />}
              className="text-xs font-bold shadow-md rounded-xl"
            >
              + Nueva Lista
            </Button>
          </div>
        )}
      </div>

      {/* 2. BARRA DE HERRAMIENTAS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3.5 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3">
          {searchTerm.trim() && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 px-2 py-1 transition-colors"
            >
              Limpiar búsqueda
            </button>
          )}
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total: {filteredLists.length} {filteredLists.length === 1 ? 'lista' : 'listas'}
          </div>
        </div>
      </div>

      {/* 3. CARDS RESPONSIVE DE LISTAS DE PRECIOS */}
      {loadingLists ? (
        <div className="min-h-[250px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      ) : filteredLists.length === 0 ? (
        <div className="min-h-[280px] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
          <Tag className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No existen listas de precios</h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            {searchTerm
              ? 'No se encontraron listas que coincidan con la búsqueda.'
              : isCashier
                ? 'No hay listas de precios activas registradas en el sistema.'
                : 'Crea tu primera lista de precios para definir tarifas especiales.'}
          </p>
          {!searchTerm && !isCashier && (
            <Button onClick={openCreateModal} className="mt-4 flex items-center gap-2 text-xs font-bold rounded-xl shadow-md">
              <Plus className="h-4 w-4" />
              Crear primera lista
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
          {filteredLists.map((list) => {
            const productsCount = list._count?.items ?? (list.items?.length || 0);

            return (
              <div
                key={list.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 relative group"
              >
                {/* Header Card: Fila Superior con Nombre & Badge */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg leading-none">📋</span>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug truncate">
                        {list.name}
                      </h3>
                    </div>

                    {list.isDefault ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shadow-2xs shrink-0">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        DEFAULT
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0 uppercase tracking-wider">
                        PERSONALIZADA
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[32px]">
                    {list.description || <span className="italic text-slate-400">Sin descripción registrada</span>}
                  </p>
                </div>

                {/* Información: Grilla de Productos y Estado */}
                <div className="grid grid-cols-2 gap-2.5 text-center bg-slate-50/80 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                      <span>📦</span> Productos
                    </span>
                    <span className="text-base font-extrabold font-mono text-slate-900 dark:text-white">
                      {productsCount}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                      <span>🏷️</span> Estado
                    </span>
                    {list.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        Inactiva
                      </span>
                    )}
                  </div>
                </div>

                {/* Acciones: Botón Principal Ancho + Menú Contextual (⋮) */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  <Button
                    onClick={() => setSelectedListForItems(list)}
                    className="flex-1 text-xs font-bold py-2 rounded-xl shadow-2xs flex items-center justify-center gap-1.5"
                  >
                    {isCashier ? (
                      <>
                        <span>👁️</span>
                        Consultar Precios
                      </>
                    ) : (
                      <>
                        <span>⚙️</span>
                        Gestionar Precios
                      </>
                    )}
                  </Button>

                  {/* Menú Tres Puntos (⋮) */}
                  {!isCashier && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === list.id ? null : list.id);
                        }}
                        className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        title="Más acciones"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === list.id && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 bottom-full mb-1 z-30 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 text-xs divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95 duration-100">
                            <div className="py-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  openEditModal(list);
                                }}
                                className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                                Editar Lista
                              </button>
                            </div>

                            <div className="py-1">
                              <button
                                type="button"
                                disabled={list.isDefault}
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setDeleteConfirmList(list);
                                }}
                                className={`w-full text-left px-3 py-2 flex items-center gap-2 font-medium ${
                                  list.isDefault
                                    ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                    : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                Eliminar Lista
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR / EDITAR LISTA */}
      {/* MODAL CREAR / EDITAR LISTA ESTILO EDITAR PRODUCTO */}
      <Modal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none">📋</span>
            <span>{editingList ? 'Editar Lista de Precios' : 'Nueva Lista de Precios'}</span>
          </div>
        }
        size="lg"
      >
        <form onSubmit={handleSaveList} className="space-y-3.5">
          {/* CARD 1: 📦 INFORMACIÓN GENERAL */}
          <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              <span className="text-base leading-none">📦</span>
              <span>Información General</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Nombre de la Lista <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                required
                placeholder="Ej: Mayorista / Distribuidor / Tarifa Especial"
                value={listForm.name}
                onChange={(e) => setListForm({ ...listForm, name: e.target.value })}
                className="text-xs md:text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Descripción (Opcional)
              </label>
              <Input
                type="text"
                placeholder="Ej: Descuentos por compras al por mayor a partir de 10 unidades"
                value={listForm.description}
                onChange={(e) => setListForm({ ...listForm, description: e.target.value })}
                className="text-xs md:text-sm font-medium"
              />
            </div>
          </div>

          {/* CARD 2: ⚙️ CONFIGURACIÓN POS & ESTADO */}
          <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              <span className="text-base leading-none">⚙️</span>
              <span>Configuración & Estado</span>
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none p-2 rounded-lg hover:bg-white dark:hover:bg-slate-900 transition-colors">
              <input
                type="checkbox"
                checked={listForm.isDefault}
                onChange={(e) => setListForm({ ...listForm, isDefault: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                  Marcar como Lista por Defecto (POS)
                </span>
                <p className="text-[11px] text-slate-400">
                  Sustituirá la lista predeterminada actual en el punto de venta para clientes generales.
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer select-none p-2 rounded-lg hover:bg-white dark:hover:bg-slate-900 transition-colors">
              <input
                type="checkbox"
                checked={listForm.isActive}
                onChange={(e) => setListForm({ ...listForm, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                  Estado Activo
                </span>
                <p className="text-[11px] text-slate-400">
                  Las listas inactivas no aparecerán disponibles en el selector del POS.
                </p>
              </div>
            </label>
          </div>

          {/* Modal Footer - Fixed */}
          <div className="flex items-center justify-end gap-3 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsListModalOpen(false)}
              className="text-xs px-4 rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createListMutation.isPending || updateListMutation.isPending}
              className="text-xs px-6 font-bold shadow-md rounded-lg"
            >
              {createListMutation.isPending || updateListMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingList ? (
                'Guardar Cambios'
              ) : (
                'Crear Lista'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL DETALLE DE PRECIOS POR LISTA */}
      <Modal
        isOpen={!!selectedListForItems}
        onClose={() => setSelectedListForItems(null)}
        title={`Precios en Lista: ${selectedListForItems?.name || ''}`}
        size="xl"
      >
        <div className="space-y-5">
          {/* FORMULARIO AGREGAR PRECIO ESPECIAL A PRODUCTO */}
          {!isCashier && (
            <form
              onSubmit={handleAddItem}
              className="p-4 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3"
            >
              <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-305 tracking-wider">
                Asignar Precio Especial a Producto
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Producto *
                  </label>
                  <Select
                    value={newItemProductId}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="text-xs font-bold"
                  >
                    <option value="">-- Selecciona un producto --</option>
                    {products
                      .filter((p: any) => p.status === 'ACTIVE')
                      .map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Base: {formatCurrency(p.salePrice)})
                        </option>
                      ))}
                  </Select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Precio Lista ($) *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="font-mono text-xs font-bold"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Cant. Mínima
                  </label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={newItemMinQty}
                    onChange={(e) => setNewItemMinQty(e.target.value)}
                    className="font-mono text-xs font-bold"
                  />
                </div>

                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={addItemMutation.isPending || !newItemProductId || !newItemPrice}
                    className="w-full text-xs font-bold py-2"
                  >
                    {addItemMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '+ Agregar'}
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* BUSCADOR DE PRODUCTOS EN LA LISTA */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar en esta lista..."
                value={itemSearchTerm}
                onChange={(e) => setItemSearchTerm(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>
            <span className="text-xs text-slate-400 font-bold">
              {filteredItems.length} ítems en lista
            </span>
          </div>

          {/* TABLA DE PRECIOS EN LISTA */}
          {loadingListDetail ? (
            <div className="p-6 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-8 text-center bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                No hay productos con precio especial en esta lista.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Los productos no configurados aquí utilizarán automáticamente su precio base (`Product.salePrice`).
              </p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5">Producto</th>
                    <th className="px-4 py-2.5 text-right">Precio Base</th>
                    <th className="px-4 py-2.5 text-right">Precio Lista</th>
                    <th className="px-4 py-2.5 text-center">Cant. Mínima</th>
                    {!isCashier && <th className="px-4 py-2.5 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredItems.map((item) => {
                    const isEditing = editingItemId === item.id;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.product?.name || item.productId}
                          </span>
                          {item.product?.sku && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              Cód. Int: {item.product.sku}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right text-slate-500 line-through">
                          {formatCurrency(item.product?.salePrice || 0)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editingItemPrice}
                              onChange={(e) => setEditingItemPrice(e.target.value)}
                              className="w-24 text-right text-xs font-mono font-bold py-0.5 ml-auto"
                            />
                          ) : (
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                              {formatCurrency(item.price)}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <Input
                              type="number"
                              step="1"
                              value={editingItemMinQty}
                              onChange={(e) => setEditingItemMinQty(e.target.value)}
                              className="w-16 text-center text-xs font-mono font-bold py-0.5 mx-auto"
                            />
                          ) : (
                            <Badge variant="default" className="font-mono text-[11px]">
                              ≥ {item.minQuantity} u.
                            </Badge>
                          )}
                        </td>

                        {!isCashier && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isEditing ? (
                                <>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleSaveEditedItem(item)}
                                    className="py-1 text-xs"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditingItemId(null)}
                                    className="py-1 text-xs"
                                  >
                                    Cancelar
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingItemId(item.id);
                                      setEditingItemPrice(String(item.price));
                                      setEditingItemMinQty(String(item.minQuantity));
                                    }}
                                    title="Editar Precio"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (selectedListForItems) {
                                        deleteItemMutation.mutate({
                                          priceListId: selectedListForItems.id,
                                          itemId: item.id,
                                        });
                                      }
                                    }}
                                    className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                                    title="Eliminar Precio (Volver a Precio Base)"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setSelectedListForItems(null)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>

      {/* CONFIRMAR ELIMINAR LISTA */}
      <ConfirmDialog
        isOpen={!!deleteConfirmList}
        onClose={() => setDeleteConfirmList(null)}
        onConfirm={() => deleteConfirmList && deleteListMutation.mutate(deleteConfirmList.id)}
        title="Eliminar Lista de Precios"
        message={`¿Estás seguro de que deseas eliminar la lista "${deleteConfirmList?.name}"? Esta acción no afectará a las ventas históricas ni al precio base de los productos.`}
        confirmText="Eliminar Lista"
        variant="danger"
        isLoading={deleteListMutation.isPending}
      />
    </div>
  );
};
