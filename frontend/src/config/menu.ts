export interface MenuItem {
  name: string;
  href?: string;
  iconName: string;
  permission?: string;
  children?: MenuItem[];
}

export const menuConfig: MenuItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    iconName: 'LayoutDashboard',
  },
  {
    name: 'Panel Staff SaaS',
    href: '/system',
    iconName: 'Server',
    permission: 'system:access',
  },
  {
    name: 'Usuarios',
    href: '/users',
    iconName: 'Users',
    permission: 'users:read',
  },
  {
    name: 'Inventario',
    iconName: 'Boxes',
    children: [
      {
        name: 'Productos',
        href: '/products',
        iconName: 'Package',
        permission: 'products:read',
      },
      {
        name: 'Listas de Precios',
        href: '/price-lists',
        iconName: 'Tag',
        permission: 'products:read',
      },
      {
        name: 'Categorías',
        href: '/categories',
        iconName: 'FolderOpen',
        permission: 'categories:read',
      },
      {
        name: 'Proveedores',
        href: '/suppliers',
        iconName: 'Truck',
        permission: 'suppliers:read',
      },
      {
        name: 'Depósitos',
        href: '/warehouses',
        iconName: 'Warehouse',
        permission: 'warehouses:read',
      },
      {
        name: 'Stock',
        href: '/stocks',
        iconName: 'Boxes',
        permission: 'stocks:read',
      },
      {
        name: 'Compras',
        href: '/purchases',
        iconName: 'ShoppingCart',
        permission: 'purchases:read',
      },
    ],
  },
  {
    name: 'Traspasos',
    iconName: 'Truck',
    children: [
      {
        name: 'Dashboard',
        href: '/logistics',
        iconName: 'LayoutDashboard',
        permission: 'transfer_requests:read',
      },
      {
        name: 'Pedidos',
        href: '/logistics/orders',
        iconName: 'ClipboardList',
        permission: 'transfer_requests:read',
      },
      {
        name: 'Aprobación de Pedidos',
        href: '/logistics/orders/pending',
        iconName: 'CheckCircle2',
        permission: 'transfer_requests:approve',
      },
      {
        name: 'Disponibilidad',
        href: '/logistics/availability',
        iconName: 'Warehouse',
        permission: 'transfer_requests:read',
      },
      {
        name: 'Traspasos',
        href: '/logistics/transfers',
        iconName: 'Truck',
        permission: 'transfers:read',
      },
      {
        name: 'Recepciones',
        href: '/logistics/receipts',
        iconName: 'Boxes',
        permission: 'transfers:receive',
      },
      {
        name: 'Historial',
        href: '/logistics/history',
        iconName: 'History',
        permission: 'transfer_requests:read',
      },
    ],
  },
  {
    name: 'Ventas (POS)',
    href: '/sales',
    iconName: 'ShoppingCart',
    permission: 'sales:read',
  },
  {
    name: 'Clientes',
    href: '/customers',
    iconName: 'Users',
    permission: 'customers:read',
  },
  {
    name: 'Caja',
    href: '/cash',
    iconName: 'Building',
    permission: 'cash:view',
  },
  {
    name: 'Reportes',
    href: '/reports',
    iconName: 'TrendingUp',
    permission: 'reports:read',
  },
  {
    name: 'Auditorías',
    href: '/audit',
    iconName: 'History',
    permission: 'AUDIT_VIEW',
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
      },
      {
        name: 'Sistema',
        href: '/settings',
        iconName: 'Settings',
        permission: 'settings:read',
      },
      {
        name: 'POS',
        href: '/settings/pos',
        iconName: 'ShoppingCart',
        permission: 'settings:pos:read',
      },
    ],
  },
];
