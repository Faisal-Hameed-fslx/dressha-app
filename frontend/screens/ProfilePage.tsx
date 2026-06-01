import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Modal, Text, TouchableOpacity, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mpants, mshirts, pants, shoes, skirts, tops } from '../Images';
import { useLanguage } from '../providers/LanguageProvider';
import useAuthStore from '../store/auth';
import localHost from '../store/run';
import { useTheme } from '../theme/ThemeProvider';

const ProfilePage = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('Clothes');
  const [activeCategory, setActiveCategory] = useState('All');
  const { user, token } = useAuthStore();
  const [outfits, setOutfits] = useState([]);
  const [userImages, setUserImages] = useState<any[]>([]);
  const [loading, setloading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const profileNameFromUser = user?.profileName || '';

  // Safe access to user properties
  const username = user?.username || '';
  const email = user?.email || '';
  const followersCount = user?.followers?.length || 0;
  const followingCount = user?.following?.length || 0;
  const profileImage =
    user?.profilePicture ||
    'https://img.freepik.com/free-photo/waist-up-portrait-handsome-serious-unshaven-male-keeps-hands-together-dressed-dark-blue-shirt-has-talk-with-interlocutor-stands-against-white-wall-self-confident-man-freelancer_273609-16320.jpg?t=st=1767543970~exp=1767547570~hmac=bb935c73d4e043384ae0242aeab62d018a78ae5c7ca1553e2b341fc4df291362&w=1480';

  const popularClothes = [...pants, ...mpants, ...shoes, ...tops, ...mshirts, ...skirts];

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

  const fetchOutfits = useCallback(async () => {
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
  }, [token, user?._id]);

  const fetchUserImages = useCallback(async () => {
    if (!user?._id || !token) return;
    try {
      const res = await axios.get(`${localHost}/api/images/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data && Array.isArray(res.data.images)) setUserImages(res.data.images);
      else setUserImages([]);
    } catch (e) {
      console.log('Error fetching user images:', String(e));
      setUserImages([]);
    }
  }, [token, user?._id]);

  useEffect(() => {
    fetchOutfits();
    fetchUserImages();
  }, [fetchOutfits, fetchUserImages]);

  useFocusEffect(
    useCallback(() => {
      fetchUserImages();
      return () => {
        // Reset selection when leaving the screen
        setIsSelectionMode(false);
        setSelectedImages(new Set());
      };
    }, [fetchUserImages])
  );

  const handleImageLoadError = (item: any) => {
    const id = item?._id || item?.id || item?.publicId;
    if (!id) return;
    setUserImages((prev) => prev.filter((img: any) => (img?._id || img?.id || img?.publicId) !== id));
  };

  const toggleSelection = (item: any) => {
    const publicId = item.publicId || item._id;
    if (!publicId) return;
    
    const newSelection = new Set(selectedImages);
    if (newSelection.has(publicId)) {
      newSelection.delete(publicId);
    } else {
      newSelection.add(publicId);
    }
    setSelectedImages(newSelection);
    
    // Turn on selection mode if any item is selected
    if (newSelection.size > 0) {
      setIsSelectionMode(true);
    } else {
      setIsSelectionMode(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedImages.size === 0) return;
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!token) return;
    
    try {
      const deletePromises = Array.from(selectedImages).map(async (publicId) => {
        await axios.delete(`${localHost}/api/images/${encodeURIComponent(publicId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      });
      
      await Promise.all(deletePromises);
      
      // Remove deleted images from local state
      setUserImages((prev) => prev.filter((img) => !selectedImages.has(img.publicId)));
      setSelectedImages(new Set());
      setIsSelectionMode(false);
      Alert.alert('Success', `${selectedImages.size} image(s) deleted successfully`);
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('Error', 'Failed to delete some images');
    } finally {
      setDeleteModalVisible(false);
    }
  };

  const cancelDelete = () => {
    setDeleteModalVisible(false);
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedImages(new Set());
  };

  const filteredClothes =
    activeCategory === 'All'
      ? popularClothes
      : popularClothes.filter((item) => {
          const type = normalizeClothingType(item.type);
          switch (activeCategory) {
            case 'Tops':
              return type === 'top';
            case 'Bottoms':
              return type === 'bottom' || type === 'skirts';
            case 'Outerwear':
              return type === 'top';
            case 'Shoes':
              return type === 'shoes';
            default:
              return true;
          }
        });

  const matchesCategoryForUploaded = (rawType: string, category: string) => {
    const t = normalizeClothingType(rawType);

    if (category === 'All') return true;
    if (category === 'Tops') return ['top', 'dress'].includes(t);
    if (category === 'Bottoms') return ['bottom', 'skirts'].includes(t);
    if (category === 'Outerwear') return ['top'].includes(t);
    if (category === 'Shoes') return ['shoes'].includes(t);

    return true;
  };

  const filteredUserImages = userImages.filter((img: any) =>
    matchesCategoryForUploaded(img?.itemType || img?.type || 'other', activeCategory)
  );

  const sortItems = (items: any) => {
    const order = ['top', 'skirts', 'bottom', 'dress', 'shoes', 'outfit', 'other'];
    return items.sort((a: any, b: any) => order.indexOf(normalizeClothingType(a.type)) - order.indexOf(normalizeClothingType(b.type)));
  };

  // Determine if we're showing user images or sample images
  const showUserImages = filteredUserImages.length > 0;
  const displayItems = showUserImages ? filteredUserImages : filteredClothes;
  const isSampleMode = !showUserImages;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      {/* Selection Mode Header */}
      {isSelectionMode && (
        <View className="flex-row items-center justify-between px-4 py-3 border-b" style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
          <View className="flex-row items-center">
            <TouchableOpacity onPress={exitSelectionMode} className="mr-3">
              <Ionicons name="close" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
            <Text style={{ color: theme.colors.primary, fontSize: 16, fontWeight: '600' }}>
              {selectedImages.size} selected
            </Text>
          </View>
          <TouchableOpacity 
            onPress={handleDeleteSelected}
            style={{ backgroundColor: '#E76F51', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        <View className="flex-row items-center justify-between px-4 pt-2">
          <Text className="font-display text-3xl tracking-luxury" style={{ color: theme.colors.primary }}>
            {profileNameFromUser || username}
          </Text>
          <View className="flex-row gap-3">
            {!isSelectionMode && (
              <TouchableOpacity onPress={() => setIsSelectionMode(true)}>
                <Ionicons name="checkbox-outline" color={theme.colors.accent} size={28} />
              </TouchableOpacity>
            )}
            <Ionicons name="menu-outline" color={theme.colors.muted} size={32} onPress={() => navigation.navigate('SettingPage')} />
          </View>
        </View>

        <View style={{ marginHorizontal: 16, marginTop: 16, borderRadius: 18, borderWidth: 1, overflow: 'hidden', backgroundColor: theme.colors.card, borderColor: theme.name === 'scandi-dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)' }}>
          <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
            <TouchableOpacity style={{ margin: 8, borderRadius: 8, overflow: 'hidden' }}>
              <Image source={{ uri: profileImage }} style={{ width: 80, height: 80, borderRadius: 80, borderWidth: 3, borderColor: theme.colors.accent }} />
            </TouchableOpacity>
            <View style={{ marginLeft: 12 }}>
              <Text style={{ color: theme.colors.muted, fontSize: 14, fontWeight: '500' }}>@{username}</Text>
              <Text style={{ color: theme.colors.muted, fontSize: 12 }}>{email}</Text>

              <View style={{ marginTop: 8, flexDirection: 'row', gap: 12 }}>
                <Text style={{ color: theme.colors.muted }}>
                  <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{followersCount}</Text> {t('followersLabel')}
                </Text>
                <Text style={{ color: theme.colors.muted }}>
                  <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{followingCount}</Text> {t('followingLabel')}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ marginTop: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingBottom: 12 }}>
            <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 10, borderWidth: 1, backgroundColor: hexToRgba(theme.colors.primary, 0.06), borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
              <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>{t('editProfile')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 10, borderWidth: 1, backgroundColor: hexToRgba(theme.colors.accent, 0.14), borderColor: hexToRgba(theme.colors.accent, 0.18) }}>
              <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>{t('shareProfile')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginTop: 20, marginHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
          {[t('tabClothes'), t('tabOutfits'), t('tabCollections')].map((tab) => (
            <TouchableOpacity key={tab} className="pb-2" onPress={() => setActiveTab(tab)}>
              <Text style={{ color: activeTab === tab ? theme.colors.primary : theme.colors.muted, fontSize: 16, fontWeight: '600' }}>{tab}</Text>
              {activeTab === tab && <View style={{ marginTop: 6, height: 3, backgroundColor: theme.colors.accent, borderRadius: 2 }} />}
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'Clothes' && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, paddingLeft: 8 }}>
              {[t('categoryAll'), t('categoryTops'), t('categoryBottoms'), t('categoryOuterwear'), t('categoryShoes')].map((category) => (
                <TouchableOpacity
                  key={category}
                  onPress={() => setActiveCategory(category)}
                  style={{ marginRight: 12, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: activeCategory === category ? theme.colors.accent : theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }}
                >
                  <Text style={{ color: activeCategory === category ? theme.colors.background : theme.colors.primary, fontSize: 14, fontWeight: '600' }}>{category}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View className="px-4 mt-4">
              {displayItems.length === 0 ? (
                <Text style={{ marginTop: 24, textAlign: 'center', color: theme.colors.muted }}>{t('noClothesInCategory')}</Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                  {displayItems.map((item: any, index: number) => {
                    const isSelected = selectedImages.has(item.publicId || item._id);
                    return (
                      <TouchableOpacity
                        key={`${item._id || item.id || index}-${index}`}
                        onPress={() => isSelectionMode && toggleSelection(item)}
                        activeOpacity={0.7}
                        style={{ width: '31.33%', margin: '1%' }}
                      >
                        <View
                          style={{
                            aspectRatio: 1,
                            borderRadius: 12,
                            overflow: 'hidden',
                            backgroundColor: theme.colors.card,
                            borderWidth: isSelected ? 2 : 1,
                            borderColor: isSelected ? theme.colors.accent : hexToRgba(theme.colors.primary, 0.08),
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 3,
                          }}
                        >
                          <Image
                            style={{ width: '100%', height: '100%' }}
                            source={{ uri: item.url || item.image }}
                            resizeMode="cover"
                            onError={() => !isSampleMode && handleImageLoadError(item)}
                          />
                          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600', textTransform: 'capitalize', textAlign: 'center' }}>
                              {toDisplayClothingType(item?.itemType || item?.type || 'other')} ({item?.gender || 'unisex'})
                            </Text>
                          </View>
                          {isSelectionMode && !isSampleMode && (
                            <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: isSelected ? theme.colors.accent : 'rgba(0,0,0,0.5)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                              {isSelected ? (
                                <Ionicons name="checkmark" size={16} color="#fff" />
                              ) : (
                                <Ionicons name="square-outline" size={16} color="#fff" />
                              )}
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}

        {activeTab === 'Outfits' && (
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            {loading ? (
              <ActivityIndicator size={'large'} color={theme.colors.accent} />
            ) : outfits.length === 0 ? (
              <Text style={{ textAlign: 'center', marginTop: 16, color: theme.colors.muted }}>{t('noOutfitsSaved')}</Text>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {outfits.map((outfit: any, index: number) => (
                  <View key={`${outfit._id || index}-${index}`} style={{ width: '50%', padding: 6 }}>
                    <View
                      style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                        backgroundColor: theme.colors.card,
                        borderColor: hexToRgba(theme.colors.primary, 0.08),
                        borderWidth: 1,
                        borderRadius: 12,
                        overflow: 'hidden',
                      }}
                    >
                      <View style={{ height: 150, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.card }}>
                        {sortItems(Array.isArray(outfit.items) ? [...outfit.items] : []).map((item: any, idx: number) => (
                          <Image
                            key={`${outfit._id}-${item._id || idx}-${idx}`}
                            resizeMode="contain"
                            source={{ uri: item.image }}
                            style={{
                              position: 'absolute',
                              width: '86%',
                              height: '86%',
                              alignSelf: 'center',
                              zIndex: idx + 1,
                            }}
                          />
                        ))}
                      </View>
                      <View style={{ padding: 12 }}>
                        <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>{outfit?.date}</Text>
                        <Text style={{ color: theme.colors.accent, fontSize: 12, marginTop: 2 }}>{outfit.occasion}</Text>
                        <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 6 }}>
                          {Array.isArray(outfit.items)
                            ? outfit.items
                                .map((item: any) => toDisplayClothingType(item?.type || (typeof item === 'string' ? item : '')))
                                .filter(Boolean)
                                .join(', ')
                            : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: theme.colors.card, borderRadius: 20, padding: 20, width: '80%', alignItems: 'center' }}>
            <Ionicons name="trash-outline" size={50} color={theme.colors.accent} style={{ marginBottom: 15 }} />
            <Text style={{ color: theme.colors.primary, fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
              Delete {selectedImages.size} Item(s)?
            </Text>
            <Text style={{ color: theme.colors.muted, textAlign: 'center', marginBottom: 20 }}>
              Are you sure you want to delete {selectedImages.size} clothing item(s)? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={cancelDelete}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: hexToRgba(theme.colors.primary, 0.1), alignItems: 'center' }}
              >
                <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#E76F51', alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ProfilePage;

const hexToRgba = (hex: string, alpha = 1) => {
  const cleaned = hex.replace('#', '');
  const bigint = parseInt(cleaned, 16);
  if (Number.isNaN(bigint)) return `rgba(0,0,0,${alpha})`;
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};