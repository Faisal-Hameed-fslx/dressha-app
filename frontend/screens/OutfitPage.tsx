import Ionicons from '@expo/vector-icons/build/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import { jwtDecode } from "jwt-decode";
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, Text, TouchableOpacity, View } from 'react-native';

import { ScrollView } from 'react-native-gesture-handler';
import { Menu, Switch } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import LuxuryButton from '../components/Luxury/LuxuryButton';
import LuxuryCard from '../components/Luxury/LuxuryCard';
import LuxuryInput from '../components/Luxury/LuxuryInput';
import { useLanguage } from '../providers/LanguageProvider';
import localHost from '../store/run';
import { useTheme } from '../theme/ThemeProvider';

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


interface ClothingItem {
  id: string;
  image?: string;
  emoji?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  type: 'top' | 'bottom' | 'dress' | 'skirts' | 'shoes' | 'outfit' | 'other' | 'emoji';
}

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
const OutfitPage = () => {
  const route = useRoute();
  const { selectedOutfitItems, date, savedOutfits, existingOutfitId, initialCaption, initialOccasion, initialVisibility, initialIsOotd, backgroundColor = '#ffffff', designCanvasWidth, designCanvasHeight } = route.params as {
    selectedOutfitItems: ClothingItem[];
    date: string;
    savedOutfits: { [key: string]: any[] };
    existingOutfitId?: string;
    initialCaption?: string;
    initialOccasion?: string;
    initialVisibility?: string;
    initialIsOotd?: boolean;
    backgroundColor?: string;
    designCanvasWidth?: number;
    designCanvasHeight?: number;
  };
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [caption, setCaption] = useState('');
  const [isOotd, setIsOotd] = useState(false);
  const [occasion, setOccasion] = useState('Work');
  const [visibility, setVisibility] = useState('Everyone');
  const [occasionMenuVisible, setOccasionMenuVisible] = useState(false);
  const [visibilityMenuVisible, setVisibilityMenuVisible] = useState(false);
  const [Loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [storiesVisible, setStoriesVisible] = useState(false);
  const [stories, setStories] = useState<any[]>([]);
  const outfitCanvasRef = React.useRef<any>(null);
  const baseUrl = localHost

  // Preview/capture canvas target size (use design canvas size when available to avoid scaling gaps)
  const previewCanvasWidth = (designCanvasWidth && typeof designCanvasWidth === 'number') ? designCanvasWidth : 360;
  const previewCanvasHeight = (designCanvasHeight && typeof designCanvasHeight === 'number') ? designCanvasHeight : 520;

  

  useEffect(() => {
    if (initialCaption !== undefined) setCaption(initialCaption);
    if (initialOccasion) setOccasion(initialOccasion);
    if (initialVisibility) setVisibility(initialVisibility);
    if (typeof initialIsOotd === 'boolean') setIsOotd(initialIsOotd);
  }, [initialCaption, initialOccasion, initialVisibility, initialIsOotd]);

  useEffect(()=>{
    const fetchToken = async ()=>{
      try{
        const token = await AsyncStorage.getItem("token");
        if(token){
          const decoded = jwtDecode(token) as {id:string};
          setUserId(decoded.id)
        }
        else{
          Alert.alert(t('errorTitle'), t('authNoToken'));
        }
      }catch (error){
        console.log("Failed to fetch token", error)
        Alert.alert(t('errorTitle'), t('authFailed'))
      }
    }
    fetchToken();
  },[t])

  const fetchMyStories = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const resp = await axios.get(`${baseUrl}/stories/user/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
      setStories(resp.data.stories || []);
      setStoriesVisible(true);
    } catch (error) {
      console.error('Fetch stories failed', error);
      Alert.alert(t('errorTitle'), 'Failed to fetch stories');
    }
  };

  const captureOutfitCanvas = async () => {
    if (!outfitCanvasRef.current?.capture) {
      throw new Error(t('outfitCanvasUnavailable'));
    }

    const captured = await outfitCanvasRef.current.capture({
      format: 'jpg',
      quality: 0.9,
      result: 'data-uri',
    });

    if (typeof captured !== 'string' || !captured.startsWith('data:image/')) {
      throw new Error(t('failedCapture'));
    }

    return captured;
  };

  const handleSave = async() =>{
    if(!userId){
      Alert.alert(t('errorTitle'), t('authFailed'))
      return
    }
    setLoading(true)
    try{
      const compositeImage = await captureOutfitCanvas();

      const validItems = [{
        id: `outfit-${Date.now()}`,
        type: 'outfit',
        image: compositeImage,
        x: 0,
        y: 0,
        width: previewCanvasWidth,
        height: previewCanvasHeight,
      }];

      const outfitData = {
        userId,
        date,
        items: validItems,
        caption,
        visibility,
        isOotd,
        occasion,
      }

      const token = await AsyncStorage.getItem("token");
      const response = existingOutfitId
        ? await axios.patch(`${baseUrl}/save-outfit/${existingOutfitId}`, outfitData, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          })
        : await axios.post(`${baseUrl}/save-outfit`, outfitData, {
            headers: {
              "Content-Type":"application/json",
              Authorization: `Bearer ${token}`
            }
          });
      const updatedOutfits = {...savedOutfits, [date]:response.data.outfit.items};
      if (existingOutfitId) {
        navigation.goBack();
      } else {
        navigation.reset({
          index:0,
          routes:[{name:"Tabs", params:{screen:"Home", params:{savedOutfits:updatedOutfits}}}]
        })
      }
    }catch(error){
      console.log("Save error", (error as any)?.message || error);
    }
    finally{
      setLoading(false);
    };
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }}>
<ScrollView showsVerticalScrollIndicator={false}>
        
      <View className="p-4">
        <View className="flex-row items-center justify-between rounded-2xl border p-3" style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
          <TouchableOpacity onPress={() => navigation.goBack()}  >
            <Ionicons name="arrow-back" size={24} color={theme.colors.accent} />
          </TouchableOpacity>
          <LuxuryButton label={t('newOutfitLabel')} onPress={() => navigation.navigate('AddOutfit')} variant="gold" />
        </View>
      </View>
      
      <View className="mx-4 mb-2">
        <View className="rounded-2xl border p-4" style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08), overflow: 'hidden', height: 520 }}>
            <View style={{ position: 'absolute', right: 12, top: 12, zIndex: 50 }}>
                <TouchableOpacity onPress={fetchMyStories} style={{ backgroundColor: hexToRgba(theme.colors.primary, 0.06), paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
                <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>View Stories</Text>
              </TouchableOpacity>
            </View>
          {(() => {
            if (!selectedOutfitItems || selectedOutfitItems.length === 0) {
              return (
                <View className="items-center justify-center py-12">
                  <Text style={{ color: theme.colors.muted }}>{t('noItemsInOutfit')}</Text>
                </View>
              );
            }

            // Preview/capture canvas size and scale items from the design canvas dimensions.
            const canvasWidth = previewCanvasWidth;
            const canvasHeight = previewCanvasHeight;
            const designW = (designCanvasWidth && typeof designCanvasWidth === 'number') ? designCanvasWidth : 360;
            const designH = (designCanvasHeight && typeof designCanvasHeight === 'number') ? designCanvasHeight : 520;
            const scaleX = canvasWidth / designW;
            const scaleY = canvasHeight / designH;

            return (
              <ViewShot
                ref={outfitCanvasRef}
                options={{ format: 'jpg', quality: 0.9, result: 'data-uri' }}
                style={{
                  position: 'relative',
                  width: canvasWidth,
                  height: canvasHeight,
                  alignSelf: 'center',
                  backgroundColor,
                }}
              >
                <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor }} />
                
                {selectedOutfitItems
                  .slice()
                  .sort((a, b) => {
                    const order: any = { top: 1, skirts: 2, bottom: 3, dress: 3, shoes: 4, emoji: 5, outfit: 6, other: 7 };
                    return (order[normalizeClothingType(a.type)] || 5) - (order[normalizeClothingType(b.type)] || 5);
                  })
                  .map((item) => {
                    const normalizedType = normalizeClothingType(item.type);
                    const itemWidth = (item.width || 200) * scaleX;
                    const itemHeight = (item.height || (normalizedType === 'shoes' ? 120 : 200)) * scaleY;
                    const left = (item.x || 0) * scaleX;
                    const top = (item.y || 0) * scaleY;

                    if (item.emoji) {
                      return (
                        <View
                          key={item.id}
                          style={{
                            position: 'absolute',
                            left,
                            top,
                            width: itemWidth,
                            height: itemHeight,
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 25,
                          }}
                        >
                          <Text style={{ fontSize: Math.min(itemWidth, itemHeight) * 0.6 }}>{item.emoji}</Text>
                        </View>
                      );
                    }

                    if (!item.image) return null;

                    return (
                      <Image
                        key={item.id}
                        resizeMode="contain"
                        source={{ uri: item.image }}
                        style={{
                          position: 'absolute',
                          left,
                          top,
                          width: itemWidth,
                          height: itemHeight,
                          zIndex: normalizedType === 'top' || normalizedType === 'skirts' ? 20 : 10,
                        }}
                      />
                    );
                  })}
              </ViewShot>
            );
          })()}
        </View>
      </View>
          <Modal visible={storiesVisible} animationType="slide" onRequestClose={() => setStoriesVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12 }}>
            <Text style={{ color: theme.colors.primary, fontSize: 18, fontWeight: '700' }}>My Stories</Text>
            <TouchableOpacity onPress={() => setStoriesVisible(false)}>
              <Text style={{ color: theme.colors.accent }}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 12 }}>
            {stories.length === 0 && <Text style={{ color: theme.colors.muted }}>No active stories</Text>}
              {stories.map((s) => (
                <View key={String(s._id)} style={{ marginBottom: 16 }}>
                  {s.image ? <Image source={{ uri: s.image }} style={{ width: '100%', height: 420, borderRadius: 12 }} resizeMode="contain" /> : null}
                  <Text style={{ color: theme.colors.muted, marginTop: 8 }}>{s.caption}</Text>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      
      <LuxuryCard className="mx-4 mb-1">
      <View className="px-4 pt-4">
        <LuxuryInput
          containerClassName="pb-2"
          placeholder={t('addCaptionPlaceholder')}
          value={caption}
          onChangeText={setCaption}
        />

        <View className="mt-3">
          <View className="flex-row items-center justify-between">
            <Text style={{ color: theme.colors.muted }}>{t('dateLabel')}</Text>
            <Text style={{ color: theme.colors.primary }}>{date || t('todayLabel')}</Text>
          </View>
          <View className="flex-row items-center justify-between" style={{ paddingVertical: 8 }}>
            <Text style={{ color: theme.colors.muted }}>{t('addToOotd')}</Text>
            <Switch
              value={isOotd}
              onValueChange={setIsOotd}
              color={theme.colors.accent}
              trackColor={{ false: hexToRgba(theme.colors.primary, 0.18), true: hexToRgba(theme.colors.accent, 0.45) }}
            />
          </View>
          <View className="mb-1 flex-row items-center justify-between">
            <Text style={{ color: theme.colors.muted }}>{t('occasionLabelShort')}</Text>
            <Menu
              visible={occasionMenuVisible}
              onDismiss={() => setOccasionMenuVisible(false)}
              anchor={
                <TouchableOpacity onPress={() => setOccasionMenuVisible(true)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: hexToRgba(theme.colors.primary, 0.06), borderColor: hexToRgba(theme.colors.primary, 0.08), borderWidth: 1, minWidth: 88, alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>{occasion}</Text>
                </TouchableOpacity>
              }>
              {[t('occasionWork'), t('occasionCasual'), t('occasionFormal'), t('occasionParty'), 'Wedding', t('occasionInterview')].map((opt) => (
                <Menu.Item
                  key={opt}
                  onPress={() => {
                    setOccasion(opt);
                    setOccasionMenuVisible(false);
                  }}
                  title={opt}
                />
              ))}
            </Menu>
          </View>
          <View className="mt-1 flex-row items-center justify-between">
            <Text style={{ color: theme.colors.muted }}>{t('visibilityLabel')}</Text>
            <Menu
              visible={visibilityMenuVisible}
              onDismiss={() => setVisibilityMenuVisible(false)}
              anchor={
                <TouchableOpacity onPress={() => setVisibilityMenuVisible(true)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: hexToRgba(theme.colors.primary, 0.06), borderColor: hexToRgba(theme.colors.primary, 0.08), borderWidth: 1, minWidth: 88, alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>{visibility}</Text>
                </TouchableOpacity>
              }>
              {[t('visibilityEveryone'), t('visibilityPrivate'), t('visibilityFollowers')].map((opt) => (
                <Menu.Item
                  key={opt}
                  onPress={() => {
                    setVisibility(opt);
                    setVisibilityMenuVisible(false);
                  }}
                  title={opt}
                />
              ))}
            </Menu>
          </View>


        </View>
        </View>
            <LuxuryButton label={Loading ? t('savingLabel') : t('saveOutfitLabel')} variant="gold" onPress={handleSave} className="mx-4 my-4" />
      </LuxuryCard>
</ScrollView>
          
    </SafeAreaView>
  );
};

export default OutfitPage;
