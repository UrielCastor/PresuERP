import React, { useState, useEffect } from 'react';
import { History, Search, Filter, Calendar, CheckCircle2, Clock, Truck, Warehouse, Eye, X, Printer, FileText } from 'lucide-react';
import { logisticsService, StockTransferDto } from '../../services/logistics.service';
import { warehouseApi, Warehouse as WarehouseType } from '../../services/warehouse.service';
import { LogisticsDocumentModal, LogisticsDocumentData } from '../../components/logistics/LogisticsDocumentModal';

export const LogisticsHistory: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [transfers, setTransfers] = useState<StockTransferDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [originId, setOriginId] = useState('');
  const [destId, setDestId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [selectedTransfer, setSelectedTransfer] = useState<StockTransferDto | null>(null);
  const [docModalData, setDocModalData] = useState<LogisticsDocumentData | null>(null);

  const handleOpenDoc = (transfer: StockTransferDto, docType: 'TRA' | 'REC') => {
    if (docType === 'REC') {
      const recNumber = `REC-${transfer.transferNumber.replace('TRA-', '')}`;
      const lastReceipt = transfer.receipts && transfer.receipts.length > 0 ? transfer.receipts[transfer.receipts.length - 1] : null;

      setDocModalData({
        type: 'REC',
        documentNumber: recNumber,
        date: lastReceipt ? lastReceipt.receivedAt : transfer.arrivalDate || transfer.updatedAt || transfer.createdAt,
        status: transfer.status,
        originWarehouse: { name: transfer.originWarehouse?.name || 'Origen', code: transfer.originWarehouse?.code },
        destinationWarehouse: { name: transfer.destinationWarehouse?.name || 'Destino', code: transfer.destinationWarehouse?.code },
        receivedBy: lastReceipt?.receivedByUser ? { name: lastReceipt.receivedByUser.name } : transfer.receivedByUser ? { name: transfer.receivedByUser.name } : undefined,
        relatedTransferNumber: transfer.transferNumber,
        items: transfer.items.map((i) => {
          let sent = Number(i.quantity || 0);
          let rec = sent;
          let notes = '';
          if (lastReceipt) {
            const rItem = lastReceipt.items.find((ri) => ri.productId === i.productId);
            if (rItem) {
              sent = Number(rItem.expectedQty);
              rec = Number(rItem.receivedQty);
              notes = rItem.notes || '';
            }
          }
          return {
            productName: i.product?.name || 'Producto',
            sku: i.product?.sku || '',
            sentQty: sent,
            receivedQty: rec,
            differenceQty: rec - sent,
            notes: notes,
          };
        }),
        notes: lastReceipt?.notes || transfer.notes,
      });
    } else {
      setDocModalData({
        type: 'TRA',
        documentNumber: transfer.transferNumber,
        date: transfer.createdAt,
        status: transfer.status,
        originWarehouse: { name: transfer.originWarehouse?.name || 'Origen', code: transfer.originWarehouse?.code },
        destinationWarehouse: { name: transfer.destinationWarehouse?.name || 'Destino', code: transfer.destinationWarehouse?.code },
        preparedBy: transfer.preparedByUser ? { name: transfer.preparedByUser.name, email: transfer.preparedByUser.email } : undefined,
        dispatchedBy: transfer.dispatchedByUser ? { name: transfer.dispatchedByUser.name, email: transfer.dispatchedByUser.email } : undefined,
        receivedBy: transfer.receivedByUser ? { name: transfer.receivedByUser.name, email: transfer.receivedByUser.email } : undefined,
        relatedTransferNumber: transfer.transferRequest?.requestNumber,
        items: transfer.items.map((i) => ({
          productName: i.product?.name || 'Producto',
          sku: i.product?.sku || '',
          sentQty: Number(i.quantity || 0),
        })),
        notes: transfer.notes,
      });
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [transfersRes, warehousesRes] = await Promise.all([
        logisticsService.getStockTransfers({
          search: search || undefined,
          status: statusFilter || undefined,
          originWarehouseId: originId || undefined,
          destinationWarehouseId: destId || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        warehouseApi.list(),
      ]);

      setTransfers(transfersRes.data || []);
      setWarehouses(warehousesRes || []);
    } catch (err: any) {
      console.error('Error cargando historial:', err);
      setError('Error al cargar el historial de logística.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter, originId, destId, startDate, endDate]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Pendiente</span>;
      case 'PREPARING':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">En Preparación</span>;
      case 'IN_TRANSIT':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">En Tránsito</span>;
      case 'RECEIVED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Completado</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-6 w-6 text-primary-600" />
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              Historial de Movimientos y Trazabilidad
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Línea de tiempo detallada de solicitudes, aprobaciones, despachos y recepciones físicas.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Filter Panel */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Filter className="h-4 w-4" /> Filtros Avanzados
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Búsqueda</label>
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Número TRA-XXXX..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            >
              <option value="">Todos los Estados</option>
              <option value="PENDING">Pendiente</option>
              <option value="PREPARING">En Preparación</option>
              <option value="IN_TRANSIT">En Tránsito</option>
              <option value="RECEIVED">Completado</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Origen</label>
            <select
              value={originId}
              onChange={(e) => setOriginId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            >
              <option value="">Cualquier Origen</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Destino</label>
            <select
              value={destId}
              onChange={(e) => setDestId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            >
              <option value="">Cualquier Destino</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Fecha Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500">
                <th className="p-4">Traspaso</th>
                <th className="p-4">Pedido Orig</th>
                <th className="p-4">Origen → Destino</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Fecha Salida</th>
                <th className="p-4">Fecha Llegada</th>
                <th className="p-4 text-right">Línea de Tiempo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Cargando historial...
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No hay registros de historial.
                  </td>
                </tr>
              ) : (
                transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400">
                      {t.transferNumber}
                    </td>
                    <td className="p-4 text-xs font-semibold text-slate-500">
                      {t.transferRequest?.requestNumber || 'N/A'}
                    </td>
                    <td className="p-4 text-slate-700 dark:text-slate-300">
                      {t.originWarehouse?.name} → {t.destinationWarehouse?.name}
                    </td>
                    <td className="p-4">{getStatusBadge(t.status)}</td>
                    <td className="p-4 text-xs text-slate-400">
                      {t.departureDate ? new Date(t.departureDate).toLocaleDateString('es-AR') : '-'}
                    </td>
                    <td className="p-4 text-xs text-slate-400">
                      {t.arrivalDate ? new Date(t.arrivalDate).toLocaleDateString('es-AR') : '-'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 ml-auto">
                        <button
                          onClick={() => setSelectedTransfer(t)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                          title="Ver Línea de Tiempo"
                        >
                          <Eye className="h-3.5 w-3.5" /> Timeline
                        </button>
                        <button
                          onClick={() => handleOpenDoc(t, 'TRA')}
                          className="p-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg"
                          title="Ver / Imprimir Documento TRA"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        {t.status === 'RECEIVED' && (
                          <button
                            onClick={() => handleOpenDoc(t, 'REC')}
                            className="p-1.5 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg"
                            title="Ver / Imprimir Comprobante REC"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TIMELINE MODAL */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Trazabilidad de Traspaso {selectedTransfer.transferNumber}
                </h3>
                <p className="text-xs text-slate-400">
                  Pedido Origen: {selectedTransfer.transferRequest?.requestNumber || 'Manual'}
                </p>
              </div>
              <button onClick={() => setSelectedTransfer(null)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>

            {/* Timeline Events */}
            <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-4 space-y-6 py-2">
              {/* Event 1: Creation */}
              <div className="relative pl-6">
                <div className="absolute -left-2.5 top-0.5 bg-blue-500 text-white p-1 rounded-full">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">1. Documento de Traspaso Generado</div>
                <div className="text-xs text-slate-500">
                  Creado por {selectedTransfer.preparedByUser?.name || 'Sistema'} el {new Date(selectedTransfer.createdAt).toLocaleString('es-AR')}
                </div>
              </div>

              {/* Event 2: Dispatch */}
              <div className="relative pl-6">
                <div className={`absolute -left-2.5 top-0.5 p-1 rounded-full ${
                  selectedTransfer.departureDate ? 'bg-purple-500 text-white' : 'bg-slate-300 text-slate-600'
                }`}>
                  <Truck className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">2. Despacho y Salida de Depósito Origen</div>
                {selectedTransfer.departureDate ? (
                  <div className="text-xs text-slate-500">
                    Despachado por {selectedTransfer.dispatchedByUser?.name || 'Usuario'} el {new Date(selectedTransfer.departureDate).toLocaleString('es-AR')}. Stock descontado e ingreso a tránsito.
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">Pendiente de despacho físico</div>
                )}
              </div>

              {/* Event 3: Reception */}
              <div className="relative pl-6">
                <div className={`absolute -left-2.5 top-0.5 p-1 rounded-full ${
                  selectedTransfer.status === 'RECEIVED' ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-600'
                }`}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">3. Recepción e Ingreso a Depósito Destino</div>
                {selectedTransfer.status === 'RECEIVED' ? (
                  <div className="text-xs text-slate-500">
                    Completado por {selectedTransfer.receivedByUser?.name || 'Usuario'} el {selectedTransfer.arrivalDate ? new Date(selectedTransfer.arrivalDate).toLocaleString('es-AR') : 'Reciente'}. Stock ingresado a destino.
                  </div>
                ) : selectedTransfer.receipts && selectedTransfer.receipts.length > 0 ? (
                  <div className="text-xs text-amber-600 font-semibold">
                    Recepción parcial en curso ({selectedTransfer.receipts.length} entregas físicas registradas).
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">Pendiente de recepción física en destino</div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const tra = selectedTransfer;
                    setSelectedTransfer(null);
                    handleOpenDoc(tra, 'TRA');
                  }}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm"
                >
                  <Printer className="h-3.5 w-3.5" /> Imprimir TRA
                </button>
                {selectedTransfer.status === 'RECEIVED' && (
                  <button
                    onClick={() => {
                      const tra = selectedTransfer;
                      setSelectedTransfer(null);
                      handleOpenDoc(tra, 'REC');
                    }}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm"
                  >
                    <FileText className="h-3.5 w-3.5" /> Comprobante REC
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedTransfer(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold"
              >
                Cerrar Trazabilidad
              </button>
            </div>
          </div>
        </div>
      )}

      <LogisticsDocumentModal
        data={docModalData}
        onClose={() => setDocModalData(null)}
      />
    </div>
  );
};
