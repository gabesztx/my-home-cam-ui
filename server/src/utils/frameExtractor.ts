import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { mediaScannerService } from './mediaScanner.service';

export async function extractFrameToTempJpg(
  relativePath: string,
  width: number = 640,
  mode: 'middle' | 'start' = 'middle'
): Promise<string> {
  const fullPath = mediaScannerService.getSafePath(relativePath);
  const tempDir = path.resolve(__dirname, '../../../server/.cache/tmp');
  
  if (!existsSync(tempDir)) {
    await fs.mkdir(tempDir, { recursive: true });
  }

  const tempFileName = `ai-frame-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
  const outputPath = path.join(tempDir, tempFileName);

  const timestamp = mode === 'middle' ? '00:00:02' : '00:00:01';

  return new Promise((resolve, reject) => {
    const args = [
      '-ss', timestamp,
      '-i', fullPath,
      '-frames:v', '1',
      '-vf', `scale=${width}:-1`,
      '-y',
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', args);

    let errorOutput = '';
    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`ffmpeg failed with code ${code}: ${errorOutput}`));
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
