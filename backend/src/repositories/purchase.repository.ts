import { prisma } from '../config/db';

export interface PurchaseFilters {
  supplierId?: string;
  warehouseId?: string;
  status?: string;
  paymentStatus?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  limit?: number;
  orderByCreatedAtDesc?: boolean;
}

export class PurchaseRepository {
  async findAll(businessId: string, filters: PurchaseFilters = {}) {
    const where: any = { businessId };

    if (filters.supplierId && filters.supplierId !== 'ALL') {
      where.supplierId = filters.supplierId;
    }
    if (filters.warehouseId && filters.warehouseId !== 'ALL') {
      where.warehouseId = filters.warehouseId;
    }
    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }
    if (filters.paymentStatus && filters.paymentStatus !== 'ALL') {
      where.paymentStatus = filters.paymentStatus;
    }

    if (filters.startDate || filters.endDate) {
      where.purchaseDate = {};
      if (filters.startDate) {
        where.purchaseDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.purchaseDate.lte = filters.endDate;
      }
    }

    if (filters.search) {
      where.OR = [
        { purchaseNumber: { contains: filters.search, mode: 'insensitive' } },
        { documentNumber: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
        { supplier: { name: { contains: filters.search, mode: 'insensitive' } } },
        { user: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const orderBy = filters.orderByCreatedAtDesc 
      ? { createdAt: 'desc' } as const
      : { purchaseDate: 'desc' } as const;

    const [items, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, taxId: true } },
          warehouse: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.purchase.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, businessId: string) {
    return prisma.purchase.findFirst({
      where: { id, businessId },
      include: {
        supplier: true,
        warehouse: true,
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                purchasePrice: true,
                salePrice: true,
              },
            },
          },
        },
      },
    });
  }

  async getLatestNumber(businessId: string, tx?: any): Promise<string | null> {
    const client = tx || prisma;
    const lastPurchase = await client.purchase.findFirst({
      where: { businessId },
      orderBy: { purchaseNumber: 'desc' },
      select: { purchaseNumber: true },
    });
    return lastPurchase ? lastPurchase.purchaseNumber : null;
  }

  async create(
    data: {
      businessId: string;
      supplierId: string;
      warehouseId: string;
      userId: string;
      purchaseNumber: string;
      documentType?: string;
      documentNumber?: string | null;
      status?: string;
      paymentStatus?: string;
      purchaseDate?: Date;
      expectedDate?: Date | null;
      subtotal: number;
      discount?: number;
      tax?: number;
      total: number;
      notes?: string | null;
      // Manual tax control fields
      hasInvoiceTaxes?: boolean;
      vatRate?: number;
      vatAmount?: number;
      otherTaxes?: string | null;
      invoicedTotal?: number | null;
      items: {
        productId: string;
        quantity: number;
        unitCost: number;
        discount?: number;
        tax?: number;
        subtotal: number;
        total: number;
      }[];
    },
    tx?: any
  ) {
    const client = tx || prisma;
    const { items, ...purchaseData } = data;

    return client.purchase.create({
      data: {
        ...purchaseData,
        items: {
          create: items,
        },
      },
      include: {
        items: true,
      },
    });
  }

  async update(
    id: string,
    businessId: string,
    data: {
      supplierId?: string;
      warehouseId?: string;
      documentType?: string;
      documentNumber?: string | null;
      status?: string;
      paymentStatus?: string;
      purchaseDate?: Date;
      expectedDate?: Date | null;
      subtotal?: number;
      discount?: number;
      tax?: number;
      total?: number;
      notes?: string | null;
      // Manual tax control fields
      hasInvoiceTaxes?: boolean;
      vatRate?: number;
      vatAmount?: number;
      otherTaxes?: string | null;
      invoicedTotal?: number | null;
      items?: {
        productId: string;
        quantity: number;
        unitCost: number;
        discount?: number;
        tax?: number;
        subtotal: number;
        total: number;
      }[];
    },
    tx?: any
  ) {
    const client = tx || prisma;

    if (data.items) {
      await client.purchaseItem.deleteMany({
        where: { purchaseId: id },
      });

      const { items, ...purchaseData } = data;
      return client.purchase.update({
        where: { id },
        data: {
          ...purchaseData,
          items: {
            create: items,
          },
        },
        include: {
          items: true,
        },
      });
    } else {
      return client.purchase.update({
        where: { id },
        data: data as any,
        include: {
          items: true,
        },
      });
    }
  }

  async checkDocumentDuplicate(
    businessId: string,
    supplierId: string,
    documentNumber: string,
    excludePurchaseId?: string
  ): Promise<boolean> {
    const where: any = {
      businessId,
      supplierId,
      documentNumber: { equals: documentNumber, mode: 'insensitive' },
    };

    if (excludePurchaseId) {
      where.id = { not: excludePurchaseId };
    }

    const count = await prisma.purchase.count({ where });
    return count > 0;
  }
}
