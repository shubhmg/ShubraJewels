import mongoose from 'mongoose';
import env from './env.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(env.mongodbUri);
    console.log('MongoDB connected (shubra)');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}
