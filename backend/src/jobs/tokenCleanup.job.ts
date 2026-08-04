import { prisma } from '../config/db';
import { logger } from '../config/logger';

let cleanupInterval: NodeJS.Timeout | null = null;
let initialTimeout: NodeJS.Timeout | null = null;

const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Deletes all Refresh Tokens from the database that are revoked or expired.
 * Log summary only, never logging any token strings or user information.
 */
export async function cleanExpiredRefreshTokens(): Promise<number> {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { revoked: true },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });

    if (result.count > 0) {
      logger.info(`🧹 [Token Maintenance] Limpieza completada. Refresh Tokens eliminados: ${result.count}`);
    } else {
      logger.info('🧹 [Token Maintenance] Limpieza completada. No se encontraron Refresh Tokens obsoletos.');
    }

    return result.count;
  } catch (error: any) {
    logger.error(`❌ [Token Maintenance Error] Error al ejecutar la limpieza de Refresh Tokens: ${error.message}`);
    return 0;
  }
}

/**
 * Initializes the background scheduler for daily Refresh Token maintenance.
 */
export function initTokenCleanupJob() {
  // Execute initial cleanup 5 seconds after server startup
  initialTimeout = setTimeout(async () => {
    await cleanExpiredRefreshTokens();
  }, 5000);

  // Schedule daily execution (every 24 hours)
  cleanupInterval = setInterval(async () => {
    await cleanExpiredRefreshTokens();
  }, DAILY_INTERVAL_MS);

  logger.info('⏰ [Token Maintenance Job] Programador diario de limpieza de Refresh Tokens iniciado.');
}

/**
 * Gracefully stops the background scheduler timers.
 */
export function stopTokenCleanupJob() {
  if (initialTimeout) {
    clearTimeout(initialTimeout);
    initialTimeout = null;
  }
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
