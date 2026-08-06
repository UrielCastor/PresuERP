import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  CheckCircle2,
  Truck,
  Boxes,
  Clock,
  Warehouse,
  Plus,
  ArrowRight,
  RefreshCw,
  Search,
  AlertTriangle,
  X,
  Filter,
  Eye,
  TrendingUp,
  Layers,
  ShieldAlert,
  Calendar,
  AlertCircle,
  Package,
} from 'lucide-react';
import {
  logisticsService,
  TransferRequestDto,
  StockTransferDto,
} from '../../services/logistics.service';
import { warehouseApi, Warehouse as WarehouseType } from '../../services/warehouse.service';
import { useAuth } from '../../contexts/AuthContext';

export const LogisticsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();

  const isCashier =
    user?.role?.toLowerCase() === 'cajero' || user?.role?.toLowerCase() === 'cashier';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Raw data
  const [allOrders, setAllOrders] = useState<TransferRequestDto[]>([]);
  const [allTransfers, setAllTransfers] = useState<StockTransferDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);

  // Filters
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modal for Ver Detalle
  const [detailItem, setDetailItem] = useState<{
    type: 'PED' | 'TRA';
    number: string;
    origin: string;
    destination: string;
    status: string;
    date: string;
    user: string;
    items: Array<{ name: string; sku: string; qty: number; approvedQty?: number; receivedQty?: number }>;
    notes?: string;
  } | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, transfersRes, warehousesRes] = await Promise.all([
        logisticsService.getTransferRequests({ limit: 100 }),
        logisticsService.getStockTransfers({ limit: 100 }),
        warehouseApi.list(),
      ]);

      setAllOrders(ordersRes.data || []);
      setAllTransfers(transfersRes.data || []);
      setWarehouses(warehousesRes || []);
    } catch (err: any) {
      console.error('Error cargando dashboard de logística:', err);
      setError('No se pudieron cargar los datos del resumen del módulo de logística.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Filtered data based on Cajero role and Global Filters
  const filteredData = useMemo(() => {
    let orders = [...allOrders];
    let transfers = [...allTransfers];

    // Cajero Role Filter: restricts to user's own orders or assigned warehouse
    if (isCashier) {
      const userWarehouseId = user?.defaultWarehouseId;
      orders = orders.filter(
        (o) =>
          o.requestedByUserId === user?.id ||
          (userWarehouseId && (o.originWarehouseId === userWarehouseId || o.destinationWarehouseId === userWarehouseId))
      );
      transfers = transfers.filter(
        (t) =>
          userWarehouseId && (t.originWarehouseId === userWarehouseId || t.destinationWarehouseId === userWarehouseId)
      );
    }

    // Filter by Warehouse
    if (selectedWarehouse) {
      orders = orders.filter(
        (o) => o.originWarehouseId === selectedWarehouse || o.destinationWarehouseId === selectedWarehouse
      );
      transfers = transfers.filter(
        (t) => t.originWarehouseId === selectedWarehouse || t.destinationWarehouseId === selectedWarehouse
      );
    }

    // Filter by Date
    if (selectedDate) {
      orders = orders.filter((o) => (o.createdAt || '').slice(0, 10) === selectedDate);
      transfers = transfers.filter((t) => (t.createdAt || '').slice(0, 10) === selectedDate);
    }

    // Filter by Status
    if (selectedStatus) {
      orders = orders.filter((o) => o.status === selectedStatus);
      transfers = transfers.filter((t) => t.status === selectedStatus);
    }

    return { orders, transfers };
  }, [allOrders, allTransfers, isCashier, user, selectedWarehouse, selectedDate, selectedStatus]);

  // Compute KPIs
  const pendingOrdersCount = filteredData.orders.filter((o) => o.status === 'PENDING').length;
  const approvalsCount = filteredData.orders.filter((o) => o.status === 'PENDING').length;
  const preparingCount = filteredData.transfers.filter((t) => t.status === 'PREPARING').length;
  const inTransitCount = filteredData.transfers.filter((t) => t.status === 'IN_TRANSIT').length;
  const toReceiveCount = filteredData.transfers.filter((t) => t.status === 'IN_TRANSIT').length;

  // Differences count: transfers where any received item < sent quantity or status is PARTIAL
  const differencesCount = useMemo(() => {
    return filteredData.transfers.filter((t) => {
      if (t.receipts && t.receipts.length > 0) {
        return t.receipts.some((r) => r.items.some((i) => i.receivedQty < i.expectedQty));
      }
      return false;
    }).length;
  }, [filteredData.transfers]);

  // Unified Recent Movements (Pedidos + Traspasos)
  const recentMovements = useMemo(() => {
    const combined: Array<{
      id: string;
      number: string;
      type: 'PED' | 'TRA';
      origin: string;
      destination: string;
      status: string;
      date: string;
      user: string;
      rawOrder?: TransferRequestDto;
      rawTransfer?: StockTransferDto;
    }> = [];

    filteredData.orders.forEach((o) => {
      combined.push({
        id: `ped-${o.id}`,
        number: o.requestNumber,
        type: 'PED',
        origin: o.originWarehouse?.name || 'Origen',
        destination: o.destinationWarehouse?.name || 'Destino',
        status: o.status,
        date: o.createdAt,
        user: o.requestedByUser?.name || 'Usuario',
        rawOrder: o,
      });
    });

    filteredData.transfers.forEach((t) => {
      combined.push({
        id: `tra-${t.id}`,
        number: t.transferNumber,
        type: 'TRA',
        origin: t.originWarehouse?.name || 'Origen',
        destination: t.destinationWarehouse?.name || 'Destino',
        status: t.status,
        date: t.createdAt,
        user: t.dispatchedByUser?.name || t.preparedByUser?.name || 'Sistema',
        rawTransfer: t,
      });
    });

    // Sort by date descending
    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return combined.slice(0, 10);
  }, [filteredData]);

  // Operational Ranking of Requested Products
  const topRequestedProducts = useMemo(() => {
    const map = new Map<string, { name: string; sku: string; totalQty: number; orderCount: Set<string> }>();

    filteredData.orders.forEach((o) => {
      o.items.forEach((item) => {
        const pId = item.productId;
        const pName = item.product?.name || 'Producto';
        const pSku = item.product?.sku || '';
        const qty = Number(item.requestedQty || item.quantity || 0);

        const current = map.get(pId) || { name: pName, sku: pSku, totalQty: 0, orderCount: new Set() };
        current.totalQty += qty;
        current.orderCount.add(o.id);
        map.set(pId, current);
      });
    });

    const result = Array.from(map.values()).map((v) => ({
      name: v.name,
      sku: v.sku,
      totalQty: v.totalQty,
      orderCount: v.orderCount.size,
    }));

    result.sort((a, b) => b.totalQty - a.totalQty);
    return result.slice(0, 5);
  }, [filteredData.orders]);

  // Operational Alerts
  const operationalAlerts = useMemo(() => {
    const alerts: Array<{ id: string; type: 'warning' | 'info' | 'danger'; text: string; actionUrl?: string }> = [];

    // Alert 1: Orders waiting for approval
    const pendingOrders = filteredData.orders.filter((o) => o.status === 'PENDING');
    if (pendingOrders.length > 0) {
      alerts.push({
        id: 'alt-pending-orders',
        type: 'warning',
        text: `Hay ${pendingOrders.length} pedido(s) interno(s) esperando aprobación.`,
        actionUrl: '/logistics/orders/pending',
      });
    }

    // Alert 2: Transfers in transit > 24 hours
    const now = new Date().getTime();
    filteredData.transfers
      .filter((t) => t.status === 'IN_TRANSIT')
      .forEach((t) => {
        const depDate = new Date(t.departureDate || t.createdAt).getTime();
        const diffDays = Math.floor((now - depDate) / (1000 * 60 * 60 * 24));
        if (diffDays >= 1) {
          alerts.push({
            id: `alt-transit-${t.id}`,
            type: 'warning',
            text: `⚠️ Traspaso ${t.transferNumber} lleva ${diffDays} día(s) en tránsito hacia ${t.destinationWarehouse?.name || 'Destino'}.`,
            actionUrl: '/logistics/receipts',
          });
        }
      });

    // Alert 3: Receptions with differences
    filteredData.transfers.forEach((t) => {
      if (t.receipts && t.receipts.length > 0) {
        t.receipts.forEach((r) => {
          const diffItems = r.items.filter((i) => i.receivedQty < i.expectedQty);
          if (diffItems.length > 0) {
            const missingTotal = diffItems.reduce((acc, i) => acc + (i.expectedQty - i.receivedQty), 0);
            alerts.push({
              id: `alt-diff-${t.id}`,
              type: 'danger',
              text: `🔴 Traspaso ${t.transferNumber} registrado con faltante de ${missingTotal} unidad(es).`,
              actionUrl: '/logistics/history',
            });
          }
        });
      }
    });

    return alerts.slice(0, 5);
  }, [filteredData]);

  // Standard Badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Borrador
          </span>
        );
      case 'PENDING':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 flex items-center gap-1 w-max">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pendiente
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            Aprobado
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
            Aprobado Parcial
          </span>
        );
      case 'PREPARING':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
            Preparando
          </span>
        );
      case 'IN_TRANSIT':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
            En tránsito
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
            Recibido
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
            Rechazado
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

  const handleOpenDetailModal = (mov: any) => {
    if (mov.type === 'PED' && mov.rawOrder) {
      setDetailItem({
        type: 'PED',
        number: mov.rawOrder.requestNumber,
        origin: mov.rawOrder.originWarehouse?.name || 'Origen',
        destination: mov.rawOrder.destinationWarehouse?.name || 'Destino',
        status: mov.rawOrder.status,
        date: mov.rawOrder.createdAt,
        user: mov.rawOrder.requestedByUser?.name || 'Usuario',
        notes: mov.rawOrder.notes,
        items: mov.rawOrder.items.map((i: any) => ({
          name: i.product?.name || 'Producto',
          sku: i.product?.sku || '',
          qty: Number(i.requestedQty || i.quantity || 0),
          approvedQty: Number(i.approvedQty || 0),
        })),
      });
    } else if (mov.type === 'TRA' && mov.rawTransfer) {
      setDetailItem({
        type: 'TRA',
        number: mov.rawTransfer.transferNumber,
        origin: mov.rawTransfer.originWarehouse?.name || 'Origen',
        destination: mov.rawTransfer.destinationWarehouse?.name || 'Destino',
        status: mov.rawTransfer.status,
        date: mov.rawTransfer.createdAt,
        user: mov.rawTransfer.dispatchedByUser?.name || mov.rawTransfer.preparedByUser?.name || 'Sistema',
        notes: mov.rawTransfer.notes,
        items: mov.rawTransfer.items.map((i: any) => ({
          name: i.product?.name || 'Producto',
          sku: i.product?.sku || '',
          qty: Number(i.quantity || 0),
        })),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🚚</span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Dashboard Operativo de Traspasos
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ruta: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-primary-600 dark:text-primary-400">/logistics</code> | Estado en tiempo real de pedidos, depósitos y envíos en tránsito
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadDashboardData}
            className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
            title="Recargar indicadores"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => navigate('/logistics/availability')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs transition-colors flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            Buscar Disponibilidad
          </button>

          {hasPermission('transfer_requests:create') && (
            <button
              onClick={() => navigate('/logistics/orders/create')}
              className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-xs transition-all shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuevo Pedido
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* 2. Global Filters Card */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
          <Filter className="h-4 w-4 text-primary-600" />
          Filtros del Módulo Logística:
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Depósito Filter */}
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 flex-1 md:flex-none font-semibold"
          >
            <option value="">Todos los Depósitos</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>

          {/* Fecha Filter */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 flex-1 md:flex-none font-semibold"
          />

          {/* Estado Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 flex-1 md:flex-none font-semibold"
          >
            <option value="">Todos los Estados</option>
            <option value="PENDING">Pendiente</option>
            <option value="PREPARING">En Preparación</option>
            <option value="IN_TRANSIT">En Tránsito</option>
            <option value="RECEIVED">Recibido</option>
            <option value="REJECTED">Rechazado</option>
          </select>

          {(selectedWarehouse || selectedDate || selectedStatus) && (
            <button
              onClick={() => {
                setSelectedWarehouse('');
                setSelectedDate('');
                setSelectedStatus('');
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* 3. Hero KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* KPI 1: Pedidos Pendientes */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-amber-500 shadow-sm flex flex-col justify-between hover:border-amber-500 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Pedidos Pendientes
            </span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              {loading ? '-' : pendingOrdersCount}
            </span>
            <button
              onClick={() => navigate('/logistics/orders')}
              className="text-[11px] font-bold text-primary-600 hover:underline flex items-center gap-0.5"
            >
              Ver <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* KPI 2: Pendientes de Aprobación */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-indigo-500 shadow-sm flex flex-col justify-between hover:border-indigo-500 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Para Aprobar
            </span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
              {loading ? '-' : approvalsCount}
            </span>
            <button
              onClick={() => navigate('/logistics/orders/pending')}
              className="text-[11px] font-bold text-primary-600 hover:underline flex items-center gap-0.5"
            >
              Evaluar <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* KPI 3: En Preparación */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-purple-500 shadow-sm flex flex-col justify-between hover:border-purple-500 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              En Preparación
            </span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
              {loading ? '-' : preparingCount}
            </span>
            <button
              onClick={() => navigate('/logistics/transfers')}
              className="text-[11px] font-bold text-primary-600 hover:underline flex items-center gap-0.5"
            >
              Preparar <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* KPI 4: En Tránsito */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-blue-500 shadow-sm flex flex-col justify-between hover:border-blue-500 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              En Tránsito
            </span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <Truck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
              {loading ? '-' : inTransitCount}
            </span>
            <button
              onClick={() => navigate('/logistics/transfers')}
              className="text-[11px] font-bold text-primary-600 hover:underline flex items-center gap-0.5"
            >
              Ruta <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* KPI 5: Por Recibir */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-teal-500 shadow-sm flex flex-col justify-between hover:border-teal-500 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Por Recibir
            </span>
            <div className="p-2 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 rounded-xl">
              <Warehouse className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-teal-600 dark:text-teal-400">
              {loading ? '-' : toReceiveCount}
            </span>
            <button
              onClick={() => navigate('/logistics/receipts')}
              className="text-[11px] font-bold text-primary-600 hover:underline flex items-center gap-0.5"
            >
              Recibir <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* KPI 6: Diferencias Detectadas */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-rose-500 shadow-sm flex flex-col justify-between hover:border-rose-500 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Diferencias
            </span>
            <div className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
              {loading ? '-' : differencesCount}
            </span>
            <button
              onClick={() => navigate('/logistics/history')}
              className="text-[11px] font-bold text-primary-600 hover:underline flex items-center gap-0.5"
            >
              Ver Novedades <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Section: Operational Alerts & Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts Column (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <h2 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                Alertas Operativas en Tiempo Real
              </h2>
            </div>
            <span className="text-xs text-slate-400">Estado logístico actual</span>
          </div>

          {loading ? (
            <div className="p-6 text-center text-slate-400 animate-pulse">Cargando alertas...</div>
          ) : operationalAlerts.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              🟢 Sin alertas operativas pendientes. Todo el flujo se encuentra al día.
            </div>
          ) : (
            <div className="space-y-2.5">
              {operationalAlerts.map((alt) => (
                <div
                  key={alt.id}
                  className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition-colors ${
                    alt.type === 'danger'
                      ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                      : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-sm">
                      {alt.type === 'danger' ? '🔴' : '⚠️'}
                    </span>
                    <span className="font-semibold">{alt.text}</span>
                  </div>

                  {alt.actionUrl && (
                    <button
                      onClick={() => navigate(alt.actionUrl!)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-200 font-bold text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1 flex-shrink-0"
                    >
                      Ir <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ranking Column (1 col) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <h2 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                Productos Más Solicitados
              </h2>
            </div>
            <span className="text-[11px] text-slate-400">Demanda Interna</span>
          </div>

          {loading ? (
            <div className="p-6 text-center text-slate-400 animate-pulse">Cargando ranking...</div>
          ) : topRequestedProducts.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No hay solicitudes registradas aún.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {topRequestedProducts.map((p, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 font-black text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{p.name}</div>
                      <div className="text-slate-400 text-[10px]">SKU: {p.sku}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-emerald-600 dark:text-emerald-400 block text-xs">
                      {p.totalQty} unidades
                    </span>
                    <span className="text-[10px] text-slate-400">{p.orderCount} pedidos</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Tabla Operativa: Movimientos Recientes */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
              Movimientos Recientes
            </h2>
            <p className="text-xs text-slate-400">
              Lista unificada de pedidos de stock (PED) y traspasos físicos (TRA)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/logistics/orders')}
              className="text-xs font-bold text-primary-600 hover:underline"
            >
              Ver Pedidos
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => navigate('/logistics/transfers')}
              className="text-xs font-bold text-primary-600 hover:underline"
            >
              Ver Traspasos
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase text-slate-500">
                <th className="p-4">Número documento</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Origen</th>
                <th className="p-4">Destino</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">Usuario responsable</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Cargando movimientos recientes...
                  </td>
                </tr>
              ) : recentMovements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No hay movimientos recientes registrados.
                  </td>
                </tr>
              ) : (
                recentMovements.map((mov) => (
                  <tr
                    key={mov.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="p-4 font-bold font-mono text-slate-900 dark:text-slate-100">
                      {mov.number}
                    </td>
                    <td className="p-4">
                      {mov.type === 'PED' ? (
                        <span className="px-2 py-0.5 text-[11px] font-black rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          PED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[11px] font-black rounded bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                          TRA
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                      {mov.origin}
                    </td>
                    <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                      {mov.destination}
                    </td>
                    <td className="p-4">{getStatusBadge(mov.status)}</td>
                    <td className="p-4 text-xs text-slate-500">
                      {new Date(mov.date).toLocaleDateString('es-AR')}
                    </td>
                    <td className="p-4 text-xs text-slate-600 dark:text-slate-400">
                      {mov.user}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleOpenDetailModal(mov)}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-lg flex items-center gap-1 transition-colors ml-auto"
                        title="Ver Detalle"
                      >
                        <Eye className="h-3.5 w-3.5" /> Ver detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. MODAL DETALLE DE MOVIMIENTO */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary-600" />
                  {detailItem.type === 'PED' ? 'Pedido Interno' : 'Traspaso Físico'} #{detailItem.number}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fecha: {new Date(detailItem.date).toLocaleDateString('es-AR')} | Responsable: {detailItem.user}
                </p>
              </div>
              <button
                onClick={() => setDetailItem(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Origen
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {detailItem.origin}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Destino
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {detailItem.destination}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Estado
                </span>
                <div className="mt-1">{getStatusBadge(detailItem.status)}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Tipo Movimiento
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {detailItem.type === 'PED' ? 'Solicitud (PED)' : 'Traspaso Físico (TRA)'}
                </span>
              </div>
            </div>

            {detailItem.notes && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-400">Notas: </span>
                <span className="text-slate-800 dark:text-slate-200">{detailItem.notes}</span>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                Productos en el Documento
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                {detailItem.items.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between bg-white dark:bg-slate-900">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{item.name}</div>
                      <div className="text-slate-400 text-[11px]">SKU: {item.sku}</div>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {item.qty} u.
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
