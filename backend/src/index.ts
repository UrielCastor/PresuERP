import app, { printRegisteredRoutes } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/db';
import { AuthService } from './services/auth.service';

async function main() {
  // Test DB connection
  try {
    await prisma.$connect();
    logger.info('🚀 Database connection established successfully');

    // Seed new permissions and role mapping for all businesses
    await AuthService.bootstrapPermissions();
    logger.info('🔑 Permissions and role assignments successfully bootstrapped');
  } catch (error) {
    logger.error('❌ Failed to connect to the database:', error);
    process.exit(1);
  }
const server = app.listen(env.PORT, "0.0.0.0", () => {
  logger.info(`✨ Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  printRegisteredRoutes(app);
});
  // const server = app.listen(env.PORT, () => {
  //   logger.info(`✨ Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  // });

  const shutdown = async () => {
    logger.info('Shutting down server gracefully...');
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Database connections closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
