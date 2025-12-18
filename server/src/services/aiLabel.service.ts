import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import http from 'http';
import https from 'https';

import { config } from '../config/env';
import { mediaScannerService } from './mediaScanner.service';

export type AiTopLabel = 'EMBER' | 'ÁLLAT' | 'KOCSI' | 'ISMERETLEN';

export interface AiLabelCacheRecord {
  relativePath: string;
  topLabel: AiTopLabel;
  confidence: number;
  createdAt: string;
  source: 'ai-service';
}

type AiServiceResponse = {
  topLabel: AiTopLabel;
  confidence: number;
  raw?: Array<{ class: string; confidence: number }>;
};

const labelsCacheDir = path.resolve(__dirname, '../../../.cache/labels');
const tmpDir = path.resolve(__dirname, '../../../.cache/tmp');

const ensureDir = async (dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const sha1 = (value: string) => crypto.createHash('sha1').update(value).digest('hex');

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const formatFfmpegTimestamp = (seconds: number) => {
  const clamped = Math.max(0, seconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

const parseServiceUrl = (baseUrl: string) => {
  const u = new URL(baseUrl);
  const isHttps = u.protocol === 'https:';
  return {
    isHttps,
    hostname: u.hostname,
    port: u.port ? Number(u.port) : isHttps ? 443 : 80,
    basePath: u.pathname === '/' ? '' : u.pathname,
  };
};

const buildMultipartBody = (fieldName: string, filename: string, contentType: string, payload: Buffer) => {
  const boundary = `----my-home-cam-ui-${crypto.randomBytes(12).toString('hex')}`;

  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
    'utf8'
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');

  return {
    boundary,
    body: Buffer.concat([head, payload, tail]),
  };
};

const postMultipart = async (url: string, body: Buffer, boundary: string) => {
  const { isHttps, hostname, port, basePath } = parseServiceUrl(url);
  const client = isHttps ? https : http;

  return await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
    const req = client.request(
      {
        method: 'POST',
        hostname,
        port,
        path: `${basePath}/classify`,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
        timeout: 4000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') });
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('AI_SERVICE_TIMEOUT'));
    });
    req.write(body);
    req.end();
  });
};

const getVideoDurationSeconds = async (absoluteVideoPath: string) => {
  return await new Promise<number | null>((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      absoluteVideoPath,
    ]);

    let output = '';
    ffprobe.stdout.on('data', (d) => (output += d.toString()));
    ffprobe.on('error', () => resolve(null));
    ffprobe.on('close', (code) => {
      if (code !== 0) return resolve(null);
      const parsed = Number(output.trim());
      resolve(Number.isFinite(parsed) ? parsed : null);
    });
  });
};

const extractMiddleFrameJpeg = async (absoluteVideoPath: string) => {
  await ensureDir(tmpDir);

  const duration = await getVideoDurationSeconds(absoluteVideoPath);
  const middleSeconds = duration && duration > 0 ? duration / 2 : 2;
  const ts = formatFfmpegTimestamp(middleSeconds);

  const outPath = path.join(tmpDir, `${sha1(`${absoluteVideoPath}:${Date.now()}`)}.jpg`);

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-ss',
      ts,
      '-i',
      absoluteVideoPath,
      '-frames:v',
      '1',
      '-vf',
      'scale=640:-1',
      '-q:v',
      '3',
      outPath,
    ]);

    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`FFMPEG_FAILED_${code}`));
      }
      resolve();
    });
  });

  return outPath;
};

class AiDisabledError extends Error {
  code = 'AI_DISABLED';
}

class AiServiceUnavailableError extends Error {
  code = 'AI_SERVICE_UNAVAILABLE';
}

export class AiLabelService {
  private inflight = new Map<string, Promise<AiLabelCacheRecord>>();

  computeCacheKey(relativePath: string) {
    return `${sha1(relativePath)}.json`;
  }

  private getCacheFilePath(relativePath: string) {
    return path.join(labelsCacheDir, this.computeCacheKey(relativePath));
  }

  async getCachedLabel(relativePath: string): Promise<AiLabelCacheRecord | null> {
    const filePath = this.getCacheFilePath(relativePath);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content) as AiLabelCacheRecord;
    } catch {
      return null;
    }
  }

  async requestLabel(relativePath: string): Promise<AiLabelCacheRecord> {
    if (!config.aiEnabled) {
      throw new AiDisabledError('AI_DISABLED');
    }

    const cached = await this.getCachedLabel(relativePath);
    if (cached) return cached;

    const key = this.computeCacheKey(relativePath);
    const existing = this.inflight.get(key);
    if (existing) return existing;

    const promise = this.requestLabelInternal(relativePath).finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise);
    return promise;
  }

  private async requestLabelInternal(relativePath: string): Promise<AiLabelCacheRecord> {
    await ensureDir(labelsCacheDir);

    const safeAbsoluteVideoPath = mediaScannerService.getSafePath(relativePath);
    const tmpJpegPath = await extractMiddleFrameJpeg(safeAbsoluteVideoPath);

    try {
      const jpegBuffer = await fs.readFile(tmpJpegPath);
      const { boundary, body } = buildMultipartBody('file', 'frame.jpg', 'image/jpeg', jpegBuffer);

      let response;
      try {
        response = await postMultipart(config.aiServiceUrl, body, boundary);
      } catch (e) {
        throw new AiServiceUnavailableError((e as Error).message);
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new AiServiceUnavailableError(`AI_SERVICE_HTTP_${response.statusCode}`);
      }

      let parsed: AiServiceResponse;
      try {
        parsed = JSON.parse(response.body) as AiServiceResponse;
      } catch {
        throw new AiServiceUnavailableError('AI_SERVICE_INVALID_JSON');
      }

      const record: AiLabelCacheRecord = {
        relativePath,
        topLabel: parsed.topLabel || 'ISMERETLEN',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        createdAt: new Date().toISOString(),
        source: 'ai-service',
      };

      await fs.writeFile(this.getCacheFilePath(relativePath), JSON.stringify(record, null, 2), 'utf8');
      return record;
    } finally {
      await fs.rm(tmpJpegPath, { force: true });
    }
  }

  async requestLabelQuick(relativePath: string, maxWaitMs: number) {
    return await withTimeout(this.requestLabel(relativePath), maxWaitMs);
  }

  isAiDisabledError(err: unknown) {
    return err instanceof AiDisabledError || (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'AI_DISABLED');
  }

  isAiServiceUnavailableError(err: unknown) {
    return (
      err instanceof AiServiceUnavailableError ||
      (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'AI_SERVICE_UNAVAILABLE')
    );
  }
}

export const aiLabelService = new AiLabelService();
