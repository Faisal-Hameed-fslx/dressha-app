import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
    Alert,
    Image,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../providers/LanguageProvider';
import useAuthStore from '../store/auth';
import baseUrl from '../store/run';
import { useTheme } from '../theme/ThemeProvider';

type SettingRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  destructive?: boolean;
  onPress?: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
};

const hexToRgba = (hex: string, alpha = 1) => {
  const cleaned = hex.replace('#', '');
  const bigint = parseInt(cleaned, 16);
  if (Number.isNaN(bigint)) {
    return `rgba(0, 0, 0, ${alpha})`;
  }
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Translations are provided by the LanguageProvider (see frontend/lang)

const SettingRow = ({ icon, label, value, destructive, onPress, theme }: SettingRowProps) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    accessibilityRole="button"
    className="flex-row items-center justify-between rounded-2xl border px-4 py-4"
    style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }}
  >
    <View className="flex-row items-center gap-3">
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: destructive ? hexToRgba('#F6B5BE', 0.16) : hexToRgba(theme.colors.accent, 0.14) }}
      >
        <Ionicons name={icon} size={18} color={destructive ? '#C35A6B' : theme.colors.accent} />
      </View>
      <View>
        <Text className="text-base font-medium" style={{ color: destructive ? '#C35A6B' : theme.colors.primary }}>{label}</Text>
        {value ? <Text className="mt-0.5 text-xs" style={{ color: theme.colors.muted }}>{value}</Text> : null}
      </View>
    </View>
    <Ionicons name="chevron-forward" size={18} color={destructive ? '#C35A6B' : theme.colors.muted} />
  </TouchableOpacity>
);

const SettingPage = () => {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuthStore();
  const { theme, mode, setMode } = useTheme();

  
  const profileImage =
    user?.profilePicture ||
    'https://img.freepik.com/free-photo/waist-up-portrait-handsome-serious-unshaven-male-keeps-hands-together-dressed-dark-blue-shirt-has-talk-with-interlocutor-stands-against-white-wall-self-confident-man-freelancer_273609-16320.jpg?t=st=1767543970~exp=1767547570~hmac=bb935c73d4e043384ae0242aeab62d018a78ae5c7ca1553e2b341fc4df291362&w=1480';

  // Language selection state
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const { t, locale, setLocale } = useLanguage();

  const profileName = user?.profileName || user?.username || t('defaultDisplayName');
  const username = user?.username ? `@${user.username}` : t('connectedAccount');
  const email = user?.email || t('noEmailAvailable');

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = () => {
    setLogoutModalVisible(false);
    logout();
  };

  const cancelLogout = () => {
    setLogoutModalVisible(false);
  };

  // Language persistence handled by LanguageProvider

  const selectedLanguage = useMemo(() => {
    const languageLabels = {
      en: 'English',
      ur: 'اردو',
    } as const;
    return { code: locale, label: languageLabels[locale] };
  }, [locale]);

  const themeOptions = [
    { key: 'system', label: t('themeSystem'), description: t('themeSystemDesc') },
    { key: 'scandi-light', label: t('themeLight'), description: t('themeLightDesc') },
    { key: 'scandi-dark', label: t('themeDark'), description: t('themeDarkDesc') },
  ] as const;

  const languages = [
    { code: 'en', label: t('englishLabel') },
    { code: 'ur', label: 'اردو' },
  ];

  const openLanguageModal = () => {
    console.debug('[SettingPage] openLanguageModal');
    setLanguageModalVisible(true);
  };
  const closeLanguageModal = () => {
    console.debug('[SettingPage] closeLanguageModal');
    setLanguageModalVisible(false);
  };
  const chooseLanguage = (lang: { code: string; label: string }) => {
    setLocale(lang.code as 'en' | 'ur');
    closeLanguageModal();
  };

  const chooseTheme = (nextMode: 'system' | 'scandi-light' | 'scandi-dark') => {
    setMode(nextMode);
    setThemeModalVisible(false);
  };

  

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.colors.background} translucent={false} />
      <LinearGradient
        colors={theme.name === 'scandi-dark' ? ['#0f0f0f', '#161616', '#1f1f1f'] : ['#F8F8F8', '#F3F3F3', '#ECECEC']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-2">
          <View className="mb-5 flex-row items-center justify-between">
            <Pressable onPress={() => navigation.goBack()} className="h-11 w-11 items-center justify-center">
              <Ionicons name="arrow-back" size={24} color={theme.colors.accent} />
            </Pressable>
            <Text className="font-display text-3xl tracking-luxury" style={{ color: theme.colors.primary }}>{t('settingsTitle')}</Text>
            <View className="h-11 w-11" />
          </View>

          <View className="overflow-hidden rounded-[28px] border" style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
            <LinearGradient colors={[hexToRgba(theme.colors.accent, 0.16), 'transparent']} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
            <View className="items-center px-5 py-6">
              <View className="relative mb-4 rounded-full border-2 p-1" style={{ borderColor: hexToRgba(theme.colors.accent, 0.7) }}>
                <Image source={{ uri: profileImage }} className="h-24 w-24 rounded-full" />
                <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: theme.colors.accent }}>
                  <Ionicons name="sparkles" size={16} color={theme.colors.background} />
                </View>
              </View>
              <Text className="font-display text-3xl" style={{ color: theme.colors.primary }}>{profileName}</Text>
              <Text className="mt-1 text-sm" style={{ color: theme.colors.muted }}>{username}</Text>
              <Text className="mt-1 text-xs" style={{ color: theme.colors.muted }}>{email}</Text>

            </View>
          </View>

          <View className="mt-6 space-y-4">
            <Text className="px-1 text-xs uppercase tracking-[0.22em]" style={{ color: theme.colors.muted }}>{t('account')}</Text>
            <View className="mt-3">
              <View className="mb-2">
                <SettingRow
                  icon="person-outline"
                  label={t('editProfile')}
                  value={t('editProfileDesc')}
                  theme={theme}
                  onPress={() => navigation.navigate('EditProfile')}
                />
              </View>
              <View>
                <SettingRow
                  icon="lock-closed-outline"
                  label={t('privacy')}
                  value={t('privacyDesc')}
                  theme={theme}
                  onPress={() => Alert.alert(t('privacyTitle'), t('privacyBody'))}
                />
              </View>
            </View>
          </View>

          <View className="mt-6 space-y-4">
            <Text className="px-1 text-xs uppercase tracking-[0.22em]" style={{ color: theme.colors.muted }}>{t('preferences')}</Text>
            <View className="mt-3">
              <View className="mb-2">
                <SettingRow
                  icon="notifications-outline"
                  label={t('notifications')}
                  value={t('notificationsDesc')}
                  theme={theme}
                  onPress={() => navigation.navigate('NotificationPreferences')}
                />
              </View>

              <View className="mb-2">
                <SettingRow
                  icon="language-outline"
                  label={t('language')}
                  value={selectedLanguage.label}
                  theme={theme}
                  onPress={openLanguageModal}
                />
              </View>

              <View className="mb-2">
                <SettingRow
                  icon="color-palette-outline"
                  label={t('theme')}
                  value={mode === 'system' ? t('themeSystem') : mode === 'scandi-light' ? t('themeLight') : t('themeDark')}
                  theme={theme}
                  onPress={() => setThemeModalVisible(true)}
                />
              </View>

              <View className="mb-2">
                <SettingRow
                  icon="cloud-download-outline"
                  label={t('cache')}
                  value={t('cacheDesc')}
                  theme={theme}
                  onPress={() => Alert.alert(t('cacheTitle'), t('cacheBody'))}
                />
              </View>
              <View className="mb-2">
                <SettingRow
                  icon="cloud-outline"
                  label={'Weather suggestions'}
                  value={''}
                  theme={theme}
                  onPress={async () => {
                    try {
                      const token = useAuthStore.getState().token;
                      if (!token) return navigation.navigate('SignIn');
                      // get current times to decide enabled state
                      const resp = await fetch(`${baseUrl}/notifications/times`, { headers: { Authorization: `Bearer ${token}` } });
                      const j = await resp.json();
                      const enabled = Array.isArray(j.times) && j.times.length > 0;
                      if (enabled) {
                        // disable
                        await fetch(`${baseUrl}/notifications/times`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ times: [] }) });
                        Alert.alert('Weather suggestions', 'Disabled');
                      } else {
                        // enable auto mode; include last location if available
                        let lastRaw = null;
                        try { lastRaw = await AsyncStorage.getItem('weather_sugg_lastloc'); } catch {}
                        let last = null;
                        if (lastRaw) try { last = JSON.parse(lastRaw); } catch {}
                        await fetch(`${baseUrl}/notifications/times`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ mode: 'auto', lastLocation: last || undefined, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
                        Alert.alert('Weather suggestions', 'Enabled (auto)');
                      }
                    } catch (e) {
                      console.warn('Toggle weather suggestions failed', e);
                      Alert.alert('Error', 'Failed to update preference');
                    }
                  }}
                />
              </View>
            </View>
          </View>

          <View className="mt-6 space-y-4">
            <Text className="px-1 text-xs uppercase tracking-[0.22em]" style={{ color: theme.colors.muted }}>{t('support')}</Text>
            <View className="mt-3">
              <View className="mb-2">
                <SettingRow
                  icon="help-circle-outline"
                  label={t('helpCenter')}
                  value={t('helpCenterDesc')}
                  theme={theme}
                  onPress={() => Alert.alert(t('helpCenterTitle'), t('helpCenterBody'))}
                />
              </View>
              <View className="mb-2">
                <SettingRow
                  icon="information-circle-outline"
                  label={t('about')}
                  value={t('aboutDesc')}
                  theme={theme}
                  onPress={() => Alert.alert(t('aboutTitle'), t('aboutBody'))}
                />
              </View>
            </View>
          </View>

          <View className="mt-6 space-y-4">
            <Text className="px-1 text-xs uppercase tracking-[0.22em]" style={{ color: theme.colors.muted }}>{t('session')}</Text>
            <View className="mt-3">
              <SettingRow
                icon="log-out-outline"
                label={t('logout')}
                value={t('logoutDesc')}
                destructive
                theme={theme}
                onPress={handleLogout}
              />
            </View>
          </View>
          </View>
      </ScrollView>

      {languageModalVisible ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable
            onPress={closeLanguageModal}
            className="flex-1"
            style={{ backgroundColor: hexToRgba('#000000', 0.55) }}
            accessibilityRole="button"
            accessibilityLabel="Close language picker"
          />

          <View className="absolute bottom-0 left-0 right-0 overflow-hidden rounded-t-[32px] border" style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
            <View className="px-5 pt-4">
              <View className="mx-auto mb-4 h-1.5 w-14 rounded-full" style={{ backgroundColor: hexToRgba(theme.colors.primary, 0.12) }} />

              <View className="mb-4 flex-row items-start justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-xl font-semibold" style={{ color: theme.colors.primary }}>{t('chooseLanguage')}</Text>
                  <Text className="mt-1 text-sm" style={{ color: theme.colors.muted }}>
                    {t('currentSelection')}: <Text className="font-medium" style={{ color: theme.colors.accent }}>{selectedLanguage.label}</Text>
                  </Text>
                </View>
                <Pressable
                  onPress={closeLanguageModal}
                  accessibilityRole="button"
                  accessibilityLabel="Close language picker"
                  className="h-10 w-10 items-center justify-center rounded-full border"
                  style={{ backgroundColor: hexToRgba(theme.colors.primary, 0.04), borderColor: hexToRgba(theme.colors.primary, 0.08) }}
                >
                  <Ionicons name="close" size={20} color={theme.colors.primary} />
                </Pressable>
              </View>

              <View className="pb-4">
                {languages.map((lang) => {
                  const isSelected = selectedLanguage.code === lang.code;

                  return (
                    <Pressable
                      key={lang.code}
                      onPress={() => chooseLanguage(lang)}
                      className="mb-3 flex-row items-center justify-between rounded-2xl border px-4 py-4"
                      style={{
                        backgroundColor: isSelected ? hexToRgba(theme.colors.accent, 0.1) : hexToRgba(theme.colors.primary, 0.03),
                        borderColor: isSelected ? hexToRgba(theme.colors.accent, 0.45) : hexToRgba(theme.colors.primary, 0.08),
                      }}
                    >
                      <View>
                        <Text className="text-base font-medium" style={{ color: theme.colors.primary }}>{lang.label}</Text>
                        <Text className="mt-0.5 text-xs" style={{ color: theme.colors.muted }}>{t('languageOption')}</Text>
                      </View>

                      <View className="flex-row items-center gap-2">
                        {isSelected ? (
                          <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: theme.colors.accent }}>
                            <Text className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.colors.background }}>
                              {t('selected')}
                            </Text>
                          </View>
                        ) : null}
                        <Ionicons name={isSelected ? 'checkmark-circle' : 'chevron-forward'} size={18} color={theme.colors.accent} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable onPress={closeLanguageModal} className="mb-4 items-center rounded-2xl border py-3" style={{ backgroundColor: hexToRgba(theme.colors.primary, 0.04), borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
                <Text className="text-base font-medium" style={{ color: theme.colors.primary }}>{t('cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {themeModalVisible ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable
            onPress={() => setThemeModalVisible(false)}
            className="flex-1"
            style={{ backgroundColor: hexToRgba('#000000', 0.55) }}
            accessibilityRole="button"
            accessibilityLabel="Close theme picker"
          />

          <View className="absolute bottom-0 left-0 right-0 overflow-hidden rounded-t-[32px] border" style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
            <View className="px-5 pt-4">
              <View className="mx-auto mb-4 h-1.5 w-14 rounded-full" style={{ backgroundColor: hexToRgba(theme.colors.primary, 0.12) }} />
              <Text className="text-xl font-semibold" style={{ color: theme.colors.primary }}>{t('theme')}</Text>
              <Text className="mt-1 text-sm" style={{ color: theme.colors.muted }}>{t('themeDesc')}</Text>

              <View className="mt-4 pb-4">
                {themeOptions.map((option) => {
                  const isSelected = mode === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => chooseTheme(option.key)}
                      className="mb-3 rounded-2xl border px-4 py-4"
                      style={{
                        backgroundColor: isSelected ? hexToRgba(theme.colors.accent, 0.1) : hexToRgba(theme.colors.primary, 0.03),
                        borderColor: isSelected ? hexToRgba(theme.colors.accent, 0.45) : hexToRgba(theme.colors.primary, 0.08),
                      }}
                    >
                      <View className="flex-row items-center justify-between">
                        <View>
                          <Text className="text-base font-medium" style={{ color: theme.colors.primary }}>{option.label}</Text>
                          <Text className="mt-0.5 text-xs" style={{ color: theme.colors.muted }}>{option.description}</Text>
                        </View>
                        <Ionicons name={isSelected ? 'checkmark-circle' : 'chevron-forward'} size={18} color={theme.colors.accent} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable onPress={() => setThemeModalVisible(false)} className="mb-4 items-center rounded-2xl border py-3" style={{ backgroundColor: hexToRgba(theme.colors.primary, 0.04), borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
                <Text className="text-base font-medium" style={{ color: theme.colors.primary }}>{t('cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {logoutModalVisible ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable
            onPress={cancelLogout}
            className="flex-1"
            style={{ backgroundColor: hexToRgba('#000000', 0.55) }}
            accessibilityRole="button"
            accessibilityLabel="Cancel logout"
          />

          <View className="absolute bottom-0 left-0 right-0 overflow-hidden rounded-t-[32px] border" style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
            <View className="px-5 pt-4">
              <View className="mx-auto mb-6 h-1.5 w-14 rounded-full" style={{ backgroundColor: hexToRgba(theme.colors.primary, 0.12) }} />

              <View className="mb-8 items-start">
                <View className="mb-3 flex-row items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: hexToRgba('#C35A6B', 0.16) }}>
                    <Ionicons name="log-out-outline" size={24} color="#C35A6B" />
                  </View>
                  <Text className="text-2xl font-semibold" style={{ color: theme.colors.primary }}>{t('signOutTitle')}</Text>
                </View>
                <Text className="text-sm leading-5" style={{ color: theme.colors.muted }}>
                  {t('signOutBody')}
                </Text>
              </View>

              <View className="gap-3 pb-4">
                <Pressable
                  onPress={confirmLogout}
                  className="flex-row items-center justify-center rounded-2xl border py-4"
                  style={{ backgroundColor: hexToRgba('#C35A6B', 0.14), borderColor: hexToRgba('#C35A6B', 0.35) }}
                >
                  <Ionicons name="log-out-outline" size={18} color="#C35A6B" />
                  <Text className="ml-2 text-base font-semibold" style={{ color: '#C35A6B' }}>{t('signOutAction')}</Text>
                </Pressable>

                <Pressable
                  onPress={cancelLogout}
                  className="items-center rounded-2xl border py-3"
                  style={{ backgroundColor: hexToRgba(theme.colors.primary, 0.04), borderColor: hexToRgba(theme.colors.primary, 0.08) }}
                >
                  <Text className="text-base font-medium" style={{ color: theme.colors.primary }}>{t('keepSignedIn')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

export default SettingPage;
