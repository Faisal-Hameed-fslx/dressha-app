import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false, default: '' },
  username: { type: String, required: true, unique: true },
  profileName: { type: String },
  gender: String,
  profilePicture: String,
  googleId: { type: String, unique: true, sparse: true },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  outfits: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SavedOutfit' }],
  // store preferred notification times (e.g. ["09:00","18:00"])
  notificationTimes: { type: [String], default: [] },
  // store push tokens (Expo or FCM/APNs tokens)
  pushTokens: { type: [String], default: [] },
  // user's timezone, e.g. 'Asia/Karachi'
  timezone: { type: String, default: null },
  // last searched/shared location for weather suggestions
  lastLocation: {
    city: { type: String, default: null },
    lat: { type: Number, default: null },
    lon: { type: Number, default: null },
  },
  // record last sent times per HH:MM to avoid duplicate sends
  notificationLastSent: { type: Map, of: Date, default: {} },
  // social graph
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

UserSchema.pre('save', async function () {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

UserSchema.methods.comparePassword = async function (password) {
  if (!this.password) {
    return false;
  }

  return bcrypt.compare(password, this.password);
};

export default mongoose.model('User', UserSchema);
