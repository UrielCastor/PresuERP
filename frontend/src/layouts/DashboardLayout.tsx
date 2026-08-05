import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppearance } from '../contexts/AppearanceContext';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  TrendingUp,
  Settings,
  Bell,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  User,
  ShieldCheck,
  Building,
  ChevronDown,
  FolderOpen,
  Truck,
  Warehouse,
  Boxes,
  ClipboardList,
  History,
  Building2,
  Tag,
} from 'lucide-react';
import { menuConfig } from '../config/menu';
import { Button } from '../components/ui/Button';
import { HelpButton } from '../components/ui/HelpButton';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { preferences, updatePreference } = useAppearance();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuConfig.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some((child) => child.href && location.pathname === child.href);
        if (hasActiveChild) {
          initial[item.name] = true;
        }
      }
    });
    return initial;
  });

  const toggleSubmenu = (name: string) => {
    setOpenSubmenus((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'LayoutDashboard': return <LayoutDashboard className="h-5 w-5" />;
      case 'Building': return <Building className="h-5 w-5" />;
      case 'Users': return <Users className="h-5 w-5" />;
      case 'Package': return <Package className="h-5 w-5" />;
      case 'FolderOpen': return <FolderOpen className="h-5 w-5" />;
      case 'Truck': return <Truck className="h-5 w-5" />;
      case 'Warehouse': return <Warehouse className="h-5 w-5" />;
      case 'Boxes': return <Boxes className="h-5 w-5" />;
      case 'ClipboardList': return <ClipboardList className="h-5 w-5" />;
      case 'ShoppingCart': return <ShoppingCart className="h-5 w-5" />;
      case 'TrendingUp': return <TrendingUp className="h-5 w-5" />;
      case 'Settings': return <Settings className="h-5 w-5" />;
      case 'ShieldCheck': return <ShieldCheck className="h-5 w-5" />;
      case 'History': return <History className="h-5 w-5" />;
      case 'Tag': return <Tag className="h-5 w-5" />;
      default: return null;
    }
  };

  const filteredNav = menuConfig
    .map((item) => {
      if (item.children) {
        let filteredChildren = item.children.filter(
          (child) => !child.permission || hasPermission(child.permission)
        );

        // Ocultar acceso redundante Configuración -> POS para el rol Administrator
        if (user?.role === 'Administrator') {
          filteredChildren = filteredChildren.filter(
            (child) => !(item.name === 'Configuración' && child.name === 'POS')
          );
        }

        return {
          ...item,
          children: filteredChildren,
        };
      }
      return item;
    })
    .filter((item) => {
      if (item.name === 'Auditorías') {
        return user?.role === 'Administrator' && !user?.isStaff;
      }
      if (item.permission && !hasPermission(item.permission)) {
        return false;
      }
      if (item.children && item.children.length === 0) {
        return false;
      }
      return true;
    });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors duration-200">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center h-16 flex-shrink-0 px-6 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xl font-extrabold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">
              ERP COMERCIAL
            </span>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {filteredNav.map((item) => {
              if (item.children) {
                const isOpen = !!openSubmenus[item.name];
                const hasActiveChild = item.children.some((child) => child.href && location.pathname === child.href);
                return (
                  <div key={item.name} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleSubmenu(item.name)}
                      className={`w-full group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                        hasActiveChild
                          ? 'text-primary-600 bg-primary-50/50 dark:bg-primary-950/20 dark:text-primary-400 font-semibold'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-350 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                      }`}
                    >
                      <div className="flex items-center">
                        <span className={`mr-3 ${hasActiveChild ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300'}`}>
                          {getIcon(item.iconName)}
                        </span>
                        {item.name}
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                          isOpen ? 'transform rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="pl-4 space-y-1 mt-1 border-l border-slate-200 dark:border-slate-800 ml-5">
                        {item.children.map((child) => {
                          const isChildActive = child.href ? location.pathname === child.href : false;
                          return (
                            <Link
                              key={child.name}
                              to={child.href || '#'}
                              className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                                isChildActive
                                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400 font-semibold'
                                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-450 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                              }`}
                            >
                              <span className={`mr-3 ${isChildActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300'}`}>
                                {getIcon(child.iconName)}
                              </span>
                              {child.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = item.href ? location.pathname === item.href : false;
              return (
                <Link
                  key={item.name}
                  to={item.href || '#'}
                  className={`group flex items-center px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-350 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                  }`}
                >
                  <span className={`mr-3 ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300'}`}>
                    {getIcon(item.iconName)}
                  </span>
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-red-650 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20 rounded-lg transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-slate-900 pt-5 pb-4 border-r border-slate-200 dark:border-slate-800">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <div className="flex-shrink-0 flex items-center px-6">
              <span className="text-xl font-extrabold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">
                ERP COMERCIAL
              </span>
            </div>
            <nav className="mt-6 flex-1 px-4 space-y-1 overflow-y-auto">
              {filteredNav.map((item) => {
                if (item.children) {
                  const isOpen = !!openSubmenus[item.name];
                  const hasActiveChild = item.children.some((child) => child.href && location.pathname === child.href);
                  return (
                    <div key={item.name} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleSubmenu(item.name)}
                        className={`w-full group flex items-center justify-between px-3 py-2 text-base font-medium rounded-lg transition-colors ${
                          hasActiveChild
                            ? 'text-primary-600 bg-primary-50/50 dark:bg-primary-950/20 dark:text-primary-400 font-semibold'
                            : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-350 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center">
                          <span className={`mr-4 ${hasActiveChild ? 'text-primary-600' : 'text-slate-400'}`}>
                            {getIcon(item.iconName)}
                          </span>
                          {item.name}
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                            isOpen ? 'transform rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="pl-4 space-y-1 mt-1 border-l border-slate-200 dark:border-slate-800 ml-6">
                          {item.children.map((child) => {
                            const isChildActive = child.href ? location.pathname === child.href : false;
                            return (
                              <Link
                                key={child.name}
                                to={child.href || '#'}
                                onClick={() => setSidebarOpen(false)}
                                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                                  isChildActive
                                    ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400 font-semibold'
                                    : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-350 dark:hover:bg-slate-800'
                                }`}
                              >
                                <span className={`mr-3 ${isChildActive ? 'text-primary-600' : 'text-slate-400'}`}>
                                  {getIcon(child.iconName)}
                                </span>
                                {child.name}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                const isActive = item.href ? location.pathname === item.href : false;
                return (
                  <Link
                    key={item.name}
                    to={item.href || '#'}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center px-3 py-2 text-base font-medium rounded-lg ${
                      isActive
                        ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400'
                        : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-350 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="mr-4 text-slate-400">{getIcon(item.iconName)}</span>
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-3 py-2 text-base font-medium text-red-650 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20 rounded-lg"
              >
                <LogOut className="mr-4 h-6 w-6" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="md:pl-64 flex flex-col flex-1 w-full min-h-screen">
        {/* Navbar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8">
          <button
            type="button"
            className="h-10 w-10 md:hidden flex items-center justify-center text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Right side items */}
          <div className="flex items-center ml-auto gap-4">
            {/* Global Help Button */}
            <HelpButton />

            {/* Quick 15 Themes Selector */}
            <select
              value={preferences.accentColor}
              onChange={(e) => updatePreference('accentColor', e.target.value as any)}
              className="hidden sm:block text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 transition-all shadow-sm cursor-pointer"
              title="Cambiar tema visual ERP"
            >
              <option value="light">☀️ Light</option>
              <option value="dark">🌙 Dark Obsidian</option>
              <option value="midnight">🌌 Midnight Indigo</option>
              <option value="emerald">🟢 Emerald Mint</option>
              <option value="ocean">🌊 Ocean Pacific</option>
              <option value="sapphire">🔷 Sapphire Royal</option>
              <option value="indigo">🔮 Linear Indigo</option>
              <option value="purple">💜 Purple Amethyst</option>
              <option value="rose">🌹 Rose Crimson</option>
              <option value="coffee">☕ Coffee Espresso</option>
              <option value="forest">🌲 Forest Pine</option>
              <option value="sunset">🌅 Sunset Amber</option>
              <option value="cyber">⚡ Cyber Cyan</option>
              <option value="slate">🔘 Slate SaaS</option>
              <option value="nord">❄️ Nord Polar</option>
            </select>

            {/* Theme switcher */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-450 dark:hover:bg-slate-800"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-950/50 flex items-center justify-center text-primary-700 dark:text-primary-350 font-bold uppercase text-sm">
                  {user?.name.slice(0, 2)}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{user?.name}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{user?.role}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-100 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 z-20 py-2">
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-sm font-semibold">{user?.name}</p>
                      <p className="text-xs text-slate-450 truncate">{user?.email}</p>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <User className="mr-3 h-4 w-4 text-slate-450" /> Mi Perfil
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 border-b border-slate-105 dark:border-slate-800"
                    >
                      <Settings className="mr-3 h-4 w-4 text-slate-450" /> Ajustes
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-4 py-2 text-sm text-red-650 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20 text-left"
                    >
                      <LogOut className="mr-3 h-4 w-4" /> Cerrar Sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content body */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 w-full">
          {children}
        </main>
      </div>
    </div>
  );
};
