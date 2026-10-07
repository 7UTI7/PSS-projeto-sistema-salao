import { rateLimit } from 'express-rate-limit';

function createAuthRateLimiter(limit: number, windowMs = 15 * 60 * 1000) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { status: 'error', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  });
}

// Buckets separados evitam que consultas de e-mail consumam tentativas de login.
export const registrationRateLimiter = createAuthRateLimiter(5, 60 * 60 * 1000);
export const loginRateLimiter = createAuthRateLimiter(10);
export const emailVerificationRateLimiter = createAuthRateLimiter(10);
export const passwordResetRequestRateLimiter = createAuthRateLimiter(5);
export const passwordResetActionRateLimiter = createAuthRateLimiter(10);

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { status: 'error', message: 'Limite de requisições excedido.' },
});