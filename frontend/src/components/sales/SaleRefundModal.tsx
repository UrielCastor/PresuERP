import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Sale, saleApi } from '../../services/sale.service';
import { swalConfirm, swalSuccess, swalError, handleApiError } from '../../utils/swal';
import { RotateCcw, AlertCircle, CheckCircle2, Package, Calendar, User, Building } from 'lucide-react';

interface SaleRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleId: string | null;
  onRefundSuccess?: () => void;
}

export const SaleRefundModal: React.FC<SaleRefundModalProps> = ({
  isOpen,
  onClose,
  saleId,
  onRefundSuccess,
}) => {
  const [sale, setSale] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');
  const [refundQuantities, setRefundQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen && saleId) {
      setLoading(true);
      setReason('');
      setRefundQuantities({});
      saleApi
        .getById(saleId)
        .then((data) => {
          setSale(data);
          const initialQuantities: Record<string, number> = {};
          if (data && data.items) {
            data.items.forEach((item: any) => {
              initialQuantities[item.id] = 0;
            });
          }
          setRefundQuantities(initialQuantities);
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

  const handleRefundAll = () => {
    if (!sale || !sale.items) return;
    const updated: Record<string, number> = {};
    sale.items.forEach((item: any) => {
      updated[item.id] = availableMap[item.id] || 0;
    });
    setRefundQuantities(updated);
  };

  const refundTotal = useMemo(() => {
    if (!sale || !sale.items) return 0;
    return sale.items.reduce((acc: number, item: any) => {
      const qty = refundQuantities[item.id] || 0;
      return acc + qty * Number(item.unitPrice || 0);
    }, 0);
  }, [sale, refundQuantities]);

  const hasItemsToRefund = useMemo(() => {
    return Object.values(refundQuantities).some((qty) => qty > 0);
  }, [refundQuantities]);

  const handleSubmit = async () => {
    if (!sale || !hasItemsToRefund) return;

    const confirmed = await swalConfirm(
      '¿Confirmar Devolución?',
      `Se devolverán productos por un importe total de $ ${refundTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}. Se reingresará el stock al depósito y se registrará la transacción.`,
      'Sí, confirmar devolución',
      'Cancelar',
      'warning'
    );

    if (!confirmed) return;

    const itemsPayload = Object.entries(refundQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([saleItemId, quantity]) => ({ saleItemId, quantity }));

    setSubmitting(true);
    try {
      await saleApi.processRefund(sale.id, {
        reason: reason.trim() || undefined,
        items: itemsPayload,
      });

      await swalSuccess(
        'Devolución Registrada',
        `La devolución por $ ${refundTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })} fue procesada correctamente.`
      );

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
      title="Devolución de Productos"
      size="xl"
    >
      {loading ? (
        <div className="py-12 text-center text-slate-500 font-medium">
          Cargando datos de la venta...
        </div>
      ) : !sale ? (
        <div className="py-12 text-center text-red-500 font-medium">
          No se pudo cargar la información de la venta.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Info Banner */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase">Comprobante</span>
              <span className="font-bold text-slate-800">
                #{sale.documentType?.code || 'FAC'}-{sale.documentNumber}
              </span>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase">Cliente</span>
              <span className="font-medium text-slate-700">
                {sale.customer?.name || 'Consumidor Final'}
              </span>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase">Fecha</span>
              <span className="font-medium text-slate-700">
                {new Date(sale.createdAt).toLocaleDateString('es-AR')}
              </span>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase">Importe Original</span>
              <span className="font-bold text-emerald-600 font-mono">
                $ {Number(sale.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Quick Action Button */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-700">
              Selecciona las cantidades a devolver por producto:
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefundAll}
              className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-medium"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Devolver toda la venta
            </Button>
          </div>

          {/* Table of items */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 text-xs font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3 text-center">Vendidas</th>
                  <th className="px-4 py-3 text-center">Prev. Devueltas</th>
                  <th className="px-4 py-3 text-center">Disponibles</th>
                  <th className="px-4 py-3 text-center">A Devolver</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.items.map((item: any) => {
                  const sold = Number(item.quantity || 0);
                  const prevDev = previouslyRefundedMap[item.id] || 0;
                  const maxAvail = availableMap[item.id] || 0;
                  const selectedQty = refundQuantities[item.id] || 0;
                  const itemSubtotal = selectedQty * Number(item.unitPrice || 0);
                  const isKg = String(item.product?.unitOfMeasure || '').toUpperCase().includes('KG');

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.product?.name || item.productId}
                        {item.product?.sku && (
                          <span className="block text-xs text-slate-400 font-mono">
                            SKU: {item.product.sku}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-600">
                        {sold} {isKg ? 'kg' : 'u.'}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-amber-600 font-medium">
                        {prevDev > 0 ? `${prevDev} ${isKg ? 'kg' : 'u.'}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-slate-700">
                        {maxAvail} {isKg ? 'kg' : 'u.'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            disabled={selectedQty <= 0}
                            onClick={() => handleQtyChange(item.id, selectedQty - 1)}
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-slate-700 flex items-center justify-center transition-colors"
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
                            className="w-16 h-8 text-center font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900"
                          />
                          <button
                            type="button"
                            disabled={selectedQty >= maxAvail}
                            onClick={() => handleQtyChange(item.id, selectedQty + 1)}
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-slate-700 flex items-center justify-center transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                        $ {itemSubtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Motivo de la devolución (opcional)
            </label>
            <Input
              type="text"
              placeholder="Ej: Producto fallado, cambio de opinión del cliente..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Summary Box */}
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide block">
                Total a Reintegrar
              </span>
              <span className="text-2xl font-black text-emerald-700 font-mono">
                $ {refundTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex space-x-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit}
                disabled={!hasItemsToRefund || submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
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
