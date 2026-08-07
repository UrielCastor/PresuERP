import { SaleRepository, SaleFilters } from '../repositories/sale.repository';
import { StockMovementService } from './stockMovement.service';
import { ActivityLogRepository } from '../repositories/activityLog.repository';
import { normalizePaymentMethodCode } from './cash.service';
import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/appError';
import { Prisma } from '@prisma/client';
import { PointsService } from './points.service';

export class SaleService {
  private saleRepo = new SaleRepository();
  private stockMovementService = new StockMovementService();
  private activityLogRepo = new ActivityLogRepository();
  private pointsService = new PointsService();

  private async generateNextNumber(businessId: string, tx: any) {
    const settings = await tx.numberSettings.upsert({
      where: { businessId },
      update: { currentSaleNumber: { increment: 1 } },
      create: { businessId, currentSaleNumber: 2 },
    });
    return settings.currentSaleNumber - 1; // get the pre-incremented number
  }

  async list(businessId: string, filters: SaleFilters) {
    return this.saleRepo.findAll(businessId, filters);
  }

  async findOne(id: string, businessId: string) {
    const sale = await this.saleRepo.findOne(id, businessId);
    if (!sale) {
      throw new NotFoundError('Venta no encontrada');
    }
    return sale;
  }

  async create(
    businessId: string,
    userId: string,
    data: {
      priceListId?: string | null;
      customerId?: string | null;
      cashSessionId?: string | null;
      documentTypeId?: string | null;
      documentSeriesId?: string | null;
      warehouseId: string;
      subtotal: number;
      discountType?: string;
      discountValue?: number;
      discountAmount?: number;
      surchargeType?: string;
      surchargeValue?: number;
      surchargeAmount?: number;
      taxAmount?: number;
      totalAmount: number;
      notes?: string | null;
      status?: string;
      items: {
        productId: string;
        quantity: number;
        unitPrice: number;
        discountAmount?: number;
        taxAmount?: number;
        totalAmount: number;
      }[];
      payments?: {
        paymentMethodId: string;
        amount: number;
        transactionReference?: string | null;
        details?: string | null;
      }[];
    }
  ) {
    console.log('[SALE CREATE]', {
      businessId,
      cashSessionIdRecibido: data.cashSessionId,
      priceListId: data.priceListId,
      paymentMethod: (data as any).paymentMethod || data.payments?.[0]?.details,
      totalAmount: data.totalAmount,
    });

    const createdSale = await prisma.$transaction(async (tx) => {
      // 0. Resolver y Validar la sesión de caja obligatoria (Regla de negocio: Sin caja no hay venta)
      let activeSession: any = null;
      let targetCashSessionId = data.cashSessionId;

      if (targetCashSessionId) {
        activeSession = await tx.cashSession.findFirst({
          where: { id: targetCashSessionId, businessId, status: 'OPEN' },
          include: { cashRegister: true }
        });
        if (!activeSession) {
          throw new BadRequestError('La sesión de caja asignada no es válida o ya fue cerrada. Operación cancelada.');
        }
      } else {
        if (data.warehouseId) {
          activeSession = await tx.cashSession.findFirst({
            where: { businessId, status: 'OPEN', warehouseId: data.warehouseId },
            include: { cashRegister: true },
            orderBy: { openedAt: 'desc' }
          });
        }

        if (!activeSession) {
          activeSession = await tx.cashSession.findFirst({
            where: { businessId, status: 'OPEN' },
            include: { cashRegister: true },
            orderBy: { openedAt: 'desc' }
          });
        }

        if (!activeSession) {
          throw new BadRequestError('Es obligatorio tener una sesión de caja abierta en la sucursal para registrar una venta.');
        }
        targetCashSessionId = activeSession.id;
      }

      // Regla obligatoria: El depósito de la venta es SIEMPRE el de la CashSession activa
      const effectiveWarehouseId = activeSession.warehouseId || activeSession.cashRegister?.warehouseId || data.warehouseId;
      if (!effectiveWarehouseId) {
        throw new BadRequestError('No fue posible determinar el depósito asociado a la sesión de caja activa.');
      }
      data.warehouseId = effectiveWarehouseId;

      console.log('[SALE CASH SESSION]', {
        resolvedCashSessionId: targetCashSessionId,
        effectiveWarehouseId,
      });

      // 1. Validar el almacén
      const warehouse = await tx.warehouse.findFirst({
        where: { id: data.warehouseId, businessId, status: 'ACTIVE' },
      });
      if (!warehouse) {
        throw new NotFoundError('Depósito no encontrado o inactivo');
      }

      // 2. Validar existencias por ítem e inmutabilidad estricta
      let calculatedSubtotal = 0;
      let calculatedTax = Number(data.taxAmount) || 0;

      for (const item of data.items) {
        if (!item.quantity || item.quantity <= 0) {
          throw new BadRequestError('La cantidad vendida de cada producto debe ser mayor a cero.');
        }

        let effectiveUnitPrice = item.unitPrice;
        const product = await tx.product.findFirst({
          where: { id: item.productId, businessId },
          include: {
            priceListItems: data.priceListId
              ? { where: { priceListId: data.priceListId } }
              : false,
            priceTiers: {
              where: { isActive: true },
              orderBy: { minQuantity: 'asc' }
            },
            promotions: {
              where: { isActive: true }
            }
          }
        });

        if (product) {
          let matchingPriceListItem: any = null;
          if (data.priceListId && (product as any).priceListItems && (product as any).priceListItems.length > 0) {
            const items = (product as any).priceListItems
              .filter((pli: any) => Number(pli.minQuantity) <= item.quantity)
              .sort((a: any, b: any) => Number(b.minQuantity) - Number(a.minQuantity));
            if (items.length > 0) matchingPriceListItem = items[0];
          }

          let matchingTier: any = null;
          if ((product as any).priceTiers && (product as any).priceTiers.length > 0) {
            const tiers = (product as any).priceTiers
              .filter((pt: any) => Number(pt.minQuantity) <= item.quantity)
              .sort((a: any, b: any) => Number(b.minQuantity) - Number(a.minQuantity));
            if (tiers.length > 0) matchingTier = tiers[0];
          }

          let matchingPromo: any = null;
          if ((product as any).promotions && (product as any).promotions.length > 0) {
            const promos = (product as any).promotions
              .filter((p: any) => item.quantity >= Number(p.minQuantity))
              .sort((a: any, b: any) => Number(b.minQuantity) - Number(a.minQuantity));
            if (promos.length > 0) matchingPromo = promos[0];
          }

          if (matchingPriceListItem && matchingTier) {
            const pliMinQty = Number(matchingPriceListItem.minQuantity) || 1;
            const tierMinQty = Number(matchingTier.minQuantity) || 1;
            if (pliMinQty > 1 && pliMinQty >= tierMinQty) {
              effectiveUnitPrice = Number(matchingPriceListItem.price);
            } else if (tierMinQty > pliMinQty) {
              effectiveUnitPrice = Number(matchingTier.price);
            } else {
              effectiveUnitPrice = Number(matchingPriceListItem.price);
            }
          } else if (matchingPriceListItem) {
            effectiveUnitPrice = Number(matchingPriceListItem.price);
          } else if (matchingTier) {
            effectiveUnitPrice = Number(matchingTier.price);
          } else if (matchingPromo) {
            const base = Number(product.salePrice);
            const qty = item.quantity;
            if (matchingPromo.type === 'TWO_FOR_ONE') {
              effectiveUnitPrice = (base * Math.ceil(qty / 2)) / qty;
            } else if (matchingPromo.type === 'SECOND_UNIT_DISCOUNT') {
              const desc = Number(matchingPromo.discountPercentage) || 0;
              effectiveUnitPrice = (base * Math.ceil(qty / 2) + base * (1 - desc / 100) * Math.floor(qty / 2)) / qty;
            } else if (matchingPromo.type === 'SPECIAL_PACK') {
              const packPrice = Number(matchingPromo.specialPrice) || base;
              const packQty = Number(matchingPromo.minQuantity) || 1;
              effectiveUnitPrice = (packPrice * Math.floor(qty / packQty) + base * (qty % packQty)) / qty;
            } else {
              effectiveUnitPrice = base;
            }
          } else {
            effectiveUnitPrice = Number(product.salePrice);
          }
        }

        item.unitPrice = effectiveUnitPrice;
        calculatedSubtotal += item.quantity * effectiveUnitPrice;
        
        // Jerarquía de Validación de Stock: 1) Config Global (systemSettings/posSettings) 2) Permitir sin stock individual (product.allowSaleWithoutStock) 3) Stock suficiente
        const systemSettingsRow = await tx.businessSettings.findUnique({ where: { businessId } });
        const posSettingsRow = await (tx as any).pOSSettings.findUnique({ where: { businessId } });

        const globalAllowWithoutStock = Boolean(
          systemSettingsRow?.allowNegativeStock ||
          posSettingsRow?.allowNegativeStock ||
          posSettingsRow?.allowSaleWithoutStock
        );
        const productAllowsWithoutStock = Boolean((product as any)?.allowSaleWithoutStock);
        const canSellWithoutStock = globalAllowWithoutStock || productAllowsWithoutStock;

        if (!canSellWithoutStock) {
          const stock = await tx.stock.findFirst({
            where: { productId: item.productId, warehouseId: data.warehouseId, businessId },
          });

          const availableStock = stock ? Number(stock.quantity) : 0;
          if (availableStock < item.quantity) {
            const prodName = (product as any)?.name || item.productId;
            throw new BadRequestError(`Stock insuficiente. El producto '${prodName}' no tiene suficiente existencia en el depósito seleccionado (Disponible: ${availableStock}, Requerido: ${item.quantity}).`);
          }
        }
      }

      // Cálculo y Validación Estricta del Descuento
      const discountType = data.discountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED';
      const rawDiscountValue = (data.discountValue !== undefined && data.discountValue !== null && Number(data.discountValue) > 0)
        ? Number(data.discountValue)
        : Number(data.discountAmount || 0);

      if (rawDiscountValue < 0) {
        throw new BadRequestError('El valor del descuento no puede ser negativo.');
      }

      let calculatedDiscounts = 0;
      if (discountType === 'PERCENTAGE') {
        calculatedDiscounts = Math.round((calculatedSubtotal * rawDiscountValue) / 100 * 100) / 100;
      } else {
        calculatedDiscounts = Math.round(rawDiscountValue * 100) / 100;
      }

      if (calculatedDiscounts > calculatedSubtotal) {
        throw new BadRequestError(`El descuento (${calculatedDiscounts}) no puede ser mayor al subtotal (${calculatedSubtotal}) de la venta.`);
      }

      // Cálculo y Validación Estricta del Recargo
      const surchargeType = (data.surchargeType === 'PERCENTAGE' || data.surchargeType === 'FIXED') ? data.surchargeType : 'NONE';
      const rawSurchargeValue = (data.surchargeValue !== undefined && data.surchargeValue !== null && Number(data.surchargeValue) > 0)
        ? Number(data.surchargeValue)
        : Number(data.surchargeAmount || 0);

      if (rawSurchargeValue < 0) {
        throw new BadRequestError('El valor del recargo no puede ser negativo.');
      }

      let calculatedSurcharges = 0;
      if (surchargeType === 'PERCENTAGE') {
        calculatedSurcharges = Math.round((calculatedSubtotal * rawSurchargeValue) / 100 * 100) / 100;
      } else if (surchargeType === 'FIXED') {
        calculatedSurcharges = Math.round(rawSurchargeValue * 100) / 100;
      }

      // Integración de Puntos (Loyalty Program)
      const pointsCheckout = await this.pointsService.processSaleCheckout(
        businessId,
        data.customerId,
        (data as any).pointsRedeemed || 0,
        calculatedSubtotal - calculatedDiscounts + calculatedSurcharges + calculatedTax,
        calculatedSubtotal,
        calculatedDiscounts,
        tx
      );
      const pointsRedeemed = pointsCheckout.pointsRedeemed;
      const pointsDiscountAmount = pointsCheckout.pointsDiscountAmount;
      const pointsEarned = pointsCheckout.pointsEarned;

      const baseTotal = calculatedSubtotal - calculatedDiscounts + calculatedSurcharges + calculatedTax - pointsDiscountAmount;

      // Consultar configuración de redondeo automático del POS
      const posSettings = await (tx as any).pOSSettings.findUnique({
        where: { businessId },
      });

      const isGlobalRoundingConfigured = Boolean(
        posSettings?.autoRounding || posSettings?.autoPriceRounding
      );
      const autoRoundingMode = posSettings?.autoRoundingMode || 'CASH_ONLY';

      const rawPaymentMethod = (data as any).paymentMethod || data.payments?.[0]?.details;
      const normalizedPaymentMethod = normalizePaymentMethodCode(rawPaymentMethod);

      const isAutoRoundingActive = (() => {
        if (!isGlobalRoundingConfigured) return false;
        if (autoRoundingMode === 'CASH_ONLY') {
          return normalizedPaymentMethod === 'CASH';
        }
        return true;
      })();

      let expectedTotal = Math.round(baseTotal * 100) / 100;
      let roundingAmount = 0;

      if (isAutoRoundingActive && expectedTotal > 0) {
        const rounded = Math.round(expectedTotal / 100) * 100;
        roundingAmount = Math.round((rounded - expectedTotal) * 100) / 100;
        expectedTotal = rounded;
      }

      console.log('[DEBUG SALE TOTALS BACKEND]', {
        subtotal: calculatedSubtotal,
        descuentos: calculatedDiscounts,
        recargos: calculatedSurcharges,
        promociones: 0,
        impuestos: calculatedTax,
        redondeo: roundingAmount,
        totalCalculado: expectedTotal,
        totalRecibido: data.totalAmount,
        diferencia: Math.round((data.totalAmount - expectedTotal) * 100) / 100
      });

      for (const item of data.items) {
        console.log('[ITEM BACKEND LOG]', {
          producto: item.productId,
          cantidad: item.quantity,
          precioUnitario: item.unitPrice,
          descuento: item.discountAmount || 0,
          subtotalItem: item.quantity * item.unitPrice,
          totalItem: item.totalAmount || (item.quantity * item.unitPrice)
        });
      }

      if (Math.abs(expectedTotal - data.totalAmount) > 0.05) {
        throw new BadRequestError(`Los totales no coinciden. Calculado internamente: ${expectedTotal}, Recibido: ${data.totalAmount}`);
      }

      // 3. Document type / numeración secuencial
      let docType;
      if (data.documentTypeId) {
        docType = await tx.documentType.findFirst({ where: { id: data.documentTypeId, businessId } });
      } else {
        docType = await tx.documentType.findFirst({ where: { businessId } });
      }
      
      if (!docType) {
        throw new BadRequestError('Debes tener al menos un Tipo de Documento comercial configurado.');
      }

      const saleNumber = await this.generateNextNumber(businessId, tx);

      // 4. Inserción de la venta, con items y pagos en bloque
      const processedPayments = [];
      let creditAccountPaymentTotal = 0;

      console.log('[CASH DEBUG] Petición de venta recibida:', {
        paymentMethod: (data as any).paymentMethod,
        paymentsLength: data.payments?.length || 0,
        cashSessionId: data.cashSessionId,
        totalAmount: data.totalAmount,
      });

      let rawPayments = (data.payments && data.payments.length > 0)
        ? data.payments
        : (data as any).paymentMethod
          ? [{ amount: data.totalAmount, details: (data as any).paymentMethod }]
          : [];

      if (rawPayments.length === 0 && (data.status || 'COMPLETED') === 'COMPLETED' && data.totalAmount > 0) {
        rawPayments = [{ amount: data.totalAmount, details: 'CASH' }];
      }

      if (rawPayments.length > 0) {
        for (const p of rawPayments) {
          const pmCode = normalizePaymentMethodCode(p.details);
          if (pmCode === 'CREDIT_ACCOUNT') {
            creditAccountPaymentTotal += Number(p.amount || 0);
          }

          let pmId = (p as any).paymentMethodId;
          if (!pmId) {
            let pmType = 'CASH';
            if (pmCode === 'MERCADO_PAGO') pmType = 'DIGITAL_WALLET';
            else if (pmCode === 'TRANSFER') pmType = 'TRANSFER';
            else if (pmCode === 'DEBIT_CARD' || pmCode === 'CREDIT_CARD') pmType = 'CARD';
            else if (pmCode === 'CREDIT_ACCOUNT') pmType = 'CREDIT_ACCOUNT';

            let existingPm = await tx.paymentMethod.findFirst({
              where: {
                businessId,
                OR: [
                  { type: pmType },
                  { name: { contains: pmCode, mode: 'insensitive' } }
                ]
              }
            });

            if (!existingPm) {
              let name = 'Efectivo';
              if (pmCode === 'MERCADO_PAGO') name = 'Mercado Pago';
              else if (pmCode === 'TRANSFER') name = 'Transferencia Bancaria';
              else if (pmCode === 'DEBIT_CARD') name = 'Tarjeta Débito';
              else if (pmCode === 'CREDIT_CARD') name = 'Tarjeta Crédito';
              else if (pmCode === 'CREDIT_ACCOUNT') name = 'Cuenta Corriente';

              existingPm = await tx.paymentMethod.create({
                data: { businessId, name, type: pmType }
              });
            }
            pmId = existingPm.id;
          }

          processedPayments.push({
            paymentMethodId: pmId,
            amount: p.amount,
            transactionReference: (p as any).transactionReference,
            details: p.details || pmCode,
            pmCode,
          });
        }
      }

      // Validar Cuenta Corriente si aplica
      console.log({
        customerId: data.customerId,
        paymentMethod: data.payments?.[0]?.details,
        totalAmount: data.totalAmount
      });

      if (creditAccountPaymentTotal > 0) {
        if (!data.customerId) {
          console.log('[Audit Sale Validation] RECHAZADO: customerId nulo / Consumidor Final');
          throw new BadRequestError('Es obligatorio seleccionar un cliente para vender con Cuenta Corriente.');
        }

        const customer = await tx.customer.findFirst({
          where: { id: data.customerId, businessId }
        });

        if (!customer) {
          console.log('[Audit Sale Validation] RECHAZADO: Cliente inexistente en el negocio');
          throw new NotFoundError('Cliente no encontrado.');
        }

        console.log({
          id: customer.id,
          allowCreditAccount: customer.allowCreditAccount,
          creditLimit: customer.creditLimit,
          currentDebt: customer.currentDebt
        });

        if (!customer.allowCreditAccount) {
          console.log('[Audit Sale Validation] RECHAZADO: Cuenta corriente deshabilitada');
          throw new BadRequestError(`El cliente "${customer.name}" no tiene habilitada la Cuenta Corriente.`);
        }

        const currentDebt = Number(customer.currentDebt || 0);
        const creditLimit = Number(customer.creditLimit || 0);
        const availableCredit = creditLimit - currentDebt;

        if (currentDebt + creditAccountPaymentTotal > creditLimit) {
          console.log('[Audit Sale Validation] RECHAZADO: Límite excedido');
          throw new BadRequestError(
            `Límite de crédito superado para "${customer.name}". Deuda actual: $${currentDebt.toLocaleString('es-AR')}, Límite: $${creditLimit.toLocaleString('es-AR')}, Crédito disponible: $${Math.max(0, availableCredit).toLocaleString('es-AR')}.`
          );
        }
      }

      const isPendingMp = processedPayments.some(p => p.pmCode === 'MERCADO_PAGO') || data.status === 'PENDING';
      const initialStatus = isPendingMp ? 'PENDING' : (data.status || 'COMPLETED');
      const initialPaymentStatus = isPendingMp ? 'PENDING' : 'PAID';

      console.log('[CASH TRACE 2] Antes de crear la venta en DB', {
        businessId,
        cashSessionId: data.cashSessionId,
        status: initialStatus,
        paymentStatus: initialPaymentStatus,
        processedPaymentsCount: processedPayments.length,
      });

      const sale = await this.saleRepo.create(
        {
          businessId,
          customerId: data.customerId,
          cashSessionId: targetCashSessionId,
          warehouseId: data.warehouseId,
          documentTypeId: docType.id,
          documentSeriesId: data.documentSeriesId,
          documentNumber: saleNumber,
          status: initialStatus,
          paymentStatus: initialPaymentStatus,
          pointsRedeemed,
          pointsEarned,
          pointsDiscountAmount,
          subtotal: calculatedSubtotal,
          discountType,
          discountValue: rawDiscountValue,
          discountAmount: calculatedDiscounts,
          surchargeType,
          surchargeValue: rawSurchargeValue,
          surchargeAmount: calculatedSurcharges,
          taxAmount: calculatedTax,
          totalAmount: data.totalAmount,
          notes: data.notes,
          createdById: userId,
          items: {
            create: data.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discountAmount: i.discountAmount || 0,
              taxAmount: i.taxAmount || 0,
              totalAmount: i.totalAmount,
            })),
          },
          payments: processedPayments.length > 0 ? {
            create: processedPayments.map((p) => ({
              paymentMethodId: p.paymentMethodId,
              amount: p.amount,
              transactionReference: p.transactionReference,
              details: p.details,
              provider: p.pmCode === 'MERCADO_PAGO' ? 'MERCADO_PAGO' : undefined,
              status: isPendingMp ? 'PENDING' : 'APPROVED',
            })),
          } : undefined,
        },
        tx
      );

      console.log('[REAL POS SALE]', {
        saleId: sale.id,
        businessId,
        cashSessionId: sale.cashSessionId,
        paymentMethod: (data as any).paymentMethod || data.payments?.[0]?.details,
        totalAmount: Number(sale.totalAmount)
      });

      // 5. Modificar stock lógico / Kardex a través del servicio integrado interno (únicamente para ventas completadas)
      if (sale.status === 'COMPLETED') {
        for (const item of data.items) {
          // Enlazar descontado al Kardex real como movimiento EXIT
          await this.stockMovementService.registerMovement(
            {
              businessId,
              warehouseId: data.warehouseId,
              productId: item.productId,
              userId,
              movementType: 'EXIT',
              quantity: Math.abs(Number(item.quantity)), 
              unitCost: item.unitPrice, // As proxy reference logic
              referenceType: 'SALE',
              referenceId: sale.id,
              referenceNumber: `${docType.code}-${saleNumber}`,
              reason: 'Venta de mercadería POS',
            },
            undefined,
            undefined,
            tx
          );
        }
      }

      // 6. Impactar pagos transaccionales (Caja o Cuenta Corriente)
      console.log('[CASH DEBUG] Evaluando bloque de pagos transaccionales:', {
        saleStatus: sale.status,
        processedPaymentsLength: processedPayments.length,
        cashSessionId: sale.cashSessionId,
      });

      if (sale.status === 'COMPLETED' && processedPayments.length > 0) {
        for (const payment of processedPayments) {
           if (payment.pmCode === 'CREDIT_ACCOUNT' && data.customerId) {
             // Incrementar deuda actual del cliente
             await tx.customer.update({
               where: { id: data.customerId },
               data: {
                 currentDebt: { increment: payment.amount }
               }
             });

             // Registrar movimiento de Cuenta Corriente (Venta pendiente con FIFO)
             await tx.customerAccountMovement.create({
               data: {
                 businessId,
                 customerId: data.customerId,
                 type: 'SALE',
                 amount: payment.amount,
                 remainingAmount: payment.amount,
                 isSettled: false,
                 description: `Venta en Cta. Cte. Nro ${docType.code}-${saleNumber}`,
                 referenceId: sale.id,
                 createdById: userId,
               }
             });
           } else if (targetCashSessionId) {
             console.log('[CASH MOVEMENT CREATE]', {
               cashSessionId: targetCashSessionId,
               amount: payment.amount,
               type: 'IN',
               referenceType: 'SALE',
               paymentMethod: payment.pmCode
             });

             const mov = await tx.cashMovement.create({
               data: {
                 businessId,
                 cashSessionId: targetCashSessionId,
                 createdById: userId,
                 paymentMethodId: payment.paymentMethodId,
                 paymentMethod: payment.pmCode,
                 type: 'IN',
                 amount: payment.amount,
                 referenceType: 'SALE',
                 referenceId: sale.id,
                 reason: `Cobro de venta ${docType.code}-${saleNumber} (${payment.details || payment.pmCode})`,
               }
             });

             console.log('[CASH MOVEMENT GENERATED]', {
               id: mov.id,
               cashSessionId: mov.cashSessionId,
               referenceId: mov.referenceId,
               amount: Number(mov.amount)
             });
           }
        }
      } else {
        console.log('[CASH DEBUG] OMITIDO: El bloque de pagos NO se ejecutó porque status !== COMPLETED o processedPayments.length === 0');
      }

      // Acreditación/Canje automático de puntos si la venta está completada
      if (sale.status === 'COMPLETED') {
        await this.pointsService.processSale(sale.id, userId, tx);
      }

      // 7. Generar log de auditoría
      await tx.activityLog.create({
        data: {
          userId,
          businessId,
          entityName: 'Sale',
          entityId: sale.id,
          actionType: 'CREATE_SALE',
          previousValues: '{}',
          newValues: JSON.stringify({
            saleId: sale.id,
            totalAmount: data.totalAmount,
            documentNumber: saleNumber,
            itemsCount: data.items.length,
          }),
        },
      });

      return sale;
    }); // End $transaction

    // Intentar emisión de Factura ARCA en segundo plano si está activada
    try {
      const { FiscalService } = await import('./fiscal.service');
      const fiscalInvoice = await FiscalService.emitInvoiceForSale(businessId, createdSale.id);
      if (fiscalInvoice) {
        (createdSale as any).electronicInvoice = fiscalInvoice;
      }
    } catch (fiscalErr: any) {
      console.warn(`[ARCA Invoicing Warning] No se pudo autorizar factura automática para venta ${createdSale.id}:`, fiscalErr.message);
    }

    return createdSale;
  }

  async cancel(id: string, businessId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const sale = await this.saleRepo.findOne(id, businessId, tx);
      
      if (!sale) {
        throw new NotFoundError('Venta no encontrada');
      }

      if (sale.status === 'CANCELLED') {
        throw new BadRequestError('La venta ya se encuentra anulada');
      }

      // 1. Modificar el estado principal a CANCELLED
      const updated = await this.saleRepo.update(id, businessId, { status: 'CANCELLED' }, tx);

      // 2. Reversión física de stock / Kardex (ENTRY por devolución o anulación de egreso)
      for (const item of sale.items) {
        // Encontrar el movimiento de salida original usando referenceId
        const originalMovement = await tx.stockMovement.findFirst({
           where: { referenceId: sale.id, referenceType: 'SALE', productId: item.productId, movementType: 'EXIT' }
        });
        const targetWarehouseId = originalMovement?.warehouseId || '';

        await this.stockMovementService.registerMovement(
          {
            businessId,
            warehouseId: targetWarehouseId,
            productId: item.productId,
            userId,
            movementType: 'ENTRY',
            quantity: Number(item.quantity), 
            unitCost: Number(item.unitPrice), 
            referenceType: 'SALE_REFUND',
            referenceId: sale.id,
            referenceNumber: `${sale.documentType.code}-${sale.documentNumber} (A)`,
            reason: 'Reversión por anulación de Venta',
          },
          undefined,
          undefined,
          tx
        );
      }

      // 3. Si impactó caja, registrar salida compensatoria.
      if (sale.cashSessionId && sale.payments.length > 0) {
        for (const payment of sale.payments) {
           const pmCode = normalizePaymentMethodCode(payment.details);
           await tx.cashMovement.create({
             data: {
               businessId,
               cashSessionId: sale.cashSessionId,
               createdById: userId,
               paymentMethodId: payment.paymentMethodId,
               paymentMethod: pmCode,
               type: 'OUT',
               amount: payment.amount,
               referenceType: 'SALE_REFUND',
               referenceId: sale.id,
               reason: `Anulación de venta ${sale.documentType.code}-${sale.documentNumber} (${payment.details || pmCode})`,
             }
           });
        }
      }

      // Reversión de puntos por cancelación de venta
      await this.pointsService.reverseSalePoints(businessId, sale.id, userId, tx);

      // 4. Log auditoría
      await tx.activityLog.create({
        data: {
          userId,
          businessId,
          entityName: 'Sale',
          entityId: sale.id,
          actionType: 'CANCEL_SALE',
          previousValues: JSON.stringify({ status: sale.status }),
          newValues: JSON.stringify({ status: 'CANCELLED' }),
        },
      });

      return updated;
    });
  }

  async getSuspendedSales(businessId: string, warehouseId?: string) {
    const where: any = {
      businessId,
      status: 'PENDING',
    };
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }
    return prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, taxId: true } },
        documentType: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, barcode: true, salePrice: true, unitOfMeasure: true }
            }
          }
        },
        payments: {
          include: {
            paymentMethod: { select: { id: true, name: true, type: true } }
          }
        }
      }
    });
  }

  async recoverSuspendedSale(id: string, businessId: string) {
    return prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id, businessId, status: 'PENDING' },
        include: {
          customer: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });
      if (!sale) {
        throw new NotFoundError('Venta suspendida no encontrada o ya fue procesada.');
      }
      // Marcar la venta suspendida como anulada/recuperada para evitar doble recuperación
      await tx.sale.update({
        where: { id },
        data: { status: 'CANCELLED', notes: 'Recuperada en POS' }
      });
      return sale;
    });
  }

  async deleteSuspendedSale(id: string, businessId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id, businessId, status: 'PENDING' }
      });
      if (!sale) {
        throw new NotFoundError('Venta suspendida no encontrada');
      }
      await tx.sale.delete({ where: { id } });

      await tx.activityLog.create({
        data: {
          userId,
          businessId,
          entityName: 'Sale',
          entityId: id,
          actionType: 'DELETE_SUSPENDED_SALE',
          previousValues: JSON.stringify({ documentNumber: sale.documentNumber }),
          newValues: '{}'
        }
      });
      return { success: true };
    });
  }

  async processRefund(
    id: string,
    businessId: string,
    userId: string,
    payload: {
      reason?: string;
      items: { saleItemId: string; quantity: number }[];
    }
  ) {
    if (!payload.items || payload.items.length === 0) {
      throw new BadRequestError('Debes seleccionar al menos un ítem para devolver.');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Obtener la venta original con sus items, devoluciones previas y pagos
      const sale = await tx.sale.findFirst({
        where: { id, businessId },
        include: {
          documentType: true,
          items: true,
          payments: { include: { paymentMethod: true } },
          refunds: {
            include: {
              items: true
            }
          }
        }
      });

      if (!sale) {
        throw new NotFoundError('Venta no encontrada');
      }
      if (sale.status === 'CANCELLED') {
        throw new BadRequestError('No se pueden hacer devoluciones sobre una venta anulada');
      }

      // 2. Calcular cantidades ya devueltas previamente por cada item
      const previouslyRefundedMap = new Map<string, number>();
      for (const ref of sale.refunds) {
        for (const refItem of ref.items) {
          const current = previouslyRefundedMap.get(refItem.saleItemId) || 0;
          previouslyRefundedMap.set(refItem.saleItemId, current + Number(refItem.quantity));
        }
      }

      // 3. Validar y preparar los ítems a devolver
      let refundTotal = 0;
      const refundItemsToCreate: {
        saleItemId: string;
        productId: string;
        quantity: number;
        unitPrice: number;
        totalAmount: number;
      }[] = [];

      for (const reqItem of payload.items) {
        if (!reqItem.quantity || reqItem.quantity <= 0) continue;

        const saleItem = sale.items.find((i) => i.id === reqItem.saleItemId);
        if (!saleItem) {
          throw new BadRequestError(`El ítem con ID ${reqItem.saleItemId} no pertenece a esta venta.`);
        }

        const soldQty = Number(saleItem.quantity);
        const prevRef = previouslyRefundedMap.get(saleItem.id) || 0;
        const maxAvailable = soldQty - prevRef;

        if (reqItem.quantity > maxAvailable + 0.0001) {
          throw new BadRequestError(
            `No es posible devolver ${reqItem.quantity} u. del producto. Máximo disponible a devolver: ${maxAvailable} u.`
          );
        }

        const unitPrice = Number(saleItem.unitPrice);
        const itemTotal = reqItem.quantity * unitPrice;
        refundTotal += itemTotal;

        refundItemsToCreate.push({
          saleItemId: saleItem.id,
          productId: saleItem.productId,
          quantity: reqItem.quantity,
          unitPrice,
          totalAmount: itemTotal,
        });
      }

      if (refundItemsToCreate.length === 0 || refundTotal <= 0) {
        throw new BadRequestError('La cantidad total a devolver debe ser mayor a cero.');
      }

      // 4. Secuencia numérica de devolución
      const lastRefund = await tx.saleRefund.findFirst({
        where: { businessId },
        orderBy: { refundNumber: 'desc' }
      });
      const nextRefundNumber = (lastRefund?.refundNumber || 0) + 1;

      // Buscar sesión de caja activa opcional para egreso compensatorio
      const activeCashSession = await tx.cashSession.findFirst({
        where: { businessId, warehouseId: sale.warehouseId, status: 'OPEN' },
        orderBy: { openedAt: 'desc' }
      }) || await tx.cashSession.findFirst({
        where: { businessId, status: 'OPEN' },
        orderBy: { openedAt: 'desc' }
      });

      // 5. Crear el registro de SaleRefund y SaleRefundItem
      const effectiveWarehouseId = sale.warehouseId || activeCashSession?.warehouseId || '';
      const refund = await tx.saleRefund.create({
        data: {
          businessId,
          saleId: sale.id,
          warehouseId: effectiveWarehouseId,
          cashSessionId: activeCashSession?.id || sale.cashSessionId,
          createdById: userId,
          refundNumber: nextRefundNumber,
          totalAmount: refundTotal,
          reason: payload.reason || 'Devolución de productos',
          items: {
            create: refundItemsToCreate.map((ri) => ({
              saleItemId: ri.saleItemId,
              productId: ri.productId,
              quantity: ri.quantity,
              unitPrice: ri.unitPrice,
              totalAmount: ri.totalAmount,
            }))
          }
        },
        include: {
          items: { include: { product: true } }
        }
      });

      // 6. Verificar si la venta quedó completamente devuelta
      let isFullyRefunded = true;
      for (const saleItem of sale.items) {
        const sold = Number(saleItem.quantity);
        const prev = previouslyRefundedMap.get(saleItem.id) || 0;
        const currentRef = refundItemsToCreate.find((r) => r.saleItemId === saleItem.id)?.quantity || 0;
        if (prev + currentRef < sold - 0.0001) {
          isFullyRefunded = false;
          break;
        }
      }

      if (isFullyRefunded) {
        await tx.sale.update({
          where: { id: sale.id },
          data: { status: 'REFUNDED' }
        });
      }

      // 7. Reingreso de Stock en el depósito original de la venta mediante Kardex (ENTRY / SALE_REFUND)
      for (const ri of refundItemsToCreate) {
        await this.stockMovementService.registerMovement(
          {
            businessId,
            warehouseId: effectiveWarehouseId,
            productId: ri.productId,
            userId,
            movementType: 'ENTRY',
            quantity: ri.quantity,
            unitCost: ri.unitPrice,
            referenceType: 'SALE_REFUND',
            referenceId: refund.id,
            referenceNumber: `${sale.documentType.code}-${sale.documentNumber} (Devolución #${nextRefundNumber})`,
            reason: payload.reason || 'Devolución de mercadería POS',
          },
          undefined,
          undefined,
          tx
        );
      }

      // 8. Ajuste de Caja / Cuenta Corriente
      const cashPayment = sale.payments.find((p) => {
        const details = String(p.details || '').toUpperCase();
        return details === 'CASH' || p.paymentMethod?.type === 'CASH' || details.includes('EFECTIVO');
      });

      const creditAccountPayment = sale.payments.find((p) => {
        const details = String(p.details || '').toUpperCase();
        return details === 'CREDIT_ACCOUNT' || p.paymentMethod?.type === 'CREDIT_ACCOUNT' || details.includes('CUENTA CORRIENTE');
      });

      if (creditAccountPayment && sale.customerId) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { currentDebt: { decrement: refundTotal } }
        });
        await tx.customerAccountMovement.create({
          data: {
            businessId,
            customerId: sale.customerId,
            type: 'PAYMENT',
            amount: refundTotal,
            remainingAmount: 0,
            isSettled: true,
            description: `Reintegro por devolución de venta ${sale.documentType.code}-${sale.documentNumber}`,
            referenceId: refund.id,
            createdById: userId,
          }
        });
      } else if (activeCashSession) {
        const pmId = cashPayment?.paymentMethodId || sale.payments[0]?.paymentMethodId;
        await tx.cashMovement.create({
          data: {
            businessId,
            cashSessionId: activeCashSession.id,
            createdById: userId,
            paymentMethodId: pmId,
            paymentMethod: cashPayment ? 'CASH' : (sale.payments[0]?.details || 'CASH'),
            type: 'OUT',
            amount: refundTotal,
            referenceType: 'SALE_REFUND',
            referenceId: refund.id,
            reason: `Reintegro devolución venta ${sale.documentType.code}-${sale.documentNumber} (${payload.reason || 'Devolución'})`,
          }
        });
      }

      // 9. Reversión de puntos
      await this.pointsService.reverseSalePoints(businessId, sale.id, userId, tx);

      // 10. Auditoría
      await tx.activityLog.create({
        data: {
          userId,
          businessId,
          entityName: 'SaleRefund',
          entityId: refund.id,
          actionType: 'CREATE_SALE_REFUND',
          previousValues: JSON.stringify({ saleId: sale.id, originalTotal: sale.totalAmount }),
          newValues: JSON.stringify({
            refundId: refund.id,
            refundNumber: nextRefundNumber,
            refundTotal,
            isFullyRefunded
          })
        }
      });

      return refund;
    });
  }
}
