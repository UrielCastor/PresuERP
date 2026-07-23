import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    sku: z.string().optional().nullable().or(z.literal('')),
    barcode: z.string().optional().nullable().or(z.literal('')),
    categoryId: z.string().uuid('ID de categoría inválido'),
    supplierId: z.string().uuid('ID de proveedor inválido').optional().nullable().or(z.literal('')),
    status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).default('ACTIVE'),
    purchasePrice: z.number().min(0, 'El precio de compra no puede ser menor a 0'),
    salePrice: z.number().min(0, 'El precio de venta no puede ser menor a 0').optional().nullable(),
    profitMargin: z.number().min(0, 'El margen no puede ser menor a 0').optional().nullable(),
    description: z.string().optional().nullable(),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
    sku: z.string().optional().nullable().or(z.literal('')),
    barcode: z.string().optional().nullable().or(z.literal('')),
    categoryId: z.string().uuid('ID de categoría inválido').optional(),
    supplierId: z.string().uuid('ID de proveedor inválido').optional().nullable().or(z.literal('')),
    status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).optional(),
    purchasePrice: z.number().min(0, 'El precio de compra no puede ser menor a 0').optional().nullable(),
    salePrice: z.number().min(0, 'El precio de venta no puede ser menor a 0').optional().nullable(),
    profitMargin: z.number().min(0, 'El margen no puede ser menor a 0').optional().nullable(),
    description: z.string().optional().nullable(),
    changeReason: z.string({ required_error: 'El motivo del cambio es obligatorio' }).min(4, 'El motivo debe tener al menos 4 caracteres'),
  }),
});
