import { prisma } from '../config/db';
import { ActivityLogRepository } from '../repositories/activityLog.repository';
import { BadRequestError, ConflictError } from '../utils/appError';

export interface ProductImportRow {
  barcode?: string;
  sku?: string;
  name: string;
  description?: string;
  categoryName?: string;
  supplierName?: string;
  costPrice?: number;
  salePrice?: number;
  tax?: number;
  initialStock?: number;
}

export interface ImportOptionsPayload {
  fileName: string;
  rows: ProductImportRow[];
  duplicateStrategy: 'CREATE_ONLY' | 'UPDATE_EXISTING' | 'SKIP_DUPLICATES';
  updateFields?: {
    name?: boolean;
    barcode?: boolean;
    salePrice?: boolean;
    costPrice?: boolean;
    category?: boolean;
    supplier?: boolean;
  };
  importStock: boolean;
  warehouseId?: string;
}

export class ProductImportService {
  private activityLogRepo = new ActivityLogRepository();

  async processImport(businessId: string, userId: string, payload: ImportOptionsPayload) {
    console.log(`[PRODUCT_IMPORT_START] Iniciando importación para Empresa: ${businessId}, Usuario: ${userId}`);

    if (!payload) {
      console.log(`[IMPORT_FAILED] Payload vacío o no proporcionado.`);
      throw new BadRequestError('El cuerpo de la solicitud de importación no puede estar vacío.');
    }

    const { fileName, rows, duplicateStrategy, updateFields, importStock, warehouseId } = payload;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      console.log(`[IMPORT_FAILED] Sin filas válidas en el archivo.`);
      throw new BadRequestError('No se encontraron filas de productos para procesar en el archivo.');
    }

    if (importStock && (!warehouseId || warehouseId.trim() === '' || warehouseId === 'ALL')) {
      console.log(`[IMPORT_FAILED] Depósito destino no seleccionado.`);
      throw new BadRequestError('Debe seleccionar un depósito específico de destino para la importación del stock inicial.');
    }

    // Validate warehouse existence for tenant
    if (importStock && warehouseId) {
      const warehouseExists = await prisma.warehouse.findFirst({
        where: { id: warehouseId, businessId }
      });
      if (!warehouseExists) {
        console.log(`[IMPORT_FAILED] Depósito ${warehouseId} no existe o no pertenece a la empresa.`);
        throw new BadRequestError('El depósito seleccionado no pertenece a la empresa autenticada.');
      }
    }

    console.log(`[FILE_VALIDATED] Archivo: ${fileName || 'importacion.xlsx'}, Filas a procesar: ${rows.length}, Depósito: ${warehouseId || 'N/A'}`);

    // Pre-fetch categories & suppliers for quick cache per tenant
    const existingCategories = await prisma.category.findMany({ where: { businessId } });
    const categoryMap = new Map<string, string>(); // lowercase name -> id
    existingCategories.forEach((c) => categoryMap.set(c.name.trim().toLowerCase(), c.id));

    let defaultCategoryId = existingCategories[0]?.id;
    if (!defaultCategoryId) {
      const defaultCategory = await prisma.category.create({
        data: { name: 'General', businessId }
      });
      defaultCategoryId = defaultCategory.id;
      categoryMap.set('general', defaultCategory.id);
    }

    const existingSuppliers = await prisma.supplier.findMany({ where: { businessId } });
    const supplierMap = new Map<string, string>(); // lowercase name -> id
    existingSuppliers.forEach((s) => supplierMap.set(s.name.trim().toLowerCase(), s.id));

    // Pre-fetch existing products for fast duplicate matching per tenant
    const existingProducts = await prisma.product.findMany({
      where: { businessId },
      include: { stocks: true }
    });
    const barcodeMap = new Map<string, any>();
    const skuMap = new Map<string, any>();
    const nameMap = new Map<string, any>();

    existingProducts.forEach((p) => {
      if (p.barcode && p.barcode.trim() !== '') barcodeMap.set(p.barcode.trim(), p);
      if (p.sku && p.sku.trim() !== '') skuMap.set(p.sku.trim(), p);
      nameMap.set(p.name.trim().toLowerCase(), p);
    });

    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errorsList: { row: number; name: string; error: string }[] = [];

    // Helper to resolve category ID with tenant safety
    const getOrCreateCategory = async (catName?: string): Promise<string> => {
      if (!catName || !catName.trim()) return defaultCategoryId!;
      const key = catName.trim().toLowerCase();
      if (categoryMap.has(key)) return categoryMap.get(key)!;

      const newCat = await prisma.category.create({
        data: { name: catName.trim(), businessId }
      });
      categoryMap.set(key, newCat.id);
      return newCat.id;
    };

    // Helper to resolve supplier ID with tenant safety
    const getOrCreateSupplier = async (supName?: string): Promise<string | null> => {
      if (!supName || !supName.trim()) return null;
      const key = supName.trim().toLowerCase();
      if (supplierMap.has(key)) return supplierMap.get(key)!;

      const newSup = await prisma.supplier.create({
        data: { name: supName.trim(), businessId }
      });
      supplierMap.set(key, newSup.id);
      return newSup.id;
    };

    // Process all product rows inside a safe transaction block per batch
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 1;

      if (!row.name || !row.name.trim()) {
        errorCount++;
        errorsList.push({ row: rowIndex, name: 'Fila Vacía', error: 'El nombre del producto es obligatorio.' });
        continue;
      }

      const cleanName = row.name.trim();
      const cleanBarcode = row.barcode && String(row.barcode).trim() !== '' ? String(row.barcode).trim() : null;
      const cleanSku = row.sku && String(row.sku).trim() !== '' ? String(row.sku).trim() : null;

      // Priority duplicate matching: Barcode -> SKU -> Name
      let matchedProduct = null;
      if (cleanBarcode && barcodeMap.has(cleanBarcode)) {
        matchedProduct = barcodeMap.get(cleanBarcode);
      } else if (cleanSku && skuMap.has(cleanSku)) {
        matchedProduct = skuMap.get(cleanSku);
      } else if (nameMap.has(cleanName.toLowerCase())) {
        matchedProduct = nameMap.get(cleanName.toLowerCase());
      }

      try {
        await prisma.$transaction(async (tx) => {
          const catId = await getOrCreateCategory(row.categoryName);
          const supId = await getOrCreateSupplier(row.supplierName);

          const costPrice = Number(row.costPrice) || 0;
          const salePrice = Number(row.salePrice) || (costPrice > 0 ? costPrice * 1.3 : 0);
          const profitMargin = costPrice > 0 ? ((salePrice - costPrice) / costPrice) * 100 : 30;

          if (!matchedProduct) {
            // 1. CREATE NEW PRODUCT
            const createdProduct = await tx.product.create({
              data: {
                name: cleanName,
                barcode: cleanBarcode,
                sku: cleanSku,
                description: row.description || '',
                purchasePrice: costPrice,
                salePrice,
                profitMargin,
                categoryId: catId,
                supplierId: supId,
                businessId,
                status: 'ACTIVE',
              }
            });

            if (cleanBarcode) barcodeMap.set(cleanBarcode, createdProduct);
            if (cleanSku) skuMap.set(cleanSku, createdProduct);
            nameMap.set(cleanName.toLowerCase(), createdProduct);

            console.log(`[PRODUCT_CREATED] Fila ${rowIndex}: ${cleanName} (ID: ${createdProduct.id})`);

            // Initial Stock creation if selected
            if (importStock && warehouseId && row.initialStock !== undefined && Number(row.initialStock) > 0) {
              const stockQty = Number(row.initialStock);
              await tx.stock.upsert({
                where: {
                  warehouseId_productId_businessId: {
                    warehouseId,
                    productId: createdProduct.id,
                    businessId,
                  }
                },
                update: { quantity: stockQty },
                create: {
                  businessId,
                  warehouseId,
                  productId: createdProduct.id,
                  quantity: stockQty,
                }
              });

              // Create stock movement for Kardex tracking
              await tx.stockMovement.create({
                data: {
                  businessId,
                  warehouseId,
                  productId: createdProduct.id,
                  userId,
                  movementType: 'ADJUSTMENT',
                  quantity: stockQty,
                  stockBefore: 0,
                  stockAfter: stockQty,
                  unitCost: costPrice,
                  totalCost: costPrice * stockQty,
                  referenceType: 'IMPORT',
                  reason: 'Stock inicial por importación masiva de productos',
                }
              });

              console.log(`[STOCK_CREATED] Stock ${stockQty} asignado a producto ${createdProduct.name} en depósito ${warehouseId}`);
            }

            createdCount++;
          } else {
            // 2. MATCHED EXISTING PRODUCT
            if (duplicateStrategy === 'SKIP_DUPLICATES' || duplicateStrategy === 'CREATE_ONLY') {
              return;
            }

            if (duplicateStrategy === 'UPDATE_EXISTING') {
              const updateData: any = {};
              if (updateFields?.name && cleanName) updateData.name = cleanName;
              if (updateFields?.barcode && cleanBarcode) updateData.barcode = cleanBarcode;
              if (updateFields?.costPrice) updateData.purchasePrice = costPrice;
              if (updateFields?.salePrice) updateData.salePrice = salePrice;
              if (updateFields?.category) updateData.categoryId = catId;
              if (updateFields?.supplier && supId) updateData.supplierId = supId;

              if (Object.keys(updateData).length > 0) {
                const updatedProduct = await tx.product.update({
                  where: { id: matchedProduct.id },
                  data: updateData
                });

                if (cleanBarcode) barcodeMap.set(cleanBarcode, updatedProduct);
                if (cleanSku) skuMap.set(cleanSku, updatedProduct);
                nameMap.set(cleanName.toLowerCase(), updatedProduct);

                console.log(`[PRODUCT_UPDATED] Fila ${rowIndex}: ${cleanName} (ID: ${updatedProduct.id})`);
              }

              // Update stock if requested
              if (importStock && warehouseId && row.initialStock !== undefined && Number(row.initialStock) >= 0) {
                const stockQty = Number(row.initialStock);
                const currentStockObj = await tx.stock.findUnique({
                  where: {
                    warehouseId_productId_businessId: {
                      warehouseId,
                      productId: matchedProduct.id,
                      businessId,
                    }
                  }
                });
                const prevQty = currentStockObj ? Number(currentStockObj.quantity) : 0;

                await tx.stock.upsert({
                  where: {
                    warehouseId_productId_businessId: {
                      warehouseId,
                      productId: matchedProduct.id,
                      businessId,
                    }
                  },
                  update: { quantity: stockQty },
                  create: {
                    businessId,
                    warehouseId,
                    productId: matchedProduct.id,
                    quantity: stockQty,
                  }
                });

                if (prevQty !== stockQty) {
                  await tx.stockMovement.create({
                    data: {
                      businessId,
                      warehouseId,
                      productId: matchedProduct.id,
                      userId,
                      movementType: 'ADJUSTMENT',
                      quantity: stockQty - prevQty,
                      stockBefore: prevQty,
                      stockAfter: stockQty,
                      unitCost: costPrice,
                      totalCost: costPrice * (stockQty - prevQty),
                      referenceType: 'IMPORT',
                      reason: 'Actualización de stock por importación masiva',
                    }
                  });
                  console.log(`[STOCK_CREATED] Stock actualizado de ${prevQty} a ${stockQty} para ${matchedProduct.name}`);
                }
              }

              updatedCount++;
            }
          }
        });
      } catch (rowErr: any) {
        console.error(`[IMPORT_ROW_ERROR] Error en fila ${rowIndex} (${cleanName}):`, rowErr);
        errorCount++;
        errorsList.push({
          row: rowIndex,
          name: cleanName,
          error: rowErr.message || 'Error al procesar registro de producto.'
        });
      }
    }

    // Log ProductImportHistory record
    let historyId = null;
    try {
      const historyRecord = await (prisma as any).productImportHistory.create({
        data: {
          businessId,
          userId,
          fileName: fileName || 'importacion_productos.xlsx',
          totalRows: rows.length,
          createdCount,
          updatedCount,
          errorCount,
          warehouseId: importStock ? warehouseId : null,
        }
      });
      historyId = historyRecord.id;

      await this.activityLogRepo.log({
        userId,
        businessId,
        entityName: 'ProductImportHistory',
        entityId: historyRecord.id,
        actionType: 'BULK_IMPORT',
        previousValues: null,
        newValues: JSON.stringify({
          fileName,
          createdCount,
          updatedCount,
          errorCount,
          totalRows: rows.length,
        }),
        ipAddress: null,
        userAgent: null,
      });
    } catch (histErr) {
      console.error('[IMPORT_HISTORY_LOG_ERROR] No se pudo guardar la bitácora de historial:', histErr);
    }

    console.log(`[IMPORT_FINISHED] Total: ${rows.length}, Creados: ${createdCount}, Actualizados: ${updatedCount}, Errores: ${errorCount}`);

    return {
      historyId,
      totalRows: rows.length,
      createdCount,
      updatedCount,
      errorCount,
      errors: errorsList,
    };
  }

  async getImportHistory(businessId: string) {
    return (prisma as any).productImportHistory.findMany({
      where: { businessId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async exportProducts(businessId: string, warehouseId?: string) {
    const products = await prisma.product.findMany({
      where: { businessId },
      include: {
        category: { select: { name: true } },
        supplier: { select: { name: true } },
        stocks: true,
      },
      orderBy: { name: 'asc' },
    });

    return products.map((p) => {
      let stockQty = 0;
      if (p.stocks && Array.isArray(p.stocks)) {
        if (warehouseId && warehouseId !== 'ALL') {
          const st = p.stocks.find((s) => s.warehouseId === warehouseId);
          stockQty = st ? Number(st.quantity) : 0;
        } else {
          stockQty = p.stocks.reduce((sum, s) => sum + Number(s.quantity), 0);
        }
      }

      return {
        CODIGO: p.barcode || p.sku || '',
        PRODUCTO: p.name,
        DESCRIPCION: p.description || '',
        CATEGORIA: p.category?.name || 'General',
        PROVEEDOR: p.supplier?.name || '',
        COSTO: Number(p.purchasePrice || 0),
        PRECIO: Number(p.salePrice || 0),
        IVA: 21,
        STOCK: stockQty,
      };
    });
  }
}
