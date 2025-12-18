import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { VideoItem } from '../models/media.model';

@Injectable({
  providedIn: 'root'
})
export class MediaApiService {
  private http = inject(HttpClient);
  private apiUrl = '/api';

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
}
