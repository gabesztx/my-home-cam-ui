import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { VideoItem } from '../models/media.model';
import { environment } from '../../environments/environment';

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

  getLabel(relativePath: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/videos/labels?path=${encodeURIComponent(relativePath)}`);
  }

  triggerLabel(relativePath: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/videos/labels?path=${encodeURIComponent(relativePath)}`, {});
  }

  getLabelBadgeClass(label: string): string {
    switch (label) {
      case 'EMBER':
        return 'badge-person';
      case 'ÁLLAT':
        return 'badge-animal';
      case 'KOCSI':
        return 'badge-car';
      case 'ISMERETLEN':
        return 'badge-unknown';
      default:
        return 'badge-unknown';
    }
  }

  getLabelText(label: string): string {
    return label || 'ISMERETLEN';
  }
}
