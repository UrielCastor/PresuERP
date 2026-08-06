export interface MenuItem {
  name: string;
  href?: string;
  iconName: string;
  permission?: string;
  capability?: string;
  children?: MenuItem[];
}

export const menuConfig: MenuItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    iconName: 'LayoutDashboard',
    capability: 'dashboard.view',
  },
  {
    name: 'Panel Staff SaaS',
    iconName: 'ShieldCheck',
    permission: 'system:access',
    children: [
      { name: 'Empresas', href: '/system/businesses', iconName: 'Building2', permission: 'system:access' },
      { name: 'Planes', href: '/system/plans', iconName: 'Zap', permission: 'system:access' },
      { name: 'Suscripciones', href: '/system/subscriptions', iconName: 'CreditCard', permission: 'system:access' },
      { name: 'Consumo', href: '/system/usage', iconName: 'Activity', permission: 'system:access' },
      { name: 'Facturación', href: '/system/billing', iconName: 'DollarSign', permission: 'system:access' },
      { name: 'Cupones', href: '/system/coupons', iconName: 'Tag', permission: 'system:access' },
      { name: 'Auditoría SaaS', href: '/system/audit', iconName: 'ShieldCheck', permission: 'system:access' },
    ],
  },
  {
    name: 'Usuarios',
    href: '/users',
    iconName: 'Users',
    permission: 'users:read',
    capability: 'users.view',
  },
  {
    name: 'Inventario',
    iconName: 'Package',
    children: [
      {
        name: 'Productos',
        href: '/products',
        iconName: 'Boxes',
        permission: 'products:read',
        capability: 'products.view',
      },
      {
        name: 'Listas de Precios',
        href: '/price-lists',
        iconName: 'BadgeDollarSign',
        permission: 'products:read',
        capability: 'price_lists.view',
      },
      {
        name: 'Categorías',
        href: '/categories',
        iconName: 'Tags',
        permission: 'categories:read',
        capability: 'categories.view',
      },
      {
        name: 'Proveedores',
        href: '/suppliers',
        iconName: 'Truck',
        permission: 'suppliers:read',
        capability: 'suppliers.view',
      },
      {
        name: 'Depósitos',
        href: '/warehouses',
        iconName: 'Warehouse',
        permission: 'warehouses:read',
        capability: 'warehouses.view',
      },
      {
        name: 'Stock',
        href: '/stocks',
        iconName: 'PackageOpen',
        permission: 'stocks:read',
        capability: 'stocks.view',
      },
      {
        name: 'Compras',
        href: '/purchases',
        iconName: 'ShoppingCart',
        permission: 'purchases:read',
        capability: 'purchases.view',
      },
    ],
  },
  {
    name: 'Traspasos',
    iconName: 'ArrowRightLeft',
    children: [
      {
        name: 'Dashboard',
        href: '/logistics',
        iconName: 'LayoutDashboard',
        permission: 'stocks:read',
        capability: 'logistics.dashboard.view',
      },
      {
        name: 'Pedidos',
        href: '/logistics/orders',
        iconName: 'ClipboardList',
        permission: 'stocks:read',
        capability: 'logistics.request.view',
      },
      {
        name: 'Aprobación de Pedidos',
        href: '/logistics/orders/pending',
        iconName: 'ClipboardCheck',
        permission: 'transfer_requests:approve',
        capability: 'logistics.request.approve',
      },
      {
        name: 'Disponibilidad',
        href: '/logistics/availability',
        iconName: 'PackageSearch',
        permission: 'stocks:read',
        capability: 'logistics.request.view',
      },
      {
        name: 'Traspasos',
        href: '/logistics/transfers',
        iconName: 'ArrowLeftRight',
        permission: 'stocks:read',
        capability: 'logistics.transfer.view',
      },
      {
        name: 'Recepciones',
        href: '/logistics/receipts',
        iconName: 'PackageCheck',
        permission: 'stocks:read',
        capability: 'logistics.transfer.receive',
      },
      {
        name: 'Historial',
        href: '/logistics/history',
        iconName: 'History',
        permission: 'stocks:read',
        capability: 'logistics.request.view',
      },
    ],
  },
  {
    name: 'Ventas (POS)',
    href: '/sales',
    iconName: 'ScanLine',
    permission: 'sales:read',
    capability: 'sales.view',
  },
  {
    name: 'Clientes',
    href: '/customers',
    iconName: 'UsersRound',
    permission: 'customers:read',
    capability: 'customers.view',
  },
  {
    name: 'Caja',
    href: '/cash',
    iconName: 'Wallet',
    permission: 'cash:view',
    capability: 'cash.view',
  },
  {
    name: 'Reportes',
    href: '/reports',
    iconName: 'BarChart3',
    permission: 'reports:read',
    capability: 'reports.view',
  },
  {
    name: 'Auditorías',
    href: '/audit',
    iconName: 'FileSearch',
    permission: 'AUDIT_VIEW',
    capability: 'audit.view',
  },
  {
    name: 'Configuración',
    iconName: 'Settings',
    children: [
      {
        name: 'Empresa',
        href: '/settings/company',
        iconName: 'Building2',
        permission: 'settings:read',
        capability: 'settings.general.view',
      },
      {
        name: 'Sistema',
        href: '/settings',
        iconName: 'Cpu',
        permission: 'settings:read',
        capability: 'settings.general.view',
      },
      {
        name: 'Roles y Capacidades',
        href: '/settings/roles-capabilities',
        iconName: 'Shield',
        permission: 'users:write',
        capability: 'roles.manage',
      },
      {
        name: 'Auditoría de Permisos',
        href: '/settings/user-permissions-audit',
        iconName: 'ShieldCheck',
        permission: 'users:read',
        capability: 'audit.view',
      },
      {
        name: 'POS',
        href: '/settings/pos',
        iconName: 'ScanLine',
        permission: 'settings:pos:read',
        capability: 'settings.pos.update',
      },
    ],
  },
];
