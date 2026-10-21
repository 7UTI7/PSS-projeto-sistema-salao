// Rotas CRUD de categorias (/api/categories); escrita só para admin.
import { Router } from 'express';
import { CategoryController } from './category.controller.js';
import { authMiddleware } from '../../shared/middlewares/auth.middleware.js';
import { passwordPolicyMiddleware } from '../../shared/middlewares/password-policy.middleware.js';
import { rbacMiddleware } from '../../shared/middlewares/rbac.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

const router = Router();
const controller = new CategoryController();
const adminOnly = rbacMiddleware('admin');

router.use(authMiddleware, passwordPolicyMiddleware);
router.get('/', asyncHandler((request, response) => controller.list(request, response)));
router.get('/:id', adminOnly, asyncHandler((request, response) => controller.get(request, response)));
router.post('/', adminOnly, asyncHandler((request, response) => controller.create(request, response)));
router.put('/:id', adminOnly, asyncHandler((request, response) => controller.update(request, response)));
router.delete('/:id', adminOnly, asyncHandler((request, response) => controller.remove(request, response)));

export default router;
