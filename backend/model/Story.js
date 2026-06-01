import mongoose from 'mongoose';

const StorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  outfitId: { type: mongoose.Schema.Types.ObjectId, ref: 'SavedOutfit' },
  image: { type: String },
  caption: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
});

StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Story', StorySchema);
