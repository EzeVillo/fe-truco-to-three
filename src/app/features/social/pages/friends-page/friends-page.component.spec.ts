import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { FriendsPageComponent } from './friends-page.component';
import { SocialStore } from '../../services/social.store';

describe('FriendsPageComponent', () => {
  let fixture: ComponentFixture<FriendsPageComponent>;
  let component: FriendsPageComponent;

  const loading = signal(false);
  const error = signal<string | null>(null);
  const actionError = signal<string | null>(null);
  const friends = signal<{ friendUsername: string }[]>([]);
  const incoming = signal<{ requesterUsername: string }[]>([]);
  const outgoing = signal<{ addresseeUsername: string }[]>([]);

  const storeMock = {
    loading,
    error,
    actionError,
    friends,
    incoming,
    outgoing,
    friendsCount: signal(0),
    incomingCount: signal(0),
    start: vi.fn(),
    bootstrap: vi.fn(),
    retry: vi.fn(),
    sendRequest: vi.fn(() => true),
    acceptRequest: vi.fn(),
    declineRequest: vi.fn(),
    cancelRequest: vi.fn(),
    removeFriend: vi.fn(),
  };

  const dialogMock = { open: vi.fn(() => ({ afterClosed: () => of(true) })) };
  const routerMock = { navigateByUrl: vi.fn() };

  beforeEach(() => {
    loading.set(false);
    error.set(null);
    friends.set([]);
    incoming.set([]);
    outgoing.set([]);
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      imports: [FriendsPageComponent],
      providers: [
        { provide: SocialStore, useValue: storeMock },
        { provide: Router, useValue: routerMock },
        { provide: MatDialog, useValue: dialogMock },
      ],
    });
    fixture = TestBed.createComponent(FriendsPageComponent);
    component = fixture.componentInstance;
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('en ngOnInit arranca el store y bootstrapea', () => {
    fixture.detectChanges();
    expect(storeMock.start).toHaveBeenCalled();
    expect(storeMock.bootstrap).toHaveBeenCalled();
  });

  it('muestra estado de carga', () => {
    loading.set(true);
    fixture.detectChanges();
    expect(text()).toContain('Cargando');
  });

  it('muestra error con botón de reintento', () => {
    error.set('No pudimos conectarnos. Reintentá en unos segundos.');
    fixture.detectChanges();
    expect(text()).toContain('No pudimos conectarnos');
    const retry = (fixture.nativeElement as HTMLElement).querySelector(
      '.friends-page__state--error .t3-btn',
    )!;
    (retry as HTMLButtonElement).click();
    expect(storeMock.retry).toHaveBeenCalled();
  });

  it('muestra el estado vacío de amigos por defecto', () => {
    fixture.detectChanges();
    expect(text()).toContain('Todavía no tenés amigos');
  });

  it('al cambiar a la tab Recibidas muestra su estado vacío', () => {
    fixture.detectChanges();
    component.selectTab('incoming');
    fixture.detectChanges();
    expect(text()).toContain('No tenés solicitudes pendientes');
  });

  it('eliminar amigo abre el diálogo de confirmación y, si se confirma, llama removeFriend', () => {
    fixture.detectChanges();
    component.onRemove('martina');
    expect(dialogMock.open).toHaveBeenCalled();
    expect(storeMock.removeFriend).toHaveBeenCalledWith('martina');
  });
});
