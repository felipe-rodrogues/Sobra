import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeColors, darkTheme, lightTheme } from '../theme/colors';

interface ThemeContextType {
  mode: 'dark' | 'light';
  toggleTheme: () => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  toggleTheme: () => {},
  colors: darkTheme,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('sobra_theme_mode');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark'; // Dark mode padrão fintech
  });

  const toggleTheme = () => {
    setMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('sobra_theme_mode', next);
      }
      return next;
    });
  };

  const colors = mode === 'dark' ? darkTheme : lightTheme;

  useEffect(() => {
    document.body.style.backgroundColor = colors.background;
    document.body.style.color = colors.textPrimary;
  }, [colors]);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
