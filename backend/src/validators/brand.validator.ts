import { z } from 'zod';

export const createBrandSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    description: z.string().optional().nullable(),
  }),
});

export const updateBrandSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
    description: z.string().optional().nullable(),
  }),
});
