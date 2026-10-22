import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule],
  template: `
    <router-outlet />
    <p-toast position="bottom-right" />
    <p-confirmDialog [style]="{ width: '26rem' }" />
  `,
})
export class AppComponent {
  // Instantiated here so the saved theme applies before the first page renders.
  private readonly theme = inject(ThemeService);
}
