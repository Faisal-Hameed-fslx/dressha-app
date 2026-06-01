import mongoose from 'mongoose';

const SavedFitSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  items: [
    {
      id: { type: String },
      type: { type: String, required: true },
      image: { type: String, required: true },
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
  ],
  caption: {
    type: String,
    default: '',
  },
  occasion: {
    type: String,
    default: 'casual',
  },
  visibility: { type: String, default: 'Everyone' },
  isOotd: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  // Social features
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: { type: String },
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

export default mongoose.model('SavedOutfit', SavedFitSchema);
