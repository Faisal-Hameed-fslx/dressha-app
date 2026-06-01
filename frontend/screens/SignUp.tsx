import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import LuxuryBanner from '../components/Luxury/LuxuryBanner';
import LuxuryButton from '../components/Luxury/LuxuryButton';
import LuxuryCard from '../components/Luxury/LuxuryCard';
import LuxuryInput from '../components/Luxury/LuxuryInput';
import { useLanguage } from '../providers/LanguageProvider';
import { buildGoogleAuthRequestConfig, discovery, exchangeGoogleCode } from '../services/googleAuth';
import useAuthStore from '../store/auth';
import { useTheme } from '../theme/ThemeProvider';



const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [profilePicture, setProfilePicture] = useState<{
    uri: string;
    name: string;
    type: string;
  } | null>(null);
  const [gender, setGender] = useState('');
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { signup, setAuthFromServer, loading, error, setError, clearError } = useAuthStore();
  const useProxy = Constants.appOwnership === 'expo';
  const [request, , promptAsync] = AuthSession.useAuthRequest(buildGoogleAuthRequestConfig(useProxy), discovery);

  const handleSignUp = async () => {
    if (!email || !password || !username) {
      setError(t('fillRequiredFields'));
      Alert.alert(t('errorTitle'), t('fillRequiredFields'));
      return;
    }
    try {
      clearError();
      await signup(email, password, username, gender, profilePicture);
    } catch (error: any) {
      setError(error.message || t('signUpFailed'));
      Alert.alert(t('errorTitle'), error.message || t('signUpFailed'));
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      clearError();
      if (!request) {
        throw new Error('Google auth request is still loading');
      }

      const result = await promptAsync({ useProxy } as any);

      if (result.type !== 'success') {
        if (result.type === 'error') {
          throw new Error(result.error?.description || result.errorCode || t('googleSignUpFailed'));
        }
        return;
      }

      const code = result.params?.code;
      if (!code) {
        throw new Error(t('googleNoCode'));
      }

      const serverResponse = await exchangeGoogleCode({
        code,
        codeVerifier: request.codeVerifier,
        redirectUri: request.redirectUri,
        clientId: request.clientId,
      });

      await setAuthFromServer(serverResponse);
      navigation.navigate('HomePage' as never);
    } catch (error: any) {
      setError(error.message || t('googleSignUpFailed'));
      Alert.alert(t('errorTitle'), error.message || t('googleSignUpFailed'));
    }
  };
const pickImage = useCallback(async () => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      const asset = result.assets[0];

      setProfilePicture({
        uri: asset.uri,
        name: 'profile.jpg',
        type: 'image/jpeg',
      });
    }
  } catch (err) {
    console.error('Image picker error:', err);
    setError('Failed to pick image');
  }
}, [setError]);

  return (
    <View className="flex-1 justify-center p-4" style={{ backgroundColor: theme.colors.background }}>
      <Text className="mb-6 text-center font-display text-5xl tracking-luxury" style={{ color: theme.colors.primary }}>{t('signUpButton')}</Text>
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
        <LuxuryInput
          containerClassName="mb-4"
          value={username}
          onChangeText={setUsername}
          placeholder={t('usernamePlaceholder')}
        />
        <LuxuryInput
          containerClassName="mb-4"
          value={gender}
          onChangeText={setGender}
          placeholder={t('genderPlaceholder')}
        />
        <TouchableOpacity onPress={pickImage} className="mx-auto mb-6 h-[150] w-[150] rounded-full border shadow-lg overflow-hidden" style={{ borderColor: theme.colors.muted, backgroundColor: theme.colors.card }}>
          {profilePicture?.uri ? (
            <Image source={{ uri: profilePicture.uri }} className="h-full w-full" resizeMode="cover" />
          ) : (
              <View className="h-full items-center justify-center">
              <MaterialCommunityIcons name="camera-plus-outline" size={40} color={theme.colors.muted} />
              <Text className="text-[10px] mt-1" style={{ color: theme.colors.muted }}>{t('uploadPhotoLabel')}</Text>
            </View>
          )}
        </TouchableOpacity>
        <LuxuryButton label={t('signUpButton')} variant="gold" onPress={handleSignUp} className="mb-4" />

        <View className="mb-4 flex-row items-center">
          <View className="flex-1 border-t" style={{ borderColor: theme.colors.muted }} />
          <Text className="mx-2" style={{ color: theme.colors.muted }}>{t('orWord')}</Text>
          <View className="flex-1 border-t" style={{ borderColor: theme.colors.muted }} />
        </View>

        <TouchableOpacity
          onPress={handleGoogleSignUp}
          disabled={loading}
          className="mb-4 flex-row items-center justify-center rounded-lg border py-3"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.accent }}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (
            <>
              <Ionicons name="logo-google" size={24} color={theme.colors.accent} />
              <Text className="font-semibold" style={{ color: theme.colors.primary }}>{t('signUpWithGoogle')}</Text>
            </>
          )}
        </TouchableOpacity>

        <View className="flex-row items-center justify-center">
          <Text style={{ color: theme.colors.muted }}>{t('alreadyHaveAccountQuestion')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignIn' as never)}>
            <Text className="ml-1 font-bold" style={{ color: theme.colors.accent }}>{t('signInLink')}</Text>
          </TouchableOpacity>
        </View>
      </LuxuryCard>
    </View>
  );
}

export default SignUp