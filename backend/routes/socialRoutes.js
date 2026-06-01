export default function registerSocialRoutes(app, deps) {
  const {
    User,
    savedFits,
    jwt,
    jwtSecret,
    authenticateToken,
    canAccessOutfit,
    normalizeCommentText,
    consumeCommentRateLimit,
  } = deps;

  const resolveUserId = (req) => {
    let meId = null;
    try {
      const token = req.headers['authorization']?.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, jwtSecret);
        meId = decoded.id;
      }
    } catch (e) {
      meId = null;
    }
    return meId;
  };

  app.post('/user/:userId/follow', authenticateToken, async (req, res) => {
    try {
      const targetId = req.params.userId;
      const meId = req.user.id;
      if (targetId === meId) return res.status(400).json({ error: 'Cannot follow yourself' });

      const target = await User.findById(targetId);
      const me = await User.findById(meId);
      if (!target || !me) return res.status(404).json({ error: 'User not found' });

      if (!Array.isArray(target.followers)) target.followers = [];
      if (!Array.isArray(me.following)) me.following = [];

      if (!target.followers.map(String).includes(String(meId))) {
        target.followers.push(meId);
        me.following.push(targetId);
        await target.save();
        await me.save();
      }

      return res.json({ success: true, following: true, followersCount: (target.followers || []).length });
    } catch (error) {
      console.error('Follow error', error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.post('/user/:userId/unfollow', authenticateToken, async (req, res) => {
    try {
      const targetId = req.params.userId;
      const meId = req.user.id;
      if (targetId === meId) return res.status(400).json({ error: 'Cannot unfollow yourself' });

      const target = await User.findById(targetId);
      const me = await User.findById(meId);
      if (!target || !me) return res.status(404).json({ error: 'User not found' });

      target.followers = (target.followers || []).filter((f) => String(f) !== String(meId));
      me.following = (me.following || []).filter((f) => String(f) !== String(targetId));
      await target.save();
      await me.save();

      return res.json({ success: true, following: false, followersCount: (target.followers || []).length });
    } catch (error) {
      console.error('Unfollow error', error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/feed', async (req, res) => {
    try {
      const meId = resolveUserId(req);
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(50, Math.max(5, parseInt(String(req.query.limit || '20'), 10) || 20));
      const skip = (page - 1) * limit;

      let authorsWithMe = [];
      let followingIds = [];
      if (meId) {
        const me = await User.findById(meId).select('following').lean();
        followingIds = (me?.following || []).map((id) => String(id));
        const authors = await User.find({ followers: meId }).select('_id').lean();
        authorsWithMe = authors.map((a) => String(a._id));
      }

      const match = meId
        ? {
            $or: [
              { visibility: 'Everyone' },
              { userId: meId },
              { $and: [{ visibility: 'Followers' }, { userId: { $in: authorsWithMe } }] },
            ],
          }
        : { visibility: 'Everyone' };

      const total = await savedFits.countDocuments(match);
      const docs = await savedFits.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

      const userIds = [...new Set(docs.map((d) => String(d.userId)))];
      const users = await User.find({ _id: { $in: userIds } }).select('username profileName profilePicture followers').lean();
      const userMap = users.reduce((acc, u) => ({ ...acc, [String(u._id)]: u }), {});

      const results = docs.map((doc) => {
        const user = userMap[String(doc.userId)] || {};
        return {
          ...doc,
          username: user.username,
          profileName: user.profileName || user.username,
          profilePicture: user.profilePicture,
          likesCount: Array.isArray(doc.likes) ? doc.likes.length : 0,
          commentsCount: Array.isArray(doc.comments) ? doc.comments.length : 0,
          likedByMe: meId ? (Array.isArray(doc.likes) ? doc.likes.map(String).includes(String(meId)) : false) : false,
          isFollowed: meId ? followingIds.includes(String(doc.userId)) : false,
        };
      });

      res.json({ posts: results, page, limit, total });
    } catch (error) {
      console.error('Feed error', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/public-feed', async (req, res) => {
    try {
      const meId = resolveUserId(req);
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(50, Math.max(5, parseInt(String(req.query.limit || '8'), 10) || 8));
      const skip = (page - 1) * limit;

      let followingIds = [];
      if (meId) {
        const me = await User.findById(meId).select('following').lean();
        followingIds = (me?.following || []).map((id) => String(id));
      }

      const match = meId
        ? { visibility: 'Everyone', userId: { $ne: meId } }
        : { visibility: 'Everyone' };
      const total = await savedFits.countDocuments(match);

      const docs = await savedFits.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
      const userIds = [...new Set(docs.map((d) => String(d.userId)))];
      const users = await User.find({ _id: { $in: userIds } }).select('username profileName profilePicture').lean();
      const userMap = users.reduce((acc, u) => ({ ...acc, [String(u._id)]: u }), {});

      const posts = docs.map((doc) => {
        const user = userMap[String(doc.userId)] || {};
        return {
          ...doc,
          username: user.username,
          profileName: user.profileName || user.username,
          profilePicture: user.profilePicture,
          likesCount: Array.isArray(doc.likes) ? doc.likes.length : 0,
          commentsCount: Array.isArray(doc.comments) ? doc.comments.length : 0,
          likedByMe: meId ? (Array.isArray(doc.likes) ? doc.likes.map(String).includes(String(meId)) : false) : false,
          isFollowed: meId ? followingIds.includes(String(doc.userId)) : false,
        };
      }).filter((post) => !meId || String(post.userId) !== String(meId));

      res.json({ posts, page, limit, total });
    } catch (error) {
      console.error('Public feed error', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/user/:userId/public-posts', async (req, res) => {
    try {
      const { userId } = req.params;
      const meId = resolveUserId(req);

      const user = await User.findById(userId).select('username profileName profilePicture followers');
      if (!user) return res.status(404).json({ error: 'User not found' });

      const docs = await savedFits.find({ userId }).sort({ createdAt: -1 }).lean();
      const results = docs.filter((doc) => {
        if ((doc.visibility || 'Everyone') === 'Everyone') return true;
        if (String(doc.userId) === String(meId)) return true;
        if ((doc.visibility || '') === 'Followers' && meId) {
          return (user.followers || []).map(String).includes(String(meId));
        }
        return false;
      }).map((doc) => ({ ...doc, username: user.username, profileName: user.profileName || user.username, profilePicture: user.profilePicture }));

      res.json({ posts: results });
    } catch (error) {
      console.error('User public posts error', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/user/:userId/profile', async (req, res) => {
    try {
      const { userId } = req.params;
      const meId = resolveUserId(req);

      const user = await User.findById(userId).select('username profileName profilePicture followers');
      if (!user) return res.status(404).json({ error: 'User not found' });

      const followers = user.followers || [];
      const followersCount = followers.length;
      const isFollowed = meId ? followers.map(String).includes(String(meId)) : false;

      res.json({ username: user.username, profileName: user.profileName || user.username, profilePicture: user.profilePicture, followersCount, isFollowed });
    } catch (error) {
      console.error('User profile error', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/outfit/:outfitId/like', authenticateToken, async (req, res) => {
    try {
      const { outfitId } = req.params;
      const meId = req.user.id;
      const outfit = await savedFits.findById(outfitId);
      if (!outfit) return res.status(404).json({ error: 'Outfit not found' });

      const allowed = await canAccessOutfit(outfit, meId);
      if (!allowed) return res.status(403).json({ error: 'Not allowed to interact with this outfit' });

      const likes = outfit.likes || [];
      const has = likes.map(String).includes(String(meId));
      if (has) {
        outfit.likes = likes.filter((l) => String(l) !== String(meId));
      } else {
        outfit.likes = [...likes, meId];
      }

      await outfit.save();
      return res.json({ success: true, liked: !has, likesCount: outfit.likes.length });
    } catch (error) {
      console.error('Like toggle error', error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.post('/outfit/:outfitId/comment', authenticateToken, async (req, res) => {
    try {
      const { outfitId } = req.params;
      const body = req.body || {};
      console.log('DEBUG comment POST headers auth:', req.headers['authorization']);
      console.log('DEBUG comment POST content-type:', req.headers['content-type']);
      try {
        console.log('DEBUG comment POST body type:', typeof body, 'body:', JSON.stringify(body).slice(0, 1000));
      } catch (e) {
        console.log('DEBUG comment POST body (stringify failed)');
      }
      const rawText = typeof body === 'string'
        ? body
        : body.text ?? body.commentText ?? body.message ?? '';
      const normalizedText = normalizeCommentText(rawText);
      console.log('DEBUG comment POST rawText:', typeof rawText, String(rawText).slice(0, 300));
      console.log('DEBUG comment POST normalizedText:', String(normalizedText).slice(0, 300));
      if (!normalizedText) return res.status(400).json({ error: 'Comment text is required' });
      if (normalizedText.length > 280) return res.status(400).json({ error: 'Comment is too long. Max 280 characters.' });

      const meId = req.user.id;
      const rateLimitStatus = await consumeCommentRateLimit(meId);
      if (!rateLimitStatus.allowed) {
        return res.status(429).json({
          error: 'Too many comments. Please wait before commenting again.',
          retryAfterSeconds: rateLimitStatus.retryAfterSeconds,
        });
      }

      const outfit = await savedFits.findById(outfitId);
      if (!outfit) return res.status(404).json({ error: 'Outfit not found' });

      const allowed = await canAccessOutfit(outfit, meId);
      if (!allowed) return res.status(403).json({ error: 'Not allowed to interact with this outfit' });

      const comment = { userId: meId, text: normalizedText, createdAt: new Date() };
      outfit.comments = outfit.comments || [];
      outfit.comments.push(comment);
      await outfit.save();

      return res.json({ success: true, comment });
    } catch (error) {
      console.error('Post comment error', error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/outfit/:outfitId/comments', async (req, res) => {
    try {
      const { outfitId } = req.params;
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(50, Math.max(5, parseInt(String(req.query.limit || '20'), 10) || 20));
      const outfit = await savedFits.findById(outfitId).lean();
      if (!outfit) return res.status(404).json({ error: 'Outfit not found' });

      const comments = Array.isArray(outfit.comments) ? outfit.comments.slice().reverse() : [];
      const total = comments.length;
      const start = (page - 1) * limit;
      const paged = comments.slice(start, start + limit);

      const userIds = [...new Set(paged.map((c) => String(c.userId)))];
      const users = await User.find({ _id: { $in: userIds } }).select('username profileName profilePicture').lean();
      const userMap = users.reduce((acc, u) => ({ ...acc, [String(u._id)]: u }), {});

      const annotated = paged.map((c) => ({
        _id: c._id,
        text: c.text,
        createdAt: c.createdAt,
        user: userMap[String(c.userId)] || { username: 'Unknown', profileName: 'Unknown' },
      }));

      return res.json({ comments: annotated, page, limit, total });
    } catch (error) {
      console.error('Get comments error', error);
      return res.status(500).json({ error: error.message });
    }
  });
}