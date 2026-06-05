import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Fila de un amigo confirmado — US3. Permite eliminar la amistad.
 */
@Component({
  selector: 'app-friend-row',
  standalone: true,
  templateUrl: './friend-row.component.html',
  styleUrl: './friend-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FriendRowComponent {
  /** Username del amigo. */
  readonly friendUsername = input.required<string>();

  /** Emite el username a eliminar. */
  readonly remove = output<string>();

  onRemove(): void {
    this.remove.emit(this.friendUsername());
  }
}
