import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { MatchScreenComponent } from './match-screen.component';

describe('MatchScreenComponent', () => {
  let fixture: ComponentFixture<MatchScreenComponent>;

  function setupComponent(queryParams: Record<string, string>, params: Record<string, string> = {}): void {
    TestBed.configureTestingModule({
      imports: [MatchScreenComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => params[key] ?? null,
              },
              queryParamMap: {
                get: (key: string) => queryParams[key] ?? null,
              },
            },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(MatchScreenComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    // each test calls setupComponent explicitly
  });

  it('selects default fixture when no query param is provided', () => {
    setupComponent({});
    const view = fixture.componentInstance.matchView();
    expect(view).not.toBeNull();
    expect(view!.self.seat).toBe('PLAYER_ONE');
  });

  it('selects viewer-player-two fixture from query param', () => {
    setupComponent({ fixture: 'viewer-player-two' });
    const view = fixture.componentInstance.matchView();
    expect(view).not.toBeNull();
    expect(view!.self.seat).toBe('PLAYER_TWO');
  });

  it('falls back to default when fixture key is unknown', () => {
    setupComponent({ fixture: 'does-not-exist' });
    const view = fixture.componentInstance.matchView();
    expect(view).not.toBeNull();
    expect(view!.self.seat).toBe('PLAYER_ONE');
  });
});
