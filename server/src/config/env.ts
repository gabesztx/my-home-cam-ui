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

const parseBool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;

  return fallback;
};

const parseNumber = (value: string | undefined, fallback: number) => {
  if (value === undefined) return fallback;

  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  nodeEnv,
  port: parseInt(process.env.PORT || '3000', 10),
  mediaRoot: resolvedMediaRoot,

  aiEnabled: parseBool(process.env.AI_ENABLED, false),
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001',
  aiConfidence: parseNumber(process.env.AI_CONFIDENCE, 0.55),
};
