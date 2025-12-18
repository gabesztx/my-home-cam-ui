import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { VideoItem } from '../models/media.model';
import { environment } from '../../environments/environment';

export type AiTopLabel = 'EMBER' | 'ÁLLAT' | 'KOCSI' | 'ISMERETLEN';

export interface AiLabelCacheRecord {
  relativePath: string;
  topLabel: AiTopLabel;
  confidence: number;
  createdAt: string;
  source: 'ai-service';
}

@Injectable({
  providedIn: 'root'
})
export class MediaApiService {
  private http = inject(HttpClient);
  private apiBaseUrl = environment.apiBaseUrl;
  private apiUrl = `${this.apiBaseUrl}/api`;

  getCameras(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/cameras`);
  }

  getDates(cameraId: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/cameras/${cameraId}/dates`);
  }

  getVideos(cameraId: string, date: string): Observable<VideoItem[]> {
    return this.http.get<VideoItem[]>(`${this.apiUrl}/cameras/${cameraId}/dates/${date}/videos`);
  }

  buildStreamUrl(relativePath: string): string {
    return `${this.apiUrl}/videos/stream?path=${encodeURIComponent(relativePath)}`;
  }

  buildThumbnailUrl(relativePath: string, width = 240, mode: 'middle' | 'start' = 'middle'): string {
    return `${this.apiUrl}/videos/thumbnail?path=${encodeURIComponent(relativePath)}&w=${width}&mode=${mode}`;
  }

  getLabel(relativePath: string): Observable<AiLabelCacheRecord> {
    return this.http.get<AiLabelCacheRecord>(`${this.apiUrl}/videos/labels?path=${encodeURIComponent(relativePath)}`);
  }

  triggerLabel(relativePath: string): Observable<AiLabelCacheRecord | { status: 'processing' }> {
    return this.http.post<AiLabelCacheRecord | { status: 'processing' }>(
      `${this.apiUrl}/videos/labels?path=${encodeURIComponent(relativePath)}`,
      {}
    );
  }
}
