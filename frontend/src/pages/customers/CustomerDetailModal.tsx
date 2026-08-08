import React, { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, User, Building, Phone, Mail, MapPin, FileText, ShoppingBag, DollarSign, Calendar, CreditCard, Tag, PlusCircle, ArrowUpRight, ArrowDownLeft, Wallet, Check, Award, Gift } from 'lucide-react';
import { Customer, getCustomerById, getCustomerAccountMovements, registerCustomerAccountPayment, CustomerAccountMovement } from '../../services/customer.service';
import { api } from '../../services/api';
import { cashApi } from '../../services/cash.service';
import { swalSuccess, swalWarning, swalConfirm, handleApiError } from '../../utils/swal';
import { paymentAdjustmentRuleService, calculatePaymentAdjustment } from '../../services/paymentAdjustmentRule.service';
import { getInitialWarehouseId } from '../../utils/warehouse';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CustomerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string | null;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  isOpen,
  onClose,
  customerId,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'PURCHASES' | 'CREDIT_ACCOUNT' | 'LOYALTY'>('PURCHASES');
  const [movements, setMovements] = useState<CustomerAccountMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [activeCashSession, setActiveCashSession] = useState<any>(null);

  // Loyalty states
  const [loyaltyInfo, setLoyaltyInfo] = useState<any>(null);
  const [loyaltyHistory, setLoyaltyHistory] = useState<any[]>([]);
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);
  const [isFullHistoryOpen, setIsFullHistoryOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const { data: saleData, isLoading: loadingSale } = useQuery({
    queryKey: ['posSaleDetails', selectedSaleId],
    queryFn: async () => {
      if (!selectedSaleId) return null;
      const res = await api.get(`/sales/${selectedSaleId}`);
      return res.data?.data;
    },
    enabled: !!selectedSaleId,
  });

  const fetchLoyaltyData = () => {
    if (customerId) {
      setLoadingLoyalty(true);
      api.get(`/points/customers/${customerId}/balance`)
        .then((res) => {
          if (res.data?.success) {
            setLoyaltyInfo(res.data.data);
          }
        })
        .catch((err) => console.error('Error al cargar datos de fidelización:', err));

      api.get(`/points/history`, { params: { customerId, limit: 5 } })
        .then((res) => {
          if (res.data?.success) {
            setLoyaltyHistory(res.data.data || []);
          }
        })
        .catch((err) => console.error('Error al cargar historial de fidelización:', err))
        .finally(() => setLoadingLoyalty(false));
    }
  };

  // Payment form state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'MERCADO_PAGO' | 'DEBIT_CARD' | 'CREDIT_CARD'>('CASH');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Obtener reglas de ajuste de pago activas para el motor compartido
  const { data: adjustmentRules = [] } = useQuery({
    queryKey: ['paymentAdjustmentRules'],
    queryFn: () => paymentAdjustmentRuleService.getAll(),
    enabled: isOpen,
  });

  // Cálculo de ajuste reutilizando EXACTAMENTE el mismo motor que el POS
  const adjustmentCalculation = useMemo(() => {
    return calculatePaymentAdjustment(Number(paymentAmount) || 0, paymentMethod, adjustmentRules as any);
  }, [paymentAmount, paymentMethod, adjustmentRules]);

  const [creditSubTab, setCreditSubTab] = useState<'PENDING' | 'HISTORY'>('PENDING');

  const pendingMovements = useMemo(() => {
    return movements.filter(
      (m) => m.type === 'SALE' && !m.isSettled && Number(m.remainingAmount ?? m.amount) > 0
    );
  }, [movements]);

  const calculatedCurrentDebt = useMemo(() => {
    if (movements.length > 0) {
      return pendingMovements.reduce(
        (acc, m) => acc + Number(m.remainingAmount ?? m.amount),
        0
      );
    }
    return Number(customer?.currentDebt || 0);
  }, [movements, pendingMovements, customer]);

  const calculatedAvailableCredit = useMemo(() => {
    const limit = Number(customer?.creditLimit || 0);
    return Math.max(0, limit - calculatedCurrentDebt);
  }, [customer, calculatedCurrentDebt]);

  const fetchCustomerData = () => {
    if (customerId) {
      setLoading(true);
      getCustomerById(customerId)
        .then((res) => setCustomer(res.data))
        .catch((err) => console.error('Error al cargar detalle del cliente:', err))
        .finally(() => setLoading(false));
    }
  };

  const fetchMovements = () => {
    if (customerId) {
      setLoadingMovements(true);
      getCustomerAccountMovements(customerId)
        .then((res) => setMovements(res.data || []))
        .catch((err) => console.error('Error al cargar movimientos de cta cte:', err))
        .finally(() => setLoadingMovements(false));
    }
  };

  useEffect(() => {
    if (isOpen && customerId) {
      setActiveTab('PURCHASES');
      fetchCustomerData();

      // Pre-cargar info básica de fidelización para la badge
      api.get(`/points/customers/${customerId}/balance`)
        .then((res) => {
          if (res.data?.success) {
            setLoyaltyInfo(res.data.data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, customerId]);

  useEffect(() => {
    if (isOpen && customerId && activeTab === 'CREDIT_ACCOUNT') {
      fetchMovements();
    }
  }, [isOpen, customerId, activeTab]);

  useEffect(() => {
    if (isOpen && customerId && activeTab === 'LOYALTY') {
      fetchLoyaltyData();
    }
  }, [isOpen, customerId, activeTab]);

  if (!isOpen) return null;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

  const handleOpenPaymentModal = async () => {
    try {
      const targetWhId = getInitialWarehouseId(user);
      const activeSession = await cashApi.getActiveSession(targetWhId ? { warehouseId: targetWhId } : undefined);
      if (!activeSession) {
        await swalWarning(
          'No hay una caja abierta',
          'Para registrar un pago de cuenta corriente necesitas tener una caja abierta en el depósito donde estás operando.'
        );
        return;
      }
      setActiveCashSession(activeSession);
      setPaymentAmount(calculatedCurrentDebt > 0 ? calculatedCurrentDebt : 0);
      setPaymentError(null);
      setIsPaymentModalOpen(true);
    } catch (err: any) {
      await swalWarning(
        'No hay una caja abierta',
        'Para registrar un pago de cuenta corriente necesitas tener una caja abierta en el depósito donde estás operando.'
      );
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(paymentAmount) || 0;
    if (!customerId || numAmount <= 0) {
      setPaymentError('Ingresa un monto válido mayor a $0');
      return;
    }

    try {
      const targetWhId = getInitialWarehouseId(user);
      const activeSession = await cashApi.getActiveSession(targetWhId ? { warehouseId: targetWhId } : undefined);
      if (!activeSession) {
        setIsPaymentModalOpen(false);
        await swalWarning(
          'No hay una caja abierta',
          'Para registrar un pago de cuenta corriente necesitas tener una caja abierta en el depósito donde estás operando.'
        );
        return;
      }
      setActiveCashSession(activeSession);

      const warehouseName = activeSession.warehouse?.name || activeSession.cashRegister?.warehouse?.name || 'Sucursal Actual';
      const registerName = activeSession.cashRegister?.name || 'Caja Principal';
      const registerCode = activeSession.cashRegister?.code || activeSession.id.slice(0, 8);

      const confirmed = await swalConfirm(
        '¿Registrar pago de Cuenta Corriente?',
        `Monto: $${numAmount.toLocaleString('es-AR')}\n\nSe acreditará en:\n${registerName} (${registerCode})\n🏢 ${warehouseName}`,
        'Registrar pago',
        'Cancelar',
        'question'
      );
      if (!confirmed) return;

      setSubmittingPayment(true);
      setPaymentError(null);

      await registerCustomerAccountPayment(customerId, {
        amount: numAmount,
        paymentMethod,
        description: paymentDescription.trim() || 'Pago a cuenta corriente',
        cashSessionId: activeSession.id,
        warehouseId: activeSession.warehouseId || activeSession.cashRegister?.warehouseId,
      });

      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentMethod('CASH');
      setPaymentDescription('');
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      queryClient.invalidateQueries({ queryKey: ['cash', 'active'] });
      queryClient.refetchQueries({ queryKey: ['cash', 'active'] });
      window.dispatchEvent(new CustomEvent('customer-debt-updated'));
      fetchCustomerData();
      fetchMovements();
      await swalSuccess('Pago Registrado', `El cobro fue acreditado exitosamente en ${registerName} (${warehouseName}).`);
    } catch (err: any) {
      setIsPaymentModalOpen(false);
      handleApiError(err, 'No puedes registrar este pago');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const creditLimit = Number(customer?.creditLimit || 0);
  const currentDebt = Number(customer?.currentDebt || 0);
  const availableCredit = Math.max(0, creditLimit - currentDebt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              {customer?.type === 'COMPANY' ? <Building className="w-6 h-6" /> : <User className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{customer?.name || 'Cargando...'}</h2>
                {customer && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${customer.type === 'COMPANY' ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'}`}>
                    {customer.type === 'COMPANY' ? 'Empresa' : 'Persona'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Documento: <span className="font-semibold text-slate-700 dark:text-slate-300">{customer?.document || customer?.taxId || 'Sin registrar'}</span>
                {customer?.taxCondition && <span className="ml-3 text-indigo-600 dark:text-indigo-400 font-medium">({customer.taxCondition})</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-6 pt-2">
          <button
            onClick={() => setActiveTab('PURCHASES')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'PURCHASES'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Historial de Compras ({customer?.metrics?.totalSalesCount || 0})
          </button>
          <button
            onClick={() => setActiveTab('CREDIT_ACCOUNT')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'CREDIT_ACCOUNT'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" /> Cuenta Corriente
            {customer?.allowCreditAccount && (
              <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold">
                Habilitada
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('LOYALTY')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'LOYALTY'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Award className="w-3.5 h-3.5" /> Programa de Fidelización
            {loyaltyInfo?.enabled && !loyaltyInfo?.excludeFromLoyalty && (
              <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold">
                Activa ({loyaltyInfo.pointsBalance} pts)
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium">Cargando perfil del cliente...</div>
        ) : !customer ? (
          <div className="p-12 text-center text-slate-500">No se encontraron los datos del cliente.</div>
        ) : (
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Info Section */}
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-200 dark:border-slate-800">
                Información de Contacto y Ubicación
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Teléfono:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{customer.phone || 'No registrado'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Email:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{customer.email || 'No registrado'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Dirección:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {[customer.address, customer.city, customer.province].filter(Boolean).join(', ') || 'No registrada'}
                  </span>
                </div>
              </div>
              {customer.notes && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-start gap-2 text-xs">
                  <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                  <span className="text-slate-500 font-semibold">Notas:</span>
                  <span className="text-slate-700 dark:text-slate-300 italic">{customer.notes}</span>
                </div>
              )}
            </div>

            {/* TAB 1: PURCHASES */}
            {activeTab === 'PURCHASES' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/30 dark:to-indigo-900/10 border border-indigo-200/50 dark:border-indigo-900/50 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Total Comprado (Histórico)</p>
                      <p className="text-2xl font-black text-indigo-900 dark:text-indigo-100 mt-1">
                        {formatCurrency(customer.metrics?.totalSpent || 0)}
                      </p>
                    </div>
                    <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
                      <DollarSign className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10 border border-emerald-200/50 dark:border-emerald-900/50 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Ventas Realizadas</p>
                      <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100 mt-1">
                        {customer.metrics?.totalSalesCount || 0} compras
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-indigo-500" /> Historial de Compras Realizadas
                  </h3>

                  {!customer.sales || customer.sales.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 text-xs">
                      Este cliente aún no registra compras en el POS.
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase font-bold tracking-wider">
                          <tr>
                            <th className="px-4 py-3">Fecha</th>
                            <th className="px-4 py-3">Nº Comprobante</th>
                            <th className="px-4 py-3 text-right">Total</th>
                            <th className="px-4 py-3">Método de Pago</th>
                            <th className="px-4 py-3 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {customer.sales.map((sale: any) => {
                            const pmName = sale.payments?.[0]?.paymentMethod?.name || sale.payments?.[0]?.details || 'Efectivo';
                            return (
                              <tr key={sale.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                                  {format(new Date(sale.createdAt), 'dd MMM yyyy - HH:mm', { locale: es })}
                                </td>
                                <td className="px-4 py-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                  {sale.documentType?.code || 'FAC'}-{String(sale.documentNumber).padStart(6, '0')}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                                  {formatCurrency(Number(sale.totalAmount))}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                                    {pmName}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${sale.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-red-50 text-red-700'}`}>
                                    {sale.status === 'COMPLETED' ? 'Completado' : sale.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB 3: FIDELIZACIÓN */}
            {activeTab === 'LOYALTY' && (
              <div className="space-y-6">
                {loadingLoyalty && !loyaltyInfo ? (
                  <div className="p-8 text-center text-slate-500 text-xs">Cargando datos de fidelización...</div>
                ) : !loyaltyInfo ? (
                  <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-xs">
                    No se pudieron obtener los datos del programa de fidelización.
                  </div>
                ) : (() => {
                  const lastExpired = loyaltyHistory.find((h: any) => h.type === 'EXPIRED');
                  const statusText = !loyaltyInfo.enabled
                    ? 'Sin programa'
                    : loyaltyInfo.excludeFromLoyalty
                    ? 'Excluido'
                    : 'Activo';

                  return (
                    <>
                      {/* loyalty KPI Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
                          <p className="font-semibold uppercase tracking-wider text-slate-500">Saldo Actual</p>
                          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 flex items-baseline gap-1">
                            {loyaltyInfo.pointsBalance} <span className="text-xs font-bold text-slate-400 font-sans">pts</span>
                          </p>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
                          <p className="font-semibold uppercase tracking-wider text-slate-500">Equivalente en Dinero</p>
                          <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
                            {formatCurrency(loyaltyInfo.pointsBalance * loyaltyInfo.pointValue)}
                          </p>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
                          <p className="font-semibold uppercase tracking-wider text-slate-500">Estado</p>
                          <div className="mt-2.5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                              statusText === 'Activo'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : statusText === 'Excluido'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {statusText}
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
                          <p className="font-semibold uppercase tracking-wider text-slate-500">Fecha de alta</p>
                          <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1 font-mono">
                            {customer?.createdAt ? format(new Date(customer.createdAt), 'dd/MM/yyyy') : '-'}
                          </p>
                        </div>
                      </div>

                      {/* loyalty Summary Cards */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 space-y-4">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                          <Gift className="w-4.5 h-4.5 text-amber-500" /> Resumen de Acumulación y Canjes
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {/* Column Acreditaciones */}
                          <div className="space-y-2 border-r border-slate-100 dark:border-slate-800/80 pr-4">
                            <p className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider mb-2">Acreditaciones</p>
                            <div className="flex justify-between">
                              <span>Total histórico ganado:</span>
                              <span className="text-emerald-600 font-bold font-mono">+{loyaltyInfo.totalEarned} pts</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Última acreditación:</span>
                              <span className="text-slate-800 dark:text-slate-200 font-bold font-mono">
                                {loyaltyInfo.lastEarnedDate ? format(new Date(loyaltyInfo.lastEarnedDate), 'dd/MM/yyyy') : '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Puntos acreditados:</span>
                              <span className="text-emerald-650 font-black font-mono">
                                {loyaltyInfo.lastEarnedAmount ? `+${loyaltyInfo.lastEarnedAmount} pts` : '-'}
                              </span>
                            </div>
                          </div>

                          {/* Column Canjes */}
                          <div className="space-y-2 border-r border-slate-100 dark:border-slate-800/80 pr-4">
                            <p className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider mb-2">Canjes</p>
                            <div className="flex justify-between">
                              <span>Total histórico canjeado:</span>
                              <span className="text-rose-600 font-bold font-mono">-{loyaltyInfo.totalRedeemed} pts</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Último canje:</span>
                              <span className="text-slate-800 dark:text-slate-200 font-bold font-mono">
                                {loyaltyInfo.lastRedeemedDate ? format(new Date(loyaltyInfo.lastRedeemedDate), 'dd/MM/yyyy') : '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Puntos canjeados:</span>
                              <span className="text-rose-650 font-black font-mono">
                                {loyaltyInfo.lastRedeemedAmount ? `-${loyaltyInfo.lastRedeemedAmount} pts` : '-'}
                              </span>
                            </div>
                          </div>

                          {/* Column Vencimientos */}
                          <div className="space-y-2">
                            <p className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider mb-2">Vencimientos</p>
                            <div className="flex justify-between">
                              <span>Total histórico vencido:</span>
                              <span className="text-slate-500 font-bold font-mono">{loyaltyInfo.totalExpired} pts</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Último vencimiento:</span>
                              <span className="text-slate-800 dark:text-slate-200 font-bold font-mono">
                                {lastExpired ? format(new Date(lastExpired.createdAt), 'dd/MM/yyyy') : '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Puntos vencidos:</span>
                              <span className="text-slate-500 font-black font-mono">
                                {lastExpired ? `${Math.abs(lastExpired.points)} pts` : '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                    {/* Historial Resumido de Puntos */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Historial Reciente de Movimientos
                        </h4>
                        <button
                          type="button"
                          onClick={() => setIsFullHistoryOpen(true)}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                        >
                          Ver Historial Completo
                        </button>
                      </div>

                      {loyaltyHistory.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 text-xs font-medium">
                          No hay registros de puntos en la cuenta de este cliente.
                        </div>
                      ) : (
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase font-bold tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Tipo</th>
                                <th className="px-4 py-3">Motivo</th>
                                <th className="px-4 py-3 text-right">Puntos</th>
                                <th className="px-4 py-3 text-right">Saldo resultante</th>
                                <th className="px-4 py-3">Descripción</th>
                                <th className="px-4 py-3">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {loyaltyHistory.map((h) => {
                                const isPositive = h.points > 0;
                                const mapReason = (r: string) => {
                                  const mapping: Record<string, string> = {
                                    'SALE': 'Venta',
                                    'SALE_CANCEL': 'Anulación de Venta',
                                    'REDEEM': 'Canje',
                                    'REDEEM_CANCEL': 'Anulación de Canje',
                                    'MANUAL': 'Ajuste Manual',
                                    'EXPIRATION': 'Vencimiento',
                                    'BONUS': 'Acreditación Especial',
                                    'MIGRATION': 'Migración',
                                    'PROMOTION': 'Promoción'
                                  };
                                  return mapping[r] || r;
                                };

                                return (
                                  <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                                      {format(new Date(h.createdAt), 'dd/MM/yyyy - HH:mm')}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                                        h.type === 'EARN'
                                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-350 border-emerald-200/50'
                                          : h.type === 'REDEEM'
                                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200/50'
                                          : h.type === 'EXPIRED'
                                          ? 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200/30'
                                          : h.type === 'ADJUSTMENT'
                                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200/50'
                                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-305 border-rose-200/50' // CANCEL
                                      }`}>
                                        {h.type === 'EARN'
                                          ? 'Acreditación'
                                          : h.type === 'REDEEM'
                                          ? 'Canje'
                                          : h.type === 'EXPIRED'
                                          ? 'Vencimiento'
                                          : h.type === 'ADJUSTMENT'
                                          ? 'Ajuste'
                                          : 'Anulación'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-750 dark:text-slate-250">
                                      {mapReason(h.reason)}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold font-mono text-sm ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {isPositive ? `+${h.points}` : h.points}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold font-mono text-slate-800 dark:text-slate-200">
                                      {h.balanceAfter}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-450 max-w-[150px] truncate" title={h.description}>
                                      {h.description || '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                      {h.saleId && (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedSaleId(h.saleId)}
                                          className="text-indigo-650 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-extrabold text-xs flex items-center gap-0.5 hover:underline"
                                        >
                                          ⭐ Ver Venta
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
              </div>
            )}

            {/* TAB 2: CREDIT ACCOUNT */}
            {activeTab === 'CREDIT_ACCOUNT' && (
              <div className="space-y-6">
                {!customer.allowCreditAccount ? (
                  <div className="p-8 text-center bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl space-y-2">
                    <p className="font-bold text-amber-800 dark:text-amber-300 text-sm">Cuenta Corriente no habilitada</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Puedes habilitar el crédito para este cliente editando sus datos en el listado de clientes.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Account Balance KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Límite de Crédito</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
                          {formatCurrency(creditLimit)}
                        </p>
                      </div>

                      <div className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/10 border border-red-200/50 dark:border-red-900/50 p-4 rounded-2xl">
                        <p className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Deuda Actual Pendiente</p>
                        <p className="text-2xl font-black text-red-700 dark:text-red-300 mt-1">
                          {formatCurrency(calculatedCurrentDebt)}
                        </p>
                      </div>

                      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10 border border-emerald-200/50 dark:border-emerald-900/50 p-4 rounded-2xl">
                        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Crédito Disponible</p>
                        <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                          {formatCurrency(calculatedAvailableCredit)}
                        </p>
                      </div>
                    </div>

                    {/* Actions and Sub-tabs Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                        <button
                          onClick={() => setCreditSubTab('PENDING')}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            creditSubTab === 'PENDING'
                              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          Ventas Pendientes ({pendingMovements.length})
                        </button>
                        <button
                          onClick={() => setCreditSubTab('HISTORY')}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            creditSubTab === 'HISTORY'
                              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          Historial Completo ({movements.length})
                        </button>
                      </div>

                      <button
                        onClick={handleOpenPaymentModal}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all self-end sm:self-auto"
                      >
                        <PlusCircle className="w-4 h-4" /> Registrar Pago / Cobro
                      </button>
                    </div>

                    {/* SUB-TAB 1: PENDIENTES */}
                    {creditSubTab === 'PENDING' && (
                      loadingMovements ? (
                        <div className="p-8 text-center text-slate-500 text-xs">Cargando ventas pendientes...</div>
                      ) : pendingMovements.length === 0 ? (
                        <div className="p-8 text-center bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                          🎉 No hay ventas pendientes de pago. ¡La cuenta corriente está al día!
                        </div>
                      ) : (
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase font-bold tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Fecha Venta</th>
                                <th className="px-4 py-3">Comprobante / Detalle</th>
                                <th className="px-4 py-3 text-right">Monto Original</th>
                                <th className="px-4 py-3 text-right">Saldo Pendiente</th>
                                <th className="px-4 py-3 text-center">Estado Ticket</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {pendingMovements.map((m) => {
                                const rem = Number(m.remainingAmount ?? m.amount);
                                const isPartial = rem < Number(m.amount);
                                return (
                                  <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                                      {format(new Date(m.createdAt), 'dd MMM yyyy - HH:mm', { locale: es })}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                                      {m.description || 'Venta en Cta. Cte.'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">
                                      {formatCurrency(Number(m.amount))}
                                    </td>
                                    <td className="px-4 py-3 text-right font-black text-sm text-red-600 dark:text-red-400">
                                      {formatCurrency(rem)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                        isPartial
                                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                                          : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                                      }`}>
                                        {isPartial ? 'Pago Parcial' : 'Pendiente Total'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}

                    {/* SUB-TAB 2: HISTORIAL COMPLETO */}
                    {creditSubTab === 'HISTORY' && (
                      loadingMovements ? (
                        <div className="p-8 text-center text-slate-500 text-xs">Cargando historial...</div>
                      ) : movements.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 text-xs">
                          No hay movimientos registrados en el historial de cuenta corriente.
                        </div>
                      ) : (
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase font-bold tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Tipo / Estado Auditoría</th>
                                <th className="px-4 py-3">Descripción</th>
                                <th className="px-4 py-3 text-right">Importe Operación</th>
                                <th className="px-4 py-3 text-right">Saldo Restante</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {movements.map((m) => {
                                const isSale = m.type === 'SALE';
                                const isSettled = m.isSettled === true || (isSale && Number(m.remainingAmount) === 0 && m.remainingAmount !== undefined);
                                const rem = Number(m.remainingAmount ?? 0);

                                return (
                                  <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                                      {format(new Date(m.createdAt), 'dd MMM yyyy - HH:mm', { locale: es })}
                                    </td>
                                    <td className="px-4 py-3">
                                      {m.type === 'PAYMENT' ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                          <ArrowDownLeft className="w-3 h-3" /> Cobro / Pago
                                        </span>
                                      ) : isSettled ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                          <Check className="w-3 h-3" /> Saldada / Cancelada
                                        </span>
                                      ) : rem < Number(m.amount) ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                          <ArrowUpRight className="w-3 h-3" /> Pago Parcial
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300">
                                          <ArrowUpRight className="w-3 h-3" /> Deuda Pendiente
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                                      {m.description || 'Sin descripción'}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold text-xs ${isSale ? 'text-slate-800 dark:text-slate-200' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                      {isSale ? '+' : '-'}{formatCurrency(Number(m.amount))}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-500">
                                      {isSale ? (isSettled ? '$0,00' : formatCurrency(rem)) : '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Inline: Registrar Pago de Deuda */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Registrar Pago a Cta. Cte.</h3>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterPayment} className="space-y-4">
              {activeCashSession && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      🏢 {activeCashSession.warehouse?.name || activeCashSession.cashRegister?.warehouse?.name || 'Casa Central'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-extrabold">
                      🟢 Caja abierta
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 font-medium">
                    {activeCashSession.cashRegister?.name || 'Caja Principal'} ({activeCashSession.cashRegister?.code || activeCashSession.id?.slice(0, 8)})
                  </div>
                </div>
              )}

              {paymentError && (
                <div className="p-3 text-xs text-red-700 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200">
                  {paymentError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Monto a Abonar / Cobrar ($ ARS) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-base font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Deuda actual pendiente: {formatCurrency(currentDebt)}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Medio de Pago <span className="text-red-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full text-sm font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="CASH">Efectivo</option>
                  <option value="TRANSFER">Transferencia Bancaria</option>
                  <option value="MERCADO_PAGO">Mercado Pago</option>
                  <option value="DEBIT_CARD">Tarjeta Débito</option>
                  <option value="CREDIT_CARD">Tarjeta Crédito</option>
                </select>
              </div>

              {Number(paymentAmount) > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2 text-xs shadow-sm">
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span className="font-medium">Monto Original (Reducción Deuda):</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                      {formatCurrency(Number(paymentAmount))}
                    </span>
                  </div>

                  {adjustmentCalculation.type !== 'NONE' && (
                    <div className={`flex justify-between items-center font-semibold ${
                      adjustmentCalculation.type === 'DISCOUNT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      <span>
                        {adjustmentCalculation.label} ({adjustmentCalculation.valueType === 'PERCENTAGE' ? `${adjustmentCalculation.rawValue}%` : `$${adjustmentCalculation.rawValue}`}):
                      </span>
                      <span className="font-mono font-bold">
                        {adjustmentCalculation.type === 'DISCOUNT' ? '-' : '+'}{formatCurrency(adjustmentCalculation.rawAdjustmentAmount)}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex justify-between items-center font-bold text-slate-900 dark:text-white text-xs">
                    <span>Total Final a Cobrar (Ingreso Caja):</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 text-sm font-black">
                      {formatCurrency(adjustmentCalculation.finalTotal)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Concepto / Observaciones
                </label>
                <input
                  type="text"
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                  placeholder="Ej. Entrega parcial en efectivo / Recibo Nro 123"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm disabled:opacity-50"
                >
                  {submittingPayment ? 'Registrando...' : 'Confirmar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL DE HISTORIAL COMPLETO DE FIDELIZACIÓN */}
      {isFullHistoryOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Award className="w-5 h-5 text-amber-500" /> Historial de Puntos — {customer?.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsFullHistoryOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-[50vh] pr-1">
              <CustomerPointsHistoryTable customerId={customerId} onViewSale={setSelectedSaleId} />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setIsFullHistoryOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-bold text-xs rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedSaleId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 font-sans">
                <FileText className="w-5 h-5 text-indigo-500" /> Detalle de Venta
              </h3>
              <button
                type="button"
                onClick={() => setSelectedSaleId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {loadingSale ? (
              <div className="p-8 text-center text-slate-500 text-xs">Cargando detalles de la venta...</div>
            ) : !saleData ? (
              <div className="p-8 text-center text-slate-500 text-xs">No se pudieron cargar los detalles de esta venta.</div>
            ) : (
              <div className="space-y-4 text-xs overflow-y-auto max-h-[60vh] pr-1">
                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 dark:border-slate-800 pb-3 font-semibold text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-slate-400">Comprobante:</span>
                    <p className="text-slate-900 dark:text-white font-mono text-sm font-black mt-0.5">
                      {saleData.documentType?.code || 'FAC'}-{String(saleData.documentNumber).padStart(6, '0')}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Fecha:</span>
                    <p className="text-slate-900 dark:text-white mt-0.5 font-mono">
                      {format(new Date(saleData.createdAt), 'dd/MM/yyyy - HH:mm')}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-white mb-2 uppercase tracking-wider text-[10px] text-slate-400">Productos</h4>
                  <div className="border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {saleData.items?.map((item: any) => (
                      <div key={item.id} className="p-2.5 flex justify-between items-center hover:bg-slate-50/40 dark:hover:bg-slate-800/40">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{item.product?.name || 'Producto Sin Nombre'}</p>
                          <p className="text-slate-400 font-mono text-[10px] mt-0.5">{item.quantity} x {formatCurrency(Number(item.unitPrice))}</p>
                        </div>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(Number(item.totalAmount))}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5 font-semibold text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-mono">{formatCurrency(Number(saleData.subtotal))}</span>
                  </div>
                  {Number(saleData.discountAmount) > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-450 font-bold">
                      <span>Descuento:</span>
                      <span className="font-mono">-{formatCurrency(Number(saleData.discountAmount))}</span>
                    </div>
                  )}
                  {Number(saleData.pointsDiscountAmount) > 0 && (
                    <div className="flex justify-between text-rose-605 dark:text-rose-400 font-bold">
                      <span>Descuento por Puntos:</span>
                      <span className="font-mono">-{formatCurrency(Number(saleData.pointsDiscountAmount))}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1.5 font-black text-slate-900 dark:text-white text-sm">
                    <span>Total:</span>
                    <span className="font-mono text-indigo-650 dark:text-indigo-400">{formatCurrency(Number(saleData.totalAmount))}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setSelectedSaleId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-bold text-xs rounded-xl"
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

// Helper table component for paginated points history
const CustomerPointsHistoryTable: React.FC<{ customerId: string | null; onViewSale: (saleId: string) => void }> = ({ customerId, onViewSale }) => {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const { data, isLoading } = useQuery({
    queryKey: ['posCustomerPointsHistoryFull', customerId, page],
    queryFn: async () => {
      const res = await api.get('/points/history', {
        params: { customerId, page, limit }
      });
      return res.data;
    },
    enabled: !!customerId,
  });

  const items = data?.data || [];
  const pagination = data?.pagination || { total: 0, totalPages: 1 };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500 text-xs">Cargando historial de puntos...</div>;
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 text-xs font-medium">
          No hay registros de puntos.
        </div>
      ) : (
        <>
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3 text-right">Puntos</th>
                  <th className="px-4 py-3 text-right">Saldo resultante</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((h: any) => {
                  const isPositive = h.points > 0;
                  const mapReason = (r: string) => {
                    const mapping: Record<string, string> = {
                      'SALE': 'Venta',
                      'SALE_CANCEL': 'Anulación de Venta',
                      'REDEEM': 'Canje',
                      'REDEEM_CANCEL': 'Anulación de Canje',
                      'MANUAL': 'Ajuste Manual',
                      'EXPIRATION': 'Vencimiento',
                      'BONUS': 'Acreditación Especial',
                      'MIGRATION': 'Migración',
                      'PROMOTION': 'Promoción'
                    };
                    return mapping[r] || r;
                  };

                  return (
                    <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                        {format(new Date(h.createdAt), 'dd/MM/yyyy - HH:mm')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                          h.type === 'EARN'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-350 border-emerald-200/50'
                            : h.type === 'REDEEM'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200/50'
                            : h.type === 'EXPIRED'
                            ? 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200/30'
                            : h.type === 'ADJUSTMENT'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200/50'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-305 border-rose-200/50' // CANCEL
                        }`}>
                          {h.type === 'EARN'
                            ? 'Acreditación'
                            : h.type === 'REDEEM'
                            ? 'Canje'
                            : h.type === 'EXPIRED'
                            ? 'Vencimiento'
                            : h.type === 'ADJUSTMENT'
                            ? 'Ajuste'
                            : 'Anulación'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-750 dark:text-slate-250">
                        {mapReason(h.reason)}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold font-mono text-sm ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPositive ? `+${h.points}` : h.points}
                      </td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-slate-800 dark:text-slate-200">
                        {h.balanceAfter}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-450 max-w-[150px] truncate" title={h.description}>
                        {h.description || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {h.saleId && (
                          <button
                            type="button"
                            onClick={() => onViewSale(h.saleId)}
                            className="text-indigo-650 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-extrabold text-xs flex items-center gap-0.5 hover:underline"
                          >
                            ⭐ Ver Venta
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center text-xs pt-1">
            <span className="text-slate-500">Pág. {page} de {pagination.totalPages} ({pagination.total} registros)</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="py-1 px-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                className="py-1 px-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
