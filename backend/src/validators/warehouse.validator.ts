import { z } from 'zod';

export const createWarehouseSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    code: z.string().optional().nullable().or(z.literal('')),
    description: z.string().optional().nullable().or(z.literal('')),
    address: z.string().optional().nullable().or(z.literal('')),
    managerName: z.string().optional().nullable().or(z.literal('')),
    phone: z.string().optional().nullable().or(z.literal('')),
    email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
    isMain: z.boolean().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  }),
});

export const updateWarehouseSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
    code: z.string().optional().nullable().or(z.literal('')).optional(),
    description: z.string().optional().nullable().or(z.literal('')).optional(),
    address: z.string().optional().nullable().or(z.literal('')).optional(),
    managerName: z.string().optional().nullable().or(z.literal('')).optional(),
    phone: z.string().optional().nullable().or(z.literal('')).optional(),
    email: z.string().email('Email inválido').optional().nullable().or(z.literal('')).optional(),
    isMain: z.boolean().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    changeReason: z.string({ required_error: 'El motivo del cambio es obligatorio' }).min(4, 'El motivo debe tener al menos 4 caracteres'),
  }),
});

export const deleteWarehouseSchema = z.object({
  body: z.object({
    changeReason: z.string({ required_error: 'El motivo de la eliminación es obligatorio' }).min(4, 'El motivo debe tener al menos 4 caracteres'),
  }),
});
