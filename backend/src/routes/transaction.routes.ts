// Rotas CRUD de lançamentos financeiros (/api/transactions).
import { Router } from 'express';
import { TransactionController } from './transaction.controller.js';
import { authMiddleware } from '../../shared/middlewares/auth.middleware.js';
import { passwordPolicyMiddleware } from '../../shared/middlewares/password-policy.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

const router = Router();
const controller = new TransactionController();

router.use(authMiddleware, passwordPolicyMiddleware);
router.get('/', asyncHandler((request, response) => controller.list(request, response)));
router.post('/', asyncHandler((request, response) => controller.create(request, response)));
router.put('/:id', asyncHandler((request, response) => controller.update(request, response)));
router.delete('/:id', asyncHandler((request, response) => controller.remove(request, response)));

export default router;