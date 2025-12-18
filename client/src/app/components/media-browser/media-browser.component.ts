import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaApiService } from '../../services/media-api.service';
import { VideoItem } from '../../models/media.model';
import { catchError, finalize, of, interval, takeWhile, switchMap } from 'rxjs';

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
  labelStates = signal<Record<string, 'analyzing' | 'done' | 'error'>>({});

  videoUrl = computed(() => {
    const video = this.selectedVideo();
    return video ? this.mediaApi.buildStreamUrl(video.relativePath) : null;
  });

  videosWithLabelInfo = computed(() => {
    return this.videos().map(video => ({
      ...video,
      labelBadgeClass: video.label ? this.mediaApi.getLabelBadgeClass(video.label.topLabel) : '',
      labelText: video.label ? this.mediaApi.getLabelText(video.label.topLabel) : ''
    }));
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

  triggerLabelIfNeeded(video: VideoItem) {
    // If label already exists, do nothing
    if (video.label) {
      this.labelStates.update(states => ({
        ...states,
        [video.relativePath]: 'done'
      }));
      return;
    }

    // If already analyzing or error, do nothing
    const currentState = this.labelStates()[video.relativePath];
    if (currentState === 'analyzing' || currentState === 'error') {
      return;
    }

    // Set analyzing state
    this.labelStates.update(states => ({
      ...states,
      [video.relativePath]: 'analyzing'
    }));

    // Trigger label request
    this.mediaApi.triggerLabel(video.relativePath)
      .pipe(
        catchError(err => {
          this.labelStates.update(states => ({
            ...states,
            [video.relativePath]: 'error'
          }));
          return of(null);
        }),
        switchMap(() => {
          // Start polling for the label (every 2 seconds, max 30 attempts = 1 minute)
          let attempts = 0;
          return interval(2000).pipe(
            switchMap(() => this.mediaApi.getLabel(video.relativePath)),
            takeWhile((result) => {
              attempts++;
              // Continue polling if no result and haven't exceeded max attempts
              return !result && attempts < 30;
            }, true), // inclusive: emit the last value that fails the predicate
            catchError(() => of(null))
          );
        })
      )
      .subscribe(labelResult => {
        if (labelResult) {
          // Label found, update the video in the list
          this.videos.update(videos =>
            videos.map(v =>
              v.relativePath === video.relativePath
                ? { ...v, label: { topLabel: labelResult.topLabel, confidence: labelResult.confidence } }
                : v
            )
          );
          this.labelStates.update(states => ({
            ...states,
            [video.relativePath]: 'done'
          }));
        } else {
          // Polling timed out or failed
          this.labelStates.update(states => ({
            ...states,
            [video.relativePath]: 'error'
          }));
        }
      });
  }

  refreshLabels() {
    const videos = this.videos();
    if (videos.length === 0) return;

    const cameraId = this.selectedCamera();
    const date = this.selectedDate();

    if (cameraId && date) {
      // Reload videos from server to get updated labels
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
          // Preserve existing thumbnail states to avoid re-loading thumbnails
          const currentStates = this.thumbnailStates();
          const updatedStates: Record<string, 'loading' | 'loaded' | 'error'> = {};

          videos.forEach(v => {
            // Keep existing state if available, otherwise set to loading
            updatedStates[v.relativePath] = currentStates[v.relativePath] || 'loading';
          });

          this.thumbnailStates.set(updatedStates);
          this.videos.set(videos);
        });
    }
  }
}
