import { Injectable, computed, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Estado del despertar del backend.
 *
 * - `idle`    : todavía no se intentó despertar.
 * - `waking`  : hay un poll en curso contra el endpoint de wake.
 * - `ready`   : el wake devolvió 200 (el proceso ya acepta requests).
 * - `error`   : se agotó el tope de tiempo sin obtener 200.
 */
export type ServerWakeStatus = 'idle' | 'waking' | 'ready' | 'error';

/**
 * Despierta el backend (Render free tier) al entrar/refrescar la app.
 *
 * Render apaga el proceso por inactividad. Pegarle al endpoint propio
 * `/api/public/wake` fuerza el cold-start: en cuanto el proceso vuelve a aceptar
 * requests responde 200, así que es la señal de "ya se puede entrar". (Flyway
 * corre al boot tocando la DB, así que si el wake responde la base ya estuvo
 * arriba en el arranque.)
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
  /** Inactividad máxima sin tráfico al backend antes de re-verificar readiness. */
  private static readonly IDLE_RECHECK_MS = 10 * 60_000;
  /** Cada cuánto se evalúa la inactividad mientras la pestaña está visible. */
  private static readonly IDLE_CHECK_INTERVAL_MS = 60_000;
  /**
   * Si la pestaña estuvo oculta al menos esto al volver a primer plano, asumimos
   * que el backend pudo dormirse (Render free tier) y mostramos la overlay sin la
   * gracia: aparece de entrada en vez de a mitad de la primera acción del usuario.
   */
  private static readonly BACKGROUND_RESUME_IMMEDIATE_MS = ServerWakeService.IDLE_RECHECK_MS;

  private readonly _status = signal<ServerWakeStatus>('idle');
  readonly status = this._status.asReadonly();

  /**
   * Latcheado: una vez `true`, queda `true` aunque un re-chequeo posterior vuelva
   * el status a `waking`. El `<router-outlet>` se monta con esta señal; si se
   * apagara durante un re-chequeo se destruiría toda la app (partida incluida).
   * El bloqueo visual del re-chequeo lo da la overlay, no el desmonte.
   */
  private readonly _everReady = signal(false);

  /** El backend respondió 200 al menos una vez: ya se pueden arrancar los servicios que lo usan. */
  readonly isReady = computed(() => this._everReady());

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

  /**
   * `true` cuando un ping de readiness ya falló en el ciclo actual: confirma que
   * el backend está dormido y el arranque va a tardar. Distingue el loader liviano
   * (verificación rápida tras inactividad, server probablemente vivo) del cartel
   * con imagen (cold start real). Se resetea al empezar cada wake loop.
   */
  private readonly _coldStart = signal(false);
  readonly coldStart = this._coldStart.asReadonly();

  private started = false;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private idleMonitorsAttached = false;
  /** Último momento en que el backend respondió una request (HTTP o wake). */
  private lastBackendActivity = Date.now();
  /** Momento en que la pestaña pasó a oculta; `null` mientras está visible. */
  private hiddenSince: number | null = null;

  /** Idempotente: arranca el poll una sola vez por ciclo de vida. */
  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.attachIdleMonitors();
    void this.runWakeLoop();
  }

  /**
   * Registra tráfico exitoso contra el backend (lo llama el interceptor HTTP).
   * Mientras haya actividad reciente no hace falta re-verificar el wake.
   */
  notifyActivity(): void {
    this.lastBackendActivity = Date.now();
  }

  /** Reintento manual desde la overlay tras un `error`. */
  retry(): void {
    if (this._status() === 'waking') {
      return;
    }

    this.started = false;
    this.start();
  }

  private async runWakeLoop(immediate = false): Promise<void> {
    this.graceElapsed.set(immediate);
    this._coldStart.set(false);
    this._status.set('waking');

    // `immediate`: ya sospechamos sleep (volvimos de un background largo), así que
    // no esperamos la gracia — la overlay se muestra de una. En el resto de los
    // casos la gracia absorbe los readiness que responden rápido sin parpadear.
    if (!immediate) {
      this.graceTimer = setTimeout(() => this.graceElapsed.set(true), ServerWakeService.GRACE_MS);
    }

    const deadline = Date.now() + ServerWakeService.MAX_TOTAL_MS;
    try {
      while (Date.now() < deadline) {
        if (await this.pingReadiness()) {
          this._status.set('ready');
          this._everReady.set(true);
          this.notifyActivity();
          return;
        }
        // Primer fallo: ya sabemos que hay que esperar. Mostrar overlay de inmediato
        // sin aguardar la gracia (que sólo servía para absorber respuestas rápidas OK)
        // y escalar del loader liviano al cartel con imagen (cold start confirmado).
        this.clearGraceTimer();
        this.graceElapsed.set(true);
        this._coldStart.set(true);
        await delay(ServerWakeService.POLL_INTERVAL_MS);
      }
      this._status.set('error');
    } finally {
      this.clearGraceTimer();
    }
  }

  /**
   * Un intento contra el endpoint de wake. `true` solo si devolvió el JSON
   * con `status: "ready"`.
   *
   * No alcanza con chequear el 200: en dev, si el proxy no rutea `/api`, el dev
   * server de Angular sirve el `index.html` (SPA fallback) con `200` y
   * `Content-Type: text/html`. Lo mismo puede pasar en prod con páginas de error
   * de un CDN. Por eso exigimos cuerpo JSON y `status === 'ready'`.
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
      // El endpoint propio /api/public/wake devuelve { status: "ready" } cuando el proceso acepta requests.
      return body.status === 'ready';
    } catch {
      // Red caída / connection hang del cold-start / body no-JSON / abort → reintentar.
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Vigila la inactividad para detectar un backend que Render volvió a dormir.
   *
   * Disparadores: la pestaña vuelve a estar visible (`visibilitychange`) o se
   * restaura desde el bfcache de iOS (`pageshow`), más un tick periódico para la
   * pestaña que quedó abierta y ociosa. Si hace más de `IDLE_RECHECK_MS` que el
   * backend no responde nada, se re-corre el wake loop: si el server sigue
   * despierto el ping responde en ~200ms y la overlay nunca aparece (gracia de
   * `GRACE_MS`); si se durmió, la overlay tapa la app hasta que vuelva.
   *
   * Servicio root: vive lo que la app, no hace falta limpiar listeners/interval.
   */
  private attachIdleMonitors(): void {
    if (this.idleMonitorsAttached || typeof document === 'undefined') {
      return;
    }
    this.idleMonitorsAttached = true;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this.hiddenSince = Date.now();
        return;
      }
      // Volvió a primer plano: si estuvo oculta lo suficiente, asumimos sleep del
      // backend y saltamos la gracia para que la overlay aparezca de entrada.
      const hiddenMs = this.hiddenSince === null ? 0 : Date.now() - this.hiddenSince;
      this.hiddenSince = null;
      this.recheckIfIdle(hiddenMs >= ServerWakeService.BACKGROUND_RESUME_IMMEDIATE_MS);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    // Restauración desde el bfcache de iOS: la página estuvo congelada, mismo
    // riesgo de sleep → overlay sin gracia (no-op si todavía no estaba `ready`).
    window.addEventListener('pageshow', () => this.recheckIfIdle(true));
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.recheckIfIdle();
      }
    }, ServerWakeService.IDLE_CHECK_INTERVAL_MS);
  }

  /**
   * Re-corre el wake loop sólo si está `ready` y el backend lleva idle el umbral.
   * Con `immediate`, el wake loop muestra la overlay sin la gracia de 2.5s (se usa
   * al volver de un background largo, donde el sleep de Render es probable).
   */
  private recheckIfIdle(immediate = false): void {
    if (this._status() !== 'ready') {
      return;
    }
    if (Date.now() - this.lastBackendActivity < ServerWakeService.IDLE_RECHECK_MS) {
      return;
    }
    void this.runWakeLoop(immediate);
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
