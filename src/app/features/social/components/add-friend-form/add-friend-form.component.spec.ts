import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { AddFriendFormComponent } from './add-friend-form.component';

describe('AddFriendFormComponent', () => {
  let fixture: ComponentFixture<AddFriendFormComponent>;
  let component: AddFriendFormComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AddFriendFormComponent] });
    fixture = TestBed.createComponent(AddFriendFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('deshabilita el botón cuando el input está vacío', () => {
    const button = el().querySelector('button')!;
    expect(button.disabled).toBe(true);
  });

  it('no emite si el valor es sólo espacios', () => {
    let emitted: string | null = null;
    component.submitRequest.subscribe((v) => (emitted = v));
    component.username.set('   ');
    component.onSubmit();
    expect(emitted).toBeNull();
  });

  it('emite el username al enviar', () => {
    let emitted: string | null = null;
    component.submitRequest.subscribe((v) => (emitted = v));
    component.username.set('martina');
    component.onSubmit();
    expect(emitted).toBe('martina');
  });

  it('reset() limpia el input', () => {
    component.username.set('martina');
    component.reset();
    expect(component.username()).toBe('');
  });

  it('muestra el mensaje de error recibido', () => {
    fixture.componentRef.setInput('errorMessage', 'Ese usuario no existe.');
    fixture.detectChanges();
    expect(el().textContent).toContain('Ese usuario no existe.');
  });
});
