import { useMemo } from 'react';

export interface SimulatedAction {
  id: string;
  name: string;
  requiredCapability: string;
  isAllowed: boolean;
}

export interface SimulatedModuleState {
  moduleKey: string;
  moduleName: string;
  isVisible: boolean;
  requiredViewCap: string;
  actions: SimulatedAction[];
}

export function useRoleSimulation(assignedCapIds: Set<string>) {
  const simulatedModules = useMemo<SimulatedModuleState[]>(() => {
    const check = (capId: string) => assignedCapIds.has(capId);

    return [
      {
        moduleKey: 'dashboard',
        moduleName: 'Dashboard Principal',
        isVisible: check('dashboard.view') || assignedCapIds.size > 0,
        requiredViewCap: 'dashboard.view',
        actions: [
          { id: 'dash-view', name: 'Visualizar Métricas', requiredCapability: 'dashboard.view', isAllowed: check('dashboard.view') || assignedCapIds.size > 0 },
        ],
      },
      {
        moduleKey: 'sales',
        moduleName: 'POS / Ventas',
        isVisible: check('sales.view'),
        requiredViewCap: 'sales.view',
        actions: [
          { id: 'sales-create', name: 'Realizar Venta / Cobro', requiredCapability: 'sales.create', isAllowed: check('sales.create') },
          { id: 'sales-change-customer', name: 'Cambiar Cliente en Ticket', requiredCapability: 'sales.change_customer', isAllowed: check('sales.change_customer') },
          { id: 'sales-discount', name: 'Aplicar Descuento / Bonificación', requiredCapability: 'sales.discount', isAllowed: check('sales.discount') },
          { id: 'sales-change-price', name: 'Modificar Precio Unitario', requiredCapability: 'sales.change_price', isAllowed: check('sales.change_price') },
          { id: 'sales-account', name: 'Vender a Cuenta Corriente', requiredCapability: 'sales.account', isAllowed: check('sales.account') },
          { id: 'sales-reprint', name: 'Reimprimir Comprobante', requiredCapability: 'sales.reprint', isAllowed: check('sales.reprint') },
          { id: 'sales-cancel', name: 'Anular Venta Emitida', requiredCapability: 'sales.cancel', isAllowed: check('sales.cancel') },
          { id: 'sales-open-drawer', name: 'Abrir Cajón de Dinero', requiredCapability: 'sales.open_drawer', isAllowed: check('sales.open_drawer') },
        ],
      },
      {
        moduleKey: 'products',
        moduleName: 'Catálogo de Productos',
        isVisible: check('products.view'),
        requiredViewCap: 'products.view',
        actions: [
          { id: 'prod-create', name: 'Crear Nuevo Producto', requiredCapability: 'products.create', isAllowed: check('products.create') },
          { id: 'prod-edit-general', name: 'Editar Nombre y Descripción', requiredCapability: 'products.edit_name', isAllowed: check('products.edit_name') },
          { id: 'prod-edit-cost', name: 'Editar Costo de Reposición', requiredCapability: 'products.edit_cost', isAllowed: check('products.edit_cost') },
          { id: 'prod-edit-margin', name: 'Editar Margen de Ganancia %', requiredCapability: 'products.edit_margin', isAllowed: check('products.edit_margin') },
          { id: 'prod-edit-price', name: 'Editar Precio de Venta', requiredCapability: 'products.edit_price', isAllowed: check('products.edit_price') },
          { id: 'prod-edit-tax', name: 'Editar Alícuota IVA', requiredCapability: 'products.edit_tax', isAllowed: check('products.edit_tax') },
          { id: 'prod-delete', name: 'Eliminar / Desactivar Producto', requiredCapability: 'products.delete', isAllowed: check('products.delete') },
        ],
      },
      {
        moduleKey: 'cash',
        moduleName: 'Caja y Tesorería',
        isVisible: check('cash.view'),
        requiredViewCap: 'cash.view',
        actions: [
          { id: 'cash-open', name: 'Apertura de Turno de Caja', requiredCapability: 'cash.open', isAllowed: check('cash.open') },
          { id: 'cash-close', name: 'Cierre Z y Arqueo de Caja', requiredCapability: 'cash.close', isAllowed: check('cash.close') },
          { id: 'cash-income', name: 'Registrar Ingreso de Caja', requiredCapability: 'cash.income', isAllowed: check('cash.income') },
          { id: 'cash-expense', name: 'Registrar Egreso / Retiro', requiredCapability: 'cash.expense', isAllowed: check('cash.expense') },
          { id: 'cash-reopen', name: 'Reabrir Caja Cerrada', requiredCapability: 'cash.reopen', isAllowed: check('cash.reopen') },
          { id: 'cash-audit', name: 'Ver Bitácora de Auditoría Caja', requiredCapability: 'cash.audit', isAllowed: check('cash.audit') },
        ],
      },
      {
        moduleKey: 'purchases',
        moduleName: 'Gestión de Compras',
        isVisible: check('purchases.view'),
        requiredViewCap: 'purchases.view',
        actions: [
          { id: 'pur-create', name: 'Crear Órden de Compra', requiredCapability: 'purchases.create', isAllowed: check('purchases.create') },
          { id: 'pur-edit-prices', name: 'Modificar Precios de Compra', requiredCapability: 'purchases.edit_prices', isAllowed: check('purchases.edit_prices') },
          { id: 'pur-approve', name: 'Aprobar Recepción y Stock', requiredCapability: 'purchases.approve', isAllowed: check('purchases.approve') },
          { id: 'pur-cancel', name: 'Anular Órden de Compra', requiredCapability: 'purchases.cancel', isAllowed: check('purchases.cancel') },
        ],
      },
      {
        moduleKey: 'customers',
        moduleName: 'Gestión de Clientes',
        isVisible: check('customers.view'),
        requiredViewCap: 'customers.view',
        actions: [
          { id: 'cust-create', name: 'Crear Cliente', requiredCapability: 'customers.create', isAllowed: check('customers.create') },
          { id: 'cust-edit-credit', name: 'Modificar Límite de Crédito', requiredCapability: 'customers.edit_credit_limit', isAllowed: check('customers.edit_credit_limit') },
          { id: 'cust-edit-balance', name: 'Ajustar Saldo de Cta Cte', requiredCapability: 'customers.edit_balance', isAllowed: check('customers.edit_balance') },
        ],
      },
      {
        moduleKey: 'settings',
        moduleName: 'Configuración del Sistema',
        isVisible: check('settings.view'),
        requiredViewCap: 'settings.view',
        actions: [
          { id: 'set-general', name: 'Editar Datos de Empresa', requiredCapability: 'settings.general.update', isAllowed: check('settings.general.update') },
          { id: 'set-fiscal', name: 'Editar Configuración Fiscal / AFIP', requiredCapability: 'settings.fiscal.update', isAllowed: check('settings.fiscal.update') },
          { id: 'set-pos', name: 'Configurar Reglas de POS / Puntos', requiredCapability: 'settings.pos.update', isAllowed: check('settings.pos.update') },
          { id: 'set-security', name: 'Configurar Seguridad y Roles', requiredCapability: 'settings.security.update', isAllowed: check('settings.security.update') },
        ],
      },
    ];
  }, [assignedCapIds]);

  return { simulatedModules };
}
