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

export const buildGoogleAuthRequestConfig = (useProxy: boolean, projectNameForProxy?: string) => {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;


  if (!webClientId) {
    throw new Error('Missing Google web client ID in env');
  }

  const nativeSchemeRaw =
    Constants.expoConfig?.android?.package || Constants.expoConfig?.scheme || 'com.malikawang.dressha';
  const nativeScheme = Array.isArray(nativeSchemeRaw) ? nativeSchemeRaw[0] : nativeSchemeRaw;
  const nativeRedirectUri = `${nativeScheme}://`;

  const proxyProjectName = projectNameForProxy ?? '@malikawang/dressha-app';
  const proxyRedirectUri = `https://auth.expo.io/${proxyProjectName}`;
  const hasAndroidClientId = !!androidClientId && androidClientId !== 'your-new-android-client-id';


  const redirectUri = useProxy
    ? proxyRedirectUri
    : AuthSession.makeRedirectUri({ native: nativeRedirectUri, scheme: nativeScheme as string } as any);

  if (!useProxy && Platform.OS === 'android' && !hasAndroidClientId) {
    throw new Error(
      'Missing EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID. Native Android sign-in requires an Android OAuth client ID in Google Cloud Console.'
    );
  }

  const clientId = useProxy ? webClientId : Platform.OS === 'android' ? androidClientId : webClientId;

  if (useProxy && !webClientId) {
    throw new Error('Google auth config error: missing Web client ID for Expo Go (useProxy). Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
  }

  // Native Android builds must use an Android client ID; do not silently fall back to web.


  return {
    clientId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ['openid', 'profile', 'email'],
    usePKCE: true,
    shouldAutoExchangeCode: false,
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
