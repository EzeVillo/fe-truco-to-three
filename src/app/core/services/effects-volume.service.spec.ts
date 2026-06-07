import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EffectsVolumeService } from './effects-volume.service';

function makeService(): EffectsVolumeService {
  return TestBed.inject(EffectsVolumeService);
}

describe('EffectsVolumeService', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k) => store[k] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => {
      store[k] = String(v);
    });
    TestBed.configureTestingModule({});
  });

  it('arranca encendido a volumen pleno por defecto', () => {
    const service = makeService();
    expect(service.enabled()).toBe(true);
    expect(service.volume()).toBe(1);
    expect(service.gain()).toBe(1);
  });

  it('toggleEnabled mutea y la ganancia cae a 0 sin perder el volumen', () => {
    const service = makeService();
    service.setVolume(0.5);
    service.toggleEnabled();

    expect(service.enabled()).toBe(false);
    expect(service.gain()).toBe(0);
    // El volumen subyacente se conserva para cuando se reactive.
    expect(service.volume()).toBe(0.5);

    service.toggleEnabled();
    expect(service.gain()).toBe(0.5);
  });

  it('setVolume clampea a [0, 1]', () => {
    const service = makeService();
    service.setVolume(2);
    expect(service.volume()).toBe(1);
    service.setVolume(-1);
    expect(service.volume()).toBe(0);
  });

  it('persiste la preferencia en localStorage', () => {
    const service = makeService();
    service.setVolume(0.3);
    service.toggleEnabled();

    expect(store['t3.sfx.volume']).toBe('0.3');
    expect(store['t3.sfx.enabled']).toBe('false');
  });

  it('rehidrata el estado persistido', () => {
    store['t3.sfx.enabled'] = 'false';
    store['t3.sfx.volume'] = '0.42';

    const service = makeService();
    expect(service.enabled()).toBe(false);
    expect(service.volume()).toBe(0.42);
    expect(service.gain()).toBe(0);
  });
});
