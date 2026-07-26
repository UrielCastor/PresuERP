import { z } from 'zod';

export const createSaleSchema = z.object({
  body: z.object({
    customerId: z.string().uuid('El ID del cliente debe ser válido').optional().nullable(),
    cashSessionId: z.string().uuid('La sesión de caja debe ser válida').optional().nullable(),
    documentTypeId: z.string().uuid('El ID del tipo de documento debe ser válido').optional().nullable(),
    documentSeriesId: z.string().uuid('El ID de la serie de documento debe ser válido').optional().nullable(),
    warehouseId: z.string().uuid('El ID de depósito es requerido'),
    subtotal: z.number().min(0),
    discountType: z.enum(['FIXED', 'PERCENTAGE']).optional().default('FIXED'),
    discountValue: z.number().min(0).optional().default(0),
    discountAmount: z.number().min(0).default(0),
    surchargeType: z.enum(['NONE', 'FIXED', 'PERCENTAGE']).optional().default('NONE'),
    surchargeValue: z.number().min(0).optional().default(0),
    surchargeAmount: z.number().min(0).default(0),
    taxAmount: z.number().min(0).default(0),
    totalAmount: z.number().min(0),
    paymentMethod: z.string().optional(),
    notes: z.string().optional().nullable(),
    status: z.string().optional(),
    items: z
      .array(
        z.object({
          productId: z.string().uuid('ID de producto inválido'),
          quantity: z.number().min(0.001, 'La cantidad debe ser mayor a 0'),
          unitPrice: z.number().min(0, 'El precio no puede ser negativo'),
          discountAmount: z.number().min(0).default(0),
          taxAmount: z.number().min(0).default(0),
          totalAmount: z.number().min(0),
        })
      )
      .min(1, 'La venta debe contener al menos un producto'),
    payments: z
      .array(
        z.object({
          paymentMethodId: z.string().uuid('ID de método de pago inválido').optional().nullable(),
          amount: z.number().min(0.01, 'El monto del pago debe ser mayor a 0'),
          transactionReference: z.string().optional().nullable(),
          details: z.string().optional().nullable(),
        })
      )
      .optional()
      .default([]),
  }),
});

export const updateSaleSchema = z.object({
  body: z.object({
    status: z.enum(['COMPLETED', 'DRAFT', 'CANCELLED', 'REFUNDED']).optional(),
    notes: z.string().optional().nullable(),
  }),
});

export const getSalesSchema = z.object({
  query: z.object({
    customerId: z.string().optional(),
    cashSessionId: z.string().optional(),
    documentTypeId: z.string().optional(),
    warehouseId: z.string().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  }),
});
