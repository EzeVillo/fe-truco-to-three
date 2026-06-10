import { Injectable, computed, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Estado del despertar del backend.
 *
 * - `idle`    : todavía no se intentó despertar.
 * - `waking`  : hay un poll en curso contra el readiness probe.
 * - `ready`   : el readiness devolvió 200 (proceso + DB arriba).
 * - `error`   : se agotó el tope de tiempo sin obtener 200.
 */
export type ServerWakeStatus = 'idle' | 'waking' | 'ready' | 'error';

/**
 * Despierta el backend (Render free tier + Neon) al entrar/refrescar la app.
 *
 * El backend se duerme dos veces: Render apaga el proceso por inactividad y Neon
 * suspende la base. Pegarle a `/actuator/health/readiness` resuelve ambos de un
 * saque: fuerza el cold-start del proceso y, como el grupo readiness incluye el
 * check `db`, abre una conexión que despierta Neon. El probe devuelve 200 recién
 * cuando la DB responde, así que es la señal exacta de "ya se puede entrar".
 *
 * Se usa `fetch` (no `HttpClient`) a propósito: evita los interceptors de auth
 * (no agrega `Authorization`, no dispara el refresh proactivo contra un server
 * frío ni un preflight) y da un timeout por request limpio vía `AbortController`.
 */
@Injectable({ providedIn: 'root' })
export class ServerWakeService {
  /** Demora antes de mostrar la pantalla de espera (si ya está listo, no se ve). */
  private static readonly GRACE_MS = 2_500;
  /** Timeout por intento: un cold-start cuelga la conexión; cortamos y reintentamos. */
  private static readonly REQUEST_TIMEOUT_MS = 8_000;
  /** Pausa entre intentos fallidos. */
  private static readonly POLL_INTERVAL_MS = 2_000;
  /** Tope total antes de rendirse y pasar a `error`. */
  private static readonly MAX_TOTAL_MS = 180_000;

  private readonly _status = signal<ServerWakeStatus>('idle');
  readonly status = this._status.asReadonly();

  /** El backend respondió 200: ya se pueden arrancar los servicios que lo usan. */
  readonly isReady = computed(() => this._status() === 'ready');

  /** La gracia ya pasó: habilita mostrar la overlay si todavía estamos `waking`. */
  private readonly graceElapsed = signal(false);

  /**
   * La pantalla "levantando el servidor" se muestra solo si el wake tarda más
   * que la gracia, o si terminó en error. Si Render/Neon ya estaban despiertos
   * el readiness responde en ~200ms y el usuario nunca la ve.
   */
  readonly overlayVisible = computed(
    () => (this._status() === 'waking' && this.graceElapsed()) || this._status() === 'error',
  );

  private started = false;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Idempotente: arranca el poll una sola vez por ciclo de vida. */
  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    void this.runWakeLoop();
  }

  /** Reintento manual desde la overlay tras un `error`. */
  retry(): void {
    if (this._status() === 'waking') {
      return;
    }

    this.started = false;
    this.start();
  }

  private async runWakeLoop(): Promise<void> {
    this.graceElapsed.set(false);
    this._status.set('waking');

    this.graceTimer = setTimeout(() => this.graceElapsed.set(true), ServerWakeService.GRACE_MS);

    const deadline = Date.now() + ServerWakeService.MAX_TOTAL_MS;
    try {
      while (Date.now() < deadline) {
        if (await this.pingReadiness()) {
          this._status.set('ready');
          return;
        }
        // Primer fallo: ya sabemos que hay que esperar. Mostrar overlay de inmediato
        // sin aguardar la gracia (que sólo servía para absorber respuestas rápidas OK).
        this.clearGraceTimer();
        this.graceElapsed.set(true);
        await delay(ServerWakeService.POLL_INTERVAL_MS);
      }
      this._status.set('error');
    } finally {
      this.clearGraceTimer();
    }
  }

  /**
   * Un intento contra el readiness probe. `true` solo si devolvió el JSON de
   * actuator con `status: "UP"`.
   *
   * No alcanza con chequear el 200: en dev, si el proxy no rutea `/actuator`,
   * el dev server de Angular sirve el `index.html` (SPA fallback) con `200` y
   * `Content-Type: text/html`. Lo mismo puede pasar en prod con páginas de error
   * de un CDN. Por eso exigimos cuerpo JSON y `status === 'UP'`.
   */
  private async pingReadiness(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ServerWakeService.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(environment.healthUrl, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        return false;
      }

      const contentType = response.headers.get('Content-Type') ?? '';
      if (!contentType.includes('json')) {
        return false;
      }

      const body = (await response.json()) as { status?: string };
      // Spring Boot Actuator retorna "ACCEPTING_TRAFFIC" en /health/readiness (no "UP").
      return body.status === 'UP' || body.status === 'ACCEPTING_TRAFFIC';
    } catch {
      // Red caída / connection hang del cold-start / body no-JSON / abort → reintentar.
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  private clearGraceTimer(): void {
    if (this.graceTimer !== null) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
