import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder visual para el área de acciones disponibles del jugador.
 *
 * Este componente es el punto de extensión futuro para las acciones jugables
 * (truco, envido, mazo, etc.). En iteraciones posteriores se reemplazará
 * el contenido placeholder por botones funcionales conectados a las
 * acciones del backend (`availableActions` del contrato §4.14).
 */
@Component({
  selector: 'app-placeholder-available-actions-area',
  standalone: true,
  template: `
    <div class="placeholder-actions">
      <span class="placeholder-actions__label">Acciones disponibles</span>
    </div>
  `,
  styleUrl: './placeholder-available-actions-area.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceholderAvailableActionsAreaComponent {}
