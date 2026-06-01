import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, StatusBarStyle, useColorScheme } from 'react-native';

// ThemeProvider
// ----------------
// Centralized theme tokens for the app. Exposes two named modes:
// - 'scandi-light' — light-background, dark primary text, warm accent
// - 'scandi-dark'  — dark-background, light primary text, same warm accent
//
// Behavior:
// - The `ThemeProvider` persists the selected mode to AsyncStorage under `STORAGE_KEY` so
//   the user's choice survives restarts.
// - `useTheme()` gives access to `{ theme, mode, setMode, toggle }`.
// - `theme.colors` are plain hex strings and should be used directly for inline styles,
//   or converted to rgba for translucent overlays.
//
// Implementation notes:
// - Keep tokens minimal (background, primary, accent, muted, card) so it's easy to
//   propagate across components. Add more tokens as needed (e.g., success/warning).
// - Status bar style is provided per-theme so top-level screens can call
//   `StatusBar` with `theme.statusBarStyle`.

export type ThemeMode = 'scandi-light' | 'scandi-dark' | 'system';

export const scandiLight = {
  name: 'scandi-light',
  colors: {
    background: '#F4F4F4',
    primary: '#1E1E1E',
    accent: '#FF8A65',
    muted: '#9E9E9E',
    card: '#FFFFFF',
  },
  statusBarStyle: 'dark-content' as StatusBarStyle,
};

export const scandiDark = {
  name: 'scandi-dark',
  colors: {
    background: '#121212',
    primary: '#F4F4F4',
    accent: '#FF8A65',
    muted: '#8A8A8A',
    card: '#1E1E1E',
  },
  statusBarStyle: 'light-content' as StatusBarStyle,
};

type Theme = typeof scandiLight;

type ThemeContextShape = {
  theme: Theme;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
};

const STORAGE_KEY = '@dressha_theme_mode';

const ThemeContext = createContext<ThemeContextShape | undefined>(undefined);

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [appearanceScheme, setAppearanceScheme] = useState<'light' | 'dark' | null>(
    Appearance.getColorScheme() === 'dark'
      ? 'dark'
      : Appearance.getColorScheme() === 'light'
        ? 'light'
        : null
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setAppearanceScheme(colorScheme === 'dark' ? 'dark' : colorScheme === 'light' ? 'light' : null);
    });

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'scandi-dark' || stored === 'scandi-light' || stored === 'system') {
          setModeState(stored);
        } else {
          setModeState('system');
        }
      } catch (e) {
        console.log('Failed to load theme mode from storage', e);
      }
    })();

    return () => {
      subscription.remove();
    };
  }, []);

  const setMode = async (m: ThemeMode) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, m);
    } catch (e) {
      console.log('Failed to save theme mode to storage', e);
    }
    setModeState(m);
  };

  const resolvedMode: Exclude<ThemeMode, 'system'> =
    mode === 'system' ? ((appearanceScheme ?? systemScheme) === 'dark' ? 'scandi-dark' : 'scandi-light') : mode;

  const toggle = () => setMode(resolvedMode === 'scandi-light' ? 'scandi-dark' : 'scandi-light');

  const theme = resolvedMode === 'scandi-light' ? scandiLight : scandiDark;

  return <ThemeContext.Provider value={{ theme, mode, setMode, toggle }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const c = useContext(ThemeContext);
  if (!c) throw new Error('useTheme must be used inside ThemeProvider');
  return c;
};
