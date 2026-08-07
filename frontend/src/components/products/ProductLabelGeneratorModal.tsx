import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useQuery } from '@tanstack/react-query';
import { productApi, Product } from '../../services/product.service';
import { warehouseApi } from '../../services/warehouse.service';
import { categoryApi } from '../../services/category.service';
import { priceListService, PriceList } from '../../services/priceList.service';
import { SettingsService } from '../../services/settings.service';
import { LabelPreviewCard } from './LabelPreviewCard';
import {
  LabelPrinterService,
  LabelTemplateDesign,
  PaperType,
  PaperConfig,
  LabelItem,
  LabelPrintConfig,
} from '../../services/labelPrinter.service';
import { swalWarning, swalSuccess } from '../../utils/swal';
import {
  Search,
  Check,
  Printer,
  FileCode2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  CheckCircle2,
} from 'lucide-react';

export interface ProductLabelGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProductLabelGeneratorModal: React.FC<ProductLabelGeneratorModalProps> = ({
  isOpen,
  onClose,
}) => {
  // Active Step: 1. Productos | 2. Diseño | 3. Imprimir
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [selectedPriceListId, setSelectedPriceListId] = useState<string>('BASE');

  // Quantity Mode
  const [useStockQuantity, setUseStockQuantity] = useState<boolean>(false);

  // Selection Map: productId -> quantity
  const [selectedMap, setSelectedMap] = useState<Record<string, number>>({});

  // Design Settings
  const [design, setDesign] = useState<LabelTemplateDesign>('STANDARD');
  const [symbology, setSymbology] = useState<'AUTO' | 'EAN13' | 'EAN8' | 'CODE128'>('AUTO');
  const [paperType, setPaperType] = useState<PaperType>('THERMAL_58');

  // Paper Config Defaults
  const [paperConfig, setPaperConfig] = useState<PaperConfig>({
    type: 'THERMAL_58',
    widthMm: 58,
    heightMm: 40,
    marginTopMm: 2,
    marginRightMm: 2,
    marginBottomMm: 2,
    marginLeftMm: 2,
    gapHorizontalMm: 2,
    gapVerticalMm: 2,
    cols: 1,
    rows: 1,
  });

  // Preview Pagination
  const [previewPage, setPreviewPage] = useState<number>(1);

  // Fetch Products
  const { data: productsRes, isLoading: loadingProducts } = useQuery({
    queryKey: ['productsForLabels', selectedWarehouseId],
    queryFn: () => productApi.list(selectedWarehouseId !== 'ALL' ? { warehouseId: selectedWarehouseId } : undefined),
    enabled: isOpen,
  });

  const products: Product[] = useMemo(() => {
    if (!productsRes) return [];
    return Array.isArray(productsRes) ? productsRes : (productsRes as any).data || [];
  }, [productsRes]);

  // Fetch Categories
  const { data: categoriesRes } = useQuery({
    queryKey: ['categoriesListLabels'],
    queryFn: () => categoryApi.list(),
    enabled: isOpen,
  });
  const categories = useMemo(() => {
    if (!categoriesRes) return [];
    return Array.isArray(categoriesRes) ? categoriesRes : (categoriesRes as any).data || [];
  }, [categoriesRes]);

  // Fetch Warehouses
  const { data: warehousesRes } = useQuery({
    queryKey: ['warehousesListLabels'],
    queryFn: () => warehouseApi.list(),
    enabled: isOpen,
  });
  const warehouses = useMemo(() => {
    if (!warehousesRes) return [];
    return Array.isArray(warehousesRes) ? warehousesRes : (warehousesRes as any).data || [];
  }, [warehousesRes]);

  // Fetch Price Lists
  const { data: priceListsRes } = useQuery({
    queryKey: ['priceListsLabels'],
    queryFn: () => priceListService.getAll(),
    enabled: isOpen,
  });
  const priceLists: PriceList[] = useMemo(() => priceListsRes || [], [priceListsRes]);

  // Fetch Selected Price List Items detail
  const { data: selectedPriceListDetail } = useQuery({
    queryKey: ['priceListDetailLabels', selectedPriceListId],
    queryFn: () => priceListService.getById(selectedPriceListId),
    enabled: isOpen && selectedPriceListId !== 'BASE' && !!selectedPriceListId,
  });

  // Fetch Settings for Currency
  const { data: settingsRes } = useQuery({
    queryKey: ['businessSettingsLabels'],
    queryFn: () => SettingsService.getSettings(),
    enabled: isOpen,
  });
  const currencySymbol = settingsRes?.settings?.currencySymbol || '$';

  // Handle Paper Type Preset Changes
  useEffect(() => {
    if (paperType === 'THERMAL_58') {
      setPaperConfig({
        type: 'THERMAL_58',
        widthMm: 58,
        heightMm: 40,
        marginTopMm: 2,
        marginRightMm: 2,
        marginBottomMm: 2,
        marginLeftMm: 2,
        gapHorizontalMm: 0,
        gapVerticalMm: 0,
        cols: 1,
        rows: 1,
      });
    } else if (paperType === 'THERMAL_80') {
      setPaperConfig({
        type: 'THERMAL_80',
        widthMm: 80,
        heightMm: 50,
        marginTopMm: 2,
        marginRightMm: 2,
        marginBottomMm: 2,
        marginLeftMm: 2,
        gapHorizontalMm: 0,
        gapVerticalMm: 0,
        cols: 1,
        rows: 1,
      });
    } else if (paperType === 'SHEET_A4') {
      setPaperConfig({
        type: 'SHEET_A4',
        widthMm: 63,
        heightMm: 33,
        marginTopMm: 10,
        marginRightMm: 10,
        marginBottomMm: 10,
        marginLeftMm: 10,
        gapHorizontalMm: 3,
        gapVerticalMm: 3,
        cols: 3,
        rows: 8,
      });
    }
  }, [paperType]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCategory = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
      const matchStatus = selectedStatus === 'ALL' || p.status === selectedStatus;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [products, searchTerm, selectedCategory, selectedStatus]);

  // Handle Toggle Stock Quantity
  useEffect(() => {
    if (useStockQuantity) {
      const updated: Record<string, number> = {};
      Object.keys(selectedMap).forEach((pId) => {
        const prod = products.find((p) => p.id === pId);
        const stockVal = Math.max(1, Number(prod?.totalStock || 1));
        updated[pId] = stockVal;
      });
      setSelectedMap(updated);
    }
  }, [useStockQuantity, products]);

  // Price lookup logic
  const getProductPrice = (product: Product): number => {
    if (selectedPriceListId !== 'BASE' && selectedPriceListDetail?.items) {
      const item = selectedPriceListDetail.items.find((i) => i.productId === product.id);
      if (item && item.price !== undefined) {
        return Number(item.price);
      }
    }
    return Number(product.salePrice || 0);
  };

  // Selection handlers
  const handleToggleSelectProduct = (product: Product) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[product.id] !== undefined) {
        delete next[product.id];
      } else {
        const qty = useStockQuantity ? Math.max(1, Number(product.totalStock || 1)) : 1;
        next[product.id] = qty;
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const next: Record<string, number> = {};
    filteredProducts.forEach((p) => {
      const qty = useStockQuantity ? Math.max(1, Number(p.totalStock || 1)) : 1;
      next[p.id] = qty;
    });
    setSelectedMap(next);
  };

  const handleDeselectAll = () => {
    setSelectedMap({});
  };

  const handleQuantityChange = (productId: string, delta: number) => {
    setSelectedMap((prev) => {
      const current = prev[productId] || 1;
      const nextQty = Math.max(1, current + delta);
      return { ...prev, [productId]: nextQty };
    });
  };

  // Items chosen for printing
  const labelItemsToPrint: LabelItem[] = useMemo(() => {
    const list: LabelItem[] = [];
    Object.entries(selectedMap).forEach(([pId, qty]) => {
      const prod = products.find((p) => p.id === pId);
      if (prod && qty > 0) {
        list.push({
          id: prod.id,
          name: prod.name,
          sku: prod.sku,
          barcode: prod.barcode,
          price: getProductPrice(prod),
          quantity: qty,
        });
      }
    });
    return list;
  }, [selectedMap, products, selectedPriceListDetail, selectedPriceListId]);

  // Total Labels count
  const totalLabelsCount = useMemo(() => {
    return labelItemsToPrint.reduce((sum, item) => sum + item.quantity, 0);
  }, [labelItemsToPrint]);

  // Expanded individual label instances array for sheet rendering
  const expandedLabelList = useMemo(() => {
    const expanded: LabelItem[] = [];
    labelItemsToPrint.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        expanded.push(item);
      }
    });
    return expanded;
  }, [labelItemsToPrint]);

  // Calculate pages for Sheet mode or thermal mode
  const labelsPerPage = paperConfig.type === 'SHEET_A4' ? paperConfig.cols * paperConfig.rows : 1;
  const totalPages = Math.ceil(expandedLabelList.length / labelsPerPage) || 1;

  // Selected Price List Name
  const selectedPriceListName = useMemo(() => {
    if (selectedPriceListId === 'BASE') return 'Precio Base de Venta';
    return priceLists.find((pl) => pl.id === selectedPriceListId)?.name || 'Precio Base';
  }, [selectedPriceListId, priceLists]);

  const selectedPriceListIsDefault = useMemo(() => {
    if (selectedPriceListId === 'BASE') return true;
    return priceLists.find((pl) => pl.id === selectedPriceListId)?.isDefault || false;
  }, [selectedPriceListId, priceLists]);

  // Paper user-friendly name
  const paperFriendlyName = useMemo(() => {
    switch (paperConfig.type) {
      case 'THERMAL_58':
        return 'Térmica 58 mm';
      case 'THERMAL_80':
        return 'Térmica 80 mm';
      case 'SHEET_A4':
        return 'Hoja A4';
      default:
        return 'Personalizado';
    }
  }, [paperConfig.type]);

  // Print Config Object
  const printConfig: LabelPrintConfig = useMemo(() => {
    return {
      design,
      paper: paperConfig,
      symbology,
      currencySymbol,
      priceListName: selectedPriceListName,
      items: labelItemsToPrint,
    };
  }, [design, paperConfig, symbology, currencySymbol, selectedPriceListName, labelItemsToPrint]);

  // Validate before printing or navigating to step 3
  const validateBeforePrint = (): boolean => {
    if (labelItemsToPrint.length === 0) {
      swalWarning('Sin Productos Seleccionados', 'Debes seleccionar al menos un producto para generar etiquetas.');
      return false;
    }

    const invalidQtyItem = labelItemsToPrint.find((i) => i.quantity <= 0 || isNaN(i.quantity));
    if (invalidQtyItem) {
      swalWarning('Cantidad Inválida', `La cantidad de etiquetas para "${invalidQtyItem.name}" debe ser mayor a 0.`);
      return false;
    }

    if (design !== 'PRICE_ONLY') {
      const missingBarcodeItem = labelItemsToPrint.find((i) => !i.barcode && !i.sku);
      if (missingBarcodeItem) {
        swalWarning(
          'Código de Barras Requerido',
          `El producto "${missingBarcodeItem.name}" no posee código de barras ni código interno (SKU) configurado.`
        );
        return false;
      }
    }

    return true;
  };

  // Step Navigation
  const handleGoToStep = (step: 1 | 2 | 3) => {
    if (step > 1 && labelItemsToPrint.length === 0) {
      swalWarning('Selecciona Productos', 'Debes seleccionar al menos un producto para continuar.');
      return;
    }
    if (step === 3 && !validateBeforePrint()) {
      return;
    }
    setActiveStep(step);
  };

  // Execution: Browser Print
  const handlePrint = () => {
    if (!validateBeforePrint()) return;
    LabelPrinterService.printViaBrowser('presuerp-full-label-printable-area', printConfig);
  };

  // Execution: Copy ZPL
  const handleCopyZPL = () => {
    if (!validateBeforePrint()) return;
    const zplText = LabelPrinterService.generateZPL(printConfig);
    navigator.clipboard.writeText(zplText);
    swalSuccess('Código ZPL Copiado', 'Los comandos ZPL para impresora Zebra fueron copiados al portapapeles.');
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="7xl">
      <div className="flex flex-col min-h-[650px] max-h-[85vh] h-[85vh] max-w-6xl w-full mx-auto -m-6 bg-slate-50 dark:bg-slate-950 rounded-3xl overflow-hidden font-sans select-none">
        
        {/* =================================================== */}
        {/* CABECERA FIJA                                       */}
        {/* =================================================== */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-5 px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl leading-none">🏷️</span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Crear etiquetas
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Selecciona cómo quieres imprimir las etiquetas de tus productos.
            </p>
          </div>

          {/* Stepper Progress Indicator */}
          <div className="flex items-center gap-2 text-xs font-semibold self-start sm:self-auto bg-slate-100 dark:bg-slate-800/80 p-1.5 px-3 rounded-2xl border border-slate-200 dark:border-slate-700/60">
            <button
              onClick={() => handleGoToStep(1)}
              className={`flex items-center gap-1 px-3 py-1 rounded-xl transition-all ${
                activeStep === 1
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : activeStep > 1
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-500'
              }`}
            >
              ① Productos
            </button>

            <span className="text-slate-300 dark:text-slate-600 font-bold">→</span>

            <button
              onClick={() => handleGoToStep(2)}
              className={`flex items-center gap-1 px-3 py-1 rounded-xl transition-all ${
                activeStep === 2
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : activeStep > 2
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-500'
              }`}
            >
              ② Diseño
            </button>

            <span className="text-slate-300 dark:text-slate-600 font-bold">→</span>

            <button
              onClick={() => handleGoToStep(3)}
              className={`flex items-center gap-1 px-3 py-1 rounded-xl transition-all ${
                activeStep === 3
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              ③ Imprimir
            </button>
          </div>
        </div>

        {/* =================================================== */}
        {/* CUERPO CON SCROLL INTERNO                           */}
        {/* =================================================== */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          
          {/* =================================================== */}
          {/* PASO 1 — PRODUCTOS                                  */}
          {/* =================================================== */}
          {activeStep === 1 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  ¿Qué productos quieres etiquetar?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selecciona los productos y la cantidad de etiquetas.
                </p>
              </div>

              {/* Filters Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Buscar productos
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="🔎 Buscar productos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Categoría
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full py-1.5 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="ALL">Todas las Categorías</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Depósito
                  </label>
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="w-full py-1.5 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="ALL">Todos los Depósitos</option>
                    {warehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Estado
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full py-1.5 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="ACTIVE">Activos</option>
                    <option value="ALL">Todos</option>
                    <option value="INACTIVE">Inactivos</option>
                  </select>
                </div>
              </div>

              {/* Selection Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all"
                  >
                    Seleccionar todos
                  </button>
                  {labelItemsToPrint.length > 0 && (
                    <button
                      onClick={handleDeselectAll}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors"
                    >
                      Deseleccionar todos
                    </button>
                  )}
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/50">
                    {labelItemsToPrint.length} productos seleccionados
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useStockQuantity}
                      onChange={(e) => setUseStockQuantity(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                    <span className="ml-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Usar cantidad de stock
                    </span>
                  </label>
                </div>
              </div>

              {/* Product Cards List */}
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {loadingProducts ? (
                  <div className="p-8 text-center text-slate-400 text-xs italic bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    Cargando catálogo de productos...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs italic bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    No se encontraron productos con los filtros aplicados.
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isSelected = selectedMap[p.id] !== undefined;
                    const priceVal = getProductPrice(p);
                    const currentQty = selectedMap[p.id] || 1;

                    return (
                      <div
                        key={p.id}
                        onClick={() => handleToggleSelectProduct(p)}
                        className={`p-3 px-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-500 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                          />
                          <div>
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                              {p.name}
                            </h4>
                            <div className="flex items-center gap-4 text-xs text-slate-500 mt-0.5">
                              <span>Código: <strong className="font-mono text-slate-700 dark:text-slate-300">{p.barcode || p.sku || 'Sin código'}</strong></span>
                              <span>Precio: <strong className="text-slate-900 dark:text-white font-bold">{currencySymbol} {priceVal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Quantity Stepper */}
                        {isSelected && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 px-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 self-end sm:self-auto shadow-2xs"
                          >
                            <span className="text-[11px] font-semibold text-slate-500 mr-1">Cantidad:</span>
                            <button
                              type="button"
                              disabled={useStockQuantity}
                              onClick={() => handleQuantityChange(p.id, -1)}
                              className="p-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 disabled:opacity-40"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center font-bold text-xs text-slate-900 dark:text-white">
                              {currentQty}
                            </span>
                            <button
                              type="button"
                              disabled={useStockQuantity}
                              onClick={() => handleQuantityChange(p.id, 1)}
                              className="p-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 disabled:opacity-40"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom List Counter */}
              <div className="text-right text-xs font-bold text-slate-500">
                {labelItemsToPrint.length} productos · {totalLabelsCount} etiquetas
              </div>
            </div>
          )}

          {/* =================================================== */}
          {/* PASO 2 — DISEÑO                                     */}
          {/* =================================================== */}
          {activeStep === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Elige el diseño de tu etiqueta
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selecciona cómo quieres que se vea el precio y el código.
                </p>
              </div>

              {/* 4 VISUAL TEMPLATE CARDS (2x2 GRID IN DESKTOP) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* CARD 1: ESTÁNDAR */}
                <div
                  onClick={() => setDesign('STANDARD')}
                  className={`p-4 rounded-3xl border-2 cursor-pointer transition-all relative flex flex-col justify-between ${
                    design === 'STANDARD'
                      ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  {design === 'STANDARD' && (
                    <div className="absolute top-3 right-3 text-indigo-600">
                      <CheckCircle2 className="w-5 h-5 fill-indigo-600 text-white" />
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white mb-2">🏷️ Estándar</div>
                    {/* High Fidelity Mini Preview */}
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs mb-3 text-center">
                      <div className="text-[11px] font-bold text-slate-900 truncate">Coca Cola 500ml</div>
                      <div className="text-xs font-extrabold text-slate-900 my-1">$1.500</div>
                      <div className="font-mono text-[9px] text-slate-800 tracking-widest bg-slate-100 p-0.5 rounded">███████████████</div>
                      <div className="text-[8px] font-mono text-slate-500">779123456789</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-tight">
                    Nombre, precio y código de barras.
                  </p>
                </div>

                {/* CARD 2: COMPACTA */}
                <div
                  onClick={() => setDesign('COMPACT')}
                  className={`p-4 rounded-3xl border-2 cursor-pointer transition-all relative flex flex-col justify-between ${
                    design === 'COMPACT'
                      ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  {design === 'COMPACT' && (
                    <div className="absolute top-3 right-3 text-indigo-600">
                      <CheckCircle2 className="w-5 h-5 fill-indigo-600 text-white" />
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white mb-2">📏 Compacta</div>
                    {/* High Fidelity Mini Preview */}
                    <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs mb-3 text-center scale-95">
                      <div className="text-[10px] font-bold text-slate-900 truncate">Coca Cola 500ml</div>
                      <div className="text-xs font-bold text-slate-900 my-0.5">$1.500</div>
                      <div className="font-mono text-[8px] text-slate-800 tracking-widest">████████████</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-tight">
                    Para etiquetas pequeñas.
                  </p>
                </div>

                {/* CARD 3: CÓDIGO INTERNO */}
                <div
                  onClick={() => setDesign('INTERNAL_CODE')}
                  className={`p-4 rounded-3xl border-2 cursor-pointer transition-all relative flex flex-col justify-between ${
                    design === 'INTERNAL_CODE'
                      ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  {design === 'INTERNAL_CODE' && (
                    <div className="absolute top-3 right-3 text-indigo-600">
                      <CheckCircle2 className="w-5 h-5 fill-indigo-600 text-white" />
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white mb-2">🔢 Código interno</div>
                    {/* High Fidelity Mini Preview */}
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs mb-3 text-center">
                      <div className="text-[11px] font-bold text-slate-900 truncate">Coca Cola 500ml</div>
                      <div className="text-[9px] font-mono text-slate-500">Cód: CC500</div>
                      <div className="text-xs font-extrabold text-slate-900 my-0.5">$1.500</div>
                      <div className="font-mono text-[9px] text-slate-800 tracking-widest bg-slate-100 p-0.5 rounded">███████████████</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-tight">
                    Muestra también tu código interno.
                  </p>
                </div>

                {/* CARD 4: PRECIO DE GÓNDOLA */}
                <div
                  onClick={() => setDesign('PRICE_ONLY')}
                  className={`p-4 rounded-3xl border-2 cursor-pointer transition-all relative flex flex-col justify-between ${
                    design === 'PRICE_ONLY'
                      ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  {design === 'PRICE_ONLY' && (
                    <div className="absolute top-3 right-3 text-indigo-600">
                      <CheckCircle2 className="w-5 h-5 fill-indigo-600 text-white" />
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white mb-2">💲 Precio de góndola</div>
                    {/* High Fidelity Mini Preview */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs mb-3 text-center">
                      <div className="text-[10px] font-bold text-slate-700 uppercase">Coca Cola 500ml</div>
                      <div className="text-base font-black text-slate-950 mt-1">$1.500</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-tight">
                    Precio grande para góndolas y exhibidores.
                  </p>
                </div>
              </div>

              {/* FORMATO DE PAPEL */}
              <div className="space-y-3 pt-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    ¿En qué formato vas a imprimir?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Elige el tamaño de tus etiquetas.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* PAPER CARD 1: TÉRMICA 58MM */}
                  <div
                    onClick={() => setPaperType('THERMAL_58')}
                    className={`p-4 rounded-3xl border-2 cursor-pointer transition-all relative flex flex-col justify-between ${
                      paperType === 'THERMAL_58'
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    {paperType === 'THERMAL_58' && (
                      <div className="absolute top-3 right-3 text-indigo-600">
                        <CheckCircle2 className="w-5 h-5 fill-indigo-600 text-white" />
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">🖨️ Térmica 58 mm</div>
                      <div className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        58 × 40 mm
                      </div>
                    </div>
                  </div>

                  {/* PAPER CARD 2: TÉRMICA 80MM */}
                  <div
                    onClick={() => setPaperType('THERMAL_80')}
                    className={`p-4 rounded-3xl border-2 cursor-pointer transition-all relative flex flex-col justify-between ${
                      paperType === 'THERMAL_80'
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    {paperType === 'THERMAL_80' && (
                      <div className="absolute top-3 right-3 text-indigo-600">
                        <CheckCircle2 className="w-5 h-5 fill-indigo-600 text-white" />
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">🖨️ Térmica 80 mm</div>
                      <div className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        80 × 50 mm
                      </div>
                    </div>
                  </div>

                  {/* PAPER CARD 3: HOJA A4 */}
                  <div
                    onClick={() => setPaperType('SHEET_A4')}
                    className={`p-4 rounded-3xl border-2 cursor-pointer transition-all relative flex flex-col justify-between ${
                      paperType === 'SHEET_A4'
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    {paperType === 'SHEET_A4' && (
                      <div className="absolute top-3 right-3 text-indigo-600">
                        <CheckCircle2 className="w-5 h-5 fill-indigo-600 text-white" />
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">📄 Hoja A4</div>
                      <div className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        3 × 8 etiquetas por hoja
                      </div>
                    </div>
                  </div>

                  {/* PAPER CARD 4: PERSONALIZADO */}
                  <div
                    onClick={() => setPaperType('CUSTOM')}
                    className={`p-4 rounded-3xl border-2 cursor-pointer transition-all relative flex flex-col justify-between ${
                      paperType === 'CUSTOM'
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    {paperType === 'CUSTOM' && (
                      <div className="absolute top-3 right-3 text-indigo-600">
                        <CheckCircle2 className="w-5 h-5 fill-indigo-600 text-white" />
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">⚙️ Personalizado</div>
                      <div className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        Medidas libres
                      </div>
                    </div>
                  </div>
                </div>

                {paperType === 'CUSTOM' && (
                  <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Ancho (mm)</label>
                      <input
                        type="number"
                        min={10}
                        max={300}
                        value={paperConfig.widthMm}
                        onChange={(e) => setPaperConfig({ ...paperConfig, widthMm: Number(e.target.value) || 10 })}
                        className="w-24 px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Alto (mm)</label>
                      <input
                        type="number"
                        min={10}
                        max={300}
                        value={paperConfig.heightMm}
                        onChange={(e) => setPaperConfig({ ...paperConfig, heightMm: Number(e.target.value) || 10 })}
                        className="w-24 px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* PRECIO A IMPRIMIR & TIPO DE CÓDIGO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* PRECIO A IMPRIMIR */}
                <div className="bg-white dark:bg-slate-900 p-4 px-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Precio a imprimir
                    </label>
                    {selectedPriceListIsDefault && (
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                        Predeterminada
                      </span>
                    )}
                  </div>
                  <select
                    value={selectedPriceListId}
                    onChange={(e) => setSelectedPriceListId(e.target.value)}
                    className="w-full py-2 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  >
                    <option value="BASE">Precio Base de Venta</option>
                    {priceLists.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name} {pl.isDefault ? '(Predeterminada)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Las etiquetas utilizarán el precio de esta lista.
                  </p>
                </div>

                {/* TIPO DE CÓDIGO (OCULTO SI ES "PRECIO DE GÓNDOLA") */}
                {design !== 'PRICE_ONLY' && (
                  <div className="bg-white dark:bg-slate-900 p-4 px-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                    <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                      Tipo de código
                    </label>
                    <select
                      value={symbology}
                      onChange={(e) => setSymbology(e.target.value as any)}
                      className="w-full py-2 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                    >
                      <option value="AUTO">Automático</option>
                      <option value="EAN13">EAN-13</option>
                      <option value="EAN8">EAN-8</option>
                      <option value="CODE128">CODE-128</option>
                    </select>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Automático detecta el formato según el código del producto.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================== */}
          {/* PASO 3 — IMPRIMIR                                   */}
          {/* =================================================== */}
          {activeStep === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Vista previa
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Así se verán tus etiquetas al imprimir.
                </p>
              </div>

              {/* RESUMEN CLEAN CARD */}
              <div className="bg-white dark:bg-slate-900 p-4 px-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Listo para imprimir
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-3">
                  <span>{labelItemsToPrint.length} productos · {totalLabelsCount} etiquetas</span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span>{paperFriendlyName} · {paperConfig.widthMm} × {paperConfig.heightMm} mm</span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-slate-600 dark:text-slate-400">{selectedPriceListName}</span>
                </div>
              </div>

              {/* PAGINACIÓN SI HAY MULTIPÁGINA */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 px-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={previewPage <= 1}
                    onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                    className="text-xs font-bold rounded-xl"
                  >
                    ← Anterior
                  </Button>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Página {previewPage} de {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={previewPage >= totalPages}
                    onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                    className="text-xs font-bold rounded-xl"
                  >
                    Siguiente →
                  </Button>
                </div>
              )}

              {/* CANVAS CENTRADO REALISTA SOBRE FONDO GRIS SUAVE */}
              <div className="p-8 bg-slate-200 dark:bg-slate-950 rounded-3xl border border-slate-300 dark:border-slate-800 flex justify-center items-center overflow-auto min-h-[360px] shadow-inner">
                <div
                  id="presuerp-label-printable-area"
                  className="bg-white p-4 rounded-xl shadow-2xl transition-all"
                  style={{
                    width: paperConfig.type === 'SHEET_A4' ? '210mm' : `${paperConfig.widthMm + 8}mm`,
                  }}
                >
                  {paperConfig.type === 'SHEET_A4' ? (
                    <div
                      className="grid gap-2"
                      style={{
                        gridTemplateColumns: `repeat(${paperConfig.cols}, minmax(0, 1fr))`,
                      }}
                    >
                      {expandedLabelList
                        .slice((previewPage - 1) * labelsPerPage, previewPage * labelsPerPage)
                        .map((item, idx) => (
                          <LabelPreviewCard
                            key={`${item.id}-${idx}`}
                            name={item.name}
                            sku={item.sku}
                            barcode={item.barcode}
                            price={item.price}
                            currencySymbol={currencySymbol}
                            design={design}
                            paper={paperConfig}
                            symbology={symbology}
                          />
                        ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      {expandedLabelList
                        .slice((previewPage - 1) * 10, previewPage * 10)
                        .map((item, idx) => (
                          <div key={`${item.id}-${idx}`} className="page-break-after">
                            <LabelPreviewCard
                              name={item.name}
                              sku={item.sku}
                              barcode={item.barcode}
                              price={item.price}
                              currencySymbol={currencySymbol}
                              design={design}
                              paper={paperConfig}
                              symbology={symbology}
                            />
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* CONTENEDOR DESPAGINADO EXCLUSIVO PARA IMPRESIÓN DEL NAVEGADOR (OCULTO EN PANTALLA) */}
              <div id="presuerp-full-label-printable-area" className="hidden">
                {paperConfig.type === 'SHEET_A4' ? (
                  Array.from({ length: totalPages }).map((_, sheetIdx) => (
                    <div key={`full-sheet-${sheetIdx}`} className="a4-print-sheet w-full font-sans">
                      <div
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns: `repeat(${paperConfig.cols}, minmax(0, 1fr))`,
                        }}
                      >
                        {expandedLabelList
                          .slice(sheetIdx * labelsPerPage, (sheetIdx + 1) * labelsPerPage)
                          .map((item, idx) => (
                            <LabelPreviewCard
                              key={`full-print-sheet-${sheetIdx}-${item.id}-${idx}`}
                              name={item.name}
                              sku={item.sku}
                              barcode={item.barcode}
                              price={item.price}
                              currencySymbol={currencySymbol}
                              design={design}
                              paper={paperConfig}
                              symbology={symbology}
                            />
                          ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center">
                    {expandedLabelList.map((item, idx) => (
                      <div key={`full-print-thermal-${item.id}-${idx}`} className="page-break-after">
                        <LabelPreviewCard
                          name={item.name}
                          sku={item.sku}
                          barcode={item.barcode}
                          price={item.price}
                          currencySymbol={currencySymbol}
                          design={design}
                          paper={paperConfig}
                          symbology={symbology}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* =================================================== */}
        {/* FOOTER FIJO                                         */}
        {/* =================================================== */}
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 px-8 flex items-center justify-between flex-shrink-0">
          <div>
            {activeStep > 1 && (
              <button
                type="button"
                onClick={() => handleGoToStep((activeStep - 1) as any)}
                className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                ← Volver
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              Cancelar
            </button>

            {activeStep < 3 ? (
              <Button
                type="button"
                onClick={() => handleGoToStep((activeStep + 1) as any)}
                disabled={labelItemsToPrint.length === 0}
                className="font-extrabold text-xs rounded-xl px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
              >
                Continuar →
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyZPL}
                  className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1"
                >
                  <FileCode2 className="w-3.5 h-3.5 text-purple-500" /> Copiar ZPL
                </button>
                <Button
                  type="button"
                  onClick={handlePrint}
                  className="font-extrabold text-sm rounded-xl px-7 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md flex items-center gap-2"
                >
                  🖨️ Imprimir etiquetas
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
