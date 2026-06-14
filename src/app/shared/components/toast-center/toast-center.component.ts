import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ToastVM } from './toast.model';

/**
 * Centro de notificaciones: renderiza un único toast a la vez (el primero de la
 * cola que arma el shell) y, si hay más esperando, un indicador apilado "+N".
 * Es puramente presentacional: las acciones llegan como callbacks en el `ToastVM`.
 */
@Component({
  selector: 'app-toast-center',
  standalone: true,
  templateUrl: './toast-center.component.html',
  styleUrl: './toast-center.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastCenterComponent {
  /** Toast a mostrar (cabeza de la cola). `null` cuando no hay nada que mostrar. */
  readonly toast = input<ToastVM | null>(null);
  /** Cuántos toasts quedan esperando detrás del actual. */
  readonly pendingCount = input<number>(0);
}
