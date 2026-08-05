import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cashApi } from '../services/cash.service';
import { warehouseApi } from '../services/warehouse.service';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  Eye,
  CreditCard,
  Banknote,
  History,
  Wallet,
  Plus,
  Minus,
  Lock,
  Search,
  Building2,
  Clock,
  User,
  Receipt,
  Play,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SessionDetailModal } from '../components/cash/SessionDetailModal';
import { useAuth } from '../contexts/AuthContext';

export const Cash: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'cajas' | 'historial'>('cajas');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modales
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  // States para Apertura
  const [openWarehouseId, setOpenWarehouseId] = useState<string>('');
  const [openRegisterId, setOpenRegisterId] = useState<string>('');
  const [openBalance, setOpenBalance] = useState('');
  const [openNotes, setOpenNotes] = useState('');

  // States para Movimiento Manual
  const [movType, setMovType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [movAmount, setMovAmount] = useState('');
  const [movConcept, setMovConcept] = useState('');

  // State para Cierre Arqueo
  const [countedBalance, setCountedBalance] = useState('');

  // Session ID seleccionado para operar/ver detalle en modal
  const [activeDetailSessionId, setActiveDetailSessionId] = useState<string | null>(null);

  // Queries
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: warehouseApi.list,
  });

  const { data: registers = [], isLoading: loadingRegisters } = useQuery({
    queryKey: ['cash', 'registers'],
    queryFn: () => cashApi.getRegisters(),
  });

  const { data: activeSessionDetail, isLoading: loadingSessionDetail } = useQuery({
    queryKey: ['cash', 'session-detail', activeDetailSessionId],
    queryFn: () => cashApi.getHistoryById(activeDetailSessionId!),
    enabled: !!activeDetailSessionId,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['cash', 'history'],
    queryFn: () => cashApi.getHistory(),
    enabled: activeTab === 'historial',
  });

  // Mutaciones
  const openMutation = useMutation({
    mutationFn: cashApi.openSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setOpenBalance('');
      setOpenNotes('');
      setIsOpenModalOpen(false);
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Error al abrir caja'),
  });

  const closeMutation = useMutation({
    mutationFn: (payload: { countedBalance: number; notes?: string }) =>
      cashApi.closeSession({ ...payload, sessionId: activeDetailSessionId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCountedBalance('');
      setIsCloseModalOpen(false);
      setIsDetailModalOpen(false);
      setActiveDetailSessionId(null);
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Error al cerrar caja'),
  });

  const movementMutation = useMutation({
    mutationFn: (payload: { type: 'INCOME' | 'EXPENSE'; amount: number; concept: string; notes?: string }) =>
      cashApi.registerMovement({ ...payload, sessionId: activeDetailSessionId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setMovAmount('');
      setMovConcept('');
      setIsMovementModalOpen(false);
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Error al registrar movimiento'),
  });

  const formatCurrency = (val: number | string) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(val));

  // Filtrado de Cajas Registradoras
  const filteredRegisters = useMemo(() => {
    return registers.filter((r: any) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.warehouse?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [registers, searchTerm]);

  // Filtrado de Historial
  const filteredHistory = useMemo(() => {
    if (!history) return [];
    return history.filter(
      (s: any) =>
        s.openedBy?.name?.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        s.cashRegister?.name?.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        s.cashRegister?.code?.toLowerCase().includes(historySearchTerm.toLowerCase())
    );
  }, [history, historySearchTerm]);

  const paginatedHistory = useMemo(() => {
    return filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredHistory, currentPage]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

  // Cajas registradoras disponibles para el depósito seleccionado
  const availableRegistersForOpen = useMemo(() => {
    if (!openWarehouseId) return [];
    return registers.filter((r: any) => {
      const matchWh = r.warehouseId === openWarehouseId;
      const latestSession = r.sessions?.[0];
      const isClosed = !latestSession || latestSession.status === 'CLOSED';
      return matchWh && isClosed;
    });
  }, [registers, openWarehouseId]);

  // Totales de dominio provistos por la sesión detallada activa
  const totals = activeSessionDetail?.totals || {
    openingBalance: Number(activeSessionDetail?.openingBalance || 0),
    cashTotal: 0,
    mercadoPagoTotal: 0,
    transferTotal: 0,
    debitCardTotal: 0,
    creditCardTotal: 0,
    digitalTotal: 0,
    manualIncomes: 0,
    manualExpenses: 0,
    expectedCashBalance: Number(activeSessionDetail?.openingBalance || 0),
    totalVendido: 0,
    grandTotal: Number(activeSessionDetail?.openingBalance || 0),
  };

  const expectedCash = totals.expectedCashBalance;
  const digitalTotal = totals.digitalTotal;
  const totalVendido = totals.totalVendido;

  return (
    <div className="space-y-6">
      {/* 1. Header del Módulo */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Cajas Financieras
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Administración de cajas registradoras y sesiones de efectivo de la empresa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('cajas')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'cajas'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Cajas Activas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('historial')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'historial'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Historial Arqueos
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setOpenWarehouseId('');
              setOpenRegisterId('');
              setIsOpenModalOpen(true);
            }}
            className="font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Abrir Nueva Caja
          </Button>
        </div>
      </div>

      {/* 2. Listado de Cajas en Formato Grid de Tarjetas */}
      {activeTab === 'cajas' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="w-full sm:w-72">
              <Input
                placeholder="Buscar caja o depósito..."
                value={searchTerm}
                onChange={(e: any) => setSearchTerm(e.target.value)}
                leftIcon={Search}
              />
            </div>
            <div className="text-xs font-bold text-slate-500">
              Total: {filteredRegisters.length} cajas
            </div>
          </div>

          {loadingRegisters ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          ) : filteredRegisters.length === 0 ? (
            <EmptyState
              title="No se encontraron cajas registradoras"
              description="No hay cajas creadas o ninguna coincide con los filtros de búsqueda."
              icon={Wallet}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRegisters.map((reg: any) => {
                const latestSession = reg.sessions?.[0];
                const isOpen = latestSession?.status === 'OPEN';

                return (
                  <Card
                    key={reg.id}
                    className={`bg-white dark:bg-slate-900 border ${
                      isOpen
                        ? 'border-emerald-200 dark:border-emerald-900/60 shadow-emerald-50/50'
                        : 'border-slate-200 dark:border-slate-800 shadow-sm'
                    } rounded-2xl overflow-hidden hover:shadow-md transition-all`}
                  >
                    <CardHeader className="bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/80 p-4 flex flex-row justify-between items-center">
                      <div>
                        <h3 className="font-extrabold text-slate-900 dark:text-white text-sm tracking-tight flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-indigo-500 shrink-0" />
                          {reg.name}
                        </h3>
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          {reg.code}
                        </span>
                      </div>
                      <Badge status={isOpen ? 'open' : 'closed'}>
                        {isOpen ? '🟢 ABIERTA' : '🔴 CERRADA'}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="font-semibold">Depósito:</span>
                        <span>🏭 {reg.warehouse?.name || 'Sin depósito'}</span>
                      </div>

                      {isOpen ? (
                        <>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="font-semibold">Abierta por:</span>
                            <span>{latestSession.openedBy?.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span className="font-semibold">Apertura:</span>
                            <span>
                              {format(new Date(latestSession.openedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            <span className="font-semibold">Fondo inicial:</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(latestSession.openingBalance)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          {latestSession ? (
                            <>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-slate-400" />
                                <span className="font-semibold">Cerrada por:</span>
                                <span>{latestSession.closedBy?.name || latestSession.openedBy?.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" />
                                <span className="font-semibold">Cierre:</span>
                                <span>
                                  {format(new Date(latestSession.closedAt || latestSession.updatedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-slate-400" />
                                <span className="font-semibold">Saldo final:</span>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                  {formatCurrency(latestSession.closingBalance || 0)}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="text-slate-400 italic">Esta caja nunca ha sido abierta.</div>
                          )}
                        </>
                      )}

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                        {isOpen ? (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              className="flex-1 font-bold"
                              onClick={() => {
                                setActiveDetailSessionId(latestSession.id);
                                setIsDetailModalOpen(true);
                              }}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              className="flex-1 font-bold"
                              onClick={() => {
                                setActiveDetailSessionId(latestSession.id);
                                setCountedBalance('');
                                setIsCloseModalOpen(true);
                              }}
                            >
                              <Lock className="w-3.5 h-3.5 mr-1" /> Cerrar Caja
                            </Button>
                          </>
                        ) : (
                          <>
                            {latestSession && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 font-bold"
                                onClick={() => setSelectedSessionId(latestSession.id)}
                              >
                                <History className="w-3.5 h-3.5 mr-1" /> Ver Historial
                              </Button>
                            )}
                            <Button
                              variant="success"
                              size="sm"
                              className="flex-1 font-bold"
                              onClick={() => {
                                setOpenWarehouseId(reg.warehouseId);
                                setOpenRegisterId(reg.id);
                                setIsOpenModalOpen(true);
                              }}
                            >
                              <Play className="w-3.5 h-3.5 mr-1" /> Abrir Turno
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Pestaña HISTORIAL DE ARQUEOS */}
      {activeTab === 'historial' && (
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                Historial y Auditoría de Arqueos
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Consulta los turnos cerrados previamente, diferencias de caja e informes de cierre Z.
              </p>
            </div>
            <div className="w-full sm:w-72 flex items-center gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Buscar operador o caja..."
                  value={historySearchTerm}
                  onChange={(e: any) => {
                    setHistorySearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  leftIcon={Search}
                />
              </div>
              {historySearchTerm && (
                <button
                  onClick={() => {
                    setHistorySearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 px-1 py-1 transition-colors flex-shrink-0"
                >
                  Limpiar
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingHistory ? (
              <div className="p-8 text-center text-slate-500">Cargando historial...</div>
            ) : paginatedHistory.length === 0 ? (
              <EmptyState
                title="No se encontraron arqueos"
                description="No hay registros de sesiones cerradas que coincidan con la búsqueda."
                icon={History}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400 border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-xs uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3.5">Fecha Apertura</th>
                      <th className="px-4 py-3.5">Caja</th>
                      <th className="px-4 py-3.5">Operador</th>
                      <th className="px-4 py-3.5 text-right">Inicial</th>
                      <th className="px-4 py-3.5 text-right">Total Vendido</th>
                      <th className="px-4 py-3.5 text-right">Diferencia</th>
                      <th className="px-4 py-3.5 text-center">Estado</th>
                      <th className="px-4 py-3.5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {paginatedHistory.map((session: any) => {
                      const diff = Number(session.closingDifference || 0);
                      return (
                        <tr
                          key={session.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-white">
                            {format(new Date(session.openedAt), 'dd MMM yyyy, HH:mm', { locale: es })}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                            {session.cashRegister?.code || 'CAJA'}
                          </td>
                          <td className="px-4 py-3.5 font-medium">{session.openedBy?.name}</td>
                          <td className="px-4 py-3.5 text-right font-mono">
                            {formatCurrency(session.openingBalance)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {formatCurrency(session.totals?.totalVendido ?? session.totals?.grandTotal ?? 0)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-bold">
                            {session.status === 'CLOSED' ? (
                              <span
                                className={
                                  diff === 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : diff > 0
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }
                              >
                                {diff > 0 ? '+' : ''}
                                {formatCurrency(diff)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {session.status === 'OPEN' ? (
                              <Badge status="open">ABIERTA</Badge>
                            ) : (
                              <Badge status="closed">CERRADA</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedSessionId(session.id)}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> Detalle
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500">
                  Página {currentPage} de {totalPages} ({filteredHistory.length} arqueos totales)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 4. MODAL ABRIR NUEVA CAJA */}
      <Modal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        title="Apertura de Turno de Caja"
        size="lg"
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Selecciona el depósito y la caja registradora correspondiente e ingresa el monto inicial del turno.
          </p>

          <Select
            label="Depósito *"
            value={openWarehouseId}
            onChange={(e: any) => {
              setOpenWarehouseId(e.target.value);
              setOpenRegisterId('');
            }}
            leftIcon={Building2}
          >
            <option value="">Selecciona un depósito...</option>
            {warehouses.map((w: any) => (
              <option key={w.id} value={w.id}>
                🏭 {w.name}
              </option>
            ))}
          </Select>

          <Select
            label="Caja Registradora *"
            value={openRegisterId}
            onChange={(e: any) => setOpenRegisterId(e.target.value)}
            leftIcon={Building2}
            disabled={!openWarehouseId}
          >
            <option value="">Selecciona una caja registrada...</option>
            {availableRegistersForOpen.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code})
              </option>
            ))}
          </Select>

          {openWarehouseId && availableRegistersForOpen.length === 0 && (
            <div className="text-xs text-rose-500 font-bold flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> No hay cajas registradoras cerradas disponibles para este depósito.
            </div>
          )}

          <Input
            label="Monto Inicial ($ ARS) *"
            type="number"
            step="0.01"
            min="0"
            value={openBalance}
            onChange={(e: any) => setOpenBalance(e.target.value)}
            placeholder="0.00"
            leftIcon={Wallet}
            helperText="Efectivo en billetes con el que arranca la jornada."
          />

          <Input
            label="Observaciones de Apertura (Opcional)"
            type="text"
            value={openNotes}
            onChange={(e: any) => setOpenNotes(e.target.value)}
            placeholder="Ej. Cambio de billetes de $1.000"
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsOpenModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                openMutation.mutate({
                  warehouseId: openWarehouseId,
                  cashRegisterId: openRegisterId,
                  openingBalance: Number(openBalance),
                  notes: openNotes,
                })
              }
              disabled={!openWarehouseId || !openRegisterId || openBalance === '' || openMutation.isPending}
              isLoading={openMutation.isPending}
            >
              Iniciar Turno y Abrir Caja
            </Button>
          </div>
        </div>
      </Modal>

      {/* 5. MODAL DETALLE DE OPERACIÓN EN VIVO (Ver Caja Abierta) */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setActiveDetailSessionId(null);
        }}
        title={
          activeSessionDetail ? (
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-indigo-500" />
              <span>Operando en {activeSessionDetail.cashRegister?.name || 'Caja'} ({activeSessionDetail.cashRegister?.code})</span>
            </div>
          ) : (
            'Cargando detalles de caja...'
          )
        }
        size="7xl"
      >
        {loadingSessionDetail ? (
          <div className="p-8 text-center text-slate-500">Cargando detalles de la sesión activa...</div>
        ) : !activeSessionDetail ? (
          <EmptyState
            title="Caja no activa"
            description="La sesión no pudo ser recuperada o ya se encuentra cerrada."
            icon={Wallet}
          />
        ) : (
          <div className="space-y-6 min-h-0 overflow-y-auto">
            {/* Cabecera / Info del turno */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-extrabold uppercase text-emerald-600 tracking-wider">Turno Activo</span>
                </div>
                <div className="text-xs text-slate-500">
                  Apertura: {format(new Date(activeSessionDetail.openedAt), 'HH:mm - dd MMM', { locale: es })} • Operador: {activeSessionDetail.openedBy?.name}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-200/50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                🏭 Depósito: {activeSessionDetail.warehouse?.name || activeSessionDetail.cashRegister?.warehouse?.name}
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-l-amber-500 dark:bg-slate-900 shadow-sm relative overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      Efectivo en Caja (Esperado)
                    </span>
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      <Banknote className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white font-mono">
                    {formatCurrency(expectedCash)}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1 font-medium">
                    Base {formatCurrency(totals.openingBalance)} + Efectivo neto
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border-l-4 border-l-indigo-500 dark:bg-slate-900 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                      Ventas Digitales
                    </span>
                    <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                      <CreditCard className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white font-mono">
                    {formatCurrency(digitalTotal)}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    MP, Transf. y Tarjetas
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-l-4 border-l-emerald-500 dark:bg-slate-900 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      Total Vendido Turno
                    </span>
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(totalVendido)}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    Suma total de todos los medios
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-slate-500/10 via-slate-500/5 to-transparent border-l-4 border-l-slate-500 dark:bg-slate-900 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Fondo Inicial
                    </span>
                    <div className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <Wallet className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">
                    {formatCurrency(totals.openingBalance)}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    Monto inicial de apertura
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Desglose y Timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <CardTitle className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-indigo-500" /> Desglose Financiero por Medio de Pago
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block uppercase">💵 Efectivo</span>
                        <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                          {formatCurrency(totals.cashTotal)}
                        </div>
                      </div>

                      <div className="p-2.5 bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-900/40 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-sky-700 dark:text-sky-400 block uppercase">💙 MP</span>
                        <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                          {formatCurrency(totals.mercadoPagoTotal)}
                        </div>
                      </div>

                      <div className="p-2.5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 block uppercase">🏦 Transf.</span>
                        <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                          {formatCurrency(totals.transferTotal)}
                        </div>
                      </div>

                      <div className="p-2.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 block uppercase">💳 Débito</span>
                        <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                          {formatCurrency(totals.debitCardTotal)}
                        </div>
                      </div>

                      <div className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 block uppercase">💳 Crédito</span>
                        <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                          {formatCurrency(totals.creditCardTotal)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-3">
                      <div className="flex items-center gap-4">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <ArrowUpCircle className="w-3.5 h-3.5" /> Ingresos (+): {formatCurrency(totals.manualIncomes)}
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                          <ArrowDownCircle className="w-3.5 h-3.5" /> Retiros (-): {formatCurrency(totals.manualExpenses)}
                        </span>
                      </div>
                      <span className="font-mono text-slate-400">Total Operaciones: {activeSessionDetail.cashMovements?.length || 0}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline */}
                <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <History className="w-4 h-4 text-indigo-500" /> Actividad del Turno (Línea de Tiempo)
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {activeSessionDetail.cashMovements?.length || 0} registros
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 max-h-[300px] overflow-y-auto">
                    {activeSessionDetail.cashMovements?.length === 0 ? (
                      <EmptyState
                        title="Sin movimientos aún"
                        description="Las ventas y cobros aparecerán en esta línea de tiempo automáticamente."
                        icon={History}
                      />
                    ) : (
                      <div className="space-y-3">
                        {activeSessionDetail.cashMovements?.map((mov: any) => {
                          const isIncome = mov.type === 'IN' || mov.type === 'INCOME';
                          const isCreditCollection =
                            mov.referenceType === 'ACCOUNT_RECEIVABLE_PAYMENT' ||
                            mov.referenceType === 'ACCOUNT_PAYMENT' ||
                            mov.reason?.includes('Cuenta Corriente');

                          return (
                            <div
                              key={mov.id}
                              className="flex items-start justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/70 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all gap-3"
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                                    isIncome
                                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                                      : 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                                  }`}
                                >
                                  {isIncome ? (
                                    <ArrowUpCircle className="w-3.5 h-3.5" />
                                  ) : (
                                    <ArrowDownCircle className="w-3.5 h-3.5" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                                      {isCreditCollection
                                        ? 'Cobro Cuenta Corriente'
                                        : mov.referenceType === 'SALE'
                                        ? 'Venta POS'
                                        : mov.referenceType === 'MANUAL'
                                        ? 'Ajuste Manual'
                                        : mov.referenceType === 'OPENING_BALANCE'
                                        ? 'Fondo de Apertura'
                                        : 'Movimiento'}
                                    </span>
                                    {mov.paymentMethod && (
                                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                        {mov.paymentMethod}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    {mov.reason}
                                  </p>
                                  <span className="text-[9px] text-slate-400 font-mono mt-1 block">
                                    {format(new Date(mov.createdAt), 'HH:mm:ss - dd MMM', { locale: es })}
                                  </span>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span
                                  className={`text-xs font-black font-mono block ${
                                    isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {isIncome ? '+' : '-'}{formatCurrency(mov.amount)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Panel Lateral Acciones de Caja */}
              <div className="space-y-6">
                <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-0 shadow-lg relative overflow-hidden">
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">
                        ACCIONES RÁPIDAS
                      </span>
                      <h3 className="text-sm font-bold text-white mt-0.5">Gestión de Turno</h3>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      <Button
                        variant="success"
                        className="w-full font-bold justify-start text-xs py-2"
                        onClick={() => {
                          setMovType('INCOME');
                          setMovAmount('');
                          setMovConcept('');
                          setIsMovementModalOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" /> Registrar Ingreso Manual
                      </Button>
                      <Button
                        variant="danger"
                        className="w-full font-bold justify-start text-xs py-2"
                        onClick={() => {
                          setMovType('EXPENSE');
                          setMovAmount('');
                          setMovConcept('');
                          setIsMovementModalOpen(true);
                        }}
                      >
                        <Minus className="w-4 h-4 mr-2" /> Registrar Retiro de Caja
                      </Button>
                      <Button
                        variant="warning"
                        className="w-full font-bold justify-start text-xs py-2"
                        onClick={() => {
                          setCountedBalance('');
                          setIsCloseModalOpen(true);
                        }}
                      >
                        <Lock className="w-4 h-4 mr-2" /> Realizar Cierre Z
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <CardTitle className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">
                      Resumen Físico Sugerido
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Base Inicial:</span>
                      <span className="font-mono font-semibold">{formatCurrency(totals.openingBalance)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Ventas Efectivo:</span>
                      <span className="font-mono font-semibold">{formatCurrency(totals.cashTotal)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>Ingresos Manuales (+):</span>
                      <span className="font-mono font-semibold">+{formatCurrency(totals.manualIncomes)}</span>
                    </div>
                    <div className="flex justify-between text-rose-600">
                      <span>Retiros Manuales (-):</span>
                      <span className="font-mono font-semibold">-{formatCurrency(totals.manualExpenses)}</span>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-slate-900 dark:text-white text-xs md:text-sm">
                      <span>Efectivo Sugerido:</span>
                      <span className="font-mono text-amber-600 dark:text-amber-400">{formatCurrency(expectedCash)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 6. MODAL MOVIMIENTO MANUAL INGRESO / RETIRO EN VIVO */}
      <Modal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        title={movType === 'INCOME' ? 'Registrar Ingreso de Caja' : 'Registrar Retiro de Caja'}
        size="md"
      >
        <div className="space-y-4 pt-1">
          <Input
            label="Monto a Registrar ($ ARS) *"
            type="number"
            step="0.01"
            min="0.01"
            value={movAmount}
            onChange={(e: any) => setMovAmount(e.target.value)}
            placeholder="0.00"
            leftIcon={Wallet}
          />
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Concepto / Motivo *
            </label>
            <Input
              type="text"
              value={movConcept}
              onChange={(e: any) => setMovConcept(e.target.value)}
              placeholder="Ej: Cambio de billetes / Viáticos de entrega"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[
                'Cambio de billetes',
                'Viáticos de flete',
                'Pago proveedor efectivo',
                'Ingreso de caja chica',
                'Retiro de recaudación',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setMovConcept(chip)}
                  className="px-2 py-0.5 text-[9px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md transition-colors"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsMovementModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant={movType === 'INCOME' ? 'success' : 'danger'}
              onClick={() =>
                movementMutation.mutate({
                  type: movType,
                  amount: Number(movAmount),
                  concept: movConcept,
                })
              }
              disabled={!movAmount || !movConcept || movementMutation.isPending}
              isLoading={movementMutation.isPending}
            >
              Guardar {movType === 'INCOME' ? 'Ingreso' : 'Retiro'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 7. MODAL DE CIERRE Z DE CAJA EN VIVO */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        title="Arqueo Financiero y Cierre Z"
        size="md"
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Ingresa el efectivo contado físicamente en la gaveta para calcular la diferencia final antes de cerrar el turno.
          </p>

          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>💵 Ventas Efectivo:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                {formatCurrency(totals.cashTotal)}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>🏦 Fondo Inicial Base:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                {formatCurrency(totals.openingBalance)}
              </span>
            </div>
            <div className="flex justify-between items-center text-emerald-600">
              <span>Ingresos Manuales (+):</span>
              <span className="font-mono font-semibold">+{formatCurrency(totals.manualIncomes)}</span>
            </div>
            <div className="flex justify-between items-center text-rose-600">
              <span>Retiros Manuales (-):</span>
              <span className="font-mono font-semibold">-{formatCurrency(totals.manualExpenses)}</span>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-slate-900 dark:text-white text-xs">
              <span>Efectivo Físico Esperado:</span>
              <span className="font-mono text-amber-600 dark:text-amber-400">
                {formatCurrency(expectedCash)}
              </span>
            </div>
          </div>

          <Input
            label="Efectivo Real en Caja (Contado) *"
            type="number"
            step="0.01"
            min="0"
            value={countedBalance}
            onChange={(e: any) => setCountedBalance(e.target.value)}
            placeholder="0.00"
            leftIcon={Banknote}
            helperText="Cuenta el dinero físicamente presente en la caja."
          />

          {countedBalance !== '' && (
            <div
              className={`p-3 rounded-xl border ${
                Number(countedBalance) - expectedCash === 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : Number(countedBalance) - expectedCash > 0
                  ? 'bg-blue-50 border-blue-300 text-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
              }`}
            >
              <div className="flex justify-between items-center text-xs font-bold">
                <span>
                  {Number(countedBalance) - expectedCash === 0
                    ? '🟢 Arqueo Exacto (Sin Diferencia)'
                    : Number(countedBalance) - expectedCash > 0
                    ? '🔵 Sobrante de Caja'
                    : '🔴 Faltante de Caja'}
                </span>
                <span className="font-mono text-sm font-black">
                  {Number(countedBalance) - expectedCash > 0 ? '+' : ''}
                  {formatCurrency(Number(countedBalance) - expectedCash)}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsCloseModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="font-bold shadow-sm"
              onClick={() => closeMutation.mutate({ countedBalance: Number(countedBalance) })}
              disabled={countedBalance === '' || closeMutation.isPending}
              isLoading={closeMutation.isPending}
            >
              Confirmar Cierre Z Definitivo
            </Button>
          </div>
        </div>
      </Modal>

      {/* 8. MODAL DE ARQUEO HISTÓRICO */}
      {selectedSessionId && (
        <SessionDetailModal
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </div>
  );
};
