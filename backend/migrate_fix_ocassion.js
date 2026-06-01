import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI not set in .env');
  process.exit(1);
}

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const coll = mongoose.connection.collection('savedoutfits');
    // Update documents that still have `ocassion` field: copy value to `occasion` and unset `ocassion`
    const res = await coll.updateMany(
      { ocassion: { $exists: true } },
      [
        { $set: { occasion: '$ocassion' } },
        { $unset: 'ocassion' },
      ]
    );

    console.log(`Matched ${res.matchedCount}, modified ${res.modifiedCount}`);
    await mongoose.disconnect();
    console.log('Disconnected');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  }
}

run();
