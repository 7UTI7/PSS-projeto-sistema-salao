// Rotas de relatórios DRE e Fluxo de Caixa (/api/reports); só admin.
import { Router } from 'express';
import { ReportController } from '../controllers/report.controller.js';
import { authMiddleware } from '../shared/middlewares/auth.middleware.js';
import { passwordPolicyMiddleware } from '../shared/middlewares/password-policy.middleware.js';
import { rbacMiddleware } from '../shared/middlewares/rbac.middleware.js';
import { asyncHandler } from '../shared/utils/async-handler.js';

const router = Router();
const controller = new ReportController();

router.use(authMiddleware, passwordPolicyMiddleware, rbacMiddleware('admin'));
router.get('/dre', asyncHandler((request, response) => controller.dre(request, response)));
router.get('/cash-flow', asyncHandler((request, response) => controller.cashFlow(request, response)));

export default router;