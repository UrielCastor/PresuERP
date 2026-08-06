import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Shield,
  CheckCircle2,
  Save,
  Lock,
  Search,
  History,
  AlertCircle,
  Plus,
  Layers,
  UserCheck,
  Check,
  X,
  Eye,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  PieChart,
  Monitor,
  Scale,
  Activity,
  Sparkles,
} from 'lucide-react';
import { roleService } from '../../services/role.service';
import {
  capabilityService,
  GroupedCapabilityModuleDto,
  RoleCapabilityHistoryItemDto,
  CapabilityItemDto,
} from '../../services/capability.service';
import { warehouseApi } from '../../services/warehouse.service';
import { RoleSimulator } from '../../components/roles/RoleSimulator';
import { RoleComparison } from '../../components/roles/RoleComparison';
import { RoleDiagnostics } from '../../components/roles/RoleDiagnostics';
import { RoleSummarySidebar } from '../../components/roles/RoleSummarySidebar';

// ─── Subgroup Helper ────────────────────────────────────────────────────────
const getSubgroupForCapability = (moduleName: string, cap: CapabilityItemDto): string => {
  const id = cap.id.toLowerCase();

  switch (moduleName) {
    case 'Productos':
      if (id === 'products.view') return 'Acceso';
      if (['products.create', 'products.update', 'products.delete'].includes(id)) return 'CRUD';
      if (['products.edit_cost', 'products.edit_margin', 'products.edit_price', 'products.edit_tax', 'products.edit_stock_min', 'products.cost.update'].includes(id)) return 'Campos Sensibles';
      if (['products.edit_name', 'products.edit_description', 'products.edit_barcode', 'products.edit_supplier', 'products.edit_category', 'products.edit_brand', 'products.edit_unit', 'products.edit_image'].includes(id)) return 'Datos Generales';
      return 'Operaciones Especiales';

    case 'POS / Ventas':
      if (['sales.view', 'sales.history'].includes(id)) return 'Acceso';
      if (['sales.create', 'sales.cancel', 'sales.return', 'sales.reprint'].includes(id)) return 'Venta & Operaciones';
      if (['sales.change_customer', 'sales.change_seller', 'sales.change_quantity', 'sales.delete_item'].includes(id)) return 'Ticket';
      if (['sales.change_price', 'sales.change_margin', 'sales.discount', 'sales.rounding', 'sales.points'].includes(id)) return 'Precios & Descuentos';
      if (['sales.payment_cash', 'sales.payment_card', 'sales.payment_transfer', 'sales.payment_mp', 'sales.account'].includes(id)) return 'Medios de Pago';
      return 'Caja & POS';

    case 'Caja':
      if (id === 'cash.view') return 'Acceso';
      if (['cash.open', 'cash.close', 'cash.movement'].includes(id)) return 'Operaciones';
      if (['cash.income', 'cash.expense', 'cash.transfer'].includes(id)) return 'Tesorería';
      return 'Auditoría & Control';

    case 'Compras':
      if (id === 'purchases.view') return 'Acceso';
      if (['purchases.create', 'purchases.update', 'purchases.delete'].includes(id)) return 'CRUD';
      if (['purchases.edit_supplier', 'purchases.edit_items', 'purchases.edit_prices', 'purchases.edit_discount', 'purchases.edit_observations'].includes(id)) return 'Edición';
      if (['purchases.approve', 'purchases.cancel', 'purchases.receive'].includes(id)) return 'Aprobaciones';
      return 'Operaciones';

    case 'Clientes':
      if (['customers.view', 'customer_balance.view', 'customer_account.view'].includes(id)) return 'Acceso';
      if (['customers.create', 'customers.update', 'customers.delete'].includes(id)) return 'CRUD';
      if (['customers.edit_basic', 'customers.edit_contact', 'customers.edit_observations'].includes(id)) return 'Datos Personales';
      if (['customers.edit_price_list', 'customers.edit_points'].includes(id)) return 'Datos Comerciales';
      return 'Cuenta Corriente';

    case 'Configuración':
      if (id === 'settings.view') return 'Acceso';
      if (id.startsWith('settings.general') || id.startsWith('settings.preferences')) return 'Empresa & Preferencias';
      if (id.startsWith('settings.fiscal')) return 'Fiscal';
      if (id.startsWith('settings.inventory') || id.startsWith('settings.operation')) return 'Inventario & Operaciones';
      if (id.startsWith('settings.email') || id.startsWith('settings.print') || id.startsWith('settings.numbering')) return 'Correo & Impresión';
      if (id.startsWith('settings.security') || id.startsWith('settings.system') || id.startsWith('settings.appearance') || id.startsWith('settings.admin')) return 'Seguridad & Sistema';
      if (id.startsWith('settings.integrations')) return 'Integraciones';
      return 'POS';

    case 'Reportes':
      if (id.startsWith('reports.sales')) return 'Ventas';
      if (id.startsWith('reports.cash')) return 'Caja';
      if (id.startsWith('reports.stock')) return 'Stock';
      if (id.startsWith('reports.customers')) return 'Clientes';
      if (id.startsWith('reports.finances')) return 'Finanzas';
      return 'Generales';

    case 'Logística':
      if (id.startsWith('logistics.request')) return 'Pedidos Internos';
      if (id.startsWith('logistics.transfer')) return 'Traspasos';
      return 'Dashboard';

    case 'Usuarios y Seguridad':
      if (id === 'roles.manage') return 'Gestión de Roles';
      return 'Acceso & CRUD';

    default:
      if (cap.type === 'VIEW' || cap.name.toLowerCase().includes('ver')) return 'Acceso';
      if (cap.type === 'CRITICAL') return 'Acciones Críticas';
      return 'Operaciones';
  }
};

type WorkspaceTab = 'MATRIX' | 'SIMULATOR' | 'COMPARISON' | 'DIAGNOSTICS';

export const RoleCapabilitiesPage: React.FC = () => {
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [groupedModules, setGroupedModules] = useState<GroupedCapabilityModuleDto[]>([]);
  const [selectedCapabilityIds, setSelectedCapabilityIds] = useState<Set<string>>(new Set());
  const [initialCapabilityIds, setInitialCapabilityIds] = useState<Set<string>>(new Set());
  const [roleCapabilitiesMap, setRoleCapabilitiesMap] = useState<Record<string, string[]>>({});
  const [warehouses, setWarehouses] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('MATRIX');
  const [isLoadingRoles, setIsLoadingRoles] = useState<boolean>(true);
  const [isLoadingCapabilities, setIsLoadingCapabilities] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [roleSearchQuery, setRoleSearchQuery] = useState<string>('');
  const [moduleSearchQuery, setModuleSearchQuery] = useState<string>('');

  // Accordion State
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [openSubgroups, setOpenSubgroups] = useState<Set<string>>(new Set());

  // Modals
  const [historyModalOpen, setHistoryModalOpen] = useState<boolean>(false);
  const [historyLogs, setHistoryLogs] = useState<RoleCapabilityHistoryItemDto[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);
  const [saveReason, setSaveReason] = useState<string>('');

  const [createRoleModalOpen, setCreateRoleModalOpen] = useState<boolean>(false);
  const [newRoleName, setNewRoleName] = useState<string>('');
  const [newRoleDescription, setNewRoleDescription] = useState<string>('');
  const [newRoleBaseId, setNewRoleBaseId] = useState<string>('');
  const [isCreatingRole, setIsCreatingRole] = useState<boolean>(false);

  // Edit Role modal state
  const [editRoleModalOpen, setEditRoleModalOpen] = useState<boolean>(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [editRoleName, setEditRoleName] = useState<string>('');
  const [editRoleDescription, setEditRoleDescription] = useState<string>('');
  const [isEditingRole, setIsEditingRole] = useState<boolean>(false);

  // Delete Role modal state
  const [deleteRoleModalOpen, setDeleteRoleModalOpen] = useState<boolean>(false);
  const [deletingRole, setDeletingRole] = useState<any>(null);
  const [isDeletingRole, setIsDeletingRole] = useState<boolean>(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 1. Fetch initial roles, master capabilities, and warehouses
  const fetchRolesAndCapabilities = async () => {
    setIsLoadingRoles(true);
    try {
      const [rolesRes, modulesRes, whRes] = await Promise.all([
        roleService.getRoles(),
        capabilityService.getGroupedCapabilities(),
        warehouseApi.list().catch(() => []),
      ]);
      setRoles(rolesRes || []);
      setGroupedModules(modulesRes || []);
      setWarehouses(whRes || []);

      // Auto-open top 3 modules by default
      if (modulesRes && modulesRes.length > 0) {
        const initialOpenMods = new Set(modulesRes.slice(0, 3).map((m) => m.module));
        setOpenModules(initialOpenMods);
      }

      const editableList = (rolesRes || []).filter(
        (r: any) => r.name !== 'Administrator' && r.name !== 'SuperAdmin'
      );

      if (editableList.length > 0 && (!selectedRoleId || selectedRoleId === rolesRes?.find((r: any) => r.name === 'Administrator')?.id)) {
        setSelectedRoleId(editableList[0].id);
      }

      // Pre-fetch all role capabilities for instant comparison
      const map: Record<string, string[]> = {};
      await Promise.all(
        (rolesRes || []).map(async (r: any) => {
          try {
            const data = await capabilityService.getRoleCapabilities(r.id);
            map[r.id] = data.capabilityIds || [];
          } catch (e) {
            map[r.id] = [];
          }
        })
      );
      setRoleCapabilitiesMap(map);
    } catch (err: any) {
      console.error('Error cargando roles y capacidades:', err);
      setNotification({
        type: 'error',
        message: 'Error al cargar la matriz de roles y capacidades.',
      });
    } finally {
      setIsLoadingRoles(false);
    }
  };

  useEffect(() => {
    fetchRolesAndCapabilities();
  }, []);

  // 2. Fetch capabilities when selectedRoleId changes
  useEffect(() => {
    if (!selectedRoleId) return;

    const fetchRoleCaps = async () => {
      setIsLoadingCapabilities(true);
      try {
        const data = await capabilityService.getRoleCapabilities(selectedRoleId);
        const capSet = new Set(data.capabilityIds || []);
        setSelectedCapabilityIds(capSet);
        setInitialCapabilityIds(new Set(capSet));
      } catch (err: any) {
        console.error('Error obteniendo capacidades del rol:', err);
      } finally {
        setIsLoadingCapabilities(false);
      }
    };

    fetchRoleCaps();
  }, [selectedRoleId]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  // Group capabilities into module -> subgroup structure
  const structuredModules = useMemo(() => {
    return groupedModules.map((mod) => {
      const subgroupsMap: Record<string, CapabilityItemDto[]> = {};

      for (const cap of mod.capabilities) {
        const sgName = getSubgroupForCapability(mod.module, cap);
        if (!subgroupsMap[sgName]) {
          subgroupsMap[sgName] = [];
        }
        subgroupsMap[sgName].push(cap);
      }

      const subgroups = Object.keys(subgroupsMap).map((sgName) => ({
        name: sgName,
        capabilities: subgroupsMap[sgName],
      }));

      return {
        module: mod.module,
        subgroups,
        allCapabilities: mod.capabilities,
      };
    });
  }, [groupedModules]);

  // Filter modules/subgroups based on search query
  const filteredStructuredModules = useMemo(() => {
    if (!moduleSearchQuery.trim()) return structuredModules;
    const query = moduleSearchQuery.toLowerCase();

    return structuredModules
      .map((mod) => {
        const filteredSubgroups = mod.subgroups
          .map((sg) => ({
            ...sg,
            capabilities: sg.capabilities.filter(
              (c) =>
                c.name.toLowerCase().includes(query) ||
                c.description.toLowerCase().includes(query) ||
                c.id.toLowerCase().includes(query) ||
                sg.name.toLowerCase().includes(query) ||
                mod.module.toLowerCase().includes(query)
            ),
          }))
          .filter((sg) => sg.capabilities.length > 0);

        return {
          ...mod,
          subgroups: filteredSubgroups,
          allCapabilities: filteredSubgroups.flatMap((sg) => sg.capabilities),
        };
      })
      .filter((mod) => mod.allCapabilities.length > 0);
  }, [structuredModules, moduleSearchQuery]);

  // Auto expand accordions when searching
  useEffect(() => {
    if (moduleSearchQuery.trim()) {
      const allModNames = new Set(filteredStructuredModules.map((m) => m.module));
      setOpenModules(allModNames);
    }
  }, [moduleSearchQuery, filteredStructuredModules]);

  // Total system capabilities count
  const totalCapabilitiesCount = useMemo(() => {
    return groupedModules.reduce((acc, m) => acc + m.capabilities.length, 0);
  }, [groupedModules]);

  // Toggle single capability
  const handleToggleCapability = useCallback((capId: string) => {
    setSelectedCapabilityIds((prev) => {
      const next = new Set(prev);
      if (next.has(capId)) {
        next.delete(capId);
      } else {
        next.add(capId);
      }
      return next;
    });
  }, []);

  // Toggle entire subgroup
  const handleToggleSubgroup = useCallback((caps: CapabilityItemDto[]) => {
    const ids = caps.map((c) => c.id);
    const allSelected = ids.every((id) => selectedCapabilityIds.has(id));

    setSelectedCapabilityIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [selectedCapabilityIds]);

  // Toggle entire module
  const handleToggleModule = useCallback((caps: CapabilityItemDto[]) => {
    const ids = caps.map((c) => c.id);
    const allSelected = ids.every((id) => selectedCapabilityIds.has(id));

    setSelectedCapabilityIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [selectedCapabilityIds]);

  // Accordion Toggles
  const toggleModuleOpen = (moduleName: string) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleName)) {
        next.delete(moduleName);
      } else {
        next.add(moduleName);
      }
      return next;
    });
  };

  const toggleSubgroupOpen = (key: string) => {
    setOpenSubgroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const allMods = new Set(structuredModules.map((m) => m.module));
    setOpenModules(allMods);
  };

  const handleCollapseAll = () => {
    setOpenModules(new Set());
    setOpenSubgroups(new Set());
  };

  // Open Save confirmation modal
  const handlePromptSave = () => {
    setSaveReason('');
    setSaveModalOpen(true);
  };

  // Confirm save capabilities with audit reason
  const handleConfirmSave = async () => {
    if (!selectedRoleId) return;
    setIsSaving(true);
    setNotification(null);

    try {
      const capArray = Array.from(selectedCapabilityIds);
      const res = await capabilityService.updateRoleCapabilities(selectedRoleId, capArray, saveReason);

      const newSet = new Set(res.capabilityIds || []);
      setSelectedCapabilityIds(newSet);
      setInitialCapabilityIds(new Set(newSet));

      setSaveModalOpen(false);
      setNotification({
        type: 'success',
        message: `Capacidades del rol "${selectedRole?.name}" actualizadas correctamente.`,
      });
    } catch (err: any) {
      console.error('Error guardando capacidades:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Error al guardar las capacidades.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Create Custom Role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    setIsCreatingRole(true);
    setNotification(null);

    try {
      const created = await capabilityService.createCustomRole({
        name: newRoleName.trim(),
        description: newRoleDescription.trim(),
        baseRoleId: newRoleBaseId || undefined,
      });

      setCreateRoleModalOpen(false);
      setNewRoleName('');
      setNewRoleDescription('');
      setNewRoleBaseId('');

      await fetchRolesAndCapabilities();
      if (created?.id) {
        setSelectedRoleId(created.id);
      }

      setNotification({
        type: 'success',
        message: `Rol personalizado "${created.name}" creado con éxito.`,
      });
    } catch (err: any) {
      console.error('Error creando rol:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Error al crear el rol personalizado.',
      });
    } finally {
      setIsCreatingRole(false);
    }
  };

  // Load history logs
  const handleOpenHistory = async () => {
    if (!selectedRoleId) return;
    setHistoryModalOpen(true);
    setIsLoadingHistory(true);
    try {
      const logs = await capabilityService.getRoleCapabilityHistory(selectedRoleId);
      setHistoryLogs(logs || []);
    } catch (err) {
      console.error('Error cargando historial de cambios:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Open Edit Role modal
  const handleOpenEditRole = (role: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRole(role);
    setEditRoleName(role.name);
    setEditRoleDescription(role.description || '');
    setEditRoleModalOpen(true);
  };

  // Confirm Edit Role
  const handleConfirmEditRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole || !editRoleName.trim()) return;
    setIsEditingRole(true);
    setNotification(null);
    try {
      await capabilityService.updateRole(editingRole.id, {
        name: editRoleName.trim(),
        description: editRoleDescription.trim(),
      });
      setEditRoleModalOpen(false);
      await fetchRolesAndCapabilities();
      setNotification({ type: 'success', message: `Rol renombrado a "${editRoleName.trim()}" correctamente.` });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Error al actualizar el rol.',
      });
    } finally {
      setIsEditingRole(false);
    }
  };

  // Open Delete Role modal
  const handleOpenDeleteRole = (role: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingRole(role);
    setDeleteRoleModalOpen(true);
  };

  // Confirm Delete Role
  const handleConfirmDeleteRole = async () => {
    if (!deletingRole) return;
    setIsDeletingRole(true);
    setNotification(null);
    try {
      await capabilityService.deleteRole(deletingRole.id);
      setDeleteRoleModalOpen(false);
      if (selectedRoleId === deletingRole.id) setSelectedRoleId('');
      await fetchRolesAndCapabilities();
      setNotification({ type: 'success', message: `Rol "${deletingRole.name}" eliminado correctamente.` });
      setDeletingRole(null);
    } catch (err: any) {
      setDeleteRoleModalOpen(false);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Error al eliminar el rol.',
      });
    } finally {
      setIsDeletingRole(false);
    }
  };

  const hasUnsavedChanges =
    selectedCapabilityIds.size !== initialCapabilityIds.size ||
    Array.from(selectedCapabilityIds).some((id) => !initialCapabilityIds.has(id));

  const editableRoles = roles.filter(
    (role) => role.name !== 'Administrator' && role.name !== 'SuperAdmin'
  );

  const filteredRoles = editableRoles.filter((r) =>
    r.name.toLowerCase().includes(roleSearchQuery.toLowerCase())
  );

  const renderBadgeType = (type: string) => {
    switch (type) {
      case 'VIEW':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <Eye className="h-3 w-3" /> Lectura
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
            <AlertTriangle className="h-3 w-3" /> Crítico
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Zap className="h-3 w-3" /> Operativo
          </span>
        );
    }
  };

  return (
    <div className="w-full h-[calc(100vh-64px)] flex flex-col space-y-4 p-4 lg:p-6 overflow-hidden font-sans">
      {/* Top Header Bar (Full Width) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex-shrink-0">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Shield className="h-6 w-6 text-primary-600" />
            Matriz Enterprise de Roles y Capacidades
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Administre de forma intuitiva las {totalCapabilitiesCount} capacidades del ERP en formato Workspace de ancho completo.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCreateRoleModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors border border-indigo-200/60 dark:border-indigo-800"
          >
            <Plus className="h-4 w-4" /> Nuevo Rol Personalizado
          </button>

          {selectedRole && (
            <button
              onClick={handleOpenHistory}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors"
            >
              <History className="h-4 w-4" /> Historial
            </button>
          )}

          <button
            onClick={handlePromptSave}
            disabled={isSaving || !hasUnsavedChanges}
            className={`px-5 py-2.5 font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 ${
              hasUnsavedChanges
                ? 'bg-primary-600 hover:bg-primary-700 text-white animate-pulse'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between gap-3 font-semibold flex-shrink-0 ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Enterprise Workspace Navigation Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('MATRIX')}
            className={`px-4 py-2 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'MATRIX'
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            <Shield className="h-4 w-4" /> Matriz de Capacidades
          </button>

          <button
            onClick={() => setActiveTab('SIMULATOR')}
            className={`px-4 py-2 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'SIMULATOR'
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            <Monitor className="h-4 w-4" /> Simular Rol
          </button>

          <button
            onClick={() => setActiveTab('COMPARISON')}
            className={`px-4 py-2 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'COMPARISON'
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            <Scale className="h-4 w-4" /> Comparar Roles
          </button>

          <button
            onClick={() => setActiveTab('DIAGNOSTICS')}
            className={`px-4 py-2 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'DIAGNOSTICS'
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            <Activity className="h-4 w-4" /> Diagnóstico & Salud
          </button>
        </div>

        <div className="text-xs font-bold text-slate-400">
          Total Capacidades: <strong className="text-slate-700 dark:text-slate-200">{totalCapabilitiesCount}</strong>
        </div>
      </div>

      {/* Main Fullscreen Workspace Grid (320px | 1fr (~70%) | 340px) */}
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_340px] gap-6 items-start flex-1 min-h-0">
        {activeTab === 'MATRIX' ? (
          <>
            {/* COLUMN 1 (320px): Roles List Selector */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 space-y-4 h-[calc(100vh-210px)] overflow-y-auto pr-1">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-indigo-600" />
                  Roles Configurados
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg">
                  {roles.length} roles
                </span>
              </div>

              {/* Role Search */}
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar rol..."
                  value={roleSearchQuery}
                  onChange={(e) => setRoleSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Roles List */}
              {isLoadingRoles ? (
                <div className="p-8 text-center text-xs text-slate-400 animate-pulse">Cargando roles...</div>
              ) : (
                <div className="space-y-2">
                  {filteredRoles.map((role) => {
                    const isSelected = role.id === selectedRoleId;
                    const isProtectedRole = role.name === 'Administrator' || role.name === 'SuperAdmin';
                    return (
                      <button
                        key={role.id}
                        onClick={() => setSelectedRoleId(role.id)}
                        className={`w-full text-left p-3 rounded-xl transition-all border ${
                          isSelected
                            ? 'bg-primary-50 dark:bg-primary-950/30 border-primary-300 dark:border-primary-800 text-primary-900 dark:text-primary-200 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs sm:text-sm">{role.name}</span>
                          <div className="flex items-center gap-1">
                            {!isProtectedRole && (
                              <>
                                <button
                                  type="button"
                                  title="Editar nombre y descripción"
                                  onClick={(e) => handleOpenEditRole(role, e)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button
                                  type="button"
                                  title="Eliminar rol"
                                  onClick={(e) => handleOpenDeleteRole(role, e)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                </button>
                              </>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isProtectedRole
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                  : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                              }`}
                            >
                              {isProtectedRole ? 'Protegido' : 'Editable'}
                            </span>
                          </div>
                        </div>
                        {role.description && (
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{role.description}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* COLUMN 2 (1fr ~70% width): Enterprise Accordion Matrix */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-5 h-[calc(100vh-210px)] overflow-y-auto pr-2">
              {selectedRole ? (
                <>
                  {/* Matrix Control Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="relative flex-1">
                      <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Buscar capacidad por nombre, código o módulo..."
                        value={moduleSearchQuery}
                        onChange={(e) => setModuleSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExpandAll}
                        className="p-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-lg flex items-center gap-1"
                        title="Expandir todos los acordeones"
                      >
                        <Maximize2 className="h-3.5 w-3.5" /> Expandir
                      </button>
                      <button
                        type="button"
                        onClick={handleCollapseAll}
                        className="p-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-lg flex items-center gap-1"
                        title="Colapsar todos los acordeones"
                      >
                        <Minimize2 className="h-3.5 w-3.5" /> Colapsar
                      </button>
                    </div>
                  </div>

                  {/* Accordion Module List */}
                  {isLoadingCapabilities ? (
                    <div className="p-12 text-center text-xs text-slate-400 animate-pulse space-y-2">
                      <Layers className="h-8 w-8 mx-auto text-slate-300" />
                      <p>Cargando matriz jerárquica de capacidades...</p>
                    </div>
                  ) : filteredStructuredModules.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      No se encontraron capacidades coincidentes con "{moduleSearchQuery}".
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredStructuredModules.map((modGroup) => {
                        const isModOpen = openModules.has(modGroup.module) || !!moduleSearchQuery.trim();
                        const activeModCapsCount = modGroup.allCapabilities.filter((c) => selectedCapabilityIds.has(c.id)).length;
                        const isAllModSelected = modGroup.allCapabilities.every((c) => selectedCapabilityIds.has(c.id));

                        return (
                          <div
                            key={modGroup.module}
                            className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs transition-all w-full"
                          >
                            {/* Primary Module Accordion Bar */}
                            <div
                              onClick={() => toggleModuleOpen(modGroup.module)}
                              className="w-full flex items-center justify-between p-3.5 bg-slate-50/80 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800"
                            >
                              <div className="flex items-center gap-2.5">
                                {isModOpen ? (
                                  <ChevronDown className="h-4 w-4 text-slate-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-400" />
                                )}
                                <Layers className="h-4 w-4 text-primary-600" />
                                <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                                  {modGroup.module}
                                </span>
                                <span className="text-[11px] font-bold px-2 py-0.5 bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 rounded-full">
                                  {activeModCapsCount} / {modGroup.allCapabilities.length}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleModule(modGroup.allCapabilities);
                                }}
                                className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors px-2 py-1 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded-lg"
                              >
                                {isAllModSelected ? 'Desmarcar todo' : 'Seleccionar todo'}
                              </button>
                            </div>

                            {/* Collapsible Subgroups Body */}
                            {isModOpen && (
                              <div className="p-3.5 space-y-3.5 bg-white dark:bg-slate-900">
                                {modGroup.subgroups.map((subgroup) => {
                                  const sgKey = `${modGroup.module}:${subgroup.name}`;
                                  const isSgOpen = openSubgroups.has(sgKey) || !openSubgroups.size || !!moduleSearchQuery.trim();
                                  const activeSgCapsCount = subgroup.capabilities.filter((c) => selectedCapabilityIds.has(c.id)).length;
                                  const isAllSgSelected = subgroup.capabilities.every((c) => selectedCapabilityIds.has(c.id));

                                  return (
                                    <div
                                      key={subgroup.name}
                                      className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/40 dark:bg-slate-950/40 w-full"
                                    >
                                      {/* Subgroup Accordion Bar */}
                                      <div
                                        onClick={() => toggleSubgroupOpen(sgKey)}
                                        className="flex items-center justify-between p-2.5 px-3 bg-slate-100/60 dark:bg-slate-800/40 cursor-pointer hover:bg-slate-200/50 transition-colors"
                                      >
                                        <div className="flex items-center gap-2">
                                          {isSgOpen ? (
                                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                          ) : (
                                            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                          )}
                                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                            ▶ {subgroup.name}
                                          </span>
                                          <span className="text-[10px] font-bold text-slate-400">
                                            ({activeSgCapsCount} / {subgroup.capabilities.length})
                                          </span>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleSubgroup(subgroup.capabilities);
                                          }}
                                          className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                                        >
                                          {isAllSgSelected ? 'Desmarcar' : 'Seleccionar todo'}
                                        </button>
                                      </div>

                                      {/* Subgroup Capability Items Grid */}
                                      {isSgOpen && (
                                        <div className="p-2.5 grid grid-cols-1 gap-2">
                                          {subgroup.capabilities.map((cap) => {
                                            const isEnabled = selectedCapabilityIds.has(cap.id);
                                            return (
                                              <label
                                                key={cap.id}
                                                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 w-full ${
                                                  isEnabled
                                                    ? 'bg-white dark:bg-slate-900 border-primary-300 dark:border-primary-800 shadow-2xs'
                                                    : 'bg-white/70 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300'
                                                }`}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isEnabled}
                                                  onChange={() => handleToggleCapability(cap.id)}
                                                  className="mt-0.5 h-4 w-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 flex-shrink-0 cursor-pointer"
                                                />
                                                <div className="space-y-0.5 flex-1 min-w-0">
                                                  <div className="flex items-center justify-between gap-2">
                                                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                                      {cap.name}
                                                    </span>
                                                    {renderBadgeType(cap.type)}
                                                  </div>
                                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                                    {cap.description}
                                                  </p>
                                                </div>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs">
                  Seleccione un rol para ver y configurar su matriz de capacidades.
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'SIMULATOR' ? (
          <div className="h-[calc(100vh-210px)] overflow-y-auto pr-2">
            <RoleSimulator
              roleName={selectedRole?.name || 'Cajero'}
              assignedCapIds={selectedCapabilityIds}
              warehouses={warehouses}
            />
          </div>
        ) : activeTab === 'COMPARISON' ? (
          <div className="h-[calc(100vh-210px)] overflow-y-auto pr-2">
            <RoleComparison
              roles={roles}
              groupedModules={groupedModules}
              roleCapabilitiesMap={roleCapabilitiesMap}
            />
          </div>
        ) : (
          <div className="h-[calc(100vh-210px)] overflow-y-auto pr-2">
            <RoleDiagnostics
              roleName={selectedRole?.name || 'Rol'}
              assignedCapIds={selectedCapabilityIds}
              setAssignedCapIds={setSelectedCapabilityIds}
              totalCapabilitiesCount={totalCapabilitiesCount}
            />
          </div>
        )}

        {/* COLUMN 3 (340px): Unified Role Summary Sidebar */}
        <div className="w-full">
          <RoleSummarySidebar
            selectedRole={selectedRole}
            assignedCapIds={selectedCapabilityIds}
            totalCapabilitiesCount={totalCapabilitiesCount}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </div>
      </div>

      {/* Modal 1: Confirm Save with Reason */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Save className="h-4 w-4 text-primary-600" />
                Confirmar Modificación de Capacidades
              </h3>
              <button onClick={() => setSaveModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Se registrarán los cambios efectuados en la matriz del rol <strong>{selectedRole?.name}</strong> en la bitácora de auditoría.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Motivo / Justificación (Opcional):
              </label>
              <textarea
                rows={3}
                value={saveReason}
                onChange={(e) => setSaveReason(e.target.value)}
                placeholder="Ej: Autorización especial para recepción de abastecimiento en sucursal"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSaveModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-md"
              >
                {isSaving ? 'Guardando...' : 'Confirmar y Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Create Custom Role */}
      {createRoleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRole}
            className="bg-white dark:bg-slate-900 max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-600" />
                Nuevo Rol Personalizado de Empresa
              </h3>
              <button
                type="button"
                onClick={() => setCreateRoleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Nombre del Rol *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Vendedor Mayorista, Encargado de Depósito"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Descripción</label>
                <input
                  type="text"
                  placeholder="Ej: Acceso a cobros POS, clientes y creación de solicitudes de stock"
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Clonar capacidades iniciales de (Opcional):
                </label>
                <select
                  value={newRoleBaseId}
                  onChange={(e) => setNewRoleBaseId(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Sin plantilla (Vacío)</option>
                  {editableRoles
                    .filter((r) => !r.isSystem && r.name !== 'Administrator' && r.name !== 'SuperAdmin')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCreateRoleModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreatingRole || !newRoleName.trim()}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md"
              >
                {isCreatingRole ? 'Creando...' : 'Crear Rol'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 3: History Audit Logs */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 max-w-2xl w-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-600" />
                Historial de Auditoría de Capacidades - {selectedRole?.name}
              </h3>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
                Cargando registros de auditoría...
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No existen modificaciones registradas para este rol.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto text-xs pr-1">
                {historyLogs.map((log) => (
                  <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {log.user?.name} ({log.user?.email})
                      </div>
                      <div className="text-slate-400">
                        Capacidad: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{log.capabilityId}</span>
                      </div>
                      {log.reason && (
                        <div className="text-[11px] text-slate-500 italic">
                          "{log.reason}"
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-md ${
                          log.action === 'ADDED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {log.action === 'ADDED' ? '+ AGREGADA' : '- ELIMINADA'}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {new Date(log.createdAt).toLocaleString('es-AR')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 4: Edit Role Name/Description */}
      {editRoleModalOpen && editingRole && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmEditRole}
            className="bg-white dark:bg-slate-900 max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar Rol: {editingRole.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditRoleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Nombre del Rol *</label>
                <input
                  type="text"
                  required
                  value={editRoleName}
                  onChange={(e) => setEditRoleName(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Descripción</label>
                <input
                  type="text"
                  value={editRoleDescription}
                  onChange={(e) => setEditRoleDescription(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditRoleModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isEditingRole || !editRoleName.trim()}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md"
              >
                {isEditingRole ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 5: Delete Role Confirmation */}
      {deleteRoleModalOpen && deletingRole && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Eliminar Rol
              </h3>
              <button
                onClick={() => setDeleteRoleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <p>¿Estás seguro de que deseas eliminar el rol <strong className="text-slate-900 dark:text-white">"{deletingRole.name}"</strong>?</p>
              <p className="text-slate-500">Se eliminarán todas las capacidades asignadas a este rol. Los usuarios deben ser reasignados primero.</p>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 font-semibold">
                ⚠️ Esta acción no puede revertirse.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setDeleteRoleModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteRole}
                disabled={isDeletingRole}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md"
              >
                {isDeletingRole ? 'Eliminando...' : 'Sí, Eliminar Rol'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
