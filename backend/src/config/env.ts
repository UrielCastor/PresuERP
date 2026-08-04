import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const forbidden = [
  'super_secret_jwt_access_key_change_me_in_production',
  'super_secret_jwt_refresh_key_change_me_in_production',
];

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET inválido.');
}

if (forbidden.includes(process.env.JWT_SECRET)) {
  throw new Error('JWT_SECRET por defecto detectado.');
}

if (process.env.JWT_SECRET.length < 64) {
  throw new Error('JWT_SECRET inválido.');
}

if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET inválido.');
}

if (forbidden.includes(process.env.JWT_REFRESH_SECRET)) {
  throw new Error('JWT_REFRESH_SECRET por defecto detectado.');
}

if (process.env.JWT_REFRESH_SECRET.length < 64) {
  throw new Error('JWT_REFRESH_SECRET inválido.');
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(64),
  JWT_EXPIRES_IN: z.string().default('12h'),
  JWT_REFRESH_SECRET: z.string().min(64),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  BACKEND_URL: z.string().url().default('http://localhost:5000'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
export type Env = z.infer<typeof envSchema>;

