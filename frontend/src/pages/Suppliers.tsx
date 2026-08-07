import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { swalSuccess, handleApiError } from '../utils/swal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Edit2, Trash2, Search, X, Loader2, Truck, AlertTriangle, CheckCircle, XCircle, MoreVertical } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supplierApi, Supplier } from '../services/supplier.service';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyStateGuide } from '../components/ui/EmptyStateGuide';

const supplierFormSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  taxId: z.string().optional().nullable().or(z.literal('')),
  email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable().or(z.literal('')),
  contactName: z.string().optional().nullable().or(z.literal('')),
  isActive: z.boolean().default(true),
});

type SupplierFormData = z.infer<typeof supplierFormSchema>;

export const Suppliers: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const canCreate = hasPermission('suppliers:create');
  const canUpdate = hasPermission('suppliers:update');
  const canDelete = hasPermission('suppliers:delete');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: { name: '', taxId: '', email: '', phone: '', address: '', contactName: '', isActive: true },
  });

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: supplierApi.list,
  });

  const createMutation = useMutation({
    mutationFn: supplierApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.message || 'Error al crear el proveedor');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SupplierFormData }) => supplierApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.message || 'Error al actualizar el proveedor');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: supplierApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setDeleteTarget(null);
      swalSuccess('Proveedor Eliminado', 'El proveedor ha sido eliminado correctamente.');
    },
    onError: (err: any) => {
      handleApiError(err, 'Error al Eliminar');
      setDeleteTarget(null);
    },
  });

  const handleOpenCreateModal = () => {
    setEditingSupplier(null);
    setApiError(null);
    reset({ name: '', taxId: '', email: '', phone: '', address: '', contactName: '', isActive: true });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setApiError(null);
    setValue('name', supplier.name);
    setValue('taxId', supplier.taxId || '');
    setValue('email', supplier.email || '');
    setValue('phone', supplier.phone || '');
    setValue('address', supplier.address || '');
    setValue('contactName', supplier.contactName || '');
    setValue('isActive', supplier.isActive);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
    setApiError(null);
    reset();
  };

  const onSubmit = async (data: SupplierFormData) => {
    setApiError(null);
    const payload = {
      ...data,
      taxId: data.taxId || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      contactName: data.contactName || null,
    };
    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.taxId && s.taxId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.contactName && s.contactName.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  return (
    <div className="space-y-6">
      {/* 1. ENCABEZADO ESTILO POS */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">🏭</span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Proveedores
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Gestiona los proveedores de productos y materiales de tu empresa.
          </p>
        </div>

        {canCreate && (
          <div className="flex items-center gap-3">
            <Button
              onClick={handleOpenCreateModal}
              leftIcon={<Plus className="h-4 w-4" />}
              className="text-xs font-bold shadow-md rounded-xl"
            >
              + Nuevo Proveedor
            </Button>
          </div>
        )}
      </div>

      {/* 2. BARRA DE HERRAMIENTAS ESTILO POS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3.5 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre, Código, CUIT, email o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3">
          {searchTerm.trim() && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 px-2 py-1 transition-colors"
            >
              Limpiar búsqueda
            </button>
          )}
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total: {filteredSuppliers.length} {filteredSuppliers.length === 1 ? 'proveedor' : 'proveedores'}
          </div>
        </div>
      </div>

      {/* 3. CARDS RESPONSIVE DE PROVEEDORES */}
      {isLoading ? (
        <div className="min-h-[250px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="min-h-[280px] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
          <Truck className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No existen proveedores registrados</h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            {searchTerm
              ? 'No se encontraron proveedores que coincidan con la búsqueda.'
              : 'Comienza registrando tu primer proveedor para asociarlo a tus compras y stocks.'}
          </p>
          {!searchTerm && canCreate && (
            <Button onClick={handleOpenCreateModal} className="mt-4 flex items-center gap-2 text-xs font-bold rounded-xl shadow-md">
              <Plus className="h-4 w-4" />
              Crear primer proveedor
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
          {filteredSuppliers.map((supplier) => {
            const isInactive = !supplier.isActive;

            return (
              <div
                key={supplier.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 relative group"
              >
                {/* Header Card: Fila Superior con Nombre & Badge Estado + Subtítulo Email */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg leading-none">🏭</span>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug truncate">
                        {supplier.name}
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

                  {/* Subtítulo Email */}
                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 min-h-[20px]">
                    <span className="shrink-0">✉️</span>
                    <span className="truncate">{supplier.email || <span className="italic text-slate-400">—</span>}</span>
                  </div>
                </div>

                {/* Información: Grilla con CUIT, Contacto, Teléfono */}
                <div className="grid grid-cols-3 gap-2 text-center bg-slate-50/80 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex flex-col items-center justify-center min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-0.5 truncate">
                      <span>🏷️</span> CUIT
                    </span>
                    <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 truncate w-full">
                      {supplier.taxId || '—'}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-0.5 truncate">
                      <span>👤</span> Contacto
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate w-full">
                      {supplier.contactName || '—'}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-0.5 truncate">
                      <span>📞</span> Teléfono
                    </span>
                    <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 truncate w-full">
                      {supplier.phone || '—'}
                    </span>
                  </div>
                </div>

                {/* Acciones: Botón Principal Ancho (Editar Proveedor) + Menú Tres Puntos (⋮) */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  {canUpdate && (
                    <Button
                      onClick={() => handleOpenEditModal(supplier)}
                      className="flex-1 text-xs font-bold py-2 rounded-xl shadow-2xs flex items-center justify-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Editar Proveedor
                    </Button>
                  )}

                  {/* Menú Tres Puntos (⋮) */}
                  {(canUpdate || canDelete) && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === supplier.id ? null : supplier.id);
                        }}
                        className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        title="Más acciones"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === supplier.id && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 bottom-full mb-1 z-30 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 text-xs divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95 duration-100">
                            {canUpdate && (
                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleOpenEditModal(supplier);
                                  }}
                                  className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                                  Editar Proveedor
                                </button>
                              </div>
                            )}

                            {canDelete && (
                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setDeleteTarget(supplier);
                                  }}
                                  className="w-full text-left px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 font-medium"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  Eliminar Proveedor
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

      {/* Create/Edit Modal Estilo Editar Producto */}
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
                <span className="text-xl leading-none">🏭</span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white pr-6">
                  {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Registra la información corporativa, fiscal y de contacto del proveedor.
              </p>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pr-1">
              <form id="supplier-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3.5 pt-1">
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

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Nombre o Razón Social <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      {...register('name')}
                      placeholder="Ej: Distribuidora Norte S.A."
                      className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                        errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {errors.name && (
                      <p className="mt-1 text-xs text-red-500 font-medium">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        CUIT / RUT / Identificador Fiscal
                      </label>
                      <input
                        type="text"
                        {...register('taxId')}
                        placeholder="Ej: 30-12345678-9"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Estado
                      </label>
                      <select
                        {...register('isActive', { setValueAs: (v) => v === 'true' || v === true })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                      >
                        <option value="true">Activo</option>
                        <option value="false">Inactivo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* CARD 2: 📞 CONTACTO & COMUNICACIÓN */}
                <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    <span className="text-base leading-none">📞</span>
                    <span>Contacto & Comunicación</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Correo Electrónico
                      </label>
                      <input
                        type="email"
                        {...register('email')}
                        placeholder="contacto@proveedor.com"
                        className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                          errors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700'
                        }`}
                      />
                      {errors.email && (
                        <p className="mt-1 text-xs text-red-500 font-medium">{errors.email.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Teléfono / Celular
                      </label>
                      <input
                        type="text"
                        {...register('phone')}
                        placeholder="Ej: +54 11 1234-5678"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Persona de Contacto
                    </label>
                    <input
                      type="text"
                      {...register('contactName')}
                      placeholder="Ej: Juan Pérez (Gerente Comercial)"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                  </div>
                </div>

                {/* CARD 3: 📍 DIRECCIÓN */}
                <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-2 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    <span className="text-base leading-none">📍</span>
                    <span>Ubicación & Dirección</span>
                  </div>
                  <input
                    type="text"
                    {...register('address')}
                    placeholder="Ej: Av. Industrial 4500, Parque Industrial"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>
              </form>
            </div>

            {/* Modal Footer - Fixed */}
            <div className="flex-none pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={handleCloseModal} disabled={isSubmitting} className="text-xs px-4 rounded-lg">
                Cancelar
              </Button>
              <Button type="submit" form="supplier-form" disabled={isSubmitting} className="text-xs px-6 font-bold shadow-md rounded-lg">
                {isSubmitting ? (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </div>
                ) : (
                  editingSupplier ? 'Guardar Cambios' : 'Crear Proveedor'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center">
            <div className="mx-auto h-12 w-12 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">¿Eliminar Proveedor?</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Estás a punto de eliminar al proveedor <strong className="text-slate-900 dark:text-white">{deleteTarget.name}</strong>. Esta acción no se puede deshacer si el proveedor no tiene productos o compras asociadas.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={confirmDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Eliminando...' : 'Sí, Eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
