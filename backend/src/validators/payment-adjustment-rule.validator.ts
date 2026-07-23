import { z } from 'zod';

export const createPaymentAdjustmentRuleSchema = z.object({
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'MERCADOPAGO', 'DEBIT_CARD', 'CREDIT_CARD'], {
    errorMap: () => ({ message: 'Método de pago inválido. Valores permitidos: CASH, TRANSFER, MERCADOPAGO, DEBIT_CARD, CREDIT_CARD' })
  }),
  adjustmentType: z.enum(['DISCOUNT', 'SURCHARGE'], {
    errorMap: () => ({ message: 'Tipo de ajuste inválido. Debe ser DISCOUNT o SURCHARGE' })
  }),
  valueType: z.enum(['PERCENTAGE', 'FIXED'], {
    errorMap: () => ({ message: 'Tipo de valor inválido. Debe ser PERCENTAGE o FIXED' })
  }),
  value: z.number().min(0, 'El valor del ajuste debe ser mayor o igual a cero'),
  active: z.boolean().optional().default(true)
});

export const updatePaymentAdjustmentRuleSchema = createPaymentAdjustmentRuleSchema.partial();
