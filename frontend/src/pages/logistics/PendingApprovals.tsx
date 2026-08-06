import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Eye,
  Search,
  AlertTriangle,
  X,
  Warehouse,
  ArrowRight,
  ShieldAlert,
  Edit3,
  Clock,
  Package,
  Layers,
  Filter,
  Check,
  Printer,
  FileText,
} from 'lucide-react';
import {
  logisticsService,
  TransferRequestDto,
  ProductAvailabilityWarehouseDto,
} from '../../services/logistics.service';
import { warehouseApi, Warehouse as WarehouseType } from '../../services/warehouse.service';
import { useAuth } from '../../contexts/AuthContext';
import { LogisticsDocumentModal, LogisticsDocumentData } from '../../components/logistics/LogisticsDocumentModal';

export const PendingApprovals: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission, hasCapability } = useAuth();

  const canApprove =
    hasCapability('logistics.request.approve') ||
    hasPermission('transfer_requests:approve') ||
    hasPermission('transfer_requests:reject') ||
    hasPermission('transfer_requests:write') ||
    hasPermission('logistics:write');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [pendingOrders, setPendingOrders] = useState<TransferRequestDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedOriginWarehouse, setSelectedOriginWarehouse] = useState('');

  // Modals state
  const [detailOrder, setDetailOrder] = useState<TransferRequestDto | null>(null);
  const [detailAvailabilities, setDetailAvailabilities] = useState<Record<string, number>>({});
  const [loadingDetailAvail, setLoadingDetailAvail] = useState(false);

  // Approval Modal State (Supports full & partial approval)
  const [evalOrder, setEvalOrder] = useState<TransferRequestDto | null>(null);
  const [evalIsPartialMode, setEvalIsPartialMode] = useState(false);
  const [evalNotes, setEvalNotes] = useState('');
  const [evalItems, setEvalItems] = useState<
    {
      transferRequestItemId: string;
      productName: string;
      sku: string;
      requestedQty: number;
      availableInOrigin: number;
      approvedQty: number;
    }[]
  >([]);
  const [loadingAvailabilities, setLoadingAvailabilities] = useState(false);

  // Rejection Modal State (Mandatory reason)
  const [rejectOrder, setRejectOrder] = useState<TransferRequestDto | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  const [docModalData, setDocModalData] = useState<LogisticsDocumentData | null>(null);

  const handleOpenPedDoc = (order: TransferRequestDto) => {
    setDocModalData({
      type: 'PED',
      documentNumber: order.requestNumber,
      date: order.createdAt,
      status: order.status,
      originWarehouse: { name: order.originWarehouse?.name || 'Origen', code: order.originWarehouse?.code },
      destinationWarehouse: { name: order.destinationWarehouse?.name || 'Destino', code: order.destinationWarehouse?.code },
      requestedBy: { name: order.requestedByUser?.name || 'Usuario', email: order.requestedByUser?.email },
      items: order.items.map((i) => ({
        productName: i.product?.name || 'Producto',
        sku: i.product?.sku || '',
        requestedQty: Number(i.requestedQty || i.quantity || 0),
        approvedQty: Number(i.approvedQty || 0),
      })),
      notes: order.notes,
    });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPendingOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, warehousesRes] = await Promise.all([
        logisticsService.getTransferRequests({
          status: 'PENDING',
          search: search || undefined,
        }),
        warehouseApi.list(),
      ]);

      let filtered = ordersRes.data || [];
      if (selectedOriginWarehouse) {
        filtered = filtered.filter(
          (o: TransferRequestDto) => o.originWarehouseId === selectedOriginWarehouse
        );
      }

      setPendingOrders(filtered);
      setWarehouses(warehousesRes || []);
    } catch (err: any) {
      console.error('Error cargando pedidos pendientes:', err);
      setError('Error al obtener la lista de pedidos pendientes de aprobación.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingOrders();
  }, [search, selectedOriginWarehouse]);

  // Open "Ver Detalle" Modal
  const handleOpenDetailModal = async (order: TransferRequestDto) => {
    setDetailOrder(order);
    setLoadingDetailAvail(true);
    setDetailAvailabilities({});

    try {
      const availMap: Record<string, number> = {};
      await Promise.all(
        order.items.map(async (item) => {
          try {
            const availRes = await logisticsService.getProductAvailability(item.productId);
            const wAvail = availRes.data.warehouses.find(
              (w: ProductAvailabilityWarehouseDto) => w.warehouseId === order.originWarehouseId
            );
            availMap[item.productId] = wAvail ? wAvail.availableStock : 0;
          } catch (e) {
            availMap[item.productId] = 0;
          }
        })
      );
      setDetailAvailabilities(availMap);
    } catch (e) {
      console.error('Error cargando disponibilidad para el detalle:', e);
    } finally {
      setLoadingDetailAvail(false);
    }
  };

  // Open Evaluation Modal (Aprobar o Aprobar Parcial)
  const handleOpenApprovalModal = async (order: TransferRequestDto, isPartialOnly = false) => {
    setEvalOrder(order);
    setEvalIsPartialMode(isPartialOnly);
    setEvalNotes('');
    setLoadingAvailabilities(true);

    try {
      const itemsWithAvail = await Promise.all(
        order.items.map(async (i) => {
          const reqQty = Number(i.requestedQty || i.quantity || 0);
          let availInOrigin = 0;
          try {
            const availRes = await logisticsService.getProductAvailability(i.productId);
            const wAvail = availRes.data.warehouses.find(
              (w: ProductAvailabilityWarehouseDto) => w.warehouseId === order.originWarehouseId
            );
            availInOrigin = wAvail ? wAvail.availableStock : 0;
          } catch (e) {
            availInOrigin = 0;
          }

          // Default suggestion: min(requested, available)
          const suggestedApproved = Math.min(reqQty, availInOrigin);

          return {
            transferRequestItemId: i.id!,
            productName: i.product?.name || 'Producto',
            sku: i.product?.sku || '',
            requestedQty: reqQty,
            availableInOrigin: availInOrigin,
            approvedQty: suggestedApproved,
          };
        })
      );

      setEvalItems(itemsWithAvail);
    } catch (err: any) {
      console.error('Error obteniendo disponibilidad para evaluación:', err);
    } finally {
      setLoadingAvailabilities(false);
    }
  };

  // Submit Approval
  const handleSubmitApproval = async () => {
    if (!evalOrder) return;
    setError(null);

    // Validations: approvedQty <= requestedQty
    for (const item of evalItems) {
      if (item.approvedQty > item.requestedQty) {
        setError(
          `La cantidad aprobada para "${item.productName}" (${item.approvedQty}) no puede superar la cantidad solicitada (${item.requestedQty}).`
        );
        return;
      }
      if (item.approvedQty < 0 || isNaN(item.approvedQty)) {
        setError(`La cantidad aprobada para "${item.productName}" no puede ser negativa.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await logisticsService.approveTransferRequest(evalOrder.id, {
        items: evalItems.map((i) => ({
          transferRequestItemId: i.transferRequestItemId,
          approvedQty: Number(i.approvedQty),
        })),
        notes: evalNotes,
      });

      const isPartial = evalItems.some((i) => i.approvedQty < i.requestedQty);
      setSuccessMsg(
        isPartial
          ? `Pedido ${evalOrder.requestNumber} aprobado PARCIALMENTE. Stock reservado en origen.`
          : `Pedido ${evalOrder.requestNumber} aprobado TOTALMENTE. Stock reservado en origen.`
      );

      setEvalOrder(null);
      loadPendingOrders();
    } catch (err: any) {
      console.error('Error al aprobar pedido:', err);
      setError(err.response?.data?.message || 'Error al procesar la aprobación del pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Rejection Modal
  const handleOpenRejectionModal = (order: TransferRequestDto) => {
    setRejectOrder(order);
    setRejectionReason('');
    setRejectionError(null);
  };

  // Submit Rejection
  const handleSubmitRejection = async () => {
    if (!rejectOrder) return;
    setRejectionError(null);

    if (!rejectionReason.trim()) {
      setRejectionError('El motivo del rechazo es obligatorio. Por favor ingrese la razón.');
      return;
    }

    setIsSubmitting(true);
    try {
      await logisticsService.rejectTransferRequest(rejectOrder.id, {
        notes: rejectionReason.trim(),
      });
      setSuccessMsg(`Pedido ${rejectOrder.requestNumber} rechazado con éxito.`);
      setRejectOrder(null);
      loadPendingOrders();
    } catch (err: any) {
      console.error('Error al rechazar pedido:', err);
      setRejectionError(
        err.response?.data?.message || 'Error al procesar el rechazo del pedido.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Permission Guard for Cajero
  if (!canApprove) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-w-lg mx-auto mt-12 shadow-lg">
        <div className="h-16 w-16 bg-rose-100 dark:bg-rose-950/50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
          Acceso Restringido
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Su usuario no posee la capacidad requerida para acceder a la aprobación de
          pedidos. Esta sección requiere la capacidad de aprobación de solicitudes.
        </p>
        <button
          onClick={() => navigate('/logistics/orders')}
          className="mt-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-xs transition-all shadow-md"
        >
          Regresar a Mis Pedidos
        </button>
      </div>
    );
  }

  // Calculate summary metrics
  const totalPendingCount = pendingOrders.length;
  const uniqueOriginsCount = new Set(pendingOrders.map((o) => o.originWarehouseId)).size;
  const totalItemsRequested = pendingOrders.reduce(
    (acc, o) => acc + o.items.reduce((iAcc, item) => iAcc + Number(item.requestedQty || item.quantity || 0), 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Aprobación de Pedidos Internos
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ruta: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-emerald-600 dark:text-emerald-400">/logistics/orders/pending</code> | Panel operativo de autorización para supervisores
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/logistics/orders')}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs transition-all shadow-sm"
          >
            Ver Todos los Pedidos
          </button>
        </div>
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
            <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. Hero KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* KPI 1: Pedidos Pendientes */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-amber-500 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">
              Pedidos Pendientes
            </span>
            <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
              {totalPendingCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Esperando autorización de stock</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        {/* KPI 2: Depósitos Abastecedores */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-indigo-500 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">
              Depósitos Origen
            </span>
            <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">
              {uniqueOriginsCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Depósitos origen requeridos</p>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Warehouse className="h-6 w-6" />
          </div>
        </div>

        {/* KPI 3: Total Unidades Solicitadas */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-emerald-500 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">
              Unidades Solicitadas
            </span>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {totalItemsRequested} u.
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Volumen total pendiente</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
            <Package className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* 3. Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por número PED-XXXXXX, origen, destino o notas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400 hidden sm:block" />
          <select
            value={selectedOriginWarehouse}
            onChange={(e) => setSelectedOriginWarehouse(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-auto"
          >
            <option value="">Todos los Depósitos Origen</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. DataTable */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between text-sm">
          <span>Solicitudes Pendientes ({pendingOrders.length})</span>
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800/50">
            Fase de Autorización de Stock
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500">
                <th className="p-4">Número pedido</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">Depósito origen</th>
                <th className="p-4">Depósito destino</th>
                <th className="p-4">Usuario solicitante</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Cargando pedidos pendientes...
                  </td>
                </tr>
              ) : pendingOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No hay pedidos pendientes de aprobación en este momento.
                  </td>
                </tr>
              ) : (
                pendingOrders.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="p-4 font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {o.requestNumber}
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      {new Date(o.createdAt).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                      {o.originWarehouse?.name || 'N/A'}
                    </td>
                    <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                      {o.destinationWarehouse?.name || 'N/A'}
                    </td>
                    <td className="p-4 text-xs text-slate-600 dark:text-slate-400">
                      {o.requestedByUser?.name || 'Usuario'}
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Pendiente
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* 1. Ver Detalle */}
                        <button
                          onClick={() => handleOpenDetailModal(o)}
                          className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-lg flex items-center gap-1 transition-colors"
                          title="Ver Detalle de Pedido"
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver detalle
                        </button>

                        {/* Imprimir Comprobante PED */}
                        <button
                          onClick={() => handleOpenPedDoc(o)}
                          className="p-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg"
                          title="Ver / Imprimir Comprobante PED"
                        >
                          <Printer className="h-4 w-4" />
                        </button>

                        {/* 2. Aprobar (Total/Normal) */}
                        <button
                          onClick={() => handleOpenApprovalModal(o, false)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-sm transition-all active:scale-95"
                          title="Aprobar Pedido"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
                        </button>

                        {/* 3. Aprobar Parcial */}
                        <button
                          onClick={() => handleOpenApprovalModal(o, true)}
                          className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-sm transition-all active:scale-95"
                          title="Aprobar Parcialmente (Modificar Cantidades)"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Aprobar parcial
                        </button>

                        {/* 4. Rechazar */}
                        <button
                          onClick={() => handleOpenRejectionModal(o)}
                          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-sm transition-all active:scale-95"
                          title="Rechazar Pedido"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL DETALLE DE PEDIDO */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-indigo-600" />
                  Detalle del Pedido #{detailOrder.requestNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Solicitado el {new Date(detailOrder.createdAt).toLocaleDateString('es-AR')} por{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {detailOrder.requestedByUser?.name}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setDetailOrder(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl text-xs border border-slate-200/60 dark:border-slate-800">
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">
                  Depósito Origen
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {detailOrder.originWarehouse?.name} ({detailOrder.originWarehouse?.code})
                </span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-semibold text-[10px] block">
                  Depósito Destino
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {detailOrder.destinationWarehouse?.name} ({detailOrder.destinationWarehouse?.code})
                </span>
              </div>
            </div>

            {detailOrder.notes && (
              <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 rounded-xl text-xs">
                <strong>Notas de Solicitud:</strong> {detailOrder.notes}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Productos en la Solicitud
                </h4>
                {loadingDetailAvail && (
                  <span className="text-[11px] text-slate-400 animate-pulse">
                    Consultando existencias origen...
                  </span>
                )}
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                {detailOrder.items.map((item) => {
                  const req = Number(item.requestedQty || item.quantity || 0);
                  const avail = detailAvailabilities[item.productId] ?? 0;
                  const app = Number(item.approvedQty || 0);

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {item.product?.name || 'Producto'}
                        </div>
                        <div className="text-slate-400 text-[11px]">SKU: {item.product?.sku}</div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-center bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800 sm:w-72">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                            Solicitado
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {req} u.
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                            Disponible
                          </span>
                          <span className="font-black text-emerald-600 dark:text-emerald-400">
                            {avail} u.
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                            Aprobado
                          </span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            {app} u.
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  const orderToPrint = detailOrder;
                  setDetailOrder(null);
                  handleOpenPedDoc(orderToPrint);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="h-4 w-4" /> Imprimir Comprobante PED
              </button>

              <button
                onClick={() => setDetailOrder(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL APROBACIÓN / APROBACIÓN PARCIAL */}
      {evalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {evalIsPartialMode ? (
                    <>
                      <Edit3 className="h-5 w-5 text-amber-500" />
                      Aprobación Parcial de Pedido #{evalOrder.requestNumber}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      Aprobación de Pedido #{evalOrder.requestNumber}
                    </>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Origen: <span className="font-semibold">{evalOrder.originWarehouse?.name}</span>{' '}
                  → Destino:{' '}
                  <span className="font-semibold">{evalOrder.destinationWarehouse?.name}</span>
                </p>
              </div>
              <button
                onClick={() => setEvalOrder(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 rounded-xl text-xs">
              Revisa la disponibilidad en el depósito origen. Puedes modificar la cantidad
              aprobada en el campo de edición para cada producto.
            </div>

            {loadingAvailabilities ? (
              <div className="p-8 text-center text-slate-400 animate-pulse">
                Consultando disponibilidad actual en depósito origen...
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {evalItems.map((item, idx) => {
                  const isPartialItem = item.approvedQty < item.requestedQty;
                  return (
                    <div
                      key={item.transferRequestItemId}
                      className={`p-3.5 rounded-xl border space-y-2 text-xs transition-colors ${
                        isPartialItem
                          ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {item.productName}
                          </div>
                          <div className="text-slate-400">SKU: {item.sku}</div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                            Disponibilidad Actual
                          </span>
                          <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                            {item.availableInOrigin} u.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <div>
                          <span className="text-slate-500 font-semibold">Solicitado: </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {item.requestedQty} u.
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="font-bold text-slate-700 dark:text-slate-300">
                            Aprobar:
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={item.requestedQty}
                            value={item.approvedQty}
                            onChange={(e) => {
                              const val = Math.min(
                                item.requestedQty,
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              );
                              setEvalItems((prev) =>
                                prev.map((i, iIdx) =>
                                  iIdx === idx ? { ...i, approvedQty: val } : i
                                )
                              );
                            }}
                            className="w-24 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-center font-black text-sm focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      </div>

                      {/* Advertencia requerida por la consigna cuando la cantidad aprobada es menor a la solicitada */}
                      {isPartialItem && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-800 dark:text-amber-300 font-bold pt-1 bg-amber-100/70 dark:bg-amber-900/40 p-2 rounded-lg border border-amber-300 dark:border-amber-800">
                          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                          <span>El pedido será aprobado parcialmente</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* General Partial Warning Banner if any item is partial */}
            {evalItems.some((i) => i.approvedQty < i.requestedQty) && (
              <div className="p-3 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span>El pedido será aprobado parcialmente</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Notas de Evaluación (Opcional)
              </label>
              <input
                type="text"
                value={evalNotes}
                onChange={(e) => setEvalNotes(e.target.value)}
                placeholder="Comentarios adicionales para depósito o transporte..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setEvalOrder(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitApproval}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {evalItems.some((i) => i.approvedQty < i.requestedQty)
                  ? 'Aprobar Parcialmente'
                  : 'Aprobar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL OBLIGATORIO DE RECHAZO */}
      {rejectOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  Rechazo de Pedido #{rejectOrder.requestNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Origen: {rejectOrder.originWarehouse?.name} → Destino:{' '}
                  {rejectOrder.destinationWarehouse?.name}
                </p>
              </div>
              <button
                onClick={() => setRejectOrder(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-xs">
              Debe especificar obligatoriamente el motivo del rechazo para notificar al solicitante.
            </div>

            {rejectionError && (
              <div className="p-3 bg-rose-100 dark:bg-rose-900/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                <span>{rejectionError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Motivo del rechazo <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  if (rejectionError) setRejectionError(null);
                }}
                placeholder="Indica el motivo de rechazo (falta de existencias, pedido erróneo, duplicado, etc.)..."
                rows={4}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setRejectOrder(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitRejection}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" /> Confirmar Rechazo
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
