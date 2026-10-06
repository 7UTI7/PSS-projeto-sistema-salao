import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  logger.info('Conexão com MongoDB estabelecida');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}