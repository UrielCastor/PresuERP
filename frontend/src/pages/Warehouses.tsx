import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  Loader2,
  Warehouse,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MapPin,
  User,
  Phone,
  Mail,
  FileText,
  Star,
  MoreVertical,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { warehouseApi, Warehouse as WarehouseType } from '../services/warehouse.service';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyStateGuide } from '../components/ui/EmptyStateGuide';

const warehouseFormSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  code: z.string().optional().nullable().or(z.literal('')),
  description: z.string().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable().or(z.literal('')),
  managerName: z.string().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable().or(z.literal('')),
  email: z.string().email('Email inválido Plain').optional().nullable().or(z.literal('')),
  isMain: z.boolean().default(false),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  changeReason: z.string().optional().nullable().or(z.literal('')),
});

type WarehouseFormData = z.infer<typeof warehouseFormSchema>;

export const Warehouses: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'MAIN'>('ALL');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WarehouseType | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteResult, setDeleteResult] = useState<{ id: string; status: string; matches: boolean; message: string } | null>(null);
  
  const [apiError, setApiError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const canCreate = hasPermission('warehouses:create');
  const canUpdate = hasPermission('warehouses:update');
  const canDelete = hasPermission('warehouses:delete');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<WarehouseFormData>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      address: '',
      managerName: '',
      phone: '',
      email: '',
      isMain: false,
      status: 'ACTIVE',
      changeReason: '',
    },
  });

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: warehouseApi.list,
  });

  const createMutation = useMutation({
    mutationFn: warehouseApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.message || 'Error al crear el depósito');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => warehouseApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.message || 'Error al actualizar el depósito');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => warehouseApi.delete(id, reason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setDeleteTarget(null);
      setDeleteReason('');
      setDeleteResult(data);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'No se pudo eliminar el depósito');
      setDeleteTarget(null);
      setDeleteReason('');
    },
  });

  const handleOpenCreateModal = () => {
    setEditingWarehouse(null);
    setApiError(null);
    reset({
      name: '',
      code: '',
      description: '',
      address: '',
      managerName: '',
      phone: '',
      email: '',
      isMain: false,
      status: 'ACTIVE',
      changeReason: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (warehouse: WarehouseType) => {
    setEditingWarehouse(warehouse);
    setApiError(null);
    setValue('name', warehouse.name);
    setValue('code', warehouse.code || '');
    setValue('description', warehouse.description || '');
    setValue('address', warehouse.address || '');
    setValue('managerName', warehouse.managerName || '');
    setValue('phone', warehouse.phone || '');
    setValue('email', warehouse.email || '');
    setValue('isMain', warehouse.isMain);
    setValue('status', warehouse.status);
    setValue('changeReason', '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingWarehouse(null);
    setApiError(null);
    reset();
  };

  const onSubmit = async (data: WarehouseFormData) => {
    setApiError(null);

    // Validate email field separately if empty to bypass zod .email() check for empty string
    let parsedEmail: string | null = null;
    if (data.email && data.email.trim() !== '') {
      // Small regex validation double-check since zod helper is strict
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        setApiError('Por favor, ingresa un correo electrónico válido');
        return;
      }
      parsedEmail = data.email.trim();
    }

    if (editingWarehouse) {
      if (!data.changeReason || data.changeReason.trim().length < 4) {
        setApiError('El motivo del cambio es obligatorio (Mínimo 4 caracteres)');
        return;
      }

      updateMutation.mutate({
        id: editingWarehouse.id,
        data: {
          name: data.name,
          code: data.code || null,
          description: data.description || null,
          address: data.address || null,
          managerName: data.managerName || null,
          phone: data.phone || null,
          email: parsedEmail,
          isMain: data.isMain,
          status: data.status,
          changeReason: data.changeReason,
        },
      });
    } else {
      createMutation.mutate({
        name: data.name,
        code: data.code || null,
        description: data.description || null,
        address: data.address || null,
        managerName: data.managerName || null,
        phone: data.phone || null,
        email: parsedEmail,
        isMain: data.isMain,
        status: data.status,
      });
    }
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate({ id: deleteTarget.id, reason: deleteReason });
    }
  };

  // Search filter
  const searchFiltered = warehouses.filter((w) => {
    const term = searchTerm.toLowerCase();
    return (
      w.name.toLowerCase().includes(term) ||
      (w.code && w.code.toLowerCase().includes(term)) ||
      (w.managerName && w.managerName.toLowerCase().includes(term)) ||
      (w.address && w.address.toLowerCase().includes(term))
    );
  });

  // Type filter
  const finalFiltered = searchFiltered.filter((w) => {
    if (filterType === 'ACTIVE') return w.status === 'ACTIVE';
    if (filterType === 'INACTIVE') return w.status === 'INACTIVE';
    if (filterType === 'MAIN') return w.isMain === true;
    return true;
  });

  const handleToggleMain = (warehouse: WarehouseType) => {
    if (warehouse.isMain) return;
    updateMutation.mutate({
      id: warehouse.id,
      data: {
        name: warehouse.name,
        code: warehouse.code || null,
        description: warehouse.description || null,
        address: warehouse.address || null,
        managerName: warehouse.managerName || null,
        phone: warehouse.phone || null,
        email: warehouse.email || null,
        isMain: true,
        status: warehouse.status,
        changeReason: 'Marcado como depósito principal',
      },
    });
  };

  const handleToggleStatus = (warehouse: WarehouseType) => {
    const newStatus = warehouse.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    updateMutation.mutate({
      id: warehouse.id,
      data: {
        name: warehouse.name,
        code: warehouse.code || null,
        description: warehouse.description || null,
        address: warehouse.address || null,
        managerName: warehouse.managerName || null,
        phone: warehouse.phone || null,
        email: warehouse.email || null,
        isMain: warehouse.isMain,
        status: newStatus,
        changeReason: `Cambio de estado a ${newStatus === 'ACTIVE' ? 'Activo' : 'Inactivo'}`,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. ENCABEZADO ESTILO POS */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">🏬</span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Depósitos / Almacenes
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Gestiona los depósitos físicos, sucursales y centros de almacenamiento de stock de tu empresa.
          </p>
        </div>

        {canCreate && (
          <div className="flex items-center gap-3">
            <Button
              onClick={handleOpenCreateModal}
              leftIcon={<Plus className="h-4 w-4" />}
              className="text-xs font-bold shadow-md rounded-xl"
            >
              + Nuevo Depósito
            </Button>
          </div>
        )}
      </div>

      {/* 2. BARRA DE HERRAMIENTAS Y FILTROS TIPO CHIPS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3.5 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre, código o responsable..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Filtros Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              filterType === 'ALL'
                ? 'bg-primary-500 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterType('ACTIVE')}
            className={`px-3 py-1.5 text-xs font-bold rounded-all ${
              filterType === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Activos
          </button>
          <button
            onClick={() => setFilterType('INACTIVE')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              filterType === 'INACTIVE'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Inactivos
          </button>
          <button
            onClick={() => setFilterType('MAIN')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              filterType === 'MAIN'
                ? 'bg-amber-500 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Solo Principal
          </button>

          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-2">
            Total: {finalFiltered.length} {finalFiltered.length === 1 ? 'depósito' : 'depósitos'}
          </div>
        </div>
      </div>

      {/* 3. CARDS RESPONSIVE DE DEPÓSITOS */}
      {isLoading ? (
        <div className="min-h-[250px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      ) : finalFiltered.length === 0 ? (
        <div className="min-h-[280px] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
          <Warehouse className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No existen depósitos registrados</h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            {searchTerm || filterType !== 'ALL'
              ? 'No se encontraron depósitos que coincidan con la búsqueda o filtros.'
              : 'Comienza creando el primer depósito para tu empresa.'}
          </p>
          {!searchTerm && filterType === 'ALL' && canCreate && (
            <Button onClick={handleOpenCreateModal} className="mt-4 flex items-center gap-2 text-xs font-bold rounded-xl shadow-md">
              <Plus className="h-4 w-4" />
              Crear primer depósito
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
          {finalFiltered.map((warehouse) => {
            const isInactive = warehouse.status === 'INACTIVE';

            return (
              <div
                key={warehouse.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 relative group"
              >
                {/* Header Card: Fila Superior con Nombre & Badge Estado */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg leading-none">🏬</span>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug truncate">
                        {warehouse.name}
                      </h3>
                    </div>

                    {!isInactive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800/50 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        Inactivo
                      </span>
                    )}
                  </div>

                  {/* Fila Código y Principal */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      Código: {warehouse.code || 'S/C'}
                    </span>

                    {warehouse.isMain && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shadow-2xs">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        Principal
                      </span>
                    )}
                  </div>
                </div>

                {/* Cuerpo: Información de Dirección, Responsable, Teléfono, Email */}
                <div className="space-y-2 bg-slate-50/80 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 text-xs">
                  <div className="flex items-start gap-1.5">
                    <span className="shrink-0 text-slate-400">📍</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium line-clamp-2">
                      {warehouse.address || <span className="italic text-slate-400">—</span>}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 text-slate-400">👤</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                      {warehouse.managerName || <span className="italic text-slate-400">—</span>}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="shrink-0 text-slate-400">📞</span>
                      <span className="text-slate-700 dark:text-slate-300 font-mono font-medium truncate">
                        {warehouse.phone || <span className="italic text-slate-400">—</span>}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 min-w-0">
                      <span className="shrink-0 text-slate-400">✉️</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                        {warehouse.email || <span className="italic text-slate-400">—</span>}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acciones: Botón Principal Ancho (Editar Depósito) + Menú Tres Puntos (⋮) */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  {canUpdate && (
                    <Button
                      onClick={() => handleOpenEditModal(warehouse)}
                      className="flex-1 text-xs font-bold py-2 rounded-xl shadow-2xs flex items-center justify-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Editar Depósito
                    </Button>
                  )}

                  {/* Menú Tres Puntos (⋮) */}
                  {(canUpdate || canDelete) && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === warehouse.id ? null : warehouse.id);
                        }}
                        className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        title="Más acciones"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === warehouse.id && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 bottom-full mb-1 z-30 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 text-xs divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95 duration-100">
                            {canUpdate && (
                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleOpenEditModal(warehouse);
                                  }}
                                  className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                                  Editar Depósito
                                </button>

                                {!warehouse.isMain && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleToggleMain(warehouse);
                                    }}
                                    className="w-full text-left px-3 py-2 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-2 font-medium"
                                  >
                                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                                    Marcar como principal
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleToggleStatus(warehouse);
                                  }}
                                  className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                                >
                                  {warehouse.status === 'ACTIVE' ? (
                                    <>
                                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                                      Desactivar Depósito
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                      Activar Depósito
                                    </>
                                  )}
                                </button>
                              </div>
                            )}

                            {canDelete && (
                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setDeleteTarget(warehouse);
                                    setDeleteReason('');
                                  }}
                                  className="w-full text-left px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 font-medium"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  Eliminar Depósito
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal Estilo Editar Producto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 flex flex-col max-h-[90vh] transition-all duration-300">
            {/* Header del Modal */}
            <div className="flex-none pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <button
                onClick={handleCloseModal}
                className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xl leading-none">🏬</span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white pr-6">
                  {editingWarehouse ? 'Editar Depósito' : 'Nuevo Depósito'}
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Registra la información física, responsable y configuración del centro de almacenamiento.
              </p>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pr-1">
              <form id="warehouse-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3.5 pt-1">
                {apiError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg text-xs text-red-600 dark:text-red-400 font-medium">
                    {apiError}
                  </div>
                )}

                {/* CARD 1: 📦 INFORMACIÓN GENERAL */}
                <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    <span className="text-base leading-none">📦</span>
                    <span>Información General</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Nombre del Depósito <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        {...register('name')}
                        placeholder="Ej: Depósito Central / Sucursal Belgrano"
                        className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                          errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700'
                        }`}
                      />
                      {errors.name && (
                        <p className="mt-1 text-xs text-red-500 font-medium">{errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Código Interno
                      </label>
                      <input
                        type="text"
                        {...register('code')}
                        placeholder="Ej: DEP-01"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Estado
                      </label>
                      <select
                        {...register('status')}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                      >
                        <option value="ACTIVE">Activo</option>
                        <option value="INACTIVE">Inactivo</option>
                      </select>
                    </div>

                    <div className="flex items-center pt-5">
                      <label htmlFor="isMainCheckbox" className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          id="isMainCheckbox"
                          {...register('isMain')}
                          className="h-4 w-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                        />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Depósito Principal (POS)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* CARD 2: 📍 UBICACIÓN & RESPONSABLE */}
                <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    <span className="text-base leading-none">📍</span>
                    <span>Ubicación & Responsable</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Dirección Física
                    </label>
                    <input
                      type="text"
                      {...register('address')}
                      placeholder="Ej: Av. Industrial 1234, CABA"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Encargado / Responsable
                      </label>
                      <input
                        type="text"
                        {...register('managerName')}
                        placeholder="Ej: Carlos Gómez"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Teléfono
                      </label>
                      <input
                        type="text"
                        {...register('phone')}
                        placeholder="Ej: +54 9 11 9876-5432"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Email Responsable
                      </label>
                      <input
                        type="text"
                        {...register('email')}
                        placeholder="carlos@empresa.com"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Descripción / Observaciones
                    </label>
                    <textarea
                      {...register('description')}
                      placeholder="Ej: Depósito principal de mercaderías e insumos generales."
                      rows={2}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
                    />
                  </div>
                </div>

                {/* CARD 3: 🛡 AUDITORÍA */}
                {editingWarehouse && (
                  <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                      <span className="text-base leading-none">🛡</span>
                      <span>Auditoría</span>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-amber-900 dark:text-amber-400 mb-1">
                        Motivo del Cambio <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        {...register('changeReason')}
                        placeholder="Explique el motivo del cambio (mínimo 4 caracteres)..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/80 rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                      />
                    </div>
                  </div>
                )}
              </form>
            </div>

            {/* Modal Footer - Fixed */}
            <div className="flex-none pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={handleCloseModal} disabled={isSubmitting} className="text-xs px-4 rounded-lg">
                Cancelar
              </Button>
              <Button type="submit" form="warehouse-form" disabled={isSubmitting} className="text-xs px-6 font-bold shadow-md rounded-lg">
                {isSubmitting ? (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </div>
                ) : (
                  editingWarehouse ? 'Guardar Cambios' : 'Crear Depósito'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-205 dark:border-slate-800 shadow-2xl p-6">
            <div className="h-12 w-12 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">¿Eliminar Depósito?</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Estás a punto de eliminar el depósito:
            </p>
            
            <div className="my-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-left border border-slate-100 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-205">Nombre: <span className="font-medium text-slate-950 dark:text-white">{deleteTarget.name}</span></p>
              {deleteTarget.code && (
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-250 mt-1">Código: <span className="font-mono text-slate-950 dark:text-white">{deleteTarget.code}</span></p>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              * Si el depósito contiene stock registered, compras o traslados, la eliminación se procesará como una <strong>desactivación lógica automática (INACTIVE)</strong> para conservar la trazabilidad.
            </p>

            {/* Request Delete Reason */}
            <div className="mb-4 text-left">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                Motivo de la Eliminación <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Ej: Cierre de la sucursal de distribución oeste"
                className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
              />
              <p className="mt-1 text-[10px] text-slate-450">
                Mínimo 4 caracteres necesarios para habilitar la eliminación.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteReason(''); }} disabled={deleteMutation.isPending}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending || deleteReason.trim().length < 4}
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Sí, Eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Result Display Modal (Notification popup of backend action outcome) */}
      {deleteResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-slate-205 dark:border-slate-800 shadow-2xl p-6 text-center">
            <div className={`mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4 ${
              deleteResult.matches
                ? 'bg-yellow-50 dark:bg-yellow-950/20 text-yellow-550 dark:text-yellow-400'
                : 'bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400'
            }`}>
              {deleteResult.matches ? <AlertTriangle className="h-6 w-6" /> : <CheckCircle className="h-6 w-6" />}
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {deleteResult.matches ? 'Desactivación Aplicada' : 'Depósito Eliminado'}
            </h3>
            
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {deleteResult.message}
            </p>
            
            <div className="mt-6 flex justify-center">
              <Button onClick={() => setDeleteResult(null)}>
                Entendido
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
