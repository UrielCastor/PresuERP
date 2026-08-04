import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { User, Mail, Shield, Building } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user } = useAuth();

  return (
    <div>
      <PageHeader
        title="Perfil de Usuario"
        subtitle="Verifica tu información básica y tu nivel de accesibilidad."
      />

      <div className="max-w-2xl">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div className="h-16 w-16 rounded-full bg-primary-100 dark:bg-primary-950/50 text-primary-700 dark:text-primary-400 flex items-center justify-center text-2xl font-bold uppercase">
              {user?.name.slice(0, 2)}
            </div>
            <div>
              <CardTitle className="text-xl">{user?.name}</CardTitle>
              <p className="text-xs text-slate-450 uppercase tracking-widest mt-1 font-semibold">{user?.role}</p>
            </div>
          </CardHeader>
          <CardContent className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-850 rounded-lg text-slate-400">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-405 font-bold uppercase tracking-wider">Nombre Completo</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-205">{user?.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-850 rounded-lg text-slate-400">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-405 font-bold uppercase tracking-wider">Correo Electrónico</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-205">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-850 rounded-lg text-slate-400">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-405 font-bold uppercase tracking-wider">Rol de Sistema</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-205">{user?.role}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-850 rounded-lg text-slate-400">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-405 font-bold uppercase tracking-wider">Código de Negocio (SaaS ID)</p>
                  <p className="text-sm font-mono text-slate-800 dark:text-slate-205">{user?.businessId}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
              <h4 className="text-xs font-semibold text-slate-405 uppercase tracking-wider mb-3">Permisos Habilitados</h4>
              <div className="flex flex-wrap gap-2">
                {user?.isStaff ? (
                  <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-950/20 dark:text-primary-400">
                    Acceso Total (Staff)
                  </span>
                ) : user?.role === 'Administrator' ? (
                  <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-950/20 dark:text-primary-400">
                    Acceso Total (Administrador)
                  </span>
                ) : (
                  user?.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-750 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {perm}
                    </span>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
