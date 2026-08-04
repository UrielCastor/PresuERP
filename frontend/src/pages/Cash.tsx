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
  CheckCircle2,
  XCircle,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Building2,
  Clock,
  User,
  HelpCircle,
  Percent,
  Receipt
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SessionDetailModal } from '../components/cash/SessionDetailModal';

import { useAuth } from '../contexts/AuthContext';
import { getInitialWarehouseId } from '../utils/warehouse';

export const Cash: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'operacion' | 'historial'>('operacion');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: warehouseApi.list,
  });

  // Modales
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  const [openWarehouseId, setOpenWarehouseId] = useState<string>('');
  const [openRegisterId, setOpenRegisterId] = useState<string>('');
  const [openBalance, setOpenBalance] = useState('');
  const [openNotes, setOpenNotes] = useState('');

  // Queries
  const { data: activeSession, isLoading: loadingSession } = useQuery({
    queryKey: ['cash', 'active', openWarehouseId],
    queryFn: () => cashApi.getActiveSession(openWarehouseId ? { warehouseId: openWarehouseId } : undefined),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  useEffect(() => {
    if (warehouses.length > 0 && !openWarehouseId) {
      const initialWhId = getInitialWarehouseId(user, warehouses);
      if (initialWhId) {
        setOpenWarehouseId(initialWhId);
      }
    }
  }, [warehouses, openWarehouseId, user]);

  const { data: registers } = useQuery({
    queryKey: ['cash', 'registers', openWarehouseId],
    queryFn: () => cashApi.getRegisters({ warehouseId: openWarehouseId || undefined }),
    enabled: !activeSession && Boolean(openWarehouseId),
  });

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['cash', 'history'],
    queryFn: () => cashApi.getHistory(),
    enabled: activeTab === 'historial',
  });

  // State Movimiento Manual
  const [movType, setMovType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [movAmount, setMovAmount] = useState('');
  const [movConcept, setMovConcept] = useState('');

  // State Cierre Arqueo
  const [countedBalance, setCountedBalance] = useState('');

  // Mutations
  const openMutation = useMutation({
    mutationFn: cashApi.openSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setOpenBalance('');
      setOpenNotes('');
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Error al abrir caja'),
  });

  const closeMutation = useMutation({
    mutationFn: (payload: { countedBalance: number; notes?: string }) =>
      cashApi.closeSession({ ...payload, warehouseId: activeSession?.warehouseId || openWarehouseId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCountedBalance('');
      setIsCloseModalOpen(false);
    },
    onError: (err: any) => alert(err.response?.data?.message || 'Error al cerrar caja'),
  });

  const movementMutation = useMutation({
    mutationFn: (payload: { type: 'INCOME' | 'EXPENSE'; amount: number; concept: string; notes?: string }) =>
      cashApi.registerMovement({ ...payload, warehouseId: activeSession?.warehouseId || openWarehouseId }),
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

  // Totales de dominio provistos por el backend
  const totals = activeSession?.totals || {
    openingBalance: Number(activeSession?.openingBalance || 0),
    cashTotal: 0,
    mercadoPagoTotal: 0,
    transferTotal: 0,
    debitCardTotal: 0,
    creditCardTotal: 0,
    digitalTotal: 0,
    manualIncomes: 0,
    manualExpenses: 0,
    expectedCashBalance: Number(activeSession?.openingBalance || 0),
    totalVendido: 0,
    grandTotal: Number(activeSession?.openingBalance || 0),
  };

  const expectedCash = totals.expectedCashBalance;
  const digitalTotal = totals.digitalTotal;
  const totalVendido = totals.totalVendido;

  // Filtrado de Historial
  const filteredHistory = useMemo(() => {
    if (!history) return [];
    return history.filter(
      (s: any) =>
        s.openedBy?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.cashRegister?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.cashRegister?.code?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [history, searchTerm]);

  const paginatedHistory = useMemo(() => {
    return filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredHistory, currentPage]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

  const openMovementModal = (type: 'INCOME' | 'EXPENSE') => {
    setMovType(type);
    setMovAmount('');
    setMovConcept('');
    setIsMovementModalOpen(true);
  };

  const openCloseModal = () => {
    setCountedBalance('');
    setIsCloseModalOpen(true);
  };

  if (loadingSession) {
    return (
      <div className="space-y-6">
        <PageHeader title="Módulo de Caja Financiera" subtitle="Control de turno y libro diario de caja" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  console.log('ACTIVE SESSION', activeSession);
  console.log('MOVEMENTS LENGTH', activeSession?.cashMovements?.length);

  return (
    <div className="space-y-6">
      {/* 1. Header con Bar de Estado y Acciones Rápidas */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Caja Financiera
              </h1>
              {activeSession ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  TURNO ABIERTO
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  CAJA CERRADA
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {activeSession
                ? `Operando en ${activeSession.cashRegister?.name || 'Caja'} (${activeSession.cashRegister?.code}) • Apertura: ${format(new Date(activeSession.openedAt), 'HH:mm - dd MMM', { locale: es })}`
                : 'Selecciona una caja e ingresa el fondo inicial para iniciar un nuevo turno.'}
            </p>
          </div>

          {activeSession && (
            <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
              <Building2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Depósito</span>
                <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  🏭 {activeSession.warehouse?.name || activeSession.cashRegister?.warehouse?.name}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Pestañas de Vista y Botones de Acción Inmediata */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('operacion')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'operacion'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Operación Actual
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

          {activeSession && activeTab === 'operacion' && (
            <div className="flex items-center gap-2">
              <Button
                variant="success"
                size="sm"
                onClick={() => openMovementModal('INCOME')}
                className="font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Ingreso (+)
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => openMovementModal('EXPENSE')}
                className="font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Minus className="w-4 h-4" /> Retiro (-)
              </Button>
              <Button
                variant="warning"
                size="sm"
                onClick={openCloseModal}
                className="font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Lock className="w-4 h-4" /> Cierre Z
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Pestaña OPERACIÓN ACTUAL */}
      {activeTab === 'operacion' && (
        !activeSession ? (
          /* CAJA CERRADA: FORMULARIO DE APERTURA */
          <Card className="max-w-lg mx-auto mt-6 border-t-4 border-t-amber-500 shadow-md">
            <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="flex items-center gap-2.5 text-base md:text-lg">
                <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                Apertura de Turno de Caja
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300">
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
                {registers?.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </Select>

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

              <Button
                variant="primary"
                size="lg"
                className="w-full mt-4 font-bold tracking-wide"
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
            </CardContent>
          </Card>
        ) : (
          /* CAJA ABIERTA: DASHBOARD FINANCIERO EN TIEMPO REAL */
          <div className="space-y-6">
            
            {/* HERO KPIS PRINCIPALES (4 TARJETAS CLAVE) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* KPI 1: Efectivo Físico Esperado (DESTACADO HERO) */}
              <Card className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-l-amber-500 dark:bg-slate-900 shadow-sm relative overflow-hidden">
                <CardContent className="p-4 md:p-5">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      Efectivo en Caja (Esperado)
                    </span>
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      <Banknote className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono">
                    {formatCurrency(expectedCash)}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1 font-medium">
                    <Wallet className="w-3.5 h-3.5 text-amber-500" />
                    Base ${Number(totals.openingBalance).toLocaleString()} + Efectivo neto
                  </p>
                </CardContent>
              </Card>

              {/* KPI 2: Ventas Digitales y Tarjetas */}
              <Card className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border-l-4 border-l-indigo-500 dark:bg-slate-900 shadow-sm">
                <CardContent className="p-4 md:p-5">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                      Ventas Digitales
                    </span>
                    <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                      <CreditCard className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono">
                    {formatCurrency(digitalTotal)}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    Mercado Pago, Transf. y Tarjetas
                  </p>
                </CardContent>
              </Card>

              {/* KPI 3: Total Bruto Vendido */}
              <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-l-4 border-l-emerald-500 dark:bg-slate-900 shadow-sm">
                <CardContent className="p-4 md:p-5">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      Total Vendido Turno
                    </span>
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(totalVendido)}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    Suma total de todos los medios
                  </p>
                </CardContent>
              </Card>

              {/* KPI 4: Fondo Inicial */}
              <Card className="bg-gradient-to-br from-slate-500/10 via-slate-500/5 to-transparent border-l-4 border-l-slate-500 dark:bg-slate-900 shadow-sm">
                <CardContent className="p-4 md:p-5">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Fondo Inicial
                    </span>
                    <div className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <Wallet className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 font-mono">
                    {formatCurrency(totals.openingBalance)}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    Monto inicial de apertura
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* DESGLOSE POR MEDIO DE PAGO & CONTROLES */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Tarjetas de Medios de Pago (Col-span 2) */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <CardTitle className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-indigo-500" /> Desglose Financiero por Medio de Pago
                      </span>
                      <span className="text-xs font-normal text-slate-400">Actualizado en vivo</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      
                      {/* Efectivo */}
                      <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl space-y-1">
                        <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 block uppercase">💵 Efectivo</span>
                        <div className="text-base md:text-lg font-black text-slate-900 dark:text-white font-mono">
                          {formatCurrency(totals.cashTotal)}
                        </div>
                      </div>

                      {/* Mercado Pago */}
                      <div className="p-3 bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-900/40 rounded-xl space-y-1">
                        <span className="text-[11px] font-bold text-sky-700 dark:text-sky-400 block uppercase">💙 Mercado Pago</span>
                        <div className="text-base md:text-lg font-black text-slate-900 dark:text-white font-mono">
                          {formatCurrency(totals.mercadoPagoTotal)}
                        </div>
                      </div>

                      {/* Transferencia */}
                      <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 rounded-xl space-y-1">
                        <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 block uppercase">🏦 Transferencia</span>
                        <div className="text-base md:text-lg font-black text-slate-900 dark:text-white font-mono">
                          {formatCurrency(totals.transferTotal)}
                        </div>
                      </div>

                      {/* Débito */}
                      <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-xl space-y-1">
                        <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 block uppercase">💳 Débito</span>
                        <div className="text-base md:text-lg font-black text-slate-900 dark:text-white font-mono">
                          {formatCurrency(totals.debitCardTotal)}
                        </div>
                      </div>

                      {/* Crédito */}
                      <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 rounded-xl space-y-1">
                        <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 block uppercase">💳 Crédito</span>
                        <div className="text-base md:text-lg font-black text-slate-900 dark:text-white font-mono">
                          {formatCurrency(totals.creditCardTotal)}
                        </div>
                      </div>
                    </div>

                    {/* Fila secundaria de Ajustes Manuales */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-3">
                      <div className="flex items-center gap-4">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <ArrowUpCircle className="w-3.5 h-3.5" /> Ingresos Manuales (+): {formatCurrency(totals.manualIncomes)}
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                          <ArrowDownCircle className="w-3.5 h-3.5" /> Retiros Manuales (-): {formatCurrency(totals.manualExpenses)}
                        </span>
                      </div>
                      <span className="font-mono text-slate-400">Total Operaciones: {activeSession.cashMovements?.length || 0}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Línea de Tiempo de Movimientos */}
                <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <History className="w-4 h-4 text-indigo-500" /> Línea de Tiempo (Actividad del Turno)
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {activeSession.cashMovements?.length || 0} registros
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 max-h-[480px] overflow-y-auto">
                    <div style={{ background: 'red', color: 'white', padding: '8px', fontWeight: 'bold', borderRadius: '8px', marginBottom: '12px' }}>
                      Cantidad: {activeSession?.cashMovements?.length}
                    </div>
                    {activeSession?.cashMovements?.length === 0 ? (
                      <EmptyState
                        title="Sin movimientos aún"
                        description="Las ventas y cobros registrados aparecerán automáticamente en esta línea de tiempo."
                        icon={History}
                      />
                    ) : (
                      <div className="space-y-3">
                        {(() => {
                          console.log('RENDERING MOVEMENTS');
                          return activeSession?.cashMovements?.map((mov: any) => {
                            console.log('MOVEMENT', mov);
                            const isIncome = mov.type === 'IN' || mov.type === 'INCOME';
                          const isCreditCollection =
                            mov.referenceType === 'ACCOUNT_RECEIVABLE_PAYMENT' ||
                            mov.referenceType === 'ACCOUNT_PAYMENT' ||
                            mov.reason?.includes('Cuenta Corriente');

                          return (
                            <div
                              key={mov.id}
                              className="flex items-start justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/70 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all gap-3"
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                                    isIncome
                                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                                      : 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                                  }`}
                                >
                                  {isIncome ? (
                                    <ArrowUpCircle className="w-4 h-4" />
                                  ) : (
                                    <ArrowDownCircle className="w-4 h-4" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
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
                                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                        {mov.paymentMethod}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {mov.reason}
                                  </p>
                                  <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                                    {format(new Date(mov.createdAt), 'HH:mm:ss - dd MMM', { locale: es })}
                                  </span>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span
                                  className={`text-base font-black font-mono block ${
                                    isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {isIncome ? '+' : '-'}{formatCurrency(mov.amount)}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      })()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Panel Lateral de Acciones Rápidas (Col-span 1) */}
              <div className="space-y-6">
                
                {/* Card de Accesos Directos */}
                <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-0 shadow-lg relative overflow-hidden">
                  <CardContent className="p-5 relative z-10 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                          ACCIONES RÁPIDAS
                        </span>
                        <h3 className="text-lg font-bold text-white mt-0.5">Gestión de Turno</h3>
                      </div>
                      <Wallet className="w-8 h-8 text-indigo-400/40" />
                    </div>

                    <div className="space-y-2.5 pt-1">
                      <Button
                        variant="success"
                        className="w-full font-bold justify-start text-xs py-2.5"
                        onClick={() => openMovementModal('INCOME')}
                      >
                        <Plus className="w-4 h-4 mr-2" /> Registrar Ingreso Manual
                      </Button>
                      <Button
                        variant="danger"
                        className="w-full font-bold justify-start text-xs py-2.5"
                        onClick={() => openMovementModal('EXPENSE')}
                      >
                        <Minus className="w-4 h-4 mr-2" /> Registrar Retiro de Caja
                      </Button>
                      <Button
                        variant="warning"
                        className="w-full font-bold justify-start text-xs py-2.5"
                        onClick={openCloseModal}
                      >
                        <Lock className="w-4 h-4 mr-2" /> Realizar Arqueo y Cierre Z
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Card de Resumen de Arqueo Guía */}
                <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <CardTitle className="text-xs uppercase font-extrabold tracking-wider text-slate-500">
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
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-slate-900 dark:text-white text-sm">
                      <span>Efectivo en Billete:</span>
                      <span className="font-mono text-amber-600 dark:text-amber-400">{formatCurrency(expectedCash)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

            </div>
          </div>
        )
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
                  value={searchTerm}
                  onChange={(e: any) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  leftIcon={Search}
                />
              </div>
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
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

      {/* 4. MODAL MOVIMIENTO MANUAL (INGRESO / RETIRO) */}
      <Modal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        title={movType === 'INCOME' ? 'Registrar Ingreso de Caja' : 'Registrar Retiro de Caja'}
        size="md"
      >
        <div className="space-y-4 pt-2">
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setMovType('INCOME')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                movType === 'INCOME'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Plus className="w-4 h-4" /> Ingreso (+)
            </button>
            <button
              type="button"
              onClick={() => setMovType('EXPENSE')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                movType === 'EXPENSE'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Minus className="w-4 h-4" /> Retiro (-)
            </button>
          </div>

          <Input
            label="Monto a Registrar ($ ARS) *"
            type="number"
            step="0.01"
            min="0.01"
            value={movAmount}
            onChange={(e: any) => setMovAmount(e.target.value)}
            placeholder="0.00"
            leftIcon={DollarSign}
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
            {/* Chips de motivos habituales */}
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
                  className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md transition-colors"
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

      {/* 5. MODAL DE ARQUEO Y CIERRE Z DE CAJA */}
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
              <span>💵 Efectivo por Ventas:</span>
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
            {totals.manualIncomes > 0 && (
              <div className="flex justify-between items-center text-emerald-600">
                <span>Ingresos Manuales (+):</span>
                <span className="font-mono font-semibold">+{formatCurrency(totals.manualIncomes)}</span>
              </div>
            )}
            {totals.manualExpenses > 0 && (
              <div className="flex justify-between items-center text-rose-600">
                <span>Retiros Manuales (-):</span>
                <span className="font-mono font-semibold">-{formatCurrency(totals.manualExpenses)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-slate-900 dark:text-white text-sm">
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
            helperText="Cuenta el dinero en billetes físicamente presente en la caja."
          />

          {/* Cálculo de Diferencia en Tiempo Real */}
          {countedBalance !== '' && (
            <div
              className={`p-3.5 rounded-xl border ${
                Number(countedBalance) - expectedCash === 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : Number(countedBalance) - expectedCash > 0
                  ? 'bg-blue-50 border-blue-300 text-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
              }`}
            >
              <div className="flex justify-between items-center text-xs md:text-sm font-bold">
                <span>
                  {Number(countedBalance) - expectedCash === 0
                    ? '🟢 Arqueo Exacto (Sin Diferencia)'
                    : Number(countedBalance) - expectedCash > 0
                    ? '🔵 Sobrante de Caja'
                    : '🔴 Faltante de Caja'}
                </span>
                <span className="font-mono text-base font-black">
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

      {/* 6. MODAL DE DETALLE DE ARQUEO HISTÓRICO */}
      {selectedSessionId && (
        <SessionDetailModal
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </div>
  );
};
