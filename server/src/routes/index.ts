import { Router } from 'express';
import healthRoutes from './health.routes';
import debugRoutes from './debug.routes';
import mediaRoutes from './media.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/debug', debugRoutes);
router.use('/', mediaRoutes);

export default router;
