import { CashRepository } from '../repositories/cash.repository';
import { ActivityLogRepository } from '../repositories/activityLog.repository';
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError } from '../utils/appError';
import { prisma } from '../config/db';

export interface CashSessionTotalsDTO {
  openingBalance: number;
  cashTotal: number;
  mercadoPagoTotal: number;
  transferTotal: number;
  debitCardTotal: number;
  creditCardTotal: number;
  digitalTotal: number;
  manualIncomes: number;
  manualExpenses: number;
  expectedCashBalance: number;
  totalVendido: number;
  grandTotal: number;
}

export interface CashMovementDTO {
  id: string;
  type: string;
  amount: number;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  paymentMethod?: string | null;
  createdAt: string;
  createdByName?: string;
}

export interface CashSessionSummaryDTO {
  id: string;
  businessId: string;
  cashRegisterId: string;
  warehouseId?: string | null;
  cashRegister: {
    id: string;
    name: string;
    code: string;
    warehouseId?: string | null;
    warehouse?: {
      id: string;
      name: string;
    } | null;
  };
  warehouse?: {
    id: string;
    name: string;
  } | null;
  openedById: string;
  openedBy?: {
    id: string;
    name: string;
    email?: string;
  };
  closedById?: string | null;
  openedAt: string;
  closedAt?: string | null;
  openingBalance: number;
  closingBalance: number;
  closingDifference: number;
  status: string;
  totals: CashSessionTotalsDTO;
  cashMovements: CashMovementDTO[];
  sales?: any[];
}

export function normalizePaymentMethodCode(methodOrReason?: any): string {
  if (!methodOrReason) return 'CASH';
  let str = '';
  if (typeof methodOrReason === 'string') {
    str = methodOrReason;
  } else if (typeof methodOrReason === 'object' && methodOrReason !== null) {
    str = methodOrReason.type || methodOrReason.name || methodOrReason.code || '';
  } else {
    str = String(methodOrReason || '');
  }

  const upper = str.toUpperCase().trim();
  if (upper === 'MERCADOPAGO' || upper === 'MERCADO_PAGO' || upper.includes('MERCADO')) return 'MERCADO_PAGO';
  if (upper === 'TRANSFER' || upper.includes('TRANSFER')) return 'TRANSFER';
  if (upper === 'DEBIT_CARD' || upper.includes('DÉBITO') || upper.includes('DEBITO')) return 'DEBIT_CARD';
  if (upper === 'CREDIT_CARD' || upper === 'CARD' || upper.includes('CRÉDITO') || upper.includes('CREDITO')) return 'CREDIT_CARD';
  if (upper === 'CREDIT_ACCOUNT' || upper === 'CTA_CTE' || upper.includes('CUENTA') || upper.includes('CORRIENTE')) return 'CREDIT_ACCOUNT';
  if (upper === 'CASH' || upper.includes('EFECTIVO')) return 'CASH';
  return 'CASH';
}

export function calculateSessionTotals(session: any): CashSessionTotalsDTO {
  const openingBalance = Number(session.openingBalance || 0);
  const movements = session.cashMovements || [];

  let cashTotal = 0;
  let mercadoPagoTotal = 0;
  let transferTotal = 0;
  let debitCardTotal = 0;
  let creditCardTotal = 0;
  let manualIncomes = 0;
  let manualExpenses = 0;

  movements.forEach((m: any) => {
    const amt = Number(m.amount || 0);
    const pm = normalizePaymentMethodCode(m.paymentMethod || m.reason);

    if (m.referenceType === 'OPENING_BALANCE') {
      return;
    }

    if (m.type === 'IN') {
      if (m.referenceType === 'MANUAL') manualIncomes += amt;
      if (pm === 'CASH') cashTotal += amt;
      else if (pm === 'MERCADO_PAGO') mercadoPagoTotal += amt;
      else if (pm === 'TRANSFER') transferTotal += amt;
      else if (pm === 'DEBIT_CARD') debitCardTotal += amt;
      else if (pm === 'CREDIT_CARD') creditCardTotal += amt;
    } else if (m.type === 'OUT') {
      if (m.referenceType === 'MANUAL') manualExpenses += amt;
      if (pm === 'CASH') cashTotal -= amt;
      else if (pm === 'MERCADO_PAGO') mercadoPagoTotal -= amt;
      else if (pm === 'TRANSFER') transferTotal -= amt;
      else if (pm === 'DEBIT_CARD') debitCardTotal -= amt;
      else if (pm === 'CREDIT_CARD') creditCardTotal -= amt;
    }
  });

  const expectedCashBalance = Math.max(0, openingBalance + cashTotal);
  const digitalTotal = mercadoPagoTotal + transferTotal + debitCardTotal + creditCardTotal;
  const totalVendido = Math.max(0, cashTotal + digitalTotal);
  const grandTotal = openingBalance + totalVendido;

  return {
    openingBalance,
    cashTotal,
    mercadoPagoTotal,
    transferTotal,
    debitCardTotal,
    creditCardTotal,
    digitalTotal,
    manualIncomes,
    manualExpenses,
    expectedCashBalance,
    totalVendido,
    grandTotal,
  };
}

export function mapToCashSessionSummaryDTO(session: any): CashSessionSummaryDTO {
  const totals = calculateSessionTotals(session);
  const resolvedWarehouse = session.warehouse || session.cashRegister?.warehouse;

  const warehouseDTO = resolvedWarehouse ? {
    id: resolvedWarehouse.id,
    name: resolvedWarehouse.name,
  } : null;

  return {
    id: session.id,
    businessId: session.businessId,
    cashRegisterId: session.cashRegisterId,
    warehouseId: session.warehouseId || session.cashRegister?.warehouseId || null,
    warehouse: warehouseDTO,
    cashRegister: {
      id: session.cashRegister?.id || session.cashRegisterId,
      name: session.cashRegister?.name || '',
      code: session.cashRegister?.code || '',
      warehouseId: session.cashRegister?.warehouseId || null,
      warehouse: session.cashRegister?.warehouse ? {
        id: session.cashRegister.warehouse.id,
        name: session.cashRegister.warehouse.name,
      } : warehouseDTO,
    },
    openedById: session.openedById,
    openedBy: session.openedBy ? {
      id: session.openedBy.id,
      name: session.openedBy.name,
      email: session.openedBy.email,
    } : undefined,
    closedById: session.closedById || null,
    openedAt: session.openedAt instanceof Date ? session.openedAt.toISOString() : String(session.openedAt),
    closedAt: session.closedAt ? (session.closedAt instanceof Date ? session.closedAt.toISOString() : String(session.closedAt)) : null,
    openingBalance: Number(session.openingBalance || 0),
    closingBalance: Number(session.closingBalance || 0),
    closingDifference: Number(session.closingDifference || 0),
    status: session.status || 'CLOSED',
    totals,
    cashMovements: (session.cashMovements || []).map((m: any) => ({
      id: m.id,
      type: m.type,
      amount: Number(m.amount || 0),
      reason: m.reason,
      referenceType: m.referenceType || null,
      referenceId: m.referenceId || null,
      paymentMethod: m.paymentMethod || null,
      createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
      createdByName: m.createdByUser?.name || m.createdBy?.name || undefined,
    })),
    sales: session.sales || [],
  };
}

export class CashService {
  private cashRepo = new CashRepository();
  private activityLogRepo = new ActivityLogRepository();

  async openSession(data: {
    businessId: string;
    userId: string;
    cashRegisterId: string;
    warehouseId: string;
    openingBalance: number;
    notes?: string;
  }) {
    if (!data.warehouseId) {
      throw new BadRequestError('El depósito es obligatorio para abrir la caja.');
    }
    if (!data.cashRegisterId) {
      throw new BadRequestError('La caja registradora es obligatoria para abrir el turno.');
    }
    if (data.openingBalance === undefined || data.openingBalance === null || data.openingBalance < 0) {
      throw new BadRequestError('El saldo inicial no puede ser negativo.');
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: data.warehouseId, businessId: data.businessId, status: 'ACTIVE' },
    });
    if (!warehouse) {
      throw new NotFoundError('Depósito no encontrado o inactivo.');
    }

    const userWarehouses = await prisma.userWarehouse.findMany({
      where: { userId: data.userId },
    });
    if (userWarehouses.length > 0) {
      const allowed = userWarehouses.some((uw) => uw.warehouseId === data.warehouseId);
      if (!allowed) {
        throw new ForbiddenError(`No tienes permisos autorizados para operar en el depósito "${warehouse.name}".`);
      }
    }

    let register = await prisma.cashRegister.findFirst({
      where: { id: data.cashRegisterId, businessId: data.businessId },
    });
    if (!register) {
      throw new NotFoundError('Caja registradora no encontrada.');
    }

    if (!register.warehouseId || register.warehouseId !== data.warehouseId) {
      await prisma.cashRegister.update({
        where: { id: register.id },
        data: { warehouseId: data.warehouseId },
      });
    }

    const [existingBoxSession, existingWarehouseSession] = await Promise.all([
      this.cashRepo.findActiveSessionByRegister(data.cashRegisterId, data.businessId),
      prisma.cashSession.findFirst({
        where: {
          businessId: data.businessId,
          warehouseId: data.warehouseId,
          status: 'OPEN',
        },
      }),
    ]);

    if (existingBoxSession) {
      throw new ConflictError('Esta caja registradora ya se encuentra en uso por otra sesión activa.');
    }

    if (existingWarehouseSession) {
      throw new ConflictError(`Ya existe una sesión de caja abierta en el depósito "${warehouse.name}". Debes cerrarla antes de abrir una nueva.`);
    }

    return prisma.$transaction(async (tx: any) => {
      const session = await this.cashRepo.openSession({
        businessId: data.businessId,
        cashRegisterId: data.cashRegisterId,
        warehouseId: data.warehouseId,
        openedById: data.userId,
        openingBalance: data.openingBalance,
        status: 'OPEN',
      }, tx);

      if (data.openingBalance > 0) {
        await this.cashRepo.createMovement({
          businessId: data.businessId,
          cashSessionId: session.id,
          type: 'IN',
          amount: data.openingBalance,
          reason: data.notes || 'Saldo inicial de apertura',
          referenceType: 'OPENING_BALANCE',
          createdById: data.userId,
        }, tx);
      }

      await tx.activityLog.create({
        data: {
          businessId: data.businessId,
          userId: data.userId,
          entityName: 'CashSession',
          entityId: session.id,
          actionType: 'OPEN_CASH_REGISTER',
          newValues: JSON.stringify({ openingBalance: data.openingBalance, warehouseId: data.warehouseId }),
        }
      });

      let sessionWithDetails = await this.cashRepo.getSessionWithDetails(session.id, data.businessId, tx);
      if (sessionWithDetails && !sessionWithDetails.warehouse && warehouse) {
        (sessionWithDetails as any).warehouse = warehouse;
      }
      return mapToCashSessionSummaryDTO(sessionWithDetails || session);
    });
  }

  async closeSession(data: { businessId: string; userId: string; countedBalance: number; notes?: string; warehouseId?: string }) {
    if (data.countedBalance < 0) {
      throw new BadRequestError('El saldo contado no puede ser negativo.');
    }

    const session = await this.cashRepo.findActiveSessionWithDetails(data.businessId, data.userId, data.warehouseId);
    if (!session) {
      throw new ConflictError('No existe ninguna sesión de caja abierta en este depósito.');
    }

    // Security check: verify user is authorized for session's warehouse
    if (session.warehouseId) {
      const userWarehouses = await prisma.userWarehouse.findMany({ where: { userId: data.userId } });
      if (userWarehouses.length > 0) {
        const allowed = userWarehouses.some((uw) => uw.warehouseId === session.warehouseId);
        if (!allowed) {
          throw new ForbiddenError('No tienes permisos autorizados para operar en la caja de esta sucursal.');
        }
      }
    }

    const sessionDetails = await this.cashRepo.getSessionWithDetails(session.id, data.businessId);
    if (!sessionDetails) {
      throw new ConflictError('Sesión incompleta.');
    }

    const totals = calculateSessionTotals(sessionDetails);
    const expectedBalance = totals.expectedCashBalance;
    const difference = data.countedBalance - expectedBalance;

    await prisma.$transaction(async (tx: any) => {
      await this.cashRepo.closeSession(session.id, {
        closedById: data.userId,
        closedAt: new Date(),
        closingBalance: data.countedBalance,
        closingDifference: difference,
        status: 'CLOSED',
      });

      await tx.activityLog.create({
        data: {
          businessId: data.businessId,
          userId: data.userId,
          entityName: 'CashSession',
          entityId: session.id,
          actionType: 'CLOSE_CASH_REGISTER',
          newValues: JSON.stringify({ expectedBalance, countedBalance: data.countedBalance, difference, totals }),
        }
      });
    });

    const closedWithDetails = await this.cashRepo.getSessionWithDetails(session.id, data.businessId);
    return mapToCashSessionSummaryDTO(closedWithDetails || sessionDetails);
  }

  async registerManualMovement(data: { businessId: string; userId: string; type: 'INCOME' | 'EXPENSE'; amount: number; concept: string; notes?: string; warehouseId?: string }) {
    if (!data.concept || !data.concept.trim()) {
      throw new BadRequestError('El motivo del movimiento es obligatorio.');
    }

    if (data.amount <= 0) {
      throw new BadRequestError('El monto del movimiento debe ser mayor a cero.');
    }

    const session = await this.cashRepo.findActiveSessionWithDetails(data.businessId, data.userId, data.warehouseId);
    if (!session) {
      throw new ConflictError('No existe una caja abierta en esta sucursal para registrar movimientos manuales.');
    }

    if (session.warehouseId) {
      const userWarehouses = await prisma.userWarehouse.findMany({ where: { userId: data.userId } });
      if (userWarehouses.length > 0) {
        const allowed = userWarehouses.some((uw) => uw.warehouseId === session.warehouseId);
        if (!allowed) {
          throw new ForbiddenError('No tienes permisos autorizados para operar en la caja de esta sucursal.');
        }
      }
    }

    const dbType = data.type === 'INCOME' ? 'IN' : 'OUT';
    const amountVariation = data.type === 'INCOME' ? data.amount : -data.amount;
    const reason = data.concept.trim() + (data.notes ? ` - ${data.notes.trim()}` : '');

    return prisma.$transaction(async (tx: any) => {
      const movement = await this.cashRepo.createMovement({
        businessId: data.businessId,
        cashSessionId: session.id,
        type: dbType,
        amount: data.amount,
        reason,
        referenceType: 'MANUAL',
        createdById: data.userId,
      }, tx);

      await this.cashRepo.incrementSessionTransactions(session.id, amountVariation, tx);

      await tx.activityLog.create({
        data: {
          businessId: data.businessId,
          userId: data.userId,
          entityName: 'CashMovement',
          entityId: movement.id,
          actionType: data.type === 'INCOME' ? 'MANUAL_INCOME' : 'MANUAL_EXPENSE',
          newValues: JSON.stringify({
            amount: data.amount,
            type: data.type,
            reason,
            concept: data.concept,
            notes: data.notes,
          }),
        }
      });

      return movement;
    });
  }

  async getActiveSession(businessId: string, userId: string, warehouseId?: string): Promise<CashSessionSummaryDTO | null> {
    let sessionDetails = await this.cashRepo.findActiveSessionWithDetails(businessId, userId, warehouseId);
    if (!sessionDetails) {
      return null;
    }

    if (!sessionDetails.warehouseId || !sessionDetails.warehouse) {
      let targetWarehouseId = sessionDetails.cashRegister?.warehouseId;
      if (!targetWarehouseId) {
        const mainWh = await prisma.warehouse.findFirst({ where: { businessId, isMain: true } })
          || await prisma.warehouse.findFirst({ where: { businessId } });
        targetWarehouseId = mainWh ? mainWh.id : null;
      }

      if (targetWarehouseId) {
        await prisma.cashSession.update({
          where: { id: sessionDetails.id },
          data: { warehouseId: targetWarehouseId }
        });
        sessionDetails = await this.cashRepo.findActiveSessionWithDetails(businessId, userId, warehouseId);
      }
    }

    return mapToCashSessionSummaryDTO(sessionDetails);
  }

  async getHistory(businessId: string, warehouseId?: string): Promise<CashSessionSummaryDTO[]> {
    const sessions = await this.cashRepo.listSessions(businessId, {}, warehouseId);
    return Promise.all(
      sessions.map(async (s: any) => {
        const details = await this.cashRepo.getSessionWithDetails(s.id, businessId);
        return mapToCashSessionSummaryDTO(details || s);
      })
    );
  }

  async getSessionHistoryDetail(sessionId: string, businessId: string): Promise<CashSessionSummaryDTO> {
    const sessionDetails = await this.cashRepo.getSessionWithDetails(sessionId, businessId);
    if (!sessionDetails) throw new NotFoundError('Sesión no encontrada');
    return mapToCashSessionSummaryDTO(sessionDetails);
  }

  async getRegisters(businessId: string, warehouseId?: string) {
    let registers = await this.cashRepo.listRegisters(businessId, warehouseId);
    
    // Lazy creation fallback for existing tenants / warehouses that missed provisioning
    if (registers.length === 0) {
      const codeSuffix = warehouseId && warehouseId !== 'ALL' ? warehouseId.slice(-4).toUpperCase() : '01';
      const newRegister = await prisma.cashRegister.create({
        data: {
          businessId,
          warehouseId: warehouseId && warehouseId !== 'ALL' ? warehouseId : undefined,
          name: 'Caja Principal',
          code: `CAJA-${codeSuffix}`,
          isActive: true,
        },
      });
      registers = [newRegister];
      
      await this.activityLogRepo.log({
        businessId,
        userId: 'SYSTEM',
        entityName: 'CashRegister',
        entityId: newRegister.id,
        actionType: 'CREATE_SYSTEM_DEFAULT',
        newValues: JSON.stringify({ name: 'Caja Principal', warehouseId }),
      } as any);
    }
    
    return registers;
  }
}
