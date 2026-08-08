import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { saleApi } from '../../services/sale.service';
import { warehouseApi } from '../../services/warehouse.service';
import { getCustomers } from '../../services/customer.service';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { SaleReturnDetailModal } from '../../components/sales/SaleReturnDetailModal';
import { RotateCcw, Search, Calendar, Eye, Filter, Building, User, FileText, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export const SaleReturnList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Queries
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseApi.list(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customersList'],
    queryFn: () => getCustomers().then((res) => res.data || res),
  });

  const { data: returnsList = [], isLoading, refetch } = useQuery({
    queryKey: ['saleReturnsList', startDate, endDate, warehouseFilter, customerFilter],
    queryFn: () =>
      saleApi.getAllReturns({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        warehouseId: warehouseFilter || undefined,
        customerId: customerFilter || undefined,
      }),
  });

  // Filtered by local search term (code, sale doc, customer name, user name)
  const filteredReturns = (returnsList || []).filter((ret: any) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;

    const code = String(ret.refundCode || ret.refundNumber || '').toLowerCase();
    const saleNum = String(ret.sale?.documentNumber || '').toLowerCase();
    const customerName = (ret.sale?.customer?.name || 'consumidor final').toLowerCase();
    const userName = (ret.createdBy?.name || '').toLowerCase();
    const reason = (ret.reason || '').toLowerCase();

    return (
      code.includes(term) ||
      saleNum.includes(term) ||
      customerName.includes(term) ||
      userName.includes(term) ||
      reason.includes(term)
    );
  });

  const totalRefundedSum = filteredReturns.reduce(
    (acc: number, item: any) => acc + Number(item.totalAmount || 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Top Banner & Stats */}
      <div className="bg-slate-900 text-white dark:bg-slate-950 p-4.5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight text-white">
              Historial de Devoluciones
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Consulta y audita todas las devoluciones procesadas con trazabilidad de stock y caja.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-4">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Total Devoluciones
            </span>
            <span className="text-xl font-mono font-black text-emerald-400">
              $ {totalRefundedSum.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {filteredReturns.length} registros
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
        <div className="lg:col-span-2">
          <Input
            placeholder="Buscar por código DEV, # de venta, cliente o cajero..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={Search}
            className="py-1 text-xs"
          />
        </div>

        <Select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          className="py-1 text-xs"
        >
          <option value="">Depósito (Todos)</option>
          {warehouses.map((w: any) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>

        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="py-1 text-xs"
          placeholder="Desde"
        />

        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="py-1 text-xs"
          placeholder="Hasta"
        />
      </div>

      {/* Table of Returns */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
        ) : filteredReturns.length === 0 ? (
          <EmptyState
            title="No hay devoluciones registradas"
            description="Las devoluciones de ventas procesadas aparecerán listadas aquí con su respectiva trazabilidad."
            icon={RotateCcw}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-300 font-black uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3.5 py-3">Código</th>
                  <th className="px-3 py-3">Venta Original</th>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Depósito</th>
                  <th className="px-3 py-3 text-center">Ítems</th>
                  <th className="px-3.5 py-3 text-right">Monto Devuelto</th>
                  <th className="px-3 py-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredReturns.map((ret: any) => {
                  const code = ret.refundCode || `DEV-${String(ret.refundNumber).padStart(5, '0')}`;
                  const itemsCount = ret.items?.length || 0;

                  return (
                    <tr key={ret.id} className="hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                      <td className="px-3.5 py-2.5 font-mono font-black text-indigo-600 dark:text-indigo-400">
                        {code}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                        #{ret.sale?.documentType?.code}-{ret.sale?.documentNumber}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-500">
                        {format(new Date(ret.createdAt), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white truncate max-w-[160px]">
                        {ret.sale?.customer?.name || 'Consumidor Final'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                        {ret.warehouse?.name || 'Casa Central'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {itemsCount}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                        $ {Number(ret.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReturnId(ret.id);
                            setIsDetailModalOpen(true);
                          }}
                          className="h-7 px-2 text-[11px] font-bold"
                        >
                          <Eye className="w-3 h-3 mr-1 text-indigo-500" /> Detalle
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detalle Devolución */}
      {isDetailModalOpen && (
        <SaleReturnDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedReturnId(null);
          }}
          returnId={selectedReturnId}
        />
      )}
    </div>
  );
};
