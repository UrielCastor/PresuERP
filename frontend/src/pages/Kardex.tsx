import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ClipboardList,
  Search,
  SlidersHorizontal,
  Plus,
  ArrowUpDown,
  Download,
  Calendar,
  Layers,
  Truck,
  Warehouse,
  Package,
  User as UserIcon,
  X,
  Loader2,
  FileSpreadsheet,
  FileText,
  FileCode,
  Eye
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { stockMovementApi, StockMovement, StockMovementFilters } from '../services/stockMovement.service';
import { categoryApi } from '../services/category.service';
import { supplierApi } from '../services/supplier.service';
import { warehouseApi } from '../services/warehouse.service';
import { productApi } from '../services/product.service';
import { Button } from '../components/ui/Button';

// Zod schema for manual stock movements creation (ENTRY, EXIT, ADJUSTMENT, INVENTORY)
const createMovementSchema = z.object({
  warehouseId: z.string({ required_error: 'El almacén/depósito es obligatorio' }).uuid(),
  productId: z.string({ required_error: 'El producto es obligatorio' }).uuid(),
  movementType: z.enum(['ENTRY', 'EXIT', 'ADJUSTMENT', 'INVENTORY']),
  quantity: z.number({ required_error: 'La cantidad es obligatoria' }),
  unitCost: z.number().min(0, 'El costo no puede ser negativo').optional(),
  reason: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine((data) => {
  if (['ENTRY', 'EXIT'].includes(data.movementType) && data.quantity <= 0) {
    return false;
  }
  return true;
}, {
  message: 'Para ingresos y egresos la cantidad debe ser mayor a cero',
  path: ['quantity'],
});

type CreateMovementForm = z.infer<typeof createMovementSchema>;

export const Kardex: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const canExport = hasPermission('kardex:export');
  const canCreate = hasPermission('stocks:update');

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(50);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Queries for selectors
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryApi.list,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: supplierApi.list,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: warehouseApi.list,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-all'],
    queryFn: async () => {
      const res = await productApi.list();
      return res;
    },
  });

  // Main Kardex Query
  const filters: StockMovementFilters = {
    page: currentPage,
    limit,
    search: searchTerm || undefined,
    warehouseId: selectedWarehouse !== 'ALL' ? selectedWarehouse : undefined,
    movementType: selectedType !== 'ALL' ? selectedType : undefined,
    startDate: startDate ? new Date(startDate).toISOString() : undefined,
    endDate: endDate ? new Date(endDate + 'T23:59:59').toISOString() : undefined,
  };

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['kardex', filters],
    queryFn: () => stockMovementApi.list(filters),
    placeholderData: (prev) => prev,
  });

  const movements: StockMovement[] = data?.data || [];
  const pagination = data?.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 };

  // Create Movement Mutation
  const createMutation = useMutation({
    mutationFn: stockMovementApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kardex'] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      handleCloseCreateModal();
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.message || 'Error al registrar el movimiento.');
    },
  });

  // Form Setup
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateMovementForm>({
    resolver: zodResolver(createMovementSchema),
    defaultValues: {
      movementType: 'ENTRY',
      quantity: 0,
      unitCost: 0,
      reason: '',
      notes: '',
    },
  });

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
    setApiError(null);
    reset({
      movementType: 'ENTRY',
      quantity: 0,
      unitCost: 0,
      reason: '',
      notes: '',
    });
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setApiError(null);
    reset();
  };

  const onSubmitCreate = (data: CreateMovementForm) => {
    createMutation.mutate({
      warehouseId: data.warehouseId,
      productId: data.productId,
      movementType: data.movementType,
      quantity: Number(data.quantity),
      unitCost: data.unitCost ? Number(data.unitCost) : undefined,
      referenceType: 'MANUAL',
      reason: data.reason || undefined,
      notes: data.notes || undefined,
    });
  };

  // Export handlers
  const handleExportCSV = () => {
    if (!movements.length) return;
    const header = [
      'ID',
      'Fecha',
      'Producto',
      'SKU',
      'Código de Barras',
      'Depósito',
      'Tipo de Movimiento',
      'Cantidad',
      'Stock Anterior',
      'Stock Posterior',
      'Costo de Unidad',
      'Costo Total',
      'Referencia Nro',
      'Usuario',
      'Motivo',
    ];

    const rows = movements.map((m) => [
      m.id,
      new Date(m.createdAt).toLocaleString(),
      m.product?.name || '',
      m.product?.sku || '',
      m.product?.barcode || '',
      m.warehouse?.name || '',
      m.movementType,
      m.quantity,
      m.stockBefore,
      m.stockAfter,
      m.unitCost,
      m.totalCost,
      m.referenceNumber || '',
      m.user?.name || m.user?.email || '',
      m.reason || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [header.join(','), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kardex_inventario_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    if (!movements.length) return;
    let tableHtml = '<table border="1"><thead><tr>';
    const headers = [
      'Fecha',
      'Producto',
      'SKU',
      'Depósito',
      'Tipo',
      'Cantidad',
      'Stock Anterior',
      'Stock Posterior',
      'Costo Unit.',
      'Costo Total',
      'Documento',
      'Usuario',
      'Motivo',
    ];
    headers.forEach((h) => {
      tableHtml += `<th style="background-color: #4F46E5; color: white; font-weight: bold;">${h}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    movements.forEach((m) => {
      tableHtml += '<tr>';
      tableHtml += `<td>${new Date(m.createdAt).toLocaleString()}</td>`;
      tableHtml += `<td>${m.product?.name || ''}</td>`;
      tableHtml += `<td>${m.product?.sku || ''}</td>`;
      tableHtml += `<td>${m.warehouse?.name || ''}</td>`;
      tableHtml += `<td>${m.movementType}</td>`;
      tableHtml += `<td>${m.quantity}</td>`;
      tableHtml += `<td>${m.stockBefore}</td>`;
      tableHtml += `<td>${m.stockAfter}</td>`;
      tableHtml += `<td>${m.unitCost}</td>`;
      tableHtml += `<td>${m.totalCost}</td>`;
      tableHtml += `<td>${m.referenceNumber || ''}</td>`;
      tableHtml += `<td>${m.user?.name || m.user?.email || ''}</td>`;
      tableHtml += `<td>${m.reason || ''}</td>`;
      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';
    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kardex_inventario_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    // Generate clean printable view
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let content = `
      <html>
      <head>
        <title>Reporte de Kardex - PresuERP</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #333; }
          h1 { margin-bottom: 5px; }
          .subtitle { font-size: 14px; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f3f4f6; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .badge { padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9px; }
          .ENTRY { background: #dcfce7; color: #15803d; }
          .EXIT { background: #fee2e2; color: #b91c1c; }
          .ADJUSTMENT { background: #ffedd5; color: #c2410c; }
          .INVENTORY { background: #f3e8ff; color: #6b21a8; }
        </style>
      </head>
      <body>
        <h1>PresuERP - Reporte del Historial de Kardex</h1>
        <div class="subtitle">Generado el: ${new Date().toLocaleString()} | Filtrado por almacenes</div>
        <table>
          <thead>
            <tr>
              <th>Fecha/Hora</th>
              <th>Producto</th>
              <th>Depósito</th>
              <th>Tipo</th>
              <th>Cant.</th>
              <th>Stock Ant.</th>
              <th>Stock Post.</th>
              <th>Costo Unit.</th>
              <th>Costo Total</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
    `;

    movements.forEach((m) => {
      content += `
        <tr>
          <td>${new Date(m.createdAt).toLocaleString()}</td>
          <td>${m.product?.name} (${m.product?.sku || 'S/S'})</td>
          <td>${m.warehouse?.name}</td>
          <td><span class="badge ${m.movementType}">${m.movementType}</span></td>
          <td>${m.quantity}</td>
          <td>${m.stockBefore}</td>
          <td>${m.stockAfter}</td>
          <td>$${Number(m.unitCost).toFixed(2)}</td>
          <td>$${Number(m.totalCost).toFixed(2)}</td>
          <td>${m.reason || ''}</td>
        </tr>
      `;
    });

    content += `
          </tbody>
        </table>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  const getMovementTypeBadge = (type: string) => {
    switch (type) {
      case 'ENTRY':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-800/40">
            INGRESO
          </span>
        );
      case 'EXIT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-800/40">
            EGRESO
          </span>
        );
      case 'TRANSFER_IN':
      case 'TRANSFER_OUT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
            TRANSFERENCIA
          </span>
        );
      case 'ADJUSTMENT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
            AJUSTE
          </span>
        );
      case 'INVENTORY':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40">
            INVENTARIO
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary-500" />
            Historial de Kardex (Movimientos)
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Trazabilidad inmutable de entradas, salidas, ajustes e inventarios físicos de toda la empresa.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canExport && (
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 p-0.5">
              <button
                onClick={handleExportPDF}
                disabled={movements.length === 0}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-1.5 disabled:opacity-50"
                title="Exportar PDF"
              >
                <FileText className="h-4 w-4 text-red-500" />
                PDF
              </button>
              <button
                onClick={handleExportExcel}
                disabled={movements.length === 0}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-1.5 disabled:opacity-50"
                title="Exportar Excel"
              >
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                Excel
              </button>
              <button
                onClick={handleExportCSV}
                disabled={movements.length === 0}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-1.5 disabled:opacity-50"
                title="Exportar CSV"
              >
                <FileCode className="h-4 w-4 text-amber-500" />
                CSV
              </button>
            </div>
          )}
          {canCreate && (
            <Button onClick={handleOpenCreateModal} className="flex items-center gap-1">
              <Plus className="h-4 w-4" />
              Nuevo Movimiento
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por producto, SKU, motivo, notas..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-slate-350 dark:border-slate-800 rounded-lg bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
          </div>

          {/* Warehouse Selector */}
          <div className="flex items-center gap-2">
            <Warehouse className="h-4.5 w-4.5 text-slate-400" />
            <select
              value={selectedWarehouse}
              onChange={(e) => {
                setSelectedWarehouse(e.target.value);
                setCurrentPage(1);
              }}
              className="flex-1 px-3 py-2 border border-slate-350 dark:border-slate-800 rounded-lg bg-transparent text-sm text-slate-700 dark:text-slate-350 focus:outline-none"
            >
              <option value="ALL">Todos los Depósitos</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Movement Type */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4.5 w-4.5 text-slate-400" />
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              className="flex-1 px-3 py-2 border border-slate-350 dark:border-slate-800 rounded-lg bg-transparent text-sm text-slate-700 dark:text-slate-350 focus:outline-none"
            >
              <option value="ALL">Todos los Tipos</option>
              <option value="ENTRY">Ingresos (ENTRY)</option>
              <option value="EXIT">Egresos (EXIT)</option>
              <option value="ADJUSTMENT">Ajustes (ADJUSTMENT)</option>
              <option value="INVENTORY">Físicos (INVENTORY)</option>
              <option value="TRANSFER_IN">Traslados (+) (TRANSFER_IN)</option>
              <option value="TRANSFER_OUT">Traslados (-) (TRANSFER_OUT)</option>
            </select>
          </div>

          {/* Date from/to */}
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2 py-1.5 border border-slate-350 dark:border-slate-800 rounded-lg bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                title="Fecha desde"
              />
            </div>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2 py-1.5 border border-slate-350 dark:border-slate-800 rounded-lg bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                title="Fecha hasta"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main List */}
      {isLoading ? (
        <div className="min-h-[300px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      ) : movements.length === 0 ? (
        <div className="min-h-[300px] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
          <ClipboardList className="h-12 w-12 text-slate-400 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Sin movimientos de kardex</h3>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500 max-w-xs">
            Ninguna ocurrencia histórica de stock concuerda con las fechas o filtros seleccionados.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto font-sans">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fecha / Hora</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Producto / SKU</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Depósito</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Tipo</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Cant.</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Saldo Ant.</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Saldo Post.</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Costo Unit.</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Documento</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {movements.map((m) => {
                    const qty = Number(m.quantity);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-920/40 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-400">
                          {new Date(m.createdAt).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900 dark:text-white max-w-[200px] truncate" title={m.product?.name}>
                            {m.product?.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                            {m.product?.sku || 'S/S'}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="text-slate-700 dark:text-slate-300 font-medium inline-flex items-center gap-1">
                            <Warehouse className="h-3.5 w-3.5 text-slate-400" />
                            {m.warehouse?.name}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-center">
                          {getMovementTypeBadge(m.movementType)}
                        </td>
                        <td className={`px-5 py-3.5 text-right font-mono font-bold whitespace-nowrap ${
                          qty > 0 ? 'text-green-600 dark:text-green-450' : 'text-red-600 dark:text-red-450'
                        }`}>
                          {qty > 0 ? '+' : ''}
                          {qty.toLocaleString(undefined, { minimumFractionDigits: 3 })}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-550 dark:text-slate-400 whitespace-nowrap">
                          {Number(m.stockBefore).toLocaleString(undefined, { minimumFractionDigits: 3 })}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-900 dark:text-white whitespace-nowrap">
                          {Number(m.stockAfter).toLocaleString(undefined, { minimumFractionDigits: 3 })}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          ${Number(m.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                          {m.referenceNumber || 'Ajuste Manual'}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedMovement(m)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded transition-colors"
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-205 dark:border-slate-800 shadow-sm text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              Registros {movements.length} | Página {pagination.page} de {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isPlaceholderData}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={currentPage === pagination.totalPages || isPlaceholderData}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MOVEMENT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-250 dark:border-slate-800 shadow-2xl p-6 overflow-y-auto max-h-[92vh]">
            <button
              onClick={handleCloseCreateModal}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white pr-6 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary-500" />
              Registrar Movimiento Manual
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Afecta directamente el stock agregando una transacción inmutable en el Kardex.
            </p>

            <form onSubmit={handleSubmit(onSubmitCreate)} className="mt-5 space-y-4">
              {apiError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg text-sm text-red-650 dark:text-red-400 font-medium">
                  {apiError}
                </div>
              )}

              {/* Warehouse selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Depósito de Origen / Destino *
                </label>
                <select
                  {...register('warehouseId')}
                  className={`w-full px-3.5 py-2.5 bg-transparent border rounded-lg text-sm text-slate-800 dark:text-slate-205 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.warehouseId ? 'border-red-500' : 'border-slate-350 dark:border-slate-800'
                  }`}
                >
                  <option value="">-- Seleccionar Depósito --</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.status === 'ACTIVE' ? '' : '(Inactivo)'}
                    </option>
                  ))}
                </select>
                {errors.warehouseId && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{errors.warehouseId.message}</p>
                )}
              </div>

              {/* Product selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Producto del Catálogo *
                </label>
                <select
                  {...register('productId')}
                  className={`w-full px-3.5 py-2.5 bg-transparent border rounded-lg text-sm text-slate-800 dark:text-slate-210 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.productId ? 'border-red-500' : 'border-slate-350 dark:border-slate-800'
                  }`}
                >
                  <option value="">-- Seleccionar Producto --</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku || 'S/SKU'})
                    </option>
                  ))}
                </select>
                {errors.productId && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{errors.productId.message}</p>
                )}
              </div>

              {/* Movement Type & Cost details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Tipo de Movimiento *
                  </label>
                  <select
                    {...register('movementType')}
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-205 focus:outline-none"
                  >
                    <option value="ENTRY">INGRESO (ENTRY)</option>
                    <option value="EXIT">EGRESO (EXIT)</option>
                    <option value="ADJUSTMENT">AJUSTE (ADJUSTMENT)</option>
                    <option value="INVENTORY">RECUENTO (INVENTORY)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Cantidad Requerida *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    {...register('quantity', { valueAsNumber: true })}
                    placeholder="Ej: 10.00"
                    className={`w-full px-3.5 py-2.5 bg-transparent border rounded-lg text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      errors.quantity ? 'border-red-500' : 'border-slate-350 dark:border-slate-800'
                    }`}
                  />
                  {errors.quantity && (
                    <p className="mt-1 text-xs text-red-500 font-medium">{errors.quantity.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Costo Unitario ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register('unitCost', { valueAsNumber: true })}
                    placeholder="Por defecto costo del producto"
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Motivo / Descripción Corta *
                  </label>
                  <input
                    type="text"
                    {...register('reason')}
                    placeholder="Ej: Ajuste por rotura de pallet"
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Observaciones Extra
                </label>
                <textarea
                  {...register('notes')}
                  placeholder="Detalles complementarios u origen del lote..."
                  className="w-full px-3.5 py-2 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-950 dark:text-white focus:outline-none h-16 resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" variant="outline" onClick={handleCloseCreateModal} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registrando...
                    </div>
                  ) : (
                    'Grabar Movimiento'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-205 dark:border-slate-800 shadow-2xl p-6">
            <button
              onClick={() => setSelectedMovement(null)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary-500" />
              Detalle de Auditoría de Kardex
            </h2>

            <div className="space-y-3.5 text-sm">
              <div className="grid grid-cols-2 gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-xs text-slate-400 uppercase block font-semibold">Identificador ID</span>
                  <span className="font-mono text-xs text-slate-700 dark:text-slate-300 select-all font-semibold leading-relaxed break-all">
                    {selectedMovement.id}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 uppercase block font-semibold">Fecha y Hora</span>
                  <span className="text-slate-900 dark:text-white font-medium">
                    {new Date(selectedMovement.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-400 uppercase block font-semibold">Producto</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedMovement.product?.name}
                  </span>
                  <span className="text-xs text-slate-500 block font-mono">
                    SKU: {selectedMovement.product?.sku || 'S/S'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 uppercase block font-semibold">Depósito</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedMovement.warehouse?.name}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-150 dark:border-slate-800/60 text-center font-mono">
                <div>
                  <span className="text-[10px] text-slate-450 uppercase block font-bold leading-none mb-1">
                    Anterior
                  </span>
                  <span className="text-sm font-semibold text-slate-650 dark:text-slate-350">
                    {Number(selectedMovement.stockBefore).toFixed(3)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-455 uppercase block font-bold leading-none mb-1">
                    Movido
                  </span>
                  <span className={`text-sm font-bold ${
                    Number(selectedMovement.quantity) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600'
                  }`}>
                    {Number(selectedMovement.quantity) > 0 ? '+' : ''}
                    {Number(selectedMovement.quantity).toFixed(3)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-450 uppercase block font-bold leading-none mb-1">
                    Posterior
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {Number(selectedMovement.stockAfter).toFixed(3)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1.5">
                <div>
                  <span className="text-xs text-slate-440 uppercase block font-semibold">Costo Unitario</span>
                  <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                    ${Number(selectedMovement.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-440 uppercase block font-semibold">Costo Transacción</span>
                  <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                    ${Number(selectedMovement.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-440 uppercase block font-semibold">Registrado Por</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5 text-slate-450" />
                    {selectedMovement.user?.name || selectedMovement.user?.email || 'Usuario'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-440 uppercase block font-semibold">Documento Origen</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-205">
                    {selectedMovement.referenceNumber || 'S/Ref'} ({selectedMovement.referenceType || 'MANUAL'})
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-xs text-slate-400 uppercase block font-semibold">Motivo Reportado</span>
                <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">
                  {selectedMovement.reason || 'S/M (Sin motivo especificado)'}
                </p>
              </div>

              {selectedMovement.notes && (
                <div>
                  <span className="text-xs text-slate-400 uppercase block font-semibold">Observaciones</span>
                  <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-150 dark:border-slate-800/50">
                    {selectedMovement.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button onClick={() => setSelectedMovement(null)}>
                Entendido
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
