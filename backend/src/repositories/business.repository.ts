import { prisma } from '../config/db';

export class BusinessRepository {
  async findAll(showDeleted: boolean = false) {
    return prisma.business.findMany({
      where: showDeleted ? {
        deletedAt: { not: null }
      } : {
        deletedAt: null
      },
      include: {
        _count: {
          select: { users: true, sales: true, purchases: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string) {
    return prisma.business.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, cashRegisters: true }
        },
        settings: true
      }
    });
  }

  async findByTaxId(taxId: string) {
    return prisma.business.findUnique({
      where: { taxId }
    });
  }

  async create(data: any) {
    return prisma.business.create({
      data
    });
  }

  async update(id: string, data: any) {
    return prisma.business.update({
      where: { id },
      data
    });
  }

  async delete(id: string) {
    return prisma.business.update({
      where: { id },
      data: { isActive: false }
    });
  }

  async getBusinessUsageMetrics(businessId: string) {
    const users = await prisma.user.count({ where: { businessId } });
    const products = await prisma.product.count({ where: { businessId } });
    const customers = await prisma.customer.count({ where: { businessId } });
    const suppliers = await prisma.supplier.count({ where: { businessId } });
    const warehouses = await prisma.warehouse.count({ where: { businessId } });
    const cashRegisters = await prisma.cashRegister.count({ where: { businessId } });
    
    const sales = await prisma.sale.aggregate({
      where: { businessId, status: { in: ['COMPLETED', 'PAID'] } }, // standard paid/completed sales
      _count: { id: true },
      _sum: { totalAmount: true }
    });

    const purchases = await prisma.purchase.aggregate({
      where: { businessId, status: { in: ['COMPLETED', 'PAID', 'RECEIVED'] } },
      _count: { id: true },
      _sum: { total: true } // verify schema property, previous sprint used `total` for purchases
    });

    return {
      users,
      products,
      customers,
      suppliers,
      warehouses,
      cashRegisters,
      salesCount: sales._count.id || 0,
      salesTotal: sales._sum.totalAmount || 0,
      purchasesCount: purchases._count.id || 0,
      purchasesTotal: purchases._sum.total || 0,
    };
  }
}
