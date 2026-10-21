// Rotas de autenticação e gestão de usuários (/api/auth).
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../shared/middlewares/auth.middleware.js';
import {
  emailVerificationRateLimiter,
  loginRateLimiter,
  passwordResetActionRateLimiter,
  passwordResetRequestRateLimiter,
  registrationRateLimiter,
} from '../shared/middlewares/rate-limiter.middleware.js';
import { passwordPolicyMiddleware } from '../shared/middlewares/password-policy.middleware.js';
import { rbacMiddleware } from '../shared/middlewares/rbac.middleware.js';
import { asyncHandler } from '../shared/utils/async-handler.js';

const router = Router();
const controller = new AuthController();

router.post('/register', registrationRateLimiter, asyncHandler((request, response) => controller.register(request, response)));
router.post('/login', loginRateLimiter, asyncHandler((request, response) => controller.login(request, response)));
router.get('/verify-email', emailVerificationRateLimiter, asyncHandler((request, response) => controller.verifyEmail(request, response)));
router.post('/forgot-password', passwordResetRequestRateLimiter, asyncHandler((request, response) => controller.requestPasswordReset(request, response)));
router.get('/reset-password', passwordResetActionRateLimiter, asyncHandler((request, response) => controller.resetPasswordPage(request, response)));
router.post('/reset-password', passwordResetActionRateLimiter, asyncHandler((request, response) => controller.resetPassword(request, response)));
router.post('/change-password', authMiddleware, asyncHandler((request, response) => controller.changePassword(request, response)));
router.post(
  '/users',
  authMiddleware,
  passwordPolicyMiddleware,
  rbacMiddleware('admin'),
  asyncHandler((request, response) => controller.createUser(request, response)),
);
router.get(
  '/users',
  authMiddleware,
  passwordPolicyMiddleware,
  rbacMiddleware('admin'),
  asyncHandler((request, response) => controller.listUsers(request, response)),
);
router.delete(
  '/users/:id',
  authMiddleware,
  passwordPolicyMiddleware,
  rbacMiddleware('admin'),
  asyncHandler((request, response) => controller.deactivateUser(request, response)),
);

export default router;