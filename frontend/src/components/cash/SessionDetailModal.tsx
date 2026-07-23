import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cashApi } from '../../services/cash.service';
import { Modal } from '../ui/Modal';
import { format, differenceInMinutes, addMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ArrowUpCircle, ArrowDownCircle, Banknote, CreditCard, Activity, 
  Wallet, DollarSign, TrendingDown, TrendingUp, AlertTriangle, 
  Printer, FileText, CheckCircle2, ChevronRight, XCircle, FileSpreadsheet, Search, Filter 
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../forms/Input';
import { Select } from '../forms/Select';

interface Props {
  sessionId: string;
  onClose: () => void;
}

export const SessionDetailModal: React.FC<Props> = ({ sessionId, onClose }) => {
  const { data: session, isLoading } = useQuery({
    queryKey: ['cash', 'history', sessionId],
    queryFn: () => cashApi.getHistoryById(sessionId),
  });

  const [movSearch, setMovSearch] = useState('');
  const [movFilter, setMovFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const formatCurrency = (val: number | string) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(val));

  const defaultTotals = {
    openingBalance: Number(session?.openingBalance || 0),
    cashTotal: 0,
    mercadoPagoTotal: 0,
    transferTotal: 0,
    debitCardTotal: 0,
    creditCardTotal: 0,
    manualIncomes: 0,
    manualExpenses: 0,
    expectedCashBalance: Number(session?.openingBalance || 0),
    grandTotal: Number(session?.openingBalance || 0),
  };

  const totals = session?.totals || defaultTotals;

  const expectedCash = totals.expectedCashBalance;
  const countedCash = session ? Number(session.closingBalance) : 0;
  const diff = session?.status === 'CLOSED' ? countedCash - expectedCash : 0;
  
  const totalVendido = totals.cashTotal + totals.mercadoPagoTotal + totals.transferTotal + totals.debitCardTotal + totals.creditCardTotal;
  const ventasDigitales = totals.mercadoPagoTotal + totals.transferTotal + totals.debitCardTotal + totals.creditCardTotal;

  const diffColor = diff === 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : Math.abs(diff) < 500 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200';
  const headerBadge = session?.status === 'OPEN' 
      ? 'bg-amber-100 text-amber-800 border-amber-300' 
      : diff === 0 
        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
        : 'bg-red-100 text-red-800 border-red-300';
        
  const headerIcon = session?.status === 'OPEN' ? <AlertTriangle className="w-4 h-4"/> : diff === 0 ? <CheckCircle2 className="w-4 h-4"/> : <XCircle className="w-4 h-4"/>;

  // Filtrado de la tabla
  const movements = session?.cashMovements || [];
  const filteredMovs = movements.filter((m: any) => {
     if (movFilter !== 'ALL') {
        if (movFilter === 'IN' && m.type !== 'IN') return false;
        if (movFilter === 'OUT' && m.type !== 'OUT') return false;
        if (movFilter === 'SALE' && m.referenceType !== 'SALE') return false;
        if (movFilter === 'MANUAL' && m.referenceType !== 'MANUAL') return false;
     }
     if (movSearch) {
        return m.reason?.toLowerCase().includes(movSearch.toLowerCase()) || 
               m.referenceType?.toLowerCase().includes(movSearch.toLowerCase());
     }
     return true;
  });

  const paginatedMovs = filteredMovs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredMovs.length / itemsPerPage);

  const renderPercentage = (value: number, total: number) => {
     if (total === 0) return '0%';
     return ((value / total) * 100).toFixed(1) + '%';
  };

  const getDuration = () => {
     if (!session) return '-';
     const end = session.closedAt ? new Date(session.closedAt) : new Date();
     const mins = differenceInMinutes(end, new Date(session.openedAt));
     const hours = Math.floor(mins / 60);
     const remMins = mins % 60;
     return `${hours}h ${remMins}m`;
  };

  const modalFooter = (
     <div className="flex justify-between items-center w-full">
        <div className="flex gap-2">
           <Button variant="outline" className="flex items-center gap-2"><Printer className="w-4 h-4"/>Imprimir Arqueo</Button>
           <Button variant="outline" className="flex items-center gap-2"><FileText className="w-4 h-4"/>PDF</Button>
           <Button variant="outline" className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/>Excel</Button>
        </div>
        <Button variant="primary" onClick={onClose}>Cerrar Detalle</Button>
     </div>
  );

  return (
    <Modal isOpen={true} onClose={onClose} title="Auditoría Financiera - Detalle de Caja" size="full" footer={modalFooter}>
        {isLoading || !session ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mb-4"></div>
             Cargando información del ERP...
          </div>
        ) : (
          <div className="space-y-6 lg:space-y-8 bg-slate-50/50 dark:bg-slate-950/20 pb-10">
            
            {/* Header Profesional ERP */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4">
               <div>
                  <div className="flex items-center gap-3 mb-2">
                     <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        {session.cashRegister?.name}
                        <span className="text-sm font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                           {session.cashRegister?.code}
                        </span>
                     </h2>
                     <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border shadow-sm font-semibold text-xs md:text-sm uppercase tracking-wide ${headerBadge}`}>
                        {headerIcon}
                        {session.status === 'CLOSED' ? (diff === 0 ? 'Correcta' : 'Con Diferencia') : 'Operando'}
                     </div>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">ID Sesión: <span className="font-mono text-xs">{sessionId}</span></p>
               </div>

               <div className="flex flex-wrap gap-x-8 gap-y-3 md:justify-end text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex flex-col">
                     <span className="text-xs text-slate-400 uppercase font-semibold mb-0.5">Operador</span>
                     <span className="font-medium flex items-center gap-1.5"><div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">{session.openedBy?.name?.charAt(0)}</div>{session.openedBy?.name}</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-xs text-slate-400 uppercase font-semibold mb-0.5">Apertura</span>
                     <span className="font-medium">{format(new Date(session.openedAt), 'dd MMM yy - HH:mm', { locale: es })}</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-xs text-slate-400 uppercase font-semibold mb-0.5">Cierre</span>
                     <span className="font-medium">{session.status === 'CLOSED' ? format(new Date(session.closedAt), 'dd MMM yy - HH:mm', { locale: es }) : 'En Curso'}</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-xs text-slate-400 uppercase font-semibold mb-0.5">Duración</span>
                     <span className="font-medium">{getDuration()}</span>
                  </div>
               </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 hide-scrollbar overflow-x-auto pb-2">
               <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm min-w-[140px]">
                  <div className="flex justify-between items-start mb-2">
                     <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Wallet className="w-4 h-4"/></div>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mb-0.5 truncate">Saldo Inicial</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{formatCurrency(session.openingBalance)}</p>
               </div>
               
               <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm min-w-[140px] shadow-[inset_0_4px_0_theme(colors.indigo.500)]">
                  <div className="flex justify-between items-start mb-2">
                     <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><DollarSign className="w-4 h-4"/></div>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mb-0.5 truncate">Total Vendido</p>
                  <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400 truncate">{formatCurrency(totalVendido)}</p>
               </div>

               <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm min-w-[140px] shadow-[inset_0_4px_0_theme(colors.emerald.500)]">
                  <div className="flex justify-between items-start mb-2">
                     <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Banknote className="w-4 h-4"/></div>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mb-0.5 truncate">Total Efectivo</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 truncate">{formatCurrency(totals.cashTotal)}</p>
               </div>

               <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm min-w-[140px]">
                  <div className="flex justify-between items-start mb-2">
                     <div className="p-1.5 bg-cyan-50 text-cyan-600 rounded-lg"><CreditCard className="w-4 h-4"/></div>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mb-0.5 truncate">Ventas M. Digital</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{formatCurrency(ventasDigitales)}</p>
               </div>

               <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm min-w-[140px]">
                  <div className="flex justify-between items-start mb-2">
                     <div className="p-1.5 bg-green-50 text-green-600 rounded-lg"><TrendingUp className="w-4 h-4"/></div>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mb-0.5 truncate">Ingresos Misc.</p>
                  <p className="text-lg font-bold text-green-600 truncate">+{formatCurrency(totals.manualIncomes)}</p>
               </div>

               <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm min-w-[140px]">
                  <div className="flex justify-between items-start mb-2">
                     <div className="p-1.5 bg-red-50 text-red-600 rounded-lg"><TrendingDown className="w-4 h-4"/></div>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mb-0.5 truncate">Egresos / Dev.</p>
                  <p className="text-lg font-bold text-red-600 truncate">-{formatCurrency(totals.manualExpenses)}</p>
               </div>

               <div className="bg-slate-900 dark:bg-slate-800 border-none rounded-xl p-4 shadow-lg min-w-[140px] text-white overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><AlertTriangle className="w-16 h-16"/></div>
                  <div className="relative z-10">
                     <p className="text-xs text-slate-300 font-semibold mb-2 uppercase tracking-wide line-clamp-1">{session.status==='CLOSED'?'Diferencia Arqueo':'Diff. Proyectada'}</p>
                     <p className={`text-xl font-bold ${diff === 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                     </p>
                  </div>
               </div>
            </div>

            {/* Dos grandes bloques centrales */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               
               {/* 1. Resumen Financiero Físico */}
               <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                     <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Banknote className="w-5 h-5 text-emerald-500"/>
                        Arqueo de Efectivo Físico
                     </h3>
                  </div>
                  
                  <div className="p-6 flex-1 flex flex-col justify-between">
                     <div className="space-y-4 text-sm mb-6">
                        <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 group hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                           <span className="text-slate-500 font-medium flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"/> Saldo Inicial Declarado</span>
                           <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(session.openingBalance)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 group hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                           <span className="text-slate-500 font-medium flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> Ventas Cobradas en Efectivo</span>
                           <span className="font-semibold text-emerald-600">+{formatCurrency(totals.cashTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 group hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                           <span className="text-slate-500 font-medium flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500"/> Ajustes de Ingreso Físico</span>
                           <span className="font-semibold text-emerald-600">+{formatCurrency(totals.manualIncomes)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 group hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                           <span className="text-slate-500 font-medium flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"/> Retiros y Gastos Varios</span>
                           <span className="font-semibold text-red-600">-{formatCurrency(totals.manualExpenses)}</span>
                        </div>
                     </div>

                     <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-5 border border-slate-200 dark:border-slate-800">
                        <div className="space-y-3">
                           <div className="flex justify-between items-center">
                              <span className="uppercase text-xs font-bold tracking-wider text-slate-500">Saldo Físico Esperado</span>
                              <span className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-none">{formatCurrency(expectedCash)}</span>
                           </div>
                           
                           {session.status === 'CLOSED' && (
                              <>
                                 <div className="flex justify-between items-center">
                                    <span className="uppercase text-xs font-bold tracking-wider text-slate-500">Saldo Rendido (Contado)</span>
                                    <span className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-none">{formatCurrency(countedCash)}</span>
                                 </div>
                                 <div className={`mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center ${diffColor.split(' ')[0]}`}>
                                    <span className="uppercase text-xs font-bold tracking-wider flex items-center gap-1.5">
                                       {diff === 0 ? <CheckCircle2 className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4"/>} 
                                       Diferencia Registrada
                                    </span>
                                    <span className="text-2xl font-black leading-none">{diff > 0 ? '+' : ''}{formatCurrency(diff)}</span>
                                 </div>
                              </>
                           )}
                        </div>
                     </div>
                  </div>
               </div>

               {/* 2. Visualización Gráfica y Medios de Pago */}
               <div className="flex flex-col gap-6">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex-1">
                     <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                           <CreditCard className="w-5 h-5 text-indigo-500"/>
                           Desglose por Medio de Pago
                        </h3>
                     </div>
                     <div className="p-6">
                        {/* Barras de Progreso por Medio de Pago */}
                        <div className="space-y-4">
                           <div>
                              <div className="flex justify-between text-sm mb-1.5">
                                 <span className="font-medium flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-sm"/>Efectivo Físico</span>
                                 <div className="text-right">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 mr-2">{formatCurrency(totals.cashTotal)}</span>
                                    <span className="text-xs text-slate-500">{renderPercentage(totals.cashTotal, totalVendido)}</span>
                                 </div>
                              </div>
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: renderPercentage(totals.cashTotal, totalVendido) }} />
                              </div>
                           </div>

                           <div>
                              <div className="flex justify-between text-sm mb-1.5">
                                 <span className="font-medium flex items-center gap-2"><div className="w-3 h-3 bg-sky-500 rounded-sm"/>Mercado Pago</span>
                                 <div className="text-right">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 mr-2">{formatCurrency(totals.mercadoPagoTotal)}</span>
                                    <span className="text-xs text-slate-500">{renderPercentage(totals.mercadoPagoTotal, totalVendido)}</span>
                                 </div>
                              </div>
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-sky-500 transition-all duration-1000" style={{ width: renderPercentage(totals.mercadoPagoTotal, totalVendido) }} />
                              </div>
                           </div>

                           <div>
                              <div className="flex justify-between text-sm mb-1.5">
                                 <span className="font-medium flex items-center gap-2"><div className="w-3 h-3 bg-indigo-500 rounded-sm"/>Transferencias Bco.</span>
                                 <div className="text-right">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 mr-2">{formatCurrency(totals.transferTotal)}</span>
                                    <span className="text-xs text-slate-500">{renderPercentage(totals.transferTotal, totalVendido)}</span>
                                 </div>
                              </div>
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: renderPercentage(totals.transferTotal, totalVendido) }} />
                              </div>
                           </div>

                           <div>
                              <div className="flex justify-between text-sm mb-1.5">
                                 <span className="font-medium flex items-center gap-2"><div className="w-3 h-3 bg-purple-500 rounded-sm"/>Tarjeta Débito</span>
                                 <div className="text-right">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 mr-2">{formatCurrency(totals.debitCardTotal)}</span>
                                    <span className="text-xs text-slate-500">{renderPercentage(totals.debitCardTotal, totalVendido)}</span>
                                 </div>
                              </div>
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-purple-500 transition-all duration-1000" style={{ width: renderPercentage(totals.debitCardTotal, totalVendido) }} />
                              </div>
                           </div>

                           <div>
                              <div className="flex justify-between text-sm mb-1.5">
                                 <span className="font-medium flex items-center gap-2"><div className="w-3 h-3 bg-amber-500 rounded-sm"/>Tarjeta Crédito</span>
                                 <div className="text-right">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 mr-2">{formatCurrency(totals.creditCardTotal)}</span>
                                    <span className="text-xs text-slate-500">{renderPercentage(totals.creditCardTotal, totalVendido)}</span>
                                 </div>
                              </div>
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: renderPercentage(totals.creditCardTotal, totalVendido) }} />
                              </div>
                           </div>
                        </div>

                        <div className="mt-8 grid grid-cols-2 gap-4">
                           <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center">
                              <span className="text-3xl font-black text-slate-800 dark:text-white leading-none">{session.sales?.length || 0}</span>
                              <span className="text-xs text-slate-500 uppercase mt-2 font-semibold">Tickets / Ventas Emitidas</span>
                           </div>
                           <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center">
                              <span className="text-3xl font-black text-slate-800 dark:text-white leading-none">
                                 {session.sales?.length > 0 ? formatCurrency(totalVendido / session.sales.length) : '$0'}
                              </span>
                              <span className="text-xs text-slate-500 uppercase mt-2 font-semibold">Ticket Promedio Global</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

            </div>

            {/* Historia Transaccional Larga */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
               <div className="p-4 lg:px-6 lg:py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 whitespace-nowrap">
                    <Activity className="w-5 h-5 text-slate-500"/>
                    Libro Diario de Movimientos
                  </h3>
                  
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                     <div className="relative flex-1 sm:w-64">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/>
                        <input 
                           type="text" 
                           placeholder="Buscar por referencia o detalle..." 
                           className="w-full text-sm pl-9 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                           value={movSearch}
                           onChange={(e) => {setMovSearch(e.target.value); setCurrentPage(1);}}
                        />
                     </div>
                     <div className="relative">
                        <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/>
                        <Select 
                           value={movFilter}
                           onChange={(e: any) => {setMovFilter(e.target.value); setCurrentPage(1);}}
                        >
                           <option value="ALL">Tipos (Todos)</option>
                           <option value="IN">Ingresos</option>
                           <option value="OUT">Egresos Mermas</option>
                           <option value="SALE">Ventas</option>
                           <option value="MANUAL">Ajustes Manuales</option>
                        </Select>
                     </div>
                  </div>
               </div>
               
               <div className="overflow-x-auto min-h-[300px]">
                 <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                   <thead className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-xs uppercase font-bold text-slate-500 dark:text-slate-400">
                      <tr>
                         <th className="px-6 py-4">Hora</th>
                         <th className="px-6 py-4">Tipo Origen</th>
                         <th className="px-6 py-4">Detalle / Referencia</th>
                         <th className="px-6 py-4">Autor/Usuario</th>
                         <th className="px-6 py-4 text-right">Importe Neto</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {paginatedMovs.map((mov: any) => {
                         let badge = null;
                         if (mov.referenceType === 'ACCOUNT_RECEIVABLE_PAYMENT' || mov.referenceType === 'ACCOUNT_PAYMENT' || mov.reason?.includes('Cuenta Corriente')) {
                           badge = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-semibold"><Wallet className="w-3.5 h-3.5"/> Cobro Cta. Cte.</span>;
                         } else if (mov.referenceType === 'SALE') badge = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold"><Banknote className="w-3.5 h-3.5"/> Facturación</span>;
                         else if (mov.referenceType === 'MANUAL') badge = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold"><FileText className="w-3.5 h-3.5"/> Ajuste de Caja</span>;
                         else if (mov.referenceType === 'OPENING_BALANCE') badge = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold"><Activity className="w-3.5 h-3.5"/> Apertura</span>;
                         else if (mov.referenceType === 'SALE_REFUND') badge = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold"><ArrowDownCircle className="w-3.5 h-3.5"/> Anulación</span>;
                         else badge = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">Otro</span>;

                         return (
                            <tr key={mov.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                               <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-800 dark:text-slate-300">
                                  {format(new Date(mov.createdAt), 'HH:mm')}
                               </td>
                               <td className="px-6 py-4">{badge}</td>
                               <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                     <span className="text-slate-900 dark:text-slate-100 font-medium">{mov.reason}</span>
                                     {(mov.paymentMethod || mov.paymentMethodRel) && (
                                        <span className="text-xs text-slate-500 font-medium">
                                          M. de Pago: {typeof mov.paymentMethod === 'string' ? mov.paymentMethod : mov.paymentMethod?.name || mov.paymentMethodRel?.name || 'EFECTIVO'}
                                        </span>
                                     )}
                                  </div>
                               </td>
                               <td className="px-6 py-4 flex items-center gap-2">
                                  <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                     {mov.createdByUser?.name?.charAt(0)}
                                  </div>
                                  <span className="truncate max-w-[120px]" title={mov.createdByUser?.name}>{mov.createdByUser?.name}</span>
                               </td>
                               <td className="px-6 py-4 text-right">
                                  <span className={`font-bold tabular-nums text-base ${mov.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                     {mov.type === 'IN' ? '+' : '-'}{formatCurrency(mov.amount)}
                                  </span>
                               </td>
                            </tr>
                         );
                      })}
                      {filteredMovs.length === 0 && (
                         <tr>
                            <td colSpan={5} className="px-6 py-16 text-center">
                               <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
                               <p className="text-slate-500 font-medium text-lg">No hay transacciones registradas</p>
                               <p className="text-slate-400 text-sm">Prueba ajustando los filtros de búsqueda.</p>
                            </td>
                         </tr>
                      )}
                   </tbody>
                 </table>
               </div>
               
               {/* Paginación */}
               {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                     <span className="text-sm text-slate-500">Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredMovs.length)} de {filteredMovs.length} actas pivotales</span>
                     <div className="flex gap-2 isolate">
                        <Button variant="outline" size="sm" className="rounded-r-none" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button>
                        <Button variant="outline" size="sm" className="rounded-l-none border-l-0" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Siguiente</Button>
                     </div>
                  </div>
               )}
            </div>

          </div>
        )}
    </Modal>
  );
};
