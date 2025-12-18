import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaApiService } from '../../services/media-api.service';
import { VideoItem } from '../../models/media.model';
import { catchError, finalize, of } from 'rxjs';

@Component({
  selector: 'app-media-browser',
  imports: [CommonModule],
  templateUrl: './media-browser.component.html',
  styleUrl: './media-browser.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaBrowserComponent {
  private mediaApi = inject(MediaApiService);

  cameras = signal<string[]>([]);
  dates = signal<string[]>([]);
  videos = signal<VideoItem[]>([]);

  selectedCamera = signal<string | null>(null);
  selectedDate = signal<string | null>(null);
  selectedVideo = signal<VideoItem | null>(null);

  loading = signal(false);
  error = signal<string | null>(null);

  thumbnailStates = signal<Record<string, 'loading' | 'loaded' | 'error'>>({});

  videoUrl = computed(() => {
    const video = this.selectedVideo();
    return video ? this.mediaApi.buildStreamUrl(video.relativePath) : null;
  });

  constructor() {
    this.loadCameras();
  }

  loadCameras() {
    this.loading.set(true);
    this.error.set(null);
    this.mediaApi.getCameras()
      .pipe(
        catchError(err => {
          this.error.set('Hiba a kamerák betöltésekor');
          return of([]);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe(cameras => this.cameras.set(cameras));
  }

  onCameraChange(event: Event) {
    const cameraId = (event.target as HTMLSelectElement).value;
    this.selectedCamera.set(cameraId || null);
    this.selectedDate.set(null);
    this.selectedVideo.set(null);
    this.dates.set([]);
    this.videos.set([]);
    this.thumbnailStates.set({});

    if (cameraId) {
      this.loadDates(cameraId);
    }
  }

  loadDates(cameraId: string) {
    this.loading.set(true);
    this.error.set(null);
    this.mediaApi.getDates(cameraId)
      .pipe(
        catchError(err => {
          this.error.set('Hiba a dátumok betöltésekor');
          return of([]);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe(dates => this.dates.set(dates));
  }

  onDateChange(event: Event) {
    const date = (event.target as HTMLSelectElement).value;
    this.selectedDate.set(date || null);
    this.selectedVideo.set(null);
    this.videos.set([]);
    this.thumbnailStates.set({});

    if (this.selectedCamera() && date) {
      this.loadVideos(this.selectedCamera()!, date);
    }
  }

  loadVideos(cameraId: string, date: string) {
    this.loading.set(true);
    this.error.set(null);
    this.mediaApi.getVideos(cameraId, date)
      .pipe(
        catchError(err => {
          this.error.set('Hiba a videók betöltésekor');
          return of([]);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe(videos => {
        const initialStates: Record<string, 'loading' | 'loaded' | 'error'> = {};
        videos.forEach(v => initialStates[v.relativePath] = 'loading');
        this.thumbnailStates.set(initialStates);
        this.videos.set(videos);
      });
  }

  selectVideo(video: VideoItem) {
    this.selectedVideo.set(video);
  }

  getThumbnailUrl(relativePath: string): string {
    return this.mediaApi.buildThumbnailUrl(relativePath);
  }

  onThumbnailLoad(relativePath: string) {
    this.thumbnailStates.update(states => ({
      ...states,
      [relativePath]: 'loaded'
    }));
  }

  onThumbnailError(relativePath: string) {
    this.thumbnailStates.update(states => ({
      ...states,
      [relativePath]: 'error'
    }));
  }
}
