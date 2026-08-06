import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit3,
  Send,
  Truck,
  Eye,
  X,
  Trash2,
  Printer,
  FileText,
} from 'lucide-react';
import { logisticsService, TransferRequestDto } from '../../services/logistics.service';
import { warehouseApi, Warehouse } from '../../services/warehouse.service';
import { useAuth } from '../../contexts/AuthContext';
import { LogisticsDocumentModal, LogisticsDocumentData } from '../../components/logistics/LogisticsDocumentModal';

export const LogisticsOrders: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<'my_orders' | 'approvals'>(
    searchParams.get('tab') === 'approvals' ? 'approvals' : 'my_orders'
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [orders, setOrders] = useState<TransferRequestDto[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(searchParams.get('new') === 'true');
  const [detailModalOrder, setDetailModalOrder] = useState<TransferRequestDto | null>(null);
  const [evalModalOrder, setEvalModalOrder] = useState<TransferRequestDto | null>(null);
  const [docModalData, setDocModalData] = useState<LogisticsDocumentData | null>(null);

  const hasAvailableBalance = (order: TransferRequestDto): boolean => {
    if (!order.items || order.items.length === 0) return false;
    return order.items.some((item) => {
      const approved = Number(item.approvedQty || 0);
      const sent = Number(item.sentQty || 0);
      return approved - sent > 0;
    });
  };

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

  // Form states for Create / Edit Draft
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [originWarehouseId, setOriginWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderItems, setOrderItems] = useState<{ productId: string; name: string; sku: string; quantity: number }[]>([]);

  // Product search inside Create Modal
  const [productQuery, setProductQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  // Form states for Evaluation (Approve / Reject)
  const [evalItems, setEvalItems] = useState<{ transferRequestItemId: string; productName: string; requestedQty: number; approvedQty: number }[]>([]);
  const [evalNotes, setEvalNotes] = useState('');
  const [evalMode, setEvalMode] = useState<'APPROVE' | 'REJECT'>('APPROVE');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, warehousesRes] = await Promise.all([
        logisticsService.getTransferRequests({
          search: search || undefined,
          status: statusFilter || undefined,
        }),
        warehouseApi.list(),
      ]);

      setOrders(ordersRes.data || []);
      setWarehouses(warehousesRes || []);
    } catch (err: any) {
      console.error('Error cargando pedidos:', err);
      setError('Error al cargar la lista de pedidos internos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  // Product search debounce
  useEffect(() => {
    if (!productQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingProducts(true);
      try {
        const res = await logisticsService.searchLogisticsProducts(productQuery);
        setSearchResults(res.data || []);
      } catch (err) {
        console.error('Error buscando productos:', err);
      } finally {
        setIsSearchingProducts(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [productQuery]);

  const handleAddProductToOrder = (product: any) => {
    if (orderItems.some((i) => i.productId === product.id)) {
      return;
    }
    setOrderItems((prev) => [
      ...prev,
      {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
      },
    ]);
    setProductQuery('');
    setSearchResults([]);
  };

  const handleRemoveProductFromOrder = (productId: string) => {
    setOrderItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const handleQuantityChange = (productId: string, qty: number) => {
    setOrderItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, qty) } : i))
    );
  };

  const handleOpenCreateModal = () => {
    setEditingOrderId(null);
    setOriginWarehouseId('');
    setDestinationWarehouseId('');
    setOrderNotes('');
    setOrderItems([]);
    setCreateModalOpen(true);
  };

  const handleOpenEditModal = (order: TransferRequestDto) => {
    if (order.status !== 'DRAFT') return;
    setEditingOrderId(order.id);
    setOriginWarehouseId(order.originWarehouseId);
    setDestinationWarehouseId(order.destinationWarehouseId);
    setOrderNotes(order.notes || '');
    setOrderItems(
      order.items.map((i) => ({
        productId: i.productId,
        name: i.product?.name || 'Producto',
        sku: i.product?.sku || '',
        quantity: Number(i.quantity || i.requestedQty || 1),
      }))
    );
    setCreateModalOpen(true);
  };

  const handleSaveOrder = async () => {
    setError(null);
    if (!originWarehouseId || !destinationWarehouseId) {
      setError('Debe seleccionar el depósito de origen y de destino.');
      return;
    }
    if (originWarehouseId === destinationWarehouseId) {
      setError('El depósito de origen y de destino no pueden ser el mismo.');
      return;
    }
    if (orderItems.length === 0) {
      setError('Debe agregar al menos un producto al pedido.');
      return;
    }

    try {
      const payload = {
        originWarehouseId,
        destinationWarehouseId,
        notes: orderNotes,
        items: orderItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      };

      if (editingOrderId) {
        await logisticsService.updateTransferRequest(editingOrderId, payload);
        setSuccessMsg('Pedido en borrador actualizado correctamente.');
      } else {
        await logisticsService.createTransferRequest(payload);
        setSuccessMsg('Pedido en borrador creado correctamente.');
      }

      setCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Error guardando pedido:', err);
      setError(err.response?.data?.message || 'No se pudo guardar el pedido.');
    }
  };

  const handleSendOrder = async (orderId: string) => {
    try {
      await logisticsService.sendTransferRequest(orderId);
      setSuccessMsg('Pedido enviado a aprobación con éxito.');
      loadData();
    } catch (err: any) {
      console.error('Error enviando pedido:', err);
      setError(err.response?.data?.message || 'Error al enviar el pedido a aprobación.');
    }
  };

  const handleOpenEvalModal = (order: TransferRequestDto, mode: 'APPROVE' | 'REJECT') => {
    setEvalModalOrder(order);
    setEvalMode(mode);
    setEvalNotes('');
    setEvalItems(
      order.items.map((i) => ({
        transferRequestItemId: i.id!,
        productName: i.product?.name || 'Producto',
        requestedQty: Number(i.requestedQty || i.quantity || 0),
        approvedQty: Number(i.requestedQty || i.quantity || 0),
      }))
    );
  };

  const handleSubmitEvaluation = async () => {
    if (!evalModalOrder) return;
    setError(null);

    try {
      if (evalMode === 'APPROVE') {
        await logisticsService.approveTransferRequest(evalModalOrder.id, {
          items: evalItems.map((i) => ({
            transferRequestItemId: i.transferRequestItemId,
            approvedQty: Number(i.approvedQty),
          })),
          notes: evalNotes,
        });
        setSuccessMsg('Pedido evaluado y aprobado con éxito.');
      } else {
        if (!evalNotes.trim()) {
          setError('Debe ingresar un motivo de rechazo.');
          return;
        }
        await logisticsService.rejectTransferRequest(evalModalOrder.id, { notes: evalNotes });
        setSuccessMsg('Pedido rechazado con éxito.');
      }

      setEvalModalOrder(null);
      loadData();
    } catch (err: any) {
      console.error('Error evaluando pedido:', err);
      setError(err.response?.data?.message || 'Error al evaluar el pedido.');
    }
  };

  const handleCreateTransferDoc = async (orderId: string) => {
    try {
      const res = await logisticsService.createTransferFromRequest(orderId);
      setSuccessMsg(`Documento de Traspaso ${res.data.transferNumber} generado con éxito.`);
      loadData();
    } catch (err: any) {
      console.error('Error generando traspaso:', err);
      setError(err.response?.data?.message || 'Error al generar documento de traspaso.');
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'approvals') {
      return o.status === 'PENDING';
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Borrador</span>;
      case 'PENDING':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Pendiente Aprobación</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Aprobado Total</span>;
      case 'PARTIAL':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Aprobado Parcial</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">Rechazado</span>;
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
            <ClipboardList className="h-6 w-6 text-primary-600" />
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              Pedidos Internos de Stock
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Crea, edita, envía y evalúa solicitudes de abastecimiento entre depósitos.
          </p>
        </div>
        {hasPermission('transfer_requests:create') && (
          <button
            onClick={() => navigate('/logistics/orders/create')}
            className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Crear Pedido
          </button>
        )}
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)}><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl self-start">
          <button
            onClick={() => setActiveTab('my_orders')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === 'my_orders'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Todos los Pedidos ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'approvals'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Pendientes de Aprobación
            {orders.filter((o) => o.status === 'PENDING').length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-amber-500 text-white font-bold rounded-full">
                {orders.filter((o) => o.status === 'PENDING').length}
              </span>
            )}
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por número o nota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todos los Estados</option>
            <option value="DRAFT">Borrador</option>
            <option value="PENDING">Pendiente</option>
            <option value="APPROVED">Aprobado Total</option>
            <option value="PARTIAL">Aprobado Parcial</option>
            <option value="REJECTED">Rechazado</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500">
                <th className="p-4">Número</th>
                <th className="p-4">Origen</th>
                <th className="p-4">Destino</th>
                <th className="p-4">Solicitante</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Fecha</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Cargando pedidos internos...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No se encontraron pedidos.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-bold text-slate-900 dark:text-slate-100">
                      {o.requestNumber}
                    </td>
                    <td className="p-4 text-slate-700 dark:text-slate-300">
                      {o.originWarehouse?.name || 'Origen'}
                    </td>
                    <td className="p-4 text-slate-700 dark:text-slate-300">
                      {o.destinationWarehouse?.name || 'Destino'}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">
                      {o.requestedByUser?.name || 'Usuario'}
                    </td>
                    <td className="p-4">{getStatusBadge(o.status)}</td>
                    <td className="p-4 text-slate-400 text-xs">
                      {new Date(o.createdAt).toLocaleDateString('es-AR')}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Ver Detalle */}
                        <button
                          onClick={() => setDetailModalOrder(o)}
                          className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Ver Detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Imprimir Comprobante PED */}
                        <button
                          onClick={() => handleOpenPedDoc(o)}
                          className="p-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg"
                          title="Ver / Imprimir Comprobante PED"
                        >
                          <Printer className="h-4 w-4" />
                        </button>

                        {/* Acciones para Borrador (DRAFT) */}
                        {o.status === 'DRAFT' && (
                          <>
                            {(hasPermission('transfer_requests:update') || hasPermission('transfer_requests:create')) && (
                              <button
                                onClick={() => handleOpenEditModal(o)}
                                className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg"
                                title="Editar Borrador"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                            )}
                            {(hasPermission('transfer_requests:send') || hasPermission('transfer_requests:update') || hasPermission('transfer_requests:create')) && (
                              <button
                                onClick={() => handleSendOrder(o.id)}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-lg flex items-center gap-1 shadow-sm"
                                title="Enviar a Aprobación"
                              >
                                <Send className="h-3 w-3" /> Enviar
                              </button>
                            )}
                          </>
                        )}

                        {/* Acciones de Evaluación (PENDING) - Requiere Permiso de Aprobación */}
                        {o.status === 'PENDING' && (
                          <>
                            {hasPermission('transfer_requests:approve') && (
                              <button
                                onClick={() => handleOpenEvalModal(o, 'APPROVE')}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1 shadow-sm"
                                title="Aprobar / Evaluar"
                              >
                                <CheckCircle2 className="h-3 w-3" /> Evaluar
                              </button>
                            )}
                            {hasPermission('transfer_requests:reject') && (
                              <button
                                onClick={() => handleOpenEvalModal(o, 'REJECT')}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1 shadow-sm"
                                title="Rechazar Pedido"
                              >
                                <XCircle className="h-3 w-3" /> Rechazar
                              </button>
                            )}
                          </>
                        )}

                        {/* Generar Traspaso si APPROVED o PARTIAL y si existe saldo disponible */}
                        {(o.status === 'APPROVED' || o.status === 'PARTIAL') &&
                          hasAvailableBalance(o) &&
                          hasPermission('transfers:create') && (
                            <button
                              onClick={() => handleCreateTransferDoc(o.id)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1 shadow-sm"
                              title="Generar Documento Traspaso"
                            >
                              <Truck className="h-3 w-3" /> Crear Traspaso
                            </button>
                          )}

                        {/* Ver Traspaso Asociado si fue generado */}
                        {(o.status === 'APPROVED' || o.status === 'PARTIAL') && o.stockTransfers && o.stockTransfers.length > 0 && (
                          <button
                            onClick={() => navigate('/logistics/transfers')}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-lg flex items-center gap-1 shadow-sm"
                            title="Ver Traspasos Asociados"
                          >
                            <Eye className="h-3 w-3" /> Ver Traspaso ({o.stockTransfers.length})
                          </button>
                        )}

                        {/* Indicador de Esperando Recepción si no hay saldo disponible y no hay botón de crear */}
                        {(o.status === 'APPROVED' || o.status === 'PARTIAL') && !hasAvailableBalance(o) && (!o.stockTransfers || o.stockTransfers.length === 0) && (
                          <span className="px-2.5 py-1 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 font-semibold text-xs rounded-lg border border-teal-200 dark:border-teal-800">
                            Esperando Recepción
                          </span>
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

      {/* CREATE / EDIT DRAFT MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-2xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {editingOrderId ? 'Editar Pedido Borrador' : 'Nuevo Pedido Interno'}
              </h3>
              <button onClick={() => setCreateModalOpen(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Depósito Origen (Abastecedor)
                </label>
                <select
                  value={originWarehouseId}
                  onChange={(e) => setOriginWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Seleccionar Origen</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Depósito Destino (Solicitante)
                </label>
                <select
                  value={destinationWarehouseId}
                  onChange={(e) => setDestinationWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Seleccionar Destino</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Product Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Buscar Productos
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Escriba nombre o SKU del producto..."
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
                />
                {isSearchingProducts && (
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 animate-pulse">Buscando...</span>
                )}
              </div>

              {/* Search Results dropdown */}
              {searchResults.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 shadow-lg">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddProductToOrder(p)}
                      className="w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">{p.name}</div>
                        <div className="text-slate-400">SKU: {p.sku}</div>
                      </div>
                      <span className="text-primary-600 font-semibold">+ Agregar</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Added Items List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Productos Solicitados ({orderItems.length})
              </h4>
              {orderItems.length === 0 ? (
                <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-400">
                  Ningún producto agregado todavía.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {orderItems.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100">{item.name}</div>
                        <div className="text-slate-400">SKU: {item.sku}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.productId, parseInt(e.target.value, 10))}
                          className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-center font-bold"
                        />
                        <button
                          onClick={() => handleRemoveProductFromOrder(item.productId)}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Notas u Observaciones
              </label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Observaciones adicionales..."
                rows={2}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <button
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveOrder}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-sm"
              >
                Guardar Borrador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {detailModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Pedido {detailModalOrder.requestNumber}
                </h3>
                <p className="text-xs text-slate-400">
                  Creado el {new Date(detailModalOrder.createdAt).toLocaleDateString('es-AR')}
                </p>
              </div>
              <button onClick={() => setDetailModalOrder(null)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400">Origen:</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{detailModalOrder.originWarehouse?.name}</p>
              </div>
              <div>
                <span className="text-slate-400">Destino:</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{detailModalOrder.destinationWarehouse?.name}</p>
              </div>
              <div>
                <span className="text-slate-400">Solicitado por:</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{detailModalOrder.requestedByUser?.name}</p>
              </div>
              <div>
                <span className="text-slate-400">Estado:</span>
                <div className="mt-0.5">{getStatusBadge(detailModalOrder.status)}</div>
              </div>
            </div>

            {detailModalOrder.notes && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-400">Notas: </span>
                <span className="text-slate-800 dark:text-slate-200">{detailModalOrder.notes}</span>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Productos Detallados</h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                {detailModalOrder.items.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{item.product?.name}</div>
                      <div className="text-slate-400">SKU: {item.product?.sku}</div>
                    </div>
                    <div className="text-right">
                      <div>Solicitado: <span className="font-bold">{item.requestedQty || item.quantity}</span></div>
                      <div>Aprobado: <span className="font-bold text-emerald-600">{item.approvedQty || 0}</span></div>
                      <div>Enviado: <span className="font-bold text-indigo-600">{item.sentQty || 0}</span> | Recibido: <span className="font-bold text-teal-600">{item.receivedQty || 0}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => {
                  const orderToPrint = detailModalOrder;
                  setDetailModalOrder(null);
                  handleOpenPedDoc(orderToPrint);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="h-4 w-4" /> Imprimir Comprobante PED
              </button>

              <button
                onClick={() => setDetailModalOrder(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EVALUATION (APPROVE / REJECT) MODAL */}
      {evalModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {evalMode === 'APPROVE' ? 'Evaluación y Aprobación de Pedido' : 'Rechazar Pedido Interno'}
              </h3>
              <button onClick={() => setEvalModalOrder(null)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400">
              Pedido <span className="font-bold text-slate-900 dark:text-slate-100">{evalModalOrder.requestNumber}</span> de{' '}
              <span className="font-bold">{evalModalOrder.destinationWarehouse?.name}</span> hacia{' '}
              <span className="font-bold">{evalModalOrder.originWarehouse?.name}</span>
            </div>

            {evalMode === 'APPROVE' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Ajuste las cantidades aprobadas para cada producto. Si aprueba una cantidad menor a la solicitada, el pedido se marcará como <strong>Aprobado Parcial (PARTIAL)</strong>.
                </p>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {evalItems.map((item, idx) => (
                    <div
                      key={item.transferRequestItemId}
                      className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100">{item.productName}</div>
                        <div className="text-slate-400">Solicitado: {item.requestedQty} u.</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="font-semibold text-slate-600 dark:text-slate-400">Aprobar:</label>
                        <input
                          type="number"
                          min="0"
                          max={item.requestedQty}
                          value={item.approvedQty}
                          onChange={(e) => {
                            const val = Math.min(item.requestedQty, Math.max(0, parseInt(e.target.value, 10) || 0));
                            setEvalItems((prev) =>
                              prev.map((i, iIdx) => (iIdx === idx ? { ...i, approvedQty: val } : i))
                            );
                          }}
                          className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-center font-bold"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Motivo de Rechazo (Obligatorio)
                </label>
                <textarea
                  value={evalNotes}
                  onChange={(e) => setEvalNotes(e.target.value)}
                  placeholder="Ingrese el motivo de rechazo..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}

            {evalMode === 'APPROVE' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Notas de Evaluación (Opcional)
                </label>
                <input
                  type="text"
                  value={evalNotes}
                  onChange={(e) => setEvalNotes(e.target.value)}
                  placeholder="Comentario sobre la aprobación..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setEvalModalOrder(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitEvaluation}
                className={`px-4 py-2 font-semibold text-white rounded-xl text-xs shadow-md ${
                  evalMode === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {evalMode === 'APPROVE' ? 'Confirmar Aprobación y Reservar Stock' : 'Confirmar Rechazo'}
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
