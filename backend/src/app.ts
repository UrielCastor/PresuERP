import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middlewares/error.middleware';
import apiRoutes from './routes'; // product-price-tiers routes active
import mpWebhookRoute from './routes/mp-webhook.routes';

const app = express();

// ━━━ Mercado Pago Webhook — MUST be mounted BEFORE Helmet/CORS/auth ━━━
// MP sends server-to-server POST without JWT, Origin header, or cookies.
// Mounting here guarantees no global middleware can reject the request (401/403/CORS error).
// The route has its own body parser inline.
app.use('/api/v1/business/integrations/mercado-pago/webhook', mpWebhookRoute);

// Security HTTP headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

// Logging request middleware
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: { write: (message) => logger.http(message.trim()) },
    })
  );
}

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Base Route
app.use('/api/v1', apiRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error handling middleware
app.use(errorHandler);

export function printRegisteredRoutes(appInstance: express.Application) {
  console.log('\n=== RUTAS REGISTRADAS EN EXPRESS (/api/v1) ===');
  const extractRoutes = (stack: any[], prefix = '') => {
    stack.forEach((layer: any) => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(', ');
        const fullPath = (prefix + layer.route.path).replace(/\/+/g, '/');
        console.log(`${methods.padEnd(7)} ${fullPath}`);
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        let path = '';
        if (layer.regexp && layer.regexp.source) {
          path = layer.regexp.source
            .replace('^\\', '')
            .replace('\\/?(?=\\/|$)', '')
            .replace('(?:\\/(?=$))?', '')
            .replace(/\\\//g, '/')
            .replace('^', '')
            .replace('$', '');
          if (path.includes('?=')) path = '';
        }
        extractRoutes(layer.handle.stack, prefix + (path ? '/' + path : ''));
      }
    });
  };

  if (appInstance._router && appInstance._router.stack) {
    extractRoutes(appInstance._router.stack);
  }
  console.log('===============================================\n');
}

export default app;
