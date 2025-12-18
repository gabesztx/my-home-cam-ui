import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(process.cwd(), envFile);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const mediaRoot = process.env.MEDIA_ROOT;

if (!mediaRoot) {
  throw new Error('MEDIA_ROOT is not defined in the environment variables.');
}

const resolvedMediaRoot = path.resolve(mediaRoot);

if (!fs.existsSync(resolvedMediaRoot)) {
  throw new Error(`MEDIA_ROOT directory does not exist: ${resolvedMediaRoot}`);
}

export const config = {
  nodeEnv,
  port: parseInt(process.env.PORT || '3000', 10),
  mediaRoot: resolvedMediaRoot,
  aiEnabled: process.env.AI_ENABLED === 'true',
  aiModelPath: process.env.AI_MODEL_PATH || path.join(__dirname, '../../assets/models/yolo.onnx'),
  aiConfidence: parseFloat(process.env.AI_CONFIDENCE || '0.55'),
  aiFrameMode: process.env.AI_FRAME_MODE || 'middle',
  aiFrameWidth: parseInt(process.env.AI_FRAME_WIDTH || '640', 10),
};
