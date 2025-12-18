export interface VideoItem {
  file: string;
  time: string;
  relativePath: string;
  label?: {
    topLabel: 'EMBER' | 'ÁLLAT' | 'KOCSI' | 'ISMERETLEN';
    confidence: number;
  };
}
