import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
// remove LinearGradient; use theme-aware background
import React, { useEffect, useState } from 'react';
import { Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../providers/LanguageProvider';
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




const SavedOutfitScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const {user, token } = useAuthStore();
  const [outfits, setOutfits] = useState<any[]>([]);
  const [loading, setloading] = useState(false);
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null);



    useEffect(() => {
      const fetchOutfits = async () => {
        if (!user?._id || !token) return;
        setloading(true);
        try {
          const response = await axios.get(`${localHost}/save-outfit/user/${user?._id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          setOutfits(response.data);
        } catch (error) {
          console.log('Error fetching outfits:', error);
        } finally {
          setloading(false);
        }
      };
      fetchOutfits();
    }, [user?._id, token]);
  

          const sortItems =(items: any) =>{
            const order = ["shirt", "skirts", "pants", "shoes"];
            return items.sort((a:any,b:any)=> order.indexOf(a.type) - order.indexOf(b.type));
          }

          const handleDeleteOutfit = async (outfitId: string) => {
            Alert.alert(t('deleteSavedOutfitTitle'), t('deleteSavedOutfitBody'), [
              { text: t('deleteCancel'), style: 'cancel' },
              {
                text: t('deleteAction'),
                style: 'destructive',
                onPress: async () => {
                  try {
                    if (!token) return;
                    await axios.delete(`${localHost}/save-outfit/${outfitId}`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    setOutfits((prev: any[]) => prev.filter((outfit) => outfit._id !== outfitId));
                    if (selectedOutfitId === outfitId) {
                      setSelectedOutfitId(null);
                    }
                  } catch (error) {
                    console.log('Error deleting outfit:', error);
                  }
                },
              },
            ]);
          };

          const handleSelectOutfit = (outfit: any) => {
            setSelectedOutfitId(outfit._id);
            navigation.navigate('OutfitPage' as never, {
              selectedOutfitItems: Array.isArray(outfit.items) ? outfit.items : [],
              date: outfit.date,
              savedOutfits: {},
            } as never);
          };
  
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.accent} />
          </TouchableOpacity>
          <Text style={{ color: theme.colors.primary, fontSize: 20, fontFamily: 'System' }}>{t('savedOutfitsTitle')}</Text>
          <TouchableOpacity onPress={() => {}}>
            <Ionicons name="star" size={24} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ paddingHorizontal: 8, marginTop: 8 }}>
        {loading ? (
          <ActivityIndicator size={"large"} color={theme.colors.accent} />
        ) : outfits.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 16, color: theme.colors.muted }}>{t('noOutfitsSavedMessage')}</Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {outfits.map((outfit: any, index: number) => {
              const items = Array.isArray(outfit.items) ? sortItems([...outfit.items]) : [];
              return (
                  <View key={`${outfit._id || index}`} style={{ width: '50%', padding: 6 }}>
                  <View
                    style={{
                      backgroundColor: theme.colors.card,
                      borderRadius: 12,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: selectedOutfitId === outfit._id ? theme.colors.accent : hexToRgba(theme.colors.primary, 0.08),
                      elevation: 2,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.08,
                      shadowRadius: 6,
                    }}
                  >
                    {/* fixed image area */}
                    <View style={{ height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.card }}>
                      {items.length === 0 ? (
                        <Text style={{ color: theme.colors.muted }}>{t('noImageLabel')}</Text>
                      ) : (
                        // render overlapping centered images; later items on top
                        items.map((item: any, i: number) => (
                          <Image
                            key={`${outfit._id}-${i}`}
                            source={{ uri: item.image }}
                            resizeMode="contain"
                            style={{
                              position: 'absolute',
                              width: '86%',
                              height: '86%',
                              alignSelf: 'center',
                              zIndex: i + 1,
                            }}
                          />
                        ))
                      )}
                    </View>

                    <View style={{ padding: 12 }}>
                      <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>{outfit?.date}</Text>
                      <Text style={{ color: theme.colors.accent, fontSize: 12, marginTop: 2 }}>{outfit.occasion}</Text>
                      <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 6 }}>
                        {items.map((it: any) => it?.type || '').filter(Boolean).join(', ')}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <TouchableOpacity
                          onPress={() => handleSelectOutfit(outfit)}
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 10,
                            paddingVertical: 8,
                            backgroundColor: selectedOutfitId === outfit._id ? theme.colors.accent : hexToRgba(theme.colors.primary, 0.06),
                            borderWidth: 1,
                            borderColor: selectedOutfitId === outfit._id ? theme.colors.accent : hexToRgba(theme.colors.primary, 0.08),
                          }}
                        >
                          <Text style={{ color: selectedOutfitId === outfit._id ? theme.colors.background : theme.colors.primary, fontSize: 12, fontWeight: '700' }}>
                            {selectedOutfitId === outfit._id ? t('selectedLabel') : t('selectLabel')}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleDeleteOutfit(outfit._id)}
                          style={{
                            width: 42,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 10,
                            paddingVertical: 8,
                            backgroundColor: hexToRgba('#E76F51', 0.12),
                            borderWidth: 1,
                            borderColor: hexToRgba('#E76F51', 0.2),
                          }}
                        >
                          <Ionicons name="trash-outline" size={16} color="#E76F51" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

export default SavedOutfitScreen