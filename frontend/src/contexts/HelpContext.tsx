import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { helpRegistry, HelpInfo } from '../constants/helpRegistry';
import { X, HelpCircle, BookOpen, HelpCircle as QuestionIcon, Lightbulb, CheckCircle2, ChevronRight, HelpCircle as FaqIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';

interface HelpContextType {
  openHelp: (key?: string) => void;
  closeHelp: () => void;
  isHelpOpen: boolean;
  helpInfo: HelpInfo | null;
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

export const HelpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'guide' | 'faq' | 'tips'>('guide');

  // Infer the default help key based on route path
  const getHelpKeyFromPath = (path: string): string => {
    if (path.startsWith('/settings/company')) return '/settings/company';
    if (path.startsWith('/settings')) return '/settings';
    return path;
  };

  useEffect(() => {
    setActiveKey(getHelpKeyFromPath(location.pathname));
  }, [location.pathname]);

  const openHelp = (key?: string) => {
    if (key) {
      setActiveKey(key);
    } else {
      setActiveKey(getHelpKeyFromPath(location.pathname));
    }
    setActiveTab('guide');
    setIsHelpOpen(true);
  };

  const closeHelp = () => {
    setIsHelpOpen(false);
  };

  const helpInfo = helpRegistry[activeKey] || null;

  return (
    <HelpContext.Provider value={{ openHelp, closeHelp, isHelpOpen, helpInfo }}>
      {children}
      {isHelpOpen && helpInfo && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Backdrop/Overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/30 dark:bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={closeHelp}
          />
          {/* Side Drawer Panel */}
          <div className="relative bg-white dark:bg-slate-900 w-[380px] sm:w-[420px] max-w-full h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-200 z-10">
            
            {/* Drawer Header */}
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary-50 dark:bg-primary-955/40 text-primary-500 rounded-xl">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                    Ayuda Contextual
                  </h3>
                  <p className="text-[10px] font-bold text-slate-450 dark:text-slate-400">
                    Módulo: {helpInfo.moduleName}
                  </p>
                </div>
              </div>
              <button
                onClick={closeHelp}
                className="p-1.5 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Sub-Header / Intro */}
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <h4 className="text-xs font-bold text-slate-850 dark:text-white mb-0.5">{helpInfo.title}</h4>
              <p className="text-[11px] text-slate-555 dark:text-slate-405 leading-relaxed font-medium">
                {helpInfo.description}
              </p>
            </div>

            {/* Navigation Tabs */}
            <div className="px-5 border-b border-slate-100 dark:border-slate-800 flex gap-4 bg-slate-50/50 dark:bg-slate-900">
              <button
                onClick={() => setActiveTab('guide')}
                className={`py-3 text-[11px] font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'guide'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Flujo
              </button>
              <button
                onClick={() => setActiveTab('faq')}
                className={`py-3 text-[11px] font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'faq'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <FaqIcon className="h-3.5 w-3.5" />
                Dudas
              </button>
              <button
                onClick={() => setActiveTab('tips')}
                className={`py-3 text-[11px] font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'tips'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Lightbulb className="h-3.5 w-3.5" />
                Consejos ({helpInfo.quickTips.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-5 flex-1 overflow-y-auto bg-white dark:bg-slate-900">
              {activeTab === 'guide' && (
                <div className="space-y-5">
                  <h5 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Flujo paso a paso</h5>
                  
                  {/* Flow Map Visualizer */}
                  <div className="space-y-2 mb-4">
                    {helpInfo.guideSteps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/50 dark:border-slate-800/80">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-950 text-[10px] font-bold text-primary-700 dark:text-primary-400">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Flow step descriptions */}
                  <div className="relative border-l border-slate-200 dark:border-slate-800 ml-3 pl-4 space-y-4">
                    {helpInfo.guideSteps.map((step, idx) => (
                      <div className="relative" key={idx}>
                        <span className="absolute -left-[22px] top-1.5 flex h-2 w-2 rounded-full bg-white dark:bg-slate-900 border-2 border-primary-500" />
                        <h6 className="text-xs font-bold text-slate-900 dark:text-white mb-0.5">
                          {idx + 1}. {step.label}
                        </h6>
                        {step.description && (
                          <p className="text-[11px] text-slate-555 dark:text-slate-400 font-medium leading-relaxed">
                            {step.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'faq' && (
                <div className="space-y-3.5">
                  <h5 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Preguntas frecuentes</h5>
                  {helpInfo.faqs.length === 0 ? (
                    <p className="text-xs text-slate-550 italic">No hay preguntas registradas para este módulo.</p>
                  ) : (
                    helpInfo.faqs.map((faq, idx) => (
                      <div key={idx} className="p-3 bg-slate-50/50 dark:bg-slate-955/10 border border-slate-150 dark:border-slate-850 rounded-xl space-y-1.5">
                        <div className="flex gap-2">
                          <QuestionIcon className="h-4 w-4 text-primary-500 shrink-0 mt-0.5" />
                          <h6 className="text-xs font-bold text-slate-850 dark:text-white leading-normal">
                            {faq.question}
                          </h6>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium pl-6">
                          {faq.answer}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'tips' && (
                <div className="space-y-3">
                  <h5 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Consejos útiles</h5>
                  {helpInfo.quickTips.map((tip, idx) => (
                    <div key={idx} className="flex gap-2.5 p-3 bg-amber-50/40 dark:bg-amber-955/10 border border-amber-100 dark:border-amber-950/20 rounded-xl">
                      <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                      <p className="text-[11px] text-slate-650 dark:text-slate-350 font-medium leading-relaxed">
                        {tip}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-900">
              <Button onClick={closeHelp} variant="outline" size="sm" className="font-bold">
                Cerrar Ayuda
              </Button>
            </div>
          </div>
        </div>
      )}
    </HelpContext.Provider>
  );
};

export const useHelp = (): HelpContextType => {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error('useHelp debe usarse dentro de un HelpProvider');
  }
  return context;
};
