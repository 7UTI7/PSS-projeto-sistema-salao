import { startInstrumentation, stopInstrumentation } from './config/instrumentation.js';
import { logger } from './config/logger.js';

async function startServer(): Promise<void> {
  await startInstrumentation();
  const [{ connectDatabase, disconnectDatabase }, { env }, { app }] = await Promise.all([
    import('./config/database.js'),
    import('./config/env.js'),
    import('./app.js'),
  ]);
  await connectDatabase();

  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info({ host: env.HOST, port: env.PORT }, 'API disponível');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Encerrando API');
    server.close(async () => {
      await disconnectDatabase();
      await stopInstrumentation();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

startServer().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Falha ao iniciar API');
  process.exit(1);
});