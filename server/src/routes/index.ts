import { Router } from 'express';
import healthRoutes from './health.routes';
import debugRoutes from './debug.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/debug', debugRoutes);

export default router;
