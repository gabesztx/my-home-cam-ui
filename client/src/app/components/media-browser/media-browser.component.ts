import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiLabelCacheRecord, MediaApiService } from '../../services/media-api.service';
import { VideoItem } from '../../models/media.model';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, of } from 'rxjs';

type LabelState = 'unknown' | 'ready' | 'analyzing' | 'ai-off' | 'error';

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

  labelStates = signal<Record<string, LabelState>>({});
  labelRecords = signal<Record<string, AiLabelCacheRecord>>({});
  labelTriggered = signal<Record<string, boolean>>({});
  labelAutoRefreshCount = signal(0);

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

        const initialLabelStates: Record<string, LabelState> = {};
        const initialLabelRecords: Record<string, AiLabelCacheRecord> = {};
        videos.forEach(v => {
          if (v.label) {
            initialLabelStates[v.relativePath] = 'ready';
            initialLabelRecords[v.relativePath] = {
              relativePath: v.relativePath,
              topLabel: v.label.topLabel,
              confidence: v.label.confidence,
              createdAt: '',
              source: 'ai-service',
            };
          } else {
            initialLabelStates[v.relativePath] = 'unknown';
          }
        });
        this.labelStates.set(initialLabelStates);
        this.labelRecords.set(initialLabelRecords);
        this.labelTriggered.set({});
        this.labelAutoRefreshCount.set(0);

        this.refreshLabels(true);

        // Opcionális: 1 automatikus refresh később (max 1x)
        setTimeout(() => {
          if (sayCount(this.labelAutoRefreshCount(), 1)) {
            this.refreshLabels(false);
          }
        }, 2500);
      });
  }

  refreshLabels(allowTrigger: boolean) {
    const videos = this.videos();
    if (videos.length === 0) return;

    videos.forEach((video) => {
      const rel = video.relativePath;

      this.mediaApi.getLabel(rel).subscribe({
        next: (record) => {
          this.labelRecords.update((records) => ({ ...records, [rel]: record }));
          this.labelStates.update((states) => ({ ...states, [rel]: 'ready' }));
        },
        error: (err: unknown) => {
          const httpErr = err as HttpErrorResponse;

          if (httpErr?.status === 503) {
            this.labelStates.update((states) => {
              const updated: Record<string, LabelState> = { ...states };
              videos.forEach((v) => (updated[v.relativePath] = 'ai-off'));
              return updated;
            });
            return;
          }

          if (httpErr?.status === 404) {
            this.labelStates.update((states) => ({ ...states, [rel]: 'analyzing' }));

            if (allowTrigger && !this.labelTriggered()[rel]) {
              this.labelTriggered.update((t) => ({ ...t, [rel]: true }));
              this.mediaApi.triggerLabel(rel).subscribe({
                error: () => {
                  // ne zavarjuk a listát, majd a következő refresh/GET megmondja
                },
              });
            }

            return;
          }

          this.labelStates.update((states) => ({ ...states, [rel]: 'error' }));
        },
      });
    });
  }

  getLabelState(relativePath: string): LabelState {
    return this.labelStates()[relativePath] || 'unknown';
  }

  getLabelText(video: VideoItem): string {
    const rel = video.relativePath;
    const state = this.getLabelState(rel);

    if (state === 'ai-off') return 'AI off';
    if (state === 'analyzing') return 'Analyzing…';
    if (state === 'error') return 'Label error';

    const cached = this.labelRecords()[rel];
    if (cached) return cached.topLabel;

    if (video.label) return video.label.topLabel;

    return '';
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

const sayCount = (current: number, max: number) => {
  return current < max;
};
