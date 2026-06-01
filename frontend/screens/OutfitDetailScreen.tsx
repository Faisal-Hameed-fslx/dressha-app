import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import React, { useState } from 'react';
import { Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import localHost from '../store/run';
import { useTheme } from '../theme/ThemeProvider';

type RouteParams = {
  username?: string;
  profilePic?: any;
  outfitImages?: any[];
  userId?: string;
  description?: string;
  outfitId?: string;
  likesCount?: number;
  likedByMe?: boolean;
};

const OutfitDetailScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = theme?.colors;
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = (route.params as RouteParams) || {};

  const username = params.username ?? 'Anonymous';
  const profilePic = params.profilePic ?? require('../assets/icon.png');
  const outfitImages = params.outfitImages ?? [require('../assets/splash.png')];
  const description = params.description ?? 'A public outfit shared by the user.';
  const userId = params.userId ?? null;

  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [liked, setLiked] = useState<boolean>(params.likedByMe ?? false);
  const [likesCount, setLikesCount] = useState<number>(params.likesCount ?? 0);
  const [followed, setFollowed] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);

  const outfitId = params.outfitId ?? null;
  const canFollow = !!userId && userId !== 'null' && userId !== 'undefined';

  const toggleLike = () => {
    if (likeBusy) return;
    const prevLiked = liked;
    const prevCount = likesCount;
    const optimisticLiked = !prevLiked;

    setLikeBusy(true);
    setLiked(optimisticLiked);
    setLikesCount((count) => Math.max(0, count + (optimisticLiked ? 1 : -1)));

    (async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token || !outfitId) {
          setLiked(prevLiked);
          setLikesCount(prevCount);
          setLikeBusy(false);
          navigation.navigate('SignIn' as never);
          return;
        }
        const resp = await axios.post(`${localHost}/outfit/${outfitId}/like`, {}, { headers: { Authorization: `Bearer ${token}` } });
        setLiked(!!resp.data.liked);
        setLikesCount(resp.data.likesCount ?? prevCount);
      } catch (error) {
        setLiked(prevLiked);
        setLikesCount(prevCount);
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('like error', errorMessage);
      } finally {
        setLikeBusy(false);
      }
    })();
  };

  const toggleFollow = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || !canFollow) {
        if (!token) {
          navigation.navigate('SignIn' as never);
        }
        return;
      }
      if (followed) {
        const resp = await axios.post(`${localHost}/user/${userId}/unfollow`, {}, { headers: { Authorization: `Bearer ${token}` } });
        setFollowed(false);
        setFollowersCount(resp.data.followersCount ?? Math.max(0, (followersCount || 1) - 1));
      } else {
        const resp = await axios.post(`${localHost}/user/${userId}/follow`, {}, { headers: { Authorization: `Bearer ${token}` } });
        setFollowed(true);
        setFollowersCount(resp.data.followersCount ?? ((followersCount || 0) + 1));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('follow toggle error', errorMessage);
    }
  };

  const submitComment = () => {
    if (commentBusy) return;
    (async () => {
      const trimmed = commentText.trim();
      if (!trimmed || !outfitId) return;
      if (trimmed.length > 280) return;

      const tempId = `temp-${Date.now()}`;
      const optimisticComment = {
        _id: tempId,
        text: trimmed,
        createdAt: new Date().toISOString(),
        user: { username: 'You' },
      };

      setCommentBusy(true);
      setComments((current) => [optimisticComment, ...current]);
      setCommentText('');
      setCommentSheetVisible(false);

      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          setComments((current) => current.filter((c) => c._id !== tempId));
          setCommentBusy(false);
          navigation.navigate('SignIn' as never);
          return;
        }
        const resp = await axios.post(`${localHost}/outfit/${outfitId}/comment`, { text: trimmed }, { headers: { Authorization: `Bearer ${token}` } });
        if (resp.data && resp.data.comment) {
          setComments((current) => current.map((c) => c._id === tempId ? {
            _id: resp.data.comment._id || tempId,
            text: resp.data.comment.text,
            createdAt: resp.data.comment.createdAt,
            user: { username: 'You' },
          } : c));
        }
      } catch (error) {
        setComments((current) => current.filter((c) => c._id !== tempId));
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('post comment error', errorMessage);
      } finally {
        setCommentBusy(false);
      }
    })();
  };

  React.useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!userId) return;
        const token = await AsyncStorage.getItem('token');
        const resp = await axios.get(`${localHost}/user/${userId}/profile`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        setFollowersCount(resp.data.followersCount ?? null);
        setFollowed(!!resp.data.isFollowed);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('load profile', errorMessage);
      }
    };
    if (canFollow) {
      loadProfile();
    }

    (async () => {
      try {
        if (!outfitId) return;
        const resp = await axios.get(`${localHost}/outfit/${outfitId}/comments?page=1&limit=50`);
        setComments(resp.data.comments || []);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('load comments', errorMessage);
      }
    })();
  }, [canFollow, outfitId, userId]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.userRow}>
          <Image source={profilePic} style={styles.avatar} />
          <View style={styles.userInfo}>
            <Text style={[styles.username, { color: colors.primary }]}>{username}</Text>
            <Text style={[styles.subtle, { color: colors.muted }]}>@{username.toLowerCase()} · {followersCount !== null ? `${followersCount} followers` : ''}</Text>
          </View>

          {canFollow ? (
            <TouchableOpacity style={[styles.followBtn, { backgroundColor: followed ? colors.accent : colors.primary }]} onPress={toggleFollow}>
              <Text style={styles.followText}>{followed ? 'Following' : 'Follow'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.card}>
          <Image source={outfitImages[0]} style={styles.outfitImage} />

          <View style={styles.actionRow}>
            <TouchableOpacity onPress={toggleLike} style={styles.actionBtn}>
              <Text style={[styles.actionText, { color: liked ? colors.accent : colors.muted }]}>{liked ? '♥' : '♡'} {likesCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCommentSheetVisible(true)} style={styles.actionBtn}>
              <Text style={[styles.actionText, { color: colors.muted }]}>💬 {comments.length}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.descRow}>
            <Text style={[styles.descText, { color: colors.muted }]}>{description}</Text>
          </View>

          {comments.length > 0 && !commentSheetVisible && (
            <View style={styles.commentsList}>
              {comments.slice(0, 2).map((comment, index) => (
                <View key={comment._id || index} style={styles.commentItem}>
                  <Text style={[styles.commentText, { color: colors.muted }]}>
                    <Text style={{ fontWeight: '700' }}>{comment?.user?.username || 'User'} </Text>
                    {comment?.text || ''}
                  </Text>
                </View>
              ))}
              {comments.length > 2 && (
                <TouchableOpacity onPress={() => setCommentSheetVisible(true)} style={{ paddingTop: 6 }}>
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>View all comments</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal transparent visible={commentSheetVisible} animationType="slide" onRequestClose={() => setCommentSheetVisible(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setCommentSheetVisible(false)} />
        <View style={[styles.sheetContainer, { backgroundColor: colors.card }]}>
          <View style={styles.sheetHeaderRow}>
            <View style={styles.sheetHeaderLeft}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.accent }]} />
              <Text style={[styles.sheetTitle, { color: colors.primary }]}>Comments</Text>
              <Text style={[styles.sheetSubtitle, { color: colors.muted }]}>{comments.length} replies</Text>
            </View>
            <TouchableOpacity onPress={() => setCommentSheetVisible(false)} style={[styles.closeChip, { backgroundColor: colors.background }]}>
              <Text style={{ color: colors.primary, fontWeight: '800' }}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.48 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {comments.map((comment, index) => (
              <View key={comment._id || index} style={[styles.sheetCommentItem, { borderColor: colors.muted + '20' }]}>
                <View style={[styles.commentAvatar, { backgroundColor: colors.accent + '18' }]}>
                  <Text style={{ color: colors.accent, fontWeight: '800' }}>{String(comment?.user?.username || 'U').slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetCommentUser, { color: colors.primary }]}>{comment?.user?.username || 'User'}</Text>
                  <Text style={[styles.sheetCommentText, { color: colors.muted }]}>{comment?.text || ''}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.commentComposer, { borderColor: colors.muted + '20' }]}>
            <TextInput
              placeholder='Write a comment...'
              placeholderTextColor='#999'
              value={commentText}
              onChangeText={setCommentText}
              style={[styles.input, { borderColor: colors.muted, color: colors.primary, backgroundColor: colors.background }]}
            />
            <TouchableOpacity onPress={submitComment} style={[styles.sendBtn, { backgroundColor: colors.primary }]}>
              <Text style={{ color: '#fff' }}>{commentBusy ? 'Sending...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 52, justifyContent: 'center', paddingHorizontal: 12 },
  backBtn: { padding: 6 },
  backText: { fontSize: 16 },
  content: { padding: 16 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, marginRight: 12 },
  userInfo: { flex: 1 },
  username: { fontSize: 18, fontWeight: '700' },
  subtle: { fontSize: 12, opacity: 0.8 },
  followBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  followText: { color: '#fff', fontWeight: '700' },
  card: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#fff' },
  outfitImage: { width: '100%', height: 380, resizeMode: 'cover' },
  actionRow: { flexDirection: 'row', padding: 12, alignItems: 'center' },
  actionBtn: { marginRight: 16 },
  actionText: { fontSize: 16 },
  descRow: { paddingHorizontal: 12, paddingBottom: 12 },
  descText: { fontSize: 14 },
  commentBox: { padding: 12, borderTopWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  commentActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  sendBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  commentsList: { padding: 12, borderTopWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  commentItem: { paddingVertical: 8 },
  commentText: { fontSize: 13 },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetContainer: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 18, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: -8 }, shadowRadius: 20, elevation: 12 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  sheetHeaderLeft: { flex: 1, paddingRight: 12 },
  sheetHandle: { alignSelf: 'center', width: 48, height: 5, borderRadius: 999, marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  sheetSubtitle: { marginTop: -6, fontSize: 12, fontWeight: '600' },
  closeChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999 },
  sheetCommentItem: { paddingVertical: 12, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  sheetCommentUser: { fontWeight: '800', marginBottom: 3 },
  sheetCommentText: { fontSize: 14, lineHeight: 20 },
  commentComposer: { marginTop: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-end', borderTopWidth: 1, paddingTop: 12 },
});

export default OutfitDetailScreen;