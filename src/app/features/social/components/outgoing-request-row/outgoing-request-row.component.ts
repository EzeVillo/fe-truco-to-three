import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Fila de una solicitud de amistad enviada (pendiente) — US1 (display) + US4 (cancelar).
 */
@Component({
  selector: 'app-outgoing-request-row',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './outgoing-request-row.component.html',
  styleUrl: './outgoing-request-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutgoingRequestRowComponent {
  /** Username del destinatario de la solicitud. */
  readonly addresseeUsername = input.required<string>();

  /** Emite el username a cancelar. */
  readonly cancel = output<string>();

  onCancel(): void {
    this.cancel.emit(this.addresseeUsername());
  }
}
