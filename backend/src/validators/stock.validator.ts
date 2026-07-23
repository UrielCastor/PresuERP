import { z } from 'zod';

export const updateStockSchema = z.object({
  quantity: z.number().min(0, 'La cantidad no puede ser menor a cero').optional(),
  changeReason: z.string().optional(),
  minimumStock: z.number().min(0, 'El stock mínimo no puede ser menor a cero').optional(),
  maximumStock: z.number().min(0, 'El stock máximo no puede ser menor a cero').optional(),
  reservedQuantity: z.number().min(0, 'La cantidad reservada no puede ser menor a cero').optional(),
}).refine(
  (data) => {
    // If quantity is adjusted, changeReason must be supplied and >= 4 chars
    if (data.quantity !== undefined) {
      return data.changeReason !== undefined && data.changeReason.trim().length >= 4;
    }
    return true;
  },
  {
    message: 'El motivo del cambio es obligatorio y debe tener al menos 4 caracteres.',
    path: ['changeReason'],
  }
);
