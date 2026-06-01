import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchUserOutfits } from '../Images';
import { useLanguage } from '../providers/LanguageProvider';
import { useTheme } from '../theme/ThemeProvider';

import LuxuryButton from '../components/Luxury/LuxuryButton';
import LuxuryCard from '../components/Luxury/LuxuryCard';

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

const normalizeClothingType = (value: string) => {
  const raw = String(value || '').toLowerCase().trim();
  if (['top', 'tops', 'shirt', 'shirts'].includes(raw)) return 'top';
  if (['bottom', 'bottoms', 'pants', 'trouser', 'trousers'].includes(raw)) return 'bottom';
  if (['skirt', 'skirts'].includes(raw)) return 'skirts';
  if (['shoe', 'shoes', 'sneaker', 'sneakers'].includes(raw)) return 'shoes';
  if (raw === 'dress') return 'dress';
  if (['outfit', 'look', 'ensemble'].includes(raw)) return 'outfit';
  return 'other';
};

const toDisplayClothingType = (value: string) => {
  const normalized = normalizeClothingType(value);
  switch (normalized) {
    case 'top': return 'Top';
    case 'bottom': return 'Bottom';
    case 'skirts': return 'Skirt';
    case 'shoes': return 'Shoes';
    case 'dress': return 'Dress';
    case 'outfit': return 'Outfit';
    default: return 'Other';
  }
};


const AddOutfitPage = () => {
  const route = useRoute();
  const params: any = route.params;
  const date = typeof params === 'string' ? params : params?.date || new Date().toLocaleDateString();
  const savedOutfits = params && typeof params === 'object' ? params.savedOutfits || params.outfits : undefined;
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [, setError] = useState<string | null>(null);
    const [, setImage] = useState<{ uri: string; publicId?: string; url?: string } | null>(
      null
    );

  const [popularClothingItems, setPopularClothingItems] = useState<{
    id: string;
    image: string;
    type: 'top' | 'bottom' | 'dress' | 'skirts' | 'shoes' | 'outfit' | 'other';
    gender: string;
    publicId?: string;
    uploadedAt?: string;
  }[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [selectedClothes, setSelectedClothes] = useState<string[]>([]);

  useEffect(() => {
    const loadCloudinaryImages = async () => {
      try {
        setLoadingItems(true);
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          setPopularClothingItems([]);
          return;
        }

        const images = await fetchUserOutfits(token);
        const normalized = images
          .map((item: { id?: string; image: string; type?: 'pants' | 'shirt' | 'shoes' | 'skirts' | 'tops'; gender?: string; publicId?: string; uploadedAt?: string; }, index: number) => ({
            id: item.publicId || item.id || `outfit-${index}`,
            image: item.image,
            type: normalizeClothingType(item.type || 'tops'),
            gender: item.gender || 'unisex',
            publicId: item.publicId,
            uploadedAt: item.uploadedAt,
          }))
          .filter((item: { image: string }) => !!item.image);

        setPopularClothingItems(normalized);
      } catch (error) {
        console.error('Failed to load outfit images:', error);
        setPopularClothingItems([]);
      } finally {
        setLoadingItems(false);
      }
    };

    loadCloudinaryImages();
  }, []);

  const visibleClothingItems = useMemo(
    () => popularClothingItems.filter((item) => item.image),
    [popularClothingItems]
  );

  const toggleSelect = (id: string) => {
    setSelectedClothes((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    const selectedOutfitItems = visibleClothingItems.filter((item) =>
      selectedClothes.includes(item?.id)
    );
    navigation.navigate('Design', { selectedOutfitItems, date, savedOutfits });
  };



    /**
     * Take photo with camera
     */
    const takePhoto = useCallback(async () => {
      try {
        setError(null);
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: 'images',
          allowsEditing: true,
          quality: 1,
        });
  
        if (!result.canceled) {
          setImage({ uri: result.assets[0].uri });
          return result.assets[0];
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to take photo';
        setError(errorMessage);
        console.error('Camera error:', err);
      }
    }, []);

      const handleCapturePhoto = async () => {
        try {
          const result = await takePhoto();
          if (result) {
              Alert.alert(t('successTitle'), t('photoCapturedSuccess'));
            }
        } catch {
            Alert.alert(t('capturePhotoFailedTitle'), t('capturePhotoFailedBody'));
        }
      };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <View className="flex-row items-center justify-between rounded-2xl border p-3" style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.accent} />
          </TouchableOpacity>
          <Text className="text-2xl font-display tracking-luxury" style={{ color: theme.colors.primary }}>{t('addOutfitsTitle')}</Text>
          <Text className="text-xs font-sans tracking-luxe" style={{ color: theme.colors.muted }}>{date}</Text>
        </View>
      </View>

      {/* Top Actions */}
      <LuxuryCard className="flex-row justify-around mt-5 px-4 mx-4 pt-4 pb-3">
        <LuxuryButton label={t('selfieLabel')} variant="gold" onPress={handleCapturePhoto} className="w-[30%]" />
        <LuxuryButton label={t('savedLabel')} variant="gold" onPress={() => navigation.navigate('SavedOutfitScreen')} className="w-[30%]" />
      </LuxuryCard>

      {/* Clothes Grid */}
      <ScrollView className="mt-5">
        <Text className="ml-4 mb-2 text-2xl font-display tracking-luxury" style={{ color: theme.colors.primary }}>{t('yourImages')}</Text>
        {loadingItems ? (
          <View className="items-center justify-center py-10">
            <Text className="font-sans" style={{ color: theme.colors.muted }}>{t('loadingImages')}</Text>
          </View>
        ) : null}
        <View className="flex-row flex-wrap px-4">
          {visibleClothingItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => toggleSelect(item.id)}
              className="w-1/3 p-1"
            >
              <View className="relative overflow-hidden rounded-xl border" style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
                <Image
                  source={{ uri: item.image }}
                  className="w-full h-28"
                  resizeMode="contain"
                />
                {/* Type / Gender Badges */}
                <View className="absolute top-2 left-2 rounded-full px-2 py-1" style={{ backgroundColor: hexToRgba(theme.colors.primary, 0.85), borderWidth: 1, borderColor: hexToRgba(theme.colors.primary, 0.1) }}>
                  <Text className="text-[10px] font-semibold capitalize" style={{ color: theme.colors.background }}>
                    {toDisplayClothingType(item?.type || 'other')}
                  </Text>
                </View>
                <View className="absolute top-2 right-2 h-5 w-5 items-center justify-center rounded-full border" style={{ backgroundColor: theme.colors.background, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
                  <Text className="text-xs" style={{ color: theme.colors.primary }}>
                    {item?.gender === 'male' ? '♂' : item?.gender === 'female' ? '♀' : '⚪'}
                  </Text>
                </View>

                {/* Selected Badge */}
                <View
                  className={`absolute bottom-2 left-2 w-5 h-5 rounded-full border justify-center items-center ${
                    selectedClothes.includes(item.id)
                      ? ''
                      : ''
                  }`}
                  style={{
                    backgroundColor: selectedClothes.includes(item.id) ? theme.colors.accent : theme.colors.background,
                    borderColor: selectedClothes.includes(item.id) ? theme.colors.accent : hexToRgba(theme.colors.primary, 0.18),
                  }}
                >
                  {selectedClothes.includes(item.id) && (
                    <Ionicons name="checkmark" size={16} color={theme.colors.background} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Selected Scroll */}
      {selectedClothes.length > 0 && (
        <View className="absolute bottom-0 left-0 right-0 border-t p-3" style={{ backgroundColor: theme.colors.card, borderTopColor: hexToRgba(theme.colors.primary, 0.08) }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {selectedClothes.map((id) => {
              const item = popularClothingItems.find((itm) => itm.id === id);
              return (
                <Image
                  key={id}
                  source={{ uri: item?.image }}
                  className="mr-3 h-14 w-14 rounded-lg"
                />
              );
            })}
          </ScrollView>
          <LuxuryButton label={t('nextLabel')} variant="gold" onPress={handleNext} className="self-end mt-3 mb-3" />
        </View>
      )}
    </SafeAreaView>
  );
};

export default AddOutfitPage;
