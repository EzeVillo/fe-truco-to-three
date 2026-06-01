import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';
import { RulesSectionComponent } from './rules-section.component';
import { VARIANT_RULE_SECTIONS } from '../../models/variant-rules';

describe('RulesSectionComponent', () => {
  let fixture: ComponentFixture<RulesSectionComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RulesSectionComponent],
    });

    fixture = TestBed.createComponent(RulesSectionComponent);
    fixture.detectChanges();
  });

  it('renderiza el punto exacto sin detalles redundantes', () => {
    const text = textContent(fixture);

    expect(text).toContain('Punto exacto');
    expect(text).toContain('exactamente a 3 puntos');
    expect(text).toContain('supera 3, pierde');
    expect(text).not.toContain('Al terminar un game');
    expect(text).not.toContain('Formato del match');
  });

  it('renderiza las reglas especiales de puntuacion y cierre', () => {
    const text = textContent(fixture);

    expect(text).toContain('Falta envido');
    expect(text).not.toContain('FALTA_ENVIDO');
    expect(text).not.toContain('Si no se quiere, otorga 1 punto');
    expect(text).toContain('Quiero y me voy al mazo');
    expect(text).toContain('el rival gana el truco cantado en ese momento');
    expect(text).not.toContain('nivel vigente');
    expect(text).not.toContain('La round termina inmediatamente');
    expect(text).toContain('Cierre por ancho de espada');
    expect(text).toContain('Después de ese cierre automático ya no se puede cantar truco');
    expect(text).toContain('Irse al mazo siendo mano');
  });

  it('no renderiza el bloque visual de claves', () => {
    const text = textContent(fixture);

    expect(text).not.toContain('Claves');
    expect(fixture.debugElement.query(By.css('.rules__terms'))).toBeNull();
  });

  it('mantiene ids unicos y valores criticos en la coleccion local', () => {
    const ids = VARIANT_RULE_SECTIONS.map((section) => section.id);
    const uniqueIds = new Set(ids);
    const criticalText = VARIANT_RULE_SECTIONS.flatMap((section) => [
      section.title,
      section.summary ?? '',
      ...section.items.map((item) => item.text),
    ]).join(' ');

    expect(uniqueIds.size).toBe(ids.length);
    expect(ids).toEqual([
      'objective',
      'falta-envido',
      'fold-after-quiero',
      'sword-ace-close',
      'hand-fold-restriction',
    ]);
    expect(criticalText).toContain('3');
    expect(criticalText).toContain('Falta envido');
    expect(criticalText).toContain('ancho de espada');
  });

  it('expone clases estructurales para la composicion responsive', () => {
    expect(fixture.debugElement.query(By.css('.rules'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('.rules__list-sections'))).toBeTruthy();
    expect(fixture.debugElement.queryAll(By.css('.rules__section')).length).toBe(
      VARIANT_RULE_SECTIONS.length,
    );
  });
});

function textContent(fixture: ComponentFixture<RulesSectionComponent>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}
