import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(150),
  type: z.enum(['PERSON', 'COMPANY']).optional().default('PERSON'),
  document: z.string().optional().nullable(),
  taxCondition: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  allowCreditAccount: z.boolean().optional(),
  creditLimit: z.coerce.number().min(0, 'El límite de crédito no puede ser negativo').optional(),
  currentDebt: z.coerce.number().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();
