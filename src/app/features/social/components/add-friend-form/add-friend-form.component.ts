import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Formulario para enviar una solicitud de amistad por username — US1.
 * Valida que el campo no esté vacío en el front; el resto (existe, duplicado,
 * self) lo valida el backend y se comunica vía el error de copy del store.
 */
@Component({
  selector: 'app-add-friend-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './add-friend-form.component.html',
  styleUrl: './add-friend-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddFriendFormComponent {
  /** Mensaje de error del último envío (copy del front), o null. */
  readonly errorMessage = input<string | null>(null);

  /** Emite el username a enviar (sin trim previo; el store lo normaliza). */
  readonly submitRequest = output<string>();

  readonly username = signal<string>('');

  onSubmit(): void {
    const value = this.username();
    if (!value.trim()) {
      return;
    }
    this.submitRequest.emit(value);
  }

  /** La página llama esto tras un envío exitoso para limpiar el input. */
  reset(): void {
    this.username.set('');
  }
}
