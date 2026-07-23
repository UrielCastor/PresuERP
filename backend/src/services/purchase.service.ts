import { PurchaseRepository, PurchaseFilters } from '../repositories/purchase.repository';
import { ActivityLogRepository } from '../repositories/activityLog.repository';
import { StockMovementService } from './stockMovement.service';
import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/appError';

export class PurchaseService {
  private purchaseRepo = new PurchaseRepository();
  private activityLogRepo = new ActivityLogRepository();
  private stockMovementService = new StockMovementService();

  // Generate automatic purchase number: COMP-XXXXXXXX
  private async generateNextNumber(businessId: string, txClient: any): Promise<string> {
    const latest = await this.purchaseRepo.getLatestNumber(businessId, txClient);
    if (!latest) {
      return 'COMP-00000001';
    }

    const match = latest.match(/COMP-(\d+)/);
    if (!match) {
      return 'COMP-00000001';
    }

    const nextSeq = parseInt(match[1], 10) + 1;
    const padded = String(nextSeq).padStart(8, '0');
    return `COMP-${padded}`;
  }

  async list(businessId: string, filters: PurchaseFilters) {
    return this.purchaseRepo.findAll(businessId, filters);
  }

  async findOne(id: string, businessId: string) {
    const purchase = await this.purchaseRepo.findById(id, businessId);
    if (!purchase) {
      throw new NotFoundError('Compra no encontrada');
    }
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        entityName: 'Purchase',
        entityId: id,
        businessId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    return {
      ...purchase,
      activityLogs,
    };
  }

  async create(
    businessId: string,
    userId: string,
    data: {
      supplierId: string;
      warehouseId: string;
      documentType?: string;
      documentNumber?: string | null;
      expectedDate?: string | null;
      notes?: string | null;
      hasInvoiceTaxes?: boolean;
      vatRate?: number;
      vatAmount?: number;
      otherTaxes?: { name: string; amount: number; type?: string; value?: number; percentage?: number; description?: string }[];
      discount?: number;
      invoicedTotal?: number | null;
      forceDifference?: boolean;
      items: {
        productId: string;
        quantity: number;
        unitCost: number;
        discount?: number;
      }[];
    }
  ) {
    return await prisma.$transaction(async (tx) => {
      // 1. Validations — Supplier
      const supplier = await tx.supplier.findFirst({
        where: { id: data.supplierId, businessId },
      });
      if (!supplier) {
        throw new NotFoundError('El proveedor especificado no existe o no pertenece a la empresa.');
      }

      // 2. Validate Warehouse
      const warehouse = await tx.warehouse.findFirst({
        where: { id: data.warehouseId, businessId },
      });
      if (!warehouse) {
        throw new NotFoundError('El depósito especificado no existe.');
      }
      if (warehouse.status !== 'ACTIVE') {
        throw new BadRequestError('El depósito seleccionado no está activo.');
      }

      if (!data.items || data.items.length === 0) {
        throw new BadRequestError('No se puede crear una compra sin artículos.');
      }

      // 3. Check duplicates for documentNumber
      if (data.documentNumber) {
        const isDuplicateDoc = await this.purchaseRepo.checkDocumentDuplicate(
          businessId,
          data.supplierId,
          data.documentNumber
        );
        if (isDuplicateDoc) {
          throw new BadRequestError(`El número de documento '${data.documentNumber}' ya fue registrado para este proveedor.`);
        }
      }

      // 4. Validate items and compute subtotal
      const processedItems = [];
      let calculatedSubtotal = 0;
      const seenProductIds = new Set<string>();

      for (const item of data.items) {
        if (item.quantity <= 0) {
          throw new BadRequestError('La cantidad de cada producto debe ser mayor a cero.');
        }
        if (item.unitCost < 0) {
          throw new BadRequestError('El costo unitario no puede ser negativo.');
        }

        if (seenProductIds.has(item.productId)) {
          throw new BadRequestError('No se permiten productos duplicados en el listado de ítems de compra.');
        }
        seenProductIds.add(item.productId);

        const product = await tx.product.findFirst({
          where: { id: item.productId, businessId },
        });
        if (!product) {
          throw new NotFoundError(`El producto con ID '${item.productId}' no existe en el catálogo.`);
        }

        // Validate supplier assignment
        if (!product.supplierId) {
          throw new BadRequestError(`El producto '${product.name}' no tiene asignado un proveedor. Debe asociarle un proveedor antes de utilizarlo en compras.`);
        }
        if (product.supplierId !== data.supplierId) {
          throw new BadRequestError(`El producto '${product.name}' no pertenece al proveedor seleccionado.`);
        }

        const rawSubtotal = item.quantity * item.unitCost;
        const disc = item.discount || 0;
        const lineSubtotal = rawSubtotal - disc;

        calculatedSubtotal += lineSubtotal;

        processedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          discount: disc,
          tax: 0,           // No automatic tax per item
          subtotal: lineSubtotal,
          total: lineSubtotal,
        });
      }

      // 5. Compute grand total using manual tax fields and general discount
      const discount = Number(data.discount) || 0;
      const hasInvoiceTaxes = data.hasInvoiceTaxes ?? false;
      const vatAmount = hasInvoiceTaxes ? (data.vatAmount ?? 0) : 0;
      const otherTaxesList = hasInvoiceTaxes ? (data.otherTaxes ?? []) : [];
      const otherTaxesTotal = otherTaxesList.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      const calculatedTotal = calculatedSubtotal + vatAmount + otherTaxesTotal - discount;

      const invoicedTotalVal = data.invoicedTotal !== undefined && data.invoicedTotal !== null ? Number(data.invoicedTotal) : null;
      let finalTotal = calculatedTotal;
      let isForcedVal = false;

      if (invoicedTotalVal !== null) {
        const diff = Math.abs(invoicedTotalVal - calculatedTotal);
        if (diff > 0.05) {
          if (!data.forceDifference) {
            throw new BadRequestError(`El total ingresado (${invoicedTotalVal}) no coincide con el cálculo automático (${calculatedTotal}).`);
          }
          finalTotal = invoicedTotalVal;
          isForcedVal = true;
        }
      }

      // 6. Auto-generate Purchase Number
      const purchaseNo = await this.generateNextNumber(businessId, tx);

      // 7. Create Purchase in DRAFT
      const purchase = await this.purchaseRepo.create(
        {
          businessId,
          supplierId: data.supplierId,
          warehouseId: data.warehouseId,
          userId,
          purchaseNumber: purchaseNo,
          documentType: data.documentType || 'FACTURA',
          documentNumber: data.documentNumber,
          status: 'DRAFT',
          paymentStatus: 'PENDING',
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
          subtotal: calculatedSubtotal,
          discount: discount,
          tax: vatAmount + otherTaxesTotal,  // store total tax value for legacy compatibility
          total: finalTotal,
          notes: data.notes,
          hasInvoiceTaxes,
          vatRate: data.vatRate ?? 21,
          vatAmount,
          otherTaxes: otherTaxesList.length > 0 ? JSON.stringify(otherTaxesList) : null,
          invoicedTotal: invoicedTotalVal,
          items: processedItems,
        },
        tx
      );

      // 8. Register Activity Log
      await tx.activityLog.create({
        data: {
          userId,
          businessId,
          entityName: 'Purchase',
          entityId: purchase.id,
          actionType: isForcedVal ? 'CREATE_PURCHASE_FORCE_DIFFERENCE' : 'CREATE_PURCHASE',
          previousValues: '{}',
          newValues: JSON.stringify({
            purchaseId: purchase.id,
            purchaseNumber: purchase.purchaseNumber,
            supplierId: purchase.supplierId,
            warehouseId: purchase.warehouseId,
            subtotal: calculatedSubtotal,
            vatAmount,
            otherTaxesTotal,
            discount,
            totalCalculated: calculatedTotal,
            totalSaved: finalTotal,
            isDifferenceForced: isForcedVal,
            hasInvoiceTaxes,
            status: purchase.status,
            itemCount: processedItems.length,
          }),
        },
      });

      return purchase;
    });
  }

  async update(
    id: string,
    businessId: string,
    userId: string,
    data: {
      supplierId?: string;
      warehouseId?: string;
      documentType?: string;
      documentNumber?: string | null;
      expectedDate?: string | null;
      notes?: string | null;
      hasInvoiceTaxes?: boolean;
      vatRate?: number;
      vatAmount?: number;
      otherTaxes?: { name: string; amount: number; type?: string; value?: number; percentage?: number; description?: string }[];
      discount?: number;
      invoicedTotal?: number | null;
      forceDifference?: boolean;
      items?: {
        productId: string;
        quantity: number;
        unitCost: number;
        discount?: number;
      }[];
    }
  ) {
    return await prisma.$transaction(async (tx) => {
      const purchase = await this.purchaseRepo.findById(id, businessId);
      if (!purchase) {
        throw new NotFoundError('Compra no encontrada');
      }

      if (purchase.status !== 'DRAFT') {
        throw new BadRequestError('Solo se pueden editar compras en estado BORRADOR (DRAFT).');
      }

      const updateData: any = {};

      if (data.supplierId) {
        const supplier = await tx.supplier.findFirst({
          where: { id: data.supplierId, businessId },
        });
        if (!supplier) {
          throw new NotFoundError('El proveedor especificado no existe.');
        }
        updateData.supplierId = data.supplierId;
      }

      if (data.warehouseId) {
        const warehouse = await tx.warehouse.findFirst({
          where: { id: data.warehouseId, businessId },
        });
        if (!warehouse) {
          throw new NotFoundError('El depósito especificado no existe.');
        }
        if (warehouse.status !== 'ACTIVE') {
          throw new BadRequestError('El depósito seleccionado no está activo.');
        }
        updateData.warehouseId = data.warehouseId;
      }

      if (data.documentType) {
        updateData.documentType = data.documentType;
      }

      if (data.documentNumber !== undefined) {
        const checkNum = data.documentNumber;
        const checkSupplier = data.supplierId || purchase.supplierId;
        if (checkNum) {
          const isDuplicateDoc = await this.purchaseRepo.checkDocumentDuplicate(
            businessId,
            checkSupplier,
            checkNum,
            id
          );
          if (isDuplicateDoc) {
            throw new BadRequestError(`El número de documento '${checkNum}' ya fue registrado para este proveedor.`);
          }
        }
        updateData.documentNumber = checkNum;
      }

      if (data.expectedDate !== undefined) {
        updateData.expectedDate = data.expectedDate ? new Date(data.expectedDate) : null;
      }

      if (data.notes !== undefined) {
        updateData.notes = data.notes;
      }

      // Update manual tax control fields and discount
      const hasInvoiceTaxes = data.hasInvoiceTaxes !== undefined
        ? data.hasInvoiceTaxes
        : (purchase as any).hasInvoiceTaxes;

      updateData.hasInvoiceTaxes = hasInvoiceTaxes;

      const vatRate = data.vatRate !== undefined
        ? data.vatRate
        : Number((purchase as any).vatRate) || 21;
      updateData.vatRate = vatRate;

      const vatAmount = hasInvoiceTaxes
        ? (data.vatAmount !== undefined ? data.vatAmount : Number((purchase as any).vatAmount) || 0)
        : 0;
      updateData.vatAmount = vatAmount;

      const otherTaxesList = hasInvoiceTaxes
        ? (data.otherTaxes !== undefined
            ? data.otherTaxes
            : JSON.parse((purchase as any).otherTaxes || '[]'))
        : [];
      updateData.otherTaxes = otherTaxesList.length > 0 ? JSON.stringify(otherTaxesList) : null;

      const discount = data.discount !== undefined
        ? Number(data.discount)
        : Number(purchase.discount) || 0;
      updateData.discount = discount;

      const otherTaxesTotal = otherTaxesList.reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);
      updateData.tax = vatAmount + otherTaxesTotal;

      let calculatedSubtotal = Number(purchase.subtotal);
      let processedItems: any = null;

      if (data.items) {
        if (data.items.length === 0) {
          throw new BadRequestError('No se puede actualizar una compra con cero artículos.');
        }

        processedItems = [];
        calculatedSubtotal = 0;
        const currentSupplierId = data.supplierId || purchase.supplierId;
        const seenProductIds = new Set<string>();

        for (const item of data.items) {
          if (item.quantity <= 0) {
            throw new BadRequestError('La cantidad de cada producto debe ser mayor a cero.');
          }
          if (item.unitCost < 0) {
            throw new BadRequestError('El costo unitario no puede ser negativo.');
          }

          if (seenProductIds.has(item.productId)) {
            throw new BadRequestError('No se permiten productos duplicados en el listado de ítems de compra.');
          }
          seenProductIds.add(item.productId);

          const product = await tx.product.findFirst({
            where: { id: item.productId, businessId },
          });
          if (!product) {
            throw new NotFoundError(`El producto con ID '${item.productId}' no existe en el catálogo.`);
          }

          // Validate supplier assignment
          if (!product.supplierId) {
            throw new BadRequestError(`El producto '${product.name}' no tiene asignado un proveedor. Debe asociarle un proveedor antes de utilizarlo en compras.`);
          }
          if (product.supplierId !== currentSupplierId) {
            throw new BadRequestError(`El producto '${product.name}' no pertenece al proveedor seleccionado.`);
          }

          const rawSubtotal = item.quantity * item.unitCost;
          const disc = item.discount || 0;
          const lineSubtotal = rawSubtotal - disc;

          calculatedSubtotal += lineSubtotal;

          processedItems.push({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            discount: disc,
            tax: 0,
            subtotal: lineSubtotal,
            total: lineSubtotal,
          });
        }

        updateData.subtotal = calculatedSubtotal;
        updateData.items = processedItems;
      }

      const calculatedTotal = calculatedSubtotal + vatAmount + otherTaxesTotal - discount;
      const invoicedTotalVal = data.invoicedTotal !== undefined
        ? (data.invoicedTotal !== null ? Number(data.invoicedTotal) : null)
        : (purchase.invoicedTotal !== null ? Number(purchase.invoicedTotal) : null);
      
      updateData.invoicedTotal = invoicedTotalVal;

      let finalTotal = calculatedTotal;
      let isForcedVal = false;

      if (invoicedTotalVal !== null) {
        const diff = Math.abs(invoicedTotalVal - calculatedTotal);
        if (diff > 0.05) {
          if (!data.forceDifference) {
            throw new BadRequestError(`El total ingresado (${invoicedTotalVal}) no coincide con el cálculo automático (${calculatedTotal}).`);
          }
          finalTotal = invoicedTotalVal;
          isForcedVal = true;
        }
      }
      updateData.total = finalTotal;

      const updated = await this.purchaseRepo.update(id, businessId, updateData, tx);

      // Register Activity Log
      await tx.activityLog.create({
        data: {
          userId,
          businessId,
          entityName: 'Purchase',
          entityId: updated.id,
          actionType: isForcedVal ? 'UPDATE_PURCHASE_FORCE_DIFFERENCE' : 'UPDATE_PURCHASE',
          previousValues: JSON.stringify({
            supplierId: purchase.supplierId,
            warehouseId: purchase.warehouseId,
            total: purchase.total,
            itemsCount: purchase.items.length,
          }),
          newValues: JSON.stringify({
            supplierId: updated.supplierId,
            warehouseId: updated.warehouseId,
            totalCalculated: calculatedTotal,
            totalSaved: finalTotal,
            isDifferenceForced: isForcedVal,
            subtotal: calculatedSubtotal,
            vatAmount,
            otherTaxesTotal,
            discount,
            itemsCount: updated.items.length,
          }),
        },
      });

      return updated;
    });
  }

  async submitForApproval(id: string, businessId: string, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const purchase = await this.purchaseRepo.findById(id, businessId);
      if (!purchase) throw new NotFoundError('Compra no encontrada');
      if (purchase.status !== 'DRAFT') {
        throw new BadRequestError('Solo se pueden enviar para aprobación compras que están en estado BORRADOR (DRAFT).');
      }
      const updated = await tx.purchase.update({
        where: { id },
        data: { status: 'PENDIENTE_APROBACION' },
      });
      await tx.activityLog.create({
        data: {
          userId,
          businessId,
          entityName: 'Purchase',
          entityId: purchase.id,
          actionType: 'SUBMIT_PURCHASE_FOR_APPROVAL',
          previousValues: JSON.stringify({ status: purchase.status }),
          newValues: JSON.stringify({ status: 'PENDIENTE_APROBACION' }),
        },
      });
      return updated;
    });
  }

  async reject(id: string, businessId: string, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const purchase = await this.purchaseRepo.findById(id, businessId);
      if (!purchase) throw new NotFoundError('Compra no encontrada');
      if (purchase.status !== 'PENDIENTE_APROBACION') {
        throw new BadRequestError('Solo se pueden rechazar compras en estado PENDIENTE_APROBACION.');
      }
      const updated = await tx.purchase.update({
        where: { id },
        data: { status: 'DRAFT' },
      });
      await tx.activityLog.create({
        data: {
          userId,
          businessId,
          entityName: 'Purchase',
          entityId: purchase.id,
          actionType: 'REJECT_PURCHASE',
          previousValues: JSON.stringify({ status: purchase.status }),
          newValues: JSON.stringify({ status: 'DRAFT' }),
        },
      });
      return updated;
    });
  }

  async approve(id: string, businessId: string, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const purchase = await this.purchaseRepo.findById(id, businessId);
      if (!purchase) {
        throw new NotFoundError('Compra no encontrada');
      }

      if (purchase.status !== 'PENDIENTE_APROBACION') {
        throw new BadRequestError('Solo se pueden aprobar compras que están en estado PENDIENTE_APROBACION.');
      }

      // Check if warehouse is active
      if (purchase.warehouse.status !== 'ACTIVE') {
        throw new BadRequestError('El depósito de la compra no está activo. Active el depósito antes de aprobar.');
      }

      // Approve purchase: update status
      const updated = await tx.purchase.update({
        where: { id },
        data: {
          status: 'APPROVED',
        },
      });

      // Register Activity Log: USER_APPROVED_PURCHASE
      await tx.activityLog.create({
        data: {
          userId,
          businessId,
          entityName: 'Purchase',
          entityId: purchase.id,
          actionType: 'USER_APPROVED_PURCHASE',
          previousValues: JSON.stringify({ status: purchase.status }),
          newValues: JSON.stringify({ status: 'APPROVED', approvedAt: new Date().toISOString() }),
        },
      });

      return updated;
    });
  }

  async receive(id: string, businessId: string, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const purchase = await this.purchaseRepo.findById(id, businessId);
      if (!purchase) {
        throw new NotFoundError('Compra no encontrada');
      }

      if (purchase.status !== 'APPROVED') {
        throw new BadRequestError('Solo se pueden recibir compras que están en estado APROBADO (APPROVED).');
      }

      // Check if warehouse is active
      if (purchase.warehouse.status !== 'ACTIVE') {
        throw new BadRequestError('El depósito de la compra no está activo.');
      }

      // Update purchase status
      const updated = await tx.purchase.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          paymentStatus: 'PAID',
        },
      });

      // Process each item to update stock and Kardex
      for (const item of purchase.items) {
        // 1. Register ENTRY to Kardex/Stock
        await this.stockMovementService.registerMovement(
          {
            businessId,
            warehouseId: purchase.warehouseId,
            productId: item.productId,
            userId,
            movementType: 'ENTRY',
            quantity: Number(item.quantity),
            unitCost: Number(item.unitCost),
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            referenceNumber: purchase.purchaseNumber,
            reason: 'Artículos recibidos por compra',
          },
          undefined,
          undefined,
          tx
        );

        // 2. Update product master cost
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (product) {
          const newPurchasePrice = Number(item.unitCost);
          const margin = Number(product.profitMargin) || 30;
          const calculatedSalePrice = Math.round(newPurchasePrice * (1 + margin / 100) * 100) / 100;

          await tx.product.update({
            where: { id: item.productId },
            data: {
              purchasePrice: newPurchasePrice,
              salePrice: calculatedSalePrice,
              supplierId: purchase.supplierId,
            },
          });
        }
      }

      // Register Activity Log: USER_RECEIVED_PURCHASE
      await tx.activityLog.create({
        data: {
          userId,
          businessId,
          entityName: 'Purchase',
          entityId: purchase.id,
          actionType: 'USER_RECEIVED_PURCHASE',
          previousValues: JSON.stringify({ status: purchase.status }),
          newValues: JSON.stringify({ status: 'RECEIVED', receivedAt: new Date().toISOString() }),
        },
      });

      return updated;
    });
  }

  async cancel(id: string, businessId: string, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const purchase = await this.purchaseRepo.findById(id, businessId);
      if (!purchase) {
        throw new NotFoundError('Compra no encontrada');
      }

      if (purchase.status === 'CANCELLED') {
        throw new BadRequestError('La compra ya está cancelada.');
      }

      const originalStatus = purchase.status;

      // Update purchase status
      const updated = await tx.purchase.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
      });

      // If RECEIVED, generate EXIT movements to counter-act the ENTRY
      if (originalStatus === 'RECEIVED') {
        if (purchase.warehouse.status !== 'ACTIVE') {
          throw new BadRequestError('El depósito está inactivo. Active el depósito para regularizar el stock.');
        }

        for (const item of purchase.items) {
          await this.stockMovementService.registerMovement(
            {
              businessId,
              warehouseId: purchase.warehouseId,
              productId: item.productId,
              userId,
              movementType: 'EXIT',
              quantity: Number(item.quantity),
              unitCost: Number(item.unitCost),
              referenceType: 'PURCHASE',
              referenceId: purchase.id,
              referenceNumber: purchase.purchaseNumber,
              reason: 'Reversión / Cancelación de compra recibida',
            },
            undefined,
            undefined,
            tx
          );
        }
      }

      // Register Activity Log: USER_CANCELLED_PURCHASE
      await tx.activityLog.create({
        data: {
          userId,
          businessId,
          entityName: 'Purchase',
          entityId: purchase.id,
          actionType: 'USER_CANCELLED_PURCHASE',
          previousValues: JSON.stringify({ status: originalStatus }),
          newValues: JSON.stringify({ status: 'CANCELLED' }),
        },
      });

      return updated;
    });
  }

  // Get dynamic purchase history for a single product
  async getProductPurchaseHistory(productId: string, businessId: string) {
    const purchaseItems = await prisma.purchaseItem.findMany({
      where: {
        productId,
        purchase: {
          businessId,
          status: 'RECEIVED',
        },
      },
      include: {
        purchase: {
          include: {
            supplier: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: {
        purchase: {
          purchaseDate: 'desc',
        },
      },
    });

    if (purchaseItems.length === 0) {
      return {
        lastSupplier: null,
        lastCost: 0,
        lastPurchaseDate: null,
        averageCost: 0,
        totalQuantityPurchased: 0,
      };
    }

    const latestItem = purchaseItems[0];
    const totalQty = purchaseItems.reduce((acc, item) => acc + Number(item.quantity), 0);
    const sumCost = purchaseItems.reduce((acc, item) => acc + Number(item.unitCost) * Number(item.quantity), 0);
    const avgCost = totalQty > 0 ? sumCost / totalQty : 0;

    return {
      lastSupplier: latestItem.purchase?.supplier?.name || null,
      lastCost: Number(latestItem.unitCost),
      lastPurchaseDate: latestItem.purchase?.purchaseDate || null,
      averageCost: avgCost,
      totalQuantityPurchased: totalQty,
    };
  }
}
