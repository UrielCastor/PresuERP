import { z } from 'zod';

export const createUserSchema = z.object({
  body: z
    .object({
      name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
      email: z.string().email('E-mail inválido'),
      password: z
        .string()
        .min(8, 'La contraseña debe tener al menos 8 caracteres')
        .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'La contraseña debe contener al menos una letra y un número'),
      confirmarPassword: z.string().min(1, 'Debe confirmar la contraseña'),
      roleId: z.string().min(1, 'El rol es requerido'),
      isActive: z.boolean().optional(),
    })
    .refine((data) => data.password === data.confirmarPassword, {
      message: 'Las contraseñas no coinciden',
      path: ['confirmarPassword'],
    }),
});

export const updateUserSchema = z.object({
  body: z
    .object({
      name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
      email: z.string().email('E-mail inválido').optional(),
      password: z
        .string()
        .min(8, 'La contraseña debe tener al menos 8 caracteres')
        .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'La contraseña debe contener al menos una letra y un número')
        .optional()
        .nullable()
        .or(z.literal('')),
      confirmarPassword: z
        .string()
        .optional()
        .nullable()
        .or(z.literal('')),
      roleId: z.string().min(1, 'El rol es requerido').optional(),
      isActive: z.boolean().optional(),
    })
    .refine(
      (data) => {
        if (data.password || data.confirmarPassword) {
          return data.password === data.confirmarPassword;
        }
        return true;
      },
      {
        message: 'Las contraseñas no coinciden',
        path: ['confirmarPassword'],
      }
    ),
});
