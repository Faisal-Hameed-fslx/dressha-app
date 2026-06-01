import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import LuxuryBanner from '../components/Luxury/LuxuryBanner';
import LuxuryButton from '../components/Luxury/LuxuryButton';
import LuxuryCard from '../components/Luxury/LuxuryCard';
import LuxuryInput from '../components/Luxury/LuxuryInput';
import { useLanguage } from '../providers/LanguageProvider';
import { buildGoogleAuthRequestConfig, buildGoogleProxyStartUrl, discovery, exchangeGoogleCode, fetchGoogleAuthClientIds, GoogleAuthClientIds } from '../services/googleAuth';
import useAuthStore from '../store/auth';
import { useTheme } from '../theme/ThemeProvider';
import localHost from '../store/run';

const SignIn = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleClientIds, setGoogleClientIds] = useState<GoogleAuthClientIds | null>(null);
  const { login, setAuthFromServer, loading, error, setError, clearError } = useAuthStore();
  const useProxy = Constants.appOwnership === 'expo';
  const owner = Constants.expoConfig?.owner;
  const slug = Constants.expoConfig?.slug;
  const projectNameForProxy = owner && slug ? `@${owner}/${slug}` : undefined;

  // ✅ Build config (may be null initially, but that's fine)
  const authConfig = googleClientIds 
    ? buildGoogleAuthRequestConfig(useProxy, projectNameForProxy, googleClientIds) 
    : null;

  // ✅ Always call the hook at the top level - use a fallback config if needed
  // A default config with empty values - the hook will update when the real config becomes available
  const defaultConfig: AuthSession.AuthRequestConfig = {
    clientId: '',
    redirectUri: AuthSession.makeRedirectUri({ useProxy }),
    responseType: AuthSession.ResponseType.Code,
    scopes: ['openid', 'profile', 'email'],
    usePKCE: true,
  };

  // ✅ This hook is ALWAYS called, never conditionally
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    authConfig || defaultConfig,
    discovery
  );

  const appReturnUrl = AuthSession.getDefaultReturnUrl();
  const redirectUri = useProxy && projectNameForProxy 
    ? `https://auth.expo.io/${projectNameForProxy}` 
    : request?.redirectUri;

  useEffect(() => {
    let isMounted = true;

    const loadGoogleClientIds = async () => {
      try {
        console.log('📡 Fetching Google client IDs from:', `${localHost}/auth/google/config`);
        const ids = await fetchGoogleAuthClientIds();
        console.log('✅ Received client IDs:', JSON.stringify(ids, null, 2));
        
        if (isMounted) {
          setGoogleClientIds(ids);
          if (!ids.androidClientId) {
            console.warn('⚠️ Android client ID is missing from backend response!');
          } else {
            console.log('✅ Android client ID is present:', ids.androidClientId);
          }
        }
      } catch (error: any) {
        console.error('❌ Failed to load Google config:', error?.message);
        if (isMounted) {
          setError(error?.message || 'Failed to load Google auth config');
        }
      }
    };

    loadGoogleClientIds();

    return () => {
      isMounted = false;
    };
  }, [setError]);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    try {
      clearError();
      await login(email, password);
      navigation.navigate('Tabs' as never);
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!request || !promptAsync) {
      setError('Google Sign-In is initializing. Please try again.');
      return;
    }
    
    try {
      clearError();
      
      const promptOptions: any = { useProxy };
      if (useProxy && projectNameForProxy) {
        promptOptions.projectNameForProxy = projectNameForProxy;
      }

      let promptRequestUrl: string | undefined;
      if (useProxy && projectNameForProxy && request.url) {
        promptRequestUrl = buildGoogleProxyStartUrl({
          authUrl: request.url,
          returnUrl: appReturnUrl,
          projectNameForProxy,
        });
        (request as any).redirectUri = appReturnUrl;
      }

      const result = promptRequestUrl ? await promptAsync({ url: promptRequestUrl }) : await promptAsync();

      if (result.type !== 'success') {
        if (result.type === 'error') {
          throw new Error(result.error?.description || result.errorCode || 'Google Sign-In failed');
        }
        return;
      }

      const code = result.params?.code;
      if (!code) {
        throw new Error('Google did not return an authorization code');
      }

      const serverResponse = await exchangeGoogleCode({
        code,
        codeVerifier: request.codeVerifier,
        redirectUri: redirectUri || request.redirectUri,
        clientId: request.clientId,
      });

      await setAuthFromServer(serverResponse);
      navigation.navigate('Tabs' as never);
    } catch (error: any) {
      setError(error.message || 'Google Sign-In failed');
    }
  };

  // Check if Google button should be enabled (has a valid clientId)
  const isGoogleEnabled = !!(request && request.clientId && request.clientId.length > 0);

  return (
    <View className="flex-1 justify-center p-4" style={{ backgroundColor: theme.colors.background }}>
      <Text className="mb-6 text-center font-display text-5xl tracking-luxury" style={{ color: theme.colors.primary }}>{t('signInTitle')}</Text>
      {error ? <LuxuryBanner tone="error" text={error} className="mb-4" /> : null}
      <LuxuryCard className="p-4">
          <LuxuryInput
          containerClassName="mb-4"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder={t('emailPlaceholder')}
        />
        <LuxuryInput
          containerClassName="mb-4"
          value={password}
          onChangeText={setPassword}
          placeholder={t('passwordPlaceholder')}
          secureTextEntry
        />
        <LuxuryButton label={t('signInButton')} variant="gold" onPress={handleSignIn} className="mb-4" />
        
        <View className="mb-4 flex-row items-center">
          <View className="flex-1 border-t" style={{ borderColor: theme.colors.muted }} />
          <Text className="mx-2" style={{ color: theme.colors.muted }}>{t('orWord')}</Text>
          <View className="flex-1 border-t" style={{ borderColor: theme.colors.muted }} />
        </View>

        <TouchableOpacity
          onPress={handleGoogleSignIn}
          disabled={loading || !isGoogleEnabled}
          className="mb-4 flex-row items-center justify-center rounded-lg border py-3"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.accent }}
        >
          {(loading || !isGoogleEnabled) ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (
            <>
              <Ionicons name="logo-google" size={24} color={theme.colors.accent} />
              <Text className="font-semibold ml-2" style={{ color: theme.colors.primary }}>{t('signInWithGoogle')}</Text>
            </>
          )}
        </TouchableOpacity>

        <View className="flex-row items-center justify-center">
          <Text style={{ color: theme.colors.muted }}>{t('noAccountQuestion')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp' as never)}>
            <Text className="ml-1 font-bold" style={{ color: theme.colors.accent }}>{t('signUpLink')}</Text>
          </TouchableOpacity>
        </View>
      </LuxuryCard>
    </View>
  );
};

export default SignIn;