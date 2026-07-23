import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Input } from '../components/forms/Input';
import { Button } from '../components/ui/Button';
import { Lock, Mail, Building, User, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

const registerSchema = z.object({
  businessName: z.string().min(3, 'El nombre comercial debe tener al menos 3 caracteres'),
  taxId: z.string().min(5, 'El CUIT/identificación fiscal debe tener al menos 5 caracteres'),
  adminName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  adminEmail: z.string().email('Email inválido'),
  adminPasswordPlain: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors, isLoading: isLoginLoading },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const {
    register: registerBiz,
    handleSubmit: handleBizSubmit,
    formState: { errors: bizErrors, isLoading: isBizLoading },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onLogin = async (data: LoginForm) => {
    setApiError(null);
    try {
      const response = await api.post('/auth/login', data);
      const { accessToken, user } = response.data.data;
      login(accessToken, user);
      navigate('/dashboard');
    } catch (err: any) {
      setApiError(err.response?.data?.message || 'Error al iniciar sesión');
    }
  };

  const onRegister = async (data: RegisterForm) => {
    setApiError(null);
    setSuccessMsg(null);
    try {
      await api.post('/auth/register', data);
      setSuccessMsg('Registro exitoso. Inicia sesión con tus credenciales.');
      setIsRegister(false);
    } catch (err: any) {
      setApiError(err.response?.data?.message || 'Error al registrar la empresa');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] px-4 sm:px-6">
      <div className="w-full max-w-md bg-slate-950/70 border border-slate-800/80 rounded-2xl shadow-2xl backdrop-blur-md px-8 py-10 transition-all duration-300">
        <div className="flex flex-col items-center mb-8">
          <span className="text-3xl font-extrabold bg-gradient-to-r from-primary-400 to-indigo-400 bg-clip-text text-transparent">
            ERP COMERCIAL
          </span>
          <p className="text-slate-400 text-sm mt-2">
            {isRegister ? 'Registra tu negocio y tu cuenta administrador' : 'Ingresa a tu cuenta corporativa'}
          </p>
        </div>

        {apiError && (
          <div className="mb-6 rounded-lg bg-red-950/30 border border-red-900/50 p-4 text-sm text-red-400">
            {apiError}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 rounded-lg bg-green-950/30 border border-green-900/50 p-4 text-sm text-green-400">
            {successMsg}
          </div>
        )}

        {isRegister ? (
          <form onSubmit={handleBizSubmit(onRegister)} className="space-y-4">
            <Input
              id="businessName"
              label="Nombre de Empresa"
              leftIcon={<Building className="h-4 w-4" />}
              placeholder="Mi Empresa S.A."
              error={bizErrors.businessName?.message}
              {...registerBiz('businessName')}
            />
            <Input
              id="taxId"
              label="Identificación Fiscal / CUIT"
              leftIcon={<FileText className="h-4 w-4" />}
              placeholder="30-12345678-9"
              error={bizErrors.taxId?.message}
              {...registerBiz('taxId')}
            />
            <hr className="border-slate-800 my-4" />
            <Input
              id="adminName"
              label="Nombre del Administrador"
              leftIcon={<User className="h-4 w-4" />}
              placeholder="Juan Pérez"
              error={bizErrors.adminName?.message}
              {...registerBiz('adminName')}
            />
            <Input
              id="adminEmail"
              label="Email de Administrador"
              type="email"
              leftIcon={<Mail className="h-4 w-4" />}
              placeholder="juan@empresa.com"
              error={bizErrors.adminEmail?.message}
              {...registerBiz('adminEmail')}
            />
            <Input
              id="adminPasswordPlain"
              label="Contraseña"
              type="password"
              leftIcon={<Lock className="h-4 w-4" />}
              placeholder="••••••••"
              error={bizErrors.adminPasswordPlain?.message}
              {...registerBiz('adminPasswordPlain')}
            />
            <Button type="submit" className="w-full mt-6" isLoading={isBizLoading}>
              Registrar Negocio
            </Button>
          </form>
        ) : (
          <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-4">
            <Input
              id="email"
              label="Correo Electrónico"
              type="email"
              leftIcon={<Mail className="h-4 w-4" />}
              placeholder="ejemplo@correo.com"
              error={loginErrors.email?.message}
              {...registerLogin('email')}
            />
            <Input
              id="password"
              label="Contraseña"
              type="password"
              leftIcon={<Lock className="h-4 w-4" />}
              placeholder="••••••••"
              error={loginErrors.password?.message}
              {...registerLogin('password')}
            />
            <Button type="submit" className="w-full mt-6" isLoading={isLoginLoading}>
              Iniciar Sesión
            </Button>
          </form>
        )}

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setApiError(null);
            }}
            className="text-primary-400 hover:text-primary-350 text-sm font-medium transition-colors"
          >
            {isRegister ? '¿Ya tienes una cuenta? Inicia sesión' : '¿Quieres registrar una nueva empresa? Créala aquí'}
          </button>
        </div>
      </div>
    </div>
  );
};
