import { prisma } from '../config/db';
import { normalizePaymentMethodCode } from '../services/cash.service';
import { BadRequestError, NotFoundError } from '../utils/appError';

export class CustomerRepository {
  async findAll(businessId: string, options: { search?: string; type?: string; activeOnly?: boolean; page?: number; limit?: number }) {
    const { search, type, activeOnly = true, page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const where: any = {
      businessId,
    };

    if (activeOnly) {
      where.active = true;
    }

    if (type) {
      where.type = type;
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { document: { contains: q, mode: 'insensitive' } },
        { taxId: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { sales: true },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, businessId: string) {
    return prisma.customer.findFirst({
      where: {
        id,
        businessId,
      },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            documentType: true,
            payments: {
              include: {
                paymentMethod: true,
              },
            },
          },
        },
        _count: {
          select: { sales: true },
        },
      },
    });
  }

  async findByDocument(document: string, businessId: string) {
    if (!document) return null;
    return prisma.customer.findFirst({
      where: {
        businessId,
        OR: [
          { document: document.trim() },
          { taxId: document.trim() },
        ],
      },
    });
  }

  async create(data: any) {
    console.log("4. [REPOSITORY CREATE] data:", data);
    console.log("5. [PRE-PRISMA CREATE] allowCreditAccount & creditLimit:", {
      allowCreditAccount: data.allowCreditAccount,
      creditLimit: data.creditLimit
    });
    const clienteGuardado = await prisma.customer.create({
      data,
    });
    console.log("6. [POST-PRISMA CREATE] clienteGuardado:", clienteGuardado);
    return clienteGuardado;
  }

  async update(id: string, businessId: string, data: any) {
    console.log("4. [REPOSITORY UPDATE] data:", data);
    console.log("5. [PRE-PRISMA UPDATE] allowCreditAccount & creditLimit:", {
      allowCreditAccount: data.allowCreditAccount,
      creditLimit: data.creditLimit
    });
    const res = await prisma.customer.updateMany({
      where: { id, businessId },
      data,
    });
    const clienteGuardado = await prisma.customer.findFirst({ where: { id, businessId } });
    console.log("6. [POST-PRISMA UPDATE] clienteGuardado:", clienteGuardado);
    return res;
  }

  async softDelete(id: string, businessId: string) {
    return prisma.customer.updateMany({
      where: { id, businessId },
      data: {
        active: false,
        isActive: false,
      },
    });
  }

  async getAccountMovements(customerId: string, businessId: string) {
    return prisma.customerAccountMovement.findMany({
      where: {
        customerId,
        businessId,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async registerPayment(
    customerId: string,
    businessId: string,
    amount: number,
    paymentMethod: string = 'CASH',
    description?: string,
    createdById?: string
  ) {
    console.log('[ACCOUNT PAYMENT] Repository:', { customerId, businessId, amount, paymentMethod, description, createdById });
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: customerId, businessId } });
      if (!customer) throw new NotFoundError('Cliente no encontrado');

      // 1. Buscar la CashSession abierta del negocio
      const activeSession = await tx.cashSession.findFirst({
        where: { businessId, status: 'OPEN' },
        orderBy: { openedAt: 'desc' },
      });

      // 2. Si no existe una caja abierta, devolver error
      if (!activeSession) {
        throw new BadRequestError('No existe una caja abierta para registrar el cobro de Cuenta Corriente.');
      }

      const debtAmount = Number(amount);
      if (isNaN(debtAmount) || debtAmount <= 0) {
        throw new BadRequestError('El monto del cobro debe ser mayor a 0.');
      }

      const pmCode = normalizePaymentMethodCode(paymentMethod);

      // Consultar si existe una regla de ajuste activa para este medio de pago
      const rule = await (tx as any).paymentAdjustmentRule.findFirst({
        where: {
          businessId,
          paymentMethod: pmCode,
          active: true,
        },
      });

      let adjustmentType: 'NONE' | 'DISCOUNT' | 'SURCHARGE' = 'NONE';
      let adjustmentAmount = 0;
      let paidAmount = debtAmount;

      if (rule) {
        const val = Number(rule.value || 0);
        if (rule.adjustmentType === 'DISCOUNT') {
          adjustmentType = 'DISCOUNT';
          if (rule.valueType === 'PERCENTAGE') {
            adjustmentAmount = debtAmount * (val / 100);
          } else {
            adjustmentAmount = val;
          }
          paidAmount = Math.max(0, debtAmount - adjustmentAmount);
        } else if (rule.adjustmentType === 'SURCHARGE') {
          adjustmentType = 'SURCHARGE';
          if (rule.valueType === 'PERCENTAGE') {
            adjustmentAmount = debtAmount * (val / 100);
          } else {
            adjustmentAmount = val;
          }
          paidAmount = debtAmount + adjustmentAmount;
        }
      }

      // 3. Imputación FIFO a las ventas pendientes del cliente
      const pendingSales = await tx.customerAccountMovement.findMany({
        where: {
          businessId,
          customerId,
          type: 'SALE',
          isSettled: false,
        },
        orderBy: { createdAt: 'asc' },
      });

      let paymentRemainingToApply = debtAmount;
      const now = new Date();

      for (const saleMov of pendingSales) {
        if (paymentRemainingToApply <= 0) break;

        const currentRemaining = Number(saleMov.remainingAmount || saleMov.amount || 0);

        if (paymentRemainingToApply >= currentRemaining) {
          paymentRemainingToApply -= currentRemaining;
          await tx.customerAccountMovement.update({
            where: { id: saleMov.id },
            data: {
              remainingAmount: 0,
              isSettled: true,
              settledAt: now,
            },
          });
        } else {
          const newRemaining = currentRemaining - paymentRemainingToApply;
          paymentRemainingToApply = 0;
          await tx.customerAccountMovement.update({
            where: { id: saleMov.id },
            data: {
              remainingAmount: newRemaining,
              isSettled: false,
            },
          });
        }
      }

      // 4. Actualizar currentDebt del cliente (reducir el monto abonado de la deuda)
      const currentDebtNum = Number(customer.currentDebt || 0);
      const newDebt = Math.max(0, currentDebtNum - debtAmount);

      await tx.customer.update({
        where: { id: customerId },
        data: { currentDebt: newDebt },
      });

      const userIdToUse = createdById || activeSession.openedById;

      // Construcción del detalle del concepto
      let movementDescription = description ? description.trim() : `Cobro Cuenta Corriente - ${customer.name}`;
      if (adjustmentType === 'DISCOUNT') {
        movementDescription += ` | Monto original: $${debtAmount.toLocaleString('es-AR')} | Descuento aplicado: $${adjustmentAmount.toLocaleString('es-AR')} | Monto cobrado: $${paidAmount.toLocaleString('es-AR')}`;
      } else if (adjustmentType === 'SURCHARGE') {
        movementDescription += ` | Monto original: $${debtAmount.toLocaleString('es-AR')} | Recargo: $${adjustmentAmount.toLocaleString('es-AR')} | Monto cobrado: $${paidAmount.toLocaleString('es-AR')}`;
      }

      // 4. Crear CustomerAccountMovement
      const movement = await tx.customerAccountMovement.create({
        data: {
          businessId,
          customerId,
          type: 'PAYMENT',
          amount: debtAmount,
          description: movementDescription,
          createdById: userIdToUse,
        },
      });

      // 5. Crear CashMovement con la categoría ACCOUNT_RECEIVABLE_PAYMENT y el paidAmount
      const cashMovement = await tx.cashMovement.create({
        data: {
          businessId,
          cashSessionId: activeSession.id,
          type: 'IN',
          amount: paidAmount,
          reason: `Cobro Cuenta Corriente - ${customer.name}`,
          referenceType: 'ACCOUNT_RECEIVABLE_PAYMENT',
          referenceId: movement.id,
          paymentMethod: pmCode,
          createdById: userIdToUse,
        },
      });

      console.log('[PAYMENT] CashMovement creado', cashMovement);

      return {
        movement,
        cashMovement,
        newDebt,
        debtAmount,
        paidAmount,
        adjustmentAmount,
        adjustmentType,
      };
    });
  }
}
