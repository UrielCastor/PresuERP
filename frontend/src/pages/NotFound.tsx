import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-9xl font-black text-slate-205 dark:text-slate-800 tracking-widest">
        404
      </h1>
      <div className="bg-primary-500 text-white px-2 text-sm rounded rotate-12 absolute">
        Página No Encontrada
      </div>
      <h2 className="text-2xl font-bold mt-4 text-slate-805 dark:text-slate-100">
        ¿Te has perdido en el ERP?
      </h2>
      <p className="text-slate-450 dark:text-slate-400 mt-2 max-w-md">
        La sección que estás buscando no existe o fue movida. Verifica la URL o regresa al tablero.
      </p>
      <Link to="/dashboard" className="mt-8">
        <Button variant="primary">
          Regresar al Dashboard
        </Button>
      </Link>
    </div>
  );
};
