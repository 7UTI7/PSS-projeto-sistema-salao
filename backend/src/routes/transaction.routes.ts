import { Router } from 'express';
import { TransactionController } from '../controllers/TransactionController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { passwordPolicyMiddleware } from '../middlewares/passwordPolicyMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const controller = new TransactionController();

router.use(authMiddleware, passwordPolicyMiddleware);
router.get('/', asyncHandler((request, response) => controller.list(request, response)));
router.post('/', asyncHandler((request, response) => controller.create(request, response)));
router.delete('/:id', asyncHandler((request, response) => controller.remove(request, response)));

export default router;