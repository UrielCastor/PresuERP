import { CashRepository } from '../repositories/cash.repository';
import { ActivityLogRepository } from '../repositories/activityLog.repository';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/appError';
import { prisma } from '../config/db';

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

export function calculateSessionTotals(session: any) {
  const openingBalance = Number(session.openingBalance || 0);
  let cashTotal = 0;
  let mercadoPagoTotal = 0;
  let transferTotal = 0;
  let debitCardTotal = 0;
  let creditCardTotal = 0;
  let manualIncomes = 0;
  let manualExpenses = 0;

  const movements = session.cashMovements || [];
  movements.forEach((m: any) => {
    const amt = Number(m.amount || 0);
    const pm = normalizePaymentMethodCode(m.paymentMethod || m.reason);

    if (m.referenceType === 'OPENING_BALANCE') {
      return;
    }

    if (m.referenceType === 'MANUAL') {
      if (m.type === 'IN') {
        manualIncomes += amt;
        cashTotal += amt;
      } else if (m.type === 'OUT') {
        manualExpenses += amt;
        cashTotal -= amt;
      }
    } else {
      const mult = m.type === 'OUT' ? -1 : 1;
      switch (pm) {
        case 'MERCADO_PAGO':
          mercadoPagoTotal += amt * mult;
          break;
        case 'TRANSFER':
          transferTotal += amt * mult;
          break;
        case 'DEBIT_CARD':
          debitCardTotal += amt * mult;
          break;
        case 'CREDIT_CARD':
          creditCardTotal += amt * mult;
          break;
        case 'CASH':
        default:
          cashTotal += amt * mult;
          break;
      }
    }
  });

  const expectedCashBalance = openingBalance + cashTotal;
  const grandTotal = expectedCashBalance + mercadoPagoTotal + transferTotal + debitCardTotal + creditCardTotal;

  return {
    openingBalance,
    cashTotal,
    mercadoPagoTotal,
    transferTotal,
    debitCardTotal,
    creditCardTotal,
    manualIncomes,
    manualExpenses,
    expectedCashBalance,
    grandTotal,
  };
}

export class CashService {
  private cashRepo = new CashRepository();
  private activityLogRepo = new ActivityLogRepository();

  async openSession(data: { businessId: string; userId: string; cashRegisterId: string; openingBalance: number; notes?: string }) {
    if (data.openingBalance < 0) {
      throw new BadRequestError('El saldo inicial no puede ser negativo.');
    }

    const [existingUserSession, existingBoxSession] = await Promise.all([
      this.cashRepo.findActiveSessionByUser(data.userId, data.businessId),
      this.cashRepo.findActiveSessionByRegister(data.cashRegisterId, data.businessId),
    ]);

    if (existingUserSession) {
      throw new ConflictError('Ya posees una sesión de caja abierta. Ciérrala antes de abrir una nueva.');
    }

    if (existingBoxSession) {
      throw new ConflictError('Esta caja registradora ya se encuentra en uso por otra sesión.');
    }

    return prisma.$transaction(async (tx: any) => {
      const session = await this.cashRepo.openSession({
        businessId: data.businessId,
        cashRegisterId: data.cashRegisterId,
        openedById: data.userId,
        openingBalance: data.openingBalance,
        status: 'OPEN',
      });

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
          newValues: JSON.stringify({ openingBalance: data.openingBalance }),
        }
      });

      return session;
    });
  }

  async closeSession(data: { businessId: string; userId: string; countedBalance: number; notes?: string }) {
    if (data.countedBalance < 0) {
      throw new BadRequestError('El saldo contado no puede ser negativo.');
    }

    const session = await this.cashRepo.findActiveSessionByUser(data.userId, data.businessId);
    if (!session) {
      throw new ConflictError('No tienes ninguna sesión de caja abierta.');
    }

    const sessionDetails = await this.cashRepo.getSessionWithDetails(session.id, data.businessId);
    if (!sessionDetails) {
      throw new ConflictError('Sesión incompleta.');
    }

    const totals = calculateSessionTotals(sessionDetails);
    const expectedBalance = totals.expectedCashBalance;
    const difference = data.countedBalance - expectedBalance;

    return prisma.$transaction(async (tx: any) => {
      const closedSession = await this.cashRepo.closeSession(session.id, {
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

      return { ...closedSession, totals };
    });
  }

  async registerManualMovement(data: { businessId: string; userId: string; type: 'INCOME' | 'EXPENSE'; amount: number; concept: string; notes?: string }) {
    if (data.amount <= 0) {
      throw new BadRequestError('El monto del movimiento debe ser mayor a cero.');
    }

    const session = await this.cashRepo.findActiveSessionByUser(data.userId, data.businessId);
    if (!session) {
      throw new ConflictError('Debes tener una caja abierta para registrar movimientos manuales.');
    }

    const dbType = data.type === 'INCOME' ? 'IN' : 'OUT';
    const amountVariation = data.type === 'INCOME' ? data.amount : -data.amount;

    return prisma.$transaction(async (tx: any) => {
      const movement = await this.cashRepo.createMovement({
        businessId: data.businessId,
        cashSessionId: session.id,
        type: dbType,
        amount: data.amount,
        reason: data.concept + (data.notes ? ` - ${data.notes}` : ''),
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
          actionType: `MANUAL_${data.type}`,
          newValues: JSON.stringify({ amount: data.amount, type: data.type }),
        }
      });

      return movement;
    });
  }

  async getActiveSession(businessId: string, userId: string) {
    const session = await this.cashRepo.findActiveSessionByUser(userId, businessId);
    if (!session) return null;
    const sessionDetails = await this.cashRepo.getSessionWithDetails(session.id, businessId);
    if (!sessionDetails) return null;
    const totals = calculateSessionTotals(sessionDetails);
    return { ...sessionDetails, totals };
  }

  async getHistory(businessId: string) {
    const sessions = await this.cashRepo.listSessions(businessId);
    return Promise.all(
      sessions.map(async (s: any) => {
        const details = await this.cashRepo.getSessionWithDetails(s.id, businessId);
        const totals = details ? calculateSessionTotals(details) : null;
        return { ...s, totals };
      })
    );
  }

  async getSessionHistoryDetail(sessionId: string, businessId: string) {
    const sessionDetails = await this.cashRepo.getSessionWithDetails(sessionId, businessId);
    if (!sessionDetails) throw new NotFoundError('Sesión no encontrada');
    const totals = calculateSessionTotals(sessionDetails);
    return { ...sessionDetails, totals };
  }

  async getRegisters(businessId: string) {
    let registers = await this.cashRepo.listRegisters(businessId);
    
    // Lazy creation fallback for existing tenants that missed provisioning
    if (registers.length === 0) {
      const newRegister = await prisma.cashRegister.create({
        data: {
          businessId,
          name: 'Caja Principal',
          code: 'CAJA-01',
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
        newValues: JSON.stringify({ name: 'Caja Principal' }),
      } as any);
    }
    
    return registers;
  }
}
