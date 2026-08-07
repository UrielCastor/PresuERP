import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { swalSuccess, handleApiError } from '../utils/swal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Edit2, Trash2, Search, X, Loader2, FolderOpen, AlertTriangle, CheckCircle, XCircle, MoreVertical } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { categoryApi, Category } from '../services/category.service';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
      swalSuccess('Categoría Eliminada', 'La categoría ha sido eliminada correctamente.');
    },
    onError: (err: any) => {
      handleApiError(err, 'Error al Eliminar');
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
      {/* 1. ENCABEZADO ESTILO POS */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">📂</span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Categorías de Productos
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Administra las categorías para organizar correctamente el inventario de tu empresa.
          </p>
        </div>

        {canCreate && (
          <div className="flex items-center gap-3">
            <Button
              onClick={handleOpenCreateModal}
              leftIcon={<Plus className="h-4 w-4" />}
              className="text-xs font-bold shadow-md rounded-xl"
            >
              + Nueva Categoría
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
            placeholder="Buscar por nombre o descripción..."
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
            Total: {filteredCategories.length} {filteredCategories.length === 1 ? 'categoría' : 'categorías'}
          </div>
        </div>
      </div>

      {/* 3. CARDS RESPONSIVE DE CATEGORÍAS */}
      {isLoading ? (
        <div className="min-h-[250px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="min-h-[280px] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
          <FolderOpen className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No existen categorías registradas</h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            {searchTerm
              ? 'No se encontraron categorías que coincidan con la búsqueda.'
              : 'Comienza registrando tu primera categoría para organizar tus productos.'}
          </p>
          {!searchTerm && canCreate && (
            <Button onClick={handleOpenCreateModal} className="mt-4 flex items-center gap-2 text-xs font-bold rounded-xl shadow-md">
              <Plus className="h-4 w-4" />
              Crear primera categoría
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
          {filteredCategories.map((category) => {
            const isInactive = category.status === 'INACTIVE';

            return (
              <div
                key={category.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 relative group"
              >
                {/* Header Card: Fila Superior con Nombre & Badge Estado */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg leading-none">📂</span>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug truncate">
                        {category.name}
                      </h3>
                    </div>

                    {!isInactive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800/50 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        Inactiva
                      </span>
                    )}
                  </div>

                  {/* Cuerpo: Descripción */}
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[32px]">
                    {category.description || <span className="italic text-slate-400">Sin descripción</span>}
                  </p>
                </div>

                {/* Información: Grilla con Fecha de Registro */}
                <div className="bg-slate-50/80 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <span>📅</span> Fecha de creación:
                  </span>
                  <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
                    {new Date(category.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Acciones: Botón Principal Ancho (Editar) + Menú Tres Puntos (⋮) */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  {canUpdate && (
                    <Button
                      onClick={() => handleOpenEditModal(category)}
                      className="flex-1 text-xs font-bold py-2 rounded-xl shadow-2xs flex items-center justify-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Editar
                    </Button>
                  )}

                  {/* Menú Tres Puntos (⋮) */}
                  {(canUpdate || canDelete) && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === category.id ? null : category.id);
                        }}
                        className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        title="Más acciones"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === category.id && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 bottom-full mb-1 z-30 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 text-xs divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95 duration-100">
                            {canUpdate && (
                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleOpenEditModal(category);
                                  }}
                                  className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                                  Editar Categoría
                                </button>
                              </div>
                            )}

                            {canDelete && (
                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setDeleteTarget(category);
                                    setDeleteReason('');
                                  }}
                                  className="w-full text-left px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 font-medium"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  Eliminar Categoría
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

      {/* Modal Creación/Edición Estilo Editar Producto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 flex flex-col transition-all duration-300">
            {/* Header del Modal */}
            <div className="flex-none pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <button
                onClick={handleCloseModal}
                className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xl leading-none">📂</span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white pr-6">
                  {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Registra los datos requeridos para clasificar correctamente los productos de tu inventario.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
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
                    Nombre de Categoría <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Almacén, Bebidas, Lácteos"
                    {...register('name')}
                    className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                      errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700'
                    }`}
                  />
                  {errors.name && <p className="mt-1 text-xs text-red-500 font-medium">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Descripción (Opcional)
                  </label>
                  <textarea
                    placeholder="Breve descripción de la categoría..."
                    rows={2}
                    {...register('description')}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
                  />
                </div>

                {editingCategory && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Estado
                    </label>
                    <select
                      {...register('status')}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    >
                      <option value="ACTIVE">Activa</option>
                      <option value="INACTIVE">Inactiva</option>
                    </select>
                  </div>
                )}
              </div>

              {/* CARD 2: 🛡 AUDITORÍA */}
              {editingCategory && (
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
                      placeholder="Describe el motivo de la modificación..."
                      className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all ${
                        errors.changeReason ? 'border-red-500 focus:ring-red-500' : 'border-amber-300 dark:border-amber-700/80'
                      }`}
                    />
                    {errors.changeReason && (
                      <p className="mt-1 text-xs text-red-500 font-medium">{errors.changeReason.message}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Modal Footer - Fixed */}
              <div className="flex-none pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={handleCloseModal} disabled={isSubmitting} className="text-xs px-4 rounded-lg">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting} className="text-xs px-6 font-bold shadow-md rounded-lg">
                  {isSubmitting ? (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando...
                    </div>
                  ) : (
                    editingCategory ? 'Guardar Cambios' : 'Crear Categoría'
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
