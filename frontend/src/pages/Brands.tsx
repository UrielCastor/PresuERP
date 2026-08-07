import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { swalSuccess, handleApiError } from '../utils/swal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Edit2, Trash2, Search, X, Loader2, Award, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { brandApi, Brand } from '../services/brand.service';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyStateGuide } from '../components/ui/EmptyStateGuide';

const brandFormSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  description: z.string().optional().nullable(),
});

type BrandFormData = z.infer<typeof brandFormSchema>;

export const Brands: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const canWrite = hasPermission('products:write');

  // React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BrandFormData>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: { name: '', description: '' },
  });

  // Queries
  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['brands'],
    queryFn: brandApi.list,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: brandApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.message || 'Error al crear la marca');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BrandFormData }) => brandApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.message || 'Error al actualizar la marca');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: brandApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      setDeleteId(null);
      swalSuccess('Marca Eliminada', 'La marca se ha eliminado correctamente.');
    },
    onError: (err: any) => {
      handleApiError(err, 'Error al Eliminar Marca');
      setDeleteId(null);
    },
  });

  const handleOpenCreateModal = () => {
    setEditingBrand(null);
    setApiError(null);
    reset({ name: '', description: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (brand: Brand) => {
    setEditingBrand(brand);
    setApiError(null);
    setValue('name', brand.name);
    setValue('description', brand.description || '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBrand(null);
    setApiError(null);
    reset();
  };

  const onSubmit = async (data: BrandFormData) => {
    setApiError(null);
    if (editingBrand) {
      updateMutation.mutate({ id: editingBrand.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  // Filter brands
  const filteredBrands = brands.filter(
    (b) =>
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.description && b.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marcas de Productos"
        subtitle="Administra los fabricantes y marcas asociadas a tus productos para una mejor búsqueda y reportes."
        action={
          canWrite ? (
            <Button onClick={handleOpenCreateModal} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nueva Marca
            </Button>
          ) : undefined
        }
      />

      {/* Search and Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Buscar por nombre o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={Search}
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Total: {filteredBrands.length} marcas
        </div>
      </div>

      {/* Brands Table / State */}
      {isLoading ? (
        <div className="min-h-[200px] flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      ) : filteredBrands.length === 0 ? (
        <EmptyStateGuide
          title="No se encontraron marcas"
          description={
            searchTerm
              ? 'Prueba cambiando los términos de búsqueda o filtros.'
              : 'Comienza registrando tu primera marca para organizar tu inventario.'
          }
          onAction={(!searchTerm && canWrite) ? handleOpenCreateModal : undefined}
          actionText="Nueva Marca"
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Fecha Registro
                  </th>
                  {canWrite && (
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredBrands.map((brand) => (
                  <tr key={brand.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-920/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-955 dark:text-white">
                      {brand.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 max-w-md truncate">
                      {brand.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                      {new Date(brand.createdAt).toLocaleDateString()}
                    </td>
                    {canWrite && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(brand)}
                            className="p-1.5 text-slate-400 hover:text-primary-600 dark:text-slate-500 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(brand.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 dark:text-slate-550 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
              {editingBrand ? 'Editar Marca' : 'Nueva Marca'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Registra los datos requeridos para la marca del producto.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
              {apiError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg text-sm text-red-655 dark:text-red-450 font-medium">
                  {apiError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Nombre de Marca <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Samsung, Coca Cola, Nestlé"
                  {...register('name')}
                  className={`w-full px-3.5 py-2.5 bg-transparent border rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                    errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-350 dark:border-slate-800'
                  }`}
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Descripción (Opcional)
                </label>
                <textarea
                  placeholder="Breve descripción de la marca..."
                  rows={3}
                  {...register('description')}
                  className="w-full px-3.5 py-2.5 bg-transparent border border-slate-350 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
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
                    'Guardar Marca'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center">
            <div className="mx-auto h-12 w-12 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">¿Confirmar Eliminación?</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Esta acción no se puede deshacer. La marca solo podrá eliminarse físicamente si no posee productos vinculados en el catálogo.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleteMutation.isPending}>
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
