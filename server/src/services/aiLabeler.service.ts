import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { config } from '../config/env';
import { extractFrameToTempJpg } from '../utils/frameExtractor';
import { mediaScannerService } from './mediaScanner.service';

export interface AiLabel {
  relativePath: string;
  labels: string[];
  topLabel: string;
  confidence: number;
  objects: { class: string; confidence: number; box: number[] }[];
  createdAt: string;
}

export class AiLabelerService {
  private session: ort.InferenceSession | null = null;
  private classes: string[] = [];
  private readonly cacheDir = path.resolve(__dirname, '../../../server/.cache/labels');
  private readonly locks = new Map<string, Promise<AiLabel>>();

  constructor() {
    this.loadClasses();
  }

  private async loadClasses() {
    try {
      const classesPath = path.join(__dirname, '../../assets/models/coco-classes.json');
      const data = await fs.readFile(classesPath, 'utf8');
      this.classes = JSON.parse(data);
    } catch (err) {
      console.error('Failed to load COCO classes:', err);
    }
  }

  async validateModel() {
    if (!config.aiEnabled) throw new Error('AI_DISABLED');
    if (!existsSync(config.aiModelPath)) {
      throw new Error(`Model file not found at ${config.aiModelPath}`);
    }
  }

  private async loadModel() {
    if (this.session) return this.session;
    if (!config.aiEnabled) throw new Error('AI_DISABLED');

    try {
      if (!existsSync(config.aiModelPath)) {
        throw new Error(`Model file not found at ${config.aiModelPath}`);
      }
      this.session = await ort.InferenceSession.create(config.aiModelPath);
      return this.session;
    } catch (err) {
      console.error('Failed to load ONNX model:', err);
      throw err;
    }
  }

  private getCachePath(relativePath: string): string {
    const hash = crypto.createHash('sha1').update(relativePath).digest('hex');
    return path.join(this.cacheDir, `${hash}.json`);
  }

  async getLabel(relativePath: string): Promise<AiLabel | null> {
    const cachePath = this.getCachePath(relativePath);
    if (existsSync(cachePath)) {
      const data = await fs.readFile(cachePath, 'utf8');
      return JSON.parse(data);
    }
    return null;
  }

  async labelVideo(relativePath: string): Promise<AiLabel> {
    if (!config.aiEnabled) throw new Error('AI_DISABLED');

    const cached = await this.getLabel(relativePath);
    if (cached) return cached;

    const lock = this.locks.get(relativePath);
    if (lock) return lock;

    const promise = this.processVideo(relativePath);
    this.locks.set(relativePath, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.locks.delete(relativePath);
    }
  }

  private async processVideo(relativePath: string): Promise<AiLabel> {
    const fullPath = mediaScannerService.getSafePath(relativePath);
    const tempFrame = await extractFrameToTempJpg(fullPath, config.aiFrameWidth, config.aiFrameMode as any);
    
    try {
      const session = await this.loadModel();
      
      // Image preprocessing
      const { data, info } = await sharp(tempFrame)
        .resize(640, 640, { fit: 'fill' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const float32Data = new Float32Array(3 * 640 * 640);
      for (let i = 0; i < 640 * 640; i++) {
        float32Data[i] = data[i * 3] / 255.0; // R
        float32Data[i + 640 * 640] = data[i * 3 + 1] / 255.0; // G
        float32Data[i + 2 * 640 * 640] = data[i * 3 + 2] / 255.0; // B
      }

      const inputTensor = new ort.Tensor('float32', float32Data, [1, 3, 640, 640]);
      const outputs = await session.run({ images: inputTensor });
      const output = outputs[Object.keys(outputs)[0]];

      // YOLO v8/v11 postprocessing (simplified)
      // output shape is usually [1, 84, 8400] or similar
      const detections = this.parseYoloOutput(output.data as Float32Array, output.dims as number[]);
      
      const objects = detections
        .filter(d => d.confidence >= config.aiConfidence)
        .map(d => ({
          class: this.classes[d.classId] || 'unknown',
          confidence: d.confidence,
          box: d.box
        }));

      const labels = this.mapObjectsToLabels(objects.map(o => o.class));
      const topLabel = labels.length > 0 ? labels[0] : 'ISMERETLEN';
      const maxConfidence = objects.length > 0 ? Math.max(...objects.map(o => o.confidence)) : 0;

      const result: AiLabel = {
        relativePath,
        labels,
        topLabel,
        confidence: maxConfidence,
        objects,
        createdAt: new Date().toISOString()
      };

      // Cache result
      if (!existsSync(this.cacheDir)) {
        await fs.mkdir(this.cacheDir, { recursive: true });
      }
      await fs.writeFile(this.getCachePath(relativePath), JSON.stringify(result, null, 2));

      return result;
    } finally {
      // Cleanup temp frame
      if (existsSync(tempFrame)) {
        await fs.unlink(tempFrame).catch(() => {});
      }
    }
  }

  private parseYoloOutput(data: Float32Array, dims: number[]) {
    // Basic YOLO post-processing
    // Assuming YOLOv8 output: [1, 4 + num_classes, 8400]
    const numClasses = dims[1] - 4;
    const numPredictions = dims[2];
    const detections: { classId: number; confidence: number; box: number[] }[] = [];

    for (let i = 0; i < numPredictions; i++) {
      let maxScore = 0;
      let classId = -1;

      for (let j = 0; j < numClasses; j++) {
        const score = data[(4 + j) * numPredictions + i];
        if (score > maxScore) {
          maxScore = score;
          classId = j;
        }
      }

      if (maxScore > 0.3) {
        const x = data[0 * numPredictions + i];
        const y = data[1 * numPredictions + i];
        const w = data[2 * numPredictions + i];
        const h = data[3 * numPredictions + i];
        detections.push({
          classId,
          confidence: maxScore,
          box: [x - w / 2, y - h / 2, w, h]
        });
      }
    }

    // Simple NMS could be added here, but for "pipeline" goal, this might be enough
    return detections;
  }

  private mapObjectsToLabels(objectClasses: string[]): string[] {
    const labelSet = new Set<string>();
    
    const personClasses = ['person'];
    const animalClasses = ['cat', 'dog', 'bird', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe'];
    const vehicleClasses = ['car', 'bus', 'truck', 'motorcycle', 'bicycle'];

    for (const cls of objectClasses) {
      if (personClasses.includes(cls)) labelSet.add('EMBER');
      else if (animalClasses.includes(cls)) labelSet.add('ÁLLAT');
      else if (vehicleClasses.includes(cls)) labelSet.add('JÁRMŰ');
    }

    return Array.from(labelSet);
  }

  isProcessing(relativePath: string): boolean {
    return this.locks.has(relativePath);
  }
}

export const aiLabelerService = new AiLabelerService();
