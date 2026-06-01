import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { ActivityIndicator, Animated, Image, StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { warmupMobileModels } from '../services/mobileModelRuntime';
import useAuthStore from '../store/auth';
import { useTheme } from '../theme/ThemeProvider';

const SplashScreen = () => {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { isAuthenticated } = useAuthStore();
  const token = useAuthStore.getState().token;
  const fade = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    const fade = new Animated.Value(0);

    // Warm models in background during splash to reduce perceived latency
    (async () => {
      try {
        if (token) await warmupMobileModels(token);
      } catch {
        // ignore
      }
    })();

    const run = async () => {
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();

      const seen = await AsyncStorage.getItem('hasSeenOnboarding');
      const waitMs = 2000; // longer, professional pause
      const t = setTimeout(() => {
        if (!mounted) return;
        if (!seen) navigation.replace('Onboarding');
        else if (isAuthenticated) navigation.replace('Tabs');
        else navigation.replace('SignIn');
      }, waitMs);

      return () => clearTimeout(t);
    };

    run();

    return () => {
      mounted = false;
    };
  }, [navigation, isAuthenticated, token]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.colors.background} translucent={false} />
      <Animated.View style={{ alignItems: 'center', opacity: fade }}>
        <Image source={require('../assets/splash.png')} style={{ width: 140, height: 140, marginBottom: 18, resizeMode: 'contain' }} />
        <Text style={{ color: theme.colors.primary, fontSize: 20, fontWeight: '800' }}>Dressha</Text>
        <View style={{ height: 18 }} />
        <ActivityIndicator size="small" color={theme.colors.accent} />
      </Animated.View>
    </SafeAreaView>
  );
};

export default SplashScreen;
