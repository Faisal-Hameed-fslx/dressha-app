import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useRoute } from '@react-navigation/native';
import { jwtDecode } from 'jwt-decode';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LuxuryBanner from '../components/Luxury/LuxuryBanner';
import LuxuryButton from '../components/Luxury/LuxuryButton';
import LuxuryCard from '../components/Luxury/LuxuryCard';
import { useLanguage } from '../providers/LanguageProvider';
import { deleteImageFromCloudinary } from '../services/cloudinaryApi';
import { useCloudinaryImage } from '../services/useCloudinaryImage';
import localHost from '../store/run';
import { useTheme } from '../theme/ThemeProvider';

const STORAGE_KEY = 'uploaded_images_cloudinary_v1';

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

const TakePhoto = () => {
  const route = useRoute();
  const isFocused = useIsFocused();
  const routeParams: any = route.params || {};
  const { image, isLoading, error, pickImage, takePhoto, uploadImage, resetImage } =
    useCloudinaryImage('outfits');
  const [removeBackground, setRemoveBackground] = useState(false);
  
  const [uploadedImages, setUploadedImages] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [itemType, setItemType] = useState<'top' | 'bottom' | 'dress' | 'skirts' | 'shoes' | 'other'>('other');
  const [gender, setGender] = useState<'male' | 'female' | 'unisex'>('unisex');
  const [itemTypeOpen, setItemTypeOpen] = useState(false);
  const [genderOpen, setGenderOpen] = useState(false);
  const { theme } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    const defaultItemType = routeParams?.defaultItemType;
    const defaultGender = routeParams?.defaultGender;

    if (['top', 'bottom', 'dress', 'skirts', 'shoes', 'other'].includes(defaultItemType)) {
      setItemType(defaultItemType);
    }

    if (['male', 'female', 'unisex'].includes(defaultGender)) {
      setGender(defaultGender);
    }
  }, [routeParams?.defaultGender, routeParams?.defaultItemType]);

  useEffect(() => {
    const backendUrl = localHost;
    testConnection(backendUrl);
  }, []);

  useEffect(() => {
    if (!isFocused) return;

    const loadForCurrentUser = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        let userKey = 'guest';

        if (token) {
          try {
            const decoded = jwtDecode(token) as { id?: string };
            if (decoded?.id) {
              userKey = decoded.id;
            }
          } catch {
            userKey = 'guest';
          }
        }

        const scopedStorageKey = `${STORAGE_KEY}:${userKey}`;
        const raw = await AsyncStorage.getItem(scopedStorageKey);
        setUploadedImages(raw ? JSON.parse(raw) : []);
      } catch {
        setUploadedImages([]);
        console.warn('Failed to load saved images');
      } finally {
        setLoadingSaved(false);
      }
    };

    loadForCurrentUser();
  }, [isFocused]);

  const testConnection = async (url: string) => {
    try {
      const response = await fetch(`${url}/api/health`, {
        method: 'GET',
      });
      if (!response.ok) {
        console.warn('Backend health check failed');
      }
    } catch {
      console.warn('Backend health check failed');
    }
  };

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const getScopedStorageKey = async () => {
    const token = await AsyncStorage.getItem('token');
    let userKey = 'guest';

    if (token) {
      try {
        const decoded = jwtDecode(token) as { id?: string };
        if (decoded?.id) {
          userKey = decoded.id;
        }
      } catch {
        userKey = 'guest';
      }
    }

    return `${STORAGE_KEY}:${userKey}`;
  };

  const saveToLocal = async (record: any) => {
    try {
      const scopedStorageKey = await getScopedStorageKey();
      const next = [record, ...uploadedImages].slice(0, 50);
      await AsyncStorage.setItem(scopedStorageKey, JSON.stringify(next));
      setUploadedImages(next);
    } catch {
      console.warn('Failed to save image locally');
    }
  };

  const removeFromLocal = async (publicId: string) => {
    try {
      const scopedStorageKey = await getScopedStorageKey();
      const next = uploadedImages.filter((img) => img.publicId !== publicId);
      await AsyncStorage.setItem(scopedStorageKey, JSON.stringify(next));
      setUploadedImages(next);
    } catch {
      console.warn('Failed to update local image cache');
    }
  };

  const handleCapturePhoto = async () => {
    try {
      const result = await takePhoto();
      if (result) {
        setSuccessMessage(t('photoCapturedSuccess'));
      }
    } catch {
      Alert.alert(t('capturePhotoFailedTitle'), t('capturePhotoFailedBody'));
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await pickImage();
      if (result) {
        setSuccessMessage(t('photoCapturedSuccess'));
      }
    } catch {
      Alert.alert(t('errorTitle'), t('pickImageFailedBody'));
    }
  };

  const handleUploadImage = async () => {
    if (!image?.uri) {
      Alert.alert(t('noImageSelectedTitle'), t('noImageSelectedBody'));
      return;
    }

    try {
      const uploadResult = await uploadImage(image.uri, {
        relatedTo: 'outfit',
        itemType,
        gender,
      }, removeBackground);

      if (uploadResult?.success) {
        await saveToLocal({
          publicId: uploadResult.publicId,
          url: uploadResult.url,
          createdAt: Date.now(),
          fileName: image.uri.split('/').pop(),
        });
        setSuccessMessage(t('imageUploadedSuccess'));
        resetImage();
      } else {
        Alert.alert(t('uploadFailedTitle'), uploadResult?.error || t('uploadFailedBody'));
      }
    } catch (err: any) {
      Alert.alert(t('uploadErrorTitle'), err.message || t('uploadFailedBody'));
    }
  };

  const handleDeleteImage = async (publicId: string) => {
    Alert.alert(t('deleteImageTitle'), t('deleteImageBody'), [
      { text: t('cancel'), onPress: () => {} },
      {
        text: t('deleteAction') || t('deleteImageTitle'),
        onPress: async () => {
          try {
            const success = await deleteImageFromCloudinary(publicId);

              if (success) {
              await removeFromLocal(publicId);
              setSuccessMessage(t('imageDeletedSuccess'));
            } else {
              Alert.alert(t('errorTitle'), t('deleteImageFailed'));
            }
          } catch {
            Alert.alert(t('errorTitle'), t('deleteImageFailed'));
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const renderSavedItem = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        style={styles.galleryItem}
        onPress={() => handleDeleteImage(item.publicId)}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: item.url }}
          style={styles.galleryImage}
        />
        <View style={styles.deleteOverlay}>
          <MaterialCommunityIcons name="delete" size={20} color="#fff" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View
          className="border-b px-4 py-4"
          style={{ backgroundColor: theme.colors.card, borderBottomColor: hexToRgba(theme.colors.primary, 0.08) }}
        >
          <Text className="font-display text-4xl tracking-luxury" style={{ color: theme.colors.primary }}>
            {t('photoStudioTitle')}
          </Text>
          <Text className="mt-1 font-sans text-sm tracking-wide" style={{ color: theme.colors.muted }}>
            {t('photoStudioSubtitle')}
          </Text>
        </View>

        <LuxuryCard className="mx-4 mt-4 px-4 py-3">
          <View className="flex-row items-center">
            <MaterialCommunityIcons name="information-outline" size={18} color={theme.colors.accent} />
            <Text className="ml-3 flex-1 font-sans text-sm font-medium leading-5" style={{ color: theme.colors.primary }}>
              {routeParams?.helperText || t('helperChooseMatch')}
            </Text>
          </View>
        </LuxuryCard>

        {successMessage && <LuxuryBanner tone="success" text={successMessage} className="mx-4 mt-3" />}
        {error && <LuxuryBanner tone="error" text={String(error)} className="mx-4 mt-3" />}

        {/* Preview Section */}
        <View className="px-4 py-4">
          <View
            className="overflow-hidden rounded-[28px] border shadow-lg"
            style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08), shadowColor: '#000', shadowOpacity: theme.name === 'scandi-dark' ? 0.3 : 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }}
          >
            {image?.uri ? (
              <>
                <Image source={{ uri: image.uri }} className="h-[320px] w-full" resizeMode="cover" />
                {image.publicId && (
                  <View className="absolute right-3 top-3 flex-row items-center rounded-full px-3 py-2" style={{ backgroundColor: theme.colors.accent }}>
                    <MaterialCommunityIcons name="cloud-check" size={16} color={theme.colors.background} />
                    <Text className="ml-1 font-sans text-xs font-bold tracking-wider" style={{ color: theme.colors.background }}>
                      {t('uploadedLabel')}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View className="h-[320px] items-center justify-center" style={{ backgroundColor: hexToRgba(theme.colors.primary, 0.04) }}>
                <MaterialCommunityIcons name="camera-plus-outline" size={48} color={theme.colors.muted} />
                <Text className="mt-3 font-display text-2xl tracking-luxury" style={{ color: theme.colors.primary }}>
                  {t('noPhotoYet')}
                </Text>
                <Text className="mt-1 font-sans text-sm" style={{ color: theme.colors.muted }}>
                  {t('tapToStart')}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View className="flex-row gap-3 px-4 py-2">
          <LuxuryButton label={t('cameraLabel')} variant="dark" onPress={handleCapturePhoto} className="flex-1" />
          <LuxuryButton label={t('galleryLabel')} variant="burgundy" onPress={handlePickImage} className="flex-1" />
          <LuxuryButton label={isLoading ? t('uploadingLabel') : t('uploadLabel')} variant="gold" onPress={handleUploadImage} className="flex-1" loading={isLoading} />
        </View>

        <View
          className="mx-4 mt-3 flex-row items-center justify-between rounded-[28px] border p-4"
          style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }}
        >
          <Text style={{ color: theme.colors.primary }}>{t('removeBackgroundLabel')}</Text>
          <Switch value={removeBackground} onValueChange={setRemoveBackground} trackColor={{ false: hexToRgba(theme.colors.primary, 0.12), true: hexToRgba(theme.colors.accent, 0.45) }} thumbColor={removeBackground ? theme.colors.accent : theme.colors.background} />
        </View>

        <View
          className="mx-4 mt-3 rounded-[28px] border p-4"
          style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }}
        >
          <Text className="font-display text-2xl tracking-luxury" style={{ color: theme.colors.primary }}>
            {t('dressTypeLabel')}
          </Text>
          <TouchableOpacity className="mt-3 flex-row items-center justify-between rounded-2xl px-4 py-3" onPress={() => setItemTypeOpen((prev) => !prev)} style={{ backgroundColor: hexToRgba(theme.colors.primary, 0.04), borderWidth: 1, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
            <Text className="font-sans text-sm font-semibold capitalize tracking-wide" style={{ color: theme.colors.primary }}>{itemType}</Text>
            <MaterialCommunityIcons name={itemTypeOpen ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.muted} />
          </TouchableOpacity>
          {itemTypeOpen && (
            <View className="mt-3 overflow-hidden rounded-2xl border" style={{ backgroundColor: theme.colors.background, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
              {(['top', 'bottom', 'dress', 'skirts', 'shoes', 'other'] as const).map((value) => (
                <TouchableOpacity
                  key={value}
                  className="flex-row items-center justify-between border-b px-4 py-3"
                  style={{ borderBottomColor: hexToRgba(theme.colors.primary, 0.06) }}
                  onPress={() => {
                    setItemType(value);
                    setItemTypeOpen(false);
                  }}
                >
                  <Text className="font-sans text-sm font-semibold capitalize tracking-wide" style={{ color: itemType === value ? theme.colors.accent : theme.colors.primary }}>
                    {value}
                  </Text>
                  {itemType === value && (
                    <MaterialCommunityIcons name="check" size={18} color={theme.colors.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text className="mt-5 font-display text-2xl tracking-luxury" style={{ color: theme.colors.primary }}>
            {t('genderLabel')}
          </Text>
          <TouchableOpacity className="mt-3 flex-row items-center justify-between rounded-2xl px-4 py-3" onPress={() => setGenderOpen((prev) => !prev)} style={{ backgroundColor: hexToRgba(theme.colors.primary, 0.04), borderWidth: 1, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
            <Text className="font-sans text-sm font-semibold capitalize tracking-wide" style={{ color: theme.colors.primary }}>{gender}</Text>
            <MaterialCommunityIcons name={genderOpen ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.muted} />
          </TouchableOpacity>
          {genderOpen && (
            <View className="mt-3 overflow-hidden rounded-2xl border" style={{ backgroundColor: theme.colors.background, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
              {(['male', 'female', 'unisex'] as const).map((value) => (
                <TouchableOpacity
                  key={value}
                  className="flex-row items-center justify-between border-b px-4 py-3"
                  style={{ borderBottomColor: hexToRgba(theme.colors.primary, 0.06) }}
                  onPress={() => {
                    setGender(value);
                    setGenderOpen(false);
                  }}
                >
                  <Text className="font-sans text-sm font-semibold capitalize tracking-wide" style={{ color: gender === value ? theme.colors.accent : theme.colors.primary }}>
                    {value}
                  </Text>
                  {gender === value && (
                    <MaterialCommunityIcons name="check" size={18} color={theme.colors.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Gallery Section */}
        <View className="mx-4 mt-4 pb-6">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="font-display text-3xl tracking-luxury" style={{ color: theme.colors.primary }}>
              {t('recentUploadsLabel')}
            </Text>
            <Text className="rounded-full px-3 py-1 font-sans text-xs font-bold tracking-luxe" style={{ backgroundColor: hexToRgba(theme.colors.primary, 0.08), color: theme.colors.accent }}>
              {uploadedImages.length}
            </Text>
          </View>

          {loadingSaved ? (
            <View className="items-center justify-center py-10">
              <ActivityIndicator size="large" color={theme.colors.accent} />
            </View>
          ) : uploadedImages.length > 0 ? (
            <FlatList
              data={uploadedImages}
              keyExtractor={(i) => i.publicId || String(i.createdAt)}
              horizontal
              renderItem={renderSavedItem}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 16 }}
            />
          ) : (
            <View className="items-center justify-center rounded-2xl border border-dashed py-12" style={{ backgroundColor: hexToRgba(theme.colors.primary, 0.03), borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
              <MaterialCommunityIcons name="image-off" size={40} color={theme.colors.muted} />
              <Text className="mt-3 font-display text-2xl tracking-luxury" style={{ color: theme.colors.primary }}>
                {t('noPhotosYetLabel')}
              </Text>
              <Text className="mt-1 font-sans text-sm" style={{ color: theme.colors.muted }}>
                {t('captureOrUploadStart')}
              </Text>
            </View>
          )}
        </View>

        {image?.uri && (
          <LuxuryButton label={t('clearSelectionLabel')} variant="ghost" onPress={resetImage} className="mx-4 mb-6" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default TakePhoto;

const styles = StyleSheet.create({
    galleryItem: {
    marginRight: 10,
    borderRadius: 12,
    overflow: 'hidden' as any,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000' as any,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  
  galleryImage: {
    width: 100,
    height: 100,
    resizeMode: 'cover' as any,
  },
    deleteOverlay: {
    position: 'absolute' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    alignItems: 'center',
    justifyContent: 'center',
  },
    scrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },
});
