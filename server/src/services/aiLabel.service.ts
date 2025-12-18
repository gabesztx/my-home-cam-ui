import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/env';
import FormData from 'form-data';
import axios from 'axios';

const execAsync = promisify(exec);

interface LabelCache {
  relativePath: string;
  topLabel: string;
  confidence: number;
  createdAt: string;
  raw: {
    rawTop: string;
    rawConfidence: number;
  };
}

interface ClassificationResult {
  topLabel: string;
  confidence: number;
  rawTop: string;
  rawConfidence: number;
}

export class AiLabelService {
  private readonly cacheDir: string;
  private readonly tempDir: string;
  private readonly inFlightRequests: Map<string, Promise<LabelCache>>;

  constructor() {
    this.cacheDir = path.join(config.mediaRoot, '.ai-labels');
    this.tempDir = path.join(config.mediaRoot, '.ai-temp');
    this.inFlightRequests = new Map();
  }

  async init(): Promise<void> {
    // Create cache and temp directories if they don't exist
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  /**
   * Compute cache key (SHA1 hash of relative path + .json)
   */
  computeCacheKey(relativePath: string): string {
    const hash = crypto.createHash('sha1').update(relativePath).digest('hex');
    return `${hash}.json`;
  }

  /**
   * Get cached label for a video
   */
  async getCachedLabel(relativePath: string): Promise<LabelCache | null> {
    try {
      const cacheKey = this.computeCacheKey(relativePath);
      const cachePath = path.join(this.cacheDir, cacheKey);
      const data = await fs.readFile(cachePath, 'utf-8');
      return JSON.parse(data) as LabelCache;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save label to cache
   */
  private async saveCachedLabel(label: LabelCache): Promise<void> {
    const cacheKey = this.computeCacheKey(label.relativePath);
    const cachePath = path.join(this.cacheDir, cacheKey);
    await fs.writeFile(cachePath, JSON.stringify(label, null, 2), 'utf-8');
  }

  /**
   * Extract middle frame from video using ffmpeg
   */
  async extractFrame(relativePath: string): Promise<string> {
    const videoPath = path.join(config.mediaRoot, relativePath);
    
    // Check if video exists
    try {
      await fs.access(videoPath);
    } catch (error) {
      throw new Error(`Video not found: ${relativePath}`);
    }

    // Get video duration
    const durationCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
    const { stdout: durationStr } = await execAsync(durationCmd);
    const duration = parseFloat(durationStr.trim());

    if (isNaN(duration) || duration <= 0) {
      throw new Error('Invalid video duration');
    }

    // Calculate middle timestamp
    const middleTime = duration / 2;

    // Generate unique temp filename
    const tempFilename = `frame-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const framePath = path.join(this.tempDir, tempFilename);

    // Extract frame at middle time
    const extractCmd = `ffmpeg -ss ${middleTime} -i "${videoPath}" -vframes 1 -vf scale=640:-1 -q:v 2 "${framePath}"`;
    
    try {
      await execAsync(extractCmd);
      return framePath;
    } catch (error) {
      throw new Error(`Frame extraction failed: ${error}`);
    }
  }

  /**
   * Request label from AI service
   */
  async requestLabel(relativePath: string): Promise<LabelCache> {
    // Check if AI is enabled
    if (!config.aiEnabled) {
      throw new Error('AI service is disabled');
    }

    // Single-flight protection: check if request is already in progress
    const existingRequest = this.inFlightRequests.get(relativePath);
    if (existingRequest) {
      return existingRequest;
    }

    // Create new request promise
    const requestPromise = this.performLabelRequest(relativePath);
    this.inFlightRequests.set(relativePath, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up in-flight request
      this.inFlightRequests.delete(relativePath);
    }
  }

  /**
   * Perform the actual label request
   */
  private async performLabelRequest(relativePath: string): Promise<LabelCache> {
    let framePath: string | null = null;

    try {
      // Extract frame
      framePath = await this.extractFrame(relativePath);

      // Read frame file
      const frameBuffer = await fs.readFile(framePath);

      // Create form data
      const formData = new FormData();
      formData.append('file', frameBuffer, {
        filename: 'frame.jpg',
        contentType: 'image/jpeg',
      });

      // Send to AI service
      const response = await axios.post<ClassificationResult>(
        `${config.aiServiceUrl}/classify`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 30000, // 30 second timeout
        }
      );

      const result = response.data;

      // Create cache object
      const labelCache: LabelCache = {
        relativePath,
        topLabel: result.topLabel,
        confidence: result.confidence,
        createdAt: new Date().toISOString(),
        raw: {
          rawTop: result.rawTop,
          rawConfidence: result.rawConfidence,
        },
      };

      // Save to cache
      await this.saveCachedLabel(labelCache);

      return labelCache;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`AI service error: ${error.message}`);
      }
      throw error;
    } finally {
      // Clean up temp frame file
      if (framePath) {
        try {
          await fs.unlink(framePath);
        } catch (error) {
          // Ignore cleanup errors
          console.warn(`Failed to cleanup temp frame: ${framePath}`);
        }
      }
    }
  }

  /**
   * Check if ffmpeg is available
   */
  async isFfmpegAvailable(): Promise<boolean> {
    try {
      await execAsync('ffmpeg -version');
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const aiLabelService = new AiLabelService();
