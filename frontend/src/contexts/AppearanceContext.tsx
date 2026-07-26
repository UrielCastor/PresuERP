import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark';
export type AccentColor = 
  | 'light' 
  | 'dark' 
  | 'midnight' 
  | 'emerald' 
  | 'ocean' 
  | 'sapphire' 
  | 'indigo' 
  | 'purple' 
  | 'rose' 
  | 'coffee' 
  | 'forest' 
  | 'sunset' 
  | 'cyber' 
  | 'slate' 
  | 'nord';
export type InterfaceDensity = 'compact' | 'normal' | 'wide';
export type BorderStyle = 'rounded' | 'medium' | 'square';
export type FontSize = 'small' | 'normal' | 'large';

export interface AppearancePreferences {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  density: InterfaceDensity;
  borders: BorderStyle;
  animations: boolean;
  fontSize: FontSize;
}

interface AppearanceContextType {
  preferences: AppearancePreferences;
  setPreferences: React.Dispatch<React.SetStateAction<AppearancePreferences>>;
  updatePreference: <K extends keyof AppearancePreferences>(key: K, value: AppearancePreferences[K]) => void;
}

const defaultPreferences: AppearancePreferences = {
  themeMode: 'dark',
  accentColor: 'indigo',
  density: 'normal',
  borders: 'medium',
  animations: true,
  fontSize: 'normal',
};

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<AppearancePreferences>(() => {
    try {
      const stored = localStorage.getItem('presuerp-appearance');
      if (stored) {
        return { ...defaultPreferences, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to parse appearance preferences from localStorage', e);
    }
    return defaultPreferences;
  });

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('presuerp-appearance', JSON.stringify(preferences));

    // Apply styles to document element
    const htmlEl = document.documentElement;

    // Remove former classes
    const classesToRemove: string[] = [];
    htmlEl.classList.forEach((cls) => {
      if (
        cls === 'dark' ||
        cls.startsWith('theme-') ||
        cls.startsWith('density-') ||
        cls.startsWith('borders-') ||
        cls.startsWith('font-size-') ||
        cls === 'animations-disabled'
      ) {
        classesToRemove.push(cls);
      }
    });
    classesToRemove.forEach((cls) => htmlEl.classList.remove(cls));

    // Add new classes
    if (preferences.themeMode === 'dark') {
      htmlEl.classList.add('dark');
    }
    htmlEl.classList.add(`theme-${preferences.accentColor}`);
    htmlEl.classList.add(`density-${preferences.density}`);
    if (preferences.borders !== 'medium') {
      htmlEl.classList.add(`borders-${preferences.borders}`);
    }
    if (preferences.fontSize !== 'normal') {
      htmlEl.classList.add(`font-size-${preferences.fontSize}`);
    }
    if (!preferences.animations) {
      htmlEl.classList.add('animations-disabled');
    }
  }, [preferences]);

  const updatePreference = <K extends keyof AppearancePreferences>(key: K, value: AppearancePreferences[K]) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'accentColor') {
        const lightThemes = ['light', 'slate'];
        next.themeMode = lightThemes.includes(value as string) ? 'light' : 'dark';
      }
      return next;
    });
  };

  return (
    <AppearanceContext.Provider value={{ preferences, setPreferences, updatePreference }}>
      {children}
    </AppearanceContext.Provider>
  );
};

export const useAppearance = () => {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return context;
};
