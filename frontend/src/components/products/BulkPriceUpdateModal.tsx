import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { swalSuccess } from '../../utils/swal';
import {
  DollarSign,
  Percent,
  RefreshCw,
  AlertTriangle,
  History,
  CheckCircle2,
  Filter,
  ArrowRight,
  TrendingUp,
  Tag,
  Sliders,
  X,
  Layers,
} from 'lucide-react';
import {
  Modal,
  Button,
  Input,
  Select,
  Badge,
  Card,
} from '../ui';
import { supplierApi } from '../../services/supplier.service';
import { categoryApi } from '../../services/category.service';
import { brandApi } from '../../services/brand.service';
import {
  productPriceUpdateService,
  PriceUpdatePayload,
  PreviewItem,
  PriceUpdateHistoryRecord,
} from '../../services/productPriceUpdateService';

interface BulkPriceUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProductIds?: string[];
}

export const BulkPriceUpdateModal: React.FC<BulkPriceUpdateModalProps> = ({
  isOpen,
  onClose,
  selectedProductIds = [],
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'update' | 'history'>('update');

  // Form State
  const [filterType, setFilterType] = useState<'SUPPLIER' | 'CATEGORY' | 'BRAND' | 'SELECTED' | 'ALL'>('SUPPLIER');
  const [filterValue, setFilterValue] = useState<string>('');
  const [updateType, setUpdateType] = useState<'INCREASE_PERCENT' | 'DECREASE_PERCENT' | 'INCREASE_FIXED' | 'REPLACE' | 'MULTIPLY'>('INCREASE_PERCENT');
  const [valInput, setValInput] = useState<string>('8');
  const [affectedPurchasePrice, setAffectedPurchasePrice] = useState<boolean>(false);
  const [affectedSalePrice, setAffectedSalePrice] = useState<boolean>(true);
  const [roundingOption, setRoundingOption] = useState<'NONE' | 'ROUND_10' | 'ROUND_100' | 'ROUND_500' | 'ROUND_1000'>('NONE');
  const [priceListStrategy, setPriceListStrategy] = useState<'KEEP_SPECIAL' | 'RECALCULATE' | 'NO_MODIFY_LISTS'>('RECALCULATE');

  // Preview & Confirm State
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [previewCount, setPreviewCount] = useState<number>(0);
  const [isPreviewGenerated, setIsPreviewGenerated] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Queries for dropdowns
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierApi.list(),
  });
  const suppliers: any[] = Array.isArray(suppliersData) ? suppliersData : (suppliersData as any)?.data || [];

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.list(),
  });
  const categories: any[] = Array.isArray(categoriesData) ? categoriesData : (categoriesData as any)?.data || [];

  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: () => brandApi.list(),
  });
  const brands: any[] = Array.isArray(brandsData) ? brandsData : (brandsData as any)?.data || [];

  const { data: historyRecords = [], isLoading: loadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['productPriceUpdateHistory'],
    queryFn: productPriceUpdateService.getHistory,
    enabled: isOpen && activeTab === 'history',
  });

  // Default selection initialization
  useEffect(() => {
    if (suppliers.length > 0 && filterType === 'SUPPLIER' && !filterValue) {
      setFilterValue(suppliers[0].id);
    } else if (categories.length > 0 && filterType === 'CATEGORY' && !filterValue) {
      setFilterValue(categories[0].id);
    } else if (brands.length > 0 && filterType === 'BRAND' && !filterValue) {
      setFilterValue(brands[0].id);
    }
  }, [filterType, suppliers, categories, brands, filterValue]);

  // Reset preview when options change
  useEffect(() => {
    setIsPreviewGenerated(false);
    setPreviewItems([]);
    setPreviewError(null);
  }, [filterType, filterValue, updateType, valInput, affectedPurchasePrice, affectedSalePrice, roundingOption, priceListStrategy]);

  const getPayload = (): PriceUpdatePayload => {
    const num = parseFloat(valInput) || 0;
    return {
      filterType,
      filterValue: (filterType === 'SUPPLIER' || filterType === 'CATEGORY' || filterType === 'BRAND') ? filterValue : undefined,
      productIds: filterType === 'SELECTED' ? selectedProductIds : undefined,
      type: updateType,
      percentage: (updateType === 'INCREASE_PERCENT' || updateType === 'DECREASE_PERCENT') ? num : undefined,
      fixedAmount: (updateType === 'INCREASE_FIXED' || updateType === 'REPLACE') ? num : undefined,
      multiplyFactor: updateType === 'MULTIPLY' ? num : undefined,
      affectedPurchasePrice,
      affectedSalePrice,
      roundingOption,
      priceListStrategy,
    };
  };

  const previewMutation = useMutation({
    mutationFn: (payload: PriceUpdatePayload) => productPriceUpdateService.preview(payload),
    onSuccess: (data) => {
      setPreviewItems(data.items);
      setPreviewCount(data.productsAffected);
      setIsPreviewGenerated(true);
      setPreviewError(null);
    },
    onError: (err: any) => {
      setPreviewError(err.response?.data?.error || 'Error al generar vista previa');
    },
  });

  const applyMutation = useMutation({
    mutationFn: (payload: PriceUpdatePayload) => productPriceUpdateService.apply(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['productsListAll'] });
      queryClient.invalidateQueries({ queryKey: ['priceLists'] });
      swalSuccess('Precios Actualizados', `Se actualizaron correctamente ${data.productsAffected} productos.`);
      onClose();
    },
    onError: (err: any) => {
      setPreviewError(err.response?.data?.error || 'Error al aplicar actualización masiva');
    },
  });

  const handleGeneratePreview = () => {
    setPreviewError(null);
    if (!affectedPurchasePrice && !affectedSalePrice) {
      setPreviewError('Debes seleccionar al menos una opción entre Precio de compra o Precio de venta.');
      return;
    }
    previewMutation.mutate(getPayload());
  };

  const handleApplyUpdate = () => {
    setPreviewError(null);
    applyMutation.mutate(getPayload());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Actualización Masiva de Precios"
      size="xl"
    >
      <div className="space-y-4 pt-1">
        
        {/* Pestañas: Actualización vs Historial */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('update')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                activeTab === 'update'
                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400 border border-primary-200 dark:border-primary-800'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" /> Nueva Actualización
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('history');
                refetchHistory();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                activeTab === 'history'
                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400 border border-primary-200 dark:border-primary-800'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5" /> Historial de Cambios
            </button>
          </div>
        </div>

        {activeTab === 'history' ? (
          /* TAB DE HISTORIAL */
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Registros Históricos de Modificaciones Masivas
            </h4>

            {loadingHistory ? (
              <div className="py-8 text-center text-xs text-slate-400">Cargando historial...</div>
            ) : historyRecords.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                No hay actualizaciones masivas registradas.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                {historyRecords.map((h: PriceUpdateHistoryRecord) => (
                  <div
                    key={h.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-900 dark:text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Tipo: <strong className="text-primary-600 dark:text-primary-400">{h.type}</strong>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(h.createdAt).toLocaleString('es-AR')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-300 pt-1">
                      <div>
                        Alcance: <strong className="font-bold">{h.filterType}</strong>
                      </div>
                      <div>
                        Productos afectados: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{h.productsAffected} u.</strong>
                      </div>
                      <div>
                        Usuario: <strong className="font-bold">{h.user?.name || 'Sistema'}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          /* TAB DE FORMULARIO Y VISTA PREVIA */
          <div className="space-y-4">
            
            {/* Mensajes de Error */}
            {previewError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{previewError}</span>
              </div>
            )}

            {/* SECCIÓN 1: ALCANCE DE SELECCIÓN */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-primary-500" /> Paso 1 — Selección de Alcance
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('SUPPLIER');
                    if (suppliers.length > 0) setFilterValue(suppliers[0].id);
                  }}
                  className={`p-2 rounded-lg border text-left font-bold transition-all ${
                    filterType === 'SUPPLIER'
                      ? 'bg-primary-50 dark:bg-primary-950 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Por proveedor
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilterType('CATEGORY');
                    if (categories.length > 0) setFilterValue(categories[0].id);
                  }}
                  className={`p-2 rounded-lg border text-left font-bold transition-all ${
                    filterType === 'CATEGORY'
                      ? 'bg-primary-50 dark:bg-primary-950 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Por categoría
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilterType('BRAND');
                    if (brands.length > 0) setFilterValue(brands[0].id);
                  }}
                  className={`p-2 rounded-lg border text-left font-bold transition-all ${
                    filterType === 'BRAND'
                      ? 'bg-primary-50 dark:bg-primary-950 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Por marca
                </button>

                <button
                  type="button"
                  onClick={() => setFilterType('SELECTED')}
                  className={`p-2 rounded-lg border text-left font-bold transition-all ${
                    filterType === 'SELECTED'
                      ? 'bg-primary-50 dark:bg-primary-950 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Seleccionados ({selectedProductIds.length})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterType('ALL')}
                  className={`p-2 rounded-lg border text-left font-bold transition-all ${
                    filterType === 'ALL'
                      ? 'bg-amber-50 dark:bg-amber-950 border-amber-500 text-amber-900 dark:text-amber-300'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Todos
                </button>
              </div>

              {/* Controles dinámicos por tipo de filtro */}
              {filterType === 'SUPPLIER' && (
                <div className="pt-1">
                  <Select
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="w-full text-xs font-bold"
                  >
                    {suppliers.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {filterType === 'CATEGORY' && (
                <div className="pt-1">
                  <Select
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="w-full text-xs font-bold"
                  >
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {filterType === 'BRAND' && (
                <div className="pt-1">
                  <Select
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="w-full text-xs font-bold"
                  >
                    {brands.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {filterType === 'ALL' && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>⚠️ Está a punto de modificar todos los productos activos de la empresa.</span>
                </div>
              )}
            </div>

            {/* SECCIÓN 2 & 3: TIPO DE ACTUALIZACIÓN & PRECIOS A AFECTAR */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              
              {/* Paso 2: Tipo de actualización */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-primary-500" /> Paso 2 — Tipo de Ajuste
                </label>

                <Select
                  value={updateType}
                  onChange={(e) => setUpdateType(e.target.value as any)}
                  className="w-full text-xs font-bold"
                >
                  <option value="INCREASE_PERCENT">Aumentar porcentaje (+%)</option>
                  <option value="DECREASE_PERCENT">Disminuir porcentaje (-%)</option>
                  <option value="INCREASE_FIXED">Aumentar monto fijo (+$)</option>
                  <option value="REPLACE">Reemplazar precio ($)</option>
                  <option value="MULTIPLY">Multiplicar precio (x)</option>
                </Select>

                <div className="pt-1">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Valor a aplicar:
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={valInput}
                    onChange={(e) => setValInput(e.target.value)}
                    placeholder="Ej: 8 para +8%"
                    className="font-mono text-xs font-bold"
                  />
                </div>
              </div>

              {/* Paso 3: Qué precios afectar */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-primary-500" /> Paso 3 — Precios a Afectar
                </label>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={affectedPurchasePrice}
                      onChange={(e) => setAffectedPurchasePrice(e.target.checked)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span>Precio de compra</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={affectedSalePrice}
                      onChange={(e) => setAffectedSalePrice(e.target.checked)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span>Precio de venta</span>
                  </label>
                </div>
              </div>
            </div>

            {/* SECCIÓN 4 & LISTAS: REDONDEO & LISTAS DE PRECIOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              
              {/* Paso 4: Redondeo */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-primary-500" /> Paso 4 — Redondeo Automático
                </label>

                <Select
                  value={roundingOption}
                  onChange={(e) => setRoundingOption(e.target.value as any)}
                  className="w-full text-xs font-bold"
                >
                  <option value="NONE">Sin redondeo ($12.783,20)</option>
                  <option value="ROUND_10">Redondear a 10 ($12.780)</option>
                  <option value="ROUND_100">Redondear a 100 ($12.800)</option>
                  <option value="ROUND_500">Redondear a 500 ($13.000)</option>
                  <option value="ROUND_1000">Redondear a 1000 ($13.000)</option>
                </Select>
              </div>

              {/* Paso 5: Listas de precios */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-primary-500" /> Listas de Precios Existentes
                </label>

                <Select
                  value={priceListStrategy}
                  onChange={(e) => setPriceListStrategy(e.target.value as any)}
                  className="w-full text-xs font-bold"
                >
                  <option value="RECALCULATE">Recalcular automáticamente las listas</option>
                  <option value="KEEP_SPECIAL">Mantener precios especiales vigentes</option>
                  <option value="NO_MODIFY_LISTS">No modificar listas de precios</option>
                </Select>
              </div>
            </div>

            {/* BOTÓN GENERAR VISTA PREVIA */}
            <div className="flex justify-center pt-2">
              <Button
                variant="primary"
                onClick={handleGeneratePreview}
                disabled={previewMutation.isPending}
                className="w-full sm:w-auto font-extrabold text-xs px-6 py-2"
              >
                {previewMutation.isPending ? 'Calculando Vista Previa...' : 'Generar Vista Previa Obligatoria'}
              </Button>
            </div>

            {/* VISTA PREVIA OBLIGATORIA CON TABLA COMPARATIVA */}
            {isPreviewGenerated && (
              <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-emerald-200/80 dark:border-emerald-800 pb-2">
                  <span className="font-extrabold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Vista Previa Calculada
                  </span>
                  <Badge variant="success" size="md">
                    {previewCount} productos serán modificados
                  </Badge>
                </div>

                <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="p-2">Producto</th>
                        <th className="p-2 text-right">Precio Anterior</th>
                        <th className="p-2 text-right">Precio Nuevo</th>
                        <th className="p-2 text-right">Diferencia %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {previewItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2 font-sans font-bold text-slate-900 dark:text-white">
                            {item.name}
                            <span className="text-[10px] text-slate-400 font-mono block">{item.sku || 'Cód. Int N/D'}</span>
                          </td>
                          <td className="p-2 text-right text-slate-500">
                            ${(affectedSalePrice ? item.oldSalePrice : item.oldPurchasePrice).toLocaleString('es-AR')}
                          </td>
                          <td className="p-2 text-right font-black text-emerald-600 dark:text-emerald-400">
                            ${(affectedSalePrice ? item.newSalePrice : item.newPurchasePrice).toLocaleString('es-AR')}
                          </td>
                          <td className="p-2 text-right">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                item.differencePercentage >= 0
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {item.differencePercentage >= 0 ? '+' : ''}
                              {item.differencePercentage}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsPreviewGenerated(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    disabled={applyMutation.isPending}
                    onClick={handleApplyUpdate}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold"
                  >
                    {applyMutation.isPending ? 'Aplicando Cambios...' : 'Aplicar Actualización Masiva'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
