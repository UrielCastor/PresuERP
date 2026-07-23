import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cashApi } from '../services/cash.service';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/forms/Input';
import { Select } from '../components/forms/Select';
import { ArrowUpCircle, ArrowDownCircle, AlertTriangle, Eye, CreditCard, Banknote, History, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SessionDetailModal } from '../components/cash/SessionDetailModal';

export const Cash: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'operacion' | 'historial'>('operacion');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: activeSession, isLoading: loadingSession } = useQuery({
    queryKey: ['cash', 'active'],
    queryFn: cashApi.getActiveSession,
  });

  const { data: registers } = useQuery({
    queryKey: ['cash', 'registers'],
    queryFn: cashApi.getRegisters,
    enabled: !activeSession,
  });

  const { data: history } = useQuery({
    queryKey: ['cash', 'history'],
    queryFn: cashApi.getHistory,
    enabled: activeTab === 'historial',
  });

  const [openRegisterId, setOpenRegisterId] = useState('');
  const [openBalance, setOpenBalance] = useState('');
  const [openNotes, setOpenNotes] = useState('');

  const [movType, setMovType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [movAmount, setMovAmount] = useState('');
  const [movConcept, setMovConcept] = useState('');

  const [countedBalance, setCountedBalance] = useState('');

  const openMutation = useMutation({
    mutationFn: cashApi.openSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setOpenBalance(''); setOpenNotes('');
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Error al abrir caja')
  });

  const closeMutation = useMutation({
    mutationFn: cashApi.closeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCountedBalance('');
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Error al cerrar caja')
  });

  const movementMutation = useMutation({
    mutationFn: cashApi.registerMovement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setMovAmount(''); setMovConcept('');
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Error al registrar movimiento')
  });

  const formatCurrency = (val: number | string) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(val));

  console.log('[CASH QUERY]', activeSession);
  console.log('[CASH TOTALS]', activeSession?.totals);

  const defaultTotals = {
    openingBalance: Number(activeSession?.openingBalance || 0),
    cashTotal: 0,
    mercadoPagoTotal: 0,
    transferTotal: 0,
    debitCardTotal: 0,
    creditCardTotal: 0,
    manualIncomes: 0,
    manualExpenses: 0,
    expectedCashBalance: Number(activeSession?.openingBalance || 0),
    grandTotal: Number(activeSession?.openingBalance || 0),
  };

  const totals = activeSession?.totals || defaultTotals;

  const expectedCash = totals.expectedCashBalance;
  const totalVendido = totals.cashTotal + totals.mercadoPagoTotal + totals.transferTotal + totals.debitCardTotal + totals.creditCardTotal;
  
  const filteredHistory = React.useMemo(() => {
    if (!history) return [];
    return history.filter((s: any) => 
      s.openedBy?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.cashRegister?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [history, searchTerm]);

  const paginatedHistory = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

  console.log('[RENDER TOTALS]', totals);

  if (loadingSession) return <div className="p-8 text-center">Cargando...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Auditoría y Gestión de Caja" subtitle="Libro diario y arqueo del turno actual" />

      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-full max-w-sm mb-6 dark:bg-slate-800">
        <button
          onClick={() => setActiveTab('operacion')}
          className={`flex-1 text-sm font-medium py-2 px-3 rounded-md transition-all ${
            activeTab === 'operacion' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Operación Actual
        </button>
        <button
          onClick={() => setActiveTab('historial')}
          className={`flex-1 text-sm font-medium py-2 px-3 rounded-md transition-all ${
            activeTab === 'historial' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Historial Completo
        </button>
      </div>

      {activeTab === 'operacion' && (
        !activeSession ? (
          <Card className="max-w-xl mx-auto mt-10 shadow-sm border-t-4 border-t-amber-500">
            <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Caja Cerrada
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-slate-600 mb-4">Debes abrir una caja para comenzar a registrar movimientos o ventas.</p>
              <Select
                  label="Caja a Operar"
                  value={openRegisterId}
                  onChange={(e: any) => setOpenRegisterId(e.target.value)}
                >
                  <option value="">Seleccione una caja...</option>
                  {registers?.map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                  ))}
                </Select>
              <Input label="Saldo Inicial (Efectivo en caja)" type="number" value={openBalance} onChange={(e: any) => setOpenBalance(e.target.value)} placeholder="0.00" />
              <Input label="Observaciones (Opcional)" type="text" value={openNotes} onChange={(e: any) => setOpenNotes(e.target.value)} placeholder="Ej. Cambio de billetes" />
              <Button variant="primary" className="w-full mt-4" onClick={() => openMutation.mutate({ cashRegisterId: openRegisterId, openingBalance: Number(openBalance), notes: openNotes })} disabled={!openRegisterId || openBalance === '' || openMutation.isPending}>
                Abrir Caja
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Panel Principal Dashboard */}
            <div className="xl:col-span-2 space-y-6">
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                 <Card className="bg-white dark:bg-slate-900 border-l-4 border-l-blue-500">
                    <CardContent className="p-3 md:p-4">
                       <p className="text-xs md:text-sm font-medium text-slate-500">Saldo Inicial</p>
                       <p className="text-lg md:text-2xl font-bold mt-1 text-slate-800 dark:text-white flex items-center justify-between">
                          {formatCurrency(activeSession.openingBalance)}
                          <Wallet className="w-5 h-5 text-blue-200" />
                       </p>
                    </CardContent>
                 </Card>
                 <Card className="bg-white dark:bg-slate-900 border-l-4 border-l-indigo-500">
                    <CardContent className="p-3 md:p-4">
                       <p className="text-xs md:text-sm font-medium text-slate-500">Total Vendido</p>
                       <p className="text-lg md:text-2xl font-bold mt-1 text-slate-800 dark:text-white flex items-center justify-between">
                          {formatCurrency(totalVendido)}
                          <CreditCard className="w-5 h-5 text-indigo-200" />
                       </p>
                    </CardContent>
                 </Card>
                 <Card className="bg-white dark:bg-slate-900 border-l-4 border-l-emerald-500">
                    <CardContent className="p-3 md:p-4">
                       <p className="text-xs md:text-sm font-medium text-slate-500">Ingresos Efectivo</p>
                       <p className="text-lg md:text-2xl font-bold mt-1 text-emerald-600 flex items-center justify-between">
                          +{formatCurrency(totals.cashTotal + totals.manualIncomes)}
                          <ArrowUpCircle className="w-5 h-5 text-emerald-200" />
                       </p>
                    </CardContent>
                 </Card>
                 <Card className="bg-slate-900 text-white border-l-4 border-l-amber-500 shadow-md">
                    <CardContent className="p-3 md:p-4">
                       <p className="text-xs md:text-sm font-medium text-slate-300">Efectivo Esperado</p>
                       <p className="text-lg md:text-2xl font-bold mt-1 text-white flex items-center justify-between">
                          {formatCurrency(expectedCash)}
                          <Banknote className="w-5 h-5 text-amber-500/50" />
                       </p>
                    </CardContent>
                 </Card>
              </div>

              {/* Movimientos Recientes */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 border-dashed">
                  <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4"/> Línea de Tiempo (Actividad Reciente)</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 max-h-[500px] overflow-y-auto pr-2">
                  {activeSession.cashMovements?.length === 0 ? (
                    <p className="text-center text-sm text-slate-500 py-8">Auditoría: No hay operaciones registradas aún en este turno.</p>
                  ) : (
                    <div className="space-y-0 relative before:absolute before:inset-0 before:ml-[1.2rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-800 before:to-transparent">
                      {activeSession.cashMovements?.map((mov: any, idx: number) => (
                        <div key={mov.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active py-2">
                           {/* Icon */}
                           <div className={`flex items-center justify-center w-6 h-6 rounded-full border-4 border-white dark:border-gray-950 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ml-2 md:ml-0 z-10 ${mov.type === 'IN' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                             {mov.type === 'IN' ? <ArrowUpCircle className="w-4 h-4 text-white"/> : <ArrowDownCircle className="w-4 h-4 text-white"/>}
                           </div>
                           
                           {/* Card Component */}
                           <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1.5rem)] p-3 rounded bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm ml-4 md:ml-0">
                              <div className="flex items-center justify-between mb-1">
                                <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                                     {mov.referenceType === 'ACCOUNT_RECEIVABLE_PAYMENT' || mov.referenceType === 'ACCOUNT_PAYMENT' || mov.reason?.includes('Cuenta Corriente')
                                       ? 'Cobro Cuenta Corriente'
                                       : mov.referenceType === 'SALE'
                                       ? 'Venta'
                                       : mov.referenceType === 'MANUAL'
                                       ? 'Ajuste Manual'
                                       : mov.referenceType === 'OPENING_BALANCE'
                                       ? 'Apertura de Caja'
                                       : 'Movimiento'}
                                  </div>
                                 <time className="text-xs text-slate-500">{format(new Date(mov.createdAt), 'HH:mm - dd MMM', { locale: es })}</time>
                              </div>
                              <div className="text-slate-600 dark:text-slate-400 text-xs mb-2 break-all">{mov.reason}</div>
                              <div className={`font-bold text-sm ${mov.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                 {mov.type === 'IN' ? '+' : '-'}{formatCurrency(mov.amount)}
                              </div>
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar Actions */}
            <div className="space-y-6">
              
              <Card className="border-t-4 border-t-indigo-500 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-indigo-950 dark:text-indigo-400">Registrar Movimiento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={movType === 'INCOME' ? 'primary' : 'outline'} size="sm" onClick={() => setMovType('INCOME')}>Ingreso (+)</Button>
                    <Button variant={movType === 'EXPENSE' ? 'danger' : 'outline'} size="sm" onClick={() => setMovType('EXPENSE')}>Retiro (-)</Button>
                  </div>
                  <Input label="Monto" type="number" value={movAmount} onChange={(e: any) => setMovAmount(e.target.value)} placeholder="0.00" />
                  <Input label="Razón" value={movConcept} onChange={(e: any) => setMovConcept(e.target.value)} placeholder="Ej. Viáticos" />
                  <Button variant="outline" className="w-full mt-2" onClick={() => movementMutation.mutate({ type: movType, amount: Number(movAmount), concept: movConcept })} disabled={!movAmount || !movConcept || movementMutation.isPending}>
                    Guardar
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 shadow-sm">
                <CardHeader className="pb-2 border-b border-amber-200/50 dark:border-amber-900/50">
                  <CardTitle className="text-amber-800 dark:text-amber-400 text-base flex items-center justify-between">
                     Cierre Financiero (Z)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <p className="text-xs text-amber-700 dark:text-amber-500 font-medium">Contabiliza el dinero físico en caja y presiona Cerrar Turno.</p>
                  
                  <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3.5 space-y-2 text-xs shadow-sm">
                    <p className="font-bold text-slate-700 dark:text-slate-200 text-xs uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-2">
                      Ventas por medio de pago
                    </p>

                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span>💵 Efectivo:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{formatCurrency(totals.cashTotal)}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span>🏦 Transferencia:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{formatCurrency(totals.transferTotal)}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span>💙 Mercado Pago:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{formatCurrency(totals.mercadoPagoTotal)}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span>💳 Débito:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{formatCurrency(totals.debitCardTotal)}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span>💳 Crédito:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{formatCurrency(totals.creditCardTotal)}</span>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-2 space-y-1">
                      <div className="flex justify-between text-slate-500">
                        <span>Fondo Inicial:</span>
                        <span className="font-mono font-semibold">{formatCurrency(totals.openingBalance)}</span>
                      </div>
                      {totals.manualIncomes > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Ajustes (+):</span>
                          <span className="font-mono font-semibold">+{formatCurrency(totals.manualIncomes)}</span>
                        </div>
                      )}
                      {totals.manualExpenses > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Retiros (-):</span>
                          <span className="font-mono font-semibold">-{formatCurrency(totals.manualExpenses)}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t-2 border-slate-200 dark:border-slate-700 mt-2 pt-2 flex justify-between font-bold text-slate-900 dark:text-white text-sm">
                      <span>Efectivo Físico Esperado:</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">{formatCurrency(totals.expectedCashBalance)}</span>
                    </div>
                  </div>

                  <Input label="Efectivo Contado (Real)" type="number" value={countedBalance} onChange={(e: any) => setCountedBalance(e.target.value)} placeholder="0.00" />
                  
                  {countedBalance !== '' && (
                    <div className={`p-3 rounded-lg border-2 ${Number(countedBalance) - expectedCash === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : Math.abs(Number(countedBalance) - expectedCash) < 500 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                       <div className="flex justify-between text-sm font-bold">
                          <span>Diferencia</span>
                          <span>
                             {Number(countedBalance) - expectedCash > 0 ? '+' : ''}{formatCurrency(Number(countedBalance) - expectedCash)}
                          </span>
                       </div>
                    </div>
                  )}

                  <Button variant="danger" className="w-full font-bold shadow" onClick={() => { if (window.confirm('¿Confirmas el arqueo y cierre definitivo de esta sesión?')) closeMutation.mutate({ countedBalance: Number(countedBalance) }) }} disabled={countedBalance === '' || closeMutation.isPending}>
                    Confirmar Cierre de Caja
                  </Button>
                </CardContent>
              </Card>

            </div>
          </div>
        )
      )}

      {activeTab === 'historial' && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4">
             <CardTitle>Historial y Auditoría de Arqueos</CardTitle>
             <Input 
                placeholder="Buscar por operador o caja..." 
                value={searchTerm}
                onChange={(e: any) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full sm:w-64"
             />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400 border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-900 text-xs uppercase font-semibold text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-4">Fecha</th>
                    <th className="px-4 py-4">Caja</th>
                    <th className="px-4 py-4">Operador</th>
                    <th className="px-4 py-4">Inicial</th>
                    <th className="px-4 py-4">Total Vendido</th>
                    <th className="px-4 py-4">Dif. Arqueo</th>
                    <th className="px-4 py-4">Estado</th>
                    <th className="px-4 py-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {paginatedHistory.map((session: any) => (
                    <tr key={session.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {format(new Date(session.openedAt), 'dd MMM yyyy, HH:mm', { locale: es })}
                      </td>
                      <td className="px-4 py-3">{session.cashRegister?.code}</td>
                      <td className="px-4 py-3">{session.openedBy?.name}</td>
                      <td className="px-4 py-3">{formatCurrency(session.openingBalance)}</td>
                      <td className="px-4 py-3">{formatCurrency(session.cashTransactionsTotal)}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${Number(session.closingDifference) === 0 ? 'text-emerald-500' : Number(session.closingDifference) > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                          {session.status === 'CLOSED' ? formatCurrency(session.closingDifference) : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {session.status === 'OPEN' ? (
                          <span className="inline-flex rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-400">ABIERTA</span>
                        ) : (
                          <span className="inline-flex rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-300">CERRADA</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button variant="outline" size="sm" onClick={() => setSelectedSessionId(session.id)}>
                           <Eye className="w-4 h-4 mr-1 lg:mr-2"/><span className="hidden lg:inline">Ver Detalle</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-500">No se encontraron sesiones de caja.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
               <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-sm text-slate-500">Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredHistory.length)} de {filteredHistory.length}</span>
                  <div className="flex gap-2">
                     <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button>
                     <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Siguiente</Button>
                  </div>
               </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedSessionId && (
        <SessionDetailModal sessionId={selectedSessionId} onClose={() => setSelectedSessionId(null)} />
      )}

    </div>
  );
};
