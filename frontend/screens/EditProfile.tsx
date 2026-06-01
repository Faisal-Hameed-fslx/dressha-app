import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LuxuryBanner from '../components/Luxury/LuxuryBanner';
import LuxuryButton from '../components/Luxury/LuxuryButton';
import LuxuryCard from '../components/Luxury/LuxuryCard';
import LuxuryInput from '../components/Luxury/LuxuryInput';
import { useLanguage } from '../providers/LanguageProvider';
import useAuthStore from '../store/auth';
import { useTheme } from '../theme/ThemeProvider';


const EditProfile = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user, updateProfile, checkUsernameAvailability } = useAuthStore();
  const [profileName, setProfileName] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('');
  const [bannerText, setBannerText] = useState('');
  const [bannerTone, setBannerTone] = useState<'success' | 'error'>('success');
  const [saving, setSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(true);

  type ProfileImage = {
    uri: string;
    name: string;
    type: string;
  } | null;

  const [image, setImage] = useState<ProfileImage>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      // FIXED: guard against undefined values causing uncontrolled input warnings
      setProfileName(user.profileName || '');
      setUsername(user.username || '');
      setGender(user.gender || '');
      if (user.profilePicture) {
        setImage({ uri: user.profilePicture, name: 'profile.jpg', type: 'image/jpeg' });
      }
    }
  }, [user]);

  // Username availability checker
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      const trimmed = username.trim();
      const current = (user?.username || '').trim();

      if (!trimmed || trimmed.toLowerCase() === current.toLowerCase()) {
        setIsUsernameAvailable(true);
        setIsChecking(false);
        setBannerText((prev) => (prev === 'This username is already taken.' ? '' : prev));
        return;
      }

      setIsChecking(true);
      try {
        const available = await checkUsernameAvailability(trimmed);
        setIsUsernameAvailable(available);
        if (!available) {
          setBannerTone('error');
          setBannerText('This username is already taken.');
        } else {
          setBannerText((prev) => (prev === 'This username is already taken.' ? '' : prev));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [username, user?.username, checkUsernameAvailability]);

  const handleSave = async () => {
    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setBannerTone('error');
      setBannerText('Username cannot be empty.');
      return;
    }

    if (!isUsernameAvailable) return;

    setSaving(true);
    setBannerText('');

    try {
      const formData = new FormData();

      formData.append('profileName', profileName.trim());
      formData.append('username', trimmedUsername);
      formData.append('gender', gender.trim());

      // Only append image if it's a new local file (not an existing HTTP URL)
      if (image?.uri && !image.uri.startsWith('http')) {
        formData.append('profilePicture', {
          uri: image.uri,
          name: image.name || 'profile.jpg',
          type: image.type || 'image/jpeg',
        } as any);
      }

      const res = await updateProfile(formData);

      // If backend returns updated user with Cloudinary URL, sync local image state
      if (res?.profilePicture) {
        setImage({
          uri: res.profilePicture,
          name: 'profile.jpg',
          type: 'image/jpeg',
        });
      }

      setBannerTone('success');
      setBannerText('Profile updated successfully.');
    } catch (error: any) {
      setBannerTone('error');
      setBannerText(error?.response?.data?.error || error.message || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = useCallback(async () => {
    try {
      setError(null);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        setImage({
          uri: asset.uri,
          name: 'profile.jpg',
          type: 'image/jpeg',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to pick image');
    }
  }, []);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
      <View className="px-4 pt-2">
          <View className="mb-5 flex-row items-center justify-between">
            <Pressable onPress={() => navigation.goBack()} className="h-11 w-11 items-center justify-center">
              <Ionicons name="arrow-back" size={24} color="#C6A962" />
            </Pressable>
            <Text className="font-display text-3xl tracking-luxury text-luxury-ivory">{t('editProfileTitle')}</Text>
            <View className="h-11 w-11" />
          </View>
          </View>
        <Text className="mt-2 text-center text-sm text-luxury-platinum">{t('editProfileSubtitle')}</Text>

        {bannerText ? <LuxuryBanner tone={bannerTone} text={bannerText} className="mt-5" /> : null}
        {error && <LuxuryBanner tone="error" text={error} className="mt-5" />}

        <LuxuryCard className="mt-5 p-4">
          <LuxuryInput
            label={t('displayNameLabel')}
            containerClassName="mb-4"
            value={profileName}
            onChangeText={setProfileName}
            placeholder={t('displayNamePlaceholder')}
          />

          <View className="relative">
            <LuxuryInput
              label={t('usernameLabel')}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              style={{
                borderColor: !username || username.trim().toLowerCase() === (user?.username || '').trim().toLowerCase()
                  ? 'transparent'
                  : isUsernameAvailable ? '#10b981' : '#ef4444',
                borderWidth: 1,
              }}
            />

            <View className="absolute right-4" style={{ top: '40%', marginTop: 4 }}>
              {isChecking ? (
                <ActivityIndicator size="small" color="#A89F91" />
              ) : username.trim() && username.trim().toLowerCase() !== (user?.username || '').trim().toLowerCase() ? (
                <MaterialCommunityIcons
                  name={isUsernameAvailable ? 'check-circle' : 'close-circle'}
                  size={22}
                  color={isUsernameAvailable ? '#10b981' : '#ef4444'}
                />
              ) : null}
            </View>
          </View>

          <LuxuryInput
            label={t('genderLabelShort')}
            containerClassName="mb-4"
            value={gender}
            onChangeText={setGender}
            placeholder={t('genderPlaceholder')}
          />

          <TouchableOpacity
            onPress={pickImage}
            className="mx-auto mb-6 h-[150] w-[150] rounded-full border border-white/10 bg-luxury-charcoal shadow-lg overflow-hidden"
          >
            {image?.uri ? (
              <Image source={{ uri: image.uri }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <View className="h-full items-center justify-center">
                <MaterialCommunityIcons name="camera-plus-outline" size={40} color="#A89F91" />
                <Text className="text-[10px] text-luxury-platinum mt-1">{t('changePhotoLabel')}</Text>
              </View>
            )}
          </TouchableOpacity>

          <View className="mt-1">
            <LuxuryButton
              label={t('saveChangesLabel')}
              variant="gold"
              onPress={handleSave}
              loading={saving}
              disabled={!isUsernameAvailable}
              className="mb-3"
            />
            <LuxuryButton label={t('backLabel')} variant="ghost" onPress={() => navigation.goBack()} />
          </View>
        </LuxuryCard>
      </ScrollView>
    </SafeAreaView>
  );
};

export default EditProfile;