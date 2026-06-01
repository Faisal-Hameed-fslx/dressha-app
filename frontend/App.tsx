
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect } from 'react';
import { Platform, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import './global.css';
import RootNavigator from './navigation/RootNavigator';
import { LanguageProvider } from './providers/LanguageProvider';
import useAuthStore from './store/auth';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';

WebBrowser.maybeCompleteAuthSession();


export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AppShell />
          </LanguageProvider>
        </ThemeProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

function AppShell() {
  const { theme } = useTheme();
  const navigationTheme = theme.name === 'scandi-dark'
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: theme.colors.background,
          card: theme.colors.card,
          text: theme.colors.primary,
          border: theme.colors.card,
          primary: theme.colors.accent,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.colors.background,
          card: theme.colors.card,
          text: theme.colors.primary,
          border: theme.colors.card,
          primary: theme.colors.accent,
        },
      };

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.colors.background} translucent={false} />
      <RootNavigator />
    </NavigationContainer>
  );
}

// Initialize auth on app start so token/user are available before screens mount
function InitAuth() {
  useEffect(() => {
    try {
      useAuthStore.getState().initalizeAuth();
    } catch (e) {
      console.warn('Auth init failed', e);
    }
  }, []);
  return null;
}

// Configure notification handler and Android channel
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Create Android channel if needed (best-effort)
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  }).catch(() => {});
}
