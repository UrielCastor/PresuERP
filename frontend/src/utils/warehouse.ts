import { User } from '../contexts/AuthContext';

/**
 * Prioridad de selección inicial de depósito:
 * 1) user.defaultWarehouseId || user.defaultWarehouse?.id
 * 2) primer depósito autorizado (user.userWarehouses?.[0])
 * 3) fallback: primer depósito disponible en la lista (si aplica) o null
 */
export const getInitialWarehouseId = (
  user?: User | null,
  availableWarehouses?: Array<{ id: string }>
): string | null => {
  if (!user) {
    const result = availableWarehouses?.[0]?.id || null;
    console.log('[INITIAL WAREHOUSE] sin user, fallback a availableWarehouses[0]:', { result, availableWarehouses });
    return result;
  }

  // 1) user.defaultWarehouseId
  const defaultId = user.defaultWarehouseId || user.defaultWarehouse?.id;
  if (defaultId) {
    console.log('[INITIAL WAREHOUSE] usando defaultWarehouseId:', {
      isStaff: user.isStaff,
      defaultWarehouseId: user.defaultWarehouseId,
      'defaultWarehouse?.id': user.defaultWarehouse?.id,
      selected: defaultId,
    });
    return defaultId;
  }

  // 2) si no existe: primer depósito autorizado
  const firstAuthorizedId =
    user.userWarehouses?.[0]?.warehouseId ||
    user.userWarehouses?.[0]?.warehouse?.id;
  if (firstAuthorizedId) {
    console.log('[INITIAL WAREHOUSE] sin defaultWarehouseId, usando primer userWarehouse:', {
      isStaff: user.isStaff,
      userWarehouses: user.userWarehouses,
      selected: firstAuthorizedId,
    });
    return firstAuthorizedId;
  }

  // 3) Si no tiene ni default ni userWarehouses (ej. Staff), primer depósito disponible
  if (availableWarehouses && availableWarehouses.length > 0) {
    console.log('[INITIAL WAREHOUSE] sin default ni userWarehouses, fallback a availableWarehouses[0]:', {
      isStaff: user.isStaff,
      availableWarehouses,
      selected: availableWarehouses[0].id,
    });
    return availableWarehouses[0].id;
  }

  console.log('[INITIAL WAREHOUSE] ningún depósito encontrado, retornando null', {
    isStaff: user.isStaff,
    defaultWarehouseId: user.defaultWarehouseId,
    userWarehouses: user.userWarehouses,
    availableWarehouses,
  });
  return null;
};
