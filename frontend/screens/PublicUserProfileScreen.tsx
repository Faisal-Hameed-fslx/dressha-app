import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios, { isAxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import localHost from '../store/run';
import { useTheme } from '../theme/ThemeProvider';


type RouteParams = {
  userId?: string;
  username?: string;
  profilePic?: string;
};

const PublicUserProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { theme } = useTheme();
  const colors = theme.colors;
  const params = (route.params as RouteParams) || {};

  const normalizedUserId = String(params.userId ?? '').trim();
  const userId = /^[0-9a-fA-F]{24}$/.test(normalizedUserId) ? normalizedUserId : null;
  const fallbackUsername = params.username ?? 'Anonymous';
  const fallbackProfilePic = params.profilePic ?? require('../assets/icon.png');

  const [profile, setProfile] = useState<{ username?: string; profilePicture?: string; followersCount?: number; isFollowed?: boolean } | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!userId) {
        setProfile({ username: fallbackUsername, profilePicture: typeof fallbackProfilePic === 'string' ? fallbackProfilePic : undefined, followersCount: 0, isFollowed: false });
        setPosts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [profileResp, postsResp] = await Promise.all([
          axios.get(`${localHost}/user/${userId}/profile`, { headers }),
          axios.get(`${localHost}/user/${userId}/public-posts`, { headers }),
        ]);
        setProfile(profileResp.data || null);
        setPosts(postsResp.data?.posts || []);
      } catch (error) {
        const status = isAxiosError(error) ? error.response?.status : null;
        if (status !== 404) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('load public profile', errorMessage);
        }
        setProfile({ username: fallbackUsername, profilePicture: typeof fallbackProfilePic === 'string' ? fallbackProfilePic : undefined, followersCount: 0, isFollowed: false });
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [fallbackProfilePic, fallbackUsername, userId]);

  const toggleFollow = async () => {
    if (!userId || followBusy) return;
    const nextFollowed = !profile?.isFollowed;
    const previous = profile;
    setFollowBusy(true);
    setProfile((current) => current ? { ...current, isFollowed: nextFollowed, followersCount: Math.max(0, (current.followersCount || 0) + (nextFollowed ? 1 : -1)) } : current);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        navigation.navigate('SignIn' as never);
        setProfile(previous);
        return;
      }
      const endpoint = profile?.isFollowed ? 'unfollow' : 'follow';
      const resp = await axios.post(`${localHost}/user/${userId}/${endpoint}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setProfile((current) => current ? { ...current, isFollowed: !!resp.data.following, followersCount: resp.data.followersCount ?? current.followersCount } : current);
    } catch (error) {
      setProfile(previous);
      const status = isAxiosError(error) ? error.response?.status : null;
      if (status !== 404) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('follow public profile failed', errorMessage);
      }
    } finally {
      setFollowBusy(false);
    }
  };

  const openPost = (post: any) => {
    navigation.navigate('PublicPage', {
      outfitId: post._id,
      userId,
      username: profile?.username || fallbackUsername,
      profilePic: profile?.profilePicture || fallbackProfilePic,
      outfitImages: post.items,
      description: post.caption,
      likesCount: post.likesCount,
      likedByMe: post.likedByMe,
    });
  };
  const { user } = useAuthStore();
  const profilePic = user?.profilePicture || fallbackProfilePic;
  const username = user?.username || fallbackUsername;
  const displayName = user?.profileName || username;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
          <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.muted + '22' }]}>
            <Image source={typeof profilePic === 'string' ? { uri: profilePic } : profilePic} style={styles.avatar} />
            <Text style={[styles.name, { color: colors.primary }]}>{displayName}</Text>
            <Text style={[styles.handle, { color: colors.muted }]}>{'@' + username.toLowerCase()}</Text>
            <Text style={[styles.followers, { color: colors.muted }]}>{profile?.followersCount ?? 0} followers</Text>

            <View style={styles.actionsRow}>
              <Pressable onPress={toggleFollow} style={[styles.primaryBtn, { backgroundColor: profile?.isFollowed ? colors.accent : colors.primary }]}>
                <Text style={styles.primaryBtnText}>{profile?.isFollowed ? 'Following' : 'Follow'}</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Public outfits</Text>
            {posts.length === 0 ? (
              <Text style={{ color: colors.muted, marginTop: 12 }}>No public outfits yet.</Text>
            ) : (
              <View style={styles.grid}>
                {posts.map((post, index) => {
                  const cover = post?.items?.[0]?.image || post?.image;
                  return (
                    <Pressable key={post._id || index} style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.muted + '22' }]} onPress={() => openPost(post)}>
                      <Image source={{ uri: cover }} style={styles.gridImage} resizeMode="cover" />
                      <View style={styles.gridMeta}>
                        <Text style={[styles.gridCaption, { color: colors.primary }]} numberOfLines={1}>{post.caption || 'Outfit post'}</Text>
                        <Text style={[styles.gridSub, { color: colors.muted }]}>{post.likesCount || 0} likes · {post.commentsCount || 0} comments</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backText: { fontSize: 16, fontWeight: '700' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { marginHorizontal: 16, marginTop: 8, borderRadius: 24, padding: 18, alignItems: 'center', borderWidth: 1 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 12 },
  name: { fontSize: 22, fontWeight: '900' },
  handle: { marginTop: 2, fontSize: 13 },
  followers: { marginTop: 8, fontSize: 13, fontWeight: '600' },
  actionsRow: { marginTop: 14, flexDirection: 'row', gap: 10 },
  primaryBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 14, minWidth: 120, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: { width: '48%', borderRadius: 18, overflow: 'hidden', borderWidth: 1 },
  gridImage: { width: '100%', height: 200, backgroundColor: '#eee' },
  gridMeta: { padding: 10 },
  gridCaption: { fontSize: 13, fontWeight: '700' },
  gridSub: { marginTop: 4, fontSize: 11 },
});

export default PublicUserProfileScreen;

function useAuthStore(): { user: any; } {
  throw new Error('Function not implemented.');
}
