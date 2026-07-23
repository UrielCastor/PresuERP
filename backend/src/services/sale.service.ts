import { SaleRepository, SaleFilters } from '../repositories/sale.repository';
import { StockMovementService } from './stockMovement.service';
import { ActivityLogRepository } from '../repositories/activityLog.repository';
import { normalizePaymentMethodCode } from './cash.service';
import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/appError';
import { Prisma } from '@prisma/client';

export class SaleService {
  private saleRepo = new SaleRepository();
  private stockMovementService = new StockMovementService();
  private activityLogRepo = new ActivityLogRepository();

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
    return prisma.$transaction(async (tx) => {
      // 0. Validar la sesión de caja obligatoria (Regla de negocio: Sin caja no hay venta)
      if (!data.cashSessionId) {
        throw new BadRequestError('Es obligatorio tener una sesión de caja abierta para registrar una venta.');
      }

      const activeSession = await tx.cashSession.findFirst({
        where: {
          id: data.cashSessionId,
          businessId,
          status: 'OPEN',
        }
      });

      if (!activeSession) {
        throw new BadRequestError('La sesión de caja asignada no es válida o ya fue cerrada. Operación cancelada.');
      }

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
        calculatedSubtotal += item.quantity * item.unitPrice;
        
        // Consultar stock físico actual antes de descontar (Validación real ACID por la tx)
        const stock = await tx.stock.findFirst({
          where: { productId: item.productId, warehouseId: data.warehouseId, businessId },
        });

        if (!stock || Number(stock.quantity) < item.quantity) {
           const prodName = await tx.product.findUnique({ where: { id: item.productId } }).then((p: any) => p?.name || item.productId);
           throw new BadRequestError(`Stock negativo no permitido preventivamente. El producto ${prodName} no tiene suficiente existencia en el depósito seleccionado (Disponible: ${stock ? Number(stock.quantity) : 0}, Requerido: ${item.quantity}).`);
        }
      }

      // Cálculo y Validación Estricta del Descuento
      const discountType = data.discountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED';
      const rawDiscountValue = Number(data.discountValue ?? data.discountAmount ?? 0);

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
      const rawSurchargeValue = Number(data.surchargeValue ?? data.surchargeAmount ?? 0);

      if (rawSurchargeValue < 0) {
        throw new BadRequestError('El valor del recargo no puede ser negativo.');
      }

      let calculatedSurcharges = 0;
      if (surchargeType === 'PERCENTAGE') {
        calculatedSurcharges = Math.round((calculatedSubtotal * rawSurchargeValue) / 100 * 100) / 100;
      } else if (surchargeType === 'FIXED') {
        calculatedSurcharges = Math.round(rawSurchargeValue * 100) / 100;
      }

      const expectedTotal = calculatedSubtotal - calculatedDiscounts + calculatedSurcharges + calculatedTax;
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

      if (data.payments && data.payments.length > 0) {
        for (const p of data.payments) {
          const pmCode = normalizePaymentMethodCode(p.details);
          if (pmCode === 'CREDIT_ACCOUNT') {
            creditAccountPaymentTotal += Number(p.amount || 0);
          }

          let pmId = p.paymentMethodId;
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
            transactionReference: p.transactionReference,
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

      const sale = await this.saleRepo.create(
        {
          businessId,
          customerId: data.customerId,
          cashSessionId: data.cashSessionId,
          documentTypeId: docType.id,
          documentSeriesId: data.documentSeriesId,
          documentNumber: saleNumber,
          status: data.status || 'COMPLETED', // Status transaccional por defecto para ventas POS rápidas
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
            })),
          } : undefined,
        },
        tx
      );

      // 5. Modificar stock lógico / Kardex a través del servicio integrado interno
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

      // 6. Impactar pagos transaccionales (Caja o Cuenta Corriente)
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
           } else if (sale.cashSessionId) {
             // Métodos de pago físicos impactan la Caja de la sesión
             await tx.cashMovement.create({
               data: {
                 businessId,
                 cashSessionId: sale.cashSessionId,
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
             
             await tx.cashSession.update({
               where: { id: sale.cashSessionId },
               data: {
                 cashTransactionsTotal: { increment: payment.amount }
               }
             });
           }
        }
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
           
           await tx.cashSession.update({
             where: { id: sale.cashSessionId },
             data: {
               cashTransactionsTotal: { decrement: payment.amount }
             }
           });
        }
      }

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
}
