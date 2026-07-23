import { prisma } from '../config/db';

export class WarehouseRepository {
  async list(businessId: string) {
    return prisma.warehouse.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, businessId: string) {
    return prisma.warehouse.findFirst({
      where: { id, businessId },
    });
  }

  async findByName(name: string, businessId: string) {
    return prisma.warehouse.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        businessId,
      },
    });
  }

  async findByCode(code: string, businessId: string) {
    return prisma.warehouse.findFirst({
      where: {
        code: { equals: code, mode: 'insensitive' },
        businessId,
      },
    });
  }

  async create(data: {
    name: string;
    code?: string | null;
    description?: string | null;
    address?: string | null;
    managerName?: string | null;
    phone?: string | null;
    email?: string | null;
    isMain?: boolean;
    status?: string;
    businessId: string;
  }) {
    return prisma.warehouse.create({
      data: data as any,
    });
  }

  async update(
    id: string,
    businessId: string,
    data: {
      name?: string;
      code?: string | null;
      description?: string | null;
      address?: string | null;
      managerName?: string | null;
      phone?: string | null;
      email?: string | null;
      isMain?: boolean;
      status?: string;
    }
  ) {
    return prisma.warehouse.update({
      where: { id },
      data: data as any,
    });
  }

  async delete(id: string) {
    return prisma.warehouse.delete({
      where: { id },
    });
  }

  async resetMain(businessId: string, exceptId?: string) {
    return prisma.warehouse.updateMany({
      where: {
        businessId,
        isMain: true,
        NOT: exceptId ? { id: exceptId } : undefined,
      } as any,
      data: {
        isMain: false,
      } as any,
    });
  }

  async hasRelations(id: string) {
    // Check if the warehouse has stocks
    const stock = await prisma.stock.findFirst({
      where: { warehouseId: id },
    });
    if (stock) return true;

    // Check stock movements
    const movement = await prisma.stockMovement.findFirst({
      where: { warehouseId: id },
    });
    if (movement) return true;

    // Check transfers
    const transfer = await prisma.warehouseTransfer.findFirst({
      where: {
        OR: [
          { sourceWarehouseId: id },
          { targetWarehouseId: id },
        ],
      },
    });
    if (transfer) return true;

    // Check inventories
    const inventory = await prisma.inventory.findFirst({
      where: { warehouseId: id },
    });
    if (inventory) return true;

    // Check purchases
    const purchase = await prisma.purchase.findFirst({
      where: { warehouseId: id },
    });
    if (purchase) return true;

    // Check cash registers
    const cashRegister = await prisma.cashRegister.findFirst({
      where: { warehouseId: id },
    });
    if (cashRegister) return true;

    return false;
  }
}
