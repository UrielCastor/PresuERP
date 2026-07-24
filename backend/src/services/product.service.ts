import { ProductRepository } from '../repositories/product.repository';
import { ActivityLogRepository } from '../repositories/activityLog.repository';
import { ConflictError, NotFoundError } from '../utils/appError';
import { prisma } from '../config/db';

export class ProductService {
  private productRepo = new ProductRepository();
  private activityLogRepo = new ActivityLogRepository();

  private parseProductPrices(product: any) {
    if (!product) return null;
    let purchasePrice = Number(product.purchasePrice) || 0;
    let salePrice = Number(product.salePrice) || 0;
    let profitMargin = product.profitMargin !== undefined && product.profitMargin !== null ? Number(product.profitMargin) : 30;
    let descriptionText = product.description || '';

    // Calculate total stock from all warehouses
    let totalStock = 0;
    if (product.stocks && Array.isArray(product.stocks)) {
      totalStock = product.stocks.reduce((sum: number, s: any) => sum + Number(s.quantity), 0);
    }

    return {
      ...product,
      purchasePrice,
      salePrice,
      profitMargin,
      description: descriptionText,
      totalStock,
    };
  }

  async list(businessId: string, supplierId?: string) {
    const products = await this.productRepo.list(businessId, supplierId);
    return products.map((p) => this.parseProductPrices(p));
  }

  async findById(id: string, businessId: string) {
    const product = await this.productRepo.findById(id, businessId);
    if (!product) {
      throw new NotFoundError('Producto no encontrado');
    }
    return this.parseProductPrices(product);
  }

  async create(data: any, operator: { id: string; businessId: string }, ip?: string, userAgent?: string) {
    const dbSku = (data.sku && data.sku.trim() !== '') ? data.sku.trim() : null;
    if (dbSku) {
      const exists = await this.productRepo.findBySku(dbSku, operator.businessId);
      if (exists) {
        throw new ConflictError('Ya existe un producto con este SKU en la empresa');
      }
    }

    // Barcode unique validation per tenant
    const dbBarcode = (data.barcode && data.barcode.trim() !== '') ? data.barcode.trim() : null;
    if (dbBarcode) {
      const exists = await prisma.product.findFirst({
        where: { barcode: dbBarcode, businessId: operator.businessId },
      });
      if (exists) {
        throw new ConflictError('El código de barras ya pertenece a otro producto.');
      }
    }

    const categoryExists = await prisma.category.findFirst({
      where: { id: data.categoryId, businessId: operator.businessId },
    });
    if (!categoryExists) {
      throw new NotFoundError('La categoría seleccionada no existe en la empresa');
    }

    // Validate supplier if provided
    if (data.supplierId && data.supplierId.trim() !== '') {
      const supplierExists = await prisma.supplier.findFirst({
        where: { id: data.supplierId, businessId: operator.businessId },
      });
      if (!supplierExists) {
        throw new NotFoundError('El proveedor seleccionado no existe en la empresa');
      }
    }

    const purchase = Number(data.purchasePrice) || 0;
    const margin = data.profitMargin !== undefined && data.profitMargin !== null ? Number(data.profitMargin) : 30;
    const sale = data.salePrice !== undefined && data.salePrice !== null ? Number(data.salePrice) : purchase * (1 + margin / 100);

    const product = await this.productRepo.create({
      name: data.name,
      sku: dbSku,
      barcode: dbBarcode,
      categoryId: data.categoryId,
      supplierId: (data.supplierId && data.supplierId.trim() !== '') ? data.supplierId : null,
      status: data.status || 'ACTIVE',
      description: data.description || '',
      purchasePrice: purchase,
      salePrice: sale,
      profitMargin: margin,
      businessId: operator.businessId,
    });

    const parsed = this.parseProductPrices(product);

    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'Product',
      entityId: product.id,
      actionType: 'CREATE',
      previousValues: null,
      newValues: JSON.stringify(parsed),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return parsed;
  }

  async update(id: string, data: any, operator: { id: string; businessId: string }, ip?: string, userAgent?: string) {
    if (!data.changeReason) {
      throw new ConflictError('El motivo del cambio es obligatorio');
    }

    const existing = await this.productRepo.findById(id, operator.businessId);
    if (!existing) {
      throw new NotFoundError('Producto no encontrado');
    }

    const dbSku = (data.sku && data.sku.trim() !== '') ? data.sku.trim() : null;
    if (dbSku && dbSku !== existing.sku) {
      const exists = await this.productRepo.findBySku(dbSku, operator.businessId);
      if (exists && exists.id !== id) {
        throw new ConflictError('Ya existe otro producto con este SKU en la empresa');
      }
    }

    // Barcode unique validation per tenant on UPDATE
    const dbBarcode = (data.barcode && data.barcode.trim() !== '') ? data.barcode.trim() : null;
    if (dbBarcode && dbBarcode !== existing.barcode) {
      const exists = await prisma.product.findFirst({
        where: { barcode: dbBarcode, businessId: operator.businessId },
      });
      if (exists && exists.id !== id) {
        throw new ConflictError('El código de barras ya pertenece a otro producto.');
      }
    }

    if (data.categoryId) {
      const categoryExists = await prisma.category.findFirst({
        where: { id: data.categoryId, businessId: operator.businessId },
      });
      if (!categoryExists) {
        throw new NotFoundError('La categoría seleccionada no existe en la empresa');
      }
    }

    // Validate supplier if provided
    if (data.supplierId && data.supplierId.trim && data.supplierId.trim() !== '') {
      const supplierExists = await prisma.supplier.findFirst({
        where: { id: data.supplierId, businessId: operator.businessId },
      });
      if (!supplierExists) {
        throw new NotFoundError('El proveedor seleccionado no existe en la empresa');
      }
    }

    const oldPurchasePrice = Number(existing.purchasePrice) || 0;
    const oldSalePrice = Number(existing.salePrice) || 0;
    const oldProfitMargin = Number(existing.profitMargin) !== undefined ? Number(existing.profitMargin) : 30;

    const purchase = data.purchasePrice !== undefined ? Number(data.purchasePrice) : oldPurchasePrice;
    let margin = data.profitMargin !== undefined ? Number(data.profitMargin) : oldProfitMargin;
    let sale = data.salePrice !== undefined ? Number(data.salePrice) : oldSalePrice;

    // Calculation logic
    if (data.profitMargin !== undefined && data.salePrice === undefined) {
      sale = purchase * (1 + margin / 100);
    } else if (data.purchasePrice !== undefined && data.profitMargin === undefined && data.salePrice === undefined) {
      sale = purchase * (1 + margin / 100);
    } else if (data.salePrice !== undefined) {
      margin = purchase > 0 ? ((sale - purchase) / purchase) * 100 : margin;
    }

    const updatedSupplierId = data.supplierId !== undefined
      ? (data.supplierId && data.supplierId.trim && data.supplierId.trim() !== '' ? data.supplierId : null)
      : existing.supplierId;

    const updated = await this.productRepo.update(id, operator.businessId, {
      name: data.name,
      sku: dbSku,
      barcode: data.barcode !== undefined ? dbBarcode : existing.barcode,
      categoryId: data.categoryId,
      supplierId: updatedSupplierId,
      status: data.status,
      description: data.description !== undefined ? data.description : existing.description,
      purchasePrice: purchase,
      salePrice: sale,
      profitMargin: margin,
    });

    const parsedUpdated = this.parseProductPrices(updated);
    const parsedExisting = this.parseProductPrices(existing);

    // Determine specific change types for audit tracking
    const isPriceChange = sale !== oldSalePrice;
    const isCostChange = purchase !== oldPurchasePrice;

    let actionType = 'PRODUCT_UPDATED';
    if (isPriceChange) actionType = 'PRODUCT_PRICE_CHANGED';
    else if (isCostChange) actionType = 'PRODUCT_COST_CHANGED';

    const prevSnapshot = {
      name: existing.name,
      price: oldSalePrice,
      cost: oldPurchasePrice,
      categoryId: existing.categoryId,
      supplierId: existing.supplierId,
      ...parsedExisting,
    };

    const newSnapshot = {
      name: updated.name,
      price: sale,
      cost: purchase,
      categoryId: updated.categoryId,
      supplierId: updated.supplierId,
      reason: data.changeReason,
      changeReason: data.changeReason,
      ...parsedUpdated,
    };

    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'Product',
      entityId: id,
      actionType,
      previousValues: JSON.stringify(prevSnapshot),
      newValues: JSON.stringify(newSnapshot),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return parsedUpdated;
  }

  async delete(id: string, operator: { id: string; businessId: string }, ip?: string, userAgent?: string) {
    const existing = await this.productRepo.findById(id, operator.businessId);
    if (!existing) {
      throw new NotFoundError('Producto no encontrado');
    }

    const [stocks, movements, purchaseItems, saleItems, inventoryItems] = await Promise.all([
      prisma.stock.count({ where: { productId: id } }),
      prisma.stockMovement.count({ where: { productId: id } }),
      prisma.purchaseItem.count({ where: { productId: id } }),
      prisma.saleItem.count({ where: { productId: id } }),
      prisma.inventoryItem.count({ where: { productId: id } }),
    ]);

    if (stocks > 0 || movements > 0 || purchaseItems > 0 || saleItems > 0 || inventoryItems > 0) {
      const updated = await this.productRepo.update(id, operator.businessId, { status: 'INACTIVE' });

      await this.activityLogRepo.log({
        userId: operator.id,
        businessId: operator.businessId,
        entityName: 'Product',
        entityId: id,
        actionType: 'DELETE_LOGICAL',
        previousValues: JSON.stringify(this.parseProductPrices(existing)),
        newValues: JSON.stringify(this.parseProductPrices(updated)),
        ipAddress: ip || null,
        userAgent: userAgent || null,
      });

      throw new ConflictError('El producto posee movimientos históricos. Debe desactivarlo.');
    }

    const parsedExisting = this.parseProductPrices(existing);

    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'Product',
      entityId: id,
      actionType: 'DELETE',
      previousValues: JSON.stringify(parsedExisting),
      newValues: null,
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    await this.productRepo.delete(id, operator.businessId);
    return { id };
  }
}
