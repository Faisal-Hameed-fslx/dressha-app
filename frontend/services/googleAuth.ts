import axios from 'axios';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import localHost from './../store/run';

WebBrowser.maybeCompleteAuthSession();

export const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};
const baseUrl = localHost;

export type GoogleAuthClientIds = {
  webClientId: string | null;
  androidClientId: string | null;
};

export const fetchGoogleAuthClientIds = async (): Promise<GoogleAuthClientIds> => {
  console.log('📡 Fetching Google client IDs from:', `${baseUrl}/auth/google/config`);
  const response = await axios.get(`${baseUrl}/auth/google/config`);
  console.log('✅ Google config response:', response.data);
  return response.data as GoogleAuthClientIds;
};

export const initGoogleSignIn = async () => {
  // No-op for expo-auth-session; WebBrowser.maybeCompleteAuthSession already handled.
  return;
};

export const buildGoogleProxyStartUrl = ({
  authUrl,
  returnUrl,
  projectNameForProxy,
}: {
  authUrl: string;
  returnUrl: string;
  projectNameForProxy: string;
}) => {
  const proxyBaseUrl = `https://auth.expo.io/${projectNameForProxy}`;

  const parsedAuthUrl = new URL(authUrl);
  parsedAuthUrl.searchParams.set('redirect_uri', proxyBaseUrl);

  const queryString = new URLSearchParams({
    authUrl: parsedAuthUrl.toString(),
    returnUrl,
  });

  return `${proxyBaseUrl}/start?${queryString.toString()}`;
};

export const buildGoogleAuthRequestConfig = (
  useProxy: boolean,
  projectNameForProxy?: string,
  clientIds?: GoogleAuthClientIds | null,
): AuthSession.AuthRequestConfig | null => {
  console.log('🔧 buildGoogleAuthRequestConfig called with:', {
    useProxy,
    projectNameForProxy,
    clientIds: clientIds ? {
      webClientId: clientIds.webClientId ? `${clientIds.webClientId.substring(0, 20)}...` : null,
      androidClientId: clientIds.androidClientId ? `${clientIds.androidClientId.substring(0, 20)}...` : null,
    } : null,
  });

  const webClientId = clientIds?.webClientId || '';
  const androidClientId = clientIds?.androidClientId || '';

  const nativeSchemeRaw =
    Constants.expoConfig?.android?.package || Constants.expoConfig?.scheme || 'com.malikawang.dressha';
  const nativeScheme = Array.isArray(nativeSchemeRaw) ? nativeSchemeRaw[0] : nativeSchemeRaw;
  const nativeRedirectUri = `${nativeScheme}://`;

  const proxyProjectName = projectNameForProxy ?? '@malikawang/dressha-app';
  const proxyRedirectUri = `https://auth.expo.io/${proxyProjectName}`;
  
  // FIXED: Better check for valid Android client ID
  const hasAndroidClientId = !!(androidClientId && 
    androidClientId !== 'your-new-android-client-id' && 
    androidClientId.length > 10);

  console.log('🔧 Android client ID check:', {
    androidClientId: androidClientId ? `${androidClientId.substring(0, 20)}...` : 'missing',
    hasAndroidClientId,
    useProxy,
    platform: Platform.OS,
  });

  if (useProxy && !webClientId) {
    console.log('❌ Returning null: useProxy true but no webClientId');
    return null;
  }

  const redirectUri = useProxy
    ? proxyRedirectUri
    : AuthSession.makeRedirectUri({ native: nativeRedirectUri, scheme: nativeScheme as string });

  // FIXED: For native Android builds, if we don't have Android client ID, return null instead of throwing
  // This will disable Google Sign-In button gracefully
  if (!useProxy && Platform.OS === 'android' && !hasAndroidClientId) {
    console.warn('⚠️ Missing Google Android client ID - Google Sign-In will be disabled for native Android');
    return null; // Return null instead of throwing error
  }

  const clientId = useProxy ? webClientId : Platform.OS === 'android' ? androidClientId : webClientId;

  if (!useProxy && Platform.OS !== 'android' && !webClientId) {
    console.warn('⚠️ Missing Google web client ID - Google Sign-In will be disabled');
    return null;
  }

  if (!clientId) {
    console.warn('⚠️ No valid client ID found - Google Sign-In will be disabled');
    return null;
  }

  console.log('✅ Returning Google auth config with clientId:', `${clientId.substring(0, 20)}...`);
  
  return {
    clientId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ['openid', 'profile', 'email'],
    usePKCE: true,
  };
};

export const exchangeGoogleCode = async ({
  code,
  codeVerifier,
  redirectUri,
  clientId,
}: {
  code: string;
  codeVerifier?: string;
  redirectUri: string;
  clientId?: string;
}) => {
  const response = await axios.post(`${baseUrl}/auth/google/code`, {
    code,
    codeVerifier,
    redirectUri,
    clientId,
  });

  return response.data;
};

export const signInWithGoogle = async (): Promise<any | null> => {
  throw new Error('Use useAuthRequest in the sign-in screen for Expo Go authentication.');
};

export const signUpWithGoogle = signInWithGoogle;

export const signOutGoogle = async () => {
  // No persistent Google client-side session to clear when using expo-auth-session proxy.
  return;
};

export const getCurrentGoogleUser = async () => null;