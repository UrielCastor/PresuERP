import { z } from 'zod';

export const createSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    taxId: z.string().optional().nullable(),
    email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    contactName: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const updateSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
    taxId: z.string().optional().nullable(),
    email: z.string().email('Email inválido').optional().nullable().or(z.literal('')).optional(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    contactName: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});
