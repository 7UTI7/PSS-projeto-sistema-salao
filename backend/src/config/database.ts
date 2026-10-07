import mongoose from 'mongoose';
import { setServers } from 'node:dns';
import { env } from './env.js';
import { logger } from './logger.js';

export async function connectDatabase(): Promise<void> {
  if (env.MONGO_DNS_SERVERS) {
    setServers(env.MONGO_DNS_SERVERS.split(',').map((server) => server.trim()));
  }

  await mongoose.connect(env.MONGO_URI, {
    dbName: env.MONGO_DB_NAME,
    serverSelectionTimeoutMS: 10_000,
  });
  logger.info({ database: env.MONGO_DB_NAME }, 'Conexão com MongoDB estabelecida');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}