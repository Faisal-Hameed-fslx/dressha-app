import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema({
  publicId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  url: {
    type: String,
    required: true,
  },
  fileName: String,
  folder: {
    type: String,
    enum: ['outfits', 'profiles', 'designs', 'general'],
    default: 'general',
  },
  size: Number,
  mimeType: String,
  relatedTo: {
    type: String,
    enum: ['outfit', 'user-profile', 'design', 'other'],
  },
  relatedId: String,
  itemType: {
    type: String,
    enum: ['top', 'bottom', 'dress', 'skirts', 'shoes', 'other'],
    default: 'other',
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'unisex'],
    default: 'unisex',
  },
  uploadedBy: {
    type: String,
    required: true,
    default: 'anonymous',
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  metadata: {
    width: Number,
    height: Number,
    format: String,
    backgroundRemoved: {
      type: Boolean,
      default: false,
    },
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Index for faster queries
imageSchema.index({ uploadedBy: 1, folder: 1 });
imageSchema.index({ uploadedBy: 1, relatedTo: 1 });

export default mongoose.model('Image', imageSchema);
