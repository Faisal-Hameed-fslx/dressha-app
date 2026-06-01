import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import axios, { isAxiosError } from 'axios';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useAuthStore from '../store/auth';
import localHost from '../store/run';
import { useTheme } from '../theme/ThemeProvider';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);
const ITEM_HEIGHT = SCREEN_HEIGHT;

const PublicFeedScreen = () => {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const isFocused = useIsFocused();
  const [posts, setPosts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [activePost, setActivePost] = useState<any | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const flatlistRef = useRef<any>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 75 }).current;

  const railLift = scrollY.interpolate({
    inputRange: [0, SCREEN_HEIGHT * 0.6, SCREEN_HEIGHT],
    outputRange: [0, -4, -8],
    extrapolate: 'clamp',
  });
  const railFade = scrollY.interpolate({
    inputRange: [0, SCREEN_HEIGHT * 0.3, SCREEN_HEIGHT],
    outputRange: [0.9, 1, 1],
    extrapolate: 'clamp',
  });

  const resolveUserId = (value: any) => String(value?._id ?? value ?? '').trim();

  const formatCommentDate = (value: any) => {
    const raw = value ? new Date(value) : null;
    if (!raw || Number.isNaN(raw.getTime())) return '';
    const now = Date.now();
    const diffMinutes = Math.max(0, Math.floor((now - raw.getTime()) / 60000));
    if (diffMinutes < 1) return 'now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };

  const { token } = useAuthStore();

  const route = useRoute<any>();
  const initialFilter = route?.params?.initialFilter as string | undefined;
  const navigationRef = useRef<any>(null);
  useEffect(() => { navigationRef.current = navigation; }, [navigation]);

  const loadFeed = useCallback(async (nextPage = 1, append = false) => {
    const resp = await axios.get(`${localHost}/public-feed?page=${nextPage}&limit=8`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    setPosts((current) => append ? [...current, ...(resp.data.posts || [])] : (resp.data.posts || []));
    setPage(nextPage);
    setTotal(resp.data.total ?? null);
  }, [token]);

  const loadPopularThisWeek = useCallback(async () => {
    try {
      const resp = await axios.get(`${localHost}/public-feed?limit=50`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const all = Array.isArray(resp.data?.posts) ? resp.data.posts : [];
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const filtered = all
        .filter((p: any) => {
          const created = p?.createdAt ? new Date(p.createdAt).getTime() : 0;
          return created >= sevenDaysAgo;
        })
        .sort((a: any, b: any) => {
          const aScore = (Number(a.likesCount || 0) * 2) + Number(a.commentsCount || 0);
          const bScore = (Number(b.likesCount || 0) * 2) + Number(b.commentsCount || 0);
          if (bScore !== aScore) return bScore - aScore;
          return +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0);
        });

      const marked = filtered.map((p: any) => ({ ...p, isPopular: true }));
      setPosts(marked);
      setPage(1);
      setTotal(marked.length);

      // Ensure we show the top popular card when navigated from Home
      setTimeout(() => {
        try {
          flatlistRef.current?.scrollToOffset({ offset: 0, animated: true });
        } catch {
          // ignore
        }

        // Clear the initialFilter param so the tab behaves normally on subsequent opens
        try {
          navigationRef.current?.setParams?.({ initialFilter: undefined } as any);
        } catch {
          // ignore if navigation can't set params
        }
      }, 80);
    } catch (error) {
      console.warn('Failed to load popular this week', error);
    }
  }, [token]);

  useEffect(() => {
    if (!isFocused) return;
    if (initialFilter === 'popularThisWeek') {
      loadPopularThisWeek().catch((error) => console.warn('Popular feed load failed', error));
    } else {
      loadFeed().catch((error) => console.warn('Public feed load failed', error));
    }
  }, [isFocused, loadFeed, initialFilter, loadPopularThisWeek]);

  const toggleLike = async (post: any) => {
    const prevLiked = !!post.likedByMe;
    const prevCount = Number(post.likesCount || 0);
    const optimisticLiked = !prevLiked;
    setPosts((current) => current.map((item) => item._id === post._id ? { ...item, likedByMe: optimisticLiked, likesCount: Math.max(0, prevCount + (optimisticLiked ? 1 : -1)) } : item));
    try {
      // debug: like toggled
      const token = await AsyncStorage.getItem('token');
      const resp = await axios.post(`${localHost}/outfit/${post._id}/like`, {}, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      setPosts((current) => current.map((item) => item._id === post._id ? { ...item, likedByMe: resp.data.liked, likesCount: resp.data.likesCount } : item));
    } catch (error) {
      setPosts((current) => current.map((item) => item._id === post._id ? { ...item, likedByMe: prevLiked, likesCount: prevCount } : item));
      console.warn('Public feed like failed', error);
    }
  };

  const toggleFollow = async (post: any) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || !post?.userId) {
        navigation.navigate('SignIn');
        return;
      }
      const endpoint = post.isFollowed ? 'unfollow' : 'follow';
      const resp = await axios.post(`${localHost}/user/${post.userId}/${endpoint}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setPosts((current) => current.map((item) => item.userId === post.userId ? { ...item, isFollowed: !!resp.data.following } : item));
    } catch (error) {
      console.warn('Follow toggle failed', error);
    }
  };

  const openComments = async (post: any) => {
    setActivePost(post);
    setCommentsVisible(true);
    setCommentsLoading(true);
    setComments([]);
    setCommentText('');
    setCommentError(null);
    try {
      const resp = await axios.get(`${localHost}/outfit/${post._id}/comments?page=1&limit=50`);
      setComments(resp.data.comments || []);
    } catch (error) {
      console.warn('Load public comments failed', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = async () => {
    if (!activePost || commentBusy) return;
    const trimmed = commentText.trim();
    if (!trimmed) {
      setCommentError('Write a comment before posting.');
      return;
    }
    if (trimmed.length > 280) {
      setCommentError('Comments must be 280 characters or less.');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticComment = {
      _id: tempId,
      text: trimmed,
      createdAt: new Date().toISOString(),
      user: { username: 'You', profilePicture: null },
    };

    setCommentBusy(true);
    setCommentError(null);
    setComments((current) => [optimisticComment, ...current]);

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        navigation.navigate('SignIn');
        setComments((current) => current.filter((comment) => comment._id !== tempId));
        return;
      }
      const resp = await axios.post(
        `${localHost}/outfit/${activePost._id}/comment`,
        { text: trimmed },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      if (resp.data?.comment) {
        setCommentText('');
        setComments((current) => current.map((comment) => comment._id === tempId ? {
          _id: resp.data.comment._id || tempId,
          text: resp.data.comment.text,
          createdAt: resp.data.comment.createdAt,
          user: resp.data.comment.user || { username: 'You', profilePicture: null },
        } : comment));
      }
    } catch (error) {
      setComments((current) => current.filter((comment) => comment._id !== tempId));
      const message = isAxiosError(error)
        ? (error.response?.data?.error || error.response?.data?.message || error.message)
        : String(error);
      setCommentError(message || 'Failed to post comment.');
      console.warn('Public comment submit failed', message);
    } finally {
      setCommentBusy(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const cover = item?.items?.[0]?.image || item?.image;
    return (
      <View style={{ height: ITEM_HEIGHT, backgroundColor: theme.colors.background }}>
        <View style={{ flex: 1 }}>
          <Animated.View style={{ flex: 1, overflow: 'hidden', backgroundColor: '#000' }}>
            {item?.isPopular ? (
              <View style={{ position: 'absolute', left: 12, top: 12, zIndex: 30, transform: [{ rotate: '-12deg' }], backgroundColor: theme.colors.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>Popular</Text>
              </View>
            ) : null}
            {/* Adjust ITEM_HEIGHT or the absolute overlay positions if you want more or less space for the image and text. */}
            <Animated.Image
              source={{ uri: cover }}
              resizeMode="contain"
              style={{
                width: '100%',
                height: '100%',
                transform: [{ scale: scrollY.interpolate({
                  inputRange: [SCREEN_HEIGHT * 0.2, SCREEN_HEIGHT, SCREEN_HEIGHT * 1.8],
                  outputRange: [1.04, 1, 1.04],
                  extrapolate: 'clamp',
                }) }],
              }}
            />

            {/* Bottom overlay positioned above tab navigator; adjust BOTTOM_OFFSET to match your tab height */}
            <Animated.View style={{ position: 'absolute', left: 14, right: 88, bottom: 110, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.42)', transform: [{ translateY: railLift }], opacity: railFade }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Pressable onPress={() => {
                  const userId = resolveUserId(item.userId);
                  if (!userId) return;
                  navigation.navigate('PublicProfilePage', { userId, username: item.username, profilePic: item.profilePicture });
                }}>
                  <Image source={{ uri: item.profilePicture }} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' }} />
                </Pressable>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Pressable onPress={() => {
                    const userId = resolveUserId(item.userId);
                    if (!userId) return;
                    navigation.navigate('PublicProfilePage', { userId, username: item.username, profilePic: item.profilePicture });
                  }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>{item.profileName || item.username}</Text>
                  </Pressable>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }} numberOfLines={1}>{'@' + (item.username || '')}</Text>
                </View>
              </View>

              <Text style={{ color: '#fff', fontSize: 13, lineHeight: 19, marginBottom: 8 }} numberOfLines={3}>{item.caption || 'Tap the post for comments and details.'}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 11 }}>{item.occasion || 'Everyone'}</Text>
            </Animated.View>

            <Animated.View style={{ position: 'absolute', right: 10, top: '34%', alignItems: 'center', gap: 16, transform: [{ translateY: railLift }], opacity: railFade }}>
              <Pressable onPress={() => toggleLike(item)} style={{ alignItems: 'center' }}>
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={item.likedByMe ? 'heart' : 'heart-outline'} size={25} color={item.likedByMe ? '#ff6b6b' : '#fff'} />
                </View>
                <Text style={{ color: '#fff', marginTop: 4, fontSize: 12 }}>{item.likesCount || 0}</Text>
              </Pressable>
              <Pressable onPress={() => openComments(item)} style={{ alignItems: 'center' }}>
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="chatbubble-outline" size={22} color="#fff" />
                </View>
                <Text style={{ color: '#fff', marginTop: 4, fontSize: 12 }}>{item.commentsCount || 0}</Text>
              </Pressable>
              <Pressable onPress={() => toggleFollow(item)} style={{ alignItems: 'center' }}>
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: item.isFollowed ? 'rgba(255,255,255,0.16)' : theme.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={item.isFollowed ? 'person-remove-outline' : 'person-add-outline'} size={22} color={item.isFollowed ? '#fff' : '#fff'} />
                </View>
                <Text style={{ color: '#fff', marginTop: 4, fontSize: 12 }}>{item.isFollowed ? 'Following' : 'Follow'}</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AnimatedFlatList
        ref={(r) => { flatlistRef.current = r; }}
        data={posts}
        keyExtractor={(item, index) => String((item as any)?._id || index)}
        renderItem={renderItem}
        pagingEnabled
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        initialNumToRender={1}
        windowSize={3}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        viewabilityConfig={viewabilityConfig}
        onEndReachedThreshold={0.6}
        onEndReached={async () => {
          if (loadingMore) return;
          if (total !== null && posts.length >= total) return;
          setLoadingMore(true);
          try {
            await loadFeed(page + 1, true);
          } catch (error) {
            console.warn('Public feed pagination failed', error);
          } finally {
            setLoadingMore(false);
          }
        }}
        ListEmptyComponent={(
          <View style={{ flex: 1, minHeight: SCREEN_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: theme.colors.muted }}>No public outfits yet.</Text>
          </View>
        )}
      />

      <Modal transparent visible={commentsVisible} animationType="slide" onRequestClose={() => setCommentsVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.48)' }} onPress={() => setCommentsVisible(false)} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: SCREEN_HEIGHT * 0.58, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: theme.colors.card, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.24, shadowOffset: { width: 0, height: -8 }, shadowRadius: 24, elevation: 14 }}>
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 8 }}>
            <View style={{ width: 48, height: 5, borderRadius: 999, backgroundColor: theme.colors.muted, opacity: 0.35 }} />
          </View>

          <View style={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: theme.colors.primary, fontSize: 18, fontWeight: '900' }}>Comments</Text>
              <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 2 }}>{activePost?.commentsCount || 0} comments</Text>
            </View>
            <Pressable onPress={() => setCommentsVisible(false)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.colors.background }}>
              <Text style={{ color: theme.colors.primary, fontWeight: '800' }}>Close</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 18 }}>
            {commentsLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={{ color: theme.colors.muted }}>Loading comments...</Text>
              </View>
            ) : comments.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={{ color: theme.colors.muted }}>Be the first to comment.</Text>
              </View>
            ) : (
              comments.map((comment, index) => (
                <View key={comment._id || index} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' }}>
                  <Image
                    source={{ uri: comment?.user?.profilePicture || activePost?.profilePicture || 'https://picsum.photos/100' }}
                    style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={{ color: theme.colors.primary, fontWeight: '800' }}>{comment?.user?.profileName || comment?.user?.username || 'User'}</Text>
                      <Text style={{ color: theme.colors.muted, fontSize: 12 }}>{formatCommentDate(comment?.createdAt)} · {'@' + (comment?.user?.username || '')}</Text>
                    </View>
                    <Text style={{ color: theme.colors.primary, marginTop: 4, lineHeight: 19 }}>{comment?.text || ''}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }}>
                      <Pressable>
                        <Text style={{ color: theme.colors.muted, fontSize: 12, fontWeight: '700' }}>Reply</Text>
                      </Pressable>
                      <Pressable>
                        <Text style={{ color: theme.colors.muted, fontSize: 12, fontWeight: '700' }}>0 replies</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', backgroundColor: theme.colors.card }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chatbubble-outline" size={18} color={theme.colors.muted} />
            </View>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment..."
              placeholderTextColor={theme.colors.muted}
              maxLength={280}
              style={{ flex: 1, minHeight: 46, maxHeight: 90, borderRadius: 18, backgroundColor: theme.colors.background, paddingHorizontal: 14, paddingVertical: 12, color: theme.colors.primary }}
            />
            <Pressable onPress={submitComment} style={{ paddingHorizontal: 16, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accent, minWidth: 72 }}>
              <Text style={{ color: '#fff', fontWeight: '900' }}>{commentBusy ? '...' : 'Post'}</Text>
            </Pressable>
          </View>
          {commentError ? (
            <Text style={{ color: '#ff8a8a', fontSize: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>{commentError}</Text>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default PublicFeedScreen;