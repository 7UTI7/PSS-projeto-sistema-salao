import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

export async function connectDatabase(): Promise<void> {
  if (env.MONGO_DNS_SERVERS) {
    dns.setServers(env.MONGO_DNS_SERVERS.split(',').map((server) => server.trim()).filter(Boolean));
  }
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  logger.info('Conexão com MongoDB estabelecida');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}