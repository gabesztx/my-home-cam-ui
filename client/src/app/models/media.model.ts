export interface VideoItem {
  file: string;
  time: string;
  relativePath: string;
  label?: {
    topLabel: string;
    confidence: number;
  };
}
