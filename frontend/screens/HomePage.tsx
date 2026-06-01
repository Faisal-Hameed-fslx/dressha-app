import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { jwtDecode } from 'jwt-decode';
import moment from 'moment';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LuxuryCard from '../components/Luxury/LuxuryCard';
import { features } from '../Images';
import { useLanguage } from '../providers/LanguageProvider';
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

type PopularPostItem = {
  _id: string;
  username: string;
  profileImage: string;
  itemImage: string;
  itemName: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
};

type StoryFeedItem = {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string;
  isOwnStory: boolean;
  isViewed: boolean;
  hasStory: boolean;
  createdAt: string;
  expiresAt: string | null;
  stories: {
    id: string;
    image: string | null;
    caption: string;
    createdAt: string;
    expiresAt: string | null;
  }[];
};

const STORY_VIEW_DURATION_MS = 4500;

const HomeScreen = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [savedOutfits, setSavedOutfits] = useState<{ [key: string]: any[] }>({});
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; profilePicture: string; followingIds: string[] } | null>(null);
  const [stories, setStories] = useState<StoryFeedItem[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [popularPosts, setPopularPosts] = useState<PopularPostItem[]>([]);
  const [popularLoading, setPopularLoading] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerStoryIndex, setViewerStoryIndex] = useState(0);
  const [viewerItemIndex, setViewerItemIndex] = useState(0);
  const storyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generateDates = () => {
    const today = moment().startOf('day');
    const dates = [];
    for (let i = -3; i < 4; i++) {
      dates.push({
        label: today.clone().add(i, 'day').format('ddd Do MMM'),
      });
    }
    return dates;
  };

  const dates = generateDates();

  const activeViewerStory = stories[viewerStoryIndex];
  const activeViewerSlide = activeViewerStory?.stories?.[viewerItemIndex];

  const handleNavigateToAddOutfit = (dateLabel: string) => {
    navigation.navigate('AddOutfit', { date: dateLabel, outfits: savedOutfits });
  };

  const handleOpenStoryUpload = useCallback(() => {
    navigation.navigate('TakePhoto' as never);
  }, [navigation]);

  const loadPopularThisWeek = useCallback(async () => {
    try {
      setPopularLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setPopularPosts([]);
        return;
      }

      const response = await axios.get(`${localHost}/public-feed?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const sevenDaysAgo = moment().subtract(7, 'days');
      const mapped = (Array.isArray(response.data?.posts) ? response.data.posts : [])
        .filter((post: any) => {
          const createdAt = post.createdAt ? moment(post.createdAt) : null;
          return createdAt ? createdAt.isAfter(sevenDaysAgo) : true;
        })
        .map((post: any) => {
          const firstImage = Array.isArray(post.items)
            ? post.items.find((item: any) => typeof item?.image === 'string' && item.image.trim())?.image
            : null;

          return {
            _id: String(post._id || post.id || `${post.userId}-${post.createdAt || Date.now()}`),
            username: post.username || 'user',
            profileImage: post.profilePicture || firstImage || `https://picsum.photos/100/100?random=${Math.floor(Math.random() * 1000)}`,
            itemImage: firstImage || post.image || post.coverImage || 'https://picsum.photos/400/500?random=1',
            itemName: post.caption || post.occasion || 'Popular outfit',
            createdAt: post.createdAt || new Date().toISOString(),
            likesCount: Number(post.likesCount || 0),
            commentsCount: Number(post.commentsCount || 0),
          };
        })
        .sort((a: PopularPostItem, b: PopularPostItem) => {
          const aScore = (a.likesCount * 2) + a.commentsCount;
          const bScore = (b.likesCount * 2) + b.commentsCount;
          if (bScore !== aScore) return bScore - aScore;
          return +new Date(b.createdAt) - +new Date(a.createdAt);
        })
        .slice(0, 6);

      setPopularPosts(mapped);
    } catch (error) {
      console.error('Failed to load popular this week', error);
      setPopularPosts([]);
    } finally {
      setPopularLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchSavedOutfits = async (userIdValue: string) => {
      if (!userIdValue) return;
      try {
        const token = await AsyncStorage.getItem('token');
        const response = await axios.get(`${localHost}/save-outfit/user/${userIdValue}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const outfits = response.data.reduce((acc: { [key: string]: any[] }, outfit: any) => {
          acc[outfit.date] = outfit.items;
          return acc;
        }, {});
        setSavedOutfits(outfits);
      } catch (error) {
        console.error(error);
      }
    };

    if (isFocused) {
      AsyncStorage.getItem('token')
        .then((token) => {
          if (!token) return null;
          const decoded = jwtDecode(token) as { id?: string };
          return decoded?.id || null;
        })
        .then((uid) => {
          if (!uid) return null;
          fetchSavedOutfits(uid);
          (async () => {
            setStoriesLoading(true);
            try {
              const token = await AsyncStorage.getItem('token');
              if (!token) return;
              const [meResp, storiesResp] = await Promise.all([
                axios.get(`${localHost}/me`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${localHost}/stories`, { headers: { Authorization: `Bearer ${token}` } }),
              ]);

              const me = meResp.data || {};
              const followingIds = Array.isArray(me.following) ? me.following.map((id: any) => String(id)) : [];
              setCurrentUser({
                id: String(uid),
                username: me.username || 'You',
                profilePicture: me.profilePicture || '',
                followingIds,
              });

              const serverStories = Array.isArray(storiesResp.data?.stories) ? storiesResp.data.stories : [];
              const grouped = serverStories.reduce((acc: Record<string, StoryFeedItem>, story: any) => {
                const storyUser = story.userId || {};
                const storyUserId = String(storyUser._id || story.userId || story.userId?.id || '');
                if (!storyUserId) return acc;

                const imageUrl = typeof story.image === 'string' && story.image.trim()
                  ? story.image
                  : (typeof story.outfitId?.items?.[0]?.image === 'string' ? story.outfitId.items[0].image : '');

                const createdAt = story.createdAt ? new Date(story.createdAt).toISOString() : new Date().toISOString();
                const expiresAt = story.expiresAt ? new Date(story.expiresAt).toISOString() : null;
                const isExpired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
                if (isExpired) return acc;

                if (!acc[storyUserId]) {
                  acc[storyUserId] = {
                    id: storyUserId,
                    userId: storyUserId,
                    username: storyUser?.username || 'story',
                    avatarUrl: storyUser?.profilePicture || imageUrl || `https://picsum.photos/100/100?random=${Math.floor(Math.random() * 1000)}`,
                    isOwnStory: String(storyUserId) === String(uid),
                    isViewed: false,
                    hasStory: true,
                    createdAt,
                    expiresAt,
                    stories: [],
                  };
                }

                acc[storyUserId].stories.push({
                  id: String(story._id || `${storyUserId}-${createdAt}`),
                  image: imageUrl || null,
                  caption: typeof story.caption === 'string' ? story.caption : '',
                  createdAt,
                  expiresAt,
                });

                acc[storyUserId].stories.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
                acc[storyUserId].avatarUrl = acc[storyUserId].avatarUrl || imageUrl;
                return acc;
              }, {} as Record<string, StoryFeedItem>);

              const ownStoryGroup = grouped[String(uid)] || {
                id: String(uid),
                userId: String(uid),
                username: me.username || 'You',
                avatarUrl: me.profilePicture || `https://picsum.photos/100/100?random=${Math.floor(Math.random() * 1000)}`,
                isOwnStory: true,
                isViewed: false,
                hasStory: false,
                createdAt: new Date(0).toISOString(),
                expiresAt: null,
                stories: [],
              };

              if (ownStoryGroup.hasStory && ownStoryGroup.stories.length > 0) {
                const latestOwnSlide = ownStoryGroup.stories[ownStoryGroup.stories.length - 1];
                ownStoryGroup.avatarUrl = latestOwnSlide.image || ownStoryGroup.avatarUrl || me.profilePicture || '';
              }

              const followingStories = (Object.values(grouped) as StoryFeedItem[])
                .filter((story) => story.userId !== String(uid) && followingIds.includes(String(story.userId)))
                .sort((a, b) => {
                  const aTime = +new Date(a.stories[a.stories.length - 1]?.createdAt || a.createdAt);
                  const bTime = +new Date(b.stories[b.stories.length - 1]?.createdAt || b.createdAt);
                  return bTime - aTime;
                });

              const mapped = [ownStoryGroup, ...followingStories];
              setStories(mapped);
            } catch (error) {
              console.error('Failed to fetch stories', error);
            } finally {
              setStoriesLoading(false);
            }
          })();

          loadPopularThisWeek();

          return null;
        })
        .catch((error) => console.error(error));
    }

    const unsubscribe = navigation.addListener('focus', () => {
      const state = navigation.getState();
      const params = state.routes[state.index]?.params;
      if (params?.savedOutfits) setSavedOutfits((prev) => ({ ...prev, ...params.savedOutfits }));
    });

    return unsubscribe;
  }, [isFocused, loadPopularThisWeek, navigation]);

  const clearStoryTimer = useCallback(() => {
    if (storyTimerRef.current) {
      clearTimeout(storyTimerRef.current);
      storyTimerRef.current = null;
    }
  }, []);

  const openStoryViewer = useCallback((index: number) => {
    if (!stories[index]) return;
    if (stories[index].isOwnStory && !stories[index].hasStory) {
      handleOpenStoryUpload();
      return;
    }
    setViewerStoryIndex(index);
    setViewerItemIndex(0);
    setStories((prevStories) =>
      prevStories.map((story, i) => (i === index ? { ...story, isViewed: true } : story)),
    );
    setViewerVisible(true);
  }, [handleOpenStoryUpload, stories]);

  const closeStoryViewer = useCallback(() => {
    clearStoryTimer();
    setViewerVisible(false);
  }, [clearStoryTimer]);

  const goToNextStory = useCallback(() => {
    const currentStory = stories[viewerStoryIndex];
    if (!currentStory) return closeStoryViewer();

    if (viewerItemIndex < currentStory.stories.length - 1) {
      setViewerItemIndex((prev) => prev + 1);
      return;
    }

    const nextStoryIndex = viewerStoryIndex + 1;
    if (nextStoryIndex < stories.length) {
      setViewerStoryIndex(nextStoryIndex);
      setViewerItemIndex(0);
      setStories((prevStories) =>
        prevStories.map((story, i) => (i === nextStoryIndex ? { ...story, isViewed: true } : story)),
      );
      return;
    }

    closeStoryViewer();
  }, [closeStoryViewer, stories, viewerItemIndex, viewerStoryIndex]);

  const goToPreviousStory = useCallback(() => {
    if (viewerItemIndex > 0) {
      setViewerItemIndex((prev) => prev - 1);
      return;
    }

    if (viewerStoryIndex > 0) {
      const previousStoryIndex = viewerStoryIndex - 1;
      setViewerStoryIndex(previousStoryIndex);
      setViewerItemIndex(Math.max(stories[previousStoryIndex]?.stories.length - 1 || 0, 0));
    }
  }, [stories, viewerItemIndex, viewerStoryIndex]);

  useEffect(() => {
    if (!viewerVisible) return undefined;
    clearStoryTimer();
    storyTimerRef.current = setTimeout(() => {
      goToNextStory();
    }, STORY_VIEW_DURATION_MS);

    return () => clearStoryTimer();
  }, [clearStoryTimer, viewerVisible, viewerStoryIndex, viewerItemIndex, stories.length, goToNextStory]);

  const storiesEmpty = stories.length === 0;

  const viewerProgress = useMemo(() => {
    const story = activeViewerStory;
    if (!story || story.stories.length === 0) return 0;
    return ((viewerItemIndex + 1) / story.stories.length) * 100;
  }, [activeViewerStory, viewerItemIndex]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.colors.background} translucent={false} />
      <LinearGradient
        colors={
          theme.name === 'scandi-dark'
            ? ['#101010', '#171717', '#1f1f1f']
            : ['#F8F8F8', '#F4F4F4', '#ECECEC']
        }
        style={StyleSheet.absoluteFill}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-4">
          <Text className="font-display text-5xl tracking-luxury" style={{ color: theme.colors.primary }}>{t('homeTitle')}</Text>
          <View className="flex-row items-center ">
            <Ionicons className="px-1" name="notifications-outline" size={24} color={theme.colors.accent} />
            {/* <Ionicons name="search-outline" size={24} color="#C6A962" /> */}
          </View>
        </View>

        {/* Stories */}
        <LuxuryCard className="mx-4 mt-4 pb-1 pl-4 pt-2" style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
          {storiesLoading ? (
            <View className="h-24 items-center justify-center">
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : storiesEmpty ? (
            <View className="h-24 items-center justify-center px-4">
              <Text className="text-sm text-center" style={{ color: theme.colors.muted }}>
                No active stories yet.
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {stories.map((story, i) => (
                <Pressable
                  key={story.id}
                  onPress={() => openStoryViewer(i)}
                  className="mr-4 items-center">
                  <View
                    className="relative items-center justify-center h-16 w-16 rounded-full border-2"
                    style={{ borderColor: story.isViewed ? hexToRgba(theme.colors.primary, 0.18) : theme.colors.accent }}>
                    <Image source={{ uri: story.avatarUrl || currentUser?.profilePicture }} className="h-14 w-14 rounded-full" />
                    {story.isOwnStory && (
                      <View className="absolute bottom-0 right-0 h-5 w-5 items-center justify-center rounded-full border-2" style={{ borderColor: theme.colors.background, backgroundColor: theme.colors.accent }}>
                        <Ionicons name="add" size={12} color={theme.colors.background} />
                      </View>
                    )}
                  </View>
                  <Text className="mt-1 text-[10px] font-medium" style={{ color: theme.colors.muted }}>
                    {story.isOwnStory ? (currentUser?.username || story.username) : story.username}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </LuxuryCard>

        {/* Weekly Planner */}
        <View className="mt-4  flex-row justify-between px-4">
          <Text className="text-lg font-semibold" style={{ color: theme.colors.primary }}>{t('yourWeek')}</Text>
          <Text style={{ color: theme.colors.accent }}>{t('plannerLabel')}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 pl-4">
          {dates.map((date, idx) => {
            const todayLabel = moment().format('ddd Do MMM');
            const outfitForDate =
              savedOutfits[date.label] ||
              (date.label === todayLabel ? savedOutfits[todayLabel] : null);

            return (
              <View key={idx} className="mr-2">
                <Pressable
                  onPress={() => handleNavigateToAddOutfit(date.label)}
                  className="h-48 w-28 overflow-hidden rounded-xl shadow-md"
                  style={{ backgroundColor: outfitForDate ? hexToRgba(theme.colors.accent, 0.1) : theme.colors.card, borderWidth: 1, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
                  {!outfitForDate ? (
                    <View className="flex-1 items-center justify-center">
                      <Text className="text-xl" style={{ color: theme.colors.accent }}>+</Text>
                    </View>
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      {outfitForDate && outfitForDate.length > 0 ? (
                        <Image
                          source={{ uri: outfitForDate[0].image }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                      ) : null}
                    </View>
                  )}
                </Pressable>
                <Text className="mt-1 text-center text-xs" style={{ color: theme.colors.muted }}>{date.label}</Text>
              </View>
            );
          })}
        </ScrollView>

        {/* AI Features */}
        <View className="mt-6 flex-row flex-wrap justify-between px-4">
          {features.map((feature, idx) => (
            <Pressable
              key={idx}
              onPress={() => navigation.navigate(feature.screen)}
              className="mb-4 h-36 w-[48%] overflow-hidden rounded-2xl border"
              style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
              <View className="p-3">
                <Text className="text-[16px] font-bold" style={{ color: theme.colors.primary }}>{t((feature as any).titleKey)}</Text>
                <Text className="mt-1 max-w-[80] text-xs" style={{ color: theme.colors.muted }}>
                  {t((feature as any).descKey)}
                </Text>
              </View>
              <Image
                source={{ uri: feature.image }}
                className="absolute bottom-[-3] right-[-1] h-20 w-20 rounded-lg"
                style={{ transform: [{ rotate: '12deg' }], opacity: 0.9 }}
              />
            </Pressable>
          ))}
        </View>

<View className='mb-24'>
          <LuxuryCard className="mx-4 mb-4 mt-2 px-4 pb-3 pt-4" style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }}>
          <View className="mt-1 flex-row justify-between px-4">
            <Text className="text-lg font-semibold" style={{ color: theme.colors.primary }}>{t('popularThisWeek')}</Text>
            <Pressable onPress={() => navigation.navigate('PublicFeed' as never, { initialFilter: 'popularThisWeek' } as never)}>
              <Text style={{ color: theme.colors.accent }}>{t('more')}</Text>
            </Pressable>
          </View>

          {popularLoading ? (
            <View className="h-56 items-center justify-center">
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : popularPosts.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 pl-4">
              {popularPosts.map((item) => (
                <View key={item._id} className="mr-4 w-36">
                  <Image source={{ uri: item.itemImage }} className="h-44 w-36 rounded-lg" />
                  <View className="mt-2 flex-row items-center">
                    <Image
                      source={{ uri: item.profileImage }}
                      className="mr-2 h-6 w-6 rounded-full"
                    />
                    <Text className="text-xs font-medium" style={{ color: theme.colors.primary }}>{item.username}</Text>
                  </View>
                  <Text className="mt-1 text-xs" style={{ color: theme.colors.muted }}>{item.itemName}</Text>
                  <Text className="mt-1 text-[10px]" style={{ color: theme.colors.accent }}>
                    {item.likesCount} likes · {item.commentsCount} comments
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View className="h-56 items-center justify-center px-4">
              <Text className="text-center text-sm" style={{ color: theme.colors.muted }}>
                No public outfits from this week yet.
              </Text>
            </View>
          )}
        </LuxuryCard>
</View>
      </ScrollView>

      <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={closeStoryViewer}>
        <View className="flex-1 bg-black">
          <View className="absolute left-0 right-0 top-0 z-10 px-4 pt-12">
            <View className="mb-3 flex-row gap-1">
              {activeViewerStory?.stories?.map((slide, index) => (
                <View key={slide.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                  <View
                    className="h-1 rounded-full bg-white"
                    style={{
                      width:
                        index < viewerItemIndex
                          ? '100%'
                          : index === viewerItemIndex
                            ? `${viewerProgress}%`
                            : '0%',
                    }}
                  />
                </View>
              ))}
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Image source={{ uri: activeViewerStory?.avatarUrl }} className="mr-3 h-10 w-10 rounded-full" />
                <View>
                  <Text className="text-base font-semibold text-white">{activeViewerStory?.username}</Text>
                  <Text className="text-xs text-white/70">
                    {activeViewerSlide?.createdAt ? moment(activeViewerSlide.createdAt).fromNow() : ''}
                  </Text>
                </View>
              </View>
              <Pressable onPress={closeStoryViewer} className="h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View className="flex-1 items-center justify-center px-4">
            {activeViewerSlide?.image ? (
              <Image source={{ uri: activeViewerSlide.image }} className="h-full w-full rounded-3xl" resizeMode="contain" />
            ) : (
              <View className="h-96 w-full items-center justify-center rounded-3xl bg-white/10 px-8">
                <Text className="text-center text-lg text-white/90">Story image unavailable</Text>
              </View>
            )}

            {!!activeViewerSlide?.caption && (
              <View className="absolute bottom-10 left-4 right-4 rounded-2xl bg-black/55 px-4 py-3">
                <Text className="text-base text-white">{activeViewerSlide.caption}</Text>
              </View>
            )}
          </View>

          <View className="absolute left-0 right-0 top-0 bottom-0 flex-row">
            <Pressable className="flex-1" onPress={goToPreviousStory} />
            <Pressable className="flex-1" onPress={goToNextStory} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default HomeScreen;
