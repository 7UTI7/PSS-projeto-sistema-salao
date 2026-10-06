import { Router } from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { authRateLimiter } from '../middlewares/rateLimiter.js';
import { passwordPolicyMiddleware } from '../middlewares/passwordPolicyMiddleware.js';
import { rbacMiddleware } from '../middlewares/rbacMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const controller = new AuthController();

router.post('/register', authRateLimiter, asyncHandler((request, response) => controller.register(request, response)));
router.post('/login', authRateLimiter, asyncHandler((request, response) => controller.login(request, response)));
router.get('/verify-email', authRateLimiter, asyncHandler((request, response) => controller.verifyEmail(request, response)));
router.post('/forgot-password', authRateLimiter, asyncHandler((request, response) => controller.requestPasswordReset(request, response)));
router.get('/reset-password', authRateLimiter, asyncHandler((request, response) => controller.resetPasswordPage(request, response)));
router.post('/reset-password', authRateLimiter, asyncHandler((request, response) => controller.resetPassword(request, response)));
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