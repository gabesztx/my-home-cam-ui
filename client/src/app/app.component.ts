import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MediaBrowserComponent } from './components/media-browser/media-browser.component';

@Component({
  selector: 'app-root',
  imports: [MediaBrowserComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
}
