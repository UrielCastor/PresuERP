import { z } from 'zod';

export const registerBusinessSchema = z.object({
  body: z.object({
    businessName: z.string().min(3, 'Business name must be at least 3 characters'),
    taxId: z.string().min(5, 'Tax ID must be at least 5 characters'),
    adminName: z.string().min(2, 'Admin name must be at least 2 characters'),
    adminEmail: z.string().email('Invalid email address'),
    adminPasswordPlain: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Refresh token is required'),
  }),
});
