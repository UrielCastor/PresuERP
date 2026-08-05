import { z } from 'zod';

export const updatePointsSettingsSchema = z.object({
  body: z.object({
    enabled: z.boolean(),
    earnEveryAmount: z.number().min(0.01, 'Debe ingresar un monto válido para acumular puntos'),
    earnPoints: z.number().int().min(1, 'Los puntos a acumular deben ser mínimo 1'),
    minimumSaleAmount: z.number().min(0, 'El monto mínimo de venta no puede ser negativo'),
    pointValue: z.number().min(0.01, 'El valor del punto debe ser mayor a cero'),
    allowPartialRedemption: z.boolean(),
    allowRedemption: z.boolean(),
    maxRedemptionPercentage: z.number().min(0.01).max(100, 'El porcentaje máximo debe estar entre 0.01 y 100'),
    expirePoints: z.boolean(),
    expirationMonths: z.number().int().min(1, 'La expiración debe ser mínimo de 1 mes'),
    roundingMode: z.enum(['FLOOR', 'ROUND', 'CEIL']),
    pointsCalculationMode: z.enum(['GROSS', 'AFTER_DISCOUNTS', 'EFFECTIVELY_PAID']),
    accumulateOnPointsPaid: z.boolean(),
  }),
});

export const adjustPointsSchema = z.object({
  body: z.object({
    customerId: z.string().uuid('ID de cliente inválido'),
    points: z.number().int().refine((val) => val !== 0, {
      message: 'El ajuste de puntos no puede ser cero',
    }),
    description: z.string().optional(),
  }),
});

export const getPointsHistorySchema = z.object({
  query: z.object({
    customerId: z.string().uuid('ID de cliente inválido').optional(),
    type: z.enum(['EARN', 'REDEEM', 'ADJUSTMENT', 'EXPIRED']).optional(),
    reason: z.enum(['SALE', 'SALE_CANCEL', 'REDEEM', 'REDEEM_CANCEL', 'MANUAL', 'EXPIRATION', 'BONUS', 'MIGRATION', 'PROMOTION']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  }).partial(),
});

export const previewPointsRedemptionSchema = z.object({
  body: z.object({
    customerId: z.string().uuid('ID de cliente inválido'),
    pointsToRedeem: z.number().int().min(0, 'Los puntos a canjear no pueden ser negativos'),
    saleTotalBeforePoints: z.number().min(0, 'El total de venta no puede ser negativo'),
  }),
});

export const previewPointsEarnSchema = z.object({
  body: z.object({
    customerId: z.string().uuid('ID de cliente inválido').nullable().optional(),
    totalAmount: z.number().min(0, 'El total de venta no puede ser negativo'),
  }),
});

export const getPointsReportSchema = z.object({
  query: z.object({
    customerId: z.string().uuid('ID de cliente inválido').optional(),
    type: z.enum(['EARN', 'REDEEM', 'ADJUSTMENT', 'EXPIRED']).optional(),
    reason: z.enum(['SALE', 'SALE_CANCEL', 'REDEEM', 'REDEEM_CANCEL', 'MANUAL', 'EXPIRATION', 'BONUS', 'MIGRATION', 'PROMOTION']).optional(),
    createdById: z.string().uuid('ID de vendedor inválido').optional(),
    warehouseId: z.string().uuid('ID de sucursal/depósito inválido').optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    format: z.enum(['CSV', 'PDF', 'XLSX']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  }).partial(),
});
