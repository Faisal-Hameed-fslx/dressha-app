import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../providers/LanguageProvider';
import useAuthStore from '../store/auth';
import baseUrl from '../store/run';
import { useTheme } from '../theme/ThemeProvider';

export default function NotificationPreferences() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const token = useAuthStore((s: any) => s.token);
  const [loading, setLoading] = useState(false);
  const [weatherEnabled, setWeatherEnabled] = useState<boolean | null>(null);
  const navigation = useNavigation<any>();

  React.useEffect(() => {
    let mounted = true;
    const loadWeatherState = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${baseUrl}/notifications/times`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const j = await res.json();
        if (mounted) setWeatherEnabled(Array.isArray(j.times) && j.times.length > 0);
      } catch {
        if (mounted) setWeatherEnabled(null);
      }
    };
    loadWeatherState();
    return () => { mounted = false; };
  }, [token]);

  const sendTest = async () => {
    if (!token) return Alert.alert(t('notificationsTitle'), t('notificationsBody'));
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/notifications/send-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (res.ok) {
        Alert.alert(t('notificationsTitle'), `Sent: ${j.sent || 0}`);
        return;
      }

      const message = String(j?.error || 'Failed');
      if (message.includes('No registered tokens') || message.includes('FirebaseApp is not initialized') || message.includes('FCM')) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Dressha',
            body: 'Test notification from Dressha',
            data: { source: 'local-test' },
          },
          trigger: null as any,
        });
        Alert.alert(t('notificationsTitle'), 'Local test notification shown on device.');
      } else {
        Alert.alert(t('notificationsTitle'), message);
      }
    } catch (e) {
      console.warn('Send test failed', e);
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Dressha',
            body: 'Test notification from Dressha',
            data: { source: 'local-test' },
          },
          trigger: null as any,
        });
        Alert.alert(t('notificationsTitle'), 'Local test notification shown on device.');
      } catch {
        Alert.alert(t('notificationsTitle'), t('notificationsBody'));
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleWeatherSuggestions = async (nextEnabled: boolean) => {
    try {
      if (!token) return navigation.navigate('SignIn');

      if (nextEnabled) {
        let lastRaw = null;
        try { lastRaw = await AsyncStorage.getItem('weather_sugg_lastloc'); } catch {}
        let lastLocation = null;
        if (lastRaw) {
          try { lastLocation = JSON.parse(lastRaw); } catch {}
        }
        const resp = await fetch(`${baseUrl}/notifications/times`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mode: 'auto', lastLocation, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
        });
        if (!resp.ok) throw new Error('Failed to enable weather suggestions');
      } else {
        const resp = await fetch(`${baseUrl}/notifications/times`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ times: [] }),
        });
        if (!resp.ok) throw new Error('Failed to disable weather suggestions');
      }

      setWeatherEnabled(nextEnabled);
      Alert.alert('Weather suggestions', nextEnabled ? 'Enabled' : 'Disabled');
    } catch (err) {
      console.warn('Toggle weather suggestions failed', err);
      Alert.alert('Weather suggestions', 'Could not update this setting.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ padding: 16 }}>
        <Text style={{ color: theme.colors.primary, fontSize: 20, marginBottom: 8 }}>{t('notifications')}</Text>

        <View style={[styles.rowCard, { marginBottom: 10 }]}> 
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Weather suggestions</Text>
            <Text style={{ color: theme.colors.muted, marginTop: 4, fontSize: 12 }}>Automatic weather-based pushes twice a day</Text>
          </View>
          <Switch
            value={weatherEnabled ?? false}
            onValueChange={toggleWeatherSuggestions}
            trackColor={{ false: '#B0B0B0', true: theme.colors.accent }}
            thumbColor={weatherEnabled ? theme.colors.background : '#f4f3f4'}
          />
        </View>

        <Pressable style={styles.button} onPress={sendTest} disabled={loading}>
          <Text style={styles.buttonText}>{t('sendTestNotification')}</Text>
        </Pressable>
        <View style={{ marginTop: 18 }}>
          <Text style={{ color: theme.colors.muted }}>Weather alerts use free local notifications only.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    padding: 12,
    marginBottom: 10,
  },
  button: {
    backgroundColor: theme.colors.accent,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  buttonText: { color: theme.colors.background, fontWeight: '600' },
});
