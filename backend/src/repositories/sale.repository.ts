import { prisma } from '../config/db';
import { Prisma } from '@prisma/client';

export interface SaleFilters {
  customerId?: string;
  cashSessionId?: string;
  documentTypeId?: string;
  warehouseId?: string;
  status?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export class SaleRepository {
  async findAll(businessId: string, filters: SaleFilters) {
    const {
      customerId,
      cashSessionId,
      documentTypeId,
      warehouseId,
      status,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = filters;

    const skip = (page - 1) * limit;

    let saleIdsForWarehouse: string[] | undefined = undefined;

    if (warehouseId) {
      const movements = await prisma.stockMovement.findMany({
        where: { businessId, warehouseId, referenceType: 'SALE' },
        select: { referenceId: true },
      });
      saleIdsForWarehouse = Array.from(
        new Set(movements.map((m) => m.referenceId).filter((id): id is string => Boolean(id)))
      );
    }

    const where: Prisma.SaleWhereInput = {
      businessId,
      ...(customerId && { customerId }),
      ...(cashSessionId && { cashSessionId }),
      ...(documentTypeId && { documentTypeId }),
      ...(status && { status }),
      ...(warehouseId && {
        id: { in: saleIdsForWarehouse && saleIdsForWarehouse.length > 0 ? saleIdsForWarehouse : ['__NO_MATCH__'] },
      }),
      ...((startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      }),
      ...(search && {
        OR: [
          { documentNumber: { equals: isNaN(Number(search)) ? undefined : Number(search) } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [total, items] = await prisma.$transaction([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, taxId: true } },
          documentType: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    console.log('[FILTER SALES]', {
      startDate: startDate ? startDate.toISOString() : undefined,
      endDate: endDate ? endDate.toISOString() : undefined,
      customerId,
      warehouseId,
      resultCount: total,
    });

    return { total, page, limit, totalPages: Math.ceil(total / limit), items };
  }

  async findOne(id: string, businessId: string, tx?: any) {
    const client = tx || prisma;
    return client.sale.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        documentType: true,
        createdBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, barcode: true } },
          },
        },
        payments: {
          include: {
            paymentMethod: true,
          },
        },
      },
    });
  }

  async create(data: Prisma.SaleUncheckedCreateInput, tx?: any) {
    const client = tx || prisma;
    return client.sale.create({
      data,
      include: {
        items: true,
        payments: true,
      },
    });
  }

  async update(id: string, businessId: string, data: Prisma.SaleUncheckedUpdateInput, tx?: any) {
    const client = tx || prisma;
    return client.sale.update({
      where: { id, businessId },
      data,
    });
  }
}
