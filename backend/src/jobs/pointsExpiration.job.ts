import { PointsService } from '../services/points.service';
import { logger } from '../config/logger';

let jobInterval: NodeJS.Timeout | null = null;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every 1 hour (resilient to downtime)
const pointsService = new PointsService();

/**
 * Executes points expiration logic with idempotency checks.
 * Uses force = false to respect the database state.
 */
export async function runPointsExpiration(): Promise<void> {
  try {
    logger.info('⏰ [Points Expiration Job] Iniciando chequeo de vencimiento de puntos...');
    const result = await pointsService.expireExpiredPoints(false);
    if (result.totalCustomersAffected > 0) {
      logger.info(`🧹 [Points Expiration Job] Vencimiento completado. Clientes afectados: ${result.totalCustomersAffected}, Puntos expirados: ${result.totalExpiredPointsCount}`);
    } else {
      logger.info('🧹 [Points Expiration Job] Chequeo completado. No se detectaron vencimientos pendientes para hoy.');
    }
  } catch (error: any) {
    logger.error(`❌ [Points Expiration Job Error] Error al ejecutar el chequeo de vencimiento: ${error.message}`);
  }
}

/**
 * Initializes the points expiration scheduler.
 * Executed on server startup. Runs a check immediately, then checks periodically.
 */
export function initPointsExpirationJob() {
  // 1. Run check immediately on startup to recover from periods when the server was offline
  logger.info('⏰ [Points Expiration Job] Ejecutando chequeo inicial de recuperación en arranque...');
  runPointsExpiration();

  // 2. Schedule periodic checks (every 1 hour)
  jobInterval = setInterval(async () => {
    await runPointsExpiration();
  }, CHECK_INTERVAL_MS);

  logger.info('⏰ [Points Expiration Job] Programador periódico de vencimiento de puntos iniciado.');
}

/**
 * Stops the background job scheduler.
 */
export function stopPointsExpirationJob() {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
  }
}
