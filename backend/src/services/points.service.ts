import { prisma } from '../config/db';
import { Prisma } from '@prisma/client';
import { CustomerPointsSettingsRepository } from '../repositories/customerPointsSettings.repository';
import { CustomerPointsHistoryRepository, PointsHistoryFilters } from '../repositories/customerPointsHistory.repository';
import { NotFoundError, BadRequestError } from '../utils/appError';
import { logger } from '../config/logger';

export class PointsService {
  private settingsRepo = new CustomerPointsSettingsRepository();
  private historyRepo = new CustomerPointsHistoryRepository();

  /**
   * PREPARACIÓN PARA REGLAS FUTURAS:
   * Multiplicador general de puntos por campañas de fidelización (ej: doble/triple puntaje).
   */
  private async getPointsMultiplier(businessId: string, customerId: string, tx?: any): Promise<number> {
    // Implementación futura: buscar campañas activas en DB.
    // const campaign = await tx.pointsCampaign.findFirst({ where: { businessId, active: true } });
    // return campaign ? campaign.multiplier : 1;
    return 1;
  }

  /**
   * PREPARACIÓN PARA REGLAS FUTURAS:
   * Puntos específicos por producto o exclusión de productos.
   */
  private async calculateProductSpecificPoints(
    businessId: string,
    productId: string,
    quantity: number,
    tx?: any
  ): Promise<number | null> {
    // Implementación futura: buscar si el producto tiene asignación directa de puntos o si está excluido.
    // const rule = await tx.productPointsRule.findFirst({ where: { productId } });
    // if (rule?.isExcluded) return 0;
    // return rule ? Number(rule.fixedPoints) * quantity : null;
    return null;
  }

  async getSettings(businessId: string, tx?: any) {
    const client = tx || prisma;
    let settings = await this.settingsRepo.findByBusinessId(businessId, client);
    if (!settings) {
      // Auto-initialize default settings for the business
      settings = await this.settingsRepo.upsert(
        businessId,
        {
          enabled: false,
          earnEveryAmount: new Prisma.Decimal(1000.0),
          earnPoints: 10,
          minimumSaleAmount: new Prisma.Decimal(500.0),
          pointValue: new Prisma.Decimal(10.0),
          allowPartialRedemption: true,
          allowRedemption: true,
          maxRedemptionPercentage: new Prisma.Decimal(50.0),
          expirePoints: false,
          expirationMonths: 12,
          roundingMode: 'FLOOR',
          pointsCalculationMode: 'EFFECTIVELY_PAID',
          accumulateOnPointsPaid: false,
        },
        client
      );
    }
    return settings;
  }

  async updateSettings(
    businessId: string,
    data: {
      enabled: boolean;
      earnEveryAmount: number;
      earnPoints: number;
      minimumSaleAmount: number;
      pointValue: number;
      allowPartialRedemption: boolean;
      allowRedemption: boolean;
      maxRedemptionPercentage: number;
      expirePoints: boolean;
      expirationMonths: number;
      roundingMode: 'FLOOR' | 'ROUND' | 'CEIL';
      pointsCalculationMode: 'GROSS' | 'AFTER_DISCOUNTS' | 'EFFECTIVELY_PAID';
      accumulateOnPointsPaid: boolean;
    },
    context: {
      userId: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Obtener la configuración previa
      const previous = await this.getSettings(businessId, tx);

      // 2. Ejecutar la actualización
      const updated = await this.settingsRepo.upsert(
        businessId,
        {
          enabled: data.enabled,
          earnEveryAmount: new Prisma.Decimal(data.earnEveryAmount),
          earnPoints: data.earnPoints,
          minimumSaleAmount: new Prisma.Decimal(data.minimumSaleAmount),
          pointValue: new Prisma.Decimal(data.pointValue),
          allowPartialRedemption: data.allowPartialRedemption,
          allowRedemption: data.allowRedemption,
          maxRedemptionPercentage: new Prisma.Decimal(data.maxRedemptionPercentage),
          expirePoints: data.expirePoints,
          expirationMonths: data.expirationMonths,
          roundingMode: data.roundingMode,
          pointsCalculationMode: data.pointsCalculationMode,
          accumulateOnPointsPaid: data.accumulateOnPointsPaid,
        },
        tx
      );

      // 3. Registrar auditoría de configuración en ActivityLog
      await tx.activityLog.create({
        data: {
          userId: context.userId,
          businessId,
          entityName: 'CustomerPointsSettings',
          entityId: updated.id,
          actionType: 'UPDATE_SETTINGS',
          previousValues: JSON.stringify(previous),
          newValues: JSON.stringify(updated),
          ipAddress: context.ipAddress || null,
          userAgent: context.userAgent || null,
        },
      });

      return updated;
    });
  }

  async getCustomerBalance(businessId: string, customerId: string, tx?: any) {
    const client = tx || prisma;
    const customer = await client.customer.findFirst({
      where: { id: customerId, businessId },
      select: {
        id: true,
        name: true,
        pointsBalance: true,
        excludeFromLoyalty: true,
      },
    });

    if (!customer) {
      throw new NotFoundError('Cliente no encontrado');
    }

    const settings = await this.getSettings(businessId, client);

    const earnedSum = await client.customerPointsHistory.aggregate({
      where: { customerId, type: 'EARN', businessId },
      _sum: { points: true }
    });
    const redeemedSum = await client.customerPointsHistory.aggregate({
      where: { customerId, type: 'REDEEM', businessId },
      _sum: { points: true }
    });
    const expiredSum = await client.customerPointsHistory.aggregate({
      where: { customerId, type: 'EXPIRED', businessId },
      _sum: { points: true }
    });
    
    const lastEarn = await client.customerPointsHistory.findFirst({
      where: { customerId, type: 'EARN', businessId },
      orderBy: { createdAt: 'desc' }
    });
    const lastRedeem = await client.customerPointsHistory.findFirst({
      where: { customerId, type: 'REDEEM', businessId },
      orderBy: { createdAt: 'desc' }
    });

    return {
      id: customer.id,
      name: customer.name,
      pointsBalance: customer.pointsBalance,
      excludeFromLoyalty: customer.excludeFromLoyalty,
      enabled: settings.enabled,
      pointValue: Number(settings.pointValue),
      maxRedemptionPercentage: Number(settings.maxRedemptionPercentage),
      allowRedemption: settings.allowRedemption,
      totalEarned: Math.abs(earnedSum._sum.points || 0),
      totalRedeemed: Math.abs(redeemedSum._sum.points || 0),
      totalExpired: Math.abs(expiredSum._sum.points || 0),
      lastEarnedDate: lastEarn?.createdAt || null,
      lastEarnedAmount: lastEarn ? Math.abs(lastEarn.points) : 0,
      lastRedeemedDate: lastRedeem?.createdAt || null,
      lastRedeemedAmount: lastRedeem ? Math.abs(lastRedeem.points) : 0,
    };
  }

  async getPointsHistory(businessId: string, filters: PointsHistoryFilters) {
    return this.historyRepo.findAll(businessId, filters);
  }

  async calculatePointsEarned(
    businessId: string,
    customerId: string,
    amountForEarning: number,
    tx?: any
  ): Promise<number> {
    const client = tx || prisma;
    const settings = await this.getSettings(businessId, client);
    if (!settings.enabled) return 0;

    const customer = await client.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer || customer.excludeFromLoyalty) return 0;

    const minAmount = Number(settings.minimumSaleAmount);
    if (amountForEarning < minAmount) return 0;

    const earnEvery = Number(settings.earnEveryAmount);
    if (earnEvery <= 0) return 0;

    // Calcular multiplicadores (preparación para campañas de puntaje doble/triple)
    const multiplierValue = await this.getPointsMultiplier(businessId, customerId, client);

    const baseCalculation = amountForEarning / earnEvery;
    let earnedMultiplier = 0;

    if (settings.roundingMode === 'FLOOR') {
      earnedMultiplier = Math.floor(baseCalculation);
    } else if (settings.roundingMode === 'CEIL') {
      earnedMultiplier = Math.ceil(baseCalculation);
    } else {
      earnedMultiplier = Math.round(baseCalculation);
    }

    const calculatedPoints = earnedMultiplier * settings.earnPoints;
    return Math.round(calculatedPoints * multiplierValue);
  }

  async validateAndCalculateRedemption(
    businessId: string,
    customerId: string,
    pointsToRedeem: number,
    saleTotalBeforePoints: number,
    tx?: any
  ) {
    const client = tx || prisma;
    const settings = await this.getSettings(businessId, client);
    if (!settings.enabled) {
      throw new BadRequestError('El programa de fidelización no está habilitado.');
    }
    if (!settings.allowRedemption) {
      throw new BadRequestError('El canje de puntos no está habilitado.');
    }

    const customer = await client.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundError('Cliente no encontrado.');
    }
    if (customer.excludeFromLoyalty) {
      throw new BadRequestError('El cliente está excluido del programa de fidelización.');
    }

    if (pointsToRedeem <= 0) {
      throw new BadRequestError('La cantidad de puntos a canjear debe ser mayor a cero.');
    }

    if (customer.pointsBalance < pointsToRedeem) {
      throw new BadRequestError(`Puntos insuficientes. El cliente posee ${customer.pointsBalance} puntos.`);
    }

    const pointValue = Number(settings.pointValue);
    const calculatedDiscount = pointsToRedeem * pointValue;

    const maxPercentage = Number(settings.maxRedemptionPercentage);
    const maxDiscount = saleTotalBeforePoints * (maxPercentage / 100);

    if (calculatedDiscount > maxDiscount) {
      const allowedPoints = Math.floor(maxDiscount / pointValue);
      throw new BadRequestError(
        `Descuento por puntos excede el límite del ${maxPercentage}% ($${maxDiscount.toFixed(2)}). El canje máximo permitido es de ${allowedPoints} puntos ($${(allowedPoints * pointValue).toFixed(2)}).`
      );
    }

    if (!settings.allowPartialRedemption) {
      const maxPointsNeeded = Math.floor(maxDiscount / pointValue);
      const expectedPointsToRedeem = Math.min(customer.pointsBalance, maxPointsNeeded);
      if (pointsToRedeem !== expectedPointsToRedeem) {
        throw new BadRequestError(`El canje parcial no está permitido. Debe canjear exactamente ${expectedPointsToRedeem} puntos.`);
      }
    }

    return {
      pointsRedeemed: pointsToRedeem,
      pointsDiscountAmount: calculatedDiscount,
    };
  }

  /**
   * Previsualización de canje de puntos de fidelización
   */
  async previewRedemption(
    businessId: string,
    data: {
      customerId: string;
      pointsToRedeem: number;
      saleTotalBeforePoints: number;
    }
  ) {
    const settings = await this.getSettings(businessId);
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, businessId },
    });

    if (!customer) {
      throw new NotFoundError('Cliente no encontrado.');
    }

    const pointValue = Number(settings.pointValue);
    const maxPercentage = Number(settings.maxRedemptionPercentage);
    
    const maxDiscount = data.saleTotalBeforePoints * (maxPercentage / 100);
    const maxPointsAllowed = Math.floor(maxDiscount / pointValue);
    const maxPointsApplicable = Math.min(customer.pointsBalance, maxPointsAllowed);

    const requestedDiscount = data.pointsToRedeem * pointValue;

    let applicable = true;
    let reason: string | null = null;

    if (!settings.enabled) {
      applicable = false;
      reason = 'El programa de fidelización no está habilitado.';
    } else if (!settings.allowRedemption) {
      applicable = false;
      reason = 'El canje de puntos no está habilitado.';
    } else if (customer.excludeFromLoyalty) {
      applicable = false;
      reason = 'El cliente está excluido del programa de fidelización.';
    } else if (customer.pointsBalance < data.pointsToRedeem) {
      applicable = false;
      reason = `Puntos insuficientes. El cliente posee ${customer.pointsBalance} puntos.`;
    } else if (requestedDiscount > maxDiscount) {
      applicable = false;
      reason = `El descuento excede el límite permitido del ${maxPercentage}% ($${maxDiscount.toFixed(2)}).`;
    } else if (!settings.allowPartialRedemption) {
      const expectedPoints = Math.min(customer.pointsBalance, maxPointsAllowed);
      if (data.pointsToRedeem !== expectedPoints) {
        applicable = false;
        reason = `El canje parcial no está permitido. Debe canjear exactamente ${expectedPoints} puntos.`;
      }
    }

    return {
      pointsAvailable: customer.pointsBalance,
      pointValue,
      maxRedemptionPercentage: maxPercentage,
      maxDiscountAllowed: maxDiscount,
      maxPointsAllowed,
      maxPointsApplicable,
      finalDiscount: requestedDiscount,
      applicable,
      reason,
    };
  }

  /**
   * Cálculo de canje y acumulación al hacer checkout en SaleService (Desacoplamiento total)
   */
  async processSaleCheckout(
    businessId: string,
    customerId: string | null | undefined,
    pointsRedeemedRequested: number,
    saleTotalBeforePoints: number,
    subtotal: number,
    discountAmount: number,
    tx?: any
  ) {
    const client = tx || prisma;
    if (!customerId) {
      return { pointsRedeemed: 0, pointsDiscountAmount: 0, pointsEarned: 0 };
    }

    const settings = await this.getSettings(businessId, client);
    if (!settings.enabled) {
      return { pointsRedeemed: 0, pointsDiscountAmount: 0, pointsEarned: 0 };
    }

    const customer = await client.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer || customer.excludeFromLoyalty) {
      return { pointsRedeemed: 0, pointsDiscountAmount: 0, pointsEarned: 0 };
    }

    let pointsRedeemed = 0;
    let pointsDiscountAmount = 0;

    if (pointsRedeemedRequested > 0) {
      const redemption = await this.validateAndCalculateRedemption(
        businessId,
        customerId,
        pointsRedeemedRequested,
        saleTotalBeforePoints,
        client
      );
      pointsRedeemed = redemption.pointsRedeemed;
      pointsDiscountAmount = redemption.pointsDiscountAmount;
    }

    // Calcular base de acumulación según configuración
    const baseTotalAfterPoints = saleTotalBeforePoints - pointsDiscountAmount;
    let amountForEarning = 0;

    if (settings.pointsCalculationMode === 'GROSS') {
      amountForEarning = subtotal;
    } else if (settings.pointsCalculationMode === 'AFTER_DISCOUNTS') {
      amountForEarning = subtotal - discountAmount;
    } else {
      // EFFECTIVELY_PAID
      amountForEarning = baseTotalAfterPoints;
      if (settings.accumulateOnPointsPaid) {
        amountForEarning += pointsDiscountAmount;
      }
    }

    const pointsEarned = await this.calculatePointsEarned(
      businessId,
      customerId,
      amountForEarning,
      client
    );

    return {
      pointsRedeemed,
      pointsDiscountAmount,
      pointsEarned,
    };
  }

  async applyRedemption(
    businessId: string,
    customerId: string,
    pointsRedeemed: number,
    saleId: string,
    userId: string,
    tx: any
  ) {
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) throw new NotFoundError('Cliente no encontrado.');

    const newBalance = customer.pointsBalance - pointsRedeemed;

    await tx.customer.update({
      where: { id: customerId },
      data: { pointsBalance: newBalance },
    });

    await tx.customerPointsHistory.create({
      data: {
        businessId,
        customerId,
        saleId,
        type: 'REDEEM',
        reason: 'SALE',
        points: -pointsRedeemed,
        balanceAfter: newBalance,
        description: `Canje de puntos en venta`,
        createdById: userId,
      },
    });
  }

  async applyAccreditation(
    businessId: string,
    customerId: string,
    pointsEarned: number,
    saleId: string,
    userId: string,
    tx: any
  ) {
    const settings = await this.getSettings(businessId, tx);
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) throw new NotFoundError('Cliente no encontrado.');

    const newBalance = customer.pointsBalance + pointsEarned;

    let expiresAt: Date | null = null;
    if (settings.expirePoints) {
      expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + settings.expirationMonths);
    }

    await tx.customer.update({
      where: { id: customerId },
      data: { pointsBalance: newBalance },
    });

    await tx.customerPointsHistory.create({
      data: {
        businessId,
        customerId,
        saleId,
        type: 'EARN',
        reason: 'SALE',
        points: pointsEarned,
        balanceAfter: newBalance,
        expiresAt,
        description: `Acreditación de puntos por venta`,
        createdById: userId,
      },
    });
  }

  /**
   * Procesa la acreditación/débito al completarse una venta (Desacoplamiento total)
   */
  async processSale(saleId: string, userId: string, tx: any) {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: { customer: true },
    });
    if (!sale || !sale.customerId) return;

    // Verificar si ya fue procesada
    const existingHistory = await tx.customerPointsHistory.findFirst({
      where: { saleId },
    });
    if (existingHistory) return;

    if (sale.pointsRedeemed > 0) {
      await this.applyRedemption(
        sale.businessId,
        sale.customerId,
        sale.pointsRedeemed,
        sale.id,
        userId,
        tx
      );
    }

    if (sale.pointsEarned > 0) {
      await this.applyAccreditation(
        sale.businessId,
        sale.customerId,
        sale.pointsEarned,
        sale.id,
        userId,
        tx
      );
    }
  }

  /**
   * Reversa puntos ganados y devuelve puntos canjeados en cancelaciones (Desacoplamiento total)
   */
  async reverseSalePoints(businessId: string, saleId: string, userId: string, tx: any) {
    const histories = await tx.customerPointsHistory.findMany({
      where: { saleId, businessId },
    });

    if (histories.length === 0) return;

    for (const history of histories) {
      const isEarnReversed = await tx.customerPointsHistory.findFirst({
        where: {
          businessId,
          customerId: history.customerId,
          saleId,
          reason: 'SALE_CANCEL',
        },
      });
      const isRedeemReversed = await tx.customerPointsHistory.findFirst({
        where: {
          businessId,
          customerId: history.customerId,
          saleId,
          reason: 'REDEEM_CANCEL',
        },
      });

      if (history.type === 'EARN' && isEarnReversed) continue;
      if (history.type === 'REDEEM' && isRedeemReversed) continue;

      const customer = await tx.customer.findUnique({
        where: { id: history.customerId },
      });
      if (!customer) continue;

      if (history.type === 'EARN') {
        const pointsToSubtract = history.points;
        const newBalance = customer.pointsBalance - pointsToSubtract;

        await tx.customer.update({
          where: { id: history.customerId },
          data: { pointsBalance: newBalance },
        });

        await tx.customerPointsHistory.create({
          data: {
            businessId,
            customerId: history.customerId,
            saleId,
            type: 'ADJUSTMENT',
            reason: 'SALE_CANCEL',
            points: -pointsToSubtract,
            balanceAfter: newBalance,
            description: `Reversión de puntos ganados por anulación de venta`,
            createdById: userId,
          },
        });
      } else if (history.type === 'REDEEM') {
        const pointsToAdd = Math.abs(history.points);
        const newBalance = customer.pointsBalance + pointsToAdd;

        await tx.customer.update({
          where: { id: history.customerId },
          data: { pointsBalance: newBalance },
        });

        await tx.customerPointsHistory.create({
          data: {
            businessId,
            customerId: history.customerId,
            saleId,
            type: 'ADJUSTMENT',
            reason: 'REDEEM_CANCEL',
            points: pointsToAdd,
            balanceAfter: newBalance,
            description: `Devolución de puntos canjeados por anulación de venta`,
            createdById: userId,
          },
        });
      }
    }
  }

  async adjustPoints(
    businessId: string,
    data: {
      customerId: string;
      points: number;
      description?: string;
    },
    userId: string
  ) {
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: data.customerId, businessId },
      });
      if (!customer) {
        throw new NotFoundError('Cliente no encontrado.');
      }

      const newBalance = customer.pointsBalance + data.points;
      if (newBalance < 0) {
        throw new BadRequestError(`El balance resultante no puede ser negativo. Balance actual: ${customer.pointsBalance}`);
      }

      await tx.customer.update({
        where: { id: data.customerId },
        data: { pointsBalance: newBalance },
      });

      const history = await tx.customerPointsHistory.create({
        data: {
          businessId,
          customerId: data.customerId,
          type: 'ADJUSTMENT',
          reason: 'MANUAL',
          points: data.points,
          balanceAfter: newBalance,
          description: data.description || 'Ajuste manual de puntos',
          createdById: userId,
        },
      });

      return {
        customerName: customer.name,
        previousBalance: customer.pointsBalance,
        newBalance,
        history,
      };
    });
  }

  /**
   * Procesa el vencimiento diario de puntos (FIFO lógico por cliente)
   */
  /**
   * Procesa el vencimiento diario de puntos (FIFO lógico por cliente)
   * Evita ejecuciones duplicadas en el mismo día natural (idempotencia) a menos que force = true.
   */
  async expireExpiredPoints(force: boolean = false) {
    const businesses = await prisma.business.findMany({
      where: { isActive: true },
    });

    let totalExpiredPointsCount = 0;
    let totalCustomersAffected = 0;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    for (const business of businesses) {
      const businessId = business.id;
      const settings = await this.getSettings(businessId);
      if (!settings.enabled || !settings.expirePoints) continue;

      // Idempotencia: Verificar si ya se ejecutó en el día actual
      const lastRun = (settings as any).lastExpirationRun;
      if (lastRun && !force) {
        const lastRunStr = new Date(lastRun).toISOString().split('T')[0];
        if (lastRunStr === todayStr) {
          logger.info(`✓ [Points Expiration] Ya se ejecutó hoy para el negocio ${business.name}. Omitiendo.`);
          continue;
        }
      }

      logger.info(`🔄 [Points Expiration] Ejecutando vencimientos para el negocio: ${business.name}`);

      const result = await prisma.$transaction(async (tx) => {
        let businessExpiredCount = 0;
        let businessCustomersAffected = 0;

        const customers = await tx.customer.findMany({
          where: { businessId, excludeFromLoyalty: false, pointsBalance: { gt: 0 } },
        });

        for (const customer of customers) {
          // Obtener total de salidas (canjes, expiraciones, ajustes negativos)
          const negativeSumResult = await tx.customerPointsHistory.aggregate({
            where: {
              customerId: customer.id,
              points: { lt: 0 },
            },
            _sum: {
              points: true,
            },
          });
          
          let totalSpent = Math.abs(negativeSumResult._sum.points || 0);

          // Obtener todos los créditos ordenados cronológicamente
          const positiveHistories = await tx.customerPointsHistory.findMany({
            where: {
              customerId: customer.id,
              points: { gt: 0 },
            },
            orderBy: { createdAt: 'asc' },
          });

          let pointsToExpire = 0;

          for (const history of positiveHistories) {
            const entryPoints = history.points;
            if (totalSpent >= entryPoints) {
              totalSpent -= entryPoints;
            } else {
              const remaining = entryPoints - totalSpent;
              totalSpent = 0;

              // Si tiene fecha de vencimiento y esta es menor a ahora, y no fue marcada como expirada
              if (history.expiresAt && history.expiresAt < now && !history.expiredAt) {
                pointsToExpire += remaining;

                // Marcar registro original como expirado
                await tx.customerPointsHistory.update({
                  where: { id: history.id },
                  data: { expiredAt: now },
                });
              }
            }
          }

          if (pointsToExpire > 0) {
            const newBalance = Math.max(0, customer.pointsBalance - pointsToExpire);

            await tx.customer.update({
              where: { id: customer.id },
              data: { pointsBalance: newBalance },
            });

            await tx.customerPointsHistory.create({
              data: {
                businessId,
                customerId: customer.id,
                type: 'EXPIRED',
                reason: 'EXPIRATION',
                points: -pointsToExpire,
                balanceAfter: newBalance,
                description: `Vencimiento automático de ${pointsToExpire} puntos`,
              },
            });

            businessExpiredCount += pointsToExpire;
            businessCustomersAffected++;
          }
        }

        // Registrar la última ejecución exitosa del vencimiento
        await (tx as any).customerPointsSettings.update({
          where: { id: settings.id },
          data: { lastExpirationRun: now },
        });

        return { businessExpiredCount, businessCustomersAffected };
      });

      totalExpiredPointsCount += result.businessExpiredCount;
      totalCustomersAffected += result.businessCustomersAffected;
    }

    return { totalExpiredPointsCount, totalCustomersAffected };
  }

  /**
   * Dashboard consolidado de fidelización
   */
  async getLoyaltyDashboard(businessId: string) {
    const settings = await this.getSettings(businessId);
    const pointValue = Number(settings.pointValue);

    // Sumas totales
    const earnSum = await prisma.customerPointsHistory.aggregate({
      where: { businessId, type: 'EARN' },
      _sum: { points: true },
    });
    const pointsIssued = earnSum._sum.points || 0;

    const redeemSum = await prisma.customerPointsHistory.aggregate({
      where: { businessId, type: 'REDEEM' },
      _sum: { points: true },
    });
    const pointsUsed = Math.abs(redeemSum._sum.points || 0);

    const expiredSum = await prisma.customerPointsHistory.aggregate({
      where: { businessId, type: 'EXPIRED' },
      _sum: { points: true },
    });
    const pointsExpired = Math.abs(expiredSum._sum.points || 0);

    // Pasivo
    const pasivoSum = await prisma.customer.aggregate({
      where: { businessId, excludeFromLoyalty: false },
      _sum: { pointsBalance: true },
      _avg: { pointsBalance: true },
    });
    const programLiability = pasivoSum._sum.pointsBalance || 0;
    const avgPointsPerCustomer = Math.round((pasivoSum._avg.pointsBalance || 0) * 100) / 100;
    const economicValueCommitted = programLiability * pointValue;

    // Clientes con mayor balance
    const topCustomersByBalance = await prisma.customer.findMany({
      where: { businessId, excludeFromLoyalty: false, pointsBalance: { gt: 0 } },
      orderBy: { pointsBalance: 'desc' },
      take: 5,
      select: { id: true, name: true, pointsBalance: true },
    });

    // Clientes con más canjes
    const topCustomersByRedeem: any[] = await prisma.$queryRaw`
      SELECT c.id, c.name, COUNT(h.id)::int as "redeemCount", ABS(SUM(h.points))::int as "totalRedeemed"
      FROM customers c
      JOIN customer_points_history h ON c.id = h."customerId"
      WHERE c."businessId" = ${businessId} AND h.type = 'REDEEM'
      GROUP BY c.id, c.name
      ORDER BY "totalRedeemed" DESC
      LIMIT 5
    `;

    return {
      pointsIssued,
      pointsUsed,
      pointsExpired,
      programLiability,
      economicValueCommitted,
      avgPointsPerCustomer,
      topCustomersByBalance,
      topCustomersByRedeem,
    };
  }

  /**
   * Generación de descarga en formato CSV para reportes
   */
  async exportPointsToCsv(businessId: string, filters: PointsHistoryFilters) {
    const result = await this.historyRepo.findAll(businessId, {
      ...filters,
      page: 1,
      limit: 10000, // retrieve a high count for export
    });

    const headers = ['Fecha', 'Cliente', 'Tipo', 'Puntos', 'Balance Resultante', 'Motivo', 'Descripción'];
    const rows = result.items.map(h => [
      h.createdAt instanceof Date ? h.createdAt.toISOString() : new Date(h.createdAt).toISOString(),
      h.customer?.name || h.customerId,
      h.type,
      h.points.toString(),
      h.balanceAfter.toString(),
      h.reason,
      h.description || '',
    ]);

    return [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
  }
}
