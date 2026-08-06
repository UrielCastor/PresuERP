import React, { useState, useEffect } from 'react';
import {
  Truck,
  Search,
  Boxes,
  Eye,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Filter,
  PackageCheck,
  ShieldAlert,
  Printer,
  FileText,
} from 'lucide-react';
import { logisticsService, StockTransferDto } from '../../services/logistics.service';
import { useAuth } from '../../contexts/AuthContext';
import { LogisticsDocumentModal, LogisticsDocumentData } from '../../components/logistics/LogisticsDocumentModal';

export const LogisticsTransfers: React.FC = () => {
  const { user, hasPermission, hasCapability } = useAuth();

  const canPrepare = hasCapability('logistics.transfer.prepare') || hasPermission('transfers:prepare');
  const canDispatch = hasCapability('logistics.transfer.dispatch') || hasPermission('transfers:dispatch');
  const isReadOnly = !canPrepare && !canDispatch;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [transfers, setTransfers] = useState<StockTransferDto[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [detailModalTransfer, setDetailModalTransfer] = useState<StockTransferDto | null>(null);
  const [prepareModalTransfer, setPrepareModalTransfer] = useState<StockTransferDto | null>(null);
  const [dispatchModalTransfer, setDispatchModalTransfer] = useState<StockTransferDto | null>(null);

  const [docModalData, setDocModalData] = useState<LogisticsDocumentData | null>(null);

  const handleOpenTraDoc = (transfer: StockTransferDto) => {
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
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await logisticsService.getStockTransfers({
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setTransfers(res.data || []);
    } catch (err: any) {
      console.error('Error cargando traspasos:', err);
      setError('Error al cargar la lista de documentos de traspaso.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  // Handle Preparation (PENDING -> PREPARING)
  const handleConfirmPrepare = async () => {
    if (!prepareModalTransfer) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await logisticsService.prepareStockTransfer(prepareModalTransfer.id);
      setSuccessMsg(
        `Traspaso ${prepareModalTransfer.transferNumber} marcado como En Preparación (PREPARING).`
      );
      setPrepareModalTransfer(null);
      loadData();
    } catch (err: any) {
      console.error('Error preparando traspaso:', err);
      setError(err.response?.data?.message || 'Error al preparar el traspaso de mercadería.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Dispatch (PREPARING -> IN_TRANSIT)
  const handleConfirmDispatch = async () => {
    if (!dispatchModalTransfer) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await logisticsService.dispatchStockTransfer(dispatchModalTransfer.id);
      setSuccessMsg(
        `Mercadería despachada con éxito. Traspaso ${dispatchModalTransfer.transferNumber} cambió a En Tránsito (IN_TRANSIT). Stock descontado del origen y Kardex registrado.`
      );
      setDispatchModalTransfer(null);
      loadData();
    } catch (err: any) {
      console.error('Error despachando traspaso:', err);
      setError(err.response?.data?.message || 'Error al despachar el traspaso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Pendiente
          </span>
        );
      case 'PREPARING':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
            En Preparación
          </span>
        );
      case 'IN_TRANSIT':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
            En Tránsito
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            Recibido
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
            {status}
          </span>
        );
    }
  };

  // Calculate metrics
  const totalTransfers = transfers.length;
  const pendingCount = transfers.filter((t) => t.status === 'PENDING').length;
  const preparingCount = transfers.filter((t) => t.status === 'PREPARING').length;
  const inTransitCount = transfers.filter((t) => t.status === 'IN_TRANSIT').length;

  return (
    <div className="space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Gestión de Traspasos y Despachos
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ruta: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-indigo-600 dark:text-indigo-400">/logistics/transfers</code> | Preparación física de bultos y salida hacia depósitos destino
              </p>
            </div>
          </div>
        </div>

        {/* Notice for Read-Only users */}
        {isReadOnly && (
          <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5 font-semibold">
            <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span>Modo lectura (Preparación y Despacho deshabilitados)</span>
          </div>
        )}
      </div>

      {/* Messages */}
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
            <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. Hero KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-slate-500 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">Total Traspasos</span>
            <div className="text-2xl font-black font-mono text-slate-800 dark:text-slate-200 mt-1">
              {totalTransfers}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Documentos registrados</p>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300">
            <Truck className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-amber-500 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">
              Pendientes Preparar
            </span>
            <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
              {pendingCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">A la espera de embalaje</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-indigo-500 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">En Preparación</span>
            <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">
              {preparingCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Listos para ser despachados</p>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Boxes className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-purple-500 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">En Tránsito</span>
            <div className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400 mt-1">
              {inTransitCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Camión en ruta a destino</p>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl text-purple-600 dark:text-purple-400">
            <PackageCheck className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* 3. Filter Card */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por número TRA-XXXXXX, origen, destino..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400 hidden sm:block" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-auto"
          >
            <option value="">Todos los Estados</option>
            <option value="PENDING">Pendiente</option>
            <option value="PREPARING">En Preparación</option>
            <option value="IN_TRANSIT">En Tránsito</option>
            <option value="RECEIVED">Recibido</option>
          </select>
        </div>
      </div>

      {/* 4. DataTable */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500">
                <th className="p-4">Documento</th>
                <th className="p-4">Origen</th>
                <th className="p-4">Destino</th>
                <th className="p-4">Pedido Ref</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Fecha</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Cargando documentos de traspaso...
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No se encontraron documentos de traspaso.
                  </td>
                </tr>
              ) : (
                transfers.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                      {t.transferNumber}
                    </td>
                    <td className="p-4 text-slate-700 dark:text-slate-300 font-semibold">
                      {t.originWarehouse?.name || 'Origen'}
                    </td>
                    <td className="p-4 text-slate-700 dark:text-slate-300 font-semibold">
                      {t.destinationWarehouse?.name || 'Destino'}
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-500">
                      {t.transferRequest?.requestNumber || 'Manual'}
                    </td>
                    <td className="p-4">{getStatusBadge(t.status)}</td>
                    <td className="p-4 text-slate-500 text-xs">
                      {new Date(t.createdAt).toLocaleDateString('es-AR')}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* 1. Ver Detalle */}
                        <button
                          onClick={() => setDetailModalTransfer(t)}
                          className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-lg flex items-center gap-1 transition-colors"
                          title="Ver Detalle del Traspaso"
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver detalle
                        </button>

                        {/* Imprimir Documento TRA */}
                        <button
                          onClick={() => handleOpenTraDoc(t)}
                          className="p-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg"
                          title="Ver / Imprimir Documento TRA"
                        >
                          <Printer className="h-4 w-4" />
                        </button>

                        {/* 2. Preparar (PENDING -> PREPARING) - Restricted for Cajero */}
                        {t.status === 'PENDING' && canPrepare && (
                          <button
                            onClick={() => setPrepareModalTransfer(t)}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-sm transition-all active:scale-95"
                            title="Iniciar Preparación de Mercadería"
                          >
                            <Boxes className="h-3.5 w-3.5" /> Preparar
                          </button>
                        )}

                        {/* 3. Despachar (PREPARING or PENDING -> IN_TRANSIT) - Restricted for Cajero */}
                        {(t.status === 'PREPARING' || t.status === 'PENDING') && canDispatch && (
                          <button
                            onClick={() => setDispatchModalTransfer(t)}
                            className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-sm transition-all active:scale-95"
                            title="Confirmar Despacho Físico en Tránsito"
                          >
                            <Truck className="h-3.5 w-3.5" /> Despachar
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

      {/* 5. MODAL DETALLE DE TRASPASO */}
      {detailModalTransfer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Truck className="h-5 w-5 text-indigo-600" />
                  Documento de Traspaso {detailModalTransfer.transferNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pedido Ref: {detailModalTransfer.transferRequest?.requestNumber || 'Manual'}
                </p>
              </div>
              <button
                onClick={() => setDetailModalTransfer(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">
                  Origen
                </span>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {detailModalTransfer.originWarehouse?.name}
                </p>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">
                  Destino
                </span>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {detailModalTransfer.destinationWarehouse?.name}
                </p>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">
                  Preparado por
                </span>
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  {detailModalTransfer.preparedByUser?.name || 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">
                  Despachado por
                </span>
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  {detailModalTransfer.dispatchedByUser?.name || 'N/A'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                Productos a Transferir
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                {detailModalTransfer.items.map((item) => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {item.product?.name || 'Producto'}
                      </div>
                      <div className="text-slate-400">SKU: {item.product?.sku}</div>
                    </div>
                    <div className="font-black text-indigo-600 dark:text-indigo-400 text-sm bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-lg">
                      {item.quantity} u.
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => {
                  const traToPrint = detailModalTransfer;
                  setDetailModalTransfer(null);
                  handleOpenTraDoc(traToPrint);
                }}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="h-4 w-4" /> Imprimir Documento TRA
              </button>

              <button
                onClick={() => setDetailModalTransfer(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. PANTALLA / MODAL PREPARACIÓN (PENDING -> PREPARING) */}
      {prepareModalTransfer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-indigo-600" />
                  Preparación de Mercadería - Traspaso {prepareModalTransfer.transferNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Depósito Origen: <span className="font-bold text-slate-700 dark:text-slate-300">{prepareModalTransfer.originWarehouse?.name}</span>
                </p>
              </div>
              <button
                onClick={() => setPrepareModalTransfer(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 rounded-xl text-xs">
              Verifique físicamente en el depósito los productos y cantidades a embalar. Al hacer clic en <strong>"Mercadería preparada"</strong>, el traspaso cambiará de estado <strong>PENDING → PREPARING</strong>.
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                Productos a Preparar
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                {prepareModalTransfer.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {item.product?.name || 'Producto'}
                      </div>
                      <div className="text-slate-400">SKU: {item.product?.sku}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 font-semibold text-[10px] uppercase block">
                        Cantidad a preparar
                      </span>
                      <span className="font-black text-indigo-600 dark:text-indigo-400 text-base">
                        {item.quantity} u.
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setPrepareModalTransfer(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPrepare}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" /> Mercadería preparada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL CONFIRMACIÓN DESPACHO (PREPARING -> IN_TRANSIT) */}
      {dispatchModalTransfer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Truck className="h-5 w-5 text-purple-600" />
                  Confirmar Despacho - Traspaso {dispatchModalTransfer.transferNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Confirmación de salida de mercadería en transporte hacia destino
                </p>
              </div>
              <button
                onClick={() => setDispatchModalTransfer(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Atención de Despacho:</strong> Al confirmar, el stock físico del depósito origen será <strong>descontado inmediatamente</strong>, consumiendo la reserva y registrando el egreso en el Kardex. El estado cambiará de <strong>PREPARING → IN_TRANSIT</strong>.
              </div>
            </div>

            {/* Resumen de Despacho */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                Resumen de Carga a Despachar
              </h4>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">
                    Origen
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {dispatchModalTransfer.originWarehouse?.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">
                    Destino
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {dispatchModalTransfer.destinationWarehouse?.name}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase block">
                  Productos y Cantidad:
                </span>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 text-xs">
                  {dispatchModalTransfer.items.map((item) => (
                    <div key={item.id} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {item.product?.name}
                        </span>
                        <span className="text-slate-400 text-[11px] block">SKU: {item.product?.sku}</span>
                      </div>
                      <span className="font-black text-purple-600 dark:text-purple-400 text-sm">
                        {item.quantity} u.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setDispatchModalTransfer(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDispatch}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Truck className="h-4 w-4" /> Despachar mercadería
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
