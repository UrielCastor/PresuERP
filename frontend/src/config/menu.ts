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
    name: 'Ventas (POS)',
    href: '/sales',
    iconName: 'ShoppingCart',
    permission: 'sales:read',
  },
  {
    name: 'Clientes',
    href: '/customers',
    iconName: 'Users',
    permission: 'sales:read',
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
    permission: 'sales:read',
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
        name: 'Auditoría del Sistema',
        href: '/system/audit',
        iconName: 'History',
        permission: 'AUDIT_VIEW',
      },
    ],
  },
];
