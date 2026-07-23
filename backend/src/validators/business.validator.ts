import { z } from 'zod';

export const businessValidator = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  taxId: z.string().min(1, 'El identificador fiscal es obligatorio'),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().optional(),
  subscriptionPlan: z.string().default('FREE'),
  subscriptionEndsAt: z.string().datetime().optional()
});

export const updateBusinessValidator = businessValidator.partial();
