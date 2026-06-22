import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioEngineService } from './audio-engine.service';

interface ContextMock {
  state: AudioContextState;
  destination: unknown;
  resume: ReturnType<typeof vi.fn>;
}

function makeEngine(): AudioEngineService {
  return TestBed.inject(AudioEngineService);
}

describe('AudioEngineService', () => {
  let contexts: ContextMock[];
  let listeners: Map<string, () => void>;

  async function flush(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    contexts = [];
    listeners = new Map();
    TestBed.configureTestingModule({});

    vi.stubGlobal('AudioContext', function AudioContextMockCtor(this: ContextMock) {
      this.state = 'running';
      this.destination = { id: 'destination' };
      this.resume = vi.fn().mockResolvedValue(undefined);
      contexts.push(this);
    });
    vi.stubGlobal('window', {
      AudioContext: globalThis.AudioContext,
      addEventListener: (type: string, handler: () => void) => listeners.set(type, handler),
      removeEventListener: (type: string) => listeners.delete(type),
    });
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: (type: string, handler: () => void) => listeners.set(type, handler),
      removeEventListener: (type: string) => listeners.delete(type),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('start engancha el gesto y al dispararlo reanuda y marca unlocked', async () => {
    const engine = makeEngine();
    engine.start();
    contexts[0].state = 'suspended';

    expect(engine.unlocked()).toBe(false);
    listeners.get('pointerdown')?.();
    await flush();

    expect(contexts[0].resume).toHaveBeenCalledOnce();
    expect(engine.unlocked()).toBe(true);
    // Tras desbloquear, los listeners de gesto se desenganchan.
    expect(listeners.has('pointerdown')).toBe(false);
  });

  it('start es idempotente: no engancha el gesto dos veces', () => {
    const addSpy = vi.spyOn(
      globalThis.document as unknown as { addEventListener: () => void },
      'addEventListener',
    );
    const engine = makeEngine();

    engine.start();
    engine.start();

    // 4 tipos de evento en document (pointerdown/touchend/keydown del gesto +
    // visibilitychange de la recuperación), una sola vez cada uno.
    expect(addSpy).toHaveBeenCalledTimes(4);
  });

  it('al volver a visible reanuda un contexto interrumpido por iOS', async () => {
    const engine = makeEngine();
    engine.start();
    listeners.get('pointerdown')?.(); // unlock inicial
    await flush();
    contexts[0].state = 'suspended';

    listeners.get('visibilitychange')?.();
    await flush();

    expect(contexts[0].resume).toHaveBeenCalled();
  });

  it('re-arma el unlock por gesto si el resume al volver a visible falla', async () => {
    const engine = makeEngine();
    engine.start();
    listeners.get('pointerdown')?.(); // unlock inicial: desengancha el gesto
    await flush();
    expect(listeners.has('pointerdown')).toBe(false);

    contexts[0].state = 'suspended';
    contexts[0].resume = vi.fn().mockRejectedValue(new Error('needs gesture'));
    listeners.get('visibilitychange')?.();
    await flush();

    // Sin resume posible, vuelve a esperar un gesto del usuario.
    expect(engine.unlocked()).toBe(false);
    expect(listeners.has('pointerdown')).toBe(true);
  });

  it('corre los hooks de onUnlock en el primer gesto', async () => {
    const engine = makeEngine();
    const hook = vi.fn();
    engine.onUnlock(hook);
    engine.start();

    listeners.get('pointerdown')?.();
    await flush();

    expect(hook).toHaveBeenCalled();
  });

  it('corre los hooks de onResume al volver a foreground', async () => {
    const engine = makeEngine();
    const hook = vi.fn();
    engine.onResume(hook);
    engine.start();
    listeners.get('pointerdown')?.();
    await flush();

    listeners.get('visibilitychange')?.();
    await flush();

    expect(hook).toHaveBeenCalled();
  });

  it('un hook que lanza no frena a los demás', async () => {
    const engine = makeEngine();
    const boom = vi.fn(() => {
      throw new Error('boom');
    });
    const ok = vi.fn();
    engine.onUnlock(boom);
    engine.onUnlock(ok);
    engine.start();

    listeners.get('pointerdown')?.();
    await flush();

    expect(ok).toHaveBeenCalled();
  });
});
