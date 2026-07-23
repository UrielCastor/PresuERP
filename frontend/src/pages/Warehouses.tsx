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
  Star
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { warehouseApi, Warehouse as WarehouseType } from '../services/warehouse.service';
import { Button } from '../components/ui/Button';
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Depósitos / Almacenes"
        subtitle="Gestiona los depósitos físicos, sucursales y almacenamiento de stock de la empresa."
        action={
          canCreate ? (
            <Button onClick={handleOpenCreateModal} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Depósito
            </Button>
          ) : undefined
        }
      />

      {/* Filters and Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, código o responsable..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-350 dark:border-slate-800 rounded-lg bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'ALL'
                ? 'bg-primary-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterType('ACTIVE')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'ACTIVE'
                ? 'bg-green-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Activos
          </button>
          <button
            onClick={() => setFilterType('INACTIVE')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'INACTIVE'
                ? 'bg-red-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Inactivos
          </button>
          <button
            onClick={() => setFilterType('MAIN')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'MAIN'
                ? 'bg-yellow-550 text-white dark:bg-yellow-600'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Depósito Principal
          </button>
          <div className="text-xs text-slate-500 dark:text-slate-400 ml-2">
            Total: {finalFiltered.length}
          </div>
        </div>
      </div>

      {/* Table grid */}
      {isLoading ? (
        <div className="min-h-[200px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      ) : finalFiltered.length === 0 ? (
        <EmptyStateGuide
          title="No se encontraron depósitos"
          description={
            searchTerm || filterType !== 'ALL'
              ? 'Prueba variando los parámetros de búsqueda o filtros.'
              : 'Comienza creando el primer depósito para tu empresa.'
          }
          onAction={(!searchTerm && filterType === 'ALL' && canCreate) ? handleOpenCreateModal : undefined}
          actionText="Nuevo Depósito"
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre / Código</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dirección</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Responsable</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Principal</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado</th>
                  {(canUpdate || canDelete) && (
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {finalFiltered.map((warehouse) => (
                  <tr key={warehouse.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-920/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-primary-50 dark:bg-primary-950/30 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400">
                          <Warehouse className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                            {warehouse.name}
                            {warehouse.isMain && (
                              <span className="flex h-2 w-2 rounded-full bg-yellow-400" title="Depósito Principal" />
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">
                              {warehouse.code || 'S/C'}
                            </span>
                            {warehouse.description && (
                              <span className="truncate max-w-[150px]">- {warehouse.description}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                      {warehouse.address ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span>{warehouse.address}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No especificada</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {warehouse.managerName ? (
                        <div>
                          <div className="text-sm text-slate-900 dark:text-white flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span>{warehouse.managerName}</span>
                          </div>
                          {(warehouse.phone || warehouse.email) && (
                            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                              {warehouse.phone && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{warehouse.phone}</span>}
                              {warehouse.email && <span className="flex items-center gap-0.5"><Mail className="h-2.5 w-2.5 text-slate-400" />{warehouse.email}</span>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-sm">No definido</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {warehouse.isMain ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-900/30">
                          <Star className="h-3 w-3 fill-current" />
                          Principal
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                          warehouse.status === 'ACTIVE'
                            ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                            : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                        }`}
                      >
                        {warehouse.status === 'ACTIVE' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {warehouse.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {(canUpdate || canDelete) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end gap-2">
                          {canUpdate && (
                            <button
                              onClick={() => handleOpenEditModal(warehouse)}
                              className="p-1.5 text-slate-400 hover:text-primary-600 dark:text-slate-500 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Editar depósito"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => {
                                setDeleteTarget(warehouse);
                                setDeleteReason('');
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                              title="Eliminar depósito"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-y-auto max-h-[90vh]">
            <button
              onClick={handleCloseModal}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white pr-6">
              {editingWarehouse ? 'Editar Depósito' : 'Nuevo Depósito'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {editingWarehouse
                ? 'Modifica los datos del depósito. Debes registrar el motivo del cambio.'
                : 'Registra los datos de almacenamiento del nuevo depósito.'}
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
              {apiError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg text-sm text-red-600 dark:text-red-450 font-medium">
                  {apiError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('name')}
                    placeholder="Ej: Depósito Central"
                    className={`w-full px-3.5 py-2.5 bg-transparent border rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                      errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-350 dark:border-slate-800'
                    }`}
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-500 font-medium">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Código de Depósito
                  </label>
                  <input
                    type="text"
                    {...register('code')}
                    placeholder="Ej: DEP-01"
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Descripción
                </label>
                <textarea
                  {...register('description')}
                  placeholder="Ej: Depósito principal de mercaderías e insumos generales."
                  rows={2}
                  className="w-full px-3.5 py-2.0 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Dirección
                </label>
                <input
                  type="text"
                  {...register('address')}
                  placeholder="Ej: Av. Industrial 1234, CABA"
                  className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Nombre del Responsable / Encargado
                  </label>
                  <input
                    type="text"
                    {...register('managerName')}
                    placeholder="Ej: Carlos Gómez"
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Teléfono del Responsable
                  </label>
                  <input
                    type="text"
                    {...register('phone')}
                    placeholder="Ej: +54 9 11 9876 5432"
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Email del Responsable
                  </label>
                  <input
                    type="text"
                    {...register('email')}
                    placeholder="carlos@empresa.com"
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Estado
                  </label>
                  <select
                    {...register('status')}
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-705 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="INACTIVE">Inactivo</option>
                  </select>
                </div>
              </div>

              {/* isMain Toggle option */}
              <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-150 dark:border-slate-800">
                <input
                  type="checkbox"
                  id="isMainCheckbox"
                  {...register('isMain')}
                  className="h-4.5 w-4.5 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="isMainCheckbox" className="select-none text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <strong>Marcar como depósito principal.</strong>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Solo puede existir un depósito principal por empresa. Si marcas esta casilla, el depósito principal actual se desmarcará automáticamente.
                  </p>
                </label>
              </div>

              {/* changeReason required if editing */}
              {editingWarehouse && (
                <div className="pt-2 border-t border-slate-205 dark:border-slate-800">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Motivo del Cambio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('changeReason')}
                    placeholder="Ej: Actualización de datos de contacto del responsable"
                    className="w-full px-3.5 py-2.5 bg-transparent border border-red-200 dark:border-red-800/40 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                  <p className="mt-1 text-[10px] text-slate-450 dark:text-slate-450">
                    Historial de auditoría obligatorio. Debe ingresar al menos 4 caracteres explicando el cambio.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={handleCloseModal} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando...
                    </div>
                  ) : (
                    'Guardar Depósito'
                  )}
                </Button>
              </div>
            </form>
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
