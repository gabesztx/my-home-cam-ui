export interface VideoItem {
  file: string;
  time: string; // HH:MM:SS
  relativePath: string;
  label?: {
    topLabel: 'EMBER' | 'ÁLLAT' | 'KOCSI' | 'ISMERETLEN';
    confidence: number;
  };
}
