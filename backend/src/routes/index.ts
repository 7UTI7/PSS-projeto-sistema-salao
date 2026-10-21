// Agrupa e registra todas as rotas da API sob /api.
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import categoryRoutes from './category.routes.js';
import reportRoutes from './report.routes.js';
import transactionRoutes from './transaction.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);
router.use('/transactions', transactionRoutes);
router.use('/reports', reportRoutes);

export default router;