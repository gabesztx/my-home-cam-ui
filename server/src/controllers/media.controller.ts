import { Request, Response, NextFunction } from 'express';
import { mediaScannerService } from '../services/mediaScanner.service';
import { thumbnailService } from '../services/thumbnail.service';
import { aiLabelService } from '../services/aiLabel.service';
import { config } from '../config/env';
import fs from 'fs';
import path from 'path';

export class MediaController {
  async getCameras(req: Request, res: Response, next: NextFunction) {
    try {
      const cameras = await mediaScannerService.listCameras();
      res.json(cameras);
    } catch (error) {
      next(error);
    }
  }

  async getDates(req: Request, res: Response, next: NextFunction) {
    try {
      const { cameraId } = req.params;
      const dates = await mediaScannerService.listDates(cameraId);
      res.json(dates);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid')) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  async getVideos(req: Request, res: Response, next: NextFunction) {
    try {
      const { cameraId, date } = req.params;
      const videos = await mediaScannerService.listVideos(cameraId, date);

      const videosWithLabels = await Promise.all(
        videos.map(async (video) => {
          const cached = await aiLabelService.getCachedLabel(video.relativePath);
          if (!cached) return video;

          return {
            ...video,
            label: {
              topLabel: cached.topLabel,
              confidence: cached.confidence,
            },
          };
        })
      );

      res.json(videosWithLabels);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid')) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  async getVideoLabel(req: Request, res: Response, next: NextFunction) {
    try {
      const relativePath = req.query.path as string;
      if (!relativePath) {
        return res.status(400).json({ error: 'Path query param is required' });
      }

      if (!config.aiEnabled) {
        return res.status(503).json({ error: 'AI_DISABLED' });
      }

      const cached = await aiLabelService.getCachedLabel(relativePath);
      if (!cached) {
        return res.status(404).json({ error: 'NOT_LABELED' });
      }

      res.json(cached);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Path traversal')) {
        return res.status(403).json({ error: error.message });
      }
      next(error);
    }
  }

  async triggerVideoLabel(req: Request, res: Response, next: NextFunction) {
    try {
      const relativePath = req.query.path as string;
      if (!relativePath) {
        return res.status(400).json({ error: 'Path query param is required' });
      }

      if (!config.aiEnabled) {
        return res.status(503).json({ error: 'AI_DISABLED' });
      }

      // If already cached, return immediately
      const cached = await aiLabelService.getCachedLabel(relativePath);
      if (cached) {
        return res.json(cached);
      }

      try {
        const record = await aiLabelService.requestLabelQuick(relativePath, 1500);
        return res.json(record);
      } catch (err) {
        if (aiLabelService.isAiDisabledError(err)) {
          return res.status(503).json({ error: 'AI_DISABLED' });
        }
        if (aiLabelService.isAiServiceUnavailableError(err)) {
          return res.status(502).json({ error: 'AI_SERVICE_UNAVAILABLE' });
        }
        if (err instanceof Error && err.message === 'TIMEOUT') {
          // fire-and-forget (still single-flight)
          aiLabelService.requestLabel(relativePath).catch((e) => {
            console.error('AI labeling failed:', e);
          });
          return res.status(202).json({ status: 'processing' });
        }
        throw err;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Path traversal')) {
        return res.status(403).json({ error: error.message });
      }
      next(error);
    }
  }

  async getThumbnail(req: Request, res: Response, next: NextFunction) {
    try {
      const relativePath = req.query.path as string;
      const width = parseInt(req.query.w as string, 10) || 240;
      const mode = (req.query.mode as 'middle' | 'start') || 'middle';

      if (!relativePath) {
        return res.status(400).json({ error: 'Path query param is required' });
      }

      if (!(await thumbnailService.isFfmpegAvailable())) {
        console.warn('ffmpeg not available, thumbnail generation skipped');
        return res.status(404).json({ error: 'ffmpeg not available' });
      }

      const { filePath, contentType } = await thumbnailService.getThumbnail(relativePath, width, mode);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Path traversal')) {
          return res.status(403).json({ error: error.message });
        }
        if (error.message.includes('Invalid') || error.message.includes('supported')) {
          return res.status(400).json({ error: error.message });
        }
        if (error.message.includes('Thumbnail generation failed')) {
          console.error('Thumbnail generation failed:', error);
          return res.status(404).json({ error: 'Thumbnail generation failed' });
        }
      }
      next(error);
    }
  }

  streamVideo(req: Request, res: Response, next: NextFunction) {
    try {
      const relativePath = req.query.path as string;
      if (!relativePath) {
        return res.status(400).json({ error: 'Path query param is required' });
      }

      if (!relativePath.endsWith('.mp4')) {
        return res.status(400).json({ error: 'Only .mp4 streaming is supported' });
      }

      const absolutePath = mediaScannerService.getSafePath(relativePath);

      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ error: 'Video not found' });
      }

      const stat = fs.statSync(absolutePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(absolutePath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(absolutePath).pipe(res);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Path traversal')) {
        return res.status(403).json({ error: error.message });
      }
      next(error);
    }
  }
}

export const mediaController = new MediaController();
