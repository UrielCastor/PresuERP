import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Warehouse,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Package,
  Send,
  Save,
  ArrowRight,
  ShoppingCart,
  Building,
} from 'lucide-react';
import { logisticsService, ProductAvailabilityWarehouseDto } from '../../services/logistics.service';
import { warehouseApi, Warehouse as WarehouseType } from '../../services/warehouse.service';
import { useAuth } from '../../contexts/AuthContext';

interface CartItem {
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  unitOfMeasure?: string;
  availableInOrigin: number;
  quantity: number;
}

export const CreateTransferRequest: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const [loadingWarehouses, setLoadingWarehouses] = useState(true);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Warehouse selection
  const [originWarehouseId, setOriginWarehouseId] = useState<string>('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<string>('');

  // Step 2: Product search & Cart
  const [productQuery, setProductQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Selected product availability lookup in origin
  const [selectedProductAvailabilities, setSelectedProductAvailabilities] = useState<Record<string, number>>({});

  // Step 3: Confirmation
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Load active warehouses
  useEffect(() => {
    const fetchWarehouses = async () => {
      setLoadingWarehouses(true);
      try {
        const data = await warehouseApi.list();
        const active = data.filter((w) => w.status === 'ACTIVE');
        setWarehouses(active);

        // Pre-select destination to user's warehouse or default main warehouse
        if (active.length > 0) {
          const defaultDest = active.find((w) => w.isMain) || active[0];
          setDestinationWarehouseId(defaultDest.id);
        }
      } catch (err: any) {
        console.error('Error cargando depósitos:', err);
        setError('No se pudieron cargar los depósitos del sistema.');
      } finally {
        setLoadingWarehouses(false);
      }
    };

    fetchWarehouses();
  }, []);

  // Debounced Product Search & Availability Lookup
  useEffect(() => {
    if (!productQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await logisticsService.searchLogisticsProducts(productQuery);
        const products = res.data || [];
        setSearchResults(products);

        // Fetch availability in selected origin warehouse for search results
        if (originWarehouseId) {
          const availMap: Record<string, number> = {};
          await Promise.all(
            products.slice(0, 5).map(async (p: any) => {
              try {
                const availRes = await logisticsService.getProductAvailability(p.id);
                const wAvail = availRes.data.warehouses.find(
                  (w: ProductAvailabilityWarehouseDto) => w.warehouseId === originWarehouseId
                );
                availMap[p.id] = wAvail ? wAvail.availableStock : 0;
              } catch (e) {
                availMap[p.id] = 0;
              }
            })
          );
          setSelectedProductAvailabilities((prev) => ({ ...prev, ...availMap }));
        }
      } catch (err: any) {
        console.error('Error buscando productos:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [productQuery, originWarehouseId]);

  // Handle adding product to cart
  const handleAddToCart = async (product: any) => {
    setError(null);
    if (cart.some((item) => item.productId === product.id)) {
      setError(`El producto "${product.name}" ya se encuentra agregado al pedido.`);
      return;
    }

    // Get origin availability
    let availInOrigin = selectedProductAvailabilities[product.id];
    if (availInOrigin === undefined && originWarehouseId) {
      try {
        const availRes = await logisticsService.getProductAvailability(product.id);
        const wAvail = availRes.data.warehouses.find(
          (w: ProductAvailabilityWarehouseDto) => w.warehouseId === originWarehouseId
        );
        availInOrigin = wAvail ? wAvail.availableStock : 0;
      } catch (e) {
        availInOrigin = 0;
      }
    }

    setCart((prev) => [
      ...prev,
      {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        unitOfMeasure: product.unitOfMeasure,
        availableInOrigin: availInOrigin || 0,
        quantity: 1,
      },
    ]);

    setProductQuery('');
    setSearchResults([]);
  };

  const handleUpdateQuantity = (productId: string, val: number) => {
    setError(null);
    if (val <= 0 || isNaN(val)) {
      setError('La cantidad solicitada debe ser mayor a 0.');
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity: val } : item))
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Step 1 Validation -> Proceed to Step 2
  const handleProceedToStep2 = () => {
    setError(null);
    if (!originWarehouseId) {
      setError('Debe seleccionar el depósito de Origen (abastecedor).');
      return;
    }
    if (!destinationWarehouseId) {
      setError('Debe seleccionar el depósito de Destino (solicitante).');
      return;
    }
    if (originWarehouseId === destinationWarehouseId) {
      setError('El depósito de origen y de destino no pueden ser el mismo.');
      return;
    }
    setCurrentStep(2);
  };

  // Step 2 Validation -> Proceed to Step 3
  const handleProceedToStep3 = () => {
    setError(null);
    if (cart.length === 0) {
      setError('Debe agregar al menos un producto al pedido.');
      return;
    }
    for (const item of cart) {
      if (item.quantity <= 0 || isNaN(item.quantity)) {
        setError(`La cantidad para el producto "${item.name}" debe ser mayor a 0.`);
        return;
      }
    }
    setCurrentStep(3);
  };

  // Submit Order (as DRAFT or SEND directly)
  const handleSubmitOrder = async (sendImmediately: boolean) => {
    setError(null);
    setIsSubmitting(true);
    try {
      // 1. Create Transfer Request
      const payload = {
        originWarehouseId,
        destinationWarehouseId,
        notes,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      };

      const res = await logisticsService.createTransferRequest(payload);
      const createdOrder = res.data;

      // 2. If send immediately
      if (sendImmediately && createdOrder?.id) {
        await logisticsService.sendTransferRequest(createdOrder.id);
      }

      navigate('/logistics/orders', { replace: true });
    } catch (err: any) {
      console.error('Error enviando pedido:', err);
      setError(err.response?.data?.message || 'Error al procesar el pedido de transferencia.');
    } finally {
      setIsSubmitting(false);
      setConfirmModalOpen(false);
    }
  };

  const originWarehouseObj = warehouses.find((w) => w.id === originWarehouseId);
  const destinationWarehouseObj = warehouses.find((w) => w.id === destinationWarehouseId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation Back Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/logistics/orders')}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Pedidos Internos
        </button>
        <span className="text-xs font-semibold text-slate-400">
          Nuevo Pedido de Abastecimiento
        </span>
      </div>

      {/* Title */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚚</span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              Solicitar Mercadería a Depósito
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Asistente en 3 pasos para reponer stock entre sucursales de forma segura.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm flex items-center gap-2 animate-shake">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEPPER PROGRESS BAR */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between relative max-w-xl mx-auto">
          {/* Connector Line */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 z-0" />
          <div
            className="absolute top-1/2 left-0 h-1 bg-primary-600 transition-all duration-300 -translate-y-1/2 z-0"
            style={{
              width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%',
            }}
          />

          {/* Step 1 Circle */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            <button
              onClick={() => setCurrentStep(1)}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-sm ${
                currentStep >= 1
                  ? 'bg-primary-600 text-white shadow-primary-500/30'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
              }`}
            >
              1
            </button>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Depósitos</span>
          </div>

          {/* Step 2 Circle */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            <button
              onClick={() => {
                if (originWarehouseId && destinationWarehouseId && originWarehouseId !== destinationWarehouseId) {
                  setCurrentStep(2);
                }
              }}
              disabled={!originWarehouseId || originWarehouseId === destinationWarehouseId}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-sm ${
                currentStep >= 2
                  ? 'bg-primary-600 text-white shadow-primary-500/30'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
              }`}
            >
              2
            </button>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Productos</span>
          </div>

          {/* Step 3 Circle */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            <button
              onClick={() => {
                if (cart.length > 0) setCurrentStep(3);
              }}
              disabled={cart.length === 0}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-sm ${
                currentStep === 3
                  ? 'bg-primary-600 text-white shadow-primary-500/30'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
              }`}
            >
              3
            </button>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Confirmación</span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* PASO 1: SELECCIÓN DE DEPÓSITOS ORIGEN Y DESTINO */}
      {/* ==================================================================== */}
      {currentStep === 1 && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building className="h-5 w-5 text-primary-600" />
              Paso 1: Seleccionar Depósitos de la Red
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Elige el depósito al que le solicitarás la mercadería (Origen) y el depósito de tu sucursal que la recibirá (Destino).
            </p>
          </div>

          {loadingWarehouses ? (
            <div className="p-8 text-center text-slate-400 animate-pulse">
              Cargando depósitos disponibles...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Depósito Origen */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Depósito Origen (Abastecedor) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={originWarehouseId}
                    onChange={(e) => {
                      setOriginWarehouseId(e.target.value);
                      setError(null);
                    }}
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                  >
                    <option value="">-- Seleccionar Depósito Origen --</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code}) {w.isMain ? '★ Principal' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {originWarehouseObj && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-300">
                    <strong>Abastecedor seleccionado:</strong> {originWarehouseObj.name} ({originWarehouseObj.code}). Le solicitarás existencias a este depósito.
                  </div>
                )}
              </div>

              {/* Depósito Destino */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Depósito Destino (Tu Sucursal) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={destinationWarehouseId}
                    onChange={(e) => {
                      setDestinationWarehouseId(e.target.value);
                      setError(null);
                    }}
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                  >
                    <option value="">-- Seleccionar Depósito Destino --</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code}) {w.isMain ? '★ Principal' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {destinationWarehouseObj && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
                    <strong>Receptor seleccionado:</strong> {destinationWarehouseObj.name} ({destinationWarehouseObj.code}). La mercadería ingresará aquí.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleProceedToStep2}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              Siguiente: Buscar Productos <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PASO 2: BÚSQUEDA DE PRODUCTOS Y CARRITO TEMPORAL */}
      {/* ==================================================================== */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* Card Context Banner */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-400">Origen:</span>
              <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 font-bold rounded-lg">
                {originWarehouseObj?.name}
              </span>
              <span className="text-slate-400">$\rightarrow$</span>
              <span className="font-bold text-slate-400">Destino:</span>
              <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold rounded-lg">
                {destinationWarehouseObj?.name}
              </span>
            </div>
            <button
              onClick={() => setCurrentStep(1)}
              className="text-xs text-primary-600 font-semibold hover:underline"
            >
              Cambiar Depósitos
            </button>
          </div>

          {/* Search Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Search className="h-5 w-5 text-primary-600" />
              Paso 2: Buscar y Agregar Productos
            </h2>

            <div className="relative">
              <Search className="h-5 w-5 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Buscar por Nombre, SKU o Código de Barras..."
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-500"
              />
              {isSearching && (
                <span className="absolute right-4 top-3.5 text-xs text-slate-400 font-semibold animate-pulse">
                  Buscando disponibilidades...
                </span>
              )}
            </div>

            {/* Live Search Results */}
            {searchResults.length > 0 && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                {searchResults.map((p) => {
                  const avail = selectedProductAvailabilities[p.id] ?? 0;
                  const isAdded = cart.some((i) => i.productId === p.id);
                  return (
                    <div
                      key={p.id}
                      className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{p.name}</div>
                        <div className="text-slate-400">
                          SKU: {p.sku} | Código: {p.barcode || 'N/A'}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Disp. Origen</span>
                          <span
                            className={`font-black text-sm ${
                              avail > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                            }`}
                          >
                            {avail} u.
                          </span>
                        </div>

                        <button
                          onClick={() => handleAddToCart(p)}
                          disabled={isAdded}
                          className={`px-3 py-1.5 font-bold rounded-xl text-xs flex items-center gap-1 transition-all ${
                            isAdded
                              ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed'
                              : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
                          }`}
                        >
                          <Plus className="h-4 w-4" /> {isAdded ? 'Agregado' : 'Agregar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Table Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-indigo-600" />
                Carrito Temporal de Abastecimiento ({cart.length} productos)
              </h3>
            </div>

            {cart.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <Package className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs">No has agregado productos al pedido todavía. Utiliza el buscador superior para agregar ítems.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500">
                      <th className="p-3">Producto</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3 text-center">Disp. Origen</th>
                      <th className="p-3 text-center w-36">Cantidad Solicitada</th>
                      <th className="p-3 text-right">Quitar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {cart.map((item) => (
                      <tr key={item.productId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{item.name}</td>
                        <td className="p-3 text-xs text-slate-400 font-mono">{item.sku}</td>
                        <td className="p-3 text-center">
                          <span className="px-2.5 py-0.5 rounded-md font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {item.availableInOrigin} u.
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(item.productId, parseInt(e.target.value, 10))}
                            className="w-24 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-sm focus:ring-2 focus:ring-primary-500"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleRemoveFromCart(item.productId)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
              >
                Volver a Paso 1
              </button>

              <button
                onClick={handleProceedToStep3}
                disabled={cart.length === 0}
                className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                Siguiente: Confirmar Pedido <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PASO 3: RESUMEN Y CONFIRMACIÓN */}
      {/* ==================================================================== */}
      {currentStep === 3 && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Paso 3: Resumen y Confirmación Final
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Revisa todos los datos antes de enviar la solicitud de abastecimiento.
            </p>
          </div>

          {/* Resumen Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-slate-400 uppercase font-semibold">Depósito Origen (Abastecedor)</span>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                {originWarehouseObj?.name} ({originWarehouseObj?.code})
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-slate-400 uppercase font-semibold">Depósito Destino (Solicitante)</span>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                {destinationWarehouseObj?.name} ({destinationWarehouseObj?.code})
              </div>
            </div>
          </div>

          {/* Products Summary Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Detalle de Productos a Solicitar ({cart.length})
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
              {cart.map((item) => (
                <div key={item.productId} className="p-3.5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{item.name}</div>
                    <div className="text-slate-400">SKU: {item.sku}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 font-medium">Cantidad: </span>
                    <span className="font-black text-base text-primary-600 dark:text-primary-400">
                      {item.quantity} u.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes textarea */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Notas u Observaciones (Opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Escriba comentarios o prioridades para el depósito origen..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
            >
              Modificar Productos (Paso 2)
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => handleSubmitOrder(false)}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" /> Guardar Borrador
              </button>

              <button
                onClick={() => handleSubmitOrder(true)}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Send className="h-4 w-4" /> Enviar Pedido a Aprobación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
