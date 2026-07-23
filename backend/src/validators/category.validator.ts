import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    description: z.string().optional().nullable(),
    status: z.string().optional(),
  }),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
    description: z.string().optional().nullable(),
    status: z.string().optional(),
    changeReason: z.string({ required_error: 'El motivo del cambio es obligatorio' }).min(4, 'El motivo debe tener al menos 4 caracteres'),
  }),
});
