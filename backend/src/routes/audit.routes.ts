// Rotas da auditoria Booksy × InfinitePay (/api/audits); só admin.
import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller.js';
import { authMiddleware } from '../shared/middlewares/auth.middleware.js';
import { passwordPolicyMiddleware } from '../shared/middlewares/password-policy.middleware.js';
import { importRateLimiter } from '../shared/middlewares/rate-limiter.middleware.js';
import { rbacMiddleware } from '../shared/middlewares/rbac.middleware.js';
import { uploadAuditFiles, uploadErrorHandler } from '../shared/middlewares/upload.middleware.js';
import { asyncHandler } from '../shared/utils/async-handler.js';

const router = Router();
const controller = new AuditController();

router.use(authMiddleware, passwordPolicyMiddleware, rbacMiddleware('admin'));

// Estado recalculado de um mês: os dois totais, a diferença, o desfecho e os três saldos.
router.get('/', asyncHandler((request, response) => controller.show(request, response)));

// Os dois relatórios no mesmo envio: é o início do fluxo.
router.post(
  '/',
  importRateLimiter,
  uploadAuditFiles,
  uploadErrorHandler,
  asyncHandler((request, response) => controller.submit(request, response)),
);

// O Lançamento Manual que zera a diferença do mês.
router.post(
  '/:period/entries',
  asyncHandler((request, response) => controller.addEntry(request, response)),
);

export default router;
