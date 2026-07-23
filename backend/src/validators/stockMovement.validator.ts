import * as z from 'zod';

export const createStockMovementSchema = z.object({
  warehouseId: z.string().uuid('Depósito inválido'),
  productId: z.string().uuid('Producto inválido'),
  movementType: z.enum([
    'ENTRY',
    'EXIT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'ADJUSTMENT',
    'INVENTORY',
    'RETURN_CUSTOMER',
    'RETURN_SUPPLIER',
    'PRODUCTION_INPUT',
    'PRODUCTION_OUTPUT',
  ], {
    errorMap: () => ({ message: 'Tipo de movimiento inválido' }),
  }),
  quantity: z.coerce.number({ invalid_type_error: 'La cantidad debe ser un número válido' }),
  unitCost: z.coerce.number().min(0, 'El costo unitario no puede ser negativo').optional(),
  referenceType: z.string().max(100).optional().nullable(),
  referenceId: z.string().max(100).optional().nullable(),
  referenceNumber: z.string().max(100).optional().nullable(),
  reason: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine((data) => {
  const type = data.movementType;
  // ENTRY, EXIT, TRANSFER_IN, TRANSFER_OUT must have positive quantities
  if (['ENTRY', 'EXIT', 'TRANSFER_IN', 'TRANSFER_OUT'].includes(type) && data.quantity <= 0) {
    return false;
  }
  return true;
}, {
  message: 'Para ingresos y egresos, la cantidad debe ser mayor a cero.',
  path: ['quantity'],
});

export type CreateStockMovementDto = z.infer<typeof createStockMovementSchema>;
