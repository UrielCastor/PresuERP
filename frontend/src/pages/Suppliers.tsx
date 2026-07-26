import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Edit2, Trash2, Search, X, Loader2, Truck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
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
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'No se pudo eliminar el proveedor');
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
      <PageHeader
        title="Proveedores"
        subtitle="Gestiona los proveedores de productos y materiales de la empresa."
        action={
          canCreate ? (
            <Button onClick={handleOpenCreateModal} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Proveedor
            </Button>
          ) : undefined
        }
      />

      {/* Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Buscar por nombre, CUIT, email o contacto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={Search}
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Total: {filteredSuppliers.length} proveedores
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="min-h-[200px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <EmptyStateGuide
          title="No hay proveedores registrados"
          description={
            searchTerm
              ? 'Prueba variando los parámetros de búsqueda.'
              : 'Comienza registrando tu primer proveedor para asociarlo a tus compras y stocks.'
          }
          onAction={(!searchTerm && canCreate) ? handleOpenCreateModal : undefined}
          actionText="Nuevo Proveedor"
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Proveedor</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CUIT / RUT</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contacto</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado</th>
                  {(canUpdate || canDelete) && (
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-920/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <Truck className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">{supplier.name}</div>
                          {supplier.email && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{supplier.email}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                      {supplier.taxId || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-white">{supplier.contactName || '-'}</div>
                      {supplier.phone && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">{supplier.phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                          supplier.isActive
                            ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                            : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                        }`}
                      >
                        {supplier.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {supplier.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {(canUpdate || canDelete) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end gap-2">
                          {canUpdate && (
                            <button
                              onClick={() => handleOpenEditModal(supplier)}
                              className="p-1.5 text-slate-400 hover:text-primary-600 dark:text-slate-500 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteTarget(supplier)}
                              className="p-1.5 text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                              title="Eliminar"
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

      {/* Create/Edit Modal */}
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
              {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Registra los datos del proveedor para asociarlo a productos.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
              {apiError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg text-sm text-red-655 dark:text-red-450 font-medium">
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
                    placeholder="Ej: Distribuidora Norte"
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
                    CUIT / RUT / RFC
                  </label>
                  <input
                    type="text"
                    {...register('taxId')}
                    placeholder="Ej: 30-12345678-9"
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    {...register('email')}
                    placeholder="contacto@proveedor.com"
                    className={`w-full px-3.5 py-2.5 bg-transparent border rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                      errors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-350 dark:border-slate-800'
                    }`}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-500 font-medium">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    {...register('phone')}
                    placeholder="Ej: +54 11 1234-5678"
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Persona de Contacto
                  </label>
                  <input
                    type="text"
                    {...register('contactName')}
                    placeholder="Ej: Juan Pérez"
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Estado
                  </label>
                  <select
                    {...register('isActive', { setValueAs: (v) => v === 'true' || v === true })}
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-705 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Dirección
                </label>
                <input
                  type="text"
                  {...register('address')}
                  placeholder="Ej: Av. Siempreviva 742"
                  className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

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
                    'Guardar Proveedor'
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
