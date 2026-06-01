import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { Platform, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import './global.css';
import RootNavigator from './navigation/RootNavigator';
import { LanguageProvider } from './providers/LanguageProvider';
import useAuthStore from './store/auth';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';

WebBrowser.maybeCompleteAuthSession();

// Configure notifications - FIXED
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,    // ✅ Use this instead of shouldShowAlert
    shouldShowList: true,      // ✅ Required property
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  }).catch(() => {});
}

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        await useAuthStore.getState().initalizeAuth();
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        setIsReady(true);
      }
    };
    initialize();
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
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