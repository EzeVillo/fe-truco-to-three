import { Injectable, signal } from '@angular/core';

type AudioContextCtor = typeof AudioContext;

/** Resuelve el constructor de AudioContext (incluye el prefijo webkit de iOS). */
function resolveAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Dueño del **único `AudioContext`** de la app y punto central del **desbloqueo de
 * audio en iOS/WebKit**.
 *
 * Por qué un solo contexto: en iOS cada `AudioContext` se reanuda por separado y
 * el estado `interrupted` (al ir a background) no se revierte solo. Con un contexto
 * por servicio (SFX, música, clicks), un gesto que reanudaba uno no garantizaba que
 * los otros volvieran a `running`, y alguno quedaba mudo ("entro y no tengo
 * sonido"). Centralizando el contexto, **un solo `resume()`** —en el primer gesto o
 * al volver a foreground— desbloquea toda la reproducción.
 *
 * Responsabilidades:
 * - Crear y exponer el contexto compartido (`getContext()`); `usingFallback` indica
 *   que no hay Web Audio (entorno de test/desktop viejo) y cada servicio cae a
 *   `HTMLAudioElement`.
 * - Anclar **una vez** (desde el bootstrap, `start()`) el gesto de unlock y la
 *   recuperación por `visibilitychange`/`pageshow`.
 * - `onUnlock` / `onResume`: hooks para el trabajo específico de cada servicio en el
 *   primer gesto y al volver a foreground (p. ej. el `audio.play()` de la música o
 *   el precalentado de los `<audio>` del fallback).
 *
 * Todo es no-bloqueante: cualquier fallo se traga y nunca rompe el flujo de la app.
 */
@Injectable({ providedIn: 'root' })
export class AudioEngineService {
  private context: AudioContext | null = null;
  private fallback = false;

  private gestureHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;

  /** Trabajo extra a correr en el primer gesto (autoplay de la música, precalentado del fallback). */
  private readonly unlockListeners = new Set<() => void>();
  /** Trabajo a correr al volver a foreground (reintento de play de la música). */
  private readonly resumeListeners = new Set<() => void>();
  /** Trabajo a correr al pasar a background (pausar la música para que no suene oculta). */
  private readonly hiddenListeners = new Set<() => void>();

  private readonly _unlocked = signal(false);
  /** ¿Ya hubo un gesto que desbloqueó la reproducción? */
  readonly unlocked = this._unlocked.asReadonly();

  /**
   * Ancla el desbloqueo al primer gesto y la recuperación al volver del background.
   * Idempotente. Llamar una vez al bootstrap (`App`) para que los listeners existan
   * antes de cualquier navegación.
   */
  start(): void {
    if (typeof document === 'undefined') {
      return;
    }
    this.ensureContext();
    this.attachGesture();
    this.attachVisibilityRecovery();
  }

  /** El único contexto compartido, o `null` en fallback/SSR. Lo crea de forma perezosa. */
  getContext(): AudioContext | null {
    this.ensureContext();
    return this.context;
  }

  /** `true` si no hay Web Audio disponible: los servicios deben usar su fallback `<audio>`. */
  get usingFallback(): boolean {
    this.ensureContext();
    return this.fallback;
  }

  /** Registra trabajo a ejecutar en el primer gesto del usuario (idempotente por referencia). */
  onUnlock(callback: () => void): void {
    this.unlockListeners.add(callback);
  }

  /** Registra trabajo a ejecutar al volver a foreground (idempotente por referencia). */
  onResume(callback: () => void): void {
    this.resumeListeners.add(callback);
  }

  /** Registra trabajo a ejecutar al pasar a background/oculto (idempotente por referencia). */
  onHidden(callback: () => void): void {
    this.hiddenListeners.add(callback);
  }

  /**
   * Reanuda el contexto si iOS lo dejó parado (`suspended`/`interrupted`). No-op si
   * ya corre o si estamos en fallback. Best-effort: el rechazo se traga.
   */
  resume(): void {
    const context = this.context;
    if (!context || context.state === 'running') {
      return;
    }
    context.resume().catch(() => undefined);
  }

  private ensureContext(): void {
    if (this.context || this.fallback) {
      return;
    }
    const Ctor = resolveAudioContextCtor();
    if (!Ctor) {
      this.fallback = true;
      return;
    }
    try {
      this.context = new Ctor();
    } catch {
      this.fallback = true;
    }
  }

  private attachGesture(): void {
    if (this.gestureHandler || typeof document === 'undefined') {
      return;
    }
    const handler = () => this.unlock();
    this.gestureHandler = handler;
    document.addEventListener('pointerdown', handler);
    document.addEventListener('touchend', handler);
    document.addEventListener('keydown', handler);
  }

  /** Desbloqueo en el gesto: reanuda el contexto y corre el trabajo específico de cada servicio. */
  private unlock(): void {
    this.ensureContext();
    const context = this.context;
    if (!context || context.state === 'running') {
      this.finishUnlock();
      return;
    }
    context
      .resume()
      .then(() => this.finishUnlock())
      .catch(() => undefined);
  }

  private finishUnlock(): void {
    this.runListeners(this.unlockListeners);
    if (this._unlocked()) {
      return;
    }
    this._unlocked.set(true);
    this.detachGesture();
  }

  private detachGesture(): void {
    if (!this.gestureHandler || typeof document === 'undefined') {
      return;
    }
    document.removeEventListener('pointerdown', this.gestureHandler);
    document.removeEventListener('touchend', this.gestureHandler);
    document.removeEventListener('keydown', this.gestureHandler);
    this.gestureHandler = null;
  }

  /**
   * Recuperación tras volver a la app en iOS/WebKit: al ir a background el contexto
   * queda `interrupted` y no vuelve solo a `running`. Al pasar a visible (o restaurar
   * desde el bfcache vía `pageshow`) reanudamos; si WebKit exige un gesto nuevo,
   * re-armamos el unlock para que el próximo toque lo haga.
   */
  private attachVisibilityRecovery(): void {
    if (this.visibilityHandler || typeof document === 'undefined') {
      return;
    }
    const handler = () => {
      if (document.visibilityState === 'visible') {
        this.recover();
      } else {
        // Pasó a background: que cada servicio frene lo suyo (la música no debe
        // seguir/arrancar sonando con la pantalla apagada o la app en segundo plano).
        this.runListeners(this.hiddenListeners);
      }
    };
    this.visibilityHandler = handler;
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('pageshow', handler);
  }

  private recover(): void {
    const context = this.context;
    if (!context || context.state === 'running') {
      this.runListeners(this.resumeListeners);
      return;
    }
    context
      .resume()
      .then(() => {
        this.runListeners(this.resumeListeners);
        if (context.state !== 'running') {
          this.rearmGestureUnlock();
        }
      })
      .catch(() => this.rearmGestureUnlock());
  }

  /** El resume sin gesto falló: volvemos al modo "esperando el primer toque". */
  private rearmGestureUnlock(): void {
    this._unlocked.set(false);
    this.attachGesture();
  }

  private runListeners(listeners: Set<() => void>): void {
    for (const callback of listeners) {
      try {
        callback();
      } catch {
        // Cada hook es best-effort: un fallo no debe frenar a los demás.
      }
    }
  }
}
