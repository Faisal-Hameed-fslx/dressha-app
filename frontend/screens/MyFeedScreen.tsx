import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import useAuthStore from '../store/auth';
import localHost from '../store/run';
import { useTheme } from '../theme/ThemeProvider';

const hexToRgba = (hex: string, alpha = 1) => {
  const cleaned = hex.replace('#', '');
  const bigint = parseInt(cleaned, 16);
  if (Number.isNaN(bigint)) return `rgba(0,0,0,${alpha})`;
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const MyFeedScreen = () => {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { user, token } = useAuthStore();
  const isFocused = useIsFocused();
  const [outfits, setOutfits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOutfits = async () => {
      if (!user?._id || !token) return;
      setLoading(true);
      try {
        const response = await axios.get(`${localHost}/save-outfit/user/${user._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setOutfits(response.data || []);
      } catch (error) {
        console.log('Error fetching outfits:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isFocused) fetchOutfits();
  }, [isFocused, token, user?._id]);

  const sortItems = (items: any) => {
    const order = ['shirt', 'skirts', 'pants', 'shoes'];
    return [...items].sort((a: any, b: any) => order.indexOf(a.type) - order.indexOf(b.type));
  };

  const handleDeleteOutfit = async (outfitId: string) => {
    Alert.alert('Delete outfit', 'Delete this outfit from your feed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (!token) return;
            await axios.delete(`${localHost}/save-outfit/${outfitId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            setOutfits((prev) => prev.filter((outfit) => outfit._id !== outfitId));
          } catch (error) {
            console.log('Error deleting outfit:', error);
          }
        },
      },
    ]);
  };

  const openEditor = (outfit: any, duplicate = false) => {
    navigation.navigate('OutfitPage' as never, {
      selectedOutfitItems: Array.isArray(outfit.items) ? outfit.items : [],
      date: outfit.date,
      savedOutfits: {},
      existingOutfitId: duplicate ? undefined : outfit._id,
      initialCaption: outfit.caption || '',
      initialOccasion: outfit.occasion || 'Casual',
      initialVisibility: outfit.visibility || 'Everyone',
      initialIsOotd: !!outfit.isOotd,
    } as never);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.primary, fontSize: 22, fontWeight: '800' }}>My Feed</Text>
          <Pressable onPress={() => navigation.navigate('AddOutfit' as never)}>
            <Ionicons name="add-circle-outline" size={28} color={theme.colors.accent} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : outfits.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>Save outfits to build your private feed.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {outfits.map((outfit, index) => {
            const items = Array.isArray(outfit.items) ? sortItems(outfit.items) : [];
            const cover = items[0]?.image;
            return (
              <View key={outfit._id || index} style={{ marginHorizontal: 12, marginBottom: 14, borderRadius: 24, overflow: 'hidden', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
                <Pressable onPress={() => openEditor(outfit, true)}>
                  <View style={{ height: 470, backgroundColor: hexToRgba(theme.colors.primary, 0.03) }}>
                    {cover ? (
                      <Image source={{ uri: cover }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: theme.colors.muted }}>No image</Text>
                      </View>
                    )}
                    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.25)' }}>
                      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{outfit.caption || 'Saved outfit'}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.86)', marginTop: 4 }}>{outfit.occasion || 'Casual'} · {outfit.visibility || 'Everyone'}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.86)', marginTop: 4, fontSize: 12 }}>{items.map((item: any) => item?.type || '').filter(Boolean).join(' · ')}</Text>
                    </View>
                  </View>
                </Pressable>

                  <View style={{ padding: 14 }}>
                  <Text style={{ color: theme.colors.primary, fontWeight: '700', marginBottom: 10 }}>{outfit.date}</Text>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <View style={{ flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name="heart-outline" size={18} color={theme.colors.primary} />
                          <Text style={{ color: theme.colors.primary, fontWeight: '800' }}>{(outfit.likes || []).length}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name="chatbubble-outline" size={18} color={theme.colors.primary} />
                          <Text style={{ color: theme.colors.primary, fontWeight: '800' }}>{(outfit.comments || []).length}</Text>
                        </View>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => openEditor(outfit, true)}
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: 'center', backgroundColor: hexToRgba(theme.colors.primary, 0.08) }}
                    >
                      <Text style={{ color: theme.colors.primary, fontWeight: '800' }}>Add More</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteOutfit(outfit._id)}
                      style={{ width: 52, paddingVertical: 10, borderRadius: 14, alignItems: 'center', backgroundColor: hexToRgba('#E76F51', 0.14) }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#E76F51" />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default MyFeedScreen;