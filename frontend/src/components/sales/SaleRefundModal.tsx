import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { saleApi } from '../../services/sale.service';
import { swalConfirm, swalSuccess, swalRefundSuccess, handleApiError } from '../../utils/swal';
import { RotateCcw, AlertTriangle, ShieldCheck, ShoppingBag, CreditCard, User, Building, Clock } from 'lucide-react';

interface SaleRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleId: string | null;
  onRefundSuccess?: () => void;
}

const REASON_PRESETS = [
  'Producto defectuoso',
  'Producto dañado',
  'Producto equivocado',
  'Cliente cambió de opinión',
  'Error de venta',
  'Otro',
];

export const SaleRefundModal: React.FC<SaleRefundModalProps> = ({
  isOpen,
  onClose,
  saleId,
  onRefundSuccess,
}) => {
  const [sale, setSale] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form states
  const [reasonPreset, setReasonPreset] = useState<string>('Producto defectuoso');
  const [customReason, setCustomReason] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [refundQuantities, setRefundQuantities] = useState<Record<string, number>>({});
  const [stockDispositions, setStockDispositions] = useState<Record<string, 'RESTOCK' | 'DAMAGED'>>({});

  useEffect(() => {
    if (isOpen && saleId) {
      setLoading(true);
      setReasonPreset('Producto defectuoso');
      setCustomReason('');
      setSelectedPaymentMethod('');
      setRefundQuantities({});
      setStockDispositions({});

      saleApi
        .getById(saleId)
        .then((data) => {
          setSale(data);
          const initialQuantities: Record<string, number> = {};
          const initialDispositions: Record<string, 'RESTOCK' | 'DAMAGED'> = {};
          if (data && data.items) {
            data.items.forEach((item: any) => {
              initialQuantities[item.id] = 0;
              initialDispositions[item.id] = 'RESTOCK';
            });
          }
          setRefundQuantities(initialQuantities);
          setStockDispositions(initialDispositions);

          // Detect payment method
          if (data && data.payments && data.payments.length > 0) {
            const pmDetails = String(data.payments[0].details || '').toUpperCase();
            if (pmDetails.includes('CREDIT_ACCOUNT') || data.payments[0].paymentMethod?.type === 'CREDIT_ACCOUNT') {
              setSelectedPaymentMethod('CREDIT_ACCOUNT');
            } else if (pmDetails.includes('MERCADO_PAGO')) {
              setSelectedPaymentMethod('MERCADO_PAGO');
            } else if (pmDetails.includes('TRANSFER')) {
              setSelectedPaymentMethod('TRANSFER');
            } else if (pmDetails.includes('CARD')) {
              setSelectedPaymentMethod('CARD');
            } else {
              setSelectedPaymentMethod('CASH');
            }
          }
        })
        .catch((err) => {
          handleApiError(err);
          onClose();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setSale(null);
    }
  }, [isOpen, saleId]);

  // Calculate previously refunded quantities for each item
  const previouslyRefundedMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (sale && sale.refunds) {
      sale.refunds.forEach((ref: any) => {
        if (ref.items) {
          ref.items.forEach((refItem: any) => {
            const current = map[refItem.saleItemId] || 0;
            map[refItem.saleItemId] = current + Number(refItem.quantity || 0);
          });
        }
      });
    }
    return map;
  }, [sale]);

  // Available to refund per item
  const availableMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (sale && sale.items) {
      sale.items.forEach((item: any) => {
        const sold = Number(item.quantity || 0);
        const prev = previouslyRefundedMap[item.id] || 0;
        map[item.id] = Math.max(0, sold - prev);
      });
    }
    return map;
  }, [sale, previouslyRefundedMap]);

  const handleQtyChange = (itemId: string, val: number) => {
    const max = availableMap[itemId] || 0;
    const clamped = Math.max(0, Math.min(max, val));
    setRefundQuantities((prev) => ({ ...prev, [itemId]: clamped }));
  };

  const handleDispositionChange = (itemId: string, disposition: 'RESTOCK' | 'DAMAGED') => {
    setStockDispositions((prev) => ({ ...prev, [itemId]: disposition }));
  };

  const handleRefundAll = () => {
    if (!sale || !sale.items) return;
    const updatedQty: Record<string, number> = {};
    sale.items.forEach((item: any) => {
      updatedQty[item.id] = availableMap[item.id] || 0;
    });
    setRefundQuantities(updatedQty);
  };

  const refundTotal = useMemo(() => {
    if (!sale || !sale.items) return 0;
    return sale.items.reduce((acc: number, item: any) => {
      const qty = refundQuantities[item.id] || 0;
      return acc + qty * Number(item.unitPrice || 0);
    }, 0);
  }, [sale, refundQuantities]);

  const totalRefundItemsCount = useMemo(() => {
    return Object.values(refundQuantities).reduce((acc, q) => acc + (q > 0 ? 1 : 0), 0);
  }, [refundQuantities]);

  const totalRefundUnitsCount = useMemo(() => {
    return Object.values(refundQuantities).reduce((acc, q) => acc + q, 0);
  }, [refundQuantities]);

  const hasItemsToRefund = useMemo(() => {
    return totalRefundUnitsCount > 0;
  }, [totalRefundUnitsCount]);

  const isCreditAccountSale = useMemo(() => {
    if (!sale || !sale.payments) return false;
    return sale.payments.some((p: any) => {
      const d = String(p.details || '').toUpperCase();
      return d.includes('CREDIT_ACCOUNT') || p.paymentMethod?.type === 'CREDIT_ACCOUNT';
    });
  }, [sale]);

  const handleSubmit = async () => {
    if (!sale || !hasItemsToRefund) return;

    const finalReason = reasonPreset === 'Otro' ? customReason.trim() || 'Devolución de cliente' : reasonPreset;

    const confirmed = await swalConfirm(
      '¿Confirmar Devolución?',
      `Se devolverán ${totalRefundUnitsCount} unidades por un importe total de $ ${refundTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}.\n\n${
        selectedPaymentMethod === 'CREDIT_ACCOUNT'
          ? 'Medio de devolución: Cuenta Corriente. El importe se acreditará a la deuda del cliente sin movimientos de caja.'
          : 'El reintegro se procesará por el medio de pago seleccionado.'
      }`,
      'Sí, confirmar devolución',
      'Cancelar',
      'warning'
    );

    if (!confirmed) return;

    const itemsPayload = Object.entries(refundQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([saleItemId, quantity]) => ({
        saleItemId,
        quantity,
        stockDisposition: stockDispositions[saleItemId] || 'RESTOCK',
      }));

    setSubmitting(true);
    try {
      const result = await saleApi.processRefund(sale.id, {
        reason: finalReason,
        paymentMethod: selectedPaymentMethod || undefined,
        items: itemsPayload,
      });

      const refundData = result?.data || result || {};
      const pointsReversed: number = refundData.pointsReversed ?? 0;
      // The API returns the updated customer from the sale; fetch current balance if points were reversed
      let newPointsBalance: number | undefined;
      if (pointsReversed > 0 && sale?.customer?.id) {
        try {
          // The customer's pointsBalance after reversal = previous - reversed
          const prevBalance = Number(sale.customer?.pointsBalance ?? 0);
          newPointsBalance = Math.max(0, prevBalance - pointsReversed);
        } catch {
          newPointsBalance = undefined;
        }
      }

      const isCreditAccountSaleFlag = sale?.payments?.some((p: any) => p.paymentMethod?.type === 'CREDIT_ACCOUNT');

      await swalRefundSuccess({
        refundCode: refundData.refundCode || refundData.code || `DEV-${String(refundData.refundNumber || '').padStart(5, '0')}`,
        refundTotal,
        paymentMethod: selectedPaymentMethod || undefined,
        pointsReversed: pointsReversed > 0 ? pointsReversed : undefined,
        newPointsBalance: pointsReversed > 0 ? newPointsBalance : undefined,
        isCreditAccount: isCreditAccountSaleFlag || selectedPaymentMethod === 'CREDIT_ACCOUNT',
      });

      window.dispatchEvent(new CustomEvent('customer-debt-updated'));

      if (onRefundSuccess) {
        onRefundSuccess();
      }
      onClose();
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Devolución de Venta"
      size="xl"
    >
      {loading ? (
        <div className="py-12 text-center text-slate-500 font-medium space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs">Cargando datos de la venta...</p>
        </div>
      ) : !sale ? (
        <div className="py-12 text-center text-rose-500 font-medium text-xs">
          No se pudo cargar la información de la venta.
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {/* Banner de Info de Venta */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Venta #</span>
              <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                #{sale.documentType?.code || 'FAC'}-{sale.documentNumber}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Cliente</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                {sale.customer?.name || 'Consumidor Final'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Depósito</span>
              <span className="font-bold text-slate-700 dark:text-slate-300 truncate block">
                {sale.warehouse?.name || 'Casa Central'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Total Original</span>
              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm block">
                $ {Number(sale.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Aviso especial de Cuenta Corriente */}
          {isCreditAccountSale && (
            <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block">Venta a Cuenta Corriente</span>
                <span className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                  El importe devuelto se descontará directamente del saldo deudor del cliente. No se registrará egreso de efectivo en la caja registradora.
                </span>
              </div>
            </div>
          )}

          {/* Header de Selección de Productos & Acción Completa */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Productos a devolver
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                Indica la cantidad y estado de cada producto que el cliente devuelve.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefundAll}
              className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold text-xs rounded-xl"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Devolver todo
            </Button>
          </div>

          {/* Tabla de Productos de la Venta */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-300 font-black uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3.5 py-2.5">Producto</th>
                  <th className="px-3 py-2.5 text-center">Vendidas</th>
                  <th className="px-3 py-2.5 text-center">Devueltas</th>
                  <th className="px-3 py-2.5 text-center">Disponibles</th>
                  <th className="px-3 py-2.5 text-center">A Devolver</th>
                  <th className="px-3 py-2.5 text-center">Estado Producto</th>
                  <th className="px-3.5 py-2.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {sale.items.map((item: any) => {
                  const sold = Number(item.quantity || 0);
                  const prevDev = previouslyRefundedMap[item.id] || 0;
                  const maxAvail = availableMap[item.id] || 0;
                  const selectedQty = refundQuantities[item.id] || 0;
                  const itemSubtotal = selectedQty * Number(item.unitPrice || 0);
                  const isKg = String(item.product?.unitOfMeasure || '').toUpperCase().includes('KG');

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors">
                      <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-white">
                        {item.product?.name || item.productId}
                        {item.product?.sku && (
                          <span className="block text-[10px] text-slate-400 font-mono font-medium">
                            SKU: {item.product.sku}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-600 dark:text-slate-400 font-medium">
                        {sold} {isKg ? 'kg' : 'u.'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-amber-600 dark:text-amber-400 font-bold">
                        {prevDev > 0 ? `${prevDev} ${isKg ? 'kg' : 'u.'}` : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-black text-slate-800 dark:text-slate-200">
                        {maxAvail} {isKg ? 'kg' : 'u.'}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            disabled={selectedQty <= 0}
                            onClick={() => handleQtyChange(item.id, selectedQty - 1)}
                            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={maxAvail}
                            step={isKg ? 0.001 : 1}
                            value={selectedQty}
                            onChange={(e) => handleQtyChange(item.id, parseFloat(e.target.value) || 0)}
                            className="w-14 h-7 text-center font-mono font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500 text-xs text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            disabled={selectedQty >= maxAvail}
                            onClick={() => handleQtyChange(item.id, selectedQty + 1)}
                            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors text-xs"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <select
                          disabled={selectedQty <= 0}
                          value={stockDispositions[item.id] || 'RESTOCK'}
                          onChange={(e) => handleDispositionChange(item.id, e.target.value as any)}
                          className="text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-slate-800 dark:text-slate-200 disabled:opacity-40"
                        >
                          <option value="RESTOCK">🟢 Volver a stock</option>
                          <option value="DAMAGED">🔴 Dañado (No vendible)</option>
                        </select>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                        $ {itemSubtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Formulario Secundario: Motivo y Medio de Pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Motivo de la devolución
              </label>
              <Select
                value={reasonPreset}
                onChange={(e) => setReasonPreset(e.target.value)}
                className="text-xs"
              >
                {REASON_PRESETS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
              {reasonPreset === 'Otro' && (
                <Input
                  placeholder="Especificar motivo detallado..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="mt-1 text-xs"
                />
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Medio de devolución
              </label>
              <Select
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="text-xs font-bold"
                disabled={isCreditAccountSale}
              >
                <option value="CASH">Efectivo</option>
                <option value="MERCADO_PAGO">Mercado Pago</option>
                <option value="TRANSFER">Transferencia Bancaria</option>
                <option value="CARD">Tarjeta de Débito / Crédito</option>
                <option value="CREDIT_ACCOUNT">Cuenta Corriente (Acreditar a deuda)</option>
              </Select>
            </div>
          </div>

          {/* Tarjeta Visual Informativa para Cuenta Corriente */}
          {selectedPaymentMethod === 'CREDIT_ACCOUNT' && (
            <div className="p-4 bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs space-y-2.5 animate-fadeIn shadow-xs">
              <div className="flex items-center gap-2 font-black text-indigo-950 dark:text-indigo-200 text-sm">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                <span>Cuenta Corriente — Resumen de Acreditación</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-center pt-1">
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Deuda Actual</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                    $ {Number(sale?.customer?.currentDebt || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase tracking-wider">Importe a Acreditar</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    -$ {refundTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/60 rounded-xl border border-indigo-200 dark:border-indigo-700 shadow-2xs">
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 block uppercase tracking-wider">Nueva Deuda</span>
                  <span className="font-black text-indigo-950 dark:text-indigo-100 text-sm">
                    $ {Math.max(0, Number(sale?.customer?.currentDebt || 0) - refundTotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-indigo-900 dark:text-indigo-300 font-medium pt-0.5">
                💡 El saldo devuelto se acreditará directamente a la cuenta corriente del cliente. <strong>No afectará la caja registradora ni generará egreso de efectivo.</strong>
              </p>
            </div>
          )}

          {/* Resumen Final Box */}
          <div className="bg-slate-900 text-white dark:bg-slate-950 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md border border-slate-800">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Resumen de Devolución
              </span>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                  $ {refundTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-semibold text-slate-300">
                  {totalRefundItemsCount} {totalRefundItemsCount === 1 ? 'producto' : 'productos'} ({totalRefundUnitsCount} u.)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting} className="text-xs font-bold">
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit}
                disabled={!hasItemsToRefund || submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs"
              >
                {submitting ? 'Procesando...' : 'Confirmar Devolución'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
