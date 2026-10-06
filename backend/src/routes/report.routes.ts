import { Router } from 'express';
import { ReportController } from '../controllers/ReportController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { passwordPolicyMiddleware } from '../middlewares/passwordPolicyMiddleware.js';
import { rbacMiddleware } from '../middlewares/rbacMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const controller = new ReportController();

router.use(authMiddleware, passwordPolicyMiddleware, rbacMiddleware('admin'));
router.get('/dre', asyncHandler((request, response) => controller.dre(request, response)));
router.get('/cash-flow', asyncHandler((request, response) => controller.cashFlow(request, response)));

export default router;