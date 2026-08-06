import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/appError';

export class LogisticsService {
  /**
   * Search products specifically for logistics requests.
   * Exposes only minimal product identifying data (no costs, no prices).
   */
  async searchProductsForLogistics(businessId: string, query: string) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = query.trim();

    return prisma.product.findMany({
      where: {
        businessId,
        status: 'ACTIVE',
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { sku: { contains: searchTerm, mode: 'insensitive' } },
          { barcode: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        unitOfMeasure: true,
      },
      take: 20,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Returns product availability across all active warehouses of the company.
   * Available = Physical Stock - Active Stock Reservations.
   * Does NOT return full inventory, costs, kardex, or sales history.
   */
  async getProductAvailabilityAcrossWarehouses(businessId: string, productId: string) {
    if (!productId) {
      throw new BadRequestError('El ID del producto es requerido');
    }

    // 1. Verify product exists in business
    const product = await prisma.product.findFirst({
      where: { id: productId, businessId },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        unitOfMeasure: true,
      },
    });

    if (!product) {
      throw new NotFoundError('Producto no encontrado');
    }

    // 2. Fetch all active warehouses in the business
    const warehouses = await prisma.warehouse.findMany({
      where: { businessId, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        code: true,
        isMain: true,
      },
      orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
    });

    // 3. Fetch physical stock for this product across warehouses
    const stocks = await prisma.stock.findMany({
      where: { businessId, productId },
      select: {
        warehouseId: true,
        quantity: true,
      },
    });

    const physicalMap = new Map<string, number>();
    stocks.forEach((s) => {
      physicalMap.set(s.warehouseId, Number(s.quantity));
    });

    // 4. Fetch active stock reservations for this product across warehouses
    const activeReservations = await prisma.stockReservation.groupBy({
      by: ['warehouseId'],
      where: {
        businessId,
        productId,
        status: 'ACTIVE',
      },
      _sum: {
        quantity: true,
      },
    });

    const reservedMap = new Map<string, number>();
    activeReservations.forEach((r) => {
      reservedMap.set(r.warehouseId, Number(r._sum.quantity || 0));
    });

    // 5. Calculate available stock per warehouse (Physical - Reserved)
    const warehouseAvailability = warehouses.map((w) => {
      const physicalStock = physicalMap.get(w.id) || 0;
      const reservedStock = reservedMap.get(w.id) || 0;
      const availableStock = Math.max(0, physicalStock - reservedStock);

      return {
        warehouseId: w.id,
        warehouseName: w.name,
        warehouseCode: w.code,
        isMain: w.isMain,
        availableStock,
        status: availableStock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK',
        statusLabel: availableStock > 0 ? 'Disponible' : 'Sin stock',
      };
    });

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      barcode: product.barcode,
      unitOfMeasure: product.unitOfMeasure,
      warehouses: warehouseAvailability,
    };
  }
}
