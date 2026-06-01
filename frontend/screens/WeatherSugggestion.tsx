import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
// server-side scheduling used; no local notifications from this screen
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../providers/LanguageProvider';
import useAuthStore from '../store/auth';
import baseUrl from '../store/run';
import { useTheme } from '../theme/ThemeProvider';

const LAST_LOC_KEY = 'weather_sugg_lastloc';

const hexToRgba = (hex: string, alpha = 1) => {
  const cleaned = hex.replace('#', '');
  const bigint = parseInt(cleaned, 16);
  if (Number.isNaN(bigint)) return `rgba(0,0,0,${alpha})`;
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const WeatherSugggestion = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const scrollRef = useRef<ScrollView>(null);
  const cardAnim = useRef(new Animated.Value(0)).current;
  const token = useAuthStore((s: any) => s.token);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [inventoryOutfits, setInventoryOutfits] = useState<any[]>([]);
  



  const animateCards = React.useCallback(() => {
    cardAnim.setValue(0);
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [cardAnim]);

  const fetchWeather = React.useCallback(async (opts?: {
    lat?: number;
    lon?: number;
    city?: string;
    useInventory?: boolean;
  }) => {
    Keyboard.dismiss();
    const useInventory = opts?.useInventory ?? true;
    const lat = opts?.lat;
    const lon = opts?.lon;
    const city = opts?.city ?? query.trim();

    if (!city && (lat === undefined || lon === undefined)) return;

    setLoading(true);
    setWeather(null);
    setSuggestions([]);
    setInventory([]);
    setInventoryOutfits([]);

    try {
      let url = `${baseUrl}/weather/suggest?useInventory=${useInventory ? 'true' : 'false'}`;
      if (lat !== undefined && lon !== undefined) {
        url += `&lat=${lat}&lon=${lon}`;
      } else {
        url += `&city=${encodeURIComponent(city)}`;
      }

      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(url, { headers });
      const data = await response.json();

      if (!response.ok) {
        setWeather({ error: data?.error || 'Failed to fetch weather' });
        return;
      }

      const rawWeather = data.weather || {};
      setWeather({
        name: data.city || city || rawWeather.name || '',
        temperature: rawWeather.temperature ?? rawWeather.temp ?? rawWeather.t ?? null,
        windspeed: rawWeather.windspeed ?? rawWeather.wind_speed ?? rawWeather.wind ?? null,
        description: rawWeather.description || rawWeather.weather || '',
        weatherCode: rawWeather.weatherId ?? rawWeather.weathercode ?? rawWeather.code ?? null,
        humidity: rawWeather.humidity ?? rawWeather.rh ?? null,
        feelsLike: rawWeather.feels_like ?? rawWeather.feelsLike ?? null,
        precipitation: rawWeather.precipitation ?? rawWeather.rain ?? rawWeather.pop ?? null,
      });
      setSuggestions(data.suggestions || []);
      setInventory(data.inventory || []);
      setInventoryOutfits(data.inventoryOutfits || []);
      // Persist last searched location
      try {
        const toSave: any = {};
        if (lat !== undefined && lon !== undefined) {
          toSave.lat = lat;
          toSave.lon = lon;
        } else if (city) {
          toSave.city = city;
        }
        if (Object.keys(toSave).length > 0) await AsyncStorage.setItem(LAST_LOC_KEY, JSON.stringify(toSave));
        // send to server for server-side scheduling and inventory matching
        try {
          const token = await AsyncStorage.getItem('token');
          if (token) {
            await fetch(`${baseUrl}/weather/location`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(toSave) });
          }
        } catch { /* ignore */ }
      } catch {}
      animateCards();
      scrollRef.current?.scrollToEnd({ animated: true });
    } catch {
      setWeather({ error: 'Failed to fetch weather' });
    } finally {
      setLoading(false);
    }
  }, [query, token, animateCards]);

  const fetchByCurrentLocation = async () => {
    Keyboard.dismiss();
    setLoading(true);
    try {
      let LocationModule = null;
      try {
        LocationModule = (await import('expo-location')) || null;
      } catch {
        LocationModule = null;
      }

      if (LocationModule) {
        const { status } = await LocationModule.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setWeather({ error: 'Location permission denied' });
          return;
        }

        const pos = await LocationModule.getCurrentPositionAsync({ accuracy: LocationModule.Accuracy.Highest });
        await fetchWeather({ lat: pos.coords.latitude, lon: pos.coords.longitude, useInventory: true });
      } else if (navigator?.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            fetchWeather({ lat: pos.coords.latitude, lon: pos.coords.longitude, useInventory: true });
          },
          () => setWeather({ error: 'Failed to get location' }),
          { enableHighAccuracy: true, timeout: 10000 },
        );
      } else {
        setWeather({ error: 'Location APIs unavailable' });
      }
    } catch {
      setWeather({ error: 'Failed to get location' });
    } finally {
      setLoading(false);
    }
  };

  // scheduling is handled server-side via Settings -> Weather suggestions

  useEffect(() => {
    const init = async () => {
      try {
        const lastRaw = await AsyncStorage.getItem(LAST_LOC_KEY);
        if (lastRaw) {
          const parsed = JSON.parse(lastRaw);
          if (parsed?.lat && parsed?.lon) {
            fetchWeather({ lat: parsed.lat, lon: parsed.lon, useInventory: true });
          } else if (parsed?.city) {
            setQuery(parsed.city);
            fetchWeather({ city: parsed.city, useInventory: true });
          }
        }
      } catch {}
    };
    init();
  }, [fetchWeather]);

  const cardTranslate = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  // scheduledCount removed; server handles schedules

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.colors.background} translucent={false} />
      <LinearGradient
        colors={theme.name === 'scandi-dark' ? ['#101010', '#171717', '#1f1f1f'] : ['#F8F8F8', '#F4F4F4', '#ECECEC']}
        style={StyleSheet.absoluteFill}
      />

      <View className="flex-row items-center px-5 py-4">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mr-4 h-11 w-11 items-center justify-center ">
          <Ionicons name="arrow-back" size={24} color={theme.colors.accent} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold" style={{ color: theme.colors.primary }}>{t('weatherTitle')}</Text>
          {/* scheduling moved to Settings (server-side) */}
        </View>
      </View>

      <View style={styles.searchPanel}>
        <View style={styles.searchRow}>
          <TextInput
            placeholder={t('cityPlaceholder')}
            placeholderTextColor="#9E988B"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => fetchWeather({ city: query, useInventory: true })}
            style={styles.input}
          />
          <TouchableOpacity
            onPress={() => fetchWeather({ city: query, useInventory: true })}
            disabled={loading}
            style={[styles.goldButton, loading && { opacity: 0.6 }]}>
            <Text style={styles.goldButtonText}>{loading ? t('searching') : t('searchLabel')}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={fetchByCurrentLocation}
          disabled={loading}
          style={[styles.darkButton, loading && { opacity: 0.6 }]}>
          <Text style={styles.darkButtonText}>{t('useMyLocation')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        className="mt-4 flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {weather?.error ? <View style={styles.errorCard}><Text style={styles.errorText}>{weather.error}</Text></View> : null}

        {weather && !weather.error && (
          <Animated.View
            style={[
              styles.weatherCard,
              {
                opacity: cardAnim,
                transform: [{ translateY: cardTranslate }],
              },
            ]}>
            <Text style={styles.city}>{weather.name}</Text>
            <Text style={styles.temp}>{weather.temperature}°C</Text>
            {weather.description ? <Text style={styles.meta}>{weather.description}</Text> : null}
            {(weather.feelsLike || weather.humidity || weather.precipitation) ? (
              <View style={{ marginTop: 8 }}>
                {weather.feelsLike != null && <Text style={styles.meta}>Feels like: {weather.feelsLike}°C</Text>}
                {weather.humidity != null && <Text style={styles.meta}>Humidity: {weather.humidity}%</Text>}
                {weather.precipitation != null && <Text style={styles.meta}>Precipitation: {weather.precipitation}</Text>}
              </View>
            ) : null}
            <Text style={styles.meta}>
              {weather.windspeed ? `Wind ${weather.windspeed} km/h` : ''}
            </Text>
          </Animated.View>
        )}

        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            <Text style={styles.sectionTitle}>Suggested items</Text>
            {suggestions.map((sugg, index) => (
              <Animated.View
                key={sugg}
                style={[
                  styles.suggCard,
                  {
                    opacity: cardAnim,
                    transform: [
                      {
                        translateY: cardAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20 + index * 6, 0],
                        }),
                      },
                    ],
                  },
                ]}>
                <Text style={styles.suggText}>{sugg}</Text>
              </Animated.View>
            ))}
          </View>
        )}

        {inventory.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.sectionTitle}>Matches from your inventory</Text>
            {inventory.map((item, index) => (
              <View key={index} style={styles.inventoryRow}>
                {item?.image ? (
                  <Image source={{ uri: item.image }} style={styles.inventoryThumb} />
                ) : (
                  <View style={styles.inventoryThumb} />
                )}
                <Text style={styles.inventoryText}>{item.type || 'Item'}</Text>
              </View>
            ))}
          </View>
        )}

        {inventoryOutfits.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.sectionTitle}>{t('suggestedOutfits')}</Text>
            {inventoryOutfits.map((outfit: any) => (
              <View key={outfit.id} style={styles.outfitCard}>
                <View style={styles.outfitRow}>
                  {outfit.items?.slice(0, 4).map((item: any, index: number) =>
                    item?.image ? (
                      <Image key={index} source={{ uri: item.image }} style={styles.outfitImage} />
                    ) : (
                      <View key={index} style={styles.outfitImage} />
                    ),
                  )}
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.outfitTitle}>{outfit.caption || outfit.occasion || t('saveOutfitLabel')}</Text>
                    <Text style={styles.outfitMeta}>{outfit.occasion || ''}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {inventoryOutfits.length === 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>{t('noMatchingOutfitsInInventory')}</Text>
          </View>
        )}
      </ScrollView>

      {/* Notification scheduling moved to Settings (server-side). */}
    </SafeAreaView>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  searchPanel: {
    marginHorizontal: 20,
    marginTop: 4,
    padding: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: hexToRgba(theme.colors.primary, 0.08),
  },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: hexToRgba(theme.colors.primary, 0.04),
    borderWidth: 1,
    borderColor: hexToRgba(theme.colors.primary, 0.08),
    paddingHorizontal: 14,
    color: theme.colors.primary,
  },
  goldButton: {
    marginLeft: 12,
    minWidth: 92,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldButtonText: { color: theme.colors.background, fontWeight: '800' },
  darkButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: hexToRgba(theme.colors.primary, 0.05),
    borderWidth: 1,
    borderColor: hexToRgba(theme.colors.primary, 0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkButtonText: { color: theme.colors.primary, fontWeight: '700' },
  weatherCard: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: hexToRgba(theme.colors.primary, 0.08),
  },
  city: { color: theme.colors.primary, fontSize: 18, fontWeight: '700' },
  temp: { color: theme.colors.accent, fontSize: 28, fontWeight: '800', marginTop: 6 },
  meta: { color: theme.colors.muted, marginTop: 6 },
  suggestions: { marginTop: 14 },
  sectionTitle: { fontWeight: '700', color: theme.colors.primary, marginBottom: 8, marginHorizontal: 20 },
  suggCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: hexToRgba(theme.colors.primary, 0.08),
  },
  suggText: { color: theme.colors.primary, fontWeight: '600' },
  inventoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginHorizontal: 20 },
  inventoryThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: hexToRgba(theme.colors.primary, 0.05),
  },
  inventoryText: { color: theme.colors.primary },
  outfitCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: hexToRgba(theme.colors.primary, 0.08),
  },
  outfitRow: { flexDirection: 'row', alignItems: 'center' },
  outfitImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 6,
    backgroundColor: hexToRgba(theme.colors.primary, 0.05),
  },
  outfitTitle: { color: theme.colors.primary, fontWeight: '700' },
  outfitMeta: { color: theme.colors.muted, marginTop: 4 },
  notifArea: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: hexToRgba(theme.colors.primary, 0.08) },
  notifRow: { flexDirection: 'row', gap: 12, marginHorizontal: 20, marginTop: 8 },
  timeInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: hexToRgba(theme.colors.primary, 0.04),
    borderWidth: 1,
    borderColor: hexToRgba(theme.colors.primary, 0.08),
    paddingHorizontal: 14,
    color: theme.colors.primary,
  },
  saveButton: {
    marginHorizontal: 20,
    marginTop: 12,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: theme.colors.background, fontWeight: '800' },
  errorCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: hexToRgba(theme.colors.accent, 0.12),
    borderWidth: 1,
    borderColor: hexToRgba(theme.colors.accent, 0.35),
  },
  errorText: { color: theme.colors.primary },
});

export default WeatherSugggestion;