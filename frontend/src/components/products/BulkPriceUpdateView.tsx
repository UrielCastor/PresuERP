import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  Save,
  X,
  Building2,
  Package,
} from 'lucide-react';
import { Button, Input, Select, Badge, Modal } from '../ui';
import { supplierApi } from '../../services/supplier.service';
import { productApi, Product } from '../../services/product.service';
import { productPriceUpdateService } from '../../services/productPriceUpdateService';

interface BulkPriceUpdateViewProps {
  onCancel: () => void;
  onSuccess: () => void;
}

interface EditableProductRow {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  oldPurchasePrice: number;
  oldSalePrice: number;
  percentage: number;
  newPurchasePrice: number;
  newSalePrice: number;
  isModified: boolean;
}

export const BulkPriceUpdateView: React.FC<BulkPriceUpdateViewProps> = ({
  onCancel,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  // Selected supplier
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  // General percentage shortcut
  const [globalPercentInput, setGlobalPercentInput] = useState<string>('8');

  // Editable rows state
  const [rows, setRows] = useState<EditableProductRow[]>([]);

  // Preview modal state
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch suppliers list
  const { data: suppliersData, isLoading: loadingSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierApi.list(),
  });
  const suppliers: any[] = Array.isArray(suppliersData)
    ? suppliersData
    : (suppliersData as any)?.data || [];

  // Auto-select first supplier when loaded
  useEffect(() => {
    if (suppliers.length > 0 && !selectedSupplierId) {
      setSelectedSupplierId(suppliers[0].id);
    }
  }, [suppliers, selectedSupplierId]);

  // Fetch products for selected supplier
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['products', 'supplier', selectedSupplierId],
    queryFn: () => productApi.list(selectedSupplierId),
    enabled: Boolean(selectedSupplierId),
  });

  const products: Product[] = Array.isArray(productsData)
    ? productsData
    : (productsData as any)?.data || [];

  // Synchronize rows when products dataset loads
  useEffect(() => {
    if (products && products.length > 0) {
      const mapped: EditableProductRow[] = products.map((p) => {
        const purchase = Number(p.purchasePrice) || 0;
        const sale = Number(p.salePrice) || 0;
        return {
          id: p.id,
          name: p.name,
          sku: p.sku || '',
          barcode: p.barcode || '',
          oldPurchasePrice: purchase,
          oldSalePrice: sale,
          percentage: 0,
          newPurchasePrice: purchase,
          newSalePrice: sale,
          isModified: false,
        };
      });
      setRows(mapped);
    } else {
      setRows([]);
    }
  }, [products]);

  // Apply general percentage to all rows
  const handleApplyGlobalPercentage = () => {
    const pct = parseFloat(globalPercentInput) || 0;
    setRows((prev) =>
      prev.map((r) => {
        const newPurchase = Math.round(r.oldPurchasePrice * (1 + pct / 100) * 100) / 100;
        const newSale = Math.round(r.oldSalePrice * (1 + pct / 100) * 100) / 100;
        const isModified = newPurchase !== r.oldPurchasePrice || newSale !== r.oldSalePrice;
        return {
          ...r,
          percentage: pct,
          newPurchasePrice: newPurchase,
          newSalePrice: newSale,
          isModified,
        };
      })
    );
  };

  // Row edit handlers
  const handleRowPercentageChange = (id: string, valueStr: string) => {
    const pct = parseFloat(valueStr);
    const validPct = isNaN(pct) ? 0 : pct;

    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const newPurchase = Math.round(r.oldPurchasePrice * (1 + validPct / 100) * 100) / 100;
        const newSale = Math.round(r.oldSalePrice * (1 + validPct / 100) * 100) / 100;
        const isModified = newPurchase !== r.oldPurchasePrice || newSale !== r.oldSalePrice;
        return {
          ...r,
          percentage: isNaN(pct) ? (valueStr as any) : validPct,
          newPurchasePrice: newPurchase,
          newSalePrice: newSale,
          isModified,
        };
      })
    );
  };

  const handleRowNewSalePriceChange = (id: string, valueStr: string) => {
    const val = parseFloat(valueStr);
    const newSale = isNaN(val) ? 0 : val;

    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const pct = r.oldSalePrice > 0 ? ((newSale - r.oldSalePrice) / r.oldSalePrice) * 100 : 0;
        const roundedPct = Math.round(pct * 100) / 100;
        const newPurchase = Math.round(r.oldPurchasePrice * (1 + roundedPct / 100) * 100) / 100;
        const isModified = newPurchase !== r.oldPurchasePrice || newSale !== r.oldSalePrice;
        return {
          ...r,
          percentage: roundedPct,
          newPurchasePrice: newPurchase,
          newSalePrice: isNaN(val) ? (valueStr as any) : newSale,
          isModified,
        };
      })
    );
  };

  const handleRowNewPurchasePriceChange = (id: string, valueStr: string) => {
    const val = parseFloat(valueStr);
    const newPurchase = isNaN(val) ? 0 : val;

    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const pct = r.oldPurchasePrice > 0 ? ((newPurchase - r.oldPurchasePrice) / r.oldPurchasePrice) * 100 : 0;
        const roundedPct = Math.round(pct * 100) / 100;
        const newSale = Math.round(r.oldSalePrice * (1 + roundedPct / 100) * 100) / 100;
        const isModified = newPurchase !== r.oldPurchasePrice || newSale !== r.oldSalePrice;
        return {
          ...r,
          percentage: roundedPct,
          newPurchasePrice: isNaN(val) ? (valueStr as any) : newPurchase,
          newSalePrice: newSale,
          isModified,
        };
      })
    );
  };

  // Filter modified items only
  const modifiedRows = rows.filter(
    (r) => r.newPurchasePrice !== r.oldPurchasePrice || r.newSalePrice !== r.oldSalePrice
  );

  // Mutation for saving custom bulk update
  const saveMutation = useMutation({
    mutationFn: () =>
      productPriceUpdateService.applyCustom({
        supplierId: selectedSupplierId,
        priceListStrategy: 'RECALCULATE',
        items: modifiedRows.map((r) => ({
          productId: r.id,
          newPurchasePrice: r.newPurchasePrice,
          newSalePrice: r.newSalePrice,
        })),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['productsListAll'] });
      queryClient.invalidateQueries({ queryKey: ['priceLists'] });
      alert(`🎉 Se actualizaron correctamente ${data.productsAffected} productos.`);
      onSuccess();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error || 'Error al guardar los cambios masivos.');
    },
  });

  const handleSave = () => {
    setErrorMsg(null);
    if (modifiedRows.length === 0) {
      setErrorMsg('No has modificado el precio de ningún producto.');
      return;
    }
    saveMutation.mutate();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* CABECERA SUPERIOR */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" /> Actualización Masiva de Precios
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Edición ágil de precios por proveedor en formato hoja de cálculo.
            </p>
          </div>
        </div>

        {/* PASO 1: SELECCIÓN DE PROVEEDOR */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
            Proveedor:
          </span>
          <Select
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
            className="text-xs font-bold w-full md:w-64"
          >
            {suppliers.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* BARRA DE ATAJO: AUMENTO GENERAL */}
      <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-slate-800 dark:text-slate-200">Aumento general:</span>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              step="0.1"
              value={globalPercentInput}
              onChange={(e) => setGlobalPercentInput(e.target.value)}
              className="w-20 font-mono font-bold text-center text-xs py-1"
            />
            <span className="font-bold text-slate-600 dark:text-slate-400">%</span>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleApplyGlobalPercentage}
            className="text-xs py-1 px-3 font-bold"
          >
            Aplicar a todos
          </Button>
        </div>

        <div className="text-slate-500 text-[11px] font-medium">
          Total productos cargados: <strong className="font-mono text-slate-900 dark:text-white">{rows.length}</strong>
        </div>
      </div>

      {/* MENSAJE DE ERROR */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* GRILLA EDITABLE TIPO HOJA DE CÁLCULO */}
      {loadingProducts ? (
        <div className="min-h-[300px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <RefreshCw className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="min-h-[250px] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <Package className="h-12 w-12 text-slate-400 mb-2" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            No se encontraron productos para este proveedor
          </h3>
          <p className="text-xs text-slate-500">Selecciona otro proveedor en el menú superior.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[550px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 text-[11px] font-extrabold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 min-w-[220px]">Producto</th>
                  <th className="p-3 text-right min-w-[130px]">Compra Actual</th>
                  <th className="p-3 text-right min-w-[130px]">Venta Actual</th>
                  <th className="p-3 text-center min-w-[90px]">% Aumento</th>
                  <th className="p-3 text-right min-w-[140px]">Nueva Compra ($)</th>
                  <th className="p-3 text-right min-w-[140px]">Nueva Venta ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`transition-colors ${
                      r.isModified
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/50'
                        : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* PRODUCTO */}
                    <td className="p-3">
                      <div className="font-bold text-slate-900 dark:text-white">{r.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {r.sku ? `Cód. Int: ${r.sku}` : ''} {r.barcode ? `| Cód: ${r.barcode}` : ''}
                      </div>
                    </td>

                    {/* COMPRA ACTUAL */}
                    <td className="p-3 text-right font-mono">
                      <div className="text-slate-400 line-through text-[11px]">
                        {formatCurrency(r.oldPurchasePrice)}
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 font-bold flex items-center justify-end gap-1">
                        <span className="text-[10px] text-slate-400">↓</span>
                        <span>{formatCurrency(r.newPurchasePrice)}</span>
                      </div>
                    </td>

                    {/* VENTA ACTUAL */}
                    <td className="p-3 text-right font-mono">
                      <div className="text-slate-400 line-through text-[11px]">
                        {formatCurrency(r.oldSalePrice)}
                      </div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center justify-end gap-1">
                        <span className="text-[10px] text-emerald-500">↓</span>
                        <span>{formatCurrency(r.newSalePrice)}</span>
                      </div>
                    </td>

                    {/* % EDITABLE */}
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        step="0.1"
                        value={r.percentage}
                        onChange={(e) => handleRowPercentageChange(r.id, e.target.value)}
                        className="w-16 px-2 py-1 border border-slate-300 dark:border-slate-700 rounded-lg text-center font-mono font-bold text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </td>

                    {/* NUEVA COMPRA EDITABLE */}
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={r.newPurchasePrice}
                        onChange={(e) => handleRowNewPurchasePriceChange(r.id, e.target.value)}
                        className="w-24 px-2 py-1 border border-slate-300 dark:border-slate-700 rounded-lg text-right font-mono font-bold text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </td>

                    {/* NUEVA VENTA EDITABLE */}
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={r.newSalePrice}
                        onChange={(e) => handleRowNewSalePriceChange(r.id, e.target.value)}
                        className="w-24 px-2 py-1 border border-slate-300 dark:border-slate-700 rounded-lg text-right font-mono font-black text-xs bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-900 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ACCIONES INFERIORES */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
          <Badge variant={modifiedRows.length > 0 ? 'success' : 'default'} size="md">
            {modifiedRows.length} de {rows.length} productos modificados
          </Badge>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button variant="outline" onClick={onCancel} className="text-xs px-4">
            Cancelar
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsPreviewOpen(true)}
            disabled={modifiedRows.length === 0}
            leftIcon={<Eye className="h-3.5 w-3.5 text-primary-500" />}
            className="text-xs px-4"
          >
            Vista previa ({modifiedRows.length})
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={modifiedRows.length === 0 || saveMutation.isPending}
            leftIcon={<Save className="h-3.5 w-3.5" />}
            className="text-xs px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold"
          >
            {saveMutation.isPending ? 'Guardando Cambios...' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>

      {/* MODAL DE VISTA PREVIA OBLIGATORIA */}
      {isPreviewOpen && (
        <Modal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          title="Vista Previa de Productos a Modificar"
          size="lg"
        >
          <div className="space-y-4 pt-1">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Se muestran únicamente los <strong>{modifiedRows.length} productos</strong> que realmente sufrirán modificaciones de precio:
            </p>

            <div className="max-h-80 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 text-[11px] font-extrabold uppercase text-slate-500">
                  <tr>
                    <th className="p-2">Producto</th>
                    <th className="p-2 text-right">Compra Ant. ➔ Nva.</th>
                    <th className="p-2 text-right">Venta Ant. ➔ Nva.</th>
                    <th className="p-2 text-right">% Var.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {modifiedRows.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="p-2 font-sans font-bold text-slate-900 dark:text-white">
                        {m.name}
                      </td>
                      <td className="p-2 text-right text-slate-600 dark:text-slate-300">
                        {formatCurrency(m.oldPurchasePrice)} ➔ <strong>{formatCurrency(m.newPurchasePrice)}</strong>
                      </td>
                      <td className="p-2 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                        {formatCurrency(m.oldSalePrice)} ➔ <strong>{formatCurrency(m.newSalePrice)}</strong>
                      </td>
                      <td className="p-2 text-right">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {m.percentage >= 0 ? '+' : ''}
                          {m.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
                Cerrar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setIsPreviewOpen(false);
                  handleSave();
                }}
                disabled={saveMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs"
              >
                Confirmar y Guardar Cambios
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
