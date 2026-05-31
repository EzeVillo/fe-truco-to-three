import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  computed,
  inject,
  input,
  output,
  signal,
  type OnDestroy,
} from '@angular/core';
import { buildJoinUrl } from '../../utils/join-link';

/**
 * Sala de espera de una partida privada (estados previos a IN_PROGRESS).
 * Presentacional: recibe el estado derivado y emite las acciones (iniciar/salir).
 * El anfitrion ve el codigo compartible y puede copiarlo. Cuando ambos jugadores
 * estan presentes, cada uno confirma que esta listo antes de empezar. Feature 015.
 */
@Component({
  selector: 'app-waiting-room',
  standalone: true,
  imports: [],
  templateUrl: './waiting-room.component.html',
  styleUrl: './waiting-room.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaitingRoomComponent implements OnDestroy {
  /** El visor es el anfitrión (PLAYER_ONE). */
  readonly isHost = input<boolean>(false);
  /** Código compartible. Solo relevante para el anfitrión. */
  readonly joinCode = input<string | null>(null);
  /** Nombre del anfitrión. */
  readonly hostUsername = input<string>('');
  /** Nombre del rival; null mientras no se haya unido. */
  readonly rivalUsername = input<string | null>(null);
  /** Hay rival presente (habilita Iniciar para el anfitrión). */
  readonly rivalPresent = input<boolean>(false);
  /** El visor puede marcarse listo (hay rival presente y todavia no confirmo). */
  readonly canStart = input<boolean>(false);
  /** El visor ya confirmo que esta listo para jugar. */
  readonly selfReady = input<boolean>(false);
  /** El otro jugador ya confirmo que esta listo para jugar. */
  readonly opponentReady = input<boolean>(false);
  /** El anfitrion ya confirmo que esta listo para jugar. */
  readonly hostReady = input<boolean>(false);
  /** El rival ya confirmo que esta listo para jugar. */
  readonly rivalReady = input<boolean>(false);
  /** Etiqueta del formato de serie (ej. "Mejor de 3"). */
  readonly seriesLabel = input<string>('');
  /** Confirmacion de listo en curso. */
  readonly starting = input<boolean>(false);
  /** Acción de salida en curso. */
  readonly leaving = input<boolean>(false);

  readonly start = output<void>();
  readonly leave = output<void>();

  /** Feedback efímero tras copiar el código. */
  readonly copied = signal<boolean>(false);
  /** Feedback efímero tras compartir el enlace. */
  readonly linkShareState = signal<'idle' | 'shared' | 'copied'>('idle');
  private copiedTimer: number | null = null;
  private linkShareTimer: number | null = null;

  private readonly clipboard = inject(WaitingRoomClipboard);
  private readonly linkSharer = inject(WaitingRoomLinkSharer);
  readonly joinUrl = computed(() => {
    const code = this.joinCode();
    return code ? buildJoinUrl(code) : '';
  });

  startButtonLabel(): string {
    if (this.selfReady() && this.opponentReady()) {
      return 'Empezando...';
    }
    if (this.selfReady()) {
      return 'Esperando al rival...';
    }
    if (this.starting()) {
      return 'Marcando listo...';
    }
    return 'Estoy listo';
  }

  statusMessage(): string {
    if (!this.rivalPresent()) {
      return 'Esperando a que se una un rival.';
    }
    if (this.selfReady() && this.opponentReady()) {
      return 'Los dos estan listos. La partida esta por empezar.';
    }
    if (this.selfReady()) {
      return 'Esperando a que el rival confirme.';
    }
    if (this.opponentReady()) {
      return 'El rival ya esta listo.';
    }
    return 'Cuando ambos confirmen, empieza la partida.';
  }

  onStart(): void {
    if (this.canStart() && !this.starting() && !this.selfReady()) {
      this.start.emit();
    }
  }

  onLeave(): void {
    if (!this.leaving()) {
      this.leave.emit();
    }
  }

  async onCopy(): Promise<void> {
    const code = this.joinCode();
    if (!code) {
      return;
    }
    const ok = await this.clipboard.copy(code);
    if (ok) {
      this.copied.set(true);
      if (this.copiedTimer !== null) {
        clearTimeout(this.copiedTimer);
      }
      this.copiedTimer = window.setTimeout(() => this.copied.set(false), 2000);
    }
  }

  shareLinkLabel(): string {
    if (this.linkShareState() === 'shared') {
      return '¡Compartido!';
    }
    if (this.linkShareState() === 'copied') {
      return '¡Enlace copiado!';
    }
    return 'Compartir enlace';
  }

  async onShareLink(): Promise<void> {
    const url = this.joinUrl();
    if (!url) {
      return;
    }

    const shared = await this.linkSharer.share(url);
    if (shared) {
      this.linkShareState.set('shared');
      if (this.linkShareTimer !== null) {
        clearTimeout(this.linkShareTimer);
      }
      this.linkShareTimer = window.setTimeout(() => this.linkShareState.set('idle'), 2000);
      return;
    }

    const copied = await this.clipboard.copy(url);
    if (copied) {
      this.linkShareState.set('copied');
      if (this.linkShareTimer !== null) {
        clearTimeout(this.linkShareTimer);
      }
      this.linkShareTimer = window.setTimeout(() => this.linkShareState.set('idle'), 2000);
    }
  }

  ngOnDestroy(): void {
    if (this.copiedTimer !== null) {
      clearTimeout(this.copiedTimer);
    }
    if (this.linkShareTimer !== null) {
      clearTimeout(this.linkShareTimer);
    }
  }
}

/**
 * Envoltorio fino sobre la Clipboard API para que sea inyectable/mockeable en
 * tests (evita acceder a `navigator.clipboard` directamente en el componente).
 */
@Injectable({ providedIn: 'root' })
export class WaitingRoomClipboard {
  async copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}

@Injectable({ providedIn: 'root' })
export class WaitingRoomLinkSharer {
  async share(url: string): Promise<boolean> {
    try {
      if (typeof navigator.share !== 'function') {
        return false;
      }

      await navigator.share({
        title: 'Truco a 3',
        text: 'Unite a mi partida privada',
        url,
      });
      return true;
    } catch {
      return false;
    }
  }
}
