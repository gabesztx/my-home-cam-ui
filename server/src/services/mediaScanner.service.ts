import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env';
import { VideoItem } from '../dto/media.dto';

export class MediaScannerService {
  private readonly mediaRoot = config.mediaRoot;

  async listCameras(): Promise<string[]> {
    const entries = await fs.readdir(this.mediaRoot, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b));
  }

  async listDates(cameraId: string): Promise<string[]> {
    this.validateId(cameraId);
    const cameraPath = this.getSafePath(cameraId);
    
    const entries = await fs.readdir(cameraPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory() && /^[0-9]{8}$/.test(entry.name))
      .map(entry => entry.name)
      .sort((a, b) => b.localeCompare(a)); // Csökkenő
  }

  async listVideos(cameraId: string, date: string): Promise<VideoItem[]> {
    this.validateId(cameraId);
    this.validateDate(date);
    const datePath = this.getSafePath(cameraId, date);

    const entries = await fs.readdir(datePath, { withFileTypes: true });
    const videos: VideoItem[] = entries
      .filter(entry => entry.isFile() && (entry.name.endsWith('.mp4') || entry.name.endsWith('.mkv')))
      .map(entry => {
        const time = this.formatTimeFromFilename(entry.name);
        return {
          file: entry.name,
          time,
          relativePath: path.join(cameraId, date, entry.name)
        };
      })
      .sort((a, b) => a.file.localeCompare(b.file));

    return videos;
  }

  getSafePath(...parts: string[]): string {
    const absolutePath = path.resolve(this.mediaRoot, ...parts);
    if (!absolutePath.startsWith(this.mediaRoot)) {
      throw new Error('Path traversal detected');
    }
    return absolutePath;
  }

  validateId(id: string): void {
    if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
      throw new Error('Invalid ID format');
    }
  }

  validateDate(date: string): void {
    if (!/^[0-9]{8}$/.test(date)) {
      throw new Error('Invalid date format');
    }
  }

  private formatTimeFromFilename(filename: string): string {
    // 075659.mp4 -> 07:56:59
    const match = filename.match(/^(\d{2})(\d{2})(\d{2})/);
    if (match) {
      return `${match[1]}:${match[2]}:${match[3]}`;
    }
    return '00:00:00';
  }
}

export const mediaScannerService = new MediaScannerService();
