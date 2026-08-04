import { prisma } from '../config/db';
import { logger } from '../config/logger';

let cleanupInterval: NodeJS.Timeout | null = null;
let initialTimeout: NodeJS.Timeout | null = null;

const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Syncs and updates the status of subscriptions in the database whose end dates have passed to 'EXPIRED'.
 */
export async function syncExpiredSubscriptions(): Promise<{ updatedSubscriptions: number }> {
  try {
    const now = new Date();

    // Update subscriptions table records whose endDate is in the past and still marked ACTIVE or TRIAL
    const subResult = await (prisma as any).subscription.updateMany({
      where: {
        status: { in: ['ACTIVE', 'TRIAL'] },
        endDate: { lt: now },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (subResult.count > 0) {
      logger.info(`💳 [Subscription Maintenance] Se actualizaron ${subResult.count} suscripciones vencidas a estado EXPIRED.`);
    } else {
      logger.info('💳 [Subscription Maintenance] Verificación de suscripciones completada. No había suscripciones vencidas pendientes de actualizar.');
    }

    return { updatedSubscriptions: subResult.count };
  } catch (error: any) {
    logger.error(`❌ [Subscription Maintenance Error] Error al sincronizar vencimientos de suscripciones: ${error.message}`);
    return { updatedSubscriptions: 0 };
  }
}

/**
 * Initializes the background scheduler for daily subscription expiration sync.
 */
export function initSubscriptionCleanupJob() {
  initialTimeout = setTimeout(async () => {
    await syncExpiredSubscriptions();
  }, 10000);

  cleanupInterval = setInterval(async () => {
    await syncExpiredSubscriptions();
  }, DAILY_INTERVAL_MS);

  logger.info('⏰ [Subscription Maintenance Job] Programador diario de vencimiento de suscripciones iniciado.');
}

/**
 * Gracefully stops the background scheduler timers.
 */
export function stopSubscriptionCleanupJob() {
  if (initialTimeout) {
    clearTimeout(initialTimeout);
    initialTimeout = null;
  }
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
