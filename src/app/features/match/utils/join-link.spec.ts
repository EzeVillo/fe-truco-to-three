import { afterEach, describe, expect, it } from 'vitest';
import { buildJoinUrl } from './join-link';

describe('Enlaces de invitación', () => {
  const base = document.createElement('base');

  afterEach(() => base.remove());

  function setBase(href: string): void {
    base.href = href;
    document.head.prepend(base);
  }

  it('conserva el prefijo de producción al compartir desde una partida', () => {
    setBase('https://ezevillo.com/truco-a-3/');
    expect(buildJoinUrl('ABC123')).toBe('https://ezevillo.com/truco-a-3/join/ABC123');
  });

  it('conserva el prefijo del despliegue anterior', () => {
    setBase('https://ezevillo.github.io/fe-truco-to-three/');
    expect(buildJoinUrl('ABC123')).toBe('https://ezevillo.github.io/fe-truco-to-three/join/ABC123');
  });

  it('permite compartir en desarrollo desde la raíz', () => {
    setBase('http://localhost:4200/');
    expect(buildJoinUrl('ABC123')).toBe('http://localhost:4200/join/ABC123');
  });

  it('recorta espacios y codifica los caracteres del código', () => {
    setBase('https://ezevillo.com/truco-a-3/');
    expect(buildJoinUrl(' A/B? ')).toBe('https://ezevillo.com/truco-a-3/join/A%2FB%3F');
  });

  it('no genera enlaces para códigos vacíos', () => {
    expect(buildJoinUrl('  ')).toBe('');
  });
});
