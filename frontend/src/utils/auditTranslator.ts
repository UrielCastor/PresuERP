export interface HumanAuditEvent {
  title: string;
  category: string;
  badgeColor: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple';
  user: string;
  date: string;
  amountFormatted?: string;
  reason?: string;
  details: Array<{ field: string; oldVal: string; newVal: string }>;
}

export const auditFieldLabels: Record<string, string> = {
  minimumStock: 'Stock mínimo',
  minStock: 'Stock mínimo',
  maximumStock: 'Stock máximo',
  maxStock: 'Stock máximo',
  reservedQuantity: 'Cantidad reservada',
  productName: 'Producto',
  warehouseName: 'Depósito',
  oldData: 'Datos anteriores',
  newData: 'Datos nuevos',
  entity: 'Entidad',
  module: 'Módulo',
  price: 'Precio de Venta',
  salePrice: 'Precio de Venta',
  cost: 'Costo de Compra',
  purchasePrice: 'Costo de Compra',
  quantity: 'Cantidad / Stock',
  name: 'Nombre',
  status: 'Estado',
  categoryId: 'Categoría',
  categoryName: 'Categoría',
  supplierId: 'Proveedor',
  supplierName: 'Proveedor',
  countedBalance: 'Saldo Contado',
  expectedBalance: 'Saldo Esperado',
  difference: 'Diferencia',
  barcode: 'Código de barras',
  sku: 'SKU / Código',
};

export function translateAuditEvent(log: any): HumanAuditEvent {
  const action = (log.action || '').toUpperCase();
  const moduleName = (log.module || log.entity || log.entityName || '').toUpperCase();
  const oldData = log.oldData || log.previousValues || {};
  const newData = log.newData || log.newValues || {};

  let title = action;
  let category = 'Sistema';
  let badgeColor: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' = 'blue';

  // 1. Event Translation Map
  if (action === 'MANUAL_INCOME' || (moduleName.includes('CASH') && action.includes('INCOME'))) {
    title = 'Ingreso manual de caja';
    category = 'Ingreso de Caja';
    badgeColor = 'emerald';
  } else if (action === 'MANUAL_EXPENSE' || (moduleName.includes('CASH') && action.includes('EXPENSE'))) {
    title = 'Egreso manual de caja';
    category = 'Egreso de Caja';
    badgeColor = 'rose';
  } else if (action === 'CLOSE_CASH_REGISTER' || action.includes('CLOSE')) {
    title = 'Cierre de caja';
    category = 'Caja';
    badgeColor = 'blue';
  } else if (action === 'OPEN_CASH_REGISTER' || action.includes('OPEN')) {
    title = 'Apertura de caja';
    category = 'Caja';
    badgeColor = 'emerald';
  } else if (action === 'PRODUCT_PRICE_CHANGED') {
    title = 'Cambio de precio de producto';
    category = 'Modificación de Precio';
    badgeColor = 'amber';
  } else if (action === 'PRODUCT_COST_CHANGED') {
    title = 'Cambio de costo de producto';
    category = 'Modificación de Costo';
    badgeColor = 'amber';
  } else if (action === 'PRODUCT_UPDATED' || (moduleName.includes('PRODUCT') && action.includes('UPDATE'))) {
    title = 'Modificación de producto';
    category = 'Producto';
    badgeColor = 'amber';
  } else if (action === 'PRODUCT_CREATED' || (moduleName.includes('PRODUCT') && action.includes('CREATE'))) {
    title = 'Producto creado';
    category = 'Producto';
    badgeColor = 'emerald';
  } else if (action === 'CREATE_SALE' || action === 'SALE_CREATED' || (moduleName.includes('SALE') && action === 'CREATE')) {
    title = 'Venta creada';
    category = 'Venta';
    badgeColor = 'emerald';
  } else if (action === 'CANCEL_SALE' || action.includes('CANCEL')) {
    title = 'Venta anulada';
    category = 'Anulación';
    badgeColor = 'rose';
  } else if (action === 'UPDATE_STOCK_LEVELS') {
    title = 'Actualización de niveles de stock';
    category = 'Stock';
    badgeColor = 'blue';
  } else if (action === 'UPDATE_STOCK' || action === 'STOCK_ADJUSTMENT' || moduleName.includes('STOCK')) {
    title = 'Ajuste de stock';
    category = 'Stock';
    badgeColor = 'amber';
  } else if (action === 'CREATE_MOVEMENT') {
    title = 'Movimiento de stock creado';
    category = 'Stock';
    badgeColor = 'emerald';
  } else if (action === 'CREATE_PURCHASE' || moduleName.includes('PURCHASE')) {
    title = 'Compra registrada';
    category = 'Compra';
    badgeColor = 'emerald';
  } else if (action === 'USER_LOGIN' || action === 'LOGIN_SUCCESS') {
    title = 'Inicio de sesión';
    category = 'Seguridad';
    badgeColor = 'purple';
  } else if (action === 'CREATE' || action === 'CREATION') {
    title = `Registro creado (${log.module || log.entity || 'Entidad'})`;
    category = 'Creación';
    badgeColor = 'emerald';
  } else if (action === 'UPDATE' || action === 'MODIFY') {
    title = `Registro actualizado (${log.module || log.entity || 'Entidad'})`;
    category = 'Modificación';
    badgeColor = 'amber';
  } else if (action === 'DELETE' || action === 'REMOVE') {
    title = `Registro eliminado (${log.module || log.entity || 'Entidad'})`;
    category = 'Eliminación';
    badgeColor = 'rose';
  }

  // 2. Extract Amount
  let amountFormatted: string | undefined = undefined;
  const rawAmt = newData.amount ?? newData.total ?? newData.price ?? newData.countedBalance ?? oldData.price;
  if (rawAmt !== undefined && rawAmt !== null && !isNaN(Number(rawAmt))) {
    amountFormatted = `$${Number(rawAmt).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  }

  // 3. Extract Reason / Motivo
  const reason =
    newData.reason ||
    newData.changeReason ||
    newData.concept ||
    newData.notes ||
    oldData.notes ||
    oldData.reason ||
    'Sin motivo especificado';

  // 4. Extract Key Field Differences
  const details: Array<{ field: string; oldVal: string; newVal: string }> = [];

  const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));
  for (const key of allKeys) {
    if (['reason', 'changeReason', 'concept', 'notes', 'updatedAt', 'createdAt', 'businessId', 'id', 'userId'].includes(key)) continue;
    const oldV = oldData[key];
    const newV = newData[key];
    if (oldV !== undefined || newV !== undefined) {
      if (JSON.stringify(oldV) !== JSON.stringify(newV)) {
        const fieldName = auditFieldLabels[key] || key;
        const fmtVal = (val: any) => {
          if (val === undefined || val === null) return '-';
          if (typeof val === 'number') {
            if (key.toLowerCase().includes('price') || key.toLowerCase().includes('cost') || key.toLowerCase().includes('balance')) {
              return `$${val.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
            }
            return val.toString();
          }
          return String(val);
        };
        details.push({
          field: fieldName,
          oldVal: fmtVal(oldV),
          newVal: fmtVal(newV),
        });
      }
    }
  }

  return {
    title,
    category,
    badgeColor,
    user: log.user || 'Sistema',
    date: new Date(log.createdAt).toLocaleString('es-AR'),
    amountFormatted,
    reason,
    details,
  };
}
