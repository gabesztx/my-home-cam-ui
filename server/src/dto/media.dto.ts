export interface VideoItem {
  file: string;
  time: string; // HH:MM:SS
  relativePath: string;
  label?: {
    topLabel: string;
    confidence: number;
  };
}
