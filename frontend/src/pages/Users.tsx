import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { UserService, User } from '../services/user.service';
import { warehouseApi } from '../services/warehouse.service';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/forms/Input';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/Table';
import {
  Plus,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  Loader2,
  User as UserIcon,
  Mail,
  Shield,
  Search,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Key,
  Building2,
} from 'lucide-react';

const createUserFormSchema = z
  .object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'La contraseña debe contener al menos una letra y un número'),
    confirmarPassword: z.string().min(1, 'Confirmar contraseña es requerido'),
    roleId: z.string().min(1, 'El rol es requerido'),
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.password === data.confirmarPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmarPassword'],
  });

const editUserFormSchema = z
  .object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'La contraseña debe contener al menos una letra y un número')
      .optional()
      .or(z.literal('')),
    confirmarPassword: z.string().optional().or(z.literal('')),
    roleId: z.string().min(1, 'El rol es requerido'),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.password || data.confirmarPassword) {
        return data.password === data.confirmarPassword;
      }
      return true;
    },
    {
      message: 'Las contraseñas no coinciden',
      path: ['confirmarPassword'],
    }
  );

type CreateUserFormValues = z.infer<typeof createUserFormSchema>;
type EditUserFormValues = z.infer<typeof editUserFormSchema>;

export const Users: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password visibility triggers
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);
  const [enablePasswordReset, setEnablePasswordReset] = useState(false);

  // Warehouse state
  const [selectedAuthorizedWarehouses, setSelectedAuthorizedWarehouses] = useState<string[]>([]);
  const [selectedDefaultWarehouseId, setSelectedDefaultWarehouseId] = useState<string>('');

  // Queries
  const { data: usersData, isLoading: isLoadingUsers, error: usersError } = useQuery({
    queryKey: ['users'],
    queryFn: () => UserService.list(),
  });

  const { data: rolesData, isLoading: isLoadingRoles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => UserService.listRoles(),
  });

  const { data: warehousesData = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseApi.list(),
  });

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (data: any) => UserService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsModalOpen(false);
      showTemporarySuccess('Usuario creado exitosamente');
    },
    onError: (err: any) => {
      setSubmitError(err.response?.data?.message || 'Error al crear el usuario');
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => UserService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsModalOpen(false);
      setEditingUser(null);
      showTemporarySuccess('Usuario actualizado exitosamente');
    },
    onError: (err: any) => {
      setSubmitError(err.response?.data?.message || 'Error al actualizar el usuario');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      UserService.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showTemporarySuccess('Estado del usuario actualizado');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error al actualizar estado del usuario');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => UserService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showTemporarySuccess('Usuario eliminado exitosamente');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error al eliminar el usuario');
    },
  });

  // Forms setup
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    formState: { errors: errorsCreate },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      isActive: true,
    },
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: errorsEdit },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
  });

  const showTemporarySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleOpenCreate = () => {
    if (!hasPermission('users:write')) {
      alert('No tienes permisos para crear usuarios.');
      return;
    }
    setEditingUser(null);
    setSubmitError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSelectedAuthorizedWarehouses([]);
    setSelectedDefaultWarehouseId('');
    resetCreate({
      name: '',
      email: '',
      password: '',
      confirmarPassword: '',
      roleId: rolesData?.[0]?.id || '',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    if (!hasPermission('users:write')) {
      alert('No tienes permisos para modificar usuarios.');
      return;
    }
    setEditingUser(user);
    setSubmitError(null);
    setEnablePasswordReset(false);
    setShowEditPassword(false);
    setShowEditConfirmPassword(false);

    const initialAuthorized = (user.userWarehouses || [])
      .map((uw: any) => uw.warehouseId || uw.warehouse?.id || uw.id)
      .filter(Boolean);

    setSelectedAuthorizedWarehouses(initialAuthorized);
    setSelectedDefaultWarehouseId(user.defaultWarehouseId || user.defaultWarehouse?.id || '');
    resetEdit({
      name: user.name,
      email: user.email,
      password: '',
      confirmarPassword: '',
      roleId: user.roleId,
      isActive: user.isActive,
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (!hasPermission('users:delete')) {
      alert('No tienes permisos para eliminar usuarios.');
      return;
    }
    if (id === currentUser?.id) {
      alert('No puedes eliminar tu propio usuario.');
      return;
    }
    if (window.confirm(`¿Está seguro que desea eliminar este usuario? (${name})`)) {
      deleteUserMutation.mutate(id);
    }
  };

  const handleToggleActive = (user: User) => {
    if (!hasPermission('users:write')) {
      alert('No tienes permisos para modificar usuarios.');
      return;
    }
    toggleStatusMutation.mutate({ id: user.id, isActive: !user.isActive });
  };

  const onSubmit = (data: any) => {
    setSubmitError(null);
    const userId = editingUser?.id;
    const defaultWarehouseId = selectedDefaultWarehouseId || null;
    const authorizedWarehouseIds = selectedAuthorizedWarehouses;

    console.log({
      userId,
      authorizedWarehouseIds,
      defaultWarehouseId
    });

    const payload: any = {
      name: data.name,
      email: data.email,
      roleId: data.roleId,
      isActive: data.isActive,
      authorizedWarehouseIds,
      defaultWarehouseId,
    };

    console.log('🔥 [FRONTEND USER SUBMIT PAYLOAD]', JSON.stringify(payload, null, 2));

    if (editingUser) {
      if (enablePasswordReset && data.password) {
        payload.password = data.password;
        payload.confirmarPassword = data.confirmarPassword;
      }
      updateUserMutation.mutate({ id: editingUser.id, data: payload });
    } else {
      payload.password = data.password;
      payload.confirmarPassword = data.confirmarPassword;
      createUserMutation.mutate(payload);
    }
  };

  const isSaving = createUserMutation.isPending || updateUserMutation.isPending;

  // Filtered users for search input
  const filteredUsers = usersData?.items.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role?.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];


  // Role Badge Styling classes helper
  const getRoleBadgeClasses = (roleName: string) => {
    const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold';
    switch (roleName) {
      case 'Administrator':
        return `${base} bg-purple-100 text-purple-800 dark:bg-purple-950/30 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50`;
      case 'Supervisor':
        return `${base} bg-indigo-100 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50`;
      case 'Cajero':
        return `${base} bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50`;
      default:
        return `${base} bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-350 border border-slate-200 dark:border-slate-700/50`;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administración de Usuarios"
        subtitle="Agrega, modifica, activa o elimina el personal autorizado de tu empresa y controla sus roles y permisos."
      />

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-900/30 shadow-sm animate-fade-in">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Search */}
        <div className="relative max-w-sm w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, email o rol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-slate-900 placeholder:text-slate-450 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-primary-500 sm:text-sm transition-all duration-200"
          />
        </div>

        {/* Add user button */}
        {hasPermission('users:write') && (
          <Button onClick={handleOpenCreate} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Agregar Usuario
          </Button>
        )}
      </div>

      {isLoadingUsers ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Cargando lista de usuarios...</p>
          </CardContent>
        </Card>
      ) : usersError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-red-500">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm font-medium">Error al cargar los usuarios</p>
            <p className="text-xs text-slate-500">{(usersError as any).message || 'Compruebe la conexión con el servidor.'}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Nombre</TableHead>
                  <TableHead className="font-semibold">E-mail</TableHead>
                  <TableHead className="font-semibold">Rol de Sistema</TableHead>
                  <TableHead className="font-semibold">Depósitos Autorizados</TableHead>
                  <TableHead className="font-semibold">Depósito Predeterminado</TableHead>
                  <TableHead className="font-semibold">Estado</TableHead>
                  <TableHead className="font-semibold">Fecha de Alta</TableHead>
                  <TableHead className="text-right font-semibold">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      No se encontraron usuarios registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40">
                      <TableCell className="font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary-100/50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 flex items-center justify-center text-xs font-semibold uppercase">
                            {item.name.slice(0, 2)}
                          </div>
                          <span>{item.name}</span>
                          {item.id === currentUser?.id && (
                            <span className="text-[10px] bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono ml-1">
                              Tú
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-300 font-mono text-xs">{item.email}</TableCell>
                      <TableCell>
                        <span className={getRoleBadgeClasses(item.role?.name || '')}>
                          {item.role?.name || 'Cargando...'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.isStaff ? (
                          <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            Todos (Staff)
                          </span>
                        ) : item.userWarehouses && item.userWarehouses.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.userWarehouses.map((uw) => (
                              <span key={uw.warehouseId} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                <Building2 className="h-3 w-3 text-slate-400" />
                                {uw.warehouse.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-rose-500 dark:text-rose-400 italic font-medium">Sin depósitos</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {item.defaultWarehouse?.name ? (
                          <span className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400">
                            <Building2 className="h-3 w-3" />
                            {item.defaultWarehouse.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleToggleActive(item)}
                          disabled={!hasPermission('users:write') || item.id === currentUser?.id}
                          title={item.id === currentUser?.id ? 'No puedes desactivar tu propio usuario' : 'Haga clic para cambiar estado'}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors cursor-pointer disabled:cursor-not-allowed ${
                            item.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-455 dark:border-emerald-900/50 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/40'
                              : 'bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/20 dark:text-rose-455 dark:border-rose-900/50 hover:bg-rose-100/50 dark:hover:bg-rose-950/40'
                          }`}
                        >
                          {item.isActive ? (
                            <>
                              <UserCheck className="h-3 w-3" />
                              Activo
                            </>
                          ) : (
                            <>
                              <UserX className="h-3 w-3" />
                              Inactivo
                            </>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-slate-500 dark:text-slate-455 text-xs">
                        {new Date(item.createdAt).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {hasPermission('users:write') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(item)}
                              title="Editar usuario"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          {hasPermission('users:delete') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item.id, item.name)}
                              disabled={item.id === currentUser?.id}
                              title={item.id === currentUser?.id ? 'No puedes eliminarte a ti mismo' : 'Eliminar usuario'}
                              className="text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
      >
        <form
          className="space-y-4"
          onSubmit={
            editingUser
              ? handleSubmitEdit((data) => onSubmit(data))
              : handleSubmitCreate((data) => onSubmit(data))
          }
        >
          {submitError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-950/20 dark:text-red-455 border border-red-200 dark:border-red-900/40">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{submitError}</span>
            </div>
          )}

          {editingUser ? (
            /* EDIT FORM FIELDS */
            <>
              <Input
                label="Nombre completo"
                id="edit-name"
                leftIcon={<UserIcon className="h-5 w-5" />}
                placeholder="Juan Pérez"
                error={errorsEdit.name?.message}
                {...registerEdit('name')}
              />

              <Input
                label="Correo electrónico"
                id="edit-email"
                type="email"
                leftIcon={<Mail className="h-5 w-5" />}
                placeholder="juan@ejemplo.com"
                error={errorsEdit.email?.message}
                {...registerEdit('email')}
              />

              {/* Role selection */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-roleId" className="text-sm font-medium text-slate-705 dark:text-slate-200 flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-slate-400" />
                  Rol de acceso
                </label>
                <select
                  id="edit-roleId"
                  disabled={!hasPermission('users:write')}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:text-sm transition-all duration-200 disabled:bg-slate-50 disabled:text-slate-500 dark:disabled:bg-slate-900/50"
                  {...registerEdit('roleId')}
                >
                  {isLoadingRoles ? (
                    <option>Cargando roles...</option>
                  ) : (
                    rolesData?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} - {r.description || 'Sin descripción'}
                      </option>
                    ))
                  )}
                </select>
                {!hasPermission('users:write') && (
                  <p className="text-[10px] text-slate-450 dark:text-slate-500 italic mt-0.5">
                    * Solo los administradores pueden cambiar roles de usuario.
                  </p>
                )}
                {errorsEdit.roleId && (
                  <p className="text-xs text-red-600 font-medium">{errorsEdit.roleId.message}</p>
                )}
              </div>

              {/* Switch Active */}
              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="edit-isActive"
                  disabled={editingUser.id === currentUser?.id}
                  className="h-4.5 w-4.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:ring-offset-slate-900 dark:focus:ring-offset-slate-900 cursor-pointer disabled:cursor-not-allowed"
                  {...registerEdit('isActive')}
                />
                <label
                  htmlFor="edit-isActive"
                  className={`text-sm font-medium ${
                    editingUser.id === currentUser?.id
                      ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
                      : 'text-slate-700 dark:text-slate-205 cursor-pointer'
                  }`}
                >
                  Usuario activo (Habilita el ingreso al sistema)
                </label>
              </div>

              {/* SECCIÓN DE DEPÓSITOS PERMITIDOS */}
              <div className="border-t border-slate-150 dark:border-slate-800 pt-4 mt-2 space-y-3">
                <label className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary-500" />
                  Depósitos Autorizados
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selecciona los depósitos a los que este usuario tendrá acceso. Si no seleccionas ningún depósito, el usuario no podrá operar en ningún depósito.
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  {warehousesData.map((wh) => (
                    <label key={wh.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAuthorizedWarehouses.includes(wh.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAuthorizedWarehouses([...selectedAuthorizedWarehouses, wh.id]);
                          } else {
                            const updated = selectedAuthorizedWarehouses.filter((id) => id !== wh.id);
                            setSelectedAuthorizedWarehouses(updated);
                            if (selectedDefaultWarehouseId === wh.id) {
                              setSelectedDefaultWarehouseId(updated[0] || '');
                            }
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span>{wh.name}</span>
                    </label>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5 pt-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Depósito Predeterminado
                  </label>
                  <select
                    value={selectedDefaultWarehouseId}
                    onChange={(e) => setSelectedDefaultWarehouseId(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:text-sm"
                  >
                    <option value="">-- Sin depósito predeterminado --</option>
                    {warehousesData
                      .filter((w) => selectedAuthorizedWarehouses.length === 0 || selectedAuthorizedWarehouses.includes(w.id))
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* SECURITY / RESET PASSWORD SECTION */}
              <div className="border-t border-slate-150 dark:border-slate-800 pt-4 mt-6">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Key className="h-4 w-4 text-primary-500" />
                  Seguridad
                </h4>

                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="edit-enablePasswordReset"
                    checked={enablePasswordReset}
                    onChange={(e) => setEnablePasswordReset(e.target.checked)}
                    className="h-4.5 w-4.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                  />
                  <label htmlFor="edit-enablePasswordReset" className="text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                    Restablecer contraseña
                  </label>
                </div>

                {enablePasswordReset && (
                  <div className="space-y-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 transition-all duration-300">
                    {/* Nueva contraseña */}
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label htmlFor="edit-password" className="text-sm font-medium text-slate-700 dark:text-slate-202">
                        Nueva contraseña
                      </label>
                      <div className="relative rounded-lg shadow-sm">
                        <input
                          type={showEditPassword ? 'text' : 'password'}
                          id="edit-password"
                          placeholder="Mínimo 8 caracteres, con letras y números"
                          className={`block w-full rounded-lg border bg-white px-3 py-2 pr-10 text-slate-900 focus:outline-none focus:ring-1 sm:text-sm transition-all duration-200 ${
                            errorsEdit.password
                              ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500'
                              : 'border-slate-300 focus:border-primary-500 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                          }`}
                          {...registerEdit('password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditPassword(!showEditPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                          {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errorsEdit.password && (
                        <p className="text-xs text-red-650 dark:text-red-400 font-medium">{errorsEdit.password.message}</p>
                      )}
                    </div>

                    {/* Confirmar nueva contraseña */}
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label htmlFor="edit-confirm-password" className="text-sm font-medium text-slate-700 dark:text-slate-202">
                        Confirmar nueva contraseña
                      </label>
                      <div className="relative rounded-lg shadow-sm">
                        <input
                          type={showEditConfirmPassword ? 'text' : 'password'}
                          id="edit-confirm-password"
                          placeholder="Repita la nueva contraseña"
                          className={`block w-full rounded-lg border bg-white px-3 py-2 pr-10 text-slate-900 focus:outline-none focus:ring-1 sm:text-sm transition-all duration-200 ${
                            errorsEdit.confirmarPassword
                              ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500'
                              : 'border-slate-300 focus:border-primary-500 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                          }`}
                          {...registerEdit('confirmarPassword')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                          {showEditConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errorsEdit.confirmarPassword && (
                        <p className="text-xs text-red-650 dark:text-red-400 font-medium">{errorsEdit.confirmarPassword.message}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* CREATE FORM FIELDS */
            <>
              <Input
                label="Nombre completo"
                id="create-name"
                leftIcon={<UserIcon className="h-5 w-5" />}
                placeholder="Juan Pérez"
                error={errorsCreate.name?.message}
                {...registerCreate('name')}
              />

              <Input
                label="Correo electrónico"
                id="create-email"
                type="email"
                leftIcon={<Mail className="h-5 w-5" />}
                placeholder="juan@ejemplo.com"
                error={errorsCreate.email?.message}
                {...registerCreate('email')}
              />

              {/* Contraseña */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Contraseña
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="create-password"
                    placeholder="Mínimo 8 caracteres, con letras y números"
                    className={`block w-full rounded-lg border bg-white px-3 py-2 pr-10 text-slate-900 focus:outline-none focus:ring-1 sm:text-sm transition-all duration-200 ${
                      errorsCreate.password
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500'
                        : 'border-slate-300 focus:border-primary-500 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                    }`}
                    {...registerCreate('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errorsCreate.password && (
                  <p className="text-xs text-red-650 dark:text-red-400 font-medium">{errorsCreate.password.message}</p>
                )}
              </div>

              {/* Confirmar contraseña */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-confirm-password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Confirmar contraseña
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="create-confirm-password"
                    placeholder="Repita la contraseña"
                    className={`block w-full rounded-lg border bg-white px-3 py-2 pr-10 text-slate-900 focus:outline-none focus:ring-1 sm:text-sm transition-all duration-200 ${
                      errorsCreate.confirmarPassword
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500'
                        : 'border-slate-305 focus:border-primary-500 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                    }`}
                    {...registerCreate('confirmarPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-605 dark:hover:text-slate-202 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errorsCreate.confirmarPassword && (
                  <p className="text-xs text-red-650 dark:text-red-400 font-medium">{errorsCreate.confirmarPassword.message}</p>
                )}
              </div>

              {/* Role selection */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-roleId" className="text-sm font-medium text-slate-705 dark:text-slate-200 flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-slate-400" />
                  Rol de acceso
                </label>
                <select
                  id="create-roleId"
                  disabled={!hasPermission('users:write')}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:text-sm transition-all duration-200 disabled:bg-slate-50 disabled:text-slate-500 dark:disabled:bg-slate-900/50"
                  {...registerCreate('roleId')}
                >
                  {isLoadingRoles ? (
                    <option>Cargando roles...</option>
                  ) : (
                    rolesData?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} - {r.description || 'Sin descripción'}
                      </option>
                    ))
                  )}
                </select>
                {!hasPermission('users:write') && (
                  <p className="text-[10px] text-slate-450 dark:text-slate-500 italic mt-0.5">
                    * Solo los administradores pueden asignar roles de usuario.
                  </p>
                )}
                {errorsCreate.roleId && (
                  <p className="text-xs text-red-650 font-medium">{errorsCreate.roleId.message}</p>
                )}
              </div>

              {/* Switch Active */}
              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="create-isActive"
                  className="h-4.5 w-4.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:ring-offset-slate-900 dark:focus:ring-offset-slate-900 cursor-pointer"
                  {...registerCreate('isActive')}
                />
                <label htmlFor="create-isActive" className="text-sm font-medium text-slate-700 dark:text-slate-205 cursor-pointer">
                  Usuario activo (Habilita el ingreso al sistema)
                </label>
              </div>

              {/* SECCIÓN DE DEPÓSITOS PERMITIDOS */}
              <div className="border-t border-slate-150 dark:border-slate-800 pt-4 mt-2 space-y-3">
                <label className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary-500" />
                  Depósitos Autorizados
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selecciona los depósitos en los que este usuario tiene permiso para operar. Si no seleccionas ninguno, el usuario podrá acceder a todos los depósitos.
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  {warehousesData.map((wh) => (
                    <label key={wh.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAuthorizedWarehouses.includes(wh.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAuthorizedWarehouses([...selectedAuthorizedWarehouses, wh.id]);
                          } else {
                            const updated = selectedAuthorizedWarehouses.filter((id) => id !== wh.id);
                            setSelectedAuthorizedWarehouses(updated);
                            if (selectedDefaultWarehouseId === wh.id) {
                              setSelectedDefaultWarehouseId(updated[0] || '');
                            }
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span>{wh.name}</span>
                    </label>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5 pt-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Depósito Predeterminado
                  </label>
                  <select
                    value={selectedDefaultWarehouseId}
                    onChange={(e) => setSelectedDefaultWarehouseId(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:text-sm"
                  >
                    <option value="">-- Sin depósito predeterminado --</option>
                    {warehousesData
                      .filter((w) => selectedAuthorizedWarehouses.length === 0 || selectedAuthorizedWarehouses.includes(w.id))
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-850">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Guardando...
                </>
              ) : (
                'Guardar Usuario'
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
