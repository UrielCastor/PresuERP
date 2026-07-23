import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Edit2, Trash2, Search, X, Loader2, FolderOpen, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { categoryApi, Category } from '../services/category.service';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyStateGuide } from '../components/ui/EmptyStateGuide';

const createCategoryFormSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  description: z.string().optional().nullable(),
});

const editCategoryFormSchema = createCategoryFormSchema.extend({
  changeReason: z.string().min(4, 'El motivo del cambio debe tener al menos 4 caracteres'),
  status: z.string().optional(),
});

type CreateCategoryFormData = z.infer<typeof createCategoryFormSchema>;
type EditCategoryFormData = z.infer<typeof editCategoryFormSchema>;

export const Categories: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);

  const canCreate = hasPermission('categories:create');
  const canUpdate = hasPermission('categories:update');
  const canDelete = hasPermission('categories:delete');

  const currentSchema = editingCategory ? editCategoryFormSchema : createCategoryFormSchema;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EditCategoryFormData>({
    resolver: zodResolver(currentSchema as any),
    defaultValues: { name: '', description: '', changeReason: '', status: 'ACTIVE' },
  });

  // Queries
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryApi.list,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: categoryApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.message || 'Error al crear la categoría');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditCategoryFormData }) => categoryApi.update(id, {
      name: data.name,
      description: data.description,
      status: data.status,
      changeReason: data.changeReason,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.message || 'Error al actualizar la categoría');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => categoryApi.delete(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDeleteTarget(null);
      setDeleteReason('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'No se pudo eliminar la categoría');
      setDeleteTarget(null);
      setDeleteReason('');
    },
  });

  const handleOpenCreateModal = () => {
    setEditingCategory(null);
    setApiError(null);
    reset({ name: '', description: '', changeReason: '', status: 'ACTIVE' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (category: Category) => {
    setEditingCategory(category);
    setApiError(null);
    setValue('name', category.name);
    setValue('description', category.description || '');
    setValue('status', category.status || 'ACTIVE');
    setValue('changeReason', '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setApiError(null);
    reset();
  };

  const onSubmit = async (data: EditCategoryFormData) => {
    setApiError(null);
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data });
    } else {
      createMutation.mutate({ name: data.name, description: data.description });
    }
  };

  const confirmDelete = () => {
    if (deleteTarget && deleteReason.length >= 4) {
      deleteMutation.mutate({ id: deleteTarget.id, reason: deleteReason });
    }
  };

  // Filter categories
  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorías de Productos"
        subtitle="Administra las categorías para clasificar adecuadamente tus productos en el inventario."
        action={
          canCreate ? (
            <Button onClick={handleOpenCreateModal} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nueva Categoría
            </Button>
          ) : undefined
        }
      />

      {/* Search and Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-350 dark:border-slate-800 rounded-lg bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Total: {filteredCategories.length} categorías
        </div>
      </div>

      {/* Categories Table / State */}
      {isLoading ? (
        <div className="min-h-[200px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      ) : filteredCategories.length === 0 ? (
        <EmptyStateGuide
          title="No se encontraron categorías"
          description={
            searchTerm
              ? 'Prueba cambiando los términos de búsqueda o filtros.'
              : 'Comienza registrando tu primera categoría para organizar tus productos.'
          }
          onAction={(!searchTerm && canCreate) ? handleOpenCreateModal : undefined}
          actionText="Nueva Categoría"
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Descripción</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fecha Registro</th>
                  {(canUpdate || canDelete) && (
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredCategories.map((category) => (
                  <tr key={category.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-920/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-955 dark:text-white">
                      {category.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 max-w-md truncate">
                      {category.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                          category.status === 'INACTIVE'
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                            : 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                        }`}
                      >
                        {category.status === 'INACTIVE' ? <XCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                        {category.status === 'INACTIVE' ? 'Inactiva' : 'Activa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                      {new Date(category.createdAt).toLocaleDateString()}
                    </td>
                    {(canUpdate || canDelete) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end gap-2">
                          {canUpdate && (
                            <button
                              onClick={() => handleOpenEditModal(category)}
                              className="p-1.5 text-slate-400 hover:text-primary-600 dark:text-slate-500 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => { setDeleteTarget(category); setDeleteReason(''); }}
                              className="p-1.5 text-slate-400 hover:text-red-600 dark:text-slate-550 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
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

      {/* Modal Creación/Edición */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <button
              onClick={handleCloseModal}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white pr-6">
              {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Registra los datos requeridos para clasificar productos.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
              {apiError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg text-sm text-red-655 dark:text-red-450 font-medium">
                  {apiError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Nombre de Categoría <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Almacén, Bebidas, Lácteos"
                  {...register('name')}
                  className={`w-full px-3.5 py-2.5 bg-transparent border rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                    errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-350 dark:border-slate-800'
                  }`}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500 font-medium">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Descripción (Opcional)
                </label>
                <textarea
                  placeholder="Breve descripción de la categoría..."
                  rows={3}
                  {...register('description')}
                  className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              {editingCategory && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Estado
                  </label>
                  <select
                    {...register('status')}
                    className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-705 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  >
                    <option value="ACTIVE">Activa</option>
                    <option value="INACTIVE">Inactiva</option>
                  </select>
                </div>
              )}

              {/* Change Reason (only for edit) */}
              {editingCategory && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg p-4">
                  <label className="block text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-2">
                    Motivo del Cambio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('changeReason')}
                    placeholder="Describe el motivo del cambio..."
                    className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all ${
                      errors.changeReason ? 'border-red-500 focus:ring-red-500' : 'border-amber-300 dark:border-amber-700'
                    }`}
                  />
                  {errors.changeReason && (
                    <p className="mt-1 text-xs text-red-500 font-medium">{errors.changeReason.message}</p>
                  )}
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
                    'Guardar Categoría'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal with Reason */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center">
            <div className="mx-auto h-12 w-12 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">¿Eliminar Categoría?</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Estás a punto de eliminar la categoría <strong className="text-slate-900 dark:text-white">{deleteTarget.name}</strong>. Si posee productos asociados será desactivada.
            </p>
            <div className="mt-4 text-left">
              <label className="block text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-2">
                Motivo de la eliminación <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Describe el motivo..."
                className="w-full px-3.5 py-2.5 bg-transparent border border-amber-300 dark:border-amber-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              />
              {deleteReason.length > 0 && deleteReason.length < 4 && (
                <p className="mt-1 text-xs text-red-500 font-medium">El motivo debe tener al menos 4 caracteres</p>
              )}
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteReason(''); }} disabled={deleteMutation.isPending}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={confirmDelete} disabled={deleteMutation.isPending || deleteReason.length < 4}>
                {deleteMutation.isPending ? 'Eliminando...' : 'Sí, Eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
