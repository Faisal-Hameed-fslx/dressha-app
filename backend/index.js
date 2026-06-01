import { pipeline } from "@huggingface/transformers";
import Agenda from "agenda";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import cosineSimilarity from "compute-cosine-similarity";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { DateTime } from 'luxon';
import mongoose from "mongoose";
import multer from "multer";
import os from "os";
import CommentThrottle from "./model/commentThrottle.js";
import Image from "./model/Image.js";
import OutFit from "./model/outFit.js";
import savedFits from "./model/savedFits.js";
import Story from "./model/Story.js";
import User from "./model/user.js";
import registerSocialRoutes from "./routes/socialRoutes.js";


dotenv.config();

const app = express();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.Cloudinary_Name,
  api_key: process.env.Cloudinary_API_KEY,
  api_secret: process.env.Cloudinary_API_Secret,
});

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and WebP are allowed."));
    }
  },
});

// Helper: upload buffer to Cloudinary (FIXED: memoryStorage has no .path)
const uploadBufferToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
};

const PORT = 3000;

// Social interaction guardrails
const COMMENT_MAX_LENGTH = 280;
const COMMENT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const COMMENT_RATE_LIMIT_MAX = 6;

const normalizeCommentText = (value) => {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
};

// Normalize uploaded item type to one of the canonical categories
const normalizeItemType = (value) => {
  if (typeof value !== 'string') return 'other';
  const v = value.toLowerCase().trim();
  if (['top', 'tops', 't-shirt', 'tshirt', 'shirt', 'blouse'].includes(v)) return 'top';
  if (['bottom', 'pants', 'trousers', 'jeans', 'shorts'].includes(v)) return 'bottom';
  if (['dress', 'dresses'].includes(v)) return 'dress';
  if (['skirt', 'skirts'].includes(v)) return 'skirts';
  if (['shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots'].includes(v)) return 'shoes';
  return 'other';
};

// Normalize item types used for suggestion output (keeps small set)
const normalizeSuggestionItemType = (value) => {
  if (typeof value !== 'string') return 'outfit';
  const v = value.toLowerCase().trim();
  if (['top', 'tops', 't-shirt', 'tshirt', 'shirt', 'blouse'].includes(v)) return 'top';
  if (['bottom', 'pants', 'trousers', 'jeans', 'shorts'].includes(v)) return 'bottom';
  if (['dress', 'dresses'].includes(v)) return 'dress';
  if (['skirt', 'skirts'].includes(v)) return 'skirt';
  if (['shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots'].includes(v)) return 'shoes';
  if (v === 'outfit') return 'outfit';
  return 'other';
};

const consumeCommentRateLimit = async (userId) => {
  const now = new Date();
  const windowStart = new Date(
    Math.floor(now.getTime() / COMMENT_RATE_LIMIT_WINDOW_MS) * COMMENT_RATE_LIMIT_WINDOW_MS,
  );
  const expiresAt = new Date(now.getTime() + COMMENT_RATE_LIMIT_WINDOW_MS);

  const updated = await CommentThrottle.findOneAndUpdate(
    {
      userId,
      windowStart,
      count: { $lt: COMMENT_RATE_LIMIT_MAX },
    },
    {
      $inc: { count: 1 },
      $setOnInsert: {
        userId,
        windowStart,
        expiresAt,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  ).lean();

  if (updated) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((windowStart.getTime() + COMMENT_RATE_LIMIT_WINDOW_MS - now.getTime()) / 1000),
  );

  return { allowed: false, retryAfterSeconds };
};

const canAccessOutfit = async (outfit, meId) => {
  const visibility = outfit?.visibility || 'Everyone';
  if (visibility === 'Everyone') return true;
  if (String(outfit?.userId) === String(meId)) return true;
  if (visibility === 'Followers' && meId) {
    const owner = await User.findById(outfit.userId).select('followers').lean();
    const followers = owner?.followers || [];
    return followers.map(String).includes(String(meId));
  }
  return false;
};

const jwtSecret = process.env.JWT_SECRET;
const googleWebClientId = process.env.GOOGLE_WEB_CLIENT_ID;
const discovery = { tokenEndpoint: "https://oauth2.googleapis.com/token" };
const googleClient = googleWebClientId
  ? new OAuth2Client(googleWebClientId)
  : null;
const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = decoded;
    next();
  });
};


// registerSocialRoutes will be attached after middleware registration below
// Local pipelines (lazy-loaded)
let localImageClassifier = null;
let localTextGenerator = null;
let localTextEmbedder = null;

const ensureLocalTextGenerator = async () => {
  if (localTextGenerator) return localTextGenerator;
  try {
    // Use an instruction-tuned small model compatible with transformers.js
    localTextGenerator = await pipeline(
      "text-generation",
      "HuggingFaceTB/SmolLM2-135M-Instruct",
      {
        max_new_tokens: 128,
        return_full_text: false,
        do_sample: false,
        temperature: 0,
        top_p: 1,
        repetition_penalty: 1.1,
      },
    );
    return localTextGenerator;
  } catch (e) {
    console.warn(
      "Local text generator load failed:",
      e?.message || e,
    );
    return null;
  }
};

const ensureLocalTextEmbedder = async () => {
  if (localTextEmbedder) return localTextEmbedder;
  try {
    localTextEmbedder = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    );
    return localTextEmbedder;
  } catch (e) {
    console.warn("Local text embedder load failed:", e?.message || e);
    return null;
  }
};

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  }),
);
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Simple request logger for debugging
app.use((req, res, next) => {
  console.log("HTTP", req.method, req.path);
  next();
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB error:", err.message));

// Agenda scheduler (uses same MongoDB)
let agenda;
try {
  agenda = new Agenda({ mongo: mongoose.connection.db, processEvery: '1 minute' });
} catch (e) {
  console.warn('Agenda initialization failed, falling back to in-memory scheduler', e?.message || e);
  agenda = null;
}

// AI chat endpoint
app.post("/ai/chat", authenticateToken, async (req, res) => {
  try {
    const { messages, query } = req.body || {};
    let chatMessages = [];
    if (Array.isArray(messages) && messages.length > 0) {
      chatMessages = messages.map((m) => {
        if (m.role && m.content) return m;
        const role = m.sender === "ai" ? "assistant" : "user";
        return { role, content: m.text };
      });
    } else if (typeof query === "string" && query.trim()) {
      chatMessages = [{ role: "user", content: query.trim() }];
    }

    if (chatMessages.length === 0) {
      return res.status(400).json({ error: "No messages provided" });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return res
        .status(500)
        .json({
          error: "AI service not configured: missing OPENROUTER_API_KEY",
        });
    }

    const openAiAPIKey = process.env.OPENROUTER_API_KEY;
    const openAiURL = process.env.OPENROUTER_API_URL;
    const openAiModel = process.env.OPENROUTER_MODEL;

    const systemPrompt = `Strictly follow these instructions:
You are a professional AI Fashion Assistant. Your Name is Dressha. Your role is to provide accurate, practical, and style-forward fashion guidance tailored to the user's needs, preferences, body type, lifestyle, budget, and cultural context.
Always answer in English.

You should:

Offer outfit recommendations for specific occasions, seasons, climates, and dress codes

Provide styling advice, color coordination, fabric guidance, and fit recommendations

Assist with wardrobe planning, capsule wardrobes, and outfit combinations

Share trend insights while prioritizing timeless and wearable solutions

Recommend accessories, footwear, and layering options when relevant

Respect sustainability, inclusivity, and diversity in fashion choices

Avoid judgmental language and remain supportive, professional, and clear

When information is missing, ask concise, relevant clarifying questions.
When giving advice, be structured, concise, and easy to follow.
Do not make assumptions about the user's identity or preferences without confirmation.

Your goal is to help users feel confident, well-styled, and informed through thoughtful, personalized fashion guidance.`;

    const options = {
      method: "POST",
      url: openAiURL,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiAPIKey}`,
      },
      data: JSON.stringify({
        model: openAiModel,
        messages: [{ role: "system", content: systemPrompt }, ...chatMessages],
        reasoning: { enabled: true },
      }),
    };

    const { data } = await axios.request(options);
    const reply = data.choices[0].message.content;
    return res.json({ reply, model: openAiModel });
  } catch (error) {
    const status = error?.response?.status;
    const details = error?.response?.data || error.message;
    console.error("AI chat error:", details);
    return res.status(500).json({ error: "AI service error", status, details });
  }
});

// FIXED: use uploadBufferToCloudinary instead of req.file.path
app.post("/signup", upload.single("profilePicture"), async (req, res) => {
  try {
    const { email, password, username, gender } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // FIXED: case-insensitive username check
    const existingUsername = await User.findOne({
      username: { $regex: new RegExp("^" + escapeRegex(username) + "$", "i") },
    });
    if (existingUsername) {
      return res.status(400).json({ error: "Username already exists" });
    }

    let profilePictureUrl = "";

    if (req.file) {
      const uploadResponse = await uploadBufferToCloudinary(
        req.file.buffer,
        "dressha/profiles",
      );
      profilePictureUrl = uploadResponse.secure_url;
    }

    const newUser = new User({
      email,
      password,
      username,
      gender,
      profilePicture: profilePictureUrl,
      outfits: [],
    });

    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, jwtSecret);
    const safeUser = await User.findById(newUser._id).select("-password");

    res.status(201).json({ token, user: safeUser });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const newUser = await User.findOne({ email });
    if (!newUser || !(await newUser.comparePassword(password))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = jwt.sign({ id: newUser._id }, jwtSecret);
    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/auth/google/config", async (req, res) => {
  try {
    if (!googleWebClientId) {
      return res
        .status(500)
        .json({ error: "Google web client ID not configured on server" });
    }

    return res.json({
      webClientId: googleWebClientId,
      androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID || null,
    });
  } catch (error) {
    console.error("Google auth config error:", error);
    return res.status(500).json({ error: error.message || "Google auth config failed" });
  }
});

app.post("/auth/google", async (req, res) => {
  try {
    const { idToken } = req.body || {};

    if (!googleClient || !googleWebClientId) {
      return res
        .status(500)
        .json({ error: "Google auth is not configured on the server" });
    }

    if (!idToken) {
      return res.status(400).json({ error: "Missing Google ID token" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleWebClientId,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload?.email) {
      return res.status(400).json({ error: "Invalid Google account payload" });
    }

    const googleId = payload.sub;
    const email = String(payload.email).toLowerCase();
    const displayName =
      payload.name || payload.given_name || email.split("@")[0];
    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    let created = false;

    if (user) {
      let changed = false;

      if (!user.googleId) {
        user.googleId = googleId;
        changed = true;
      }

      if (user.authProvider !== "google") {
        user.authProvider = "google";
        changed = true;
      }

      if (!user.profilePicture && payload.picture) {
        user.profilePicture = payload.picture;
        changed = true;
      }

      if (!user.profileName && payload.name) {
        user.profileName = payload.name;
        changed = true;
      }

      if (changed) {
        await user.save();
      }
    } else {
      const username = await generateUniqueUsername(displayName);

      user = new User({
        email,
        username,
        password: "",
        gender: "",
        profilePicture: payload.picture || "",
        profileName: payload.name || "",
        googleId,
        authProvider: "google",
        outfits: [],
      });

      await user.save();
      created = true;
    }

    const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: "30d" });
    const safeUser = await User.findById(user._id).select("-password");

    return res.status(created ? 201 : 200).json({ token, user: safeUser });
  } catch (error) {
    console.error("Google auth error:", error);
    return res
      .status(500)
      .json({ error: error.message || "Google auth failed" });
  }
});

// Register social routes after body parsers so JSON bodies are available
registerSocialRoutes(app, {
  User,
  savedFits,
  jwt,
  jwtSecret,
  authenticateToken,
  canAccessOutfit,
  normalizeCommentText,
  consumeCommentRateLimit,
});

// FIXED: use uploadBufferToCloudinary; check username uniqueness; return followers/following
app.patch(
  "/me",
  authenticateToken,
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { profileName, username, gender } = req.body;

      if (username && username.trim() !== user.username) {
        const existing = await User.findOne({
          _id: { $ne: user._id },
          username: {
            $regex: new RegExp("^" + escapeRegex(username.trim()) + "$", "i"),
          },
        });
        if (existing) {
          return res.status(400).json({ error: "Username already taken" });
        }
        user.username = username.trim();
      }

      if (profileName !== undefined) user.profileName = profileName;
      if (gender !== undefined) user.gender = gender;

      if (req.file) {
        const uploadResponse = await uploadBufferToCloudinary(
          req.file.buffer,
          "dressha/profiles",
        );
        user.profilePicture = uploadResponse.secure_url;
      }

      await user.save();

      const updatedUser = await User.findById(user._id).select("-password");
      res.json(updatedUser);
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// FIXED: include followers and following so ProfilePage can display counts
app.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      _id: user._id,
      email: user.email,
      username: user.username,
      profileName: user.profileName,
      gender: user.gender,
      profilePicture: user.profilePicture,
      outfits: user.outfits || [],
      followers: user.followers || [],
      following: user.following || [],
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// FIXED: case-insensitive username availability check
app.get("/check-username", async (req, res) => {
  try {
    const { username } = req.query;
    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "Username is required" });
    }
    const exists = await User.findOne({
      username: {
        $regex: new RegExp("^" + escapeRegex(username.trim()) + "$", "i"),
      },
    });
    res.json({ available: !exists });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/save-outfit", authenticateToken, async (req, res) => {
  try {
    // Log incoming request body (truncated) to aid debugging
    try {
      const bodyPreview = JSON.stringify(req.body || {}).slice(0, 2000);
      console.log("Incoming /save-outfit body:", bodyPreview);
    } catch (logErr) {
      console.warn("Could not stringify /save-outfit body for logging", logErr);
    }

    const { date, items, caption, occasion, visibility, isOotd } = req.body;
    const safeDate = date || new Date().toISOString();
    const userId = req.user.id;

    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Strict validation: items must be an array
    if (!Array.isArray(items)) {
      return res
        .status(400)
        .json({ error: "Invalid payload", details: "items must be an array" });
    }

    // Validate each item and build helpful error messages instead of silently skipping
    const invalidReasons = [];
    const processedItems = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== "object") {
        invalidReasons.push(`item[${i}]: must be an object`);
        continue;
      }

      let imageUrl = item.image;

      if (!imageUrl || typeof imageUrl !== "string") {
        invalidReasons.push(`item[${i}]: missing or invalid image`);
        continue;
      }

      // Reject local file URIs — client must send either a http(s) url or data URI (base64)
      if (
        imageUrl.startsWith("file:") ||
        imageUrl.startsWith("content:") ||
        /^\\|^[A-Za-z]:\\/.test(imageUrl)
      ) {
        invalidReasons.push(
          `item[${i}]: image appears to be a local file path. Send a data URI (base64) or a hosted http(s) URL instead.`,
        );
        continue;
      }

      // If frontend sent a data URI (base64), upload it to Cloudinary
      if (imageUrl.startsWith("data:image/")) {
        const matches = imageUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if (!matches) {
          invalidReasons.push(`item[${i}]: invalid base64 image format`);
          continue;
        }
        const base64 = matches[2];
        const buffer = Buffer.from(base64, "base64");
        try {
          const uploadResp = await uploadBufferToCloudinary(
            buffer,
            "dressha/outfits",
          );
          imageUrl = uploadResp.secure_url;
        } catch (uErr) {
          console.error("Cloudinary upload failed for item image", uErr);
          invalidReasons.push(`item[${i}]: failed to upload image`);
          continue;
        }
      }

      // Accept only http(s) urls at this point
      if (!String(imageUrl).match(/^https?:\/\//)) {
        invalidReasons.push(
          `item[${i}]: image must be an http(s) URL or data URI`,
        );
        continue;
      }

      processedItems.push({
        id: item.id !== undefined ? item.id : null,
        type: normalizeSuggestionItemType(item.type || "outfit"),
        image: imageUrl,
        x: typeof item.x === "number" ? item.x : 0,
        y: typeof item.y === "number" ? item.y : 0,
      });
    }

    if (invalidReasons.length > 0) {
      // Return 400 with clear details about invalid items
      return res
        .status(400)
        .json({ error: "Invalid items in payload", details: invalidReasons });
    }

    const validItems = processedItems;
    if (validItems.length === 0) {
      return res.status(400).json({ error: "No valid items provided" });
    }

    const allowedOccasions = [
      "Work",
      "Casual",
      "Formal",
      "Party",
      "Wedding",
      "Interview",
    ];
    const allowedVisibilities = ["Everyone", "Private", "Followers"];
    const normalizedOccasion =
      typeof occasion === "string" && allowedOccasions.includes(occasion)
        ? occasion
        : "Casual";
    const normalizedVisibility =
      typeof visibility === "string" && allowedVisibilities.includes(visibility)
        ? visibility
        : "Everyone";

    const newOutfit = new savedFits({
      userId: user._id,
      date: safeDate,
      items: validItems,
      caption: caption || "",
      occasion: normalizedOccasion,
      visibility: normalizedVisibility,
      isOotd: !!isOotd,
    });

    await newOutfit.save();

    user.outfits.push(newOutfit._id);
    await user.save();

    // If marked as OOTD, create a story entry (expires in 24 hours)
    try {
      if (newOutfit.isOotd) {
        const storyImage = (newOutfit.items && newOutfit.items[0] && newOutfit.items[0].image) || null;
        const story = new Story({
          userId: user._id,
          outfitId: newOutfit._id,
          image: storyImage,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
        await story.save();
        // fire-and-forget optional hooks (webhook + push)
        sendStoryHooks(story).catch((e) => console.warn('sendStoryHooks error', e));
      }
    } catch (sErr) {
      console.error('Failed creating story for OOTD:', sErr);
    }

    res.status(201).json({ outfit: newOutfit });
  } catch (error) {
    console.error("Error saving outfit (full):", error);
    console.error(error && error.stack);
    // Handle Mongoose validation errors as client errors (400)
    if (error && error.name === "ValidationError") {
      const details = Object.keys(error.errors || {}).map((k) => ({
        field: k,
        message: error.errors[k].message,
      }));
      return res.status(400).json({ error: "Validation failed", details });
    }

    const message = (error && error.message) || String(error);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: message });
  }
});

app.get("/save-outfit/user/:userId", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    if (req.user.id !== userId) {
      return res
        .status(403)
        .json({ error: "Forbidden: You can only access your own outfits" });
    }
    const user = await User.findById(userId).populate("outfits");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json(user.outfits);
  } catch (error) {
    console.log("Error fetching outfits:", error);
    res
      .status(500)
      .json({ error: "Internal Server error", details: error.message });
  }
});

app.delete("/save-outfit/:outfitId", authenticateToken, async (req, res) => {
  try {
    const { outfitId } = req.params;
    const userId = req.user.id;

    const outfit = await savedFits.findById(outfitId);
    if (!outfit) {
      return res.status(404).json({ error: "Saved outfit not found" });
    }

    if (String(outfit.userId) !== String(userId)) {
      return res
        .status(403)
        .json({
          error: "Forbidden: You can only delete your own saved outfits",
        });
    }

    await savedFits.deleteOne({ _id: outfitId });
    await User.updateOne({ _id: userId }, { $pull: { outfits: outfitId } });

    return res.json({ success: true, message: "Saved outfit deleted" });
  } catch (error) {
    console.error("Delete saved outfit error:", error);
    return res
      .status(500)
      .json({
        error: "Failed to delete saved outfit",
        details: error.message || String(error),
      });
  }
});

app.patch("/save-outfit/:outfitId", authenticateToken, async (req, res) => {
  try {
    const { outfitId } = req.params;
    const userId = req.user.id;
    const outfit = await savedFits.findById(outfitId);

    if (!outfit) {
      return res.status(404).json({ error: "Saved outfit not found" });
    }

    if (String(outfit.userId) !== String(userId)) {
      return res.status(403).json({ error: "Forbidden: You can only edit your own saved outfits" });
    }

    const { caption, occasion, visibility, isOotd, items } = req.body || {};

    if (caption !== undefined) outfit.caption = String(caption);
    if (occasion !== undefined) outfit.occasion = String(occasion);
    if (visibility !== undefined) outfit.visibility = String(visibility);
    if (isOotd !== undefined) outfit.isOotd = !!isOotd;

    if (items !== undefined) {
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "items must be an array when provided" });
      }

      const sanitizedItems = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || typeof item !== "object") {
          return res.status(400).json({ error: `items[${i}] must be an object` });
        }
        if (!item.image || typeof item.image !== "string") {
          return res.status(400).json({ error: `items[${i}].image is required` });
        }
        if (!item.type || typeof item.type !== "string") {
          return res.status(400).json({ error: `items[${i}].type is required` });
        }

        sanitizedItems.push({
          id: item.id !== undefined ? item.id : null,
          type: normalizeSuggestionItemType(item.type || "outfit"),
          image: item.image,
          x: typeof item.x === "number" ? item.x : 0,
          y: typeof item.y === "number" ? item.y : 0,
        });
      }

      outfit.items = sanitizedItems;
    }

    await outfit.save();
    // If updated to be OOTD, create a story if one doesn't already exist for this outfit
    try {
      if (outfit.isOotd) {
        const existing = await Story.findOne({ outfitId: outfit._id }).lean();
        if (!existing) {
          const storyImage = (outfit.items && outfit.items[0] && outfit.items[0].image) || null;
          const s = new Story({ userId: outfit.userId, outfitId: outfit._id, image: storyImage, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
          await s.save();
          // optional hooks
          sendStoryHooks(s).catch((e) => console.warn('sendStoryHooks error', e));
        }
      }
    } catch (sErr) {
      console.error('Failed creating story on outfit update:', sErr);
    }
    return res.json({ success: true, outfit });
  } catch (error) {
    console.error("Update saved outfit error", error);
    return res.status(500).json({ error: error.message || String(error) });
  }
});

// Create a manual story (optional) - accepts outfitId or image
app.post('/stories', authenticateToken, async (req, res) => {
  try {
    const { outfitId, image, caption } = req.body || {};
    const userId = req.user.id;
    if (!outfitId && !image) return res.status(400).json({ error: 'outfitId or image is required' });
    const story = new Story({ userId, outfitId: outfitId || null, image: image || null, caption: caption || '', expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    await story.save();
    // optional hooks (webhook + push)
    sendStoryHooks(story).catch((e) => console.warn('sendStoryHooks error', e));
    return res.status(201).json({ story });
  } catch (error) {
    console.error('Create story error:', error);
    return res.status(500).json({ error: error.message || String(error) });
  }
});

// List public stories (not expired)
app.get('/stories', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const stories = await Story.find({ expiresAt: { $gt: now } }).sort({ createdAt: -1 }).limit(100).populate('userId', 'username profilePicture');
    res.json({ stories });
  } catch (error) {
    console.error('Fetch stories error:', error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

// List stories for a specific user
app.get('/stories/user/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const now = new Date();
    const stories = await Story.find({ userId, expiresAt: { $gt: now } }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ stories });
  } catch (error) {
    console.error('Fetch user stories error:', error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

const generateEmbedding = async (text) => {
  const embedder = await ensureLocalTextEmbedder();
  if (!embedder) {
    throw new Error("Local text embedder is unavailable");
  }

  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.isArray(output) ? output : Array.from(output.data || output);
};

// Post-create hooks for stories: optional external webhook and optional push sends (Expo)
const sendStoryHooks = async (storyDoc) => {
  try {
    if (!storyDoc) return;
    const story = typeof storyDoc.toObject === 'function' ? storyDoc.toObject() : storyDoc;
    const user = await User.findById(story.userId).select('username profilePicture followers pushTokens').lean();
    const outfit = story.outfitId ? await savedFits.findById(story.outfitId).lean() : null;

    // Webhook integration (optional)
    if (process.env.STORY_WEBHOOK_URL) {
      try {
        const payload = {
          provider: 'dressha',
          userId: String(user?._id || story.userId),
          username: user?.username || null,
          storyId: String(story._id),
          outfitId: story.outfitId ? String(story.outfitId) : null,
          image: story.image || (outfit && outfit.items && outfit.items[0] && outfit.items[0].image) || null,
          caption: story.caption || (outfit && outfit.caption) || '',
          createdAt: story.createdAt || new Date().toISOString(),
          expiresAt: story.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
        };

        await axios.post(process.env.STORY_WEBHOOK_URL, payload, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.STORY_WEBHOOK_KEY || ''}`,
          },
          timeout: 10000,
        });
      } catch (hookErr) {
        console.warn('STORY_WEBHOOK failed', hookErr?.message || hookErr);
      }
    }

    // Push notifications via Expo (optional)
    if (String(process.env.PUSH_PROVIDER || '').toLowerCase() === 'expo') {
      try {
        // collect followers' tokens
        const followerIds = Array.isArray(user?.followers) ? user.followers : [];
        let tokens = [];
        if (followerIds.length > 0) {
          const followers = await User.find({ _id: { $in: followerIds } }).select('pushTokens').lean();
          for (const f of followers) {
            if (Array.isArray(f.pushTokens)) tokens.push(...f.pushTokens);
          }
        }

        // de-dupe and limit
        tokens = Array.from(new Set(tokens)).filter(Boolean).slice(0, 1000);
        if (tokens.length === 0) return;

        const textBody = outfit?.caption || story.caption || `${user?.username || 'Someone'} posted a new story`;
        const messages = tokens.map((t) => ({
          to: t,
          sound: 'default',
          title: `${user?.username || 'User'} posted a story`,
          body: textBody,
          data: { storyId: String(story._id), outfitId: story.outfitId ? String(story.outfitId) : null },
        }));

        // Expo accepts an array of messages
        await axios.post('https://exp.host/--/api/v2/push/send', messages, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        });
      } catch (pushErr) {
        console.warn('Expo push send failed', pushErr?.message || pushErr);
      }
    }
  } catch (err) {
    console.warn('sendStoryHooks: unexpected error', err?.message || err);
  }
};

const seeData = async () => {
  try {
    const count = await OutFit.countDocuments();
    if (count === 0) {
      const outfits = [
        {
          occasion: "party",
          style: "party",
          items: ["White T-shirt", "Blue Jeans", "Sneakers"],
          image:
            "https://i.pinimg.com/736x/b2/6e/c7/b26ec7bc30ca9459b918ae8f7bf66305.jpg",
        },
        {
          occasion: "work",
          style: "work",
          items: ["cropped T-shirt", "Black Jeans", "samba sneakers"],
          image:
            "https://i.pinimg.com/736x/d7/2d/26/d72d268ca4ff150db1db560b25afb843.jpg",
        },
      ];
      for (const outfit of outfits) {
        const text = `${outfit.occasion} ${outfit.style} ${outfit.items.join(", ")}`;
        const embedding = await generateEmbedding(text);
        await new OutFit({ ...outfit, embedding }).save();
      }
      console.log("Database seeded with", outfits.length, "outfits");
    }
  } catch (error) {
    console.log("seeding failed", error);
  }
};

const buildSavedOutfitSuggestions = (docs = []) => {
  return docs
    .map((doc) => {
      const items = Array.isArray(doc.items)
        ? doc.items.map((item) =>
            normalizeSuggestionItemType(item?.type || "outfit"),
          )
        : [];
      const coverImage = Array.isArray(doc.items)
        ? doc.items.find(
            (item) =>
              typeof item?.image === "string" && item.image.startsWith("http"),
          )?.image ||
          doc.items[0]?.image ||
          ""
        : "";

      return {
        _id: String(doc._id),
        image: coverImage,
        items: items.length > 0 ? items : ["outfit"],
        style: doc.caption || "saved outfit",
        occasion: doc.occasion || "casual",
        score: 0,
        source: "saved",
      };
    })
    .filter((doc) => !!doc.image);
};

const normalizeQuery = (query) => {
  const synonyms = {
    "coffee date": ["coffee", "coffee date", "cafe", "casual meet"],
    "formal event": ["formal", "gala", "black tie", "wedding"],
    work: ["work", "office", "business casual"],
    party: ["party", "night out", "club"],
    interview: ["interview", "job interview", "professional"],
    outfit: ["outfit", "look", "style", "attire"],
    a: "",
    an: "",
    the: "",
    for: "",
    to: "",
    and: "",
    with: "",
    "give me": "",
    suggest: "",
    recommend: "",
    "i want": "",
    "i need": "",
    "looking for": "",
  };
  let normalized = query.toLowerCase();
  Object.keys(synonyms).forEach((key) => {
    normalized = normalized.replace(
      new RegExp(`\\b${key}\\b`, "gi"),
      synonyms[key],
    );
  });
  return [...new Set(normalized.trim(" ").split(/\s+/).filter(Boolean))].join(
    " ",
  );
};

app.get("/smart-search", async (req, res) => {
  const { query } = req.query;
  if (!query)
    return res.status(400).json({ error: "Query parameter is required" });

  try {
    const normalizedQueryStr = normalizeQuery(query);
    const outfits = await OutFit.find();
    let savedSuggestionPool = [];

    try {
      const authHeader = req.headers["authorization"];
      const token = authHeader?.split(" ")?.[1];
      if (token) {
        const decoded = jwt.verify(token, jwtSecret);
        const userId = decoded?.id;
        if (userId) {
          const saved = await savedFits
            .find({ userId })
            .sort({ createdAt: -1 })
            .limit(20);
          savedSuggestionPool = buildSavedOutfitSuggestions(saved);
        }
      }
    } catch (error) {
      console.warn(
        "saved outfit suggestion lookup failed",
        error?.message || error,
      );
    }

    const rawTokens = String(query || "")
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const knownOccasions = [
      "work",
      "casual",
      "formal",
      "party",
      "wedding",
      "interview",
    ];
    if (rawTokens.length === 1 && knownOccasions.includes(rawTokens[0])) {
      const exactSeed = outfits.filter(
        (o) =>
          typeof o.occasion === "string" &&
          o.occasion.toLowerCase() === rawTokens[0],
      );
      const exactSaved = savedSuggestionPool.filter(
        (o) => String(o.occasion || "").toLowerCase() === rawTokens[0],
      );
      return res.json([...exactSaved, ...exactSeed].slice(0, 5));
    }

    const tokenSet = new Set(rawTokens);

    const scoredSaved = savedSuggestionPool
      .map((o) => {
        const haystack = [
          o.occasion,
          o.style,
          ...(Array.isArray(o.items) ? o.items : []),
        ]
          .map((v) => String(v || "").toLowerCase())
          .join(" ");
        const matches = [...tokenSet].filter(
          (term) => term && haystack.includes(term),
        ).length;
        const score = tokenSet.size > 0 ? matches / tokenSet.size : 0;
        return { ...o, score };
      })
      .filter((o) => o.score > 0)
      .sort((a, b) => b.score - a.score);

    const queryEmbedding = await generateEmbedding(normalizedQueryStr);

    const MIN_SIMILARITY = query.length > 20 ? 0.3 : 0.4;
    let scored = outfits
      .map((o) => {
        const score = cosineSimilarity(queryEmbedding, o.embedding);
        return { ...o.toObject(), score };
      })
      .filter((o) => o.score >= MIN_SIMILARITY)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      const queryItems = normalizedQueryStr.split(" ");
      scored = outfits
        .filter((o) =>
          queryItems.some((term) => {
            const occMatch =
              typeof o.occasion === "string" &&
              o.occasion.toLowerCase().includes(term);
            const styleMatch =
              typeof o.style === "string" &&
              o.style.toLowerCase().includes(term);
            const itemsMatch = Array.isArray(o.items)
              ? o.items.some((item) => {
                  if (typeof item === "string")
                    return item.toLowerCase().includes(term);
                  if (item && typeof item.type === "string")
                    return item.type.toLowerCase().includes(term);
                  return false;
                })
              : false;
            return occMatch || styleMatch || itemsMatch;
          }),
        )
        .map((o) => ({ ...o.toObject(), score: 0.1 }));
    }

    res.json([...scoredSaved, ...scored].slice(0, 5));
  } catch (error) {
    res.status(500).json({ error: "Search failed", details: error.message });
  }
});

// ============================================================================
// CLOUDINARY IMAGE ENDPOINTS
// ============================================================================

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is running" });
});
// Mobile models: authenticated manifest + authenticated download proxy.
app.get("/models/mobile/manifest", authenticateToken, (req, res) => {
  const baseUrl = getRequestBaseUrl(req);
  const models = Object.values(MOBILE_MODEL_CATALOG).map((model) => ({
    key: model.key,
    task: model.task,
    preferredBackend: model.preferredBackend,
    input: model.input || null,
    primaryFile: model.primaryFile,
    files: model.files.map((file) => ({
      path: file,
      downloadUrl: `${baseUrl}/models/mobile/download/${model.key}/${encodeURIComponent(file)}`,
    })),
  }));

  res.json({
    generatedAt: new Date().toISOString(),
    models,
  });
});

app.get(/^\/models\/mobile\/download\/([^/]+)\/(.+)$/, authenticateToken, async (req, res) => {
  try {
    const modelKey = req.params[0];
    const filePath = req.params[1];
    const model = MOBILE_MODEL_CATALOG[modelKey];

    if (!model) {
      return res.status(404).json({ error: "Unknown model key" });
    }

    const normalizedPath = decodeURIComponent(filePath || "").replace(/^\/+/, "");
    if (!model.files.includes(normalizedPath)) {
      return res.status(403).json({ error: "File is not allowed for this model" });
    }

    const sourceUrl = `https://huggingface.co/${model.repo}/resolve/main/${normalizedPath}`;
    const response = await axios.get(sourceUrl, {
      responseType: "stream",
      timeout: 120000,
      headers: {
        "User-Agent": "dressha-backend-model-proxy/1.0",
      },
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      return res.status(response.status).json({
        error: "Model file download failed",
        details: `Upstream responded with status ${response.status}`,
      });
    }

    const contentType = response.headers["content-type"] || "application/octet-stream";
    const contentLength = response.headers["content-length"];

    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    res.setHeader("Cache-Control", "private, max-age=3600");
    response.data.pipe(res);
  } catch (error) {
    console.error("Mobile model download proxy error:", error?.message || error);
    res.status(500).json({
      error: "Model file proxy failed",
      details: error?.message || String(error),
    });
  }
});

app.post(
  "/api/images/upload",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    console.log("📨 Upload request received");
    console.log("📋 Request headers:", req.headers);
    console.log(
      "📦 File:",
      req.file
        ? `${req.file.originalname} (${req.file.size} bytes)`
        : "NO FILE",
    );
    console.log("📝 Folder:", req.body.folder);
    console.log("🏷️ itemType:", req.body.itemType, "gender:", req.body.gender);

    try {
      if (!req.file) {
        console.warn("⚠️ No file in request");
        return res
          .status(400)
          .json({ success: false, error: "No file provided" });
      }

      const folder = req.body.folder || "general";
      const allowedFolders = ["outfits", "profiles", "designs", "general"];
      const allowedItemTypes = [
        "top",
        "bottom",
        "dress",
        "skirts",
        "shoes",
        "other",
      ];
      const allowedGenders = ["male", "female", "unisex"];
      const itemType = normalizeItemType(req.body.itemType);
      const gender = allowedGenders.includes(req.body.gender)
        ? req.body.gender
        : "unisex";

      if (!allowedFolders.includes(folder)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid folder" });
      }

      const removeBackground =
        req.body.removeBackground === "true" ||
        req.body.removeBackground === "1" ||
        req.body.removeBackground === "true";

      const uploadResponse = await new Promise((resolve, reject) => {
        const options = {
          folder: `dressha/${folder}`,
          resource_type: "auto",
          quality: "auto",
        };

        if (removeBackground) {
          // Apply background removal effect before storing and request PNG to preserve transparency
          options.transformation = [
            { effect: "background_removal" },
            { format: "png" },
          ];
          options.format = "png";
        }

        const uploadStream = cloudinary.uploader.upload_stream(
          options,
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
        uploadStream.end(req.file.buffer);
      });

      const imageDoc = new Image({
        publicId: uploadResponse.public_id,
        url: uploadResponse.secure_url,
        fileName: req.file.originalname,
        folder: folder,
        size: req.file.size,
        mimeType: req.file.mimetype,
        itemType,
        gender,
        uploadedBy: req.user.id,
        metadata: {
          width: uploadResponse.width,
          height: uploadResponse.height,
          format: uploadResponse.format,
          backgroundRemoved: !!removeBackground,
        },
      });

      await imageDoc.save();

      res.json({
        success: true,
        publicId: uploadResponse.public_id,
        url: uploadResponse.secure_url,
        imageId: imageDoc._id,
        itemType,
        gender,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res
        .status(500)
        .json({ success: false, error: error.message || "Upload failed" });
    }
  },
);

app.delete("/api/images/:publicId", authenticateToken, async (req, res) => {
  try {
    const { publicId } = req.params;
    const decodedPublicId = decodeURIComponent(publicId);

    const imageDoc = await Image.findOne({ publicId: decodedPublicId });
    if (imageDoc && imageDoc.uploadedBy !== req.user.id) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    await cloudinary.uploader.destroy(decodedPublicId);
    await Image.deleteOne({ publicId: decodedPublicId });

    res.json({ success: true, message: "Image deleted" });
  } catch (error) {
    console.error("Delete error:", error);
    res
      .status(500)
      .json({ success: false, error: error.message || "Delete failed" });
  }
});

app.post("/api/images/signed-url", authenticateToken, async (req, res) => {
  try {
    const { publicId, expiryTime = 3600 } = req.body;

    if (!publicId) {
      return res
        .status(400)
        .json({ success: false, error: "publicId required" });
    }

    const signedUrl = cloudinary.url(publicId, {
      sign_url: true,
      type: "authenticated",
      expiration: Math.floor(Date.now() / 1000) + expiryTime,
    });

    res.json({
      success: true,
      url: signedUrl,
      expiry: Date.now() + expiryTime * 1000,
    });
  } catch (error) {
    console.error("Signed URL error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to generate signed URL",
      });
  }
});

app.post("/api/images/metadata", authenticateToken, async (req, res) => {
  try {
    const { publicId, url, fileName, folder, relatedTo, relatedId } = req.body;

    if (!publicId) {
      return res
        .status(400)
        .json({ success: false, error: "publicId required" });
    }

    const userId = req.user.id;

    const imageDoc = await Image.findOneAndUpdate(
      { publicId },
      {
        $set: {
          url,
          fileName,
          folder,
          relatedTo,
          relatedId,
          uploadedBy: userId,
        },
        $setOnInsert: { publicId },
      },
      { new: true, upsert: true, runValidators: true },
    );

    res.json({ success: true, imageId: imageDoc._id });
  } catch (error) {
    console.error("Metadata save error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to save metadata",
      });
  }
});

app.get(
  "/api/images/metadata/:publicId",
  authenticateToken,
  async (req, res) => {
    try {
      const { publicId } = req.params;
      const metadata = await Image.findOne({ publicId });

      if (!metadata) {
        return res
          .status(404)
          .json({ success: false, error: "Image not found" });
      }

      res.json({ success: true, metadata });
    } catch (error) {
      console.error("Metadata fetch error:", error);
      res
        .status(500)
        .json({
          success: false,
          error: error.message || "Failed to fetch metadata",
        });
    }
  },
);

app.post("/api/images/batch-delete", authenticateToken, async (req, res) => {
  try {
    const { publicIds } = req.body;

    if (!Array.isArray(publicIds) || publicIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid publicIds" });
    }

    await cloudinary.api.delete_resources(publicIds);
    await Image.deleteMany({ publicId: { $in: publicIds } });

    res.json({ success: true, deletedCount: publicIds.length });
  } catch (error) {
    console.error("Batch delete error:", error);
    res
      .status(500)
      .json({ success: false, error: error.message || "Batch delete failed" });
  }
});

app.get("/api/images/user", authenticateToken, async (req, res) => {
  try {
    const images = await Image.find({ uploadedBy: req.user.id })
      .sort({ uploadedAt: -1 })
      .limit(100);

    res.json({ success: true, images });
  } catch (error) {
    console.error("User images fetch error:", error);
    res
      .status(500)
      .json({
        success: false,
        error: error.message || "Failed to fetch images",
      });
  }
});

app.get(
  "/api/images/category/:category",
  authenticateToken,
  async (req, res) => {
    try {
      const { category } = req.params;
      const allowedCategories = ["outfit", "user-profile", "design", "other"];

      if (!allowedCategories.includes(category)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid category" });
      }

      const images = await Image.find({
        uploadedBy: req.user.id,
        relatedTo: category,
      })
        .sort({ uploadedAt: -1 })
        .limit(100);

      res.json({ success: true, images });
    } catch (error) {
      console.error("Category images fetch error:", error);
      res
        .status(500)
        .json({
          success: false,
          error: error.message || "Failed to fetch images",
        });
    }
  },
);

// Weather-based outfit suggestion endpoint
// Helper: normalize city/display names to a short, safe form
function sanitizeCityName(name) {
  try {
    if (!name) return '';
    let s = String(name).trim();
    // If Nominatim returns a display_name with commas, take the first segment
    if (s.indexOf(',') !== -1) s = s.split(',')[0].trim();
    // Remove parenthetical notes and excessive whitespace
    s = s.replace(/\s*\(.*?\)\s*/g, '').replace(/\s+/g, ' ');
    return s;
  } catch (e) {
    return String(name || '');
  }
}

app.get("/weather/suggest", async (req, res) => {
  try {
    const { city, lat, lon } = req.query;
    let latitude = lat;
    let longitude = lon;
    let cityName = city;

    const apiKey = process.env.WEATHER_API_KEY;
    if (!latitude || !longitude) {
      if (!city)
        return res.status(400).json({ error: "city or lat/lon required" });
      if (apiKey) {
        const geoRes = await axios.get(
          `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(String(city))}&limit=1&appid=${apiKey}`,
        );
        if (!Array.isArray(geoRes.data) || geoRes.data.length === 0) {
          return res.status(404).json({ error: "Location not found" });
        }
        latitude = geoRes.data[0].lat;
        longitude = geoRes.data[0].lon;
        cityName = geoRes.data[0].name || city;
      } else {
        const geoRes = await axios.get(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(String(city))}`,
        );
        if (!Array.isArray(geoRes.data) || geoRes.data.length === 0)
          return res.status(404).json({ error: "Location not found" });
        latitude = geoRes.data[0].lat;
        longitude = geoRes.data[0].lon;
        cityName = geoRes.data[0].display_name || city;
      }
    }

    let weatherData = null;
    if (apiKey) {
      const w = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`,
      );
      const body = w.data;
      weatherData = {
        source: "openweathermap",
        temperature: body.main?.temp,
        windspeed: body.wind?.speed,
        weatherId: body.weather?.[0]?.id,
        description: body.weather?.[0]?.description,
      };
    } else {
      const w = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`,
      );
      const body = w.data?.current_weather || {};
      weatherData = {
        source: "open-meteo",
        temperature: body.temperature,
        windspeed: body.windspeed,
        weatherCode: body.weathercode,
      };
    }

    if (!cityName) {
      try {
        if (apiKey) {
          const rev = await axios.get(
            `http://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${apiKey}`,
          );
          if (Array.isArray(rev.data) && rev.data.length > 0) {
            cityName =
              rev.data[0].name ||
              (rev.data[0].local_names && rev.data[0].local_names.en) ||
              `${latitude},${longitude}`;
          } else if (rev.data && rev.data.name) {
            cityName = rev.data.name;
          }
        } else {
          const rev = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
          );
          cityName =
            rev.data?.address?.city ||
            rev.data?.address?.town ||
            rev.data?.address?.village ||
            rev.data?.display_name ||
            `${latitude},${longitude}`;
        }
      } catch {
        cityName = cityName || `${latitude},${longitude}`;
      }
    }

    const temp = weatherData.temperature;
    const wind = weatherData.windspeed || 0;
    const weatherId = weatherData.weatherId ?? weatherData.weatherCode;
    const isRain =
      typeof weatherId === "number"
        ? (weatherId >= 500 && weatherId < 700) ||
          (weatherId >= 200 && weatherId < 300)
        : false;

    const suggestions = [];
    if (isRain) suggestions.push("Umbrella", "Waterproof jacket");
    if (typeof temp === "number") {
      if (temp <= 5) suggestions.push("Heavy coat", "Thermal layers");
      else if (temp <= 15) suggestions.push("Light jacket", "Long-sleeve top");
      else if (temp <= 25)
        suggestions.push("Layered outfit", "Comfortable pants");
      else suggestions.push("T-shirt", "Shorts", "Light footwear");
    }
    if ((apiKey && wind > 10) || (!apiKey && wind > 20))
      suggestions.unshift("Windbreaker");

    const useInventory =
      String(req.query.useInventory || "").toLowerCase() === "true";
    let inventoryMatches = [];
    let savedDocs = null;
    if (useInventory) {
      try {
        const authHeader = req.headers["authorization"];
        const token = authHeader?.split(" ")?.[1];
        if (token) {
          const decoded = jwt.verify(token, jwtSecret);
          const userId = decoded?.id;
          if (userId) {
            const saved = await savedFits.find({ userId });
            savedDocs = saved;
            const items = [];
            for (const s of saved) {
              if (Array.isArray(s.items)) {
                for (const it of s.items) {
                  items.push({
                    type: it.type || "",
                    image: it.image || "",
                    id: it.id || null,
                    outfitId: s._id,
                  });
                }
              }
            }
            inventoryMatches = items;
          }
        }
      } catch (e) {
        console.warn("inventory match lookup failed", e?.message || e);
      }
    }

    cityName = sanitizeCityName(cityName);
    let inventoryOutfits = [];
    try {
      if (savedDocs && Array.isArray(savedDocs) && suggestions.length > 0) {
        const suggestionTokens = suggestions.map((s) =>
          String(s).toLowerCase(),
        );
        const matches = savedDocs.filter((doc) => {
          if (!Array.isArray(doc.items)) return false;
          return doc.items.some((it) => {
            const t = (it.type || "").toString().toLowerCase();
            return suggestionTokens.some(
              (tok) => t.includes(tok) || tok.includes(t),
            );
          });
        });
        inventoryOutfits = matches.map((m) => ({
          id: m._id,
          caption: m.caption || "",
          occasion: m.occasion || "",
          items: m.items || [],
        }));
      }
    } catch {
      inventoryOutfits = [];
    }

    return res.json({
      city: cityName,
      weather: weatherData,
      suggestions: Array.from(new Set(suggestions)),
      inventory: inventoryMatches,
      inventoryOutfits,
    });
  } catch (err) {
    console.error("Weather suggest error", err?.message || err);
    return res
      .status(500)
      .json({
        error: "Weather suggestion failed",
        details: err?.message || String(err),
      });
  }
});

// Save user notification times
app.post("/me/notifications", authenticateToken, async (req, res) => {
  try {
    const { times } = req.body || {};
    if (!Array.isArray(times))
      return res
        .status(400)
        .json({ error: "times must be an array of HH:MM strings" });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.notificationTimes = times;
    await user.save();
    return res.json({ notificationTimes: user.notificationTimes });
  } catch (err) {
    console.error("Save notifications error", err?.message || err);
    return res.status(500).json({ error: "Failed to save notification times" });
  }
});

// Color Analysis Endpoints
const generateStyleJudge = (colorAnalysis) => {
  const { colorFamily } = colorAnalysis;

  const styleGuides = {
    'warm red': {
      summary: 'Warm red tones evoke confidence and energy. Perfect for statement pieces.',
      bestFor: ['Evening wear', 'Power outfits', 'Formal events', 'Statement accessories'],
      avoid: ['Competing warm tones', 'Orange-heavy palettes', 'Clashing warm colors'],
      styleNotes: ['Pair with neutral bases for balance', 'Complements gold jewelry', 'Best with warm skin undertones'],
      trendTakeaway: 'Red is timeless in fashion—embrace confidence',
    },
    'warm amber': {
      summary: 'Amber and gold tones create warmth and approachability.',
      bestFor: ['Casual wear', 'Day outfits', 'Warm-toned accessories', 'Layering'],
      avoid: ['Cool silvers', 'Icy palettes', 'Cool blues'],
      styleNotes: ['Versatile for transitional seasons', 'Enhances warm complexions', 'Works well in monochromatic looks'],
      trendTakeaway: 'Earthy tones remain fashion-forward',
    },
    'balanced green': {
      summary: 'Green represents nature, balance, and calm. Highly versatile.',
      bestFor: ['Everyday wear', 'Sustainable fashion', 'Fresh looks', 'Nature-inspired'],
      avoid: ['Overly saturated warm tones', 'Neon contrasts'],
      styleNotes: ['Works with most skin tones', 'Complements both silver and gold', 'Timeless and eco-conscious'],
      trendTakeaway: 'Green is having a major moment in sustainable fashion',
    },
    'cool cyan': {
      summary: 'Cool blues and cyans bring sophistication and calm.',
      bestFor: ['Professional wear', 'Summer outfits', 'Fresh looks', 'Cool undertones'],
      avoid: ['Warm oranges', 'Overly saturated reds'],
      styleNotes: ['Great for business casual', 'Complements silver jewelry', 'Cooling effect on overall look'],
      trendTakeaway: 'Cool tones are trending in modern minimalism',
    },
    'cool blue': {
      summary: 'Deep blue is classic, trustworthy, and endlessly stylish.',
      bestFor: ['All-purpose wear', 'Denim looks', 'Formal occasions', 'Timeless pieces'],
      avoid: ['Conflicting cool purples', 'Warm reds without balance'],
      styleNotes: ['Universal color that works year-round', 'Perfect denim base', 'Pairs well with neutrals and accent colors'],
      trendTakeaway: 'Navy blue is a wardrobe staple',
    },
    'neutral violet': {
      summary: 'Purple bridges warm and cool - creative and expressive.',
      bestFor: ['Bold statement pieces', 'Creative expressions', 'Evening wear', 'Accessories'],
      avoid: ['Clashing violets', 'Too many bold contrasts'],
      styleNotes: ['Make it a focal point rather than base', 'Works best with neutrals', 'Shows personality and creativity'],
      trendTakeaway: 'Purple is the new neutral for creative individuals',
    },
  };

  return styleGuides[colorFamily] || {
    summary: `${colorFamily} tones create a unique style signature.`,
    bestFor: ['Fashion-forward looks', 'Personal expression'],
    avoid: ['Clashing color combinations'],
    styleNotes: ['Embrace your unique color palette'],
    trendTakeaway: 'Unique colors are trending in personalized fashion',
  };
};

const getLiveFashionTrends = (colorFamily) => {
  const trends = {
    'warm red': [
      { title: 'Red Hot Trend 2026', snippet: 'Deep reds and crimsons dominate spring runways. Pair with neutrals for modern elegance.', relevanceScore: 0.95 },
      { title: 'Power Red Movement', snippet: 'Red continues as the ultimate confidence color in professional fashion.', relevanceScore: 0.88 },
    ],
    'cool blue': [
      { title: 'Navy Renaissance', snippet: 'Navy blue is reimagined in modern silhouettes and oversized fits.', relevanceScore: 0.92 },
      { title: 'Ocean-Inspired Palettes', snippet: 'Deep ocean blues lead sustainable fashion initiatives in 2026.', relevanceScore: 0.85 },
    ],
    'balanced green': [
      { title: 'Earth Tones Rise', snippet: 'Green, brown, and beige create the ultimate sustainable aesthetic.', relevanceScore: 0.9 },
      { title: 'Eco-Conscious Green', snippet: 'Green symbolizes commitment to sustainable and ethical fashion.', relevanceScore: 0.87 },
    ],
  };

  return trends[colorFamily] || [
    { title: 'Trend Context', snippet: 'Your color choice aligns with contemporary fashion movements.', relevanceScore: 0.75 },
  ];
};

const generateRecommendations = (colorAnalysis) => {
  const { dominantColor, colorFamily, dominantColors } = colorAnalysis;
  const seasonMap = {
    'warm red': ['Autumn', 'Winter', 'Evening'],
    'warm amber': ['Spring', 'Summer', 'Casual'],
    'balanced green': ['Spring', 'Summer', 'Year-round'],
    'cool cyan': ['Summer', 'Spring', 'Fresh'],
    'cool blue': ['Year-round', 'Professional', 'Classic'],
    'neutral violet': ['Artistic', 'Evening', 'Bold'],
  };

  return {
    palette: dominantColors?.slice(0, 3) || [dominantColor],
    styleAdvice: [
      `Balance ${colorFamily} tones with complementary neutrals`,
      'Mix patterns and textures for visual interest',
      'Consider undertones when selecting accessories',
      'Use lighting to enhance color depth',
    ],
    seasonalTags: seasonMap[colorFamily] || ['Seasonal', 'Versatile'],
  };
};

app.post('/api/analysis/color-guidance', authenticateToken, async (req, res) => {
  try {
    const colorAnalysis = req.body;
    if (!colorAnalysis.dominantColor || !colorAnalysis.colorFamily) {
      return res.status(400).json({ error: 'Missing required color analysis fields' });
    }

    const styleJudge = generateStyleJudge(colorAnalysis);
    const liveTrends = getLiveFashionTrends(colorAnalysis.colorFamily);
    const recommendations = generateRecommendations(colorAnalysis);

    res.json({
      styleJudge: { ...styleJudge, model: 'smollm2-style-guide', confidence: 'High' },
      liveTrends,
      recommendations,
      accessibility: {
        wcagLevel: 'AA',
        contrastWithWhite: 4.5,
        contrastWithBlack: 5.2,
      },
    });
  } catch (error) {
    console.error('Color guidance endpoint error:', error);
    res.status(500).json({ error: 'Failed to generate color guidance', message: error.message });
  }
});

app.post('/api/analysis/outfit-suggestions', authenticateToken, async (req, res) => {
  try {
    res.json({
      suggestions: [
        { category: 'Tops', suggestions: ['Neutral white or cream for balance', 'Matching shade for monochromatic look', 'Complementary neutral base'] },
        { category: 'Bottoms', suggestions: ['Classic denim or neutral pants', 'Matching skirt for cohesive look', 'Neutral black or grey for contrast'] },
        { category: 'Accessories', suggestions: ['Metallic accents matching undertone', 'Neutral leather bag', 'Complementary jewelry tones'] },
      ],
    });
  } catch (error) {
    console.error('Outfit suggestions error:', error);
    res.status(500).json({ error: 'Failed to generate outfit suggestions' });
  }
});

app.get('/api/trends/fashion-color-trends', authenticateToken, async (req, res) => {
  try {
    const { colorFamily } = req.query;
    if (!colorFamily) {
      return res.status(400).json({ error: 'Missing colorFamily parameter' });
    }

    res.json({ trends: getLiveFashionTrends(colorFamily) });
  } catch (error) {
    console.error('Fashion trends error:', error);
    res.status(500).json({ error: 'Failed to fetch fashion trends' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  if (
    err &&
    (err.type === "entity.too.large" ||
      err.status === 413 ||
      err.name === "PayloadTooLargeError")
  ) {
    return res
      .status(413)
      .json({
        success: false,
        error: "Payload too large",
        details:
          "The saved outfit image is too large. Try saving a smaller outfit image.",
      });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ success: false, error: "File too large. Max size is 15MB." });
    }
    return res
      .status(400)
      .json({ success: false, error: err.message || "Upload error" });
  }

  if (err) {
    console.error("Unhandled backend error:", err);
    return res
      .status(500)
      .json({ success: false, error: err.message || "Internal server error" });
  }

  next();
});



// Exchange authorization code (PKCE or standard) for tokens on the server
app.post("/auth/google/code", async (req, res) => {
  try {
    const { code, codeVerifier, redirectUri, clientId } = req.body || {};

    if (!googleWebClientId) {
      return res
        .status(500)
        .json({ error: "Google web client ID not configured on server" });
    }

    if (!code || !redirectUri) {
      return res.status(400).json({ error: "Missing code or redirectUri" });
    }

    const exchangeClientId = clientId || googleWebClientId;

    if (!exchangeClientId) {
      return res
        .status(500)
        .json({ error: "Google client ID not provided for token exchange" });
    }

    const shouldUseClientSecret =
      exchangeClientId === googleWebClientId &&
      !!process.env.GOOGLE_CLIENT_SECRET;

    if (exchangeClientId === googleWebClientId && !shouldUseClientSecret) {
      return res
        .status(500)
        .json({ error: "Google client secret not configured on server" });
    }

    // Exchange code for tokens
    const params = new URLSearchParams();
    params.append("code", code);
    params.append("client_id", exchangeClientId);
    if (shouldUseClientSecret) {
      params.append("client_secret", process.env.GOOGLE_CLIENT_SECRET);
    }
    params.append("redirect_uri", redirectUri);
    params.append("grant_type", "authorization_code");
    if (codeVerifier) params.append("code_verifier", codeVerifier);

    const tokenRes = await axios.post(
      discovery.tokenEndpoint,
      params.toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    const { id_token } = tokenRes.data || {};
    if (!id_token)
      return res
        .status(400)
        .json({ error: "Token exchange did not return id_token" });

    // Verify id_token and create/return app JWT similarly to /auth/google
    const tokenVerifier = new OAuth2Client(exchangeClientId);
    const ticket = await tokenVerifier.verifyIdToken({
      idToken: id_token,
      audience: exchangeClientId,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload?.email) {
      return res.status(400).json({ error: "Invalid Google account payload" });
    }

    const googleId = payload.sub;
    const email = String(payload.email).toLowerCase();
    const displayName =
      payload.name || payload.given_name || email.split("@")[0];
    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    let created = false;

    if (user) {
      let changed = false;
      if (!user.googleId) {
        user.googleId = googleId;
        changed = true;
      }
      if (user.authProvider !== "google") {
        user.authProvider = "google";
        changed = true;
      }
      if (!user.profilePicture && payload.picture) {
        user.profilePicture = payload.picture;
        changed = true;
      }
      if (!user.profileName && payload.name) {
        user.profileName = payload.name;
        changed = true;
      }
      if (changed) await user.save();
    } else {
      const username = await generateUniqueUsername(displayName);
      user = new User({
        email,
        username,
        password: "",
        gender: "",
        profilePicture: payload.picture || "",
        profileName: payload.name || "",
        googleId,
        authProvider: "google",
        outfits: [],
      });
      await user.save();
      created = true;
    }

    const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: "30d" });
    const safeUser = await User.findById(user._id).select("-password");
    return res.status(created ? 201 : 200).json({ token, user: safeUser });
  } catch (error) {
    console.error(
      "Google code exchange error:",
      error.response?.data || error.message || error,
    );
    return res
      .status(500)
      .json({
        error:
          error.response?.data ||
          error.message ||
          "Google code exchange failed",
      });
  }
});








const getLocalIp = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
};

// Simple background scheduler: send pushes to users at their preferred times (HH:MM)
// This is a best-effort prototype; for production use a reliable job queue and timezone-aware scheduling.
// If Agenda is available, create a job that runs every minute and sends timezone-aware pushes.
if (agenda) {
  agenda.define('check-notification-times', async (job) => {
    try {
      const nowUtc = DateTime.utc();
      // Find users with times and push tokens
      const users = await User.find({ notificationTimes: { $exists: true, $ne: [] }, pushTokens: { $exists: true, $ne: [] } });
      const messages = [];

      for (const user of users) {
        const tz = user.timezone || 'UTC';
        const now = nowUtc.setZone(tz);
        const hh = String(now.hour).padStart(2, '0');
        const mm = String(now.minute).padStart(2, '0');
        const timeKey = `${hh}:${mm}`;

        const times = Array.isArray(user.notificationTimes) ? user.notificationTimes : [];
        if (!times.includes(timeKey)) continue;

        // Avoid duplicates using notificationLastSent map
        const lastSentMap = user.notificationLastSent || {};
        const lastSent = lastSentMap.get ? lastSentMap.get(timeKey) : lastSentMap[timeKey];
        const sentRecently = lastSent ? DateTime.fromJSDate(new Date(lastSent)).plus({ minutes: 5 }) > now : false;
        if (sentRecently) continue;

        // Build message body by fetching fresh suggestions for the user (server-side)
        let bodyText = 'Your daily outfit suggestions are ready — open Dressha to view them.';
        try {
          const loc = (user.lastLocation && user.lastLocation.lat && user.lastLocation.lon) ? user.lastLocation : null;
          const authToken = jwt.sign({ id: String(user._id) }, jwtSecret, { expiresIn: '1h' });
          let url = `http://127.0.0.1:${PORT}/weather/suggest?useInventory=true`;
          if (loc) url += `&lat=${encodeURIComponent(String(loc.lat))}&lon=${encodeURIComponent(String(loc.lon))}`;
          const resp = await axios.get(url, { headers: { Authorization: `Bearer ${authToken}` }, timeout: 10000 });
          const s = resp.data?.suggestions || [];
          if (Array.isArray(s) && s.length > 0) bodyText = s.slice(0, 4).join(', ');
        } catch (e) {
          console.warn('Failed to fetch suggestions for push', e?.message || e);
        }

        const tokens = (user.pushTokens || []).slice(0, 50);
        for (const t of tokens) {
          messages.push({
            to: t,
            sound: 'default',
            title: 'Dressha',
            body: bodyText,
            data: { userId: String(user._id), route: 'WeatherSuggestion' },
          });
        }

        // update last sent map
        try {
          user.notificationLastSent = user.notificationLastSent || new Map();
          if (user.notificationLastSent.set) user.notificationLastSent.set(timeKey, new Date());
          else user.notificationLastSent[timeKey] = new Date();
          await user.save();
        } catch (e) {
          console.warn('Failed to update lastSent for user', user._id, e?.message || e);
        }
      }

      if (messages.length === 0) return;

      const chunkSize = 100;
      for (let i = 0; i < messages.length; i += chunkSize) {
        const chunk = messages.slice(i, i + chunkSize);
        await axios.post('https://exp.host/--/api/v2/push/send', chunk, { headers: { 'Content-Type': 'application/json' } });
      }
    } catch (e) {
      console.error('Agenda notification job failed', e?.response?.data || e.message || e);
    }
  });

  (async () => {
    try {
      await agenda.start();
      await agenda.every('1 minute', 'check-notification-times');
    } catch (e) {
      console.warn('Agenda start/cron registration failed', e?.message || e);
    }
  })();
} else {
  // Fallback: lightweight in-memory scheduler (existing behavior)
  const sentThisMinute = new Set();
  const SCHED_INTERVAL_MS = 60 * 1000;
  const sendDueNotifications = async () => {
    try {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const timeKey = `${hh}:${mm}`;

      const users = await User.find({ notificationTimes: { $exists: true, $ne: [] }, pushTokens: { $exists: true, $ne: [] } }).lean();
      const messages = [];

      for (const user of users) {
        const times = Array.isArray(user.notificationTimes) ? user.notificationTimes : [];
        if (!times.includes(timeKey)) continue;
        const sentKey = `${String(user._id)}:${timeKey}`;
        if (sentThisMinute.has(sentKey)) continue;
        sentThisMinute.add(sentKey);

        // Build message body by fetching fresh suggestions for the user (server-side)
        let bodyText = 'Your daily outfit suggestions are ready — open Dressha to view them.';
        try {
          const loc = (user.lastLocation && user.lastLocation.lat && user.lastLocation.lon) ? user.lastLocation : null;
          const authToken = jwt.sign({ id: String(user._id) }, jwtSecret, { expiresIn: '1h' });
          let url = `http://127.0.0.1:${PORT}/weather/suggest?useInventory=true`;
          if (loc) url += `&lat=${encodeURIComponent(String(loc.lat))}&lon=${encodeURIComponent(String(loc.lon))}`;
          const resp = await axios.get(url, { headers: { Authorization: `Bearer ${authToken}` }, timeout: 10000 });
          const s = resp.data?.suggestions || [];
          if (Array.isArray(s) && s.length > 0) bodyText = s.slice(0, 4).join(', ');
        } catch (e) {
          console.warn('Failed to fetch suggestions for push', e?.message || e);
        }

        const tokens = (user.pushTokens || []).slice(0, 50);
        for (const t of tokens) {
          messages.push({ to: t, sound: 'default', title: 'Dressha', body: bodyText, data: { userId: String(user._id), route: 'WeatherSuggestion' } });
        }
      }

      if (messages.length === 0) return;

      const chunkSize = 100;
      for (let i = 0; i < messages.length; i += chunkSize) {
        const chunk = messages.slice(i, i + chunkSize);
        await axios.post('https://exp.host/--/api/v2/push/send', chunk, { headers: { 'Content-Type': 'application/json' } });
      }
    } catch (e) {
      console.error('Background push scheduler failed', e?.response?.data || e.message || e);
    }
  };

  setInterval(() => {
    sentThisMinute.clear();
    sendDueNotifications().catch((e) => console.error('Scheduler error', e));
  }, SCHED_INTERVAL_MS);
}

// Register device push token for the authenticated user
app.post('/notifications/register', authenticateToken, async (req, res) => {
  try {
    const { token, timezone } = req.body || {};
    if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Missing token' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.pushTokens = user.pushTokens || [];
    if (!user.pushTokens.includes(token)) {
      user.pushTokens.push(token);
      if (timezone && typeof timezone === 'string') user.timezone = timezone;
      await user.save();
    }

    res.json({ success: true });
  } catch (e) {
    console.error('Register push token failed', e);
    res.status(500).json({ error: e.message || 'Failed to register token' });
  }
});

// Unregister a push token
app.post('/notifications/unregister', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Missing token' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.pushTokens = (user.pushTokens || []).filter((t) => t !== token);
    await user.save();
    res.json({ success: true });
  } catch (e) {
    console.error('Unregister push token failed', e);
    res.status(500).json({ error: e.message || 'Failed to unregister token' });
  }
});

// Save last location for weather suggestions
app.post('/weather/location', authenticateToken, async (req, res) => {
  try {
    const { lat, lon, city } = req.body || {};
    if ((!lat || !lon) && !city) return res.status(400).json({ error: 'lat/lon or city required' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.lastLocation = user.lastLocation || {};
    if (lat && lon) {
      user.lastLocation.lat = lat;
      user.lastLocation.lon = lon;
    }
    if (city) user.lastLocation.city = city;
    await user.save();
    res.json({ success: true, lastLocation: user.lastLocation });
  } catch (e) {
    console.error('Save weather location failed', e);
    res.status(500).json({ error: e.message || 'Failed to save location' });
  }
});

// Send a test notification to the current user's registered tokens using Expo push service
app.post('/notifications/send-test', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const tokens = (user.pushTokens || []).slice(0, 50);
    if (tokens.length === 0) return res.status(400).json({ error: 'No registered tokens' });

    const messages = tokens.map((t) => ({
      to: t,
      sound: 'default',
      title: 'Dressha',
      body: 'Test notification from Dressha',
      data: { source: 'test' },
    }));

    // Send via Expo push endpoint
    const chunkSize = 100;
    const chunks = [];
    for (let i = 0; i < messages.length; i += chunkSize) chunks.push(messages.slice(i, i + chunkSize));

    for (const chunk of chunks) {
      await axios.post('https://exp.host/--/api/v2/push/send', chunk, { headers: { 'Content-Type': 'application/json' } });
    }

    res.json({ success: true, sent: tokens.length });
  } catch (e) {
    console.error('Send test notifications failed', e?.response?.data || e.message || e);
    res.status(500).json({ error: e.message || 'Failed to send notifications' });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📱 Access from mobile device: http://${getLocalIp()}:${PORT}`);
  seeData();
});

// Save or update the authenticated user's preferred notification times
app.post('/notifications/times', authenticateToken, async (req, res) => {
  try {
    const { times, timezone, mode, lastLocation } = req.body || {};
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // If client provided lastLocation, persist it
    if (lastLocation && typeof lastLocation === 'object') {
      user.lastLocation = {
        city: lastLocation.city || null,
        lat: lastLocation.lat || null,
        lon: lastLocation.lon || null,
      };
    }

    // Support 'auto' mode: compute times based on sunrise/sunset if location available
    if (String(mode || '').toLowerCase() === 'auto') {
      let computed = [];
      try {
        const loc = user.lastLocation || lastLocation || {};
        if (loc && loc.lat && loc.lon) {
          const tz = timezone || user.timezone || 'UTC';
          const today = new Date().toISOString().slice(0, 10);
          const meta = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(loc.lat))}&longitude=${encodeURIComponent(String(loc.lon))}&daily=sunrise,sunset&timezone=${encodeURIComponent(tz)}&start_date=${today}&end_date=${today}`);
          const sunrise = meta.data?.daily?.sunrise?.[0];
          const sunset = meta.data?.daily?.sunset?.[0];
          if (sunrise) {
            const d = new Date(sunrise);
            d.setHours(d.getHours() + 1);
            computed.push(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);
          }
          if (sunset) {
            const d2 = new Date(sunset);
            d2.setHours(d2.getHours() - 1);
            computed.push(`${String(d2.getHours()).padStart(2,'0')}:${String(d2.getMinutes()).padStart(2,'0')}`);
          }
        }
      } catch (e) {
        console.warn('Auto compute times failed', e?.message || e);
      }
      // Fallback to defaults
      if (computed.length === 0) computed = ['09:00','18:00'];
      user.notificationTimes = computed.slice(0,50);
    } else {
      if (!Array.isArray(times)) return res.status(400).json({ error: 'times must be an array of HH:MM strings' });
      user.notificationTimes = times.map(String).slice(0, 50);
    }

    if (timezone && typeof timezone === 'string') user.timezone = timezone;
    await user.save();
    // ensure agenda job exists to check times
    if (agenda) {
      try {
        await agenda.start();
      } catch (e) {
        console.warn('Agenda start failed', e?.message || e);
      }
    }
    res.json({ success: true, times: user.notificationTimes });
  } catch (e) {
    console.error('Save notification times failed', e);
    res.status(500).json({ error: e.message || 'Failed to save times' });
  }
});

// Retrieve the authenticated user's preferred notification times
app.get('/notifications/times', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ times: user.notificationTimes || [] });
  } catch (e) {
    console.error('Get notification times failed', e);
    res.status(500).json({ error: e.message || 'Failed to retrieve times' });
  }
});

// Follow a user
app.post('/user/:userId/follow', authenticateToken, async (req, res) => {
  try {
    const targetId = req.params.userId;
    const meId = req.user.id;
    if (targetId === meId) return res.status(400).json({ error: 'Cannot follow yourself' });

    const target = await User.findById(targetId);
    const me = await User.findById(meId);
    if (!target || !me) return res.status(404).json({ error: 'User not found' });

    // Add follower if not present
    if (!target.followers) target.followers = [];
    if (!me.following) me.following = [];
    const already = String(target.followers || []).includes(String(meId));
    if (!already) {
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

