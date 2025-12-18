import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { config } from '../config/env';
import { mediaScannerService } from './mediaScanner.service';

export class ThumbnailService {
  private readonly cacheDir = path.resolve(__dirname, '../../../.cache/thumbnails');
  private readonly ffmpegPath = 'ffmpeg';
  private readonly locks = new Map<string, Promise<string>>();

  constructor() {
    this.ensureCacheDir();
  }

  private async ensureCacheDir() {
    try {
      if (!existsSync(this.cacheDir)) {
        await fs.mkdir(this.cacheDir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to create thumbnail cache directory:', err);
    }
  }

  async getThumbnail(
    relativePath: string,
    width: number,
    mode: 'middle' | 'start' = 'middle'
  ): Promise<{ filePath: string; contentType: string }> {
    // Input validation
    if (width < 120 || width > 640) {
      throw new Error('Invalid width. Must be between 120 and 640.');
    }

    if (!relativePath.endsWith('.mp4')) {
      throw new Error('Only .mp4 files are supported for thumbnails.');
    }

    // Path traversal protection
    const fullPath = mediaScannerService.getSafePath(relativePath);

    // Generate cache key
    const cacheKey = this.generateCacheKey(relativePath, width, mode);
    const cachedFilePath = path.join(this.cacheDir, `${cacheKey}.jpg`);

    // Check if exists in cache
    if (existsSync(cachedFilePath)) {
      return { filePath: cachedFilePath, contentType: 'image/jpeg' };
    }

    // Single-flight lock
    let lock = this.locks.get(cacheKey);
    if (lock) {
      const filePath = await lock;
      return { filePath, contentType: 'image/jpeg' };
    }

    // Generate thumbnail
    lock = this.generateThumbnail(fullPath, cachedFilePath, width, mode, cacheKey);
    this.locks.set(cacheKey, lock);

    try {
      const filePath = await lock;
      return { filePath, contentType: 'image/jpeg' };
    } finally {
      this.locks.delete(cacheKey);
    }
  }

  private generateCacheKey(relativePath: string, width: number, mode: string): string {
    return crypto
      .createHash('sha1')
      .update(`${relativePath}|${width}|${mode}`)
      .digest('hex');
  }

  private async generateThumbnail(
    inputPath: string,
    outputPath: string,
    width: number,
    mode: 'middle' | 'start',
    cacheKey: string
  ): Promise<string> {
    const timestamp = mode === 'middle' ? '00:00:02' : '00:00:01'; // Simplified middle as requested or 2s

    return new Promise((resolve, reject) => {
      // ffmpeg -ss [timestamp] -i [input] -frames:v 1 -vf scale=[width]:-1 [output]
      const args = [
        '-ss', timestamp,
        '-i', inputPath,
        '-frames:v', '1',
        '-vf', `scale=${width}:-1`,
        '-y', // Overwrite
        outputPath
      ];

      const ffmpeg = spawn(this.ffmpegPath, args);

      let errorOutput = '';
      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          console.error(`ffmpeg failed with code ${code}: ${errorOutput}`);
          reject(new Error(`Thumbnail generation failed: ${errorOutput}`));
        }
      });

      ffmpeg.on('error', (err: any) => {
        if (err.code === 'ENOENT') {
          reject(new Error('ffmpeg not available'));
        } else {
          reject(err);
        }
      });
    });
  }

  async isFfmpegAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const ffmpeg = spawn(this.ffmpegPath, ['-version']);
      ffmpeg.on('error', () => resolve(false));
      ffmpeg.on('close', (code) => resolve(code === 0));
    });
  }
}

export const thumbnailService = new ThumbnailService();
