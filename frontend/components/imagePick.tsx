import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../providers/LanguageProvider';
import { useTheme } from '../theme/ThemeProvider';


interface LuxuryImagePickerProps {
  currentImage?: string | null;
  onImagePicked: (uri: string) => void;
}

const ImagePick: React.FC<LuxuryImagePickerProps> = ({ currentImage, onImagePicked }) => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const { theme } = useTheme();
  const { t } = useLanguage();

  const pickImage = async () => {
    try {
      setLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        setPreview(uri);
        onImagePicked(uri);
      }
    } catch (error) {
      console.error("ImagePicker Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="items-center justify-center my-4">
      <TouchableOpacity 
        onPress={pickImage}
        disabled={loading}
        className="h-32 w-32 items-center justify-center overflow-hidden rounded-full border shadow-lg"
        style={{ backgroundColor: theme.colors.card, borderColor: 'rgba(0,0,0,0.08)', shadowColor: '#000', shadowOpacity: theme.name === 'scandi-dark' ? 0.28 : 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.accent} />
        ) : preview ? (
          <Image source={{ uri: preview }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="items-center">
            <MaterialCommunityIcons name="camera-plus-outline" size={36} color={theme.colors.muted} />
            <Text className="mt-2 font-display text-[10px] uppercase tracking-widest" style={{ color: theme.colors.primary }}>{t('uploadLabel')}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default ImagePick;
// 