import { Router, Request, Response } from 'express';
import { config } from '../config/env';

const router = Router();

// Csak development környezetben érhető el
if (config.nodeEnv === 'development') {
  router.get('/media-root', (req: Request, res: Response) => {
    res.json({ mediaRoot: config.mediaRoot });
  });

  router.get('/ai-status', (req: Request, res: Response) => {
    const fs = require('fs');
    res.json({
      enabled: config.aiEnabled,
      modelPath: config.aiModelPath,
      modelExists: fs.existsSync(config.aiModelPath),
      confidence: config.aiConfidence,
      frameWidth: config.aiFrameWidth,
      frameMode: config.aiFrameMode
    });
  });
}

export default router;
