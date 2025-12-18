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
  analyzing = signal<Record<string, boolean>>({});
  aiErrors = signal<Record<string, string>>({});

  selectedCamera = signal<string | null>(null);
  selectedDate = signal<string | null>(null);
  selectedVideo = signal<VideoItem | null>(null);

  loading = signal(false);
  error = signal<string | null>(null);
  aiStatus = signal<{ enabled: boolean; modelExists: boolean; modelPath: string } | null>(null);

  thumbnailStates = signal<Record<string, 'loading' | 'loaded' | 'error'>>({});

  videoUrl = computed(() => {
    const video = this.selectedVideo();
    return video ? this.mediaApi.buildStreamUrl(video.relativePath) : null;
  });

  constructor() {
    this.loadCameras();
    this.loadAiStatus();
  }

  loadAiStatus() {
    this.mediaApi.getAiStatus().subscribe(status => this.aiStatus.set(status));
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
        videos.forEach(v => {
          initialStates[v.relativePath] = 'loading';
          if (!v.label) {
            this.triggerAnalysis(v.relativePath);
          }
        });
        this.thumbnailStates.set(initialStates);
        this.videos.set(videos);
      });
  }

  triggerAnalysis(relativePath: string) {
    if (this.analyzing()[relativePath]) return;

    this.aiErrors.update(state => {
      const newState = { ...state };
      delete newState[relativePath];
      return newState;
    });

    this.analyzing.update(state => ({ ...state, [relativePath]: true }));

    this.mediaApi.triggerLabel(relativePath).subscribe({
      next: (res) => {
        if ('topLabel' in res) {
          this.updateVideoLabel(relativePath, res.topLabel, res.confidence);
          this.analyzing.update(state => ({ ...state, [relativePath]: false }));
        } else {
          // Poll for result after 3 seconds
          setTimeout(() => this.pollLabel(relativePath), 3000);
        }
      },
      error: (err) => {
        console.error('AI Analysis failed to start:', err);
        let errorMsg = 'AI Error';
        if (err.status === 500 && err.error?.error === 'AI_MODEL_ERROR') {
          errorMsg = 'Model missing';
        } else if (err.status === 503) {
          errorMsg = 'AI Off';
        }

        this.aiErrors.update(state => ({ ...state, [relativePath]: errorMsg }));
        this.analyzing.update(state => ({ ...state, [relativePath]: false }));
      }
    });
  }

  pollLabel(relativePath: string, retryCount = 0) {
    if (retryCount >= 10) { // Max 30 másodperc polling
      this.aiErrors.update(state => ({ ...state, [relativePath]: 'Timeout' }));
      this.analyzing.update(state => ({ ...state, [relativePath]: false }));
      return;
    }

    this.mediaApi.getLabel(relativePath).subscribe({
      next: (label) => {
        if (label.error) {
          this.aiErrors.update(state => ({ ...state, [relativePath]: label.error || 'AI Error' }));
          this.analyzing.update(state => ({ ...state, [relativePath]: false }));
        } else {
          this.updateVideoLabel(relativePath, label.topLabel, label.confidence);
          this.analyzing.update(state => ({ ...state, [relativePath]: false }));
        }
      },
      error: (err) => {
        // Ha 202 (Processing), akkor folytatjuk a pollingot
        if (err.status === 202) {
          setTimeout(() => this.pollLabel(relativePath, retryCount + 1), 3000);
        } else if (err.status === 404) {
          // Ha 404, az azt jelenti, hogy még nincs kész VAGY hiba történt a háttérben.
          // Megnézzük, hogy a háttérben még fut-e (ha tudjuk), de itt egyszerűbb
          // ha csak simán retry-olunk amíg el nem érjük a limitet, DE ha hiba van,
          // azt a triggerLabel error ága már kezelte (vagy fogja).

          // Mivel a triggerLabel indítja el, ha ott hiba van, az analyzing már false lesz.
          // De ha itt kapunk 404-et, az lehet átmeneti.
          setTimeout(() => this.pollLabel(relativePath, retryCount + 1), 3000);
        } else {
          // Minden más hiba (500, 503, stb.) esetén megállunk
          console.error('Polling error:', err);
          let errorMsg = 'AI Error';
          if (err.status === 500 && err.error?.error === 'AI_MODEL_ERROR') {
            errorMsg = 'Model error';
          }
          this.aiErrors.update(state => ({ ...state, [relativePath]: errorMsg }));
          this.analyzing.update(state => ({ ...state, [relativePath]: false }));
        }
      }
    });
  }

  updateVideoLabel(relativePath: string, topLabel: string, confidence: number) {
    this.videos.update(videos => videos.map(v =>
      v.relativePath === relativePath
        ? { ...v, label: { topLabel, confidence } }
        : v
    ));
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
