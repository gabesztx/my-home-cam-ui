export interface VideoItem {
  file: string;
  time: string;
  relativePath: string;
  label?: {
    topLabel: string;
    confidence: number;
  };
}

export interface AiLabel {
  relativePath: string;
  labels: string[];
  topLabel: string;
  confidence: number;
  objects: { class: string; confidence: number; box: number[] }[];
  createdAt: string;
}
