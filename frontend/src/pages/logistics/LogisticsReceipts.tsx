import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Search,
  CheckCircle2,
  Eye,
  X,
  AlertTriangle,
  Truck,
  Calendar,
  User,
  ArrowRight,
  Filter,
  PackageCheck,
  Plus,
  Minus,
  MessageSquare,
  ShieldCheck,
  Check,
  RefreshCw,
  Sparkles,
  Printer,
  FileText,
} from 'lucide-react';
import {
  logisticsService,
  StockTransferDto,
  StockTransferItemDto,
} from '../../services/logistics.service';
import { warehouseApi, Warehouse } from '../../services/warehouse.service';
import { useAuth } from '../../contexts/AuthContext';
import { LogisticsDocumentModal, LogisticsDocumentData } from '../../components/logistics/LogisticsDocumentModal';

export const LogisticsReceipts: React.FC = () => {
  const { user, hasPermission } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [transfers, setTransfers] = useState<StockTransferDto[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('IN_TRANSIT'); // Default to IN_TRANSIT per spec

  // Reception Stepper / Modal State
  const [activeStep, setActiveStep] = useState<1 | 2>(1); // 1: List / Selection, 2: Receipt Verification
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransferDto | null>(null);

  // Items state during reception
  const [receiveItems, setReceiveItems] = useState<
    {
      stockTransferItemId: string;
      productId: string;
      productName: string;
      sku: string;
      sentQty: number;
      receivedQty: number;
      notes: string;
    }[]
  >([]);

  const [generalNotes, setGeneralNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [docModalData, setDocModalData] = useState<LogisticsDocumentData | null>(null);

  const handleOpenRecDoc = (transfer: StockTransferDto) => {
    // Generate REC document number from transfer number or receipt
    const recNumber = `REC-${transfer.transferNumber.replace('TRA-', '')}`;
    const lastReceipt = transfer.receipts && transfer.receipts.length > 0 ? transfer.receipts[transfer.receipts.length - 1] : null;

    setDocModalData({
      type: 'REC',
      documentNumber: recNumber,
      date: lastReceipt ? lastReceipt.receivedAt : transfer.updatedAt || transfer.createdAt,
      status: transfer.status === 'RECEIVED' ? 'RECEIVED' : 'PARTIAL',
      originWarehouse: { name: transfer.originWarehouse?.name || 'Origen', code: transfer.originWarehouse?.code },
      destinationWarehouse: { name: transfer.destinationWarehouse?.name || 'Destino', code: transfer.destinationWarehouse?.code },
      receivedBy: lastReceipt?.receivedByUser ? { name: lastReceipt.receivedByUser.name } : transfer.receivedByUser ? { name: transfer.receivedByUser.name } : { name: user?.name || 'Usuario' },
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
  };

  // Load Transfers
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [transfersRes, warehousesRes] = await Promise.all([
        logisticsService.getStockTransfers({
          status: statusFilter || undefined,
          search: search || undefined,
        }),
        warehouseApi.list(),
      ]);

      let list = transfersRes.data || [];

      // Filter by origin if selected
      if (selectedOrigin) {
        list = list.filter((t: StockTransferDto) => t.originWarehouseId === selectedOrigin);
      }

      // Filter by date if selected
      if (selectedDate) {
        list = list.filter((t: StockTransferDto) => {
          const tDate = (t.departureDate || t.createdAt || '').slice(0, 10);
          return tDate === selectedDate;
        });
      }

      setTransfers(list);
      setWarehouses(warehousesRes || []);
    } catch (err: any) {
      console.error('Error cargando recepciones:', err);
      setError('Error al cargar la lista de recepciones pendientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedOrigin, selectedDate, statusFilter]);

  // Open Reception Verification Step
  const handleStartReception = (transfer: StockTransferDto) => {
    setSelectedTransfer(transfer);
    setGeneralNotes('');
    setError(null);

    // Calculate sent / received
    setReceiveItems(
      transfer.items.map((i) => {
        const sent = Number(i.quantity);
        return {
          stockTransferItemId: i.id,
          productId: i.productId,
          productName: i.product?.name || 'Producto',
          sku: i.product?.sku || '',
          sentQty: sent,
          receivedQty: sent, // Default to complete reception
          notes: '',
        };
      })
    );
    setActiveStep(2);
  };

  // Preset quick observations
  const handleAddQuickNote = (idx: number, noteText: string) => {
    setReceiveItems((prev) =>
      prev.map((item, iIdx) => {
        if (iIdx !== idx) return item;
        const currentNotes = item.notes.trim();
        if (currentNotes.includes(noteText)) return item;
        const newNotes = currentNotes ? `${currentNotes}, ${noteText}` : noteText;
        return { ...item, notes: newNotes };
      })
    );
  };

  // Action: Receive All (Auto-complete quantities)
  const handleAutoCompleteAll = () => {
    setReceiveItems((prev) =>
      prev.map((item) => ({
        ...item,
        receivedQty: item.sentQty,
      }))
    );
  };

  // Action: Submit Reception (POST /stock-transfers/:id/receive)
  const handleSubmitReception = async () => {
    if (!selectedTransfer) return;
    setError(null);

    // Validations: 0 <= receivedQty <= sentQty
    for (const item of receiveItems) {
      if (item.receivedQty < 0 || isNaN(item.receivedQty)) {
        setError(`La cantidad recibida para "${item.productName}" no puede ser negativa.`);
        return;
      }
      if (item.receivedQty > item.sentQty) {
        setError(
          `La cantidad recibida para "${item.productName}" (${item.receivedQty}) no puede superar la cantidad enviada (${item.sentQty}).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await logisticsService.receiveStockTransfer(selectedTransfer.id, {
        items: receiveItems.map((i) => ({
          stockTransferItemId: i.stockTransferItemId,
          receivedQty: Number(i.receivedQty),
          notes: i.notes || undefined,
        })),
        notes: generalNotes,
      });

      const hasDiff = receiveItems.some((i) => i.receivedQty < i.sentQty);
      setSuccessMsg(
        hasDiff
          ? `Recepción parcial registrada para el traspaso ${selectedTransfer.transferNumber}. Diferencias documentadas correctamente.`
          : `Recepción COMPLETA registrada para el traspaso ${selectedTransfer.transferNumber}. Mercadería ingresada al depósito destino.`
      );

      setSelectedTransfer(null);
      setActiveStep(1);
      loadData();
    } catch (err: any) {
      console.error('Error al procesar la recepción:', err);
      setError(err.response?.data?.message || 'Error al procesar la recepción de mercadería.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate metrics
  const inTransitCount = transfers.filter((t) => t.status === 'IN_TRANSIT').length;
  const totalItemsInTransit = transfers.reduce(
    (acc, t) => acc + t.items.reduce((iAcc, item) => iAcc + Number(item.quantity || 0), 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-100 dark:bg-teal-950/60 rounded-xl text-teal-600 dark:text-teal-400">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Recepciones de Mercadería
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ruta: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-teal-600 dark:text-teal-400">/logistics/receipts</code> | Control de ingreso y diferencias para depósitos destino
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="h-4 w-4" /> Actualizar Lista
          </button>
        </div>
      </div>

      {/* Alert Banner Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. STEPPER OPERATIVO */}
      {activeStep === 1 ? (
        /* STEP 1: LISTADO DE RECEPCIONES PENDIENTES */
        <div className="space-y-6">
          {/* Hero KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-purple-500 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Envíos En Tránsito
                </span>
                <div className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400 mt-1">
                  {inTransitCount}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Pendientes de ingreso físico</p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl text-purple-600 dark:text-purple-400">
                <Truck className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-teal-500 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Unidades en Transporte
                </span>
                <div className="text-2xl font-black font-mono text-teal-600 dark:text-teal-400 mt-1">
                  {totalItemsInTransit} u.
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Total bultos por recepcionar</p>
              </div>
              <div className="p-3 bg-teal-50 dark:bg-teal-950/40 rounded-xl text-teal-600 dark:text-teal-400">
                <PackageCheck className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-emerald-500 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Rol Actual Permisos
                </span>
                <div className="text-base font-bold text-slate-800 dark:text-slate-200 mt-1 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  {user?.role || 'Usuario'}
                </div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-semibold">
                  Habilitado para registrar ingresos
                </p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* 3. Filters & Search Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar por número TRA-XXXXXX o producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <select
                value={selectedOrigin}
                onChange={(e) => setSelectedOrigin(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 flex-1 md:flex-none"
              >
                <option value="">Todos los Orígenes</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 flex-1 md:flex-none"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 flex-1 md:flex-none font-bold"
              >
                <option value="IN_TRANSIT">En Tránsito (Pendientes)</option>
                <option value="RECEIVED">Recibidos</option>
                <option value="">Todos los Estados</option>
              </select>
            </div>
          </div>

          {/* 4. DESKTOP DATATABLE & MOBILE CARDS LIST */}
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between text-sm">
              <span>Traspasos Pendientes de Recepción</span>
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-800/50">
                Estado: IN_TRANSIT
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500">
                    <th className="p-4">Número traspaso</th>
                    <th className="p-4">Depósito origen</th>
                    <th className="p-4">Depósito destino</th>
                    <th className="p-4">Fecha despacho</th>
                    <th className="p-4">Usuario despachó</th>
                    <th className="p-4">Productos</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 animate-pulse">
                        Cargando envíos en tránsito...
                      </td>
                    </tr>
                  ) : transfers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No hay traspasos pendientes de recepción en este momento.
                      </td>
                    </tr>
                  ) : (
                    transfers.map((t) => {
                      const totalQty = t.items.reduce((acc, i) => acc + Number(i.quantity || 0), 0);
                      return (
                        <tr
                          key={t.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="p-4 font-bold text-purple-600 dark:text-purple-400 font-mono">
                            {t.transferNumber}
                          </td>
                          <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                            {t.originWarehouse?.name || 'Origen'}
                          </td>
                          <td className="p-4 font-bold text-slate-900 dark:text-slate-100">
                            {t.destinationWarehouse?.name || 'Destino'}
                          </td>
                          <td className="p-4 text-xs text-slate-500">
                            {t.departureDate
                              ? new Date(t.departureDate).toLocaleDateString('es-AR')
                              : new Date(t.createdAt).toLocaleDateString('es-AR')}
                          </td>
                          <td className="p-4 text-xs text-slate-600 dark:text-slate-400">
                            {t.dispatchedByUser?.name || 'Sistema'}
                          </td>
                          <td className="p-4 text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {t.items.length} ítems ({totalQty} u.)
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 inline-flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
                              {t.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 ml-auto">
                              {t.status === 'IN_TRANSIT' && (
                                <button
                                  onClick={() => handleStartReception(t)}
                                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-sm transition-all active:scale-95"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Recibir Mercadería
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenRecDoc(t)}
                                className="p-1.5 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg"
                                title="Ver / Imprimir Comprobante REC"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List View (Optimized for handheld warehouse devices) */}
          <div className="block md:hidden space-y-3">
            {loading ? (
              <div className="p-8 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                Cargando envíos en tránsito...
              </div>
            ) : transfers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                No hay envíos pendientes de recepción.
              </div>
            ) : (
              transfers.map((t) => {
                const totalQty = t.items.reduce((acc, i) => acc + Number(i.quantity || 0), 0);
                return (
                  <div
                    key={t.id}
                    className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <div>
                        <span className="font-mono font-black text-purple-600 dark:text-purple-400 text-base">
                          {t.transferNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {t.departureDate
                            ? new Date(t.departureDate).toLocaleDateString('es-AR')
                            : 'Reciente'}
                        </span>
                      </div>
                      <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                        {t.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                          Origen
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {t.originWarehouse?.name}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                          Destino
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {t.destinationWarehouse?.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
                      <span>Despachó: <strong>{t.dispatchedByUser?.name || 'Sistema'}</strong></span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {t.items.length} prod. ({totalQty} u.)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.status === 'IN_TRANSIT' && (
                        <button
                          onClick={() => handleStartReception(t)}
                          className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
                        >
                          <CheckCircle2 className="h-5 w-5" /> Recibir Mercadería
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenRecDoc(t)}
                        className="px-3 py-3 bg-slate-100 dark:bg-slate-800 text-teal-600 dark:text-teal-400 rounded-xl font-bold text-xs flex items-center justify-center"
                        title="Ver / Imprimir Comprobante REC"
                      >
                        <Printer className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* STEP 2: DETALLE Y CONTEO DE RECEPCIÓN (OPTIMIZADO PARA MÓVIL Y DEPOSITOS) */
        selectedTransfer && (
          <div className="space-y-6">
            {/* Action Header Banner */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <button
                    onClick={() => setActiveStep(1)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 mb-1"
                  >
                    $\leftarrow$ Volver al Listado
                  </button>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Truck className="h-6 w-6 text-purple-600" />
                    Recepción del Traspaso {selectedTransfer.transferNumber}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Verifique físicamente cada bulto. Ajuste la cantidad recibida si existen faltantes.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAutoCompleteAll}
                    className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                    title="Marcar todas las cantidades como totalmente recibidas"
                  >
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    Recepción Completa Automática
                  </button>
                </div>
              </div>

              {/* Cabecera del Traspaso */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl text-xs border border-slate-200/60 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Origen
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {selectedTransfer.originWarehouse?.name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Destino
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {selectedTransfer.destinationWarehouse?.name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Fecha Salida
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {selectedTransfer.departureDate
                      ? new Date(selectedTransfer.departureDate).toLocaleDateString('es-AR')
                      : new Date(selectedTransfer.createdAt).toLocaleDateString('es-AR')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Usuario Despacho
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {selectedTransfer.dispatchedByUser?.name || 'Sistema'}
                  </span>
                </div>
              </div>
            </div>

            {/* STATUS SUMMARY ALERT FOR DIFFERENCES */}
            {receiveItems.some((i) => i.receivedQty < i.sentQty) ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🟡</span>
                  <div>
                    <div className="text-sm font-extrabold text-amber-800 dark:text-amber-300">
                      Diferencia Detectada (Faltantes en la Entrega)
                    </div>
                    <p className="font-medium text-amber-700 dark:text-amber-400 mt-0.5">
                      Faltante Total:{' '}
                      {receiveItems.reduce((acc, i) => acc + Math.max(0, i.sentQty - i.receivedQty), 0)}{' '}
                      unidades. El movimiento registrará la recepción parcial y las diferencias.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-sm">
                <span className="text-xl">🟢</span>
                <div>
                  <div className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300">
                    Recepción Completa (Sin Diferencias)
                  </div>
                  <p className="font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Todas las cantidades recibidas coinciden exactamente con los bultos despachados.
                  </p>
                </div>
              </div>
            )}

            {/* PRODUCT CARDS FOR RECEPTION (RESPONSIVE & MOBILE-FIRST LARGE INPUTS) */}
            <div className="space-y-4">
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                Conteo Físico de Productos ({receiveItems.length})
              </h3>

              <div className="space-y-3">
                {receiveItems.map((item, idx) => {
                  const diff = item.receivedQty - item.sentQty;
                  const isMissing = diff < 0;

                  return (
                    <div
                      key={item.stockTransferItemId}
                      className={`p-4 rounded-2xl border transition-all ${
                        isMissing
                          ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="font-black text-slate-900 dark:text-slate-100 text-base">
                            {item.productName}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">SKU: {item.sku}</div>
                        </div>

                        {/* Status tag */}
                        <div>
                          {isMissing ? (
                            <span className="px-3 py-1 bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 text-xs font-bold rounded-full flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                              Faltante: {Math.abs(diff)} u.
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 text-xs font-bold rounded-full flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              Completo
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 items-center">
                        {/* Sent vs Received summary */}
                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                              Enviado (Origen)
                            </span>
                            <span className="font-black text-base text-slate-800 dark:text-slate-200">
                              {item.sentQty} u.
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                              Diferencia
                            </span>
                            <span
                              className={`font-black text-base ${
                                isMissing ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'
                              }`}
                            >
                              {diff === 0 ? '0 u.' : `${diff} u.`}
                            </span>
                          </div>
                        </div>

                        {/* Large Touch Control for Mobile */}
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mr-1">
                            Recibido:
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              setReceiveItems((prev) =>
                                prev.map((i, iIdx) =>
                                  iIdx === idx
                                    ? { ...i, receivedQty: Math.max(0, i.receivedQty - 1) }
                                    : i
                                )
                              );
                            }}
                            className="h-11 w-11 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-800 dark:text-slate-200 rounded-xl flex items-center justify-center font-bold text-lg border border-slate-300 dark:border-slate-700"
                          >
                            -
                          </button>

                          <input
                            type="number"
                            min="0"
                            max={item.sentQty}
                            value={item.receivedQty}
                            onChange={(e) => {
                              const val = Math.min(
                                item.sentQty,
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              );
                              setReceiveItems((prev) =>
                                prev.map((i, iIdx) =>
                                  iIdx === idx ? { ...i, receivedQty: val } : i
                                )
                              );
                            }}
                            className="h-11 w-28 bg-white dark:bg-slate-900 border-2 border-primary-500 rounded-xl text-center font-black text-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                          />

                          <button
                            type="button"
                            onClick={() => {
                              setReceiveItems((prev) =>
                                prev.map((i, iIdx) =>
                                  iIdx === idx
                                    ? { ...i, receivedQty: Math.min(i.sentQty, i.receivedQty + 1) }
                                    : i
                                )
                              );
                            }}
                            className="h-11 w-11 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-800 dark:text-slate-200 rounded-xl flex items-center justify-center font-bold text-lg border border-slate-300 dark:border-slate-700"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Observations & Quick Preset Chips */}
                      <div className="pt-3 space-y-2 border-t border-slate-100 dark:border-slate-800/80 mt-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-400 mr-1">
                            Observaciones rápidas:
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddQuickNote(idx, 'Producto faltante')}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-semibold transition-colors border border-slate-200 dark:border-slate-700"
                          >
                            📦 Producto faltante
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddQuickNote(idx, 'Mercadería dañada')}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-semibold transition-colors border border-slate-200 dark:border-slate-700"
                          >
                            ⚠️ Mercadería dañada
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddQuickNote(idx, 'Error de conteo')}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-semibold transition-colors border border-slate-200 dark:border-slate-700"
                          >
                            🔢 Error de conteo
                          </button>
                        </div>

                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReceiveItems((prev) =>
                              prev.map((i, iIdx) => (iIdx === idx ? { ...i, notes: val } : i))
                            );
                          }}
                          placeholder="Nota u observación específica sobre este ítem..."
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* General Observations Input */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Observaciones Generales de la Recepción (Opcional)
              </label>
              <textarea
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="Observaciones de la descarga, estado del camión o precintos..."
                rows={2}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Final Action Buttons Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md">
              <button
                onClick={() => setActiveStep(1)}
                className="w-full sm:w-auto px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancelar y Volver
              </button>

              <button
                onClick={handleSubmitReception}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-3.5 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-black rounded-xl text-sm shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="h-5 w-5" /> Confirmar ingreso de mercadería
              </button>
            </div>
          </div>
        )
      )}
      <LogisticsDocumentModal
        data={docModalData}
        onClose={() => setDocModalData(null)}
      />
    </div>
  );
};
