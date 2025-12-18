import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, of } from 'rxjs';

interface HealthResponse {
  ok: boolean;
  ts: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  healthStatus = signal<HealthResponse | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  checkHealth() {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<HealthResponse>('/api/health')
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          console.error('Health check failed', err);
          this.error.set('Failed to fetch health status');
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((response) => {
        if (response) {
          this.healthStatus.set(response);
        }
      });
  }
}
