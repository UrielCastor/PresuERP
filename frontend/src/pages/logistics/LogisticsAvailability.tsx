import React, { useState, useEffect } from 'react';
import { Search, Warehouse, Package } from 'lucide-react';
import { logisticsService, ProductAvailabilityDto } from '../../services/logistics.service';

export const LogisticsAvailability: React.FC = () => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<ProductAvailabilityDto | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced product search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const res = await logisticsService.searchLogisticsProducts(query);
        setSearchResults(res.data || []);
      } catch (err: any) {
        console.error('Error buscando productos:', err);
        setError('Error al realizar la búsqueda de productos.');
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectProduct = async (productId: string) => {
    setSelectedProductId(productId);
    setLoadingAvailability(true);
    setError(null);
    try {
      const res = await logisticsService.getProductAvailability(productId);
      setAvailability(res.data);
    } catch (err: any) {
      console.error('Error obteniendo disponibilidad:', err);
      setError('No se pudo obtener la disponibilidad del producto en los depósitos.');
    } finally {
      setLoadingAvailability(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2">
          <Warehouse className="h-6 w-6 text-primary-600" />
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
            Consulta de Disponibilidad Logística
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Busca un producto por nombre o SKU para conocer el stock disponible en cada depósito de la red sin exponer valores financieros.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Product Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
          Buscar Producto en la Red
        </label>
        <div className="relative">
          <Search className="h-5 w-5 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Ingrese el nombre, código de barras o SKU del producto..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
          />
          {isSearching && (
            <span className="absolute right-4 top-3 text-xs text-slate-400 font-semibold animate-pulse">
              Buscando depósitos...
            </span>
          )}
        </div>

        {/* Search Results Grid / List */}
        {searchResults.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
            {searchResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectProduct(p.id)}
                className={`w-full text-left p-3.5 hover:bg-primary-50/50 dark:hover:bg-primary-950/20 transition-colors flex items-center justify-between text-xs ${
                  selectedProductId === p.id ? 'bg-primary-50 dark:bg-primary-950/30 border-l-4 border-primary-600' : ''
                }`}
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{p.name}</div>
                  <div className="text-slate-400">SKU: {p.sku} | Código: {p.barcode || 'N/A'} | Unidad: {p.unitOfMeasure || 'UNI'}</div>
                </div>
                <span className="text-primary-600 font-bold">Ver disponibilidades $\rightarrow$</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Product Availability Cards / Table */}
      {loadingAvailability ? (
        <div className="p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-slate-400">
          Consultando disponibilidades entre depósitos...
        </div>
      ) : availability ? (
        <div className="space-y-4">
          {/* Selected Product Summary Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary-100 dark:bg-primary-950/50 text-primary-600 rounded-xl">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  {availability.productName}
                </h2>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  SKU: <span className="font-bold">{availability.sku}</span> | Código: <span className="font-bold">{availability.barcode || 'N/A'}</span> | Unidad: <span className="font-bold">{availability.unitOfMeasure || 'UNI'}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400 uppercase font-semibold">Total Disponible en Red</span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {availability.warehouses.reduce((acc, w) => acc + w.availableStock, 0)} u.
              </div>
            </div>
          </div>

          {/* Warehouse Availability Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                Disponibilidad por Depósito
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500">
                    <th className="p-4">Depósito</th>
                    <th className="p-4">Código</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4 text-center">Cantidad Disponible</th>
                    <th className="p-4 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {availability.warehouses.map((w) => (
                    <tr key={w.warehouseId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold text-slate-900 dark:text-slate-100">
                        {w.warehouseName}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                        {w.warehouseCode}
                      </td>
                      <td className="p-4 text-xs">
                        {w.isMain ? (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 font-semibold rounded-md">
                            Principal
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-medium rounded-md">
                            Sucursal
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center font-black text-base text-slate-900 dark:text-slate-100">
                        {w.availableStock}
                      </td>
                      <td className="p-4 text-right">
                        {w.status === 'AVAILABLE' ? (
                          <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {w.statusLabel}
                          </span>
                        ) : (
                          <span className="px-3 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            {w.statusLabel}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-slate-400 space-y-2">
          <Search className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p>Escribe el nombre o SKU de un producto arriba para consultar las existencias disponibles en cada depósito.</p>
        </div>
      )}
    </div>
  );
};
