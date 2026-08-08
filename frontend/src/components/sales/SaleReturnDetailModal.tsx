import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { saleApi } from '../../services/sale.service';
import { handleApiError } from '../../utils/swal';
import { RotateCcw, Printer, FileText, User, Calendar, Building, DollarSign, AlertCircle, ShieldCheck } from 'lucide-react';

interface SaleReturnDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnId: string | null;
}

export const SaleReturnDetailModal: React.FC<SaleReturnDetailModalProps> = ({
  isOpen,
  onClose,
  returnId,
}) => {
  const [returnDetail, setReturnDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && returnId) {
      setLoading(true);
      saleApi
        .getReturnById(returnId)
        .then((data) => setReturnDetail(data))
        .catch((err) => handleApiError(err))
        .finally(() => setLoading(false));
    } else {
      setReturnDetail(null);
    }
  }, [isOpen, returnId]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Comprobante de Devolución"
      size="lg"
    >
      {loading ? (
        <div className="py-12 text-center text-slate-500 font-medium space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs">Cargando comprobante de devolución...</p>
        </div>
      ) : !returnDetail ? (
        <div className="py-12 text-center text-rose-500 font-medium text-xs">
          No se pudo cargar el detalle de la devolución.
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {/* Top Bar Banner */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black font-mono tracking-tight text-indigo-400">
                  {returnDetail.refundCode || `DEV-${String(returnDetail.refundNumber).padStart(5, '0')}`}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                  {returnDetail.status || 'COMPLETADO'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Venta Original #{returnDetail.sale?.documentType?.code}-{returnDetail.sale?.documentNumber}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Monto Devuelto
              </span>
              <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                $ {Number(returnDetail.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Grid Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Cliente</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                {returnDetail.sale?.customer?.name || 'Consumidor Final'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Fecha</span>
              <span className="font-bold text-slate-700 dark:text-slate-300 block">
                {new Date(returnDetail.createdAt).toLocaleDateString('es-AR')} {new Date(returnDetail.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Depósito</span>
              <span className="font-bold text-slate-700 dark:text-slate-300 block truncate">
                {returnDetail.warehouse?.name || 'Casa Central'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Procesado por</span>
              <span className="font-bold text-slate-700 dark:text-slate-300 block truncate">
                {returnDetail.createdBy?.name || 'Usuario'}
              </span>
            </div>
          </div>

          {/* Motivo & Medio de Pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 rounded-xl space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase text-indigo-400 tracking-wider block">
                Motivo de Devolución
              </span>
              <span className="font-bold text-indigo-950 dark:text-indigo-200">
                {returnDetail.reason || 'Devolución de productos'}
              </span>
            </div>
            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 rounded-xl space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase text-emerald-500 tracking-wider block">
                Medio de Reintegro
              </span>
              <span className="font-bold text-emerald-950 dark:text-emerald-200 uppercase">
                {returnDetail.paymentMethod === 'CREDIT_ACCOUNT'
                  ? 'Cuenta Corriente (Acreditado a Deuda)'
                  : returnDetail.paymentMethod || 'Efectivo'}
              </span>
            </div>
          </div>

          {/* Tabla de Productos Devueltos */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-300 font-black uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3.5 py-2.5">Producto</th>
                  <th className="px-3 py-2.5 text-center">Cant. Devuelta</th>
                  <th className="px-3 py-2.5 text-center">Precio Unit.</th>
                  <th className="px-3 py-2.5 text-center">Disposición</th>
                  <th className="px-3.5 py-2.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {returnDetail.items?.map((item: any) => {
                  const isDamaged = item.stockDisposition === 'DAMAGED';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50">
                      <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-white">
                        {item.product?.name || item.productId}
                        {item.product?.sku && (
                          <span className="block text-[10px] text-slate-400 font-mono font-medium">
                            SKU: {item.product.sku}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                        {Number(item.quantity)} u.
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-600 dark:text-slate-400">
                        $ {Number(item.unitPrice).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isDamaged ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            🔴 Dañado (No vendible)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            🟢 Volvió a stock
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                        $ {Number(item.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sección de Fidelización — solo si hay puntos revertidos */}
          {returnDetail.pointsReversed > 0 && (
            <div className="p-3.5 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-xs space-y-2">
              <div className="flex items-center gap-2 font-black text-amber-800 dark:text-amber-300 text-xs uppercase tracking-wider">
                ⭐ Fidelización — Puntos Revertidos
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-center">
                <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Puntos Otorgados</span>
                  <span className="font-black text-slate-800 dark:text-slate-200 text-sm">
                    +{returnDetail.sale?.pointsEarned ?? 0} pts
                  </span>
                </div>
                <div className="p-2 bg-rose-50 dark:bg-rose-950/60 rounded-xl border border-rose-200 dark:border-rose-800 shadow-xs">
                  <span className="text-[10px] font-bold text-rose-600 block uppercase tracking-wider">Puntos Revertidos</span>
                  <span className="font-black text-rose-600 dark:text-rose-400 text-sm">
                    -{returnDetail.pointsReversed} pts
                  </span>
                </div>
                {returnDetail.pointsBalanceAfterRefund !== null && returnDetail.pointsBalanceAfterRefund !== undefined && (
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/60 rounded-xl border border-amber-200 dark:border-amber-700 shadow-xs">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 block uppercase tracking-wider">Saldo Final</span>
                    <span className="font-black text-amber-950 dark:text-amber-100 text-sm">
                      {returnDetail.pointsBalanceAfterRefund} pts
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="font-bold text-xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </Button>

            <Button variant="primary" size="sm" onClick={onClose} className="font-bold text-xs">
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
