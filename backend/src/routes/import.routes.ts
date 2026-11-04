// Rotas de importação de relatórios Booksy/InfinitePay (/api/imports); só admin.
import { Router } from 'express';
import { ImportController } from '../controllers/import.controller.js';
import { authMiddleware } from '../shared/middlewares/auth.middleware.js';
import { passwordPolicyMiddleware } from '../shared/middlewares/password-policy.middleware.js';
import { importRateLimiter } from '../shared/middlewares/rate-limiter.middleware.js';
import { rbacMiddleware } from '../shared/middlewares/rbac.middleware.js';
import { uploadErrorHandler, uploadReportFile } from '../shared/middlewares/upload.middleware.js';
import { asyncHandler } from '../shared/utils/async-handler.js';

const router = Router();
const controller = new ImportController();

router.use(authMiddleware, passwordPolicyMiddleware, rbacMiddleware('admin'));

router.get('/', asyncHandler((request, response) => controller.list(request, response)));

// Simula a importação e devolve o resumo; nada é gravado.
router.post(
  '/preview',
  importRateLimiter,
  uploadReportFile,
  uploadErrorHandler,
  asyncHandler((request, response) => controller.preview(request, response)),
);

router.post(
  '/',
  importRateLimiter,
  uploadReportFile,
  uploadErrorHandler,
  asyncHandler((request, response) => controller.process(request, response)),
);

// Desfaz o lote inteiro: os lançamentos criados por ele voltam para a lixeira.
router.delete('/:id', asyncHandler((request, response) => controller.rollback(request, response)));

export default router;
