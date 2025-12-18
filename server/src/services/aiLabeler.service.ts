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
  error?: string;
}

export class AiLabelerService {
  private session: ort.InferenceSession | null = null;
  private classes: string[] = [];
  private readonly cacheDir = path.resolve(process.cwd(), '.cache/labels');
  private readonly locks = new Map<string, Promise<AiLabel>>();

  constructor() {
    this.loadClasses();
  }

  private async loadClasses() {
    try {
      const classesPath = path.join(__dirname, '../../assets/models/coco-classes.json');
      console.log(`Loading classes from: ${classesPath}`);
      const data = await fs.readFile(classesPath, 'utf8');
      this.classes = JSON.parse(data);
      console.log(`Loaded ${this.classes.length} classes`);
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
      console.log(`Loading ONNX model from: ${config.aiModelPath}`);
      this.session = await ort.InferenceSession.create(config.aiModelPath, {
        executionProviders: ['cpu'],
        logSeverityLevel: 3 // Only errors
      });
      console.log('ONNX model loaded successfully');
      return this.session;
    } catch (err) {
      console.error('Failed to load ONNX model:', err);
      this.session = null; // Ensure it stays null on failure
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
    // Ha van cache és nincs benne hiba, adjuk vissza.
    // Ha van benne hiba, engedjük újra próbálni (hátha javították a modellt).
    if (cached && !cached.error) return cached;

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
    let tempFrame: string | null = null;
    
    try {
      tempFrame = await extractFrameToTempJpg(fullPath, config.aiFrameWidth, config.aiFrameMode as any);
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

      console.log(`Video processed: ${relativePath}, found: ${labels.join(', ') || 'NOTHING'}`);

      // Cache result
      await this.saveToCache(relativePath, result);

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error processing video ${relativePath}:`, err);
      
      const errorResult: AiLabel = {
        relativePath,
        labels: [],
        topLabel: 'ERROR',
        confidence: 0,
        objects: [],
        createdAt: new Date().toISOString(),
        error: errorMsg
      };

      // Mentjük a hibát is a cache-be, hogy ne próbálkozzon újra végtelenül
      await this.saveToCache(relativePath, errorResult).catch(() => {});
      
      return errorResult;
    } finally {
      // Cleanup temp frame
      if (tempFrame && existsSync(tempFrame)) {
        await fs.unlink(tempFrame).catch(() => {});
      }
    }
  }

  private async saveToCache(relativePath: string, result: AiLabel) {
    if (!existsSync(this.cacheDir)) {
      await fs.mkdir(this.cacheDir, { recursive: true });
    }
    await fs.writeFile(this.getCachePath(relativePath), JSON.stringify(result, null, 2));
  }

  private parseYoloOutput(data: Float32Array, dims: number[]) {
    // Basic YOLO post-processing
    // YOLOv8/v11 output is typically [1, 4 + num_classes, 8400]
    // OR [1, 8400, 4 + num_classes] depending on the export format.
    // Based on the 'dims' let's try to detect the format.
    
    let numClasses: number;
    let numPredictions: number;
    let transposed = false;

    if (dims[1] > dims[2]) {
      // Format: [1, 8400, 4 + num_classes]
      numPredictions = dims[1];
      numClasses = dims[2] - 4;
      transposed = true;
    } else {
      // Format: [1, 4 + num_classes, 8400]
      numClasses = dims[1] - 4;
      numPredictions = dims[2];
    }

    const detections: { classId: number; confidence: number; box: number[] }[] = [];

    for (let i = 0; i < numPredictions; i++) {
      let maxScore = 0;
      let classId = -1;

      for (let j = 0; j < numClasses; j++) {
        const score = transposed 
          ? data[i * (numClasses + 4) + (4 + j)]
          : data[(4 + j) * numPredictions + i];
          
        if (score > maxScore) {
          maxScore = score;
          classId = j;
        }
      }

      if (maxScore > 0.25) { // YOLO default confidence
        const x = transposed ? data[i * (numClasses + 4) + 0] : data[0 * numPredictions + i];
        const y = transposed ? data[i * (numClasses + 4) + 1] : data[1 * numPredictions + i];
        const w = transposed ? data[i * (numClasses + 4) + 2] : data[2 * numPredictions + i];
        const h = transposed ? data[i * (numClasses + 4) + 3] : data[3 * numPredictions + i];
        
        detections.push({
          classId,
          confidence: maxScore,
          box: [x - w / 2, y - h / 2, w, h]
        });
      }
    }

    return detections;
  }

  private mapObjectsToLabels(objectClasses: string[]): string[] {
    const labelSet = new Set<string>();
    
    // Some models might have different class names or indices.
    // Ensure we match common variations.
    const personClasses = ['person', 'human'];
    const animalClasses = ['cat', 'dog', 'bird', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'animal'];
    const vehicleClasses = ['car', 'bus', 'truck', 'motorcycle', 'bicycle', 'van', 'vehicle'];

    for (const cls of objectClasses) {
      const lowerCls = cls.toLowerCase();
      if (personClasses.includes(lowerCls)) labelSet.add('EMBER');
      else if (animalClasses.includes(lowerCls)) labelSet.add('ÁLLAT');
      else if (vehicleClasses.includes(lowerCls)) labelSet.add('JÁRMŰ');
    }

    return Array.from(labelSet);
  }

  isProcessing(relativePath: string): boolean {
    return this.locks.has(relativePath);
  }
}

export const aiLabelerService = new AiLabelerService();
