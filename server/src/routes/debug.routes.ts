import { Router, Request, Response } from 'express';
import { config } from '../config/env';

const router = Router();

// Csak development környezetben érhető el
if (config.nodeEnv === 'development') {
  router.get('/media-root', (req: Request, res: Response) => {
    res.json({ mediaRoot: config.mediaRoot });
  });
}

export default router;
