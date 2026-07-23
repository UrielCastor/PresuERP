import { z } from 'zod';

export const reportQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  userId: z.string().optional(),
  cashRegisterId: z.string().optional(),
  customerId: z.string().optional(),
  supplierId: z.string().optional(),
  productId: z.string().optional(),
  categoryId: z.string().optional(),
  warehouseId: z.string().optional(),
  exportType: z.enum(['CSV', 'XLSX', 'PDF']).optional(),
});
