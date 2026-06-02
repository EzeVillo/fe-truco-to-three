import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Botón de navegación "volver" estandarizado: ícono de flecha dentro de un
 * botón circular tematizado. Reutilizable en cabeceras de página.
 *
 * Emite el evento `back` al hacer clic; cada página decide a dónde navegar.
 */
@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './back-button.component.html',
  styleUrl: './back-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackButtonComponent {
  /** Texto accesible del botón. Default: 'Volver'. */
  readonly label = input<string>('Volver');

  /** Se emite al activar el botón. */
  readonly back = output<void>();
}
