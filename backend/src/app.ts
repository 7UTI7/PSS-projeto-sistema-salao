import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { apiRateLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';
import routes from './routes/index.js';
import { AppError } from './utils/AppError.js';

export const app = express();

app.disable('x-powered-by');
// Atrás do Nginx (produção) o IP real vem de X-Forwarded-For; fora disso o cabeçalho seria forjável.
const trustedProxyHops = env.TRUST_PROXY ?? (env.NODE_ENV === 'production' ? 1 : 0);
if (trustedProxyHops > 0) app.set('trust proxy', trustedProxyHops);
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((origin) => origin.trim()) }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1kb' }));
app.use(pinoHttp({
  logger,
  serializers: {
    req: (request) => ({ id: request.id, method: request.method, url: (request.url ?? '').split('?')[0] }),
    res: (response) => ({ statusCode: response.statusCode }),
  },
}));
app.use(apiRateLimiter);

app.get('/health', (_request, response) => response.json({ status: 'ok' }));
app.use('/api', routes);
app.use((_request, _response, next) => next(new AppError('Rota não encontrada.', 404, 'NOT_FOUND')));
app.use(errorHandler);