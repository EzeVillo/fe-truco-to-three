import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Fila de una solicitud de amistad recibida (pendiente) — US2.
 * Permite aceptar (crea amistad) o rechazar (descarta).
 */
@Component({
  selector: 'app-incoming-request-row',
  standalone: true,
  templateUrl: './incoming-request-row.component.html',
  styleUrl: './incoming-request-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomingRequestRowComponent {
  /** Username de quien envió la solicitud. */
  readonly requesterUsername = input.required<string>();

  /** Emite el username a aceptar. */
  readonly accept = output<string>();

  /** Emite el username a rechazar. */
  readonly decline = output<string>();

  onAccept(): void {
    this.accept.emit(this.requesterUsername());
  }

  onDecline(): void {
    this.decline.emit(this.requesterUsername());
  }
}
