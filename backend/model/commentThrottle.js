import mongoose from 'mongoose';

const CommentThrottleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    windowStart: { type: Date, required: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

CommentThrottleSchema.index({ userId: 1, windowStart: 1 }, { unique: true });
CommentThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('CommentThrottle', CommentThrottleSchema);